import type {
  ConnectionStatusValue,
  LocaleValue,
  MessageStatusValue,
  MessageTypeValue,
  ThemeModeValue
} from '../constants'

export type EmConnectionStatus = ConnectionStatusValue

export interface EmKitConfig {
  appkey: string
}

export interface EmLoginOptions {
  userId: string
  token: string
}

export type EmMessageType = MessageTypeValue

export type EmMessageStatus = MessageStatusValue

export interface EmQuoteInfo {
  msgId: string
  from: string
  text: string   // 引用时刻的快照摘要（文本截断，非文本走 locale 摘要）
  type?: EmMessageType   // 被引用消息类型（非文本用于引用卡类型图标；老数据缺省即无图标）
}

export interface EmMessageItem {
  id: string
  localId: string
  conversationId: string
  type: EmMessageType
  text: string
  url: string
  thumbUrl: string
  width: number
  height: number
  time: number
  from: string
  to: string
  self: boolean
  status: EmMessageStatus
  quote: EmQuoteInfo | null
  duration: number   // 秒，语音/视频消息用
  fileName: string   // 文件消息文件名
  fileSize: number   // 文件消息大小（字节）
}

/** @deprecated 保留兼容 spike 页，等价于 EmMessageItem */
export type EmTextMessageItem = EmMessageItem

export type EmMessageHandler = (msg: EmMessageItem) => void

/** @deprecated 保留兼容 spike 页 */
export type EmTextMessageHandler = EmMessageHandler

export interface EmConversationItem {
  conversationId: string
  name: string
  avatar: string
  unreadCount: number
  lastMessageText: string
  lastMessageTime: number
  isPinned: boolean
  isMuted: boolean
}

export type EmThemeMode = ThemeModeValue

export type EmLocaleName = LocaleValue

export type EmAvatarShape = 'circle' | 'square'

export interface EmActionSheetAction {
  key: string
  text: string
  icon?: string       // em-icon 图标名（EmIconName 字符串）
  danger?: boolean
  disabled?: boolean
}
