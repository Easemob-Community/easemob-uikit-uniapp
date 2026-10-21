// 会话域：会话列表同步、进入/离开会话、置顶、免打扰、删除会话、清空聊天记录，
// 以及 ConversationItem / 摘要的 wire → 中立类型映射（SDK wire 兼容字面量集中在本文件边界）。
// 门面（./index.ts）负责组合本域与消息域并接线 SDK 事件。
import type { ConversationItem, PushManager, SessionMessageSnippet } from 'easemob-websdk'
import { CONVERSATION_SILENT_MODE_BATCH_SIZE, CONVERSATION_TYPE, CONVERSATION_UNREAD_CLEAR_THROTTLE } from '../constants'
import type { ConversationTypeValue } from '../constants'
import { connectionStore } from '../store/connection'
import { conversationStore } from '../store/conversation'
import { messageStore } from '../store/message'
import { groupDisplayNameOf, groupStore } from '../store/group'
import { avatarOf } from '../store/user'
import { contactDisplayNameOf } from '../store/contact'
import { createLogger } from '../utils/logger'
import type { EmConversationItem } from '../types'
import { useLocale } from '../use/useLocale'
import { ensureUserInfos } from './user-info'
import type { EmChatContext } from './message'
import { mapWireChatType } from './message'
import type { EmMessageDomain } from './message'

const logger = createLogger('chat')

/** 会话列表查找共享 helper（乐观更新回写/摘要清零/快照对齐的公共入口） */
export function findConversation(conversationId: string): EmConversationItem | undefined {
  return conversationStore.items.find((c) => c.conversationId === conversationId)
}

export class EmConversationDomain {
  currentConversationId = ''
  // 当前会话收消息清服务端未读的最近一次时间（按会话合批，见 clearUnread）
  private lastUnreadClearAtByConversationId: Record<string, number> = {}

  constructor(private ctx: EmChatContext, private messages: EmMessageDomain) {}

  async syncConversations(): Promise<void> {
    const chatManager = await this.messages.readyChatManager()
    conversationStore.syncing = true
    try {
      let items: ReadonlyArray<ConversationItem> = []
      try {
        items = await chatManager.refreshSessionList()
        logger.debug('syncConversations via refreshSessionList, count:', items.length)
      } catch (e) {
        items = chatManager.getConversationList()
        logger.debug('syncConversations via getConversationList, count:', items.length)
      }
      logger.info('syncConversations done, count:', items.length)
      // 群聊会话不再过滤：chatType 由 wire conversationType 映射填充；
      // 用户资料补拉仅针对单聊会话（群会话名/头像由群数据层供给）
      conversationStore.items = items.map((c) => this.toConversationItem(c))
      ensureUserInfos(conversationStore.items.filter((c) => c.chatType === CONVERSATION_TYPE.SINGLE_CHAT).map((c) => c.conversationId))
      // 会话列表快照不携带免打扰状态（见 toConversationItem 注释）：快照回填后异步批量校正，
      // 不阻塞列表首屏；本地状态已在 toConversationItem 中保留，查询失败只影响跨端/冷启动校正
      this.syncConversationMuteStates()
    } finally {
      conversationStore.syncing = false
    }
  }

  async enterConversation(conversationId: string, chatType: ConversationTypeValue): Promise<void> {
    const chatManager = await this.messages.readyChatManager()
    this.currentConversationId = conversationId
    // 当前会话不参与后台内存裁剪（P1-10）；离开时再按上限裁
    this.messages.setActiveConversation(conversationId)
    chatManager.setCurrentConversation({ conversationId, conversationType: chatType })
    // 进会话立即清未读（本地 store + 服务端）；当前会话收消息的合批清理见 clearUnread
    this.clearUnread(conversationId, chatType, true)
    // 进入会话即回已读回执（对齐 vue 版会话切换 sendChannelAck 的时机；群聊内部短路）
    this.messages.sendReadReceipts(conversationId, chatType).catch(() => {})
    // 确保对端与己方资料已缓存（气泡头像/昵称、导航标题用）；群聊由群数据层供给资料
    if (chatType === CONVERSATION_TYPE.SINGLE_CHAT) {
      ensureUserInfos([conversationId, connectionStore.userId])
    }
    // 进入会话清除「有人@我」未读标记（对齐 vue 版会话选中清 atMe 的时机）
    if (conversationStore.atMeByConversationId[conversationId] === true) {
      delete conversationStore.atMeByConversationId[conversationId]
    }
  }

