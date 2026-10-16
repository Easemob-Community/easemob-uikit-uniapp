// 群数据域：已加入群快照、群详情、成员游标分页（首屏后补拉 admin 合并角色）、公告，
// 以及群管理写操作（创建/邀请/退群/解散/转让/资料/公告/成员/管理员/全员禁言）。
// 事件接线对齐 vue 版 group-events.ts 语义裁剪（成员进出计数、资料/公告变更、
// 被移出/解散清会话、邀请按 group kind 转 contact invites（含 groupId/群名快照）、群主/管理员/全员禁言角色同步、
// 成员进出/群名变更/公告变更/转让群主插本地系统通知灰条——insertGroupNotice 经 hooks 落消息列表）。
// SDK wire 字段归一（ownerId/owner.userId、maxMembers、joinApprovalRequired、
// muteAllMembers、avatarUrl/avatarurl）集中在 toEmGroup/toEmGroupMember 边界。
import type {
  ChatClient,
  GroupDetail,
  GroupManager,
  GroupMemberEntry,
  GroupSummary,
  GroupUserInfo,
  JoinedGroupSummary,
  UserInfo
} from 'easemob-websdk'
import { CONTACT_INVITE_KIND, CONTACT_INVITE_STATUS, GROUP_MEMBER_PAGE_SIZE, GROUP_MEMBER_ROLE, GROUP_NOTICE_EVENT } from '../constants'
import type { GroupNoticeEventValue } from '../constants'
import { connectionStore } from '../store/connection'
import { addInvite, updateInviteStatus } from '../store/contact'
import { displayNameOf, mergeUserInfo } from '../store/user'
import {
  appendGroupMembers,
  clearGroups,
  groupStore,
  incrementMemberCount,
  removeGroup,
  removeGroupMembersLocal,
  setGroupAnnouncement,
  setGroupMembers,
  setJoinedGroups,
  updateGroup,
  updateGroupMemberRole,
  upsertGroup
} from '../store/group'
import { createLogger } from '../utils/logger'
import { useLocale } from '../use/useLocale'
import type { CreateGroupParams, EmContactInvite, EmGroup, EmGroupMember } from '../types'
import { ensureUserInfos } from './user-info'

const logger = createLogger('group')

/** 通知展示名的最小结构（SDK UserInfo/GroupUserInfo 双兼容） */
interface NoticeUser {
  userId: string
  nickname?: string
}

/** 门面注入的群域钩子：被移出/群解散时清会话与本地消息（会话域本地删除入口）；
 * 群名变更时同步会话名（会话列表/聊天头部展示 conversation.name）；
 * 群事件系统通知插入群消息列表（本地灰条，不发服务端） */
export interface EmGroupHooks {
  removeConversationLocal: (conversationId: string) => void
  updateConversationName: (conversationId: string, name: string) => void
  insertGroupNotice: (groupId: string, text: string) => void
}

export class EmGroupDomain {
  private client: ChatClient | null = null
  private waitOnline: (() => Promise<void>) | null = null
  private hooks: EmGroupHooks | null = null
  // 飞行中 Promise 去重（参照 vue group-domain pendingGroupInfoRequests）
  private infoPromiseByGroupId: Record<string, Promise<EmGroup>> = {}
  private announcementPromiseByGroupId: Record<string, Promise<string>> = {}
  private adminPromiseByGroupId: Record<string, Promise<void>> = {}

