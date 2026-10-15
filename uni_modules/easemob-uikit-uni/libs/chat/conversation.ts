// 会话域：会话列表同步、进入/离开会话、置顶、免打扰、删除会话、清空聊天记录，
// 以及 ConversationItem / 摘要的 wire → 中立类型映射（SDK wire 兼容字面量集中在本文件边界）。
// 门面（./index.ts）负责组合本域与消息域并接线 SDK 事件。
import type { ConversationItem, PushManager, SessionMessageSnippet } from 'easemob-websdk'
import { CONVERSATION_TYPE } from '../constants'
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

  constructor(private ctx: EmChatContext, private messages: EmMessageDomain) {}

  async syncConversations(): Promise<void> {
    const chatManager = await this.messages.readyChatManager()
    conversationStore.syncing = true
    try {
      let items: ReadonlyArray<ConversationItem> = []
      try {
        items = await chatManager.refreshSessionList()
        logger.debug('syncConversations via refreshSessionList raw items:', JSON.parse(JSON.stringify(items)))
      } catch (e) {
        items = chatManager.getConversationList()
        logger.debug('syncConversations via getConversationList raw items:', JSON.parse(JSON.stringify(items)))
      }
      logger.info('syncConversations done, count:', items.length)
      // 群聊会话不再过滤：chatType 由 wire conversationType 映射填充；
      // 用户资料补拉仅针对单聊会话（群会话名/头像由群数据层供给）
      conversationStore.items = items.map((c) => this.toConversationItem(c))
      ensureUserInfos(conversationStore.items.filter((c) => c.chatType === CONVERSATION_TYPE.SINGLE_CHAT).map((c) => c.conversationId))
    } finally {
      conversationStore.syncing = false
    }
  }

  async enterConversation(conversationId: string, chatType: ConversationTypeValue): Promise<void> {
    const chatManager = await this.messages.readyChatManager()
    this.currentConversationId = conversationId
    chatManager.setCurrentConversation({ conversationId, conversationType: chatType })
    chatManager.clearConversationUnreadMessageCount({ conversationId, conversationType: chatType }).catch(() => {})
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
    this.currentConversationId = ''
    this.ctx.client?.chatManager.resetCurrentConversation()
  }

  async pinConversation(conversationId: string, chatType: ConversationTypeValue, pinned: boolean): Promise<void> {
    const chatManager = await this.messages.readyChatManager()
    await chatManager.setConversationPinned({ conversationId, conversationType: chatType, pinned })
    const item = findConversation(conversationId)
    if (item != null) {
      item.isPinned = pinned
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
  async setConversationMuted(conversationId: string, chatType: ConversationTypeValue, muted: boolean): Promise<void> {
    await this.messages.readyChatManager()
    const client = this.ctx.client as unknown as { pushManager?: PushManager } | null
    const push = client?.pushManager
    if (push == null) {
      throw new Error('PushManager not registered')
    }
    if (muted) {
      await push.setConversationSilentMode({
        conversationId,
        conversationType: chatType,
        rule: { mode: 'REMIND_TYPE', remindType: 'NONE' }
      })
    } else {
      await push.clearConversationRemindType({ conversationId, conversationType: chatType })
    }
    const item = findConversation(conversationId)
    if (item != null) {
      item.isMuted = muted
    }
  }

  // 事件快照可能先于用户资料同步到达（conversationName 为空或等于 id），
  // 名称/头像在缺失时沿用前一次有效值，避免列表闪烁回 userId；
  // 群会话名称缺失时回落群数据层缓存（groupDisplayNameOf 自身再回落 groupId）
  toConversationItem(c: ConversationItem): EmConversationItem {
    const prev = findConversation(c.conversationId)
    const chatType = mapWireChatType(c.conversationType as string)
    const validName = c.conversationName !== '' && c.conversationName !== c.conversationId
    const fallbackName = chatType === CONVERSATION_TYPE.GROUP_CHAT ? groupDisplayNameOf(c.conversationId) : c.conversationId
    return {
      conversationId: c.conversationId,
      chatType,
      name: validName ? c.conversationName : (prev != null ? prev.name : fallbackName),
      avatar: (c.conversationAvatar ?? '') !== '' ? (c.conversationAvatar ?? '') : (prev != null ? prev.avatar : ''),
      unreadCount: c.unreadCount,
      lastMessageText: this.summaryOf(c.lastMessage),
      lastMessageTime: c.lastMessage?.timestamp ?? c.lastMessageAt ?? 0,
      isPinned: c.isPinned ?? false,
      isMuted: c.remindType === 'NONE'
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
