// 枚举字符串单一真相源（const 对象 + 类型别名模式，对齐 vue 版 src/constants 规范）：
// 业务代码禁止硬编码下列字面量，一律从此处取。
// 例外：SDK wire 协议字段的兼容映射（5.x 'image'/'voice' vs 4.x 遗风 'img'/'audio'、
// PushManager 的 remindType 等 SDK 侧枚举）保留字面量，集中在 libs/chat 的 toMessageItem/summaryOf 边界。

export const MESSAGE_TYPE = {
  TEXT: 'text',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  FILE: 'file',
  OTHER: 'other'
} as const

export type MessageTypeValue = (typeof MESSAGE_TYPE)[keyof typeof MESSAGE_TYPE]

export const MESSAGE_STATUS = {
  SENDING: 'sending',
  SENT: 'sent',
  FAILED: 'failed',
  RECALLED: 'recalled'
} as const

export type MessageStatusValue = (typeof MESSAGE_STATUS)[keyof typeof MESSAGE_STATUS]

export const CONVERSATION_TYPE = {
  SINGLE_CHAT: 'singleChat',
  GROUP_CHAT: 'groupChat'   // 预留，一期仅单聊
} as const

export type ConversationTypeValue = (typeof CONVERSATION_TYPE)[keyof typeof CONVERSATION_TYPE]

/** 消息 ext 自定义 key */
export const MESSAGE_EXT_KEY = {
  QUOTE: 'emQuote'
} as const

export type MessageExtKeyValue = (typeof MESSAGE_EXT_KEY)[keyof typeof MESSAGE_EXT_KEY]

/** cmd 信号消息的 action 名（UIKit 应用层协议，与 vue 版对齐以便跨端互认） */
export const CMD_ACTION = {
  TYPING_BEGIN: 'TypingBegin'
} as const

export type CmdActionValue = (typeof CMD_ACTION)[keyof typeof CMD_ACTION]

export const CONNECTION_STATUS = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  ONLINE: 'online',
  CLOSED: 'closed'
} as const

export type ConnectionStatusValue = (typeof CONNECTION_STATUS)[keyof typeof CONNECTION_STATUS]

export const THEME_MODE = {
  LIGHT: 'light',
  DARK: 'dark'
} as const

export type ThemeModeValue = (typeof THEME_MODE)[keyof typeof THEME_MODE]

export const LOCALE = {
  ZH_CN: 'zh-CN',
  EN: 'en'
} as const

export type LocaleValue = (typeof LOCALE)[keyof typeof LOCALE]

/** 会话页菜单 action key（加号面板 + 会话长按） */
export const CONVERSATION_MENU_KEY = {
  NEW_CHAT: 'new-chat',
  PIN: 'pin',
  MUTE: 'mute',
  DELETE: 'delete'
} as const

export type ConversationMenuKeyValue = (typeof CONVERSATION_MENU_KEY)[keyof typeof CONVERSATION_MENU_KEY]

/** 聊天页消息长按菜单 action key */
export const MESSAGE_MENU_KEY = {
  COPY: 'copy',
  QUOTE: 'quote',
  RECALL: 'recall',
  DELETE: 'delete'
} as const

export type MessageMenuKeyValue = (typeof MESSAGE_MENU_KEY)[keyof typeof MESSAGE_MENU_KEY]

/** 输入栏「+」媒体面板 action key */
export const MEDIA_PANEL_KEY = {
  ALBUM: 'album',
  CAMERA: 'camera',
  VIDEO: 'video',
  FILE: 'file',
  VOICE: 'voice'
} as const

export type MediaPanelKeyValue = (typeof MEDIA_PANEL_KEY)[keyof typeof MEDIA_PANEL_KEY]
