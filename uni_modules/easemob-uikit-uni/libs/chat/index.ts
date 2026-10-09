import type {
  ChatClient,
  ConversationItem,
  ImageMessageBody,
  Message,
  SessionMessageSnippet,
  TextMessageBody
} from 'easemob-websdk'
import { connectionStore } from '../store/connection'
import { conversationStore } from '../store/conversation'
import { getMessages, messageStore } from '../store/message'
import type { EmConversationItem, EmMessageHandler, EmMessageItem } from '../types'
import { useLocale } from '../use/useLocale'

// 消息收发与会话同步：5.x ChatManager 封装
export class EmChat {
  private client: ChatClient | null = null
  private waitOnline: (() => Promise<void>) | null = null
  private handlers: EmMessageHandler[] = []

  bind(client: ChatClient, waitOnline: () => Promise<void>): void {
    if (this.client != null) {
      return
    }
    this.client = client
    this.waitOnline = waitOnline
    client.chatManager.addEventHandler('emkit-message', {
      onMessage: (message: Message) => {
        const item = this.toMessageItem(message)
        this.appendMessage(item)
        this.notify(item)
      },
      onConversationListUpdate: (payload) => {
        conversationStore.list = payload.items
          .filter((c) => c.conversationType === 'singleChat')
          .map((c) => this.toConversationItem(c))
      }    })
  }

  onMessage(handler: EmMessageHandler): void {
    this.handlers.push(handler)
  }

  /** @deprecated 兼容 M0 spike 页 */
  onTextMessage(handler: EmMessageHandler): void {
    this.onMessage(handler)
  }

  async sendText(to: string, text: string): Promise<void> {
    const chatManager = await this.readyChatManager()
    const message = chatManager.createTextMessage({
      conversationId: to,
      conversationType: 'singleChat',
      content: text
    })
    await this.deliver(message, to, text)
  }

  async sendImage(to: string, filePath: string): Promise<void> {
    const chatManager = await this.readyChatManager()
    const message = chatManager.createImageMessage({
      conversationId: to,
      conversationType: 'singleChat',
      data: filePath
    })
    await this.deliver(message, to, '')
  }

  // 先落本地 sending 态，sendMessage 后回写 sent/failed；失败保留供 M2 重发
  private async deliver(message: Message, to: string, fallbackText: string): Promise<void> {
    const chatManager = this.client?.chatManager
    if (chatManager == null) {
      throw new Error('call EmKit.init() first')
    }
    const item = this.toMessageItem(message)
    item.to = to
    item.self = true
    item.status = 'sending'
    if (item.type === 'text' && item.text === '') item.text = fallbackText
    this.appendMessage(item)
    this.notify(item)
    try {
      const sent = await chatManager.sendMessage(message)
      item.id = sent.msgServerId !== '' ? sent.msgServerId : sent.msgLocalId
      item.time = sent.timestamp
      item.status = 'sent'
    } catch (e) {
      item.status = 'failed'
      throw e
    }
  }

  async loadHistory(conversationId: string, pageSize = 20): Promise<void> {
    const chatManager = await this.readyChatManager()
    const cursor = messageStore.cursors[conversationId] ?? ''
    const page = await chatManager.getHistoryMessages({
      conversationId,
      conversationType: 'singleChat',
      cursor,
      pageSize,
      searchDirection: 'up'
    })
    messageStore.cursors[conversationId] = page.cursor
    messageStore.hasMore[conversationId] = page.hasMore
    const list = getMessages(conversationId)
    const existing: Record<string, boolean> = {}
    list.forEach((m) => { existing[m.id] = true })
    const older = page.items
      .map((m) => this.toMessageItem(m as Message))
      .filter((m) => !existing[m.id])
    messageStore.byConversation[conversationId] = [...older, ...list].sort((a, b) => a.time - b.time)
  }

  async syncConversations(): Promise<void> {
    const chatManager = await this.readyChatManager()
    conversationStore.syncing = true
    try {
      let items: ReadonlyArray<ConversationItem> = []
      try {
        items = await chatManager.refreshSessionList()
      } catch (e) {
        items = chatManager.getConversationList()
      }
      conversationStore.list = items
        .filter((c) => c.conversationType === 'singleChat')
        .map((c) => this.toConversationItem(c))
    } finally {
      conversationStore.syncing = false
    }
  }

  async enterConversation(conversationId: string): Promise<void> {
    const chatManager = await this.readyChatManager()
    chatManager.setCurrentConversation({ conversationId, conversationType: 'singleChat' })
    chatManager.clearConversationUnreadMessageCount({ conversationId, conversationType: 'singleChat' }).catch(() => {})
  }

  leaveConversation(): void {
    this.client?.chatManager.resetCurrentConversation()
  }

  private async readyChatManager() {
    if (this.client == null) {
      throw new Error('call EmKit.init() first')
    }
    if (this.waitOnline != null) {
      await this.waitOnline()
    }
    return this.client.chatManager
  }

  private appendMessage(item: EmMessageItem): void {
    const list = getMessages(item.conversationId)
    if (list.some((m) => m.id === item.id && item.id !== '')) {
      return
    }
    list.push(item)
  }

  private notify(item: EmMessageItem): void {
    this.handlers.forEach((h) => h(item))
  }

  private toMessageItem(message: Message): EmMessageItem {
    const id = message.msgServerId !== '' ? message.msgServerId : message.msgLocalId
    const item: EmMessageItem = {
      id,
      localId: message.msgLocalId,
      conversationId: message.conversationId !== '' ? message.conversationId : this.peerOf(message),
      type: 'other',
      text: '',
      url: '',
      thumbUrl: '',
      width: 0,
      height: 0,
      time: message.timestamp,
      from: message.from,
      to: message.to,
      self: message.from === connectionStore.userId,
      status: 'sent'
    }
    if (message.type === 'text') {
      item.type = 'text'
      item.text = (message.body as TextMessageBody).content
    } else if (message.type === 'img' || (message.type as string) === 'image') {
      item.type = 'image'
      const body = message.body as ImageMessageBody
      item.url = body.localUrl !== '' ? body.localUrl : (body.bigImageUrl ?? body.originalImageUrl ?? body.thumbnailUrl ?? '')
      item.thumbUrl = body.thumbnailUrl ?? item.url
      item.width = body.width ?? 0
      item.height = body.height ?? 0
    }
    return item
  }

  private peerOf(message: Message): string {
    return message.from === connectionStore.userId ? message.to : message.from
  }

  // 事件快照可能先于用户资料同步到达（conversationName 为空或等于 id），
  // 名称/头像在缺失时沿用前一次有效值，避免列表闪烁回 userId
  private toConversationItem(c: ConversationItem): EmConversationItem {
    const prev = conversationStore.list.find((p) => p.conversationId === c.conversationId)
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
    switch (last.type) {
      case 'text':
        return `${(last.body as Record<string, unknown>)['content'] ?? ''}`
      case 'img':
        return t('message.image')
      case 'audio':
        return t('message.audio')
      case 'video':
        return t('message.video')
      case 'file':
        return t('message.file')
      case 'custom':
        return t('message.custom')
      default:
        return t('message.unsupported')
    }
  }
}
