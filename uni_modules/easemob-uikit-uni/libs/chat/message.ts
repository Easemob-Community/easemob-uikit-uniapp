// 消息生命周期域：发送（文本/图片/语音/视频/文件）、投递回写、历史加载、撤回、
// 本地删除、失败重发、已读回执与 typing 信令（cmd）。
// 门面（./index.ts）负责组合本域与会话域并接线 SDK 事件。
import type {
  ChatClient,
  CmdMessageBody,
  CompatibleFile,
  Message,
  FileMessageBody,
  ImageMessageBody,
  TextMessageBody,
  VideoMessageBody,
  VoiceMessageBody
} from 'easemob-websdk'
import { CMD_ACTION, CONVERSATION_TYPE, MESSAGE_EXT_KEY, MESSAGE_STATUS, MESSAGE_TYPE } from '../constants'
import { connectionStore } from '../store/connection'
import { uiConfig } from '../store/config'
import { getMessages, messageStore } from '../store/message'
import type { EmPickedFile, EmPickedImage, EmPickedVideo } from '../platform'
import type { EmMessageHandler, EmMessageItem, EmQuoteInfo } from '../types'
import { useLocale } from '../use/useLocale'
import { ensureUserInfos } from './user-info'

// localId 兜底序号（SDK msgLocalId 为空时保证唯一）
let localSeq = 0
function nextLocalSeq(): number {
  localSeq += 1
  return localSeq
}

/** chat 门面注入的共享上下文：SDK client 与等待上线的 Promise 工厂 */
export interface EmChatContext {
  client: ChatClient | null
  waitOnline: (() => Promise<void>) | null
}

export class EmMessageDomain {
  readonly handlers: EmMessageHandler[] = []
  readReceiptOn = true
  private typingSentAt: Record<string, number> = {}
  private typingTimers: Record<string, ReturnType<typeof setTimeout>> = {}

  constructor(private ctx: EmChatContext) {}

  // 返回取消函数：宿主（聊天页）卸载时调用，防 handlers 数组只增不减（反复进出聊天页会叠加触发）
  onMessage(handler: EmMessageHandler): () => void {
    this.handlers.push(handler)
    return () => {
      const idx = this.handlers.indexOf(handler)
      if (idx >= 0) {
        this.handlers.splice(idx, 1)
      }
    }
  }

  notify(item: EmMessageItem): void {
    this.handlers.forEach((h) => h(item))
  }

  async readyChatManager() {
    if (this.ctx.client == null) {
      throw new Error('call EmKit.init() first')
    }
    if (this.ctx.waitOnline != null) {
      await this.ctx.waitOnline()
    }
    return this.ctx.client.chatManager
  }

