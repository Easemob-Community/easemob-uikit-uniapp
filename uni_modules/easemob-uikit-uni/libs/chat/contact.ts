import type {
  ChatClient,
  Contact,
  ContactManager,
  ContactRosterEventPayload,
  UserInfo
} from 'easemob-websdk'
import { CONTACT_INVITE_STATUS } from '../constants'
import {
  addInvite,
  clearContacts,
  contactStore,
  removeInviteByFrom,
  updateInviteStatus
} from '../store/contact'
import { mergeUserInfo } from '../store/user'
import { createLogger } from '../utils/logger'
import type { EmContactInvite } from '../types'

const logger = createLogger('contact')

// 好友关系与申请（5.x ContactManager 封装）：
// 登录后好友同步由 SDK 后台自动进行，getContacts() 读内存快照；
// UI 刷新全部由 roster 事件驱动 + 写操作后主动 refresh
export class EmContact {
  private client: ChatClient | null = null
  private waitOnline: (() => Promise<void>) | null = null

  bind(client: ChatClient, waitOnline: () => Promise<void>): void {
    if (this.client != null) {
      return
    }
    this.client = client
    this.waitOnline = waitOnline
    // 好友自动同步由 SDK 后台异步完成，getContacts() 首次可能读到空快照
    // （实测坑：小程序端缓存加载慢于 H5 localStorage，登录后即读必空）——
    // 必须挂 ChatClient 级统一同步事件，contact 同步完成后重读快照自愈
    client.addEventHandler('emkit-contact-sync', {
      onSyncDataFinished: (payload) => {
        logger.debug('onSyncDataFinished raw payload:', JSON.parse(JSON.stringify(payload)))
        // 对齐 vue 版 D124：失败轮次不能用不完整内存回填；contact 无主动重同步接口，
        // 只能告警 + 等下次连接/登录自动同步
        if (payload.status === 'failed') {
          logger.warn('contact sync failed:', payload.error?.stage, payload.error?.message)
          return
        }
        if (payload.dataType === 'contact') {
          logger.info('contact sync finished, refreshing snapshot')
          this.refresh()
        }
      }
    })
    const mgr = this.manager()
    if (mgr == null) {
      return
    }
    mgr.addEventHandler('emkit-contact', {
      // 收到好友申请（被邀请方）：落一条 pending 申请
      onContactInvited: (p: ContactRosterEventPayload) => {
        logger.debug('onContactInvited raw payload:', JSON.parse(JSON.stringify(p)))
        addInvite({
          id: `${p.from}:${Date.now()}`,
          from: p.from,
          message: typeof p.message === 'string' ? p.message : '',
          status: CONTACT_INVITE_STATUS.PENDING,
          outgoing: false,
          ts: Date.now()
        })
        this.mergeProfile(p.from, p.userInfo)
      },
      // 好友关系建立（双方收）：刷新快照；已是好友的申请不再保留 pending
      onContactAdded: (p: ContactRosterEventPayload) => {
        logger.debug('onContactAdded raw payload:', JSON.parse(JSON.stringify(p)))
        this.refresh()
        this.mergeProfile(p.from, p.userInfo)
      },
      // 被对方删除：刷新快照并清掉与其相关的申请记录
      onContactDeleted: (p: ContactRosterEventPayload) => {
        logger.debug('onContactDeleted raw payload:', JSON.parse(JSON.stringify(p)))
        this.refresh()
        removeInviteByFrom(p.from)
      },
      // 我方申请被接受（发起方收）：刷新快照；若本地有其 pending 申请则置 accepted
      onContactAgreed: (p: ContactRosterEventPayload) => {
        logger.debug('onContactAgreed raw payload:', JSON.parse(JSON.stringify(p)))
        this.refresh()
        const pending = contactStore.invites.find((i) => i.from === p.from && i.status === CONTACT_INVITE_STATUS.PENDING)
        if (pending != null) {
          updateInviteStatus(pending.id, CONTACT_INVITE_STATUS.ACCEPTED)
        }
      },
      // 我方申请被拒绝（发起方收）：落一条 outgoing 已拒绝通知
      onContactRefuse: (p: ContactRosterEventPayload) => {
        logger.debug('onContactRefuse raw payload:', JSON.parse(JSON.stringify(p)))
        addInvite({
          id: `${p.from}:${Date.now()}`,
          from: p.from,
          message: typeof p.message === 'string' ? p.message : '',
          status: CONTACT_INVITE_STATUS.DECLINED,
          outgoing: true,
          ts: Date.now()
        })
      },
      // 好友资料/备注变更（含跨端备注同步）：刷新快照 + 用户资料缓存
      onContactInfoUpdated: (payload) => {
        logger.debug('onContactInfoUpdated raw payload:', JSON.parse(JSON.stringify(payload)))
        this.mergeProfile(payload.userInfo.userId, payload.userInfo)
        this.refresh()
      }
    })
  }

