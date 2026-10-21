// 消息生命周期域：发送（文本/图片/语音/视频/文件）、投递回写、历史加载、撤回、
// 本地删除、失败重发、已读回执与 typing 信令（cmd）。
// 门面（./index.ts）负责组合本域与会话域并接线 SDK 事件。
import type {
  ChatClient,
  CmdMessageBody,
  CompatibleFile,
  CustomMessageBody,
  Message,
  FileMessageBody,
  ImageMessageBody,
  StreamMessage,
  TextMessageBody,
  VideoMessageBody,
  VoiceMessageBody
} from 'easemob-websdk'
import { CMD_ACTION, CONVERSATION_MESSAGE_RETAIN_LIMIT, CONVERSATION_TYPE, MESSAGE_EXT_KEY, MESSAGE_STATUS, MESSAGE_TYPE, STREAM_MESSAGE_STATUS } from '../constants'
import type { ConversationTypeValue, MessageTypeValue, StreamMessageStatusValue } from '../constants'
import { connectionStore } from '../store/connection'
import { uiConfig } from '../store/config'
import { getMessages, messageStore } from '../store/message'
import type { EmPickedFile, EmPickedImage, EmPickedVideo } from '../platform'
import type { EmMessageHandler, EmMessageItem, EmQuoteInfo, EmStreamInfo } from '../types'
import { isStreamTerminal } from '../utils/stream'
import { createLogger } from '../utils/logger'
import { useLocale } from '../use/useLocale'
import { displayNameOf } from '../store/user'
import { ensureUserInfos } from './user-info'

const logger = createLogger('message')

// localId 兜底序号（SDK msgLocalId 为空时保证唯一）
let localSeq = 0
function nextLocalSeq(): number {
  localSeq += 1
  return localSeq
}

// 引用 wire 类型映射：内部 MESSAGE_TYPE（audio）↔ vue 引用协议（voice）；
// notice/other 在 vue 协议里没有对应值，回落 custom（只影响引用卡图标）
function quoteTypeToWire(type: MessageTypeValue | undefined): string {
  if (type === MESSAGE_TYPE.AUDIO) return 'voice'
  if (type === MESSAGE_TYPE.NOTICE || type === MESSAGE_TYPE.OTHER) return 'custom'
  return type != null ? type : MESSAGE_TYPE.TEXT
}

function quoteTypeFromWire(type: unknown): MessageTypeValue | null {
  if (type === MESSAGE_TYPE.TEXT || type === MESSAGE_TYPE.IMAGE || type === MESSAGE_TYPE.VIDEO || type === MESSAGE_TYPE.FILE || type === MESSAGE_TYPE.CUSTOM) {
    return type
  }
  if (type === 'voice' || type === MESSAGE_TYPE.AUDIO) return MESSAGE_TYPE.AUDIO
  return null
}

// 引用主协议（1.0）：ext.msgQuote，与 vue 版 buildQuoteExt 同结构——
// { msgID, msgPreview, msgSender, msgType, msgThumbUrl? }
function buildVueQuote(quote: EmQuoteInfo): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    msgID: quote.msgId,
    msgPreview: quote.text,
    msgSender: quote.fromName != null && quote.fromName !== '' ? quote.fromName : quote.from,
    msgType: quoteTypeToWire(quote.type)
  }
  if (quote.thumbUrl != null && quote.thumbUrl !== '') payload['msgThumbUrl'] = quote.thumbUrl
  return payload
}

// 引用旧协议（0.x uni 版）：ext.emQuote，双写以兼容尚未升级的 uni 客户端
function buildLegacyQuote(quote: EmQuoteInfo): Record<string, unknown> {
  const payload: Record<string, unknown> = { msgId: quote.msgId, from: quote.from, fromName: quote.fromName ?? '', text: quote.text, type: quote.type }
  if (quote.thumbUrl != null && quote.thumbUrl !== '') payload['thumbUrl'] = quote.thumbUrl
  return payload
}

// 旧协议解析：0.x uni 版 ext.emQuote
function parseLegacyQuote(ext: Record<string, unknown>): EmQuoteInfo | null {
  const legacy = ext[MESSAGE_EXT_KEY.QUOTE_LEGACY]
  if (legacy == null || typeof legacy !== 'object') return null
  const q = legacy as Record<string, unknown>
  const msgId = q['msgId']
  const from = q['from']
  const text = q['text']
  if (typeof msgId !== 'string' || typeof from !== 'string' || typeof text !== 'string') return null
  const quote: EmQuoteInfo = { msgId, from, text }
  const fromName = q['fromName']
  if (typeof fromName === 'string' && fromName !== '') quote.fromName = fromName
  const type = quoteTypeFromWire(q['type'])
  if (type != null) quote.type = type
  const thumbUrl = q['thumbUrl']
  if (typeof thumbUrl === 'string' && thumbUrl !== '') quote.thumbUrl = thumbUrl
  return quote
}

// 主协议解析：1.0 起 ext.msgQuote（与 vue 版同结构）
function parseVueQuote(ext: Record<string, unknown>): EmQuoteInfo | null {
  const raw = ext[MESSAGE_EXT_KEY.QUOTE]
  if (raw == null || typeof raw !== 'object') return null
  const q = raw as Record<string, unknown>
  const msgPreview = q['msgPreview']
  const msgID = q['msgID']
  if (typeof msgPreview !== 'string' || msgPreview === '' || typeof msgID !== 'string') return null
  const msgSender = typeof q['msgSender'] === 'string' ? q['msgSender'] : ''
  const quote: EmQuoteInfo = { msgId: msgID, from: msgSender, text: msgPreview }
  if (msgSender !== '') {
    // vue 协议只带一个「发送人显示名/ID」字段，两处都填保证引用卡与老数据回落链一致
    quote.fromName = msgSender
  }
  const type = quoteTypeFromWire(q['msgType'])
  if (type != null) quote.type = type
  const thumbUrl = q['msgThumbUrl']
  if (typeof thumbUrl === 'string' && thumbUrl !== '') quote.thumbUrl = thumbUrl
  return quote
}