  async sendText(to: string, text: string, quote?: EmQuoteInfo): Promise<EmMessageItem> {
    const chatManager = await this.readyChatManager()
    const message = chatManager.createTextMessage({
      conversationId: to,
      conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
      content: text,
      // 引用挂在消息 ext 上（emQuote 自定义 key），接收方/历史消息解析还原
      ext: quote != null ? { [MESSAGE_EXT_KEY.QUOTE]: { msgId: quote.msgId, from: quote.from, text: quote.text, type: quote.type } } : undefined
    })
    return this.deliver(message, to, text, quote)
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

  async sendImage(to: string, image: EmPickedImage): Promise<EmMessageItem> {
    const chatManager = await this.readyChatManager()
    const message = chatManager.createImageMessage({
      conversationId: to,
      conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
      data: this.asCompatibleFile(image.path, image.name, image.size, image.webFile),
      filename: image.name
    })
    return this.deliver(message, to, '', undefined, image.path)
  }

  async sendAudio(to: string, filePath: string, duration: number): Promise<EmMessageItem> {
    const chatManager = await this.readyChatManager()
    const name = filePath.slice(filePath.lastIndexOf('/') + 1)
    const message = chatManager.createVoiceMessage({
      conversationId: to,
      conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
      data: this.asCompatibleFile(filePath, name, 0, null),
      duration
    })
    return this.deliver(message, to, '', undefined, filePath)
  }

  async sendVideo(to: string, video: EmPickedVideo): Promise<EmMessageItem> {
    const chatManager = await this.readyChatManager()
    const message = chatManager.createVideoMessage({
      conversationId: to,
      conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
      data: this.asCompatibleFile(video.path, video.name, video.size, null),
      duration: video.duration,
      width: video.width,
      height: video.height
    })
    return this.deliver(message, to, '', undefined, video.path)
  }

  async sendFile(to: string, file: EmPickedFile): Promise<EmMessageItem> {
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
    return this.deliver(message, to, '', undefined, file.path)
  }

  // 先落本地 sending 态，sendMessage 后回写 sent/failed；失败保留供重发。
  // 返回 store 代理上的消息项（发送回写后的最终态），供业务事件透出（em-chat-page 的 send emit）
  // localUrl：语音/视频/文件的本地临时路径，SDK 未回写 body.url 时兜底（本地回显/播放/重发用）
  private async deliver(message: Message, to: string, fallbackText: string, quote?: EmQuoteInfo, localUrl = ''): Promise<EmMessageItem> {
    const chatManager = this.ctx.client?.chatManager
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
    return stored
  }

  async loadHistory(conversationId: string, pageSize = 20): Promise<void> {
    const chatManager = await this.readyChatManager()
    const cursor = messageStore.cursorByConversationId[conversationId] ?? ''
    const page = await chatManager.getHistoryMessages({
      conversationId,
      conversationType: CONVERSATION_TYPE.SINGLE_CHAT,
      cursor,
      pageSize,
      searchDirection: 'up'
    })
    messageStore.cursorByConversationId[conversationId] = page.cursor
    messageStore.hasMoreByConversationId[conversationId] = page.hasMore
    const list = getMessages(conversationId)
    const existing: Record<string, boolean> = {}
    list.forEach((m) => { existing[m.id] = true })
    const older = page.items
      .filter((m) => (m.type as string) !== 'cmd')   // wire 边界：typing 等 cmd 信号不进消息列表
      .map((m) => this.toMessageItem(m as Message))
      .filter((m) => !existing[m.id])
    messageStore.messagesByConversationId[conversationId] = [...older, ...list].sort((a, b) => a.time - b.time)
    ensureUserInfos(older.map((m) => m.from))
  }

  // 单聊已读回执：批量回执该会话内对端消息（serverId，最多 50 条），对方经 onMessageReadReceipts 收到
  async sendReadReceipts(conversationId: string): Promise<void> {
    if (!this.readReceiptOn) return
    const chatManager = await this.readyChatManager()
    const list = messageStore.messagesByConversationId[conversationId] ?? []
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

  // onMessageReadReceipts 事件落库：仅单聊、只前进不回退（SDK wire 类型在门面事件回调处传参，此处不依赖 SDK 枚举）
  applyPeerReadTime(conversationType: string, conversationId: string, timestamp: number): void {
    if (conversationType !== CONVERSATION_TYPE.SINGLE_CHAT) return
    const prev = messageStore.peerReadTimeByConversationId[conversationId] ?? 0
    if (timestamp > prev) {
      messageStore.peerReadTimeByConversationId[conversationId] = timestamp
    }
  }

  // typing 信号：cmd 消息发送，本域节流（同一会话 uiConfig.typingThrottle 内最多一条）；失败静默
  async sendTyping(conversationId: string): Promise<void> {
    if (!uiConfig.enableTyping) return
    const now = Date.now()
    const last = this.typingSentAt[conversationId] ?? 0
    if (now - last < uiConfig.typingThrottle) {
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

  // cmd 信号入口（门面在 SDK onMessage 事件里拦截 cmd 后转调这里）：TypingBegin 置对端 typing，超时自动清除
  onCmdMessage(message: Message): void {
    if (!uiConfig.enableTyping) return
    const body = message.body as CmdMessageBody
    if (body.action !== CMD_ACTION.TYPING_BEGIN) return
    if (message.from === connectionStore.userId) return
    const conversationId = this.peerOf(message)
    messageStore.peerTypingByConversationId[conversationId] = true
    const prev = this.typingTimers[conversationId]
    if (prev != null) {
      clearTimeout(prev)
    }
    this.typingTimers[conversationId] = setTimeout(() => {
      messageStore.peerTypingByConversationId[conversationId] = false
    }, uiConfig.typingTimeout)
  }

  async recallMessage(conversationId: string, messageId: string): Promise<void> {
    const chatManager = await this.readyChatManager()
    await chatManager.recallMessage({ conversationId, conversationType: CONVERSATION_TYPE.SINGLE_CHAT, messageId })
    this.markRecalled(conversationId, messageId)
  }

  markRecalled(conversationId: string, messageId: string): void {
    const list = messageStore.messagesByConversationId[conversationId]
    if (list == null) {
      return
    }
    const target = list.find((m) => m.id === messageId)
    if (target != null) {
      target.status = MESSAGE_STATUS.RECALLED
    }
  }

  // 仅从本地消息列表移除，不联服务端
  deleteLocalMessage(conversationId: string, localId: string): void {
    const list = messageStore.messagesByConversationId[conversationId]
    if (list == null) {
      return
    }
    messageStore.messagesByConversationId[conversationId] = list.filter((m) => m.localId !== localId)
  }

  // 失败重发：原 Message 对象不入 store，用 item 上留存的内容重建消息再投递；
  // item 原位复用（只改状态/回填 serverId 与 time），列表位置与 quote 快照不动。
  // 注意：图片重发依赖 item.url 里的本地临时路径，跨会话过期后重发会再次失败
  async resendMessage(conversationId: string, localId: string): Promise<void> {
    const chatManager = await this.readyChatManager()
    const list = messageStore.messagesByConversationId[conversationId]
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

  appendMessage(item: EmMessageItem): void {
    const list = getMessages(item.conversationId)
    if (list.some((m) => m.id === item.id && item.id !== '')) {
      return
    }
    list.push(item)
  }

  toMessageItem(message: Message): EmMessageItem {
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
      fileSize: 0,
      ext: {},
      rawType: ''
    }
    // SDK ext 透传给宿主（自定义消息业务载荷的唯一通道；引用 emQuote 等内部 key 原样可见）
    if (message.ext != null && typeof message.ext === 'object') {
      item.ext = { ...(message.ext as Record<string, unknown>) }
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
    } else {
      // 未识别类型（自定义消息）：保留 wire type 原文，宿主经 #custom-message 插槽按 rawType 判别渲染
      item.rawType = mtype
    }
    return item
  }

  peerOf(message: Message): string {
    return message.from === connectionStore.userId ? message.to : message.from
  }
}