  bind(client: ChatClient, waitOnline: () => Promise<void>, hooks: EmGroupHooks): void {
    if (this.client != null) {
      return
    }
    this.client = client
    this.waitOnline = waitOnline
    this.hooks = hooks
    // 群自动同步由 SDK 后台完成（enableSyncData 'group'），同步完成后重读快照自愈（同 contact 套路）
    client.addEventHandler('emkit-group-sync', {
      onSyncDataFinished: (payload) => {
        logger.debug('onSyncDataFinished raw payload:', JSON.parse(JSON.stringify(payload)))
        if (payload.status === 'failed') {
          if (payload.dataType === 'group') {
            logger.warn('group sync failed:', payload.error?.stage, payload.error?.message)
          }
          return
        }
        if (payload.dataType === 'group') {
          logger.info('group sync finished, refreshing snapshot')
          this.refresh()
        }
      }
    })
    const mgr = this.manager()
    if (mgr == null) {
      return
    }
    mgr.addEventHandler('emkit-group', {
      // 成员入群：计数 +n；含己方时确保群在列表内（邀请自动入群等场景）；插系统通知灰条
      onMembersJoined: (payload) => {
        logger.debug('onMembersJoined raw payload:', JSON.parse(JSON.stringify(payload)))
        const members = payload.members ?? []
        if (members.some((m) => m.userId === connectionStore.userId)) {
          this.getGroupInfo(payload.groupId).catch(() => {})
        }
        incrementMemberCount(payload.groupId, members.length)
        this.insertGroupNotice(payload.groupId, GROUP_NOTICE_EVENT.MEMBERS_JOINED, { members })
      },
      // 成员退群：计数 -n；插系统通知灰条
      onMembersExited: (payload) => {
        logger.debug('onMembersExited raw payload:', JSON.parse(JSON.stringify(payload)))
        const members = payload.members ?? []
        incrementMemberCount(payload.groupId, -members.length)
        this.insertGroupNotice(payload.groupId, GROUP_NOTICE_EVENT.MEMBERS_EXITED, { members })
      },
      // 群资料变更：写详情缓存；名称变化同步会话名（会话列表/聊天头部展示 conversation.name）+ 插系统通知
      onGroupInfoChanged: (payload) => {
        logger.debug('onGroupInfoChanged raw payload:', JSON.parse(JSON.stringify(payload)))
        const prev = groupStore.infoByGroupId[payload.groupId]
        const group = this.toEmGroup(payload.groupInfo)
        upsertGroup(group)
        if (group.name !== '' && prev != null && group.name !== prev.name) {
          this.insertGroupNotice(payload.groupId, GROUP_NOTICE_EVENT.GROUP_NAME_CHANGED, { name: group.name })
        }
        this.hooks?.updateConversationName?.(payload.groupId, group.name)
      },
      // 公告变更：写缓存（空串 = 已拉无公告）+ 插系统通知
      onAnnouncementChanged: (payload) => {
        logger.debug('onAnnouncementChanged raw payload:', JSON.parse(JSON.stringify(payload)))
        setGroupAnnouncement(payload.groupId, payload.announcement ?? '')
        this.insertGroupNotice(payload.groupId, GROUP_NOTICE_EVENT.ANNOUNCEMENT_CHANGED)
      },
      // 己方被移出群（SDK 5.x 该事件只下发给被移出的当前用户）：清群缓存 + 删会话清消息
      // （不插系统通知：removeConversationLocal 随即清消息缓存，插入即被擦除）
      onUserRemoved: (payload) => {
        logger.debug('onUserRemoved raw payload:', JSON.parse(JSON.stringify(payload)))
        removeGroup(payload.groupId)
        this.hooks?.removeConversationLocal(payload.groupId)
      },
      // 群解散：同上
      onGroupDestroyed: (payload) => {
        logger.debug('onGroupDestroyed raw payload:', JSON.parse(JSON.stringify(payload)))
        removeGroup(payload.groupId)
        this.hooks?.removeConversationLocal(payload.groupId)
      },
      // 收到群邀请（被邀请方）：转 contact invites 记录（group kind，pending）
      onInvitationReceived: (payload) => {
        logger.debug('onInvitationReceived raw payload:', JSON.parse(JSON.stringify(payload)))
        addInvite({
          id: `group:${payload.groupId}:${Date.now()}`,
          kind: CONTACT_INVITE_KIND.GROUP,
          from: payload.inviter?.userId ?? '',
          message: typeof payload.reason === 'string' ? payload.reason : '',
          status: CONTACT_INVITE_STATUS.PENDING,
          outgoing: false,
          ts: Date.now(),
          groupId: payload.groupId,
          groupName: this.groupNameOf(payload.groupId, payload.groupName)
        })
        this.mergeInviterProfile(payload.inviter)
      },
      // 我方邀请被接受（邀请方收）：落 outgoing 通知
      onInvitationAccepted: (payload) => {
        logger.debug('onInvitationAccepted raw payload:', JSON.parse(JSON.stringify(payload)))
        addInvite({
          id: `group:${payload.groupId}:${Date.now()}`,
          kind: CONTACT_INVITE_KIND.GROUP,
          from: payload.invitee?.userId ?? '',
          message: typeof payload.reason === 'string' ? payload.reason : '',
          status: CONTACT_INVITE_STATUS.ACCEPTED,
          outgoing: true,
          ts: Date.now(),
          groupId: payload.groupId,
          groupName: this.groupNameOf(payload.groupId)
        })
        this.mergeInviterProfile(payload.invitee)
      },
      // 我方邀请被拒绝（邀请方收）：落 outgoing 通知
      onInvitationDeclined: (payload) => {
        logger.debug('onInvitationDeclined raw payload:', JSON.parse(JSON.stringify(payload)))
        addInvite({
          id: `group:${payload.groupId}:${Date.now()}`,
          kind: CONTACT_INVITE_KIND.GROUP,
          from: payload.invitee?.userId ?? '',
          message: typeof payload.reason === 'string' ? payload.reason : '',
          status: CONTACT_INVITE_STATUS.DECLINED,
          outgoing: true,
          ts: Date.now(),
          groupId: payload.groupId,
          groupName: this.groupNameOf(payload.groupId)
        })
        this.mergeInviterProfile(payload.invitee)
      },
      // 邀请被自动接受（无需确认直接入群）：刷新群快照 + 落已接受记录
      onAutoAcceptInvitationFromGroup: (payload) => {
        logger.debug('onAutoAcceptInvitationFromGroup raw payload:', JSON.parse(JSON.stringify(payload)))
        this.refresh()
        addInvite({
          id: `group:${payload.groupId}:${Date.now()}`,
          kind: CONTACT_INVITE_KIND.GROUP,
          from: payload.inviter?.userId ?? '',
          message: typeof payload.inviteMessage === 'string' ? payload.inviteMessage : '',
          status: CONTACT_INVITE_STATUS.ACCEPTED,
          outgoing: false,
          ts: Date.now(),
          groupId: payload.groupId,
          groupName: this.groupNameOf(payload.groupId)
        })
        this.mergeInviterProfile(payload.inviter)
      },
      // 群主变更：owner 为成员角色唯一权威，新旧群主角色同步修正；插系统通知灰条
      onOwnerChanged: (payload) => {
        logger.debug('onOwnerChanged raw payload:', JSON.parse(JSON.stringify(payload)))
        const prevOwner = groupStore.infoByGroupId[payload.groupId]?.owner ?? payload.oldOwner?.userId ?? ''
        const newOwner = payload.newOwner?.userId ?? ''
        if (newOwner !== '') {
          updateGroup(payload.groupId, { owner: newOwner })
          updateGroupMemberRole(payload.groupId, newOwner, GROUP_MEMBER_ROLE.OWNER)
        }
        if (prevOwner !== '' && prevOwner !== newOwner) {
          updateGroupMemberRole(payload.groupId, prevOwner, GROUP_MEMBER_ROLE.MEMBER)
        }
        this.insertGroupNotice(payload.groupId, GROUP_NOTICE_EVENT.OWNER_CHANGED, { name: this.noticeNameOf(payload.newOwner) })
      },
      onAdminAdded: (payload) => {
        logger.debug('onAdminAdded raw payload:', JSON.parse(JSON.stringify(payload)))
        const userId = payload.administrator?.userId
        if (userId != null && userId !== '') {
          updateGroupMemberRole(payload.groupId, userId, GROUP_MEMBER_ROLE.ADMIN)
        }
      },
      onAdminRemoved: (payload) => {
        logger.debug('onAdminRemoved raw payload:', JSON.parse(JSON.stringify(payload)))
        const userId = payload.administrator?.userId
        if (userId != null && userId !== '') {
          updateGroupMemberRole(payload.groupId, userId, GROUP_MEMBER_ROLE.MEMBER)
        }
      },
      onAllMemberMuteStateChanged: (payload) => {
        logger.debug('onAllMemberMuteStateChanged raw payload:', JSON.parse(JSON.stringify(payload)))
        updateGroup(payload.groupId, { mute: payload.isMuted })
      }
    })
  }