// 引用解析（收/发/历史三路径共用）：优先主协议 msgQuote，缺失时回落旧 emQuote；
// 本端双写消息用旧 payload 回填 from/fromName（vue 协议只有 msgSender 一个字段，无法区分 ID 与昵称）。
function parseQuote(ext: Record<string, unknown> | null | undefined): EmQuoteInfo | null {
  if (ext == null) return null
  const legacy = parseLegacyQuote(ext)
  const quote = parseVueQuote(ext)
  if (quote == null) return legacy
  if (legacy != null) {
    quote.from = legacy.from
    if (legacy.fromName != null && legacy.fromName !== '') quote.fromName = legacy.fromName
    if (quote.type == null && legacy.type != null) quote.type = legacy.type
    if (quote.thumbUrl == null && legacy.thumbUrl != null) quote.thumbUrl = legacy.thumbUrl
  }
  return quote
}

// 文本消息 ext 组装：业务 ext（多场景上下文，如订单/商品/来源页）+ 引用（主 msgQuote + 旧 emQuote 双写）
// + @提及（em_at_list userId 数组，与 vue 版互认）；内部 key 后写，业务 ext 不可覆盖它们；
// 全空返回 undefined（不挂 ext，保持现状行为）
function buildTextExt(quote?: EmQuoteInfo, mentions?: string[], extraExt?: Record<string, unknown>): Record<string, unknown> | undefined {
  const ext: Record<string, unknown> = extraExt != null ? { ...extraExt } : {}
  // 内部 key 一律由 UIKit 写入：即使本次没有引用/@提及，也不能让业务 ext 伪造
  delete ext[MESSAGE_EXT_KEY.QUOTE]
  delete ext[MESSAGE_EXT_KEY.QUOTE_LEGACY]
  delete ext[MESSAGE_EXT_KEY.MENTION]
  if (quote != null) {
    ext[MESSAGE_EXT_KEY.QUOTE] = buildVueQuote(quote)
    ext[MESSAGE_EXT_KEY.QUOTE_LEGACY] = buildLegacyQuote(quote)
  }
  if (mentions != null && mentions.length > 0) {
    ext[MESSAGE_EXT_KEY.MENTION] = mentions
  }
  return Object.keys(ext).length > 0 ? ext : undefined
}

// SDK wire 会话类型 → 中立 chatType 的唯一映射点（wire 字面量规范允许的边界例外）：
// 5.x 为 'singleChat'/'groupChat'/'chatRoom'，4.x 遗风 'single'/'group'/'room' 与
// 更老的 'chat'/'groupchat' 双兼容；未识别值兜底单聊（历史单聊数据缺字段场景）
export function mapWireChatType(wire: string): ConversationTypeValue {
  if (wire === 'groupChat' || wire === 'group' || wire === 'groupchat') {
    return CONVERSATION_TYPE.GROUP_CHAT
  }
  return CONVERSATION_TYPE.SINGLE_CHAT
}

/** chat 门面注入的共享上下文：SDK client 与等待上线的 Promise 工厂 */
export interface EmChatContext {
  client: ChatClient | null
  waitOnline: (() => Promise<void>) | null
}

export class EmMessageDomain {
  readonly handlers: EmMessageHandler[] = []
  // 流式消息专用订阅（M2.13）：高频分片只走此通道，不污染 onMessage（新消息语义）。
  // 订阅方按需做副作用（外部 AI 面板/埋点），聊天页渲染仍由 store 响应式驱动
  readonly streamHandlers: EmMessageHandler[] = []
  readReceiptOn = true
  private typingSentAt: Record<string, number> = {}
  private typingTimers: Record<string, ReturnType<typeof setTimeout>> = {}
  // 失败消息的原始上传文件（H5 File）：SDK web 上传只认 File/Blob，而 EmMessageItem 只持久化 URL/path；
  // 只在内存持有，发送成功 / 删除本地消息 / 登出时释放（重发 H5 图片/视频/文件需要它）。
  private uploadFileByLocalId: Record<string, unknown> = {}
  // 宿主附件能力提供的临时副本：path → release。发送成功/重发成功/删除消息/登出时清理；
  // 发送失败保留路径，重发仍能读到文件（与 uploadFileByLocalId 的生命周期一致）。
  private releaseByPath: Record<string, (path: string) => void> = {}
  // 历史加载飞行中去重（会话页预热 + 聊天页 mount 会并发调用同一会话）
  private historyPromiseByConversationId: Record<string, Promise<void>> = {}
  // 会话代次：登出/换账号时自增，飞行中的历史请求回来后据此丢弃，避免把旧账号消息写进新会话缓存
  private sessionEpoch = 0
  // 流式消息索引：`<conversationId>|<msgServerId>` → store 响应式代理。
  // 高频分片按 O(1) 定位同一条气泡（不遍历消息列表），且必须持代理而非原始对象
  // （蒸汽端对原始对象 mutation 不触发更新，见 deliver 同款注释）
  private streamItemByKey: Record<string, EmMessageItem> = {}
  // 分片合批缓冲：同一消息在一个节流窗口内只落最新全文/状态，窗口结束一次性写 store + 通知
  private pendingStreamByKey: Record<string, { item: EmMessageItem, stream: EmStreamInfo }> = {}
  private streamTimerByKey: Record<string, ReturnType<typeof setTimeout>> = {}
  // P1-10 内存上限：只对非当前会话裁剪；当前会话离开时再裁，回会话由 trimmed 标记触发重拉最新页
  private activeConversationId = ''
  private trimmedByConversationId: Record<string, boolean> = {}

  constructor(private ctx: EmChatContext) {}

