// 会话域：会话列表同步、进入/离开会话、置顶、免打扰、删除会话、清空聊天记录，
// 以及 ConversationItem / 摘要的 wire → 中立类型映射（SDK wire 兼容字面量集中在本文件边界）。
// 门面（./index.ts）负责组合本域与消息域并接线 SDK 事件。
import type { ConversationItem, PushManager, SessionMessageSnippet } from 'easemob-websdk'
import { CONVERSATION_TYPE } from '../constants'
import { connectionStore } from '../store/connection'
import { conversationStore } from '../store/conversation'
import { messageStore } from '../store/message'
import { createLogger } from '../utils/logger'
import type { EmConversationItem } from '../types'
import { useLocale } from '../use/useLocale'
import { ensureUserInfos } from './user-info'
import type { EmChatContext } from './message'
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
      conversationStore.items = items
        .filter((c) => c.conversationType === CONVERSATION_TYPE.SINGLE_CHAT)
        .map((c) => this.toConversationItem(c))
      ensureUserInfos(conversationStore.items.map((c) => c.conversationId))
    } finally {
      conversationStore.syncing = false
    }
  }

  async enterConversation(conversationId: string): Promise<void> {
    const chatManager = await this.messages.readyChatManager()
    this.currentConversationId = conversationId
    chatManager.setCurrentConversation({ conversationId, conversationType: CONVERSATION_TYPE.SINGLE_CHAT })
    chatManager.clearConversationUnreadMessageCount({ conversationId, conversationType: CONVERSATION_TYPE.SINGLE_CHAT }).catch(() => {})
    // 进入会话即回已读回执（对齐 vue 版会话切换 sendChannelAck 的时机）
    this.messages.sendReadReceipts(conversationId).catch(() => {})
    // 确保对端与己方资料已缓存（气泡头像/昵称、导航标题用）
    ensureUserInfos([conversationId, connectionStore.userId])
  }

  leaveConversation(): void {
    this.currentConversationId = ''
    this.ctx.client?.chatManager.resetCurrentConversation()
  }

  async pinConversation(conversationId: string, pinned: boolean): Promise<void> {
    const chatManager = await this.messages.readyChatManager()
    await chatManager.setConversationPinned({ conversationId, conversationType: CONVERSATION_TYPE.SINGLE_CHAT, pinned })
    const item = findConversation(conversationId)
    if (item != null) {
      item.isPinned = pinned
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const chatManager = await this.messages.readyChatManager()
    await chatManager.deleteConversation({ conversationId, conversationType: CONVERSATION_TYPE.SINGLE_CHAT })
    conversationStore.items = conversationStore.items.filter((c) => c.conversationId !== conversationId)
    delete messageStore.messagesByConversationId[conversationId]
    delete messageStore.cursorByConversationId[conversationId]
    delete messageStore.hasMoreByConversationId[conversationId]
  }

  // 清空聊天记录（聊天详情页）：漫游走 removeHistoryMessages 时间戳截断，本地清缓存并复位游标；
  // 会话列表该项摘要/时间清零（会话本身保留）
  async clearConversationMessages(conversationId: string): Promise<void> {
    const chatManager = await this.messages.readyChatManager()
    await chatManager.removeHistoryMessages({
      conversationId,
      conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
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
  async setConversationMuted(conversationId: string, muted: boolean): Promise<void> {
    await this.messages.readyChatManager()
    const client = this.ctx.client as unknown as { pushManager?: PushManager } | null
    const push = client?.pushManager
    if (push == null) {
      throw new Error('PushManager not registered')
    }
    if (muted) {
      await push.setConversationSilentMode({
        conversationId,
        conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
        rule: { mode: 'REMIND_TYPE', remindType: 'NONE' }
      })
    } else {
      await push.clearConversationRemindType({ conversationId, conversationType: CONVERSATION_TYPE.SINGLE_CHAT })
    }
    const item = findConversation(conversationId)
    if (item != null) {
      item.isMuted = muted
    }
  }

  // 事件快照可能先于用户资料同步到达（conversationName 为空或等于 id），
  // 名称/头像在缺失时沿用前一次有效值，避免列表闪烁回 userId
  toConversationItem(c: ConversationItem): EmConversationItem {
    const prev = findConversation(c.conversationId)
    const validName = c.conversationName !== '' && c.conversationName !== c.conversationId
    return {
      conversationId: c.conversationId,
      name: validName ? c.conversationName : (prev != null ? prev.name : c.conversationId),
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