  // 读内存快照整量回写（幂等）；群同步由 SDK 后台做，这里只读本地
  async getJoinedGroups(): Promise<EmGroup[]> {
    await this.readyGroupManager()
    groupStore.syncing = true
    try {
      this.refresh()
    } finally {
      groupStore.syncing = false
    }
    return groupStore.items
  }

  // 单群详情：飞行中去重，写 items + infoByGroupId
  async getGroupInfo(groupId: string): Promise<EmGroup> {
    const existing = this.infoPromiseByGroupId[groupId]
    if (existing != null) {
      return existing
    }
    const promise = (async () => {
      const mgr = await this.readyGroupManager()
      const detail = await mgr.getGroupInfo({ groupId })
      const group = this.toEmGroup(detail)
      upsertGroup(group)
      return group
    })()
    this.infoPromiseByGroupId[groupId] = promise
    try {
      return await promise
    } finally {
      delete this.infoPromiseByGroupId[groupId]
    }
  }

  // 成员游标分页：首页整量回写 + 补拉 admin 合并角色（成员接口不回 admin 角色）；后续页 append
  async getGroupMemberList(groupId: string, cursor?: string, pageSize = GROUP_MEMBER_PAGE_SIZE): Promise<{ items: EmGroupMember[], cursor: string, hasMore: boolean }> {
    const mgr = await this.readyGroupManager()
    const page = await mgr.getGroupMemberList({ groupId, cursor, pageSize })
    const members = page.items.map((e) => this.toEmGroupMember(e))
    if (cursor == null || cursor === '') {
      setGroupMembers(groupId, members)
      // 首屏后补拉管理员合并角色；失败不阻塞成员列表展示
      this.syncGroupAdmins(groupId).catch(() => {})
    } else {
      appendGroupMembers(groupId, members)
    }
    groupStore.memberCursorByGroupId[groupId] = page.cursor ?? ''
    groupStore.memberHasMoreByGroupId[groupId] = page.hasMore ?? false
    ensureUserInfos(members.map((m) => m.userId))
    return { items: members, cursor: page.cursor ?? '', hasMore: page.hasMore ?? false }
  }