  // 登出/换账号重置域内状态：typing 计时器（防旧账号残留）与失败消息的本地 File 缓存
  reset(): void {
    Object.keys(this.typingTimers).forEach((key) => clearTimeout(this.typingTimers[key]))
    this.typingTimers = {}
    this.typingSentAt = {}
    this.uploadFileByLocalId = {}
    Object.keys(this.releaseByPath).forEach((path) => this.releaseTemporary(path))
    this.releaseByPath = {}
    this.historyPromiseByConversationId = {}
    Object.keys(this.streamTimerByKey).forEach((key) => clearTimeout(this.streamTimerByKey[key]))
    this.streamTimerByKey = {}
    this.pendingStreamByKey = {}
    this.streamItemByKey = {}
    this.activeConversationId = ''
    this.trimmedByConversationId = {}
    this.sessionEpoch += 1
  }

  // 登记宿主附件临时副本：只有 temporary=true 且带 release 的附件才需要 UIKit 兜底清理
  private trackTemporary(file: EmPickedFile): void {
    const release = file.release
    if (file.temporary == true && release != null && file.path !== '') {
      this.releaseByPath[file.path] = release
    }
  }

  // 清理临时副本：同一路径只回调一次（先删索引再执行，release 抛错不会阻断发送链路）
  private releaseTemporary(path: string): void {
    if (path === '') return
    const release = this.releaseByPath[path]
    if (release == null) return
    delete this.releaseByPath[path]
    try {
      release(path)
    } catch (e) {
      logger.warn('release temporary attachment failed:', path, e)
    }
  }

  /** 会话域进入/离开时同步当前会话：进入后该会话不再被内存上限裁剪 */
  setActiveConversation(conversationId: string): void {
    this.activeConversationId = conversationId
  }

  /** 非当前会话只保留最近 N 条；被裁过的会话下次 loadHistory 会丢弃旧游标、重拉最新页，避免出现时间断层 */
  trimConversation(conversationId: string): void {
    const list = messageStore.messagesByConversationId[conversationId]
    if (list == null || list.length <= CONVERSATION_MESSAGE_RETAIN_LIMIT) return
    messageStore.messagesByConversationId[conversationId] = list.slice(list.length - CONVERSATION_MESSAGE_RETAIN_LIMIT)
    this.trimmedByConversationId[conversationId] = true
  }

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

  /** 订阅流式消息更新（分片合批后触发，≤1000/streamThrottle 次/秒）；返回取消函数 */
  onStreamMessage(handler: EmMessageHandler): () => void {
    this.streamHandlers.push(handler)
    return () => {
      const idx = this.streamHandlers.indexOf(handler)
      if (idx >= 0) {
        this.streamHandlers.splice(idx, 1)
      }
    }
  }

  notifyStream(item: EmMessageItem): void {
    this.streamHandlers.forEach((h) => h(item))
  }

  // ===== 流式消息（M2.13，AI 流式输出） =====

  /**
   * SDK onStreamMessage 入口：分片按 msgServerId 合并到同一条文本气泡。
   * - `fullText` 幂等覆盖（服务端已排序合并，不依赖 deltaText / 分片到达顺序）；
   * - 首个分片立即建气泡（低首字延迟），后续分片按 uiConfig.streamThrottle 合批写 store；
   * - 终态分片（COMPLETED/START_COMPLETED/ERROR）不受节流约束，立即落盘；
   * - enableStreamMessage=false 时整体忽略，等 onMessage 完整消息一次性上屏（SDK 语义不变）。
   */
  handleStreamMessage(message: StreamMessage): void {
    if (!uiConfig.enableStreamMessage) return
    const stream = message.stream
    // 流式仅文本消息；其它类型（未来扩展）不进本链路
    if (stream == null || (message.type as string) !== MESSAGE_TYPE.TEXT) return
    const conversationId = message.conversationId !== '' ? message.conversationId : this.peerOf(message)
    const msgId = message.msgServerId !== '' ? message.msgServerId : message.msgLocalId
    if (conversationId === '' || msgId === '') return

    const key = this.streamKeyOf(conversationId, msgId)
    const info = this.toStreamInfo(stream)
    let item: EmMessageItem | undefined = this.streamItemByKey[key]
    if (item == null) {
      // 先于首个分片到达的完整消息（或历史回流）已存在：直接挂流式状态，不新建气泡
      item = this.findStreamItem(conversationId, msgId, message.msgLocalId)
    }
    if (item == null) {
      item = this.toMessageItem(message)
      item.text = info.fullText
      item.stream = info
      const stored = this.appendMessage(item)
      if (stored == null) return
      // appendMessage 返回 reactive 数组里的代理：后续分片 mutation 才会触发蒸汽端细粒度更新
      this.streamItemByKey[key] = stored
      ensureUserInfos([stored.from])
      this.notifyStream(stored)
      return
    }

    // serverId/localId 切换（首个分片缺 serverId）时把索引迁到稳定 key，顺带清掉旧 key 的 pending/计时器
    this.adoptStreamKey(key, item)
    // 乱序/重复分片防御：非终态旧分片不覆盖新内容（服务端 fullText 已含全部增量）。
    // 比较基线取「已落盘 seq 与待落盘 pending seq 的较大者」，否则未 flush 的新分片会被乱序旧片覆盖
    const pending = this.pendingStreamByKey[key]
    const currentSeq = pending != null
      ? pending.stream.seq
      : (item.stream?.seq ?? -1)
    if (!isStreamTerminal(info.status) && info.seq < currentSeq) return

    if (pending != null) {
      pending.item = item
      pending.stream = info
    } else {
      this.pendingStreamByKey[key] = { item, stream: info }
    }
    this.scheduleStreamFlush(key, isStreamTerminal(info.status))
  }