  leaveConversation(): void {
    const conversationId = this.currentConversationId
    this.currentConversationId = ''
    this.messages.setActiveConversation('')
    // 离开即裁剪：下次进入由 loadHistory 的 trimmed 标记重拉最新页（游标不会指向已丢弃的消息）
    if (conversationId !== '') this.messages.trimConversation(conversationId)
    this.ctx.client?.chatManager.resetCurrentConversation()
  }

  /**
   * 清会话未读（本地 store 立即归零 + 服务端异步清零）。
   * - 进会话/离开会话：force=true，立即发请求；
   * - 当前会话收消息：默认按 CONVERSATION_UNREAD_CLEAR_THROTTLE 合批，避免每条消息一次 REST；
   *   服务端不清的话，下次 refreshSessionList/冷启动会把刚读过的会话又显示成未读。
   */
  clearUnread(conversationId: string, chatType: ConversationTypeValue, force = false): void {
    const item = findConversation(conversationId)
    if (item != null && item.unreadCount !== 0) {
      item.unreadCount = 0
    }
    const client = this.ctx.client
    if (client == null) return
    const now = Date.now()
    const last = this.lastUnreadClearAtByConversationId[conversationId] ?? 0
    if (!force && now - last < CONVERSATION_UNREAD_CLEAR_THROTTLE) return
    this.lastUnreadClearAtByConversationId[conversationId] = now
    client.chatManager.clearConversationUnreadMessageCount({ conversationId, conversationType: chatType })
      .catch((e) => {
        logger.warn('clearConversationUnread fail:', conversationId, e)
      })
  }

  // 登出/换账号：只重置域内游标，SDK 状态由 client.logout 负责
  reset(): void {
    this.currentConversationId = ''
    this.lastUnreadClearAtByConversationId = {}
  }

  async pinConversation(conversationId: string, chatType: ConversationTypeValue, pinned: boolean): Promise<void> {
    const chatManager = await this.messages.readyChatManager()
    const result = await chatManager.setConversationPinned({ conversationId, conversationType: chatType, pinned })
    const item = findConversation(conversationId)
    if (item != null) {
      const isPinned = result.isPinned ?? pinned
      item.isPinned = isPinned
      // 置顶时间以服务端返回为准（排序主键）；缺失时本地补齐，保证置顶区间顺序稳定
      item.pinnedTime = isPinned ? (result.pinnedTime ?? Date.now()) : 0
    }
  }

  async deleteConversation(conversationId: string, chatType: ConversationTypeValue): Promise<void> {
    const chatManager = await this.messages.readyChatManager()
    await chatManager.deleteConversation({ conversationId, conversationType: chatType })
    this.removeConversationLocal(conversationId)
  }

  // 本地删除会话（不调 SDK）：被移出群/群解散等事件路径用；清消息缓存与游标，
  // 被删会话是当前会话时复位 currentConversationId（对齐 vue 版 deleteConversation 语义）
  removeConversationLocal(conversationId: string): void {
    this.messages.forgetStreams(conversationId)
    conversationStore.items = conversationStore.items.filter((c) => c.conversationId !== conversationId)
    delete conversationStore.atMeByConversationId[conversationId]
    delete messageStore.messagesByConversationId[conversationId]
    delete messageStore.cursorByConversationId[conversationId]
    delete messageStore.hasMoreByConversationId[conversationId]
    if (this.currentConversationId === conversationId) {
      this.currentConversationId = ''
    }
  }