  // 群公告：飞行中去重；undefined=未拉取、空串=已拉无公告
  async getGroupAnnouncement(groupId: string): Promise<string> {
    const cached = groupStore.announcementByGroupId[groupId]
    if (cached !== undefined) {
      return cached
    }
    const existing = this.announcementPromiseByGroupId[groupId]
    if (existing != null) {
      return existing
    }
    const promise = (async () => {
      const mgr = await this.readyGroupManager()
      const result = await mgr.getGroupAnnouncement({ groupId })
      const announcement = result.announcement ?? ''
      setGroupAnnouncement(groupId, announcement)
      return announcement
    })()
    this.announcementPromiseByGroupId[groupId] = promise
    try {
      return await promise
    } finally {
      delete this.announcementPromiseByGroupId[groupId]
    }
  }

  // 创建群：创建者即群主，立即写本地缓存（权限判定不依赖后续同步）；
  // 随后 best-effort 拉权威详情校准（对齐 vue group-domain.createGroup）
  async createGroup(params: CreateGroupParams): Promise<string> {
    const mgr = await this.readyGroupManager()
    const result = await mgr.createGroup({
      name: params.name,
      description: params.description ?? '',
      memberIds: params.members,
      public: params.public ?? false,
      joinApprovalRequired: params.approval ?? false,
      allowInvites: params.allowInvites ?? false,
      inviteNeedConfirm: params.inviteNeedConfirm ?? false,
      maxMembers: params.maxMembers
    })
    upsertGroup({
      groupId: result.groupId,
      name: params.name,
      description: params.description ?? '',
      owner: connectionStore.userId,
      memberCount: (params.members?.length ?? 0) + 1,
      maxUsers: params.maxMembers ?? 0,
      public: params.public ?? false,
      approval: params.approval ?? false,
      allowInvites: params.allowInvites ?? false,
      inviteNeedConfirm: params.inviteNeedConfirm ?? false,
      mute: false,
      disabled: false
    }, true)
    this.getGroupInfo(result.groupId).catch(() => {})
    return result.groupId
  }