  /**
   * onMessage 完整消息入口（流式丢片补偿）：同 msgServerId 的流式副本仍在时，
   * 用完整消息覆盖并收敛为终态，避免离线/断连错过分片后残留半截内容；
   * 其余情况维持「追加 + 通知」的新消息语义。
   */
  ingestIncoming(item: EmMessageItem): void {
    let existing: EmMessageItem | undefined
    if (item.id !== '') {
      existing = this.streamItemByKey[this.streamKeyOf(item.conversationId, item.id)]
        ?? this.findStreamItem(item.conversationId, item.id, item.localId)
      // 终态覆盖前清掉该消息所有索引/合批计时器（localId/serverId 双 key 场景也不残留）
      if (existing != null) {
        this.clearStreamKeysForItem(existing)
      }
    }
    if (existing != null && existing.stream != null) {
      // localId 是列表 :key / 滚动锚点，必须保持稳定
      const localId = existing.localId
      const terminal: EmStreamInfo = {
        ...existing.stream,
        status: STREAM_MESSAGE_STATUS.COMPLETED,
        deltaText: '',
        fullText: item.text
      }
      Object.assign(existing, item)
      existing.localId = localId
      existing.stream = terminal
      this.notify(existing)
      // 终态也可能由完整消息先到（终态分片丢失）：给流式订阅方补一次终态回调
      this.notifyStream(existing)
      return
    }
    this.appendMessage(item)
    this.notify(item)
  }

  /** 清理指定会话的流式索引/合批缓冲（清空记录、删除会话、登出时调用，防计时器回写幽灵消息） */
  forgetStreams(conversationId: string): void {
    const prefix = `${conversationId}|`
    const keys: Record<string, boolean> = {}
    Object.keys(this.streamItemByKey).forEach((key) => { keys[key] = true })
    Object.keys(this.pendingStreamByKey).forEach((key) => { keys[key] = true })
    Object.keys(keys).forEach((key) => {
      if (key.indexOf(prefix) === 0) {
        this.clearStreamKey(key)
      }
    })
  }

  private streamKeyOf(conversationId: string, msgId: string): string {
    return `${conversationId}|${msgId}`
  }

  private findStreamItem(conversationId: string, msgId: string, msgLocalId: string): EmMessageItem | undefined {
    return getMessages(conversationId).find(
      (m) => m.id === msgId || (msgLocalId !== '' && m.localId === msgLocalId)
    )
  }

  private toStreamInfo(stream: NonNullable<StreamMessage['stream']>): EmStreamInfo {
    const info: EmStreamInfo = {
      customType: stream.customType ?? '',
      seq: stream.seq,
      // SDK 公开状态值与 constants.STREAM_MESSAGE_STATUS 一一对应（wire 边界转换点）
      status: stream.status as StreamMessageStatusValue,
      deltaText: stream.deltaText,
      fullText: stream.fullText,
      errorType: stream.errorType
    }
    if (typeof stream.finishReason === 'number') {
      info.finishReason = stream.finishReason
    }
    return info
  }

  private scheduleStreamFlush(key: string, immediate: boolean): void {
    // 终态立即落盘：最后一段内容不能因节流窗口延迟；0 = 显式关闭合批（逐片写）
    if (immediate || uiConfig.streamThrottle <= 0) {
      this.flushStream(key)
      return
    }
    // 节流（非防抖）：窗口从首个待写分片起算，持续到达的分片不会饿死首字更新
    if (this.streamTimerByKey[key] != null) return
    const delay = uiConfig.streamThrottle
    this.streamTimerByKey[key] = setTimeout(() => {
      delete this.streamTimerByKey[key]
      this.flushStream(key)
    }, delay)
  }

  private flushStream(key: string): void {
    const timer = this.streamTimerByKey[key]
    if (timer != null) {
      clearTimeout(timer)
      delete this.streamTimerByKey[key]
    }
    const pending = this.pendingStreamByKey[key]
    if (pending == null) return
    delete this.pendingStreamByKey[key]
    // 运行期关闭流式：丢弃未落盘分片（后续完整消息走 onMessage）
    if (!uiConfig.enableStreamMessage) return
    const item = pending.item
    const info = pending.stream
    const prev = item.stream
    if (item.text === info.fullText && prev != null && prev.seq === info.seq && prev.status === info.status) {
      return
    }
    item.text = info.fullText
    item.stream = info
    // 终态后释放索引（消息仍留在列表；最终 onMessage 兜底时按 id 在列表中找回，不会重复建气泡）
    if (isStreamTerminal(info.status)) {
      delete this.streamItemByKey[key]
    }
    this.notifyStream(item)
  }

  private clearStreamKey(key: string): void {
    const timer = this.streamTimerByKey[key]
    if (timer != null) {
      clearTimeout(timer)
      delete this.streamTimerByKey[key]
    }
    delete this.pendingStreamByKey[key]
    delete this.streamItemByKey[key]
  }

  /** 同一气泡的 key 迁移（首个分片缺 serverId → 后续分片带上）：清旧 key 的索引与 pending，避免双份回写。
   *  已在新 key 下时 O(1) 短路，不在每片热路径上扫描 */
  private adoptStreamKey(key: string, item: EmMessageItem): void {
    if (this.streamItemByKey[key] === item) return
    this.clearStreamKeysForItem(item)
    this.streamItemByKey[key] = item
  }

