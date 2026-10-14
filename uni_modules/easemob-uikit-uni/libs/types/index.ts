import type {
  ConnectionStatusValue,
  ContactInviteStatusValue,
  LocaleValue,
  LogLevelValue,
  MessageStatusValue,
  MessageTypeValue,
  ThemeModeValue
} from '../constants'

export type EmConnectionStatus = ConnectionStatusValue

export interface EmKitConfig {
  appkey: string
  /** 单聊已读回执开关，默认 true */
  enableReadReceipt?: boolean
  /** uikit 内置 logger 级别，默认 'info'；'silent' 全关 */
  logLevel?: LogLevelValue
  /** SDK 自身 console 输出开关，默认 true（关闭后 SDK 日志仍经 onLog 转发进 uikit logger） */
  sdkConsoleLog?: boolean
  /** SDK 日志级别（SDK 侧枚举，仅三档），默认 'WARN' */
  sdkLogLevel?: 'DEBUG' | 'WARN' | 'ERROR'
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

/** 用户属性快照（昵称/头像；SDK UserInfo 的中立子集，wire 字段在 chat 边界归一） */
export interface EmUserInfo {
  userId: string
  nickname: string
  avatarUrl: string
}

/** 联系人条目（SDK Contact 的中立子集，wire 字段在 chat 边界归一） */
export interface EmContactItem {
  userId: string
  remark: string      // 己方给该好友的备注，空串即未设置
  nickname: string    // 好友资料昵称快照（来自 Contact.userInfo，同时并入 userStore）
  avatarUrl: string
  addTs: number       // 好友关系建立时间戳
}

/** 好友申请/通知条目（内存 + uni.setStorage 持久化未处理项） */
export interface EmContactInvite {
  id: string          // 本地生成（from + ts），幂等合并用
  from: string        // 申请发起方 userId
  message: string     // 验证附言，可为空串
  status: ContactInviteStatusValue
  outgoing: boolean   // true = 我方发出的申请被对方拒绝的通知
  ts: number
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