  // 本地构造会话插列表（发起会话用，不调 SDK 建会话 API，对齐 vue 版 new-chat-modal 语义）；
  // 已存在则不动（名称/头像以 SDK 同步为准）
  addConversation(conversationId: string, chatType: ConversationTypeValue): void {
    if (findConversation(conversationId) != null) {
      return
    }
    const isGroup = chatType === CONVERSATION_TYPE.GROUP_CHAT
    conversationStore.items.unshift({
      conversationId,
      chatType,
      name: isGroup ? groupDisplayNameOf(conversationId) : contactDisplayNameOf(conversationId),
      avatar: isGroup ? (groupStore.infoByGroupId[conversationId]?.avatar ?? '') : avatarOf(conversationId),
      unreadCount: 0,
      lastMessageText: '',
      lastMessageTime: 0,
      isPinned: false,
      pinnedTime: 0,
      isMuted: false
    })
  }

  // 群资料变更事件同步会话名（群域 hooks 注入，仅本地回写）
  updateConversationName(conversationId: string, name: string): void {
    const item = findConversation(conversationId)
    if (item != null && name !== '') {
      item.name = name
    }
  }

  // 清空聊天记录（聊天详情页）：漫游走 removeHistoryMessages 时间戳截断，本地清缓存并复位游标；
  // 会话列表该项摘要/时间清零（会话本身保留）
  async clearConversationMessages(conversationId: string, chatType: ConversationTypeValue): Promise<void> {
    const chatManager = await this.messages.readyChatManager()
    await chatManager.removeHistoryMessages({
      conversationId,
      conversationType: chatType,
      beforeTimestamp: Date.now()
    })
    // 清空进行中的流式合批缓冲/索引，防计时器把已清空的消息写回
    this.messages.forgetStreams(conversationId)
    if (messageStore.messagesByConversationId[conversationId] != null) {
      messageStore.messagesByConversationId[conversationId] = []
    }
    delete messageStore.cursorByConversationId[conversationId]
    delete messageStore.hasMoreByConversationId[conversationId]
    const item = findConversation(conversationId)
    if (item != null) {
      item.lastMessageText = ''
      item.lastMessageTime = 0
    }
  }

  // 免打扰走 PushManager：设置 remindType NONE 为免打扰；
  // 恢复时 remindType 可设值不含 DEFAULT，须调 clearConversationRemindType 清除。
  // （'REMIND_TYPE'/'NONE' 为 SDK wire 枚举，按规范在边界处保留字面量）
  // 乐观回写本地（会话列表 icon 立即反馈），失败回滚后抛错由调用方 toast。
  async setConversationMuted(conversationId: string, chatType: ConversationTypeValue, muted: boolean): Promise<void> {
    await this.messages.readyChatManager()
    const client = this.ctx.client as unknown as { pushManager?: PushManager } | null
    const push = client?.pushManager
    if (push == null) {
      throw new Error('PushManager not registered')
    }
    const item = findConversation(conversationId)
    const prevMuted = item?.isMuted ?? false
    if (item != null) {
      item.isMuted = muted
    }
    try {
      if (muted) {
        await push.setConversationSilentMode({
          conversationId,
          conversationType: chatType,
          rule: { mode: 'REMIND_TYPE', remindType: 'NONE' }
        })
      } else {
        await push.clearConversationRemindType({ conversationId, conversationType: chatType })
      }
      // 成功后重写一次：防并发批量校正（syncConversationMuteStates）在本请求飞行期间拿到旧值回写
      if (item != null) {
        item.isMuted = muted
      }
    } catch (e) {
      if (item != null) {
        item.isMuted = prevMuted
      }
      throw e
    }
  }

  // 会话列表快照不携带免打扰状态（SDK 快照恒为 DEFAULT / 群 joined-group 同步可能带入），
  // 以 PushManager 批量查询作为权威来源：单次最多 20 条，分片查询后逐条回写 store。
  // DURATION 规则无 remindType，按 expireTimestamp 未过期判定免打扰中（对齐 vue 版）。
  // 失败只告警：本地状态已由 toConversationItem 保留，不因一次网络失败把 icon 抹掉。
  async syncConversationMuteStates(): Promise<void> {
    const client = this.ctx.client as unknown as { pushManager?: PushManager } | null
    const push = client?.pushManager
    if (push == null) return
    const targets = conversationStore.items.map((c) => ({
      conversationId: c.conversationId,
      conversationType: c.chatType
    }))
    for (let i = 0; i < targets.length; i += CONVERSATION_SILENT_MODE_BATCH_SIZE) {
      try {
        const result = await push.getConversationSilentModes({
          conversationList: targets.slice(i, i + CONVERSATION_SILENT_MODE_BATCH_SIZE)
        })
        result.conversations.forEach((r) => {
          const muted = r.rule.remindType === 'NONE'
            || (r.rule.expireTimestamp != null && r.rule.expireTimestamp > Date.now())
          const item = findConversation(r.conversationId)
          if (item != null && item.isMuted !== muted) {
            item.isMuted = muted
          }
        })
      } catch (e) {
        logger.warn('syncConversationMuteStates failed:', e)
      }
    }
  }