  async inviteUsersToGroup(groupId: string, userIds: string[]): Promise<void> {
    const mgr = await this.readyGroupManager()
    await mgr.inviteUsersToGroup({ groupId, userIds })
  }

  // 接受群邀请（group kind 申请链路）：SDK acceptInvitation → 置 accepted + 刷新群快照（新群入列表）
  async acceptGroupInvite(invite: EmContactInvite): Promise<void> {
    if (invite.groupId == null || invite.groupId === '') {
      throw new Error('group invite missing groupId')
    }
    const mgr = await this.readyGroupManager()
    await mgr.acceptInvitation({ groupId: invite.groupId })
    updateInviteStatus(invite.id, CONTACT_INVITE_STATUS.ACCEPTED)
    await this.getJoinedGroups()
  }

  // 拒绝群邀请：SDK rejectInvitation → 置 declined
  async declineGroupInvite(invite: EmContactInvite): Promise<void> {
    if (invite.groupId == null || invite.groupId === '') {
      throw new Error('group invite missing groupId')
    }
    const mgr = await this.readyGroupManager()
    await mgr.rejectInvitation({ groupId: invite.groupId })
    updateInviteStatus(invite.id, CONTACT_INVITE_STATUS.DECLINED)
  }

  async leaveGroup(groupId: string): Promise<void> {
    const mgr = await this.readyGroupManager()
    await mgr.leaveGroup({ groupId })
    removeGroup(groupId)
  }

  async destroyGroup(groupId: string): Promise<void> {
    const mgr = await this.readyGroupManager()
    await mgr.destroyGroup({ groupId })
    removeGroup(groupId)
  }

  async changeGroupOwner(groupId: string, userId: string): Promise<void> {
    const mgr = await this.readyGroupManager()
    await mgr.changeGroupOwner({ groupId, newOwner: userId })
    const prevOwner = groupStore.infoByGroupId[groupId]?.owner ?? ''
    updateGroup(groupId, { owner: userId })
    updateGroupMemberRole(groupId, userId, GROUP_MEMBER_ROLE.OWNER)
    if (prevOwner !== '' && prevOwner !== userId) {
      updateGroupMemberRole(groupId, prevOwner, GROUP_MEMBER_ROLE.MEMBER)
    }
  }

  async updateGroupInfo(groupId: string, partial: { name?: string, description?: string, avatar?: string }): Promise<void> {
    const mgr = await this.readyGroupManager()
    await mgr.getGroup(groupId).updateInfo({
      name: partial.name,
      description: partial.description,
      avatar: partial.avatar
    })
    updateGroup(groupId, {
      name: partial.name,
      description: partial.description,
      avatar: partial.avatar
    })
  }

  async updateGroupAnnouncement(groupId: string, content: string): Promise<void> {
    const mgr = await this.readyGroupManager()
    await mgr.updateGroupAnnouncement({ groupId, announcement: content })
    setGroupAnnouncement(groupId, content)
  }

  async removeGroupMembers(groupId: string, userIds: string[]): Promise<void> {
    const mgr = await this.readyGroupManager()
    await mgr.removeGroupMembers({ groupId, userIds })
    removeGroupMembersLocal(groupId, userIds)
  }

  async addGroupAdmin(groupId: string, userId: string): Promise<void> {
    const mgr = await this.readyGroupManager()
    await mgr.addGroupAdmin({ groupId, userId })
    updateGroupMemberRole(groupId, userId, GROUP_MEMBER_ROLE.ADMIN)
  }

  async removeGroupAdmin(groupId: string, userId: string): Promise<void> {
    const mgr = await this.readyGroupManager()
    await mgr.removeGroupAdmin({ groupId, userId })
    updateGroupMemberRole(groupId, userId, GROUP_MEMBER_ROLE.MEMBER)
  }

  async muteAllGroupMembers(groupId: string): Promise<void> {
    const mgr = await this.readyGroupManager()
    await mgr.getGroup(groupId).muteAllMembers()
    updateGroup(groupId, { mute: true })
  }

