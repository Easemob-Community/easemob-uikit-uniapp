import type {
  ConnectionStatusValue,
  ContactInviteKindValue,
  ContactInviteStatusValue,
  ConversationMenuKeyValue,
  ConversationTypeValue,
  GroupMemberRoleValue,
  LocaleValue,
  LogLevelValue,
  MessageMenuKeyValue,
  MessageStatusValue,
  MessageTypeValue,
  ResolvedThemeModeValue,
  StreamMessageStatusValue,
  ThemeModeValue
} from '../constants'

export type EmConnectionStatus = ConnectionStatusValue

/** 会话类型（单聊/群聊），联合类型自 CONVERSATION_TYPE 常量派生 */
export type EmChatType = ConversationTypeValue

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
  /** 撤回时间窗口（毫秒），默认 120000（2 分钟） */
  recallTimeLimit: number
  /** typing 发送节流间隔（毫秒），默认 5000 */
  typingThrottle: number
  /** typing 展示超时（毫秒），默认 5000 */
  typingTimeout: number
  /** 聊天页时间分隔条间隔（毫秒），默认 300000（5 分钟） */
  timeDividerInterval: number
  /** 流式消息（AI 流式输出）开关，默认 true；关闭后 onStreamMessage 分片不再合并，
   *  等待 SDK 完整消息（onMessage）到达后一次性上屏 */
  enableStreamMessage: boolean
  /** 流式分片合批间隔（毫秒），默认 50；0 = 逐片立即写（高刷演示/调试用） */
  streamThrottle: number
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
  /** 是否把 SDK 原始 payload 写入日志（默认 false；开启后仅 debug 级别采集，仍可能含 userId/昵称等，生产慎用） */
  logPayload: boolean
}