  // 多设备会话事件（CONVERSATION_MUTE_INFO_CHANGED）：其他端切免打扰后回写本端 store
  applyMuteInfoChanged(conversationId: string, remindType: string | undefined): void {
    if (remindType == null || remindType === '') return
    const item = findConversation(conversationId)
    if (item != null) {
      item.isMuted = remindType === 'NONE'
    }
  }

  // 事件快照可能先于用户资料同步到达（conversationName 为空或等于 id），
  // 名称/头像在缺失时沿用前一次有效值，避免列表闪烁回 userId；
  // 群会话名称缺失时回落群数据层缓存（groupDisplayNameOf 自身再回落 groupId）
  // 免打扰同理：会话列表协议不携带该字段（SDK 快照恒为 DEFAULT），不能按快照重置，
  // 否则每次会话列表更新/回页同步都会把本地已标记的免打扰 icon 抹掉；
  // 已有会话保留本地状态，新会话才用快照兜底，权威校正见 syncConversationMuteStates。
  toConversationItem(c: ConversationItem): EmConversationItem {
    const prev = findConversation(c.conversationId)
    const chatType = mapWireChatType(c.conversationType as string)
    const validName = c.conversationName !== '' && c.conversationName !== c.conversationId
    const fallbackName = chatType === CONVERSATION_TYPE.GROUP_CHAT ? groupDisplayNameOf(c.conversationId) : c.conversationId
    // 置顶状态/时间缺失时沿用前值：排序主键不能因快照缺字段而抖动
    const isPinned = c.isPinned ?? (prev != null ? prev.isPinned : false)
    return {
      conversationId: c.conversationId,
      chatType,
      name: validName ? c.conversationName : (prev != null ? prev.name : fallbackName),
      avatar: (c.conversationAvatar ?? '') !== '' ? (c.conversationAvatar ?? '') : (prev != null ? prev.avatar : ''),
      unreadCount: c.unreadCount,
      lastMessageText: this.summaryOf(c.lastMessage),
      lastMessageTime: c.lastMessage?.timestamp ?? c.lastMessageAt ?? 0,
      isPinned,
      pinnedTime: isPinned ? (c.pinnedTimestamp ?? (prev != null ? prev.pinnedTime : 0)) : 0,
      isMuted: prev != null ? prev.isMuted : c.remindType === 'NONE'
    }
  }

  private summaryOf(last: SessionMessageSnippet | null): string {
    if (last == null) return ''
    const { t } = useLocale()
    // 5.x type 为 'image'/'voice'，4.x 遗风为 'img'/'audio'，统一按字符串兼容两种
    const type = (last.type ?? '') as string
    switch (type) {
      case 'text':
        return `${(last.body as Record<string, unknown>)['content'] ?? ''}`
      case 'img':
      case 'image':
        return t('message.image')
      case 'audio':
      case 'voice':
        return t('message.audio')
      case 'video':
        return t('message.video')
      case 'file':
        return t('message.file')
      case 'custom':
        return t('message.custom')
      case 'cmd':
        // typing 等信令不作为会话摘要展示
        return ''
      default:
        // refreshSessionList 的 lastMessage 存在 type='unknown' 但 body.content 有值的
        // wire 形态（实测：文本消息摘要拿到 unknown），兜底嗅探 content 当文本展示
        {
          const content = (last.body as Record<string, unknown>)['content']
          if (typeof content === 'string' && content !== '') {
            return content
          }
        }
        return t('message.unsupported')
    }
  }
}