  async unmuteAllGroupMembers(groupId: string): Promise<void> {
    const mgr = await this.readyGroupManager()
    await mgr.getGroup(groupId).unmuteAllMembers()
    updateGroup(groupId, { mute: false })
  }

  reset(): void {
    clearGroups()
  }

  // 拉取并合并群管理员到成员缓存；已同步过的群不重复拉（增删管理员事件做增量角色修正）
  private async syncGroupAdmins(groupId: string): Promise<void> {
    if (groupStore.adminSyncedByGroupId[groupId]) {
      return
    }
    const existing = this.adminPromiseByGroupId[groupId]
    if (existing != null) {
      return existing
    }
    const promise = (async () => {
      const mgr = await this.readyGroupManager()
      const admins = await mgr.getGroup(groupId).getAdmins()
      const adminMembers = (admins ?? []).map((u) => this.toGroupMemberFromUser(u, GROUP_MEMBER_ROLE.ADMIN))
      appendGroupMembers(groupId, adminMembers)
      adminMembers.forEach((a) => updateGroupMemberRole(groupId, a.userId, GROUP_MEMBER_ROLE.ADMIN))
      groupStore.adminSyncedByGroupId[groupId] = true
    })()
    this.adminPromiseByGroupId[groupId] = promise
    try {
      return await promise
    } finally {
      delete this.adminPromiseByGroupId[groupId]
    }
  }

  private refresh(): void {
    const mgr = this.manager()
    if (mgr == null) {
      return
    }
    const raw = mgr.getJoinedGroupList()
    logger.debug('getJoinedGroupList raw snapshot:', JSON.parse(JSON.stringify(raw)))
    logger.info('joined group snapshot refreshed, count:', raw.length)
    setJoinedGroups(raw.map((g) => this.toEmGroup(g)))
  }

  // 群事件系统通知（M2.9 Phase 5b）：本地插入群消息列表灰条（不落服务端），
  // 消费点对齐 vue group-events 语义裁剪——成员进出/群名变更/公告变更/转让群主有文案；
  // 管理员变更/全员禁言/被移出/解散不插（被移出与解散随即清会话清消息，插入即被擦除）。
  private insertGroupNotice(groupId: string, eventKey: GroupNoticeEventValue, opts?: { members?: readonly NoticeUser[], name?: string }): void {
    const { t } = useLocale()
    let text = ''
    if (eventKey === GROUP_NOTICE_EVENT.MEMBERS_JOINED) {
      text = this.memberNoticeText(opts?.members ?? [], 'group.notice.memberJoined', 'group.notice.memberJoinedMultiple')
    } else if (eventKey === GROUP_NOTICE_EVENT.MEMBERS_EXITED) {
      text = this.memberNoticeText(opts?.members ?? [], 'group.notice.memberExited', 'group.notice.memberExitedMultiple')
    } else if (eventKey === GROUP_NOTICE_EVENT.GROUP_NAME_CHANGED) {
      text = t('group.notice.groupNameChanged', { name: opts?.name ?? '' })
    } else if (eventKey === GROUP_NOTICE_EVENT.ANNOUNCEMENT_CHANGED) {
      text = t('group.notice.announcementChanged')
    } else if (eventKey === GROUP_NOTICE_EVENT.OWNER_CHANGED) {
      text = t('group.notice.ownerChanged', { name: opts?.name ?? '' })
    }
    if (text === '') {
      return
    }
    this.hooks?.insertGroupNotice?.(groupId, text)
  }

  // 成员变动通知文案：单成员直接展示，多成员取首位非当前用户并带总数（对齐 vue formatMemberNotice）
  private memberNoticeText(members: readonly NoticeUser[], singleKey: string, multipleKey: string): string {
    if (members.length === 0) {
      return ''
    }
    const { t } = useLocale()
    if (members.length === 1) {
      return t(singleKey, { name: this.noticeNameOf(members[0]) })
    }
    const nonSelf = members.find((m) => m.userId !== connectionStore.userId) ?? members[0]
    return t(multipleKey, { name: this.noticeNameOf(nonSelf), count: members.length })
  }