export interface EmKitConfig {
  appkey: string
  /** 单聊已读回执开关，默认 true */
  enableReadReceipt?: boolean
  /** uikit 内置 logger 级别，默认 'info'；'silent' 全关 */
  logLevel?: LogLevelValue
  /** 是否把 SDK 原始 payload 写入日志，默认 false；需同时 logLevel='debug' 才采集，生产环境慎开 */
  logPayload?: boolean
  /** 界面语言（zh-CN/en），默认跟随系统/上次持久化偏好；设置后写入本地并立即生效 */
  locale?: EmLocaleName
  /** SDK 自身 console 输出开关，默认 true（关闭后 SDK 日志仍经 onLog 转发进 uikit logger） */
  sdkConsoleLog?: boolean
  /** SDK 日志级别（SDK 侧枚举，仅三档），默认 'WARN' */
  sdkLogLevel?: 'DEBUG' | 'WARN' | 'ERROR'
  /** 输入栏草稿，默认 true */
  enableDraft?: boolean
  /** typing 信令开关，默认 true */
  enableTyping?: boolean
  /** 撤回时间窗口（毫秒），默认 120000 */
  recallTimeLimit?: number
  /** typing 发送节流间隔（毫秒），默认 5000 */
  typingThrottle?: number
  /** typing 展示超时（毫秒），默认 5000 */
  typingTimeout?: number
  /** 时间分隔条间隔（毫秒），默认 300000 */
  timeDividerInterval?: number
  /** 流式消息开关（AI 流式输出），默认 true；false = 忽略 onStreamMessage 分片，等完整消息上屏 */
  enableStreamMessage?: boolean
  /** 流式分片合批间隔（毫秒），默认 50；0 = 逐片立即写 */
  streamThrottle?: number
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
  /** Token 即将过期（约 80% 生命周期）回调：返回新 token，UIKit 自动 `renewToken`。
   *  不实现时 SDK 会继续用旧 token 直到过期，宿主可随时手动 `EmKit.renewToken(token)` */
  onTokenWillExpire?: () => string | Promise<string>
  /** Token 已过期（SDK 已断开）：宿主可在此跳登录页；UIKit 同时把连接状态置 CLOSED */
  onTokenExpired?: () => void
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

/** Token 续期结果（SDK TokenRenewalResult 的中立子集） */
export interface EmTokenRenewalResult {
  /** 已成功应用的新 token */
  token: string
  /** 过期时间戳（毫秒） */
  expireAt: number
}

export type EmMessageType = MessageTypeValue

export type EmMessageStatus = MessageStatusValue

export interface EmQuoteInfo {
  msgId: string
  from: string
  /** 引用时刻的发送人展示名快照（昵称 > userId）；老数据缺省时消费方回落 from */
  fromName?: string
  text: string   // 引用时刻的快照摘要（文本截断，非文本走 locale 摘要）
  type?: EmMessageType   // 被引用消息类型（非文本用于引用卡类型图标；老数据缺省即无图标）
  /** 被引用图片/视频的缩略图（vue 版 msgThumbUrl；当前 uni 引用卡未渲染，保留给宿主/后续版本） */
  thumbUrl?: string
}

export interface EmMessageItem {
  id: string
  localId: string
  conversationId: string
  chatType: EmChatType
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
  /** 未识别消息类型的 SDK wire type 原文（text/image/audio/video/file/notice 五种内置类型恒为空串；
   *  CUSTOM 为 'custom'（旧宿主用 rawType 非空判别自定义消息仍成立）；
   *  #custom-message 插槽的新判别依据是 customEvent） */
  rawType: string
  /** 自定义消息事件名（wire custom body.event；仅 MESSAGE_TYPE.CUSTOM 非空，插槽按它分发卡片类型） */
  customEvent: string
  /** 自定义消息字符串参数（wire custom body.params；结构化业务载荷优先走 ext，二者都原样透出） */
  customParams: Record<string, string>
  /** 流式消息元信息（M2.13）：仅 SDK 流式消息 / 历史中的流式终态消息携带；
   *  普通消息为 undefined。渲染层按 status 展示打字机光标 / 终态收敛 / 异常提示 */
  stream?: EmStreamInfo
}

/** 流式消息元信息（SDK StreamMessageMeta 的中立子集，字段名与 wire 对齐便于宿主迁移） */
export interface EmStreamInfo {
  /** 业务自定义流类型（如 'text' / 'markdown'）；缺省按纯文本处理 */
  customType: string
  /** 当前分片序号（服务端排序后的序号） */
  seq: number
  /** 流式状态：START/IN_PROGRESS 为传输中；COMPLETED/START_COMPLETED/ERROR 为终态 */
  status: StreamMessageStatusValue
  /** 当前分片新增文本（增量；展示以 fullText 为准，deltaText 供宿主做动画/统计） */
  deltaText: string
  /** 截至当前分片的累计全文（与 message.text 同值；服务端已排序合并） */
  fullText: string
  /** 流式处理错误码，0 = 无错误 */
  errorType: number
  /** 服务端返回的结束原因（SDK 提供时透传） */
  finishReason?: number
}

export type EmMessageHandler = (msg: EmMessageItem) => void

export interface EmConversationItem {
  conversationId: string
  chatType: EmChatType
  name: string
  avatar: string
  unreadCount: number
  lastMessageText: string
  lastMessageTime: number
  isPinned: boolean
  /** 置顶时间戳（毫秒，未置顶为 0）；列表排序用：置顶区间按置顶时间倒序（对齐 vue 版），
   *  进入会话 / 最后消息变化都不改变置顶顺序 */
  pinnedTime: number
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

/** 好友申请/群邀请/通知条目（内存 + uni.setStorage 持久化；好友与群邀请同表，按 kind 分化处理链路） */
export interface EmContactInvite {
  id: string          // 本地生成（from/groupId + ts），幂等合并用
  kind: ContactInviteKindValue  // contact=好友申请，group=群邀请（旧持久化数据无此字段，加载时兜底 contact）
  from: string        // 申请发起方 userId（group kind：incoming=邀请人，outgoing=被邀请人）
  message: string     // 验证/邀请附言，可为空串
  status: ContactInviteStatusValue
  outgoing: boolean   // true = 我方发出的申请被对方处理的通知
  ts: number
  groupId?: string    // group kind 必填：群 id（接受/拒绝群邀请 API 入参）
  groupName?: string  // group kind 群名快照（事件载荷可能缺省，展示走 groupStore 回落链）
}

/** 通讯录入口项（em-contact-nav props；对齐 vue 版 ContactNavEntry） */
export interface EmContactNavEntry {
  key: string         // 入口唯一标识（宿主按 key 接线路由，内置 key 见 CONTACT_ENTRY_KEY）
  label: string
  count?: number      // 计数徽标，>0 才展示
  hot?: boolean       // 红点（仅 count>0 时生效，对齐 vue 语义）
  icon?: string       // em-icon 图标名（可选，缺省不渲染左图标，对齐 vue entry.icon 默认 undefined）
}

/** 主题偏好（auto 跟随系统 / light / dark），宿主设置项 */
export type EmThemePreference = ThemeModeValue

/** 实际生效的明暗主题（themeStore.mode / themeClass 用） */
export type EmThemeMode = ResolvedThemeModeValue

/** 群组条目（SDK GroupDetail/JoinedGroupSummary 的中立子集，wire 字段在 chat 边界归一） */
export interface EmGroup {
  groupId: string
  name: string
  description: string
  /** 群主 userId（成员角色权威来源：memberMap 中该用户恒为 owner） */
  owner: string
  memberCount: number
  maxUsers: number
  avatar?: string
  public: boolean
  /** 入群是否需要管理员审批（wire joinApprovalRequired） */
  approval: boolean
  allowInvites: boolean
  inviteNeedConfirm: boolean
  /** 全员禁言（wire muteAllMembers） */
  mute: boolean
  disabled: boolean
}

/** 群成员条目（SDK GroupMemberEntry 的中立子集） */
export interface EmGroupMember {
  userId: string
  role: GroupMemberRoleValue
  /** 入群时间戳，缺失为 0（排序时排同角色末尾） */
  joinedAt: number
  nick?: string
  avatar?: string
}

/** 创建群组参数（群 domain createGroup 入参，wire 映射在 domain 边界完成） */
export interface CreateGroupParams {
  name: string
  description?: string
  /** 初始成员 userId 列表（不含创建者） */
  members?: string[]
  public?: boolean
  /** 入群是否需要管理员审批（映射 wire joinApprovalRequired） */
  approval?: boolean
  allowInvites?: boolean
  inviteNeedConfirm?: boolean
  maxMembers?: number
}

/** @提及联系人（输入栏 mention 候选与发送前 filterActiveMentions 的条目形态） */
export interface MentionContact {
  userId: string
  name: string
  avatar?: string
}

/** em-select-contact 选人条目（父组件装配好的展示数据：userId/展示名/avatar） */
export interface EmSelectContactItem {
  userId: string
  name: string
  avatar: string
}

export type EmLocaleName = LocaleValue

export type EmAvatarShape = 'circle' | 'square'

/** 群聊气泡上方发送者昵称行模式（伪装模式二期加 'on-change' 档） */
export type EmSenderNameMode = 'always' | 'hidden'

export interface EmActionSheetAction {
  key: string
  text: string
  icon?: string       // em-icon 图标名（EmIconName 字符串）
  danger?: boolean
  disabled?: boolean
}

/** 消息长按菜单的业务追加动作（em-chat-page extraMessageMenus，M2.12） */
export interface EmMessageMenuExtra extends EmActionSheetAction {
  /** 只在指定消息类型上出现（缺省全部；NOTICE 本地灰条恒不出现） */
  types?: EmMessageType[]
}

/** 快捷回复条目（em-quick-reply-bar / em-chat-page.quickReplies，M2.12） */
export interface EmQuickReply {
  /** 芯片展示文案 */
  label: string
  /** 点击后填入/发送的文本，缺省用 label（label 短、text 长时分开配） */
  text?: string
}

/** 快捷回复点击行为：fill=替换当前草稿（默认，用户可编辑后再发）；send=直接发送 */
export type EmQuickReplyMode = 'fill' | 'send'
