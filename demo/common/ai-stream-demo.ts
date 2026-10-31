// Demo 参考实现 —— AI 流式消息模拟器（M2.13）。
//
// 用途：
// 1. 在真实聊天页注入一条「AI 助手」流式回复，演示内核链路与视觉效果；
// 2. 样式实验室的流式气泡演示（不依赖 SDK/会话）。
//
// 说明：真实环境由 SDK `onStreamMessage` 事件驱动（libs/chat/message.ts 已按 msgServerId
// 合批合并），本模拟器只向 messageStore 注入分片，走与真实流式一致的 store/渲染链路。
// 关闭 `enableStreamMessage` 时按完整消息一次性注入，模拟「流关闭后等完整消息上屏」的行为。
import { EmKit, MESSAGE_STATUS, MESSAGE_TYPE, STREAM_MESSAGE_STATUS, mergeUserInfo, useConfig } from '@/uni_modules/easemob-uikit-uni/libs'
import type { ConversationTypeValue, EmMessageItem, EmStreamInfo } from '@/uni_modules/easemob-uikit-uni/libs'

/** Mock AI 助手身份 */
export const AI_ASSISTANT_ID = 'ai_assistant'
export const AI_ASSISTANT_NICKNAME = 'AI 助手'

/** 聊天页「AI 演示」浮钮总开关（仅 demo 工程）：不需要时置 false 或整段删除入口 */
// 2026-10-29 截图窗口临时关闭：浮钮压在底部气泡/媒体面板上（RD-04），出图后再定是修偏移还是恢复。
export const AI_STREAM_FAB_VISIBLE = false

export type MockStreamEnd = 'completed' | 'error'

export interface MockStreamOptions {
  content: string
  /** 每次回调推进的字符数，默认 6 */
  chunkSize?: number
  /** 分片间隔 ms，默认 60 */
  intervalMs?: number
  /** 结束状态：completed（默认）| error（演示异常态） */
  endStatus?: MockStreamEnd
}

export interface MockStreamChunk {
  fullText: string
  stream: EmStreamInfo
}

/**
 * 通用分片模拟器（与 SDK 语义对齐）：先回调 START（空全文），随后逐片回调
 * IN_PROGRESS，最后回调终态 COMPLETED / START_COMPLETED / ERROR。
 * 返回取消函数（可中止）。
 */
export function startMockStream(
  options: MockStreamOptions,
  onChunk: (chunk: MockStreamChunk) => void
): () => void {
  const {
    content,
    chunkSize = 6,
    intervalMs = 60,
    endStatus = 'completed'
  } = options

  const chunks: string[] = []
  for (let i = 0; i < content.length; i += chunkSize) {
    chunks.push(content.slice(i, i + chunkSize))
  }
  if (chunks.length === 0) {
    chunks.push('')
  }

  let seq = 0
  let fullText = ''

  const emit = (status: EmStreamInfo['status'], deltaText: string): void => {
    const stream: EmStreamInfo = {
      customType: 'text',
      seq,
      status,
      deltaText,
      fullText,
      errorType: status === STREAM_MESSAGE_STATUS.ERROR ? 1 : 0
    }
    onChunk({ fullText, stream })
  }

  emit(STREAM_MESSAGE_STATUS.START, '')

  const timer = setInterval(() => {
    const deltaText = chunks[seq] ?? ''
    fullText += deltaText
    const isLast = seq >= chunks.length - 1
    if (isLast) {
      const status = endStatus === 'error'
        ? STREAM_MESSAGE_STATUS.ERROR
        : (chunks.length === 1 ? STREAM_MESSAGE_STATUS.START_COMPLETED : STREAM_MESSAGE_STATUS.COMPLETED)
      emit(status, deltaText)
      clearInterval(timer)
    } else {
      emit(STREAM_MESSAGE_STATUS.IN_PROGRESS, deltaText)
    }
    seq += 1
  }, intervalMs)

  return () => clearInterval(timer)
}

/** 构造一条「AI 助手」消息骨架（流式字段由调用方按分片回写；text 初始为空） */
export function buildAiMessage(conversationId: string, chatType: ConversationTypeValue, to: string): EmMessageItem {
  mergeUserInfo({ userId: AI_ASSISTANT_ID, nickname: AI_ASSISTANT_NICKNAME, avatarUrl: '' })
  return {
    id: '',
    localId: `demo-ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    chatType,
    type: MESSAGE_TYPE.TEXT,
    text: '',
    url: '',
    thumbUrl: '',
    width: 0,
    height: 0,
    time: Date.now(),
    from: AI_ASSISTANT_ID,
    to,
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
}

/**
 * 在指定会话注入一条 mock AI 流式回复。
 * 返回取消函数（页面 onUnload 调用，防切页后计时器继续写 store）。
 */
export function runMockAiStream(
  options: { conversationId: string, chatType: ConversationTypeValue } & MockStreamOptions
): () => void {
  const { conversationId, chatType, content } = options
  const { config } = useConfig()
  const userId = EmKit.state.userId
  const message = buildAiMessage(conversationId, chatType, userId)
  const store = EmKit.messages
  if (store.messagesByConversationId[conversationId] == null) {
    store.messagesByConversationId[conversationId] = []
  }

  // 流式关闭：按普通完整文本消息注入（真实链路会等 SDK onMessage 完整消息到达）
  if (!config.enableStreamMessage) {
    message.text = content
    store.messagesByConversationId[conversationId].push(message)
    return () => {}
  }

  message.stream = {
    customType: 'text',
    seq: 0,
    status: STREAM_MESSAGE_STATUS.START,
    deltaText: '',
    fullText: '',
    errorType: 0
  }
  const list = store.messagesByConversationId[conversationId]
  list.push(message)
  // 取回 reactive 数组里的代理：蒸汽端对原始对象 mutation 不触发更新
  const stored = list[list.length - 1]

  return startMockStream(options, (chunk) => {
    stored.text = chunk.fullText
    stored.stream = chunk.stream
  })
}

/** 演示文案：客服/订单查询场景，覆盖多段文本与换行 */
export const AI_STREAM_DEMO_CONTENT = `你好，我是 AI 客服助手 👋

已收到你的问题，正在为你查询订单状态：

1. 订单号：EM20261020001
2. 当前状态：已发货（顺丰 SF1234567890）
3. 预计送达：今天 18:00 前

> 如需修改收货地址，请直接回复新的地址；需要人工客服请回复「人工」。

还有什么可以帮你？`

/** 异常演示文案：生成到一半以 STREAM_ERROR 结束 */
export const AI_STREAM_ERROR_CONTENT = '前两行正常生成，随后服务端流式处理中断……'