  /** 清理指向同一消息的全部索引/pending/计时器（仅在 key 迁移与终态覆盖时调用） */
  private clearStreamKeysForItem(item: EmMessageItem): void {
    Object.keys(this.streamItemByKey).forEach((k) => {
      if (this.streamItemByKey[k] === item) {
        this.clearStreamKey(k)
      }
    })
    Object.keys(this.pendingStreamByKey).forEach((k) => {
      if (this.pendingStreamByKey[k].item === item) {
        this.clearStreamKey(k)
      }
    })
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

  // mentions：@提及的 userId 列表（发前已用 filterActiveMentions 过滤），挂 ext.em_at_list 与 vue 版互认
  // ext：业务上下文载荷（多场景：订单号/商品 id/来源页），与引用/提及内部 key 合并，内部 key 优先
  async sendText(to: string, chatType: ConversationTypeValue, text: string, quote?: EmQuoteInfo, mentions?: string[], ext?: Record<string, unknown>): Promise<EmMessageItem> {
    const chatManager = await this.readyChatManager()
    const message = chatManager.createTextMessage({
      conversationId: to,
      conversationType: chatType,
      content: text,
      // 引用挂在消息 ext 上（主 msgQuote + 旧 emQuote 双写），接收方/历史消息解析还原
      ext: buildTextExt(quote, mentions, ext)
    })
    return this.deliver(message, to, text, quote, '', mentions, undefined, ext)
  }

  // 自定义消息（多场景卡片消息的主通道）：event 为业务事件名（宿主自有命名空间），
  // params 为字符串参数表（SDK 协议字段），ext 承载结构化业务载荷；接收侧落 customEvent/customParams/ext。
  // 发送侧同样经 #custom-message 插槽渲染，保证「所见即所发」
  async sendCustom(to: string, chatType: ConversationTypeValue, event: string, params?: Record<string, string>, ext?: Record<string, unknown>): Promise<EmMessageItem> {
    if (event === '') {
      throw new Error('sendCustom: event is required')
    }
    const chatManager = await this.readyChatManager()
    const message = chatManager.createCustomMessage({
      conversationId: to,
      conversationType: chatType,
      event,
      params,
      ext
    })
    return this.deliver(message, to, '', undefined, '', undefined, undefined, ext)
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
    } else if (item.type === MESSAGE_TYPE.CUSTOM) {
      text = t('message.custom')
    } else if (item.type !== MESSAGE_TYPE.TEXT) {
      text = t('message.unsupported')
    }
    const quote: EmQuoteInfo = { msgId: item.id, from: item.from, fromName: displayNameOf(item.from), text: text.slice(0, 50), type: item.type }
    if ((item.type === MESSAGE_TYPE.IMAGE || item.type === MESSAGE_TYPE.VIDEO) && item.thumbUrl !== '') {
      quote.thumbUrl = item.thumbUrl
    }
    return quote
  }

  // SDK 5.x createXxxMessage 的 data 不收字符串路径：H5 要 File 对象，小程序/App 要 MiniAppFile { path, name, size, type }
  private asCompatibleFile(path: string, name: string, size: number, webFile: unknown | null, mimeType = ''): CompatibleFile {
    if (webFile != null) return webFile as CompatibleFile
    // 原生端把 MIME 带进 MiniAppFile.type：宿主附件能力能拿到权威 MIME 时服务端 content-type 更准
    if (mimeType !== '') return { path, name, size, type: mimeType } as CompatibleFile
    return { path, name, size } as CompatibleFile
  }

  // H5 的 chooseVideo 只给 blob URL（不是 File），而 SDK web 上传适配器只接受 File/Blob。
  // 这里把 blob:/data: 取回并包成 File；非 H5 或普通路径返回 null（走 MiniAppFile）。
  // 失败返回 null，交给 SDK 的原路径逻辑报错（不吞错：发送失败会落 FAILED 气泡）。
  private async webFileOf(path: string, name: string): Promise<unknown | null> {
    // #ifdef WEB
    if (path.indexOf('blob:') === 0 || path.indexOf('data:') === 0) {
      try {
        const resp = await fetch(path)
        if (resp == null) return null
        const blob = await resp.blob()
        return new File([blob], name !== '' ? name : 'file', { type: blob.type })
      } catch (e) {
        return null
      }
    }
    // #endif
    return null
  }

  private isRemoteUrl(path: string): boolean {
    return path.indexOf('http://') === 0 || path.indexOf('https://') === 0
  }

  async sendImage(to: string, chatType: ConversationTypeValue, image: EmPickedImage): Promise<EmMessageItem> {
    const chatManager = await this.readyChatManager()
    const message = chatManager.createImageMessage({
      conversationId: to,
      conversationType: chatType,
      data: this.asCompatibleFile(image.path, image.name, image.size, image.webFile),
      filename: image.name
    })
    return this.deliver(message, to, '', undefined, image.path, undefined, image.webFile)
  }

  async sendAudio(to: string, chatType: ConversationTypeValue, filePath: string, duration: number): Promise<EmMessageItem> {
    const chatManager = await this.readyChatManager()
    const name = filePath.slice(filePath.lastIndexOf('/') + 1)
    const message = chatManager.createVoiceMessage({
      conversationId: to,
      conversationType: chatType,
      data: this.asCompatibleFile(filePath, name, 0, null),
      duration
    })
    return this.deliver(message, to, '', undefined, filePath)
  }

  async sendVideo(to: string, chatType: ConversationTypeValue, video: EmPickedVideo): Promise<EmMessageItem> {
    const chatManager = await this.readyChatManager()
    // H5 chooseVideo 只回 blob URL，SDK web 上传需要 File：这里转一次，并留给失败重发复用
    const webFile = await this.webFileOf(video.path, video.name)
    const message = chatManager.createVideoMessage({
      conversationId: to,
      conversationType: chatType,
      data: this.asCompatibleFile(video.path, video.name, video.size, webFile),
      duration: video.duration,
      width: video.width,
      height: video.height
    })
    return this.deliver(message, to, '', undefined, video.path, undefined, webFile)
  }

  async sendFile(to: string, chatType: ConversationTypeValue, file: EmPickedFile): Promise<EmMessageItem> {
    // 先登记再等就绪：即使 SDK 未就绪导致发送未开始，登出/删除时仍能兜底清理临时副本
    this.trackTemporary(file)
    const chatManager = await this.readyChatManager()
    // H5 上传需要 File 对象；小程序/App 走 { path, name, size, type }（MiniAppFile）
    const data = this.asCompatibleFile(file.path, file.name, file.size, file.webFile ?? null, file.mimeType ?? '')
    const message = chatManager.createFileMessage({
      conversationId: to,
      conversationType: chatType,
      data,
      filename: file.name,
      fileSize: file.size
    })
    return this.deliver(message, to, '', undefined, file.path, undefined, file.webFile ?? null)
  }