  // 拉取好友快照到 store（幂等）；同步由 SDK 后台做，这里只读内存快照
  async syncContacts(): Promise<void> {
    await this.readyContactManager()
    contactStore.syncing = true
    try {
      this.refresh()
    } finally {
      contactStore.syncing = false
    }
  }

  async addContact(userId: string, message = ''): Promise<void> {
    const mgr = await this.readyContactManager()
    await mgr.addContact({ userId, message })
  }

  async deleteContact(userId: string): Promise<void> {
    const mgr = await this.readyContactManager()
    await mgr.deleteContact({ userId })
    this.refresh()
  }

  async setContactRemark(userId: string, remark: string): Promise<void> {
    const mgr = await this.readyContactManager()
    await mgr.setContactRemark({ userId, remark })
    this.refresh()
  }

  async acceptContactInvite(invite: EmContactInvite): Promise<void> {
    const mgr = await this.readyContactManager()
    await mgr.acceptContactInvite({ userId: invite.from })
    updateInviteStatus(invite.id, CONTACT_INVITE_STATUS.ACCEPTED)
    this.refresh()
  }

  async declineContactInvite(invite: EmContactInvite): Promise<void> {
    const mgr = await this.readyContactManager()
    await mgr.declineContactInvite({ userId: invite.from })
    updateInviteStatus(invite.id, CONTACT_INVITE_STATUS.DECLINED)
  }

  reset(): void {
    clearContacts()
  }

  // 读内存快照整量回写（回写落 reactive 代理：整表替换即可）
  private refresh(): void {
    const mgr = this.manager()
    if (mgr == null) {
      return
    }
    const raw = mgr.getContacts()
    logger.debug('getContacts raw snapshot:', JSON.parse(JSON.stringify(raw)))
    logger.info('contact snapshot refreshed, count:', raw.length)
    const items = raw.map((c) => this.toContactItem(c))
    contactStore.items = items
    contactStore.loaded = true
  }

  // SDK wire 边界：Contact.userInfo 的 nickname/avatarUrl 归一（兼容 4.x 小写 avatarurl 遗风），
  // 同时并入 userStore 复用现有资料缓存体系
  private toContactItem(c: Contact) {
    const userId = c.userId
    const remark = typeof c.remark === 'string' ? c.remark : ''
    const info = this.normalizeUserInfo(userId, c.userInfo)
    mergeUserInfo(info)
    return {
      userId,
      remark,
      nickname: info.nickname,
      avatarUrl: info.avatarUrl,
      addTs: typeof c.addTs === 'number' ? c.addTs : 0
    }
  }

  private normalizeUserInfo(userId: string, u: UserInfo | undefined) {
    const raw = u as unknown as Record<string, unknown> | undefined
    const nickname = raw != null && typeof raw['nickname'] === 'string' ? raw['nickname'] as string : ''
    let avatarUrl = ''
    if (raw != null) {
      if (typeof raw['avatarUrl'] === 'string') {
        avatarUrl = raw['avatarUrl'] as string
      } else if (typeof raw['avatarurl'] === 'string') {
        avatarUrl = raw['avatarurl'] as string
      }
    }
    return { userId, nickname, avatarUrl }
  }

  private mergeProfile(userId: string, u: UserInfo | undefined): void {
    if (userId === '') return
    mergeUserInfo(this.normalizeUserInfo(userId, u))
  }

  private manager(): ContactManager | null {
    const c = this.client as unknown as { contactManager?: ContactManager } | null
    return c?.contactManager ?? null
  }

  private async readyContactManager(): Promise<ContactManager> {
    if (this.client == null) {
      throw new Error('call EmKit.init() first')
    }
    if (this.waitOnline != null) {
      await this.waitOnline()
    }
    const mgr = this.manager()
    if (mgr == null) {
      throw new Error('ContactManager not registered')
    }
    return mgr
  }
}
