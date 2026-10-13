import type {
  ChatClient,
  CompatibleFile,
  ConversationItem,
  FileMessageBody,
  ImageMessageBody,
  Message,
  PushManager,
  SessionMessageSnippet,
  TextMessageBody,
  VideoMessageBody,
  VoiceMessageBody
} from 'easemob-websdk'
import { CONVERSATION_TYPE, MESSAGE_EXT_KEY, MESSAGE_STATUS, MESSAGE_TYPE } from '../constants'
import { connectionStore } from '../store/connection'
import { conversationStore } from '../store/conversation'
import { getMessages, messageStore } from '../store/message'
import type { EmPickedFile } from '../platform'
import type { EmConversationItem, EmMessageHandler, EmMessageItem, EmQuoteInfo } from '../types'
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
          .filter((c) => c.conversationType === CONVERSATION_TYPE.SINGLE_CHAT)
          .map((c) => this.toConversationItem(c))
      },
      onMessageRecalled: (payload: { conversationId: string, messageId: string }) => {
        this.markRecalled(payload.conversationId, payload.messageId)
      }    })
  }

  onMessage(handler: EmMessageHandler): void {
    this.handlers.push(handler)
  }

  /** @deprecated 兼容 M0 spike 页 */
  onTextMessage(handler: EmMessageHandler): void {
    this.onMessage(handler)
  }

  async sendText(to: string, text: string, quote?: EmQuoteInfo): Promise<void> {
    const chatManager = await this.readyChatManager()
    const message = chatManager.createTextMessage({
      conversationId: to,
      conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
      content: text,
      // 引用挂在消息 ext 上（emQuote 自定义 key），接收方/历史消息解析还原
      ext: quote != null ? { [MESSAGE_EXT_KEY.QUOTE]: { msgId: quote.msgId, from: quote.from, text: quote.text, type: quote.type } } : undefined
    })
    await this.deliver(message, to, text, quote)
  }

  // 引用快照：文本截断 50 字，非文本消息用 locale 摘要（对齐 summaryOf 的文案纪律）
  makeQuote(item: EmMessageItem): EmQuoteInfo {
    const { t } = useLocale()
    let text = item.text
    if (item.type === MESSAGE_TYPE.IMAGE) {
      text = t('message.image')
    } else if (item.type === MESSAGE_TYPE.AUDIO) {
      text = t('message.audio')
    } else if (item.type === MESSAGE_TYPE.VIDEO) {
      text = t('message.video')
    } else if (item.type === MESSAGE_TYPE.FILE) {
      text = item.fileName !== '' ? `${t('message.file')}${item.fileName}` : t('message.file')
    } else if (item.type !== MESSAGE_TYPE.TEXT) {
      text = t('message.unsupported')
    }
    return { msgId: item.id, from: item.from, text: text.slice(0, 50), type: item.type }
  }

  async sendImage(to: string, filePath: string): Promise<void> {
    const chatManager = await this.readyChatManager()
    const message = chatManager.createImageMessage({
      conversationId: to,
      conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
      data: filePath
    })
    await this.deliver(message, to, '')
  }

  async sendAudio(to: string, filePath: string, duration: number): Promise<void> {
    const chatManager = await this.readyChatManager()
    const message = chatManager.createVoiceMessage({
      conversationId: to,
      conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
      data: filePath,
      duration
    })
    await this.deliver(message, to, '', undefined, filePath)
  }

  async sendVideo(to: string, filePath: string, duration: number, width: number, height: number): Promise<void> {
    const chatManager = await this.readyChatManager()
    const message = chatManager.createVideoMessage({
      conversationId: to,
      conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
      data: filePath,
      duration,
      width,
      height
    })
    await this.deliver(message, to, '', undefined, filePath)
  }

  async sendFile(to: string, file: EmPickedFile): Promise<void> {
    const chatManager = await this.readyChatManager()
    // H5 上传需要 File 对象；小程序/App 走 { path, name, size }（MiniAppFile）
    const data = (file.webFile != null ? file.webFile : { path: file.path, name: file.name, size: file.size }) as CompatibleFile
    const message = chatManager.createFileMessage({
      conversationId: to,
      conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
      data,
      filename: file.name,
      fileSize: file.size
    })
    await this.deliver(message, to, '', undefined, file.path)
  }

  // 先落本地 sending 态，sendMessage 后回写 sent/failed；失败保留供 M2 重发
  // localUrl：语音/视频/文件的本地临时路径，SDK 未回写 body.url 时兜底（本地回显/播放/重发用）
  private async deliver(message: Message, to: string, fallbackText: string, quote?: EmQuoteInfo, localUrl = ''): Promise<void> {
    const chatManager = this.client?.chatManager
    if (chatManager == null) {
      throw new Error('call EmKit.init() first')
    }
    const item = this.toMessageItem(message)
    item.to = to
    item.self = true
    item.status = MESSAGE_STATUS.SENDING
    if (item.type === MESSAGE_TYPE.TEXT && item.text === '') item.text = fallbackText
    if (item.url === '' && localUrl !== '') item.url = localUrl
    // 兜底本地回显：createTextMessage 返回的 Message 若未带上 ext，引用也要立即可见
    if (quote != null && item.quote == null) item.quote = quote
    this.appendMessage(item)
    this.notify(item)
    try {
      const sent = await chatManager.sendMessage(message)
      item.id = sent.msgServerId !== '' ? sent.msgServerId : sent.msgLocalId
      item.time = sent.timestamp
      item.status = MESSAGE_STATUS.SENT
    } catch (e) {
      item.status = MESSAGE_STATUS.FAILED
      throw e
    }
  }

  async loadHistory(conversationId: string, pageSize = 20): Promise<void> {
    const chatManager = await this.readyChatManager()
    const cursor = messageStore.cursors[conversationId] ?? ''
    const page = await chatManager.getHistoryMessages({
      conversationId,
      conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
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
        .filter((c) => c.conversationType === CONVERSATION_TYPE.SINGLE_CHAT)
        .map((c) => this.toConversationItem(c))
    } finally {
      conversationStore.syncing = false
    }
  }

  async enterConversation(conversationId: string): Promise<void> {
    const chatManager = await this.readyChatManager()
    chatManager.setCurrentConversation({ conversationId, conversationType: CONVERSATION_TYPE.SINGLE_CHAT })
    chatManager.clearConversationUnreadMessageCount({ conversationId, conversationType: CONVERSATION_TYPE.SINGLE_CHAT }).catch(() => {})
  }

  leaveConversation(): void {
    this.client?.chatManager.resetCurrentConversation()
  }

  async pinConversation(conversationId: string, pinned: boolean): Promise<void> {
    const chatManager = await this.readyChatManager()
    await chatManager.setConversationPinned({ conversationId, conversationType: CONVERSATION_TYPE.SINGLE_CHAT, pinned })
    const item = conversationStore.list.find((c) => c.conversationId === conversationId)
    if (item != null) {
      item.isPinned = pinned
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    const chatManager = await this.readyChatManager()
    await chatManager.deleteConversation({ conversationId, conversationType: CONVERSATION_TYPE.SINGLE_CHAT })
    conversationStore.list = conversationStore.list.filter((c) => c.conversationId !== conversationId)
    delete messageStore.byConversation[conversationId]
    delete messageStore.cursors[conversationId]
    delete messageStore.hasMore[conversationId]
  }

  // 免打扰走 PushManager：设置 remindType NONE 为免打扰；
  // 恢复时 remindType 可设值不含 DEFAULT，须调 clearConversationRemindType 清除。
  // （'REMIND_TYPE'/'NONE' 为 SDK wire 枚举，按规范在边界处保留字面量）
  async setConversationMuted(conversationId: string, muted: boolean): Promise<void> {
    await this.readyChatManager()
    const client = this.client as unknown as { pushManager?: PushManager } | null
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
    const item = conversationStore.list.find((c) => c.conversationId === conversationId)
    if (item != null) {
      item.isMuted = muted
    }
  }

  async recallMessage(conversationId: string, messageId: string): Promise<void> {
    const chatManager = await this.readyChatManager()
    await chatManager.recallMessage({ conversationId, conversationType: CONVERSATION_TYPE.SINGLE_CHAT, messageId })
    this.markRecalled(conversationId, messageId)
  }

  // 仅从本地消息列表移除，不联服务端
  deleteLocalMessage(conversationId: string, localId: string): void {
    const list = messageStore.byConversation[conversationId]
    if (list == null) {
      return
    }
    messageStore.byConversation[conversationId] = list.filter((m) => m.localId !== localId)
  }

  // 失败重发：原 Message 对象不入 store，用 item 上留存的内容重建消息再投递；
  // item 原位复用（只改状态/回填 serverId 与 time），列表位置与 quote 快照不动。
  // 注意：图片重发依赖 item.url 里的本地临时路径，跨会话过期后重发会再次失败
  async resendMessage(conversationId: string, localId: string): Promise<void> {
    const chatManager = await this.readyChatManager()
    const list = messageStore.byConversation[conversationId]
    const item = list != null ? list.find((m) => m.localId === localId) : undefined
    if (item == null) {
      throw new Error('message not found')
    }
    if (!item.self || item.status !== MESSAGE_STATUS.FAILED) {
      return
    }
    let message: Message
    if (item.type === MESSAGE_TYPE.IMAGE) {
      message = chatManager.createImageMessage({
        conversationId,
        conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
        data: item.url
      })
    } else {
      const quote = item.quote
      message = chatManager.createTextMessage({
        conversationId,
        conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
        content: item.text,
        ext: quote != null ? { [MESSAGE_EXT_KEY.QUOTE]: { msgId: quote.msgId, from: quote.from, text: quote.text, type: quote.type } } : undefined
      })
    }
    item.status = MESSAGE_STATUS.SENDING
    try {
      const sent = await chatManager.sendMessage(message)
      item.id = sent.msgServerId !== '' ? sent.msgServerId : sent.msgLocalId
      item.time = sent.timestamp
      item.status = MESSAGE_STATUS.SENT
    } catch (e) {
      item.status = MESSAGE_STATUS.FAILED
      throw e
    }
  }

  private markRecalled(conversationId: string, messageId: string): void {
    const list = messageStore.byConversation[conversationId]
    if (list == null) {
      return
    }
    const target = list.find((m) => m.id === messageId)
    if (target != null) {
      target.status = MESSAGE_STATUS.RECALLED
    }
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
      type: MESSAGE_TYPE.OTHER,
      text: '',
      url: '',
      thumbUrl: '',
      width: 0,
      height: 0,
      time: message.timestamp,
      from: message.from,
      to: message.to,
      self: message.from === connectionStore.userId,
      status: MESSAGE_STATUS.SENT,
      quote: null,
      duration: 0,
      fileName: '',
      fileSize: 0
    }
    const rawQuote = message.ext?.[MESSAGE_EXT_KEY.QUOTE]
    if (rawQuote != null && typeof rawQuote === 'object') {
      const q = rawQuote as Record<string, unknown>
      const msgId = q['msgId']
      const from = q['from']
      const text = q['text']
      if (typeof msgId === 'string' && typeof from === 'string' && typeof text === 'string') {
        const quote: EmQuoteInfo = { msgId, from, text }
        const type = q['type']
        if (type === MESSAGE_TYPE.TEXT || type === MESSAGE_TYPE.IMAGE || type === MESSAGE_TYPE.AUDIO || type === MESSAGE_TYPE.VIDEO || type === MESSAGE_TYPE.FILE || type === MESSAGE_TYPE.OTHER) {
          quote.type = type
        }
        item.quote = quote
      }
    }
    // SDK wire 协议边界：5.x type 为 'image'/'voice'，4.x 遗风为 'img'/'audio'，
    // 此处是唯一的双兼容映射点，wire 字段保留字面量（规范允许的例外），出口全部落到 MESSAGE_TYPE
    const mtype = message.type as string
    if (mtype === 'text') {
      item.type = MESSAGE_TYPE.TEXT
      item.text = (message.body as TextMessageBody).content
    } else if (mtype === 'img' || mtype === 'image') {
      item.type = MESSAGE_TYPE.IMAGE
      const body = message.body as ImageMessageBody
      item.url = body.localUrl !== '' ? body.localUrl : (body.bigImageUrl ?? body.originalImageUrl ?? body.thumbnailUrl ?? '')
      item.thumbUrl = body.thumbnailUrl ?? item.url
      item.width = body.width ?? 0
      item.height = body.height ?? 0
    } else if (mtype === 'voice' || mtype === 'audio') {
      item.type = MESSAGE_TYPE.AUDIO
      const body = message.body as VoiceMessageBody
      item.url = body.url ?? ''
      item.duration = body.duration ?? 0
    } else if (mtype === 'video') {
      item.type = MESSAGE_TYPE.VIDEO
      const body = message.body as VideoMessageBody
      item.url = body.url ?? ''
      item.thumbUrl = body.thumbnailUrl ?? ''
      item.duration = body.duration ?? 0
      item.width = body.width ?? 0
      item.height = body.height ?? 0
    } else if (mtype === 'file') {
      item.type = MESSAGE_TYPE.FILE
      const body = message.body as FileMessageBody
      item.url = body.url ?? ''
      item.fileName = body.filename ?? ''
      item.fileSize = body.fileSize ?? body.fileLength ?? 0
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
      default:
        return t('message.unsupported')
    }
  }
}
