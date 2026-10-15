import type {
  ConnectionStatusValue,
  ContactInviteStatusValue,
  ConversationMenuKeyValue,
  LocaleValue,
  LogLevelValue,
  MessageMenuKeyValue,
  MessageStatusValue,
  MessageTypeValue,
  ThemeModeValue
} from '../constants'

export type EmConnectionStatus = ConnectionStatusValue

/** 输入栏功能集（resolved 形态，全量布尔；EmKitConfig.inputFeatures 为其可选子集） */
export interface EmInputFeatures {
  voice: boolean
  emoji: boolean
  image: boolean
  camera: boolean
  video: boolean
  file: boolean
}

/** uiConfig 运行时形态：EmKitConfig 的 UI 行为维度解析到全量默认值之后的 store 形态（libs/store/config.ts） */
export interface EmUiConfig {
  /** 输入栏草稿，默认 true */
  enableDraft: boolean
  /** typing 信令（发送节流 + 接收展示），默认 true */
  enableTyping: boolean
  /** 气泡下逐条时间（对齐 vue 版 showTime，默认 false；uni 一期时间只走分隔条，无逐条时间渲染） */
  showTime: boolean
  /** 撤回时间窗口（毫秒），默认 120000（2 分钟） */
  recallTimeLimit: number
  /** typing 发送节流间隔（毫秒），默认 5000 */
  typingThrottle: number
  /** typing 展示超时（毫秒），默认 5000 */
  typingTimeout: number
  /** 聊天页时间分隔条间隔（毫秒），默认 300000（5 分钟） */
  timeDividerInterval: number
  /** 输入栏功能集，默认全开 */
  inputFeatures: EmInputFeatures
  /** 消息长按菜单项与顺序，默认 copy/quote/recall/delete 全量 */
  messageMenuKeys: MessageMenuKeyValue[]
  /** 会话长按菜单项与顺序，默认 pin/mute/delete 全量 */
  conversationMenuKeys: ConversationMenuKeyValue[]
  /** emoji 面板字符集，默认内置 96（constants DEFAULT_EMOJI_LIST） */
  emojiList: string[]
  /** 品牌色覆盖（init 时落 --em-primary-color），空串 = 用 token 默认 */
  primaryColor: string
}

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
  /** 输入栏草稿，默认 true */
  enableDraft?: boolean
  /** typing 信令开关，默认 true */
  enableTyping?: boolean
  /** 气泡下逐条时间，默认 false（uni 一期无逐条时间渲染，仅入配置面） */
  showTime?: boolean
  /** 撤回时间窗口（毫秒），默认 120000 */
  recallTimeLimit?: number
  /** typing 发送节流间隔（毫秒），默认 5000 */
  typingThrottle?: number
  /** typing 展示超时（毫秒），默认 5000 */
  typingTimeout?: number
  /** 时间分隔条间隔（毫秒），默认 300000 */
  timeDividerInterval?: number
  /** 输入栏功能集（缺项保持默认开），默认全开 */
  inputFeatures?: Partial<EmInputFeatures>
  /** 消息长按菜单项与顺序，默认四项全量 */
  messageMenuKeys?: MessageMenuKeyValue[]
  /** 会话长按菜单项与顺序，默认 pin/mute/delete 全量 */
  conversationMenuKeys?: ConversationMenuKeyValue[]
  /** emoji 面板字符集注入，默认内置 96 */
  emojiList?: string[]
  /** 品牌色（合法 CSS 颜色值），init 时写 --em-primary-color；不传用 token 默认 */
  primaryColor?: string
  /** 小程序端 SDK 异步加载器注入（分包异步化，PLAN.md M2.8）：resolve websdk 根导出（允许 { default } 包装）。
   *  仅 MP-WEIXIN 生效；缺省由 UIKit 经跨分包 require 从 sub-sdk 分包自加载。其它端忽略（静态导入直通） */
  sdkLoader?: () => Promise<unknown>
  /** 宿主已自行加载好的 SDK 模块注入（与 sdkLoader 二选一，模块优先）；仅 MP-WEIXIN 生效 */
  sdkModule?: unknown
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
  /** SDK 消息 ext 透传（自定义消息的业务载荷挂这里；发送方的引用等内部 key 也原样可见，宿主只读勿改） */
  ext: Record<string, unknown>
  /** 未识别消息类型的 SDK wire type 原文（text/image/voice/video/file 五种内置类型恒为空串；
   *  #custom-message 插槽的判别依据：rawType 非空即自定义消息） */
  rawType: string
}

export type EmMessageHandler = (msg: EmMessageItem) => void

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