  // 通知展示名：自己显示「你」，其余昵称 > userStore 展示名（userId 兜底）
  private noticeNameOf(user: NoticeUser | undefined): string {
    if (user == null || user.userId === '') {
      return ''
    }
    if (user.userId === connectionStore.userId) {
      return useLocale().t('group.notice.you')
    }
    const nick = typeof user.nickname === 'string' ? user.nickname : ''
    return nick !== '' ? nick : displayNameOf(user.userId)
  }

  // SDK wire 边界：JoinedGroupSummary（ownerId）与 GroupDetail（owner.userId）双形态归一；
  // maxMembers→maxUsers、joinApprovalRequired→approval、muteAllMembers→mute
  private toEmGroup(raw: JoinedGroupSummary | GroupDetail): EmGroup {
    const summary = raw as GroupSummary
    const detail = raw as GroupDetail
    const joined = raw as JoinedGroupSummary
    const owner = detail.owner?.userId ?? joined.ownerId ?? ''
    return {
      groupId: summary.groupId,
      name: summary.name !== '' ? summary.name : summary.groupId,
      description: summary.description ?? '',
      owner,
      memberCount: summary.memberCount ?? 0,
      maxUsers: summary.maxMembers ?? 0,
      avatar: (detail.avatarUrl ?? joined.avatarUrl) !== undefined ? (detail.avatarUrl ?? joined.avatarUrl) : undefined,
      public: summary.public ?? false,
      approval: summary.joinApprovalRequired ?? false,
      allowInvites: summary.allowInvites ?? false,
      inviteNeedConfirm: detail.inviteNeedConfirm ?? false,
      mute: detail.muteAllMembers ?? joined.muteAllMembers ?? false,
      disabled: summary.disabled ?? false
    }
  }

  private toEmGroupMember(entry: GroupMemberEntry): EmGroupMember {
    const role = entry.role === 'owner' || entry.role === 'admin' ? entry.role : GROUP_MEMBER_ROLE.MEMBER
    return {
      ...this.toGroupMemberFromUser(entry.user, role),
      joinedAt: entry.joinedAt ?? 0
    }
  }

  private toGroupMemberFromUser(user: GroupUserInfo, role: EmGroupMember['role']): EmGroupMember {
    const raw = user as unknown as Record<string, unknown>
    const avatar = typeof raw['avatarUrl'] === 'string' ? raw['avatarUrl'] as string : (typeof raw['avatarurl'] === 'string' ? raw['avatarurl'] as string : undefined)
    return {
      userId: user.userId,
      role,
      joinedAt: 0,
      nick: typeof user.nickname === 'string' && user.nickname !== '' ? user.nickname : undefined,
      avatar
    }
  }

  // 群邀请群名快照：事件载荷 groupName 优先，缺省读 store 详情缓存（均无则空串，展示走回落链）
  private groupNameOf(groupId: string, payloadName?: string): string {
    if (typeof payloadName === 'string' && payloadName !== '') {
      return payloadName
    }
    return groupStore.infoByGroupId[groupId]?.name ?? ''
  }

  // 邀请人/被邀请人资料并入 userStore（邀请条目展示名复用 displayNameOf 回落链）
  private mergeInviterProfile(u: UserInfo | undefined): void {
    if (u == null || u.userId === '') {
      return
    }
    const raw = u as unknown as Record<string, unknown>
    mergeUserInfo({
      userId: u.userId,
      nickname: typeof u.nickname === 'string' ? u.nickname : '',
      avatarUrl: typeof raw['avatarUrl'] === 'string' ? raw['avatarUrl'] as string : (typeof raw['avatarurl'] === 'string' ? raw['avatarurl'] as string : '')
    })
  }

  private manager(): GroupManager | null {
    const c = this.client as unknown as { groupManager?: GroupManager } | null
    return c?.groupManager ?? null
  }

  private async readyGroupManager(): Promise<GroupManager> {
    if (this.client == null) {
      throw new Error('call EmKit.init() first')
    }
    if (this.waitOnline != null) {
      await this.waitOnline()
    }
    const mgr = this.manager()
    if (mgr == null) {
      throw new Error('GroupManager not registered')
    }
    return mgr
  }
}