  // 先落本地 sending 态，sendMessage 后回写 sent/failed；失败保留供重发。
  // 返回 store 代理上的消息项（发送回写后的最终态），供业务事件透出（em-chat-page 的 send emit）
  // localUrl：语音/视频/文件的本地临时路径，SDK 未回写 body.url 时兜底（本地回显/播放/重发用）
  // localFile：H5 的原始 File，发送失败时留在内存供重发（SDK web 上传只认 File/Blob）
  // extraExt：业务 ext，SDK 未随 createXxxMessage 回带时兜底进本地消息（仅补缺，不覆盖内部 key）
  private async deliver(message: Message, to: string, fallbackText: string, quote?: EmQuoteInfo, localUrl = '', mentions?: string[], localFile: unknown | null = null, extraExt?: Record<string, unknown>): Promise<EmMessageItem> {
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
    // 同款兜底：@提及 ext 未随 createTextMessage 回带时补上，保证己方气泡立即高亮
    if (mentions != null && mentions.length > 0 && item.ext[MESSAGE_EXT_KEY.MENTION] == null) {
      item.ext[MESSAGE_EXT_KEY.MENTION] = mentions
    }
    // 业务 ext 兜底：SDK 回带优先，缺的 key 补进来（引用/提及 key 已在上面写过，不覆盖）
    if (extraExt != null) {
      Object.keys(extraExt).forEach((key) => {
        if (item.ext[key] == null) {
          item.ext[key] = extraExt[key]
        }
      })
    }
    this.appendMessage(item)
    this.notify(item)
    if (localFile != null) {
      this.uploadFileByLocalId[item.localId] = localFile
    }
    // 状态回写必须落在 store 的响应式代理上：item 是原始对象，蒸汽（vapor）端
    // 细粒度绑定对原始对象的 mutation 不触发更新（VDOM 端靠整树重渲染掩盖了这点），
    // 真机上会卡在 sending 态。getMessages 经 reactive 数组读取，返回的是代理。
    const stored = getMessages(to).find((m) => m.localId === item.localId) ?? item
    try {
      const sent = await chatManager.sendMessage(message)
      stored.id = sent.msgServerId !== '' ? sent.msgServerId : sent.msgLocalId
      stored.time = sent.timestamp
      stored.status = MESSAGE_STATUS.SENT
      delete this.uploadFileByLocalId[item.localId]
      // 临时副本只在发送成功后清理；失败保留，用户点重发仍能读到同一路径
      this.releaseTemporary(stored.url)
      this.applyMediaBody(stored, sent)
    } catch (e) {
      stored.status = MESSAGE_STATUS.FAILED
      throw e
    }
    return stored
  }

  // 发送成功后把 SDK 回填的 body 元数据写回本地 item（item 是 toMessageItem 的副本）：
  // 不回写会让自发送图片一直用 em-image-message 的 120×160 默认尺寸，视频/封面也不会更新。
  private applyMediaBody(stored: EmMessageItem, sent: Message): void {
    const body = sent.body as unknown as Record<string, unknown> | null | undefined
    if (body == null) return
    const num = (key: string): number => {
      const value = body[key]
      return typeof value === 'number' && value > 0 ? value : 0
    }
    const str = (key: string): string => {
      const value = body[key]
      return typeof value === 'string' ? value : ''
    }
    if (stored.type === MESSAGE_TYPE.IMAGE) {
      const w = num('width')
      const h = num('height')
      if (w > 0 && h > 0) {
        stored.width = w
        stored.height = h
      }
      const full = str('bigImageUrl') !== '' ? str('bigImageUrl') : (str('originalImageUrl') !== '' ? str('originalImageUrl') : str('url'))
      // 本地 blob/临时路径优先保留用于即时预览；只有当前没有可用 URL 时才用服务端地址
      if (stored.url === '' && full !== '') stored.url = full
      const thumb = str('thumbnailUrl')
      if (thumb !== '') stored.thumbUrl = thumb
      return
    }
    if (stored.type === MESSAGE_TYPE.VIDEO) {
      const w = num('width')
      const h = num('height')
      if (w > 0 && h > 0) {
        stored.width = w
        stored.height = h
      }
      const thumb = str('thumbnailUrl')
      if (thumb !== '') stored.thumbUrl = thumb
      return
    }
    if (stored.type === MESSAGE_TYPE.AUDIO) {
      const duration = num('duration')
      if (duration > 0) stored.duration = duration
      return
    }
    if (stored.type === MESSAGE_TYPE.FILE) {
      const size = num('fileSize')
      if (size > 0) stored.fileSize = size
    }
  }

  // 会话页预热与聊天页 onMounted 会对同一会话几乎同时调用 loadHistory；
  // 共享同一 Promise 防止两次请求读到同一 cursor 后各自推进游标、重复拉页。
  loadHistory(conversationId: string, chatType: ConversationTypeValue, pageSize = 20): Promise<void> {
    const inFlight = this.historyPromiseByConversationId[conversationId]
    if (inFlight != null) {
      return inFlight
    }
    const promise = this.doLoadHistory(conversationId, chatType, pageSize)
    this.historyPromiseByConversationId[conversationId] = promise
    return promise.finally(() => {
      if (this.historyPromiseByConversationId[conversationId] === promise) {
        delete this.historyPromiseByConversationId[conversationId]
      }
    })
  }

