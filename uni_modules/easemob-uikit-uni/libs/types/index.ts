export type EmConnectionStatus = 'idle' | 'connecting' | 'online' | 'closed'

export interface EmKitConfig {
  appkey: string
}

export interface EmLoginOptions {
  userId: string
  token: string
}

export type EmMessageType = 'text' | 'image' | 'other'

export type EmMessageStatus = 'sending' | 'sent' | 'failed'

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

export type EmThemeMode = 'light' | 'dark'

export type EmLocaleName = 'zh-CN' | 'en'

export type EmAvatarShape = 'circle' | 'square'
