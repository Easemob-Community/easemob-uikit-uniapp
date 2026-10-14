import type {
  ChatClient,
  CmdMessageBody,
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
import { CMD_ACTION, CONVERSATION_TYPE, MESSAGE_EXT_KEY, MESSAGE_STATUS, MESSAGE_TYPE } from '../constants'
import { connectionStore } from '../store/connection'
import { conversationStore } from '../store/conversation'
import { getMessages, messageStore } from '../store/message'
import type { EmPickedFile, EmPickedImage, EmPickedVideo } from '../platform'
import type { EmConversationItem, EmKitConfig, EmMessageHandler, EmMessageItem, EmQuoteInfo } from '../types'
import { useLocale } from '../use/useLocale'
import { bindUserInfo, ensureUserInfos } from './user-info'

// typing 信号：发送节流间隔与接收方展示超时（对齐 vue 版 5s）
const TYPING_THROTTLE = 5000
const TYPING_TIMEOUT = 5000

// localId 兜底序号（SDK msgLocalId 为空时保证唯一）
let localSeq = 0
function nextLocalSeq(): number {
  localSeq += 1
  return localSeq
}

// 消息收发与会话同步：5.x ChatManager 封装
export class EmChat {
  private client: ChatClient | null = null
  private waitOnline: (() => Promise<void>) | null = null
  private handlers: EmMessageHandler[] = []
  private readReceiptOn = true
  private currentConversationId = ''
  private typingSentAt: Record<string, number> = {}
  private typingTimers: Record<string, ReturnType<typeof setTimeout>> = {}

  bind(client: ChatClient, waitOnline: () => Promise<void>, config?: EmKitConfig): void {
    if (this.client != null) {
      return
    }
    this.client = client
    this.waitOnline = waitOnline
    this.readReceiptOn = config?.enableReadReceipt !== false
    bindUserInfo(client)
    client.chatManager.addEventHandler('emkit-message', {
      onMessage: (message: Message) => {
        // SDK wire 边界：cmd 信号消息（typing 等）不落消息列表，在此拦截
        if ((message.type as string) === 'cmd') {
          this.onCmdMessage(message)
          return
        }
        const item = this.toMessageItem(message)
        this.appendMessage(item)
        this.notify(item)
        ensureUserInfos([item.from])
        // 在当前会话收到对方消息：即时回已读回执
        if (!item.self && item.conversationId === this.currentConversationId) {
          this.sendReadReceipts(item.conversationId).catch(() => {})
        }
      },
      onConversationListUpdate: (payload) => {
        conversationStore.list = payload.items
          .filter((c) => c.conversationType === CONVERSATION_TYPE.SINGLE_CHAT)
          .map((c) => this.toConversationItem(c))
        ensureUserInfos(conversationStore.list.map((c) => c.conversationId))
      },
      onMessageRecalled: (payload: { conversationId: string, messageId: string }) => {
        this.markRecalled(payload.conversationId, payload.messageId)
      },
      onMessageReadReceipts: (receipts) => {
        receipts.forEach((r) => {
          if (r.conversationType !== CONVERSATION_TYPE.SINGLE_CHAT) return
          const prev = messageStore.peerReadTime[r.conversationId] ?? 0
          if (r.timestamp > prev) {
            messageStore.peerReadTime[r.conversationId] = r.timestamp
          }
        })
      }    })
  }

  get readReceiptEnabled(): boolean {
    return this.readReceiptOn
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

  // SDK 5.x createXxxMessage 的 data 不收字符串路径：H5 要 File 对象，小程序/App 要 MiniAppFile { path, name, size }
  private asCompatibleFile(path: string, name: string, size: number, webFile: unknown | null): CompatibleFile {
    return (webFile != null ? webFile : { path, name, size }) as CompatibleFile
  }

  async sendImage(to: string, image: EmPickedImage): Promise<void> {
    const chatManager = await this.readyChatManager()
    const message = chatManager.createImageMessage({
      conversationId: to,
      conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
      data: this.asCompatibleFile(image.path, image.name, image.size, image.webFile),
      filename: image.name
    })
    await this.deliver(message, to, '', undefined, image.path)
  }

  async sendAudio(to: string, filePath: string, duration: number): Promise<void> {
    const chatManager = await this.readyChatManager()
    const name = filePath.slice(filePath.lastIndexOf('/') + 1)
    const message = chatManager.createVoiceMessage({
      conversationId: to,
      conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
      data: this.asCompatibleFile(filePath, name, 0, null),
      duration
    })
    await this.deliver(message, to, '', undefined, filePath)
  }

  async sendVideo(to: string, video: EmPickedVideo): Promise<void> {
    const chatManager = await this.readyChatManager()
    const message = chatManager.createVideoMessage({
      conversationId: to,
      conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
      data: this.asCompatibleFile(video.path, video.name, video.size, null),
      duration: video.duration,
      width: video.width,
      height: video.height
    })
    await this.deliver(message, to, '', undefined, video.path)
  }

  async sendFile(to: string, file: EmPickedFile): Promise<void> {
    const chatManager = await this.readyChatManager()
    // H5 上传需要 File 对象；小程序/App 走 { path, name, size }（MiniAppFile）
    const data = this.asCompatibleFile(file.path, file.name, file.size, file.webFile)
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
    // 状态回写必须落在 store 的响应式代理上：item 是原始对象，蒸汽（vapor）端
    // 细粒度绑定对原始对象的 mutation 不触发更新（VDOM 端靠整树重渲染掩盖了这点），
    // 真机上会卡在 sending 态。getMessages 经 reactive 数组读取，返回的是代理。
    const stored = getMessages(to).find((m) => m.localId === item.localId) ?? item
    try {
      const sent = await chatManager.sendMessage(message)
      stored.id = sent.msgServerId !== '' ? sent.msgServerId : sent.msgLocalId
      stored.time = sent.timestamp
      stored.status = MESSAGE_STATUS.SENT
    } catch (e) {
      stored.status = MESSAGE_STATUS.FAILED
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
      .filter((m) => (m.type as string) !== 'cmd')   // wire 边界：typing 等 cmd 信号不进消息列表
      .map((m) => this.toMessageItem(m as Message))
      .filter((m) => !existing[m.id])
    messageStore.byConversation[conversationId] = [...older, ...list].sort((a, b) => a.time - b.time)
    ensureUserInfos(older.map((m) => m.from))
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
      ensureUserInfos(conversationStore.list.map((c) => c.conversationId))
    } finally {
      conversationStore.syncing = false
    }
  }

  async enterConversation(conversationId: string): Promise<void> {
    const chatManager = await this.readyChatManager()
    this.currentConversationId = conversationId
    chatManager.setCurrentConversation({ conversationId, conversationType: CONVERSATION_TYPE.SINGLE_CHAT })
    chatManager.clearConversationUnreadMessageCount({ conversationId, conversationType: CONVERSATION_TYPE.SINGLE_CHAT }).catch(() => {})
    // 进入会话即回已读回执（对齐 vue 版会话切换 sendChannelAck 的时机）
    this.sendReadReceipts(conversationId).catch(() => {})
    // 确保对端与己方资料已缓存（气泡头像/昵称、导航标题用）
    ensureUserInfos([conversationId, connectionStore.userId])
  }

  leaveConversation(): void {
    this.currentConversationId = ''
    this.client?.chatManager.resetCurrentConversation()
  }

  // 单聊已读回执：批量回执该会话内对端消息（serverId，最多 50 条），对方经 onMessageReadReceipts 收到
  private async sendReadReceipts(conversationId: string): Promise<void> {
    if (!this.readReceiptOn) return
    const chatManager = await this.readyChatManager()
    const list = messageStore.byConversation[conversationId] ?? []
    const ids: string[] = []
    for (let i = list.length - 1; i >= 0 && ids.length < 50; i--) {
      const m = list[i]
      if (!m.self && m.id !== '') {
        ids.unshift(m.id)
      }
    }
    if (ids.length === 0) return
    await chatManager.sendMessageReadReceipts({
      conversationId,
      conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
      messageIds: ids
    })
  }

  // typing 信号：cmd 消息发送，chat 层节流（同一会话 5s 最多一条）；失败静默
  async sendTyping(conversationId: string): Promise<void> {
    const now = Date.now()
    const last = this.typingSentAt[conversationId] ?? 0
    if (now - last < TYPING_THROTTLE) {
      return
    }
    this.typingSentAt[conversationId] = now
    const chatManager = await this.readyChatManager()
    const message = chatManager.createCmdMessage({
      conversationId,
      conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
      action: CMD_ACTION.TYPING_BEGIN
    })
    await chatManager.sendMessage(message)
  }

  private onCmdMessage(message: Message): void {
    const body = message.body as CmdMessageBody
    if (body.action !== CMD_ACTION.TYPING_BEGIN) return
    if (message.from === connectionStore.userId) return
    const conversationId = this.peerOf(message)
    messageStore.peerTyping[conversationId] = true
    const prev = this.typingTimers[conversationId]
    if (prev != null) {
      clearTimeout(prev)
    }
    this.typingTimers[conversationId] = setTimeout(() => {
      messageStore.peerTyping[conversationId] = false
    }, TYPING_TIMEOUT)
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
      const name = item.url.slice(item.url.lastIndexOf('/') + 1)
      message = chatManager.createImageMessage({
        conversationId,
        conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
        data: this.asCompatibleFile(item.url, name, 0, null)
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
      // 历史/接收消息的 msgLocalId 可能为空：localId 是列表 :key 与滚动锚点的唯一标识，
      // 必须兜底成唯一值，否则 key 撞车、scroll-into-view 定位错乱、高亮匹配全员命中
      localId: message.msgLocalId !== '' ? message.msgLocalId : `em-local-${id !== '' ? id : `${message.timestamp}-${nextLocalSeq()}`}`,
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
      case 'cmd':
        // typing 等信令不作为会话摘要展示
        return ''
      default:
        return t('message.unsupported')
    }
  }
}