  private async doLoadHistory(conversationId: string, chatType: ConversationTypeValue, pageSize: number): Promise<void> {
    const epoch = this.sessionEpoch
    const chatManager = await this.readyChatManager()
    // 被内存上限裁过的会话：旧游标指向已丢弃的尾部消息，继续用会跳过被裁段；
    // 丢弃本地缓存与游标，从最新页重新拉；一次拉满保留上限，回会话仍能看到最近 100 条
    let requestPageSize = pageSize
    if (this.trimmedByConversationId[conversationId] === true) {
      delete this.trimmedByConversationId[conversationId]
      messageStore.messagesByConversationId[conversationId] = []
      messageStore.cursorByConversationId[conversationId] = ''
      messageStore.hasMoreByConversationId[conversationId] = true
      requestPageSize = Math.max(pageSize, CONVERSATION_MESSAGE_RETAIN_LIMIT)
    }
    const cursor = messageStore.cursorByConversationId[conversationId] ?? ''
    const page = await chatManager.getHistoryMessages({
      conversationId,
      conversationType: chatType,
      cursor,
      pageSize: requestPageSize,
      searchDirection: 'up'
    })
    // 登出/换账号后回来的旧请求：丢弃，不写游标/消息
    if (epoch !== this.sessionEpoch) return
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

  // 单聊已读回执：批量回执该会话内对端消息（serverId，最多 50 条），对方经 onMessageReadReceipts 收到；
  // 群聊已读回执（groupAck）不在一期范围，群聊调用直接短路
  async sendReadReceipts(conversationId: string, chatType: ConversationTypeValue): Promise<void> {
    if (!this.readReceiptOn) return
    if (chatType !== CONVERSATION_TYPE.SINGLE_CHAT) return
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
      conversationType: chatType,
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
  async sendTyping(conversationId: string, chatType: ConversationTypeValue): Promise<void> {
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
      conversationType: chatType,
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

  async recallMessage(conversationId: string, chatType: ConversationTypeValue, messageId: string): Promise<void> {
    const chatManager = await this.readyChatManager()
    await chatManager.recallMessage({ conversationId, conversationType: chatType, messageId })
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
    delete this.uploadFileByLocalId[localId]
    const list = messageStore.messagesByConversationId[conversationId]
    if (list == null) {
      return
    }
    // 删除失败/本地消息时顺手清掉宿主附件临时副本（发送成功的已在 deliver 清理，重复调用是 no-op）
    const target = list.find((m) => m.localId === localId)
    if (target != null) {
      this.releaseTemporary(target.url)
    }
    messageStore.messagesByConversationId[conversationId] = list.filter((m) => m.localId !== localId)
  }

  // 失败重发：原 Message 对象不入 store，用 item 上留存的内容重建消息再投递；
  // item 原位复用（只改状态/回填 serverId 与 time），列表位置与 quote 快照不动。
  // 注意：图片重发依赖 item.url 里的本地临时路径，跨会话过期后重发会再次失败
  async resendMessage(conversationId: string, chatType: ConversationTypeValue, localId: string): Promise<void> {
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
    const remote = this.isRemoteUrl(item.url)
    const cachedFile = this.uploadFileByLocalId[localId] ?? null
    // 文本/自定义消息没有本地媒体文件，不走媒体可用性校验
    const isTextLike = item.type === MESSAGE_TYPE.TEXT || item.type === MESSAGE_TYPE.CUSTOM
    if (!isTextLike && !remote && item.url === '' && cachedFile == null) {
      // 媒体消息的本地临时文件已被系统清理（或 H5 刷新后丢失）：明确失败，别发一条空消息
      throw new Error('local media file is unavailable')
    }
    const name = item.fileName !== ''
      ? item.fileName
      : (item.url !== '' ? item.url.slice(item.url.lastIndexOf('/') + 1) : 'file')
    if (item.type === MESSAGE_TYPE.IMAGE) {
      message = remote
        ? chatManager.createImageMessage({ conversationId, conversationType: chatType, originalUrl: item.url, filename: name })
        : chatManager.createImageMessage({
          conversationId,
          conversationType: chatType,
          data: this.asCompatibleFile(item.url, name, 0, cachedFile ?? await this.webFileOf(item.url, name)),
          filename: name
        })
    } else if (item.type === MESSAGE_TYPE.AUDIO) {
      message = remote
        ? chatManager.createVoiceMessage({ conversationId, conversationType: chatType, originalUrl: item.url, duration: item.duration })
        : chatManager.createVoiceMessage({
          conversationId,
          conversationType: chatType,
          data: this.asCompatibleFile(item.url, name, 0, null),
          duration: item.duration
        })
    } else if (item.type === MESSAGE_TYPE.VIDEO) {
      message = remote
        ? chatManager.createVideoMessage({
          conversationId,
          conversationType: chatType,
          originalUrl: item.url,
          duration: item.duration,
          width: item.width,
          height: item.height
        })
        : chatManager.createVideoMessage({
          conversationId,
          conversationType: chatType,
          data: this.asCompatibleFile(item.url, name, 0, cachedFile ?? await this.webFileOf(item.url, name)),
          duration: item.duration,
          width: item.width,
          height: item.height
        })
    } else if (item.type === MESSAGE_TYPE.FILE) {
      message = remote
        ? chatManager.createFileMessage({ conversationId, conversationType: chatType, originalUrl: item.url, filename: item.fileName, fileSize: item.fileSize })
        : chatManager.createFileMessage({
          conversationId,
          conversationType: chatType,
          data: this.asCompatibleFile(item.url, item.fileName, item.fileSize, cachedFile ?? await this.webFileOf(item.url, item.fileName)),
          filename: item.fileName,
          fileSize: item.fileSize
        })
    } else if (item.type === MESSAGE_TYPE.CUSTOM) {
      // 自定义消息重发：event/params 从消息体还原，业务 ext 原样带上（引用等内部 key 不适用于 custom）
      message = chatManager.createCustomMessage({
        conversationId,
        conversationType: chatType,
        event: item.customEvent,
        params: Object.keys(item.customParams).length > 0 ? { ...item.customParams } : undefined,
        ext: Object.keys(item.ext).length > 0 ? { ...item.ext } : undefined
      })
    } else if (item.type === MESSAGE_TYPE.TEXT) {
      const quote = item.quote
      // 重发保留 @提及 ext（item.ext 在发送时已兜底写入）与业务 ext（订单/商品/来源页）；
      // 引用（msgQuote/emQuote 双写）与提及内部 key 由 buildTextExt 按快照重建，其余 key 原样透传
      const rawMentions = item.ext[MESSAGE_EXT_KEY.MENTION]
      const mentions = Array.isArray(rawMentions) ? rawMentions.filter((x): x is string => typeof x === 'string') : undefined
      const extraExt: Record<string, unknown> = {}
      Object.keys(item.ext).forEach((key) => {
        if (key !== MESSAGE_EXT_KEY.QUOTE && key !== MESSAGE_EXT_KEY.QUOTE_LEGACY && key !== MESSAGE_EXT_KEY.MENTION) {
          extraExt[key] = item.ext[key]
        }
      })
      message = chatManager.createTextMessage({
        conversationId,
        conversationType: chatType,
        content: item.text,
        ext: buildTextExt(quote != null ? quote : undefined, mentions, extraExt)
      })
    } else {
      // 自定义/系统通知没有重建通道：明确失败，避免旧实现把它们退化成一条空文本
      throw new Error(`resend unsupported message type: ${item.type}`)
    }
    item.status = MESSAGE_STATUS.SENDING
    try {
      const sent = await chatManager.sendMessage(message)
      item.id = sent.msgServerId !== '' ? sent.msgServerId : sent.msgLocalId
      item.time = sent.timestamp
      item.status = MESSAGE_STATUS.SENT
      delete this.uploadFileByLocalId[localId]
      // 重发成功同样释放宿主附件临时副本（失败则保留，允许再次重发）
      this.releaseTemporary(item.url)
      this.applyMediaBody(item, sent)
    } catch (e) {
      item.status = MESSAGE_STATUS.FAILED
      throw e
    }
  }

  /** 追加新消息并返回 store 中的响应式代理（重复 id 返回 null）。
   *  流式链路依赖返回值：原始对象 mutation 在蒸汽端不触发细粒度更新（见 deliver 注释） */
  appendMessage(item: EmMessageItem): EmMessageItem | null {
    const list = getMessages(item.conversationId)
    if (list.some((m) => m.id === item.id && item.id !== '')) {
      return null
    }
    list.push(item)
    // 非当前会话只保留最近 N 条：多群长聊时不会因后台消息无限累积占内存
    if (item.conversationId !== this.activeConversationId) {
      this.trimConversation(item.conversationId)
      const kept = messageStore.messagesByConversationId[item.conversationId]
      return kept[kept.length - 1]
    }
    return list[list.length - 1]
  }

  // 本地系统通知（群事件灰条）：只落本地消息列表并 notify（触发聊天页滚底），不发服务端；
  // id 恒空串（appendMessage 按 id 去重自动跳过），loadHistory 合并保留本地条目
  insertLocalNotice(conversationId: string, chatType: ConversationTypeValue, text: string): void {
    if (text === '') {
      return
    }
    const item: EmMessageItem = {
      id: '',
      localId: `em-notice-${Date.now()}-${nextLocalSeq()}`,
      conversationId,
      chatType,
      type: MESSAGE_TYPE.NOTICE,
      text,
      url: '',
      thumbUrl: '',
      width: 0,
      height: 0,
      time: Date.now(),
      from: connectionStore.userId,
      to: conversationId,
      self: false,
      status: MESSAGE_STATUS.SENT,
      quote: null,
      duration: 0,
      fileName: '',
      fileSize: 0,
      ext: {},
      rawType: '',
      customEvent: '',
      customParams: {}
    }
    this.appendMessage(item)
    this.notify(item)
  }

  toMessageItem(message: Message): EmMessageItem {
    const id = message.msgServerId !== '' ? message.msgServerId : message.msgLocalId
    const item: EmMessageItem = {
      id,
      // 历史/接收消息的 msgLocalId 可能为空：localId 是列表 :key 与滚动锚点的唯一标识，
      // 必须兜底成唯一值，否则 key 撞车、scroll-into-view 定位错乱、高亮匹配全员命中
      localId: message.msgLocalId !== '' ? message.msgLocalId : `em-local-${id !== '' ? id : `${message.timestamp}-${nextLocalSeq()}`}`,
      conversationId: message.conversationId !== '' ? message.conversationId : this.peerOf(message),
      chatType: mapWireChatType(message.conversationType as string),
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
      rawType: '',
      customEvent: '',
      customParams: {}
    }
    // SDK ext 透传给宿主（自定义消息业务载荷的唯一通道；引用 msgQuote/emQuote 等内部 key 原样可见）
    if (message.ext != null && typeof message.ext === 'object') {
      item.ext = { ...(message.ext as Record<string, unknown>) }
    }
    item.quote = parseQuote(message.ext as Record<string, unknown> | null | undefined)
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
    } else if (mtype === 'custom') {
      // 自定义消息：event/params 是 SDK 协议字段，业务结构化载荷走 ext；
      // rawType 仍置 'custom'（旧宿主 rawType 非空判别兼容），新宿主按 customEvent 分发卡片
      item.type = MESSAGE_TYPE.CUSTOM
      item.rawType = mtype
      const body = message.body as CustomMessageBody
      item.customEvent = body.event ?? ''
      item.customParams = body.params != null ? { ...body.params } : {}
    } else {
      // 未识别类型：保留 wire type 原文，宿主经 #custom-message 插槽按 rawType 判别渲染
      item.rawType = mtype
    }
    // 流式元信息（onStreamMessage / 历史中的流式终态消息）：渲染层据此展示光标/异常提示，
    // 宿主经 #stream-message 插槽接管 markdown 等富格式；普通消息保持 undefined
    if (message.stream != null) {
      item.stream = this.toStreamInfo(message.stream)
    }
    return item
  }

  peerOf(message: Message): string {
    return message.from === connectionStore.userId ? message.to : message.from
  }
}
