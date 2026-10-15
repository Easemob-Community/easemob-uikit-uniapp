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
  QUOTE: 'emQuote',
  // @提及列表（userId 数组）：与 vue 版同 key，跨 UIKit 互认
  MENTION: 'em_at_list'
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

/** uikit 内置 logger 级别（silent 全关） */
export const LOG_LEVEL = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  SILENT: 'silent'
} as const

export type LogLevelValue = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL]

/** 会话页菜单 action key（加号面板 + 会话长按） */
export const CONVERSATION_MENU_KEY = {
  NEW_CHAT: 'new-chat',
  CREATE_GROUP: 'create-group',
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

/** 聊天页时间分隔条：相邻消息间隔超过该值插入时间条（对齐 vue 版 messageListConfig.groupInterval 默认 5 分钟） */
export const TIME_DIVIDER_INTERVAL = 5 * 60 * 1000

/** 消息撤回时间窗口（毫秒，2 分钟；超出后长按菜单不出现撤回项，对齐 vue 版 recallTimeLimit 默认 2min） */
export const RECALL_TIME_LIMIT = 2 * 60 * 1000

/** typing 信号：发送节流间隔（同一会话内该间隔最多发一条 cmd），对齐 vue 版 5s */
export const TYPING_THROTTLE = 5 * 1000

/** typing 信号：接收方「正在输入」展示超时（超时未续即清除），对齐 vue 版 5s */
export const TYPING_TIMEOUT = 5 * 1000

/** 输入栏底部面板（emoji/媒体）最小高度 px：对齐 vue 版 panelHeightVar 兜底 280px；
 * 曾测得真实键盘高度高于此值时面板高度跟随键盘，键盘↔面板互切无跳变 */
export const PANEL_MIN_HEIGHT = 280

/** 输入栏「+」媒体面板 action key */
export const MEDIA_PANEL_KEY = {
  ALBUM: 'album',
  CAMERA: 'camera',
  VIDEO: 'video',
  FILE: 'file',
  VOICE: 'voice'
} as const

export type MediaPanelKeyValue = (typeof MEDIA_PANEL_KEY)[keyof typeof MEDIA_PANEL_KEY]

/** 联系人页菜单 action key（条目长按） */
export const CONTACT_MENU_KEY = {
  DELETE: 'delete'
} as const

export type ContactMenuKeyValue = (typeof CONTACT_MENU_KEY)[keyof typeof CONTACT_MENU_KEY]

/** 好友申请状态 */
export const CONTACT_INVITE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined'
} as const

export type ContactInviteStatusValue = (typeof CONTACT_INVITE_STATUS)[keyof typeof CONTACT_INVITE_STATUS]

/** 群成员角色（对齐 websdk GroupRole 与 vue 版 GROUP_MEMBER_ROLE） */
export const GROUP_MEMBER_ROLE = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member'
} as const

export type GroupMemberRoleValue = (typeof GROUP_MEMBER_ROLE)[keyof typeof GROUP_MEMBER_ROLE]

/** 群成员宫格首屏格数（聊天详情页成员九宫格，含加/减操作格前的成员展示上限） */
export const GROUP_MEMBER_GRID_COUNT = 9

/** 群成员游标分页每页条数 */
export const GROUP_MEMBER_PAGE_SIZE = 20

/** 群公告最大长度（对齐 vue 版 GROUP_INFO_LIMIT.ANNOUNCEMENT_MAX_LENGTH = 512，跨 UIKit 校验口径一致） */
export const GROUP_ANNOUNCEMENT_MAX_LENGTH = 512

/** 群名称最大长度（对齐 vue 版 GROUP_INFO_LIMIT.NAME_MAX_LENGTH = 255） */
export const GROUP_NAME_MAX_LENGTH = 255

/** em-select-contact 选择模式 */
export const SELECT_CONTACT_MODE = {
  SINGLE: 'single',
  MULTIPLE: 'multiple'
} as const

export type SelectContactModeValue = (typeof SELECT_CONTACT_MODE)[keyof typeof SELECT_CONTACT_MODE]

/** em-load-more 触底加载 footer 三态 */
export const LOAD_MORE_STATE = {
  LOADING: 'loading',
  NO_MORE: 'noMore',
  BUTTON: 'button'
} as const

export type LoadMoreStateValue = (typeof LOAD_MORE_STATE)[keyof typeof LOAD_MORE_STATE]

/** 联系人字母分组序列（A-Z + #，对齐 vue 版 DEFAULT_ALPHABET_KEYS） */
export const ALPHABET_KEYS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
  'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '#'
] as const

/** 内置 emoji 字符集：vue 版 EMOJI_ALL（uikit-core emoji-picker）前 96 个，一期单面板无 tab 分页。
 *  config 默认值来源（uiConfig.emojiList），运行时经 EmKitConfig.emojiList / setConfig 覆盖 */
export const DEFAULT_EMOJI_LIST: string[] = [
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
  '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
  '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕',
  '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟', '🙁',
  '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞',
  '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺'
]
