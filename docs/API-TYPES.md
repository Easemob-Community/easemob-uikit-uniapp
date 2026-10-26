# 类型与常量

所有公开类型和常量都从 `@/uni_modules/easemob-uikit-uni/libs` 导出：

```ts
import {
  MESSAGE_TYPE,
  MESSAGE_STATUS,
  CONVERSATION_TYPE,
  type EmMessageItem,
  type EmConversationItem
} from '@/uni_modules/easemob-uikit-uni/libs'
```

类型定义在 `libs/types/index.ts`，枚举/常量在 `libs/constants/index.ts`。业务代码应使用常量而不是硬编码字符串。

## 1. 消息

### `EmMessageItem`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 服务端消息 ID（发送前可能为空） |
| `localId` | `string` | 本地唯一 ID，列表 key 与重发/引用定位使用 |
| `conversationId` | `string` | 所属会话 ID（单聊为对端 userId，群聊为 groupId） |
| `chatType` | `EmChatType` | `singleChat` / `groupChat` |
| `type` | `EmMessageType` | 见 `MESSAGE_TYPE` |
| `text` | `string` | 文本内容；流式消息为当前累计全文 |
| `url` | `string` | 图片/语音/视频/文件地址 |
| `thumbUrl` | `string` | 缩略图/封面地址 |
| `width` / `height` | `number` | 图片/视频尺寸（未知为 0） |
| `time` | `number` | 消息时间戳（毫秒） |
| `from` / `to` | `string` | 发送方 / 接收方 |
| `self` | `boolean` | 是否本人发送 |
| `status` | `EmMessageStatus` | `sending` / `sent` / `failed` / `recalled` |
| `quote` | `EmQuoteInfo \| null` | 引用快照 |
| `duration` | `number` | 语音/视频时长（秒） |
| `fileName` | `string` | 文件消息文件名 |
| `fileSize` | `number` | 文件大小（字节） |
| `ext` | `Record<string, unknown>` | SDK ext 透传；自定义消息业务载荷也在这里 |
| `rawType` | `string` | 未识别 wire 类型原文；`custom` 消息为 `'custom'` |
| `customEvent` | `string` | 自定义消息事件名，`#custom-message` 按它分发 |
| `customParams` | `Record<string, string>` | 自定义消息字符串参数 |
| `stream` | `EmStreamInfo \| undefined` | 流式消息元信息，普通消息为 `undefined` |
| `modifiedInfo` | `EmMessageModifiedInfo \| undefined` | 编辑元信息，被编辑过（含历史拉取）即存在，文本气泡据此显示「已编辑」 |
| `pinned` | `boolean \| undefined` | 是否被置顶，由置顶列表同步打标 |
| `recalledBy` | `string \| undefined` | 撤回操作者 userId；本地撤回有值，远程撤回事件服务端不下发操作者时为 `undefined` |
| `failCode` | `number \| string \| undefined` | 最近一次发送失败的归因码：SDK 数字 code（如 `1200` 审核未通过、`501` 违规内容、`222` 被对方拒收）或 `ERROR_CODE` 业务码；发送成功后清空 |
| `contentReplaced` | `boolean \| undefined` | 内容被审核替换（SDK `isContentReplaced`），气泡下方展示「内容已被审核修改」标识 |
| `delivered` | `boolean \| undefined` | 单聊消息已送达对端（`onMessageDelivered` 命中）；已读展示仍以已读回执时间为准 |
| `uploadProgress` | `number \| undefined` | 附件上传进度百分比（0-100），图片/语音/视频/文件发送中由 SDK `onFileUploadProgress` 回填；发送结束后清空 |
| `groupReadCount` | `number \| undefined` | 群聊己方消息已读人数（`enableGroupReadReceipt` 开启时由群回执事件或批量查询回填） |

### `EmMessageStatusPresentation`

发送状态呈现配置（`EmKitConfig.messageStatus` / `EmUiConfig.messageStatus`），只改变呈现形式，不改变状态判定。

| 字段 | 类型 | 说明 |
|---|---|---|
| `position` | `'left' \| 'right'` | 状态列相对气泡的位置，默认 `left` |
| `icons` | `Partial<Record<EmMessageStatusKind, string>>` | 按状态覆盖图标名（`EmIconName`），非法名回落内置图标 |
| `texts` | `Partial<Record<EmMessageStatusKind, string>>` | 按状态追加短文案，空串/缺省不渲染 |

`EmMessageStatusKind` = `'sending' | 'failed' | 'unread' | 'read'`。

### `EmMessageModifiedInfo`

| 字段 | 类型 | 说明 |
|---|---|---|
| `operatorId` | `string` | 编辑操作者 userId |
| `operationCount` | `number` | 已编辑次数（单条上限 10 次） |
| `operationTime` | `number` | 最近一次编辑时间戳（毫秒） |

### `EmPinnedMessageItem` / `EmPinnedRow`

置顶消息条目（`messageStore.pinnedByConversationId` 的元素类型）与置顶条展示行。

| 字段 | 类型 | 说明 |
|---|---|---|
| `message` | `EmMessageItem` | 被置顶消息（已过归一化） |
| `pinnedAt` | `number` | 置顶时间戳（毫秒），列表按倒序排列 |
| `operatorId` | `string` | 置顶操作者 userId |

`EmPinnedRow` = `{ id: string; preview: string; item: EmPinnedMessageItem }`，预览文本由 `em-chat-page` 预计算（发送者展示名 + 摘要截断），`em-pinned-bar` 纯展示消费。

### `EmQuoteInfo`

| 字段 | 类型 | 说明 |
|---|---|---|
| `msgId` | `string` | 被引用消息 ID |
| `from` | `string` | 被引用消息发送人 userId |
| `fromName` | `string` | 引用时刻的展示名快照；缺省时消费方回落 `from` |
| `text` | `string` | 引用摘要 |
| `type` | `EmMessageType` | 被引用消息类型（用于引用卡类型图标） |
| `thumbUrl` | `string` | 图片/视频缩略图（可选） |

### `EmStreamInfo`

| 字段 | 类型 | 说明 |
|---|---|---|
| `customType` | `string` | 业务流类型，如 `text` / `markdown` |
| `seq` | `number` | 分片序号（服务端排序后） |
| `status` | `EmStreamStatus` | 见 `STREAM_MESSAGE_STATUS` |
| `deltaText` | `string` | 当前分片新增文本 |
| `fullText` | `string` | 截至当前分片的累计全文，与 `message.text` 同值 |
| `errorType` | `number` | 流式错误码，0 表示无 |
| `finishReason` | `number` | 服务端结束原因（可选） |

### `MESSAGE_TYPE`

| 常量 | 值 | 说明 |
|---|---|---|
| `MESSAGE_TYPE.TEXT` | `text` | 文本 |
| `MESSAGE_TYPE.IMAGE` | `image` | 图片 |
| `MESSAGE_TYPE.AUDIO` | `audio` | 语音 |
| `MESSAGE_TYPE.VIDEO` | `video` | 视频 |
| `MESSAGE_TYPE.FILE` | `file` | 文件 |
| `MESSAGE_TYPE.CUSTOM` | `custom` | 自定义消息 |
| `MESSAGE_TYPE.NOTICE` | `notice` | 本地系统提示（不发送服务端） |
| `MESSAGE_TYPE.OTHER` | `other` | 未识别类型 |

### `MESSAGE_STATUS`

`SENDING` / `SENT` / `FAILED` / `RECALLED`。

### `STREAM_MESSAGE_STATUS`

| 常量 | 说明 |
|---|---|
| `STREAM_MESSAGE_STATUS.START` | 流开始 |
| `STREAM_MESSAGE_STATUS.IN_PROGRESS` | 传输中 |
| `STREAM_MESSAGE_STATUS.START_COMPLETED` | 单分片完成（终态） |
| `STREAM_MESSAGE_STATUS.COMPLETED` | 完成（终态） |
| `STREAM_MESSAGE_STATUS.ERROR` | 异常结束（终态） |

`STREAM_CUSTOM_TYPE.TEXT` / `STREAM_CUSTOM_TYPE.MARKDOWN` 是内置的流式业务类型常量。

### `MESSAGE_EXT_KEY`

| 常量 | 值 | 说明 |
|---|---|---|
| `QUOTE` | `msgQuote` | 引用协议主 key，与 vue 版 UIKit 互通 |
| `QUOTE_LEGACY` | `emQuote` | 旧版兼容 key，仅接收旧消息/发送时双写 |
| `MENTION` | `em_at_list` | @ 提及 userId 数组 |

业务 ext 不要占用以上 key；发送时 UIKit 会覆盖。

## 2. 会话

### `EmConversationItem`

| 字段 | 类型 | 说明 |
|---|---|---|
| `conversationId` | `string` | 会话 ID |
| `chatType` | `EmChatType` | 单聊/群聊 |
| `name` | `string` | 会话名称快照 |
| `avatar` | `string` | 会话头像快照 |
| `unreadCount` | `number` | 未读数 |
| `lastMessageText` | `string` | 最后一条消息摘要 |
| `lastMessageTime` | `number` | 最后消息时间戳 |
| `isPinned` | `boolean` | 是否置顶 |
| `pinnedTime` | `number` | 置顶时间戳，未置顶为 0 |
| `isMuted` | `boolean` | 是否免打扰 |

### `CONVERSATION_TYPE`

`SINGLE_CHAT='singleChat'`、`GROUP_CHAT='groupChat'`。类型别名 `ConversationTypeValue` / `EmChatType`。

### `CONVERSATION_TAB_KEY`

`ALL='all'`、`UNREAD='unread'`、`AT_ME='atMe'`、`SINGLE='single'`、`GROUP='group'`；默认顺序见 `DEFAULT_CONVERSATION_TABS`。

### `CONVERSATION_MENU_KEY`

`NEW_CHAT='new-chat'`、`CREATE_GROUP='create-group'`、`PIN='pin'`、`MUTE='mute'`、`DELETE='delete'`。

### `MESSAGE_MENU_KEY`

`COPY='copy'`、`QUOTE='quote'`、`EDIT='edit'`、`PIN='pin'`、`RECALL='recall'`、`RESEND='resend'`、`DELETE='delete'`；默认顺序即为此列表顺序，删除 key 即禁用对应能力。`RESEND` 仅在消息发送失败时出现。

## 3. 用户、联系人与群

### `EmUserInfo`

| 字段 | 类型 | 说明 |
|---|---|---|
| `userId` | `string` | 用户 ID |
| `nickname` | `string` | 昵称 |
| `avatarUrl` | `string` | 头像 URL |

### `EmUserPresentation` / `EmConversationPresentation` / `EmGroupPresentation`

宿主业务展示资料注入的 patch 类型（`EmKit.setUserPresentation` / `setConversationPresentation` / `setGroupPresentation` 的第二个参数），注入值优先于 SDK 资料参与回落链。

| 类型 | 字段 | 说明 |
|---|---|---|
| `EmUserPresentation` | `nickname?: string`、`avatarUrl?: string` | 用户昵称/头像注入 |
| `EmConversationPresentation` | `name?: string`、`avatar?: string`、`ext?: Record<string, unknown>` | 会话名/头像注入；`ext` 为业务载荷，随 `#title` / `#title-extra` / `#avatar` 插槽作用域透出 |
| `EmGroupPresentation` | `name?: string`、`avatar?: string`、`ext?: Record<string, unknown>` | 群名/群头像注入；`ext` 随 `#name-extra` / `#title` 插槽作用域透出 |

三个 API 的 `patch` 均支持传 `null` 表示清除该对象全部注入。

### `EmContactItem`

| 字段 | 类型 | 说明 |
|---|---|---|
| `userId` | `string` | 好友 userId |
| `remark` | `string` | 备注，空串表示未设置 |
| `nickname` | `string` | 昵称快照 |
| `avatarUrl` | `string` | 头像 |
| `addTs` | `number` | 好友关系建立时间 |

### `EmContactInvite`

好友申请与群邀请共用：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 本地生成 ID，幂等合并用 |
| `kind` | `'contact' \| 'group'` | 申请类型 |
| `from` | `string` | 申请发起方 userId |
| `message` | `string` | 附言 |
| `status` | `'pending' \| 'accepted' \| 'declined'` | 处理状态 |
| `outgoing` | `boolean` | 是否我方发出后被处理的通知 |
| `ts` | `number` | 时间戳 |
| `groupId` | `string` | 群邀请的群 ID |
| `groupName` | `string` | 群名快照 |

### `EmContactNavEntry`

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | `string` | 入口 key，见 `CONTACT_ENTRY_KEY` |
| `label` | `string` | 展示标题 |
| `count` | `number` | 计数，>0 才展示 |
| `hot` | `boolean` | 红点（仅 count>0 生效） |
| `icon` | `string` | 可选图标名 |

### `EmGroup`

| 字段 | 类型 | 说明 |
|---|---|---|
| `groupId` | `string` | 群 ID |
| `name` | `string` | 群名称 |
| `description` | `string` | 群描述 |
| `owner` | `string` | 群主 userId |
| `memberCount` | `number` | 成员数 |
| `maxUsers` | `number` | 人数上限 |
| `avatar` | `string` | 群头像（可选） |
| `public` | `boolean` | 是否公开群 |
| `approval` | `boolean` | 入群是否需要审批 |
| `allowInvites` | `boolean` | 是否允许成员邀请 |
| `inviteNeedConfirm` | `boolean` | 邀请是否需要确认 |
| `mute` | `boolean` | 是否全员禁言 |
| `disabled` | `boolean` | 群是否被禁用 |

### `EmGroupMember`

| 字段 | 类型 | 说明 |
|---|---|---|
| `userId` | `string` | 成员 userId |
| `role` | `'owner' \| 'admin' \| 'member'` | 角色 |
| `joinedAt` | `number` | 入群时间戳，缺失为 0 |
| `nick` | `string` | 群昵称（可选） |
| `avatar` | `string` | 头像（可选） |

### `EmGroupMemberListResult`

| 字段 | 类型 | 说明 |
|---|---|---|
| `items` | `EmGroupMember[]` | 本页成员；`applied=false` 时不得消费 |
| `cursor` | `string` | 下一页游标；`applied=false` 时不得消费 |
| `hasMore` | `boolean` | 是否还有更多；`applied=false` 时不得消费 |
| `applied` | `boolean` | 当前成功且已写入 store 时 resolve `true`；陈旧成功 resolve `false`，陈旧失败 reject 同类型结构化结果（`false`） |

调用方必须同时处理 resolve 与 catch：陈旧成功 resolve `applied=false`，陈旧失败 reject 结构化结果（`applied=false`），两者的 `items/cursor/hasMore` 都不得消费；当前真实失败 reject 原始错误，不包装为该结果类型。

### `CreateGroupParams`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | `string` | 是 | 群名称 |
| `description` | `string` | 否 | 群描述 |
| `members` | `string[]` | 否 | 初始成员（不含创建者） |
| `public` | `boolean` | 否 | 是否公开群 |
| `approval` | `boolean` | 否 | 入群是否需要审批 |
| `allowInvites` | `boolean` | 否 | 是否允许成员邀请 |
| `inviteNeedConfirm` | `boolean` | 否 | 邀请是否需要确认 |
| `maxMembers` | `number` | 否 | 人数上限 |

### 群相关常量

- `GROUP_MEMBER_ROLE`：`OWNER='owner'`、`ADMIN='admin'`、`MEMBER='member'`。
- `GROUP_MEMBER_ACTION`：`CHAT`、`SET_ADMIN`、`REMOVE_ADMIN`、`TRANSFER_OWNER`、`REMOVE`。
- `GROUP_NOTICE_EVENT`：建群、成员进出、改名、公告、转让、被移出、解散、管理员变更、全员禁言。
- `GROUP_MEMBER_PAGE_SIZE=20`、`GROUP_MEMBER_GRID_COUNT=8`、`GROUP_ANNOUNCEMENT_MAX_LENGTH=512`、`GROUP_NAME_MAX_LENGTH=255`。

### 联系人常量

- `CONTACT_ENTRY_KEY`：`NOTICE='notice'`、`GROUP='group'`、`CONTACT='contact'`。
- `CONTACT_INVITE_STATUS`：`PENDING` / `ACCEPTED` / `DECLINED`。
- `CONTACT_INVITE_KIND`：`CONTACT='contact'`、`GROUP='group'`。
- `CONTACT_MENU_KEY`：`REMARK='remark'`、`DELETE='delete'`；默认顺序即备注在前、删除在后。
- `ALPHABET_KEYS`：`A`–`Z` + `#`。

### 列表加载常量

- `LOAD_MORE_STATE.LOADING='loading'`：加载中。
- `LOAD_MORE_STATE.BUTTON='button'`：点击加载更多。
- `LOAD_MORE_STATE.NO_MORE='noMore'`：没有更多。
- `LOAD_MORE_STATE.ERROR='error'`：加载失败，点击重试；`LoadMoreStateValue` 由该常量派生。

## 4. 组件公共类型

### `EmActionSheetAction`

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | `string` | 动作 key |
| `text` | `string` | 展示文案 |
| `icon` | `string` | 图标名（可选） |
| `danger` | `boolean` | 危险态（红字） |
| `disabled` | `boolean` | 禁用 |

### `EmMessageMenuExtra`

继承 `EmActionSheetAction`，新增 `types?: EmMessageType[]`：只在指定消息类型上显示；`NOTICE` 恒不显示。

### `EmQuickReply`

| 字段 | 类型 | 说明 |
|---|---|---|
| `label` | `string` | 芯片文案 |
| `text` | `string` | 填入/发送的文本，缺省用 `label` |

`EmQuickReplyMode = 'fill' | 'send'`。

### `EmChatInputBarScope`

`em-chat-page` `#input-bar` 整栏自绘插槽的作用域契约（用法与示例见 [聊天页](./PAGES-CHAT.md)「整栏自绘输入栏」）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `draft` / `setDraft(v)` | `string` / 函数 | 草稿值与写入；写入即触发草稿持久化、typing、@ 尾部检测 |
| `quote` / `closeQuote()` | `EmQuoteInfo \| null` / 函数 | 引用条数据与关闭 |
| `disabled` / `notifyDisabledTap()` | `boolean` / 函数 | 禁用态（全员禁言）；禁用下的操作尝试统一上报，页面 toast |
| `placeholder` | `string` | 建议提示文案（禁用态为「全员禁言中」），空串可回落自绘文案 |
| `features` | `EmInputFeatures` | 功能集开关（`uiConfig.inputFeatures`） |
| `emojis` | `string[]` | emoji 字符集（`uiConfig.emojiList`） |
| `quickReplies` | `EmQuickReply[]` | 快捷回复常用语 |
| `keyboardLift` | `number` | 上推口径键盘高度（页面壳已顶起，自绘栏一般无需使用） |
| `panel` / `togglePanel(kind)` / `collapsePanel()` | `EmChatComposerPanel` / 函数 | 底部面板态（`'none' \| 'emoji' \| 'media'`）与开关/收起 |
| `panelStyle` | `string` | 自绘面板根节点内联样式（高度跟随最近键盘高度 + 安全区） |
| `inputFocus` / `closeKeyboard()` / `notifyInputFocus()` / `notifyInputBlur()` | `boolean` / 函数 | 输入框焦点绑定值、主动收键盘、focus/blur 事件上报 |
| `voiceMode` / `recording` / `willCancel` / `toggleVoiceMode()` | `boolean` / 函数 | 语音模式、录音中、上滑取消态、语音模式切换 |
| `onVoiceTouchStart(e)` / `onVoiceTouchMove(e)` / `onVoiceTouchEnd()` / `onVoiceTouchCancel()` | 函数 | 「按住说话」条的四个手势事件绑定（60 秒自动发送、过短拦截内置） |
| `send()` | 函数 | 发送当前草稿（空草稿拦截、引用/@ext、清草稿、滚底内置） |
| `selectMedia(key)` | 函数 | 媒体动作，`key` 取 `MEDIA_PANEL_KEY.ALBUM/CAMERA/VIDEO/FILE` |
| `selectQuickReply(item)` | 函数 | 快捷回复点选（按 `quickReplyMode` 填草稿或直接发送） |

相关类型：`EmChatComposerPanel = 'none' | 'emoji' | 'media'`、`EmChatComposerPanelKind = 'emoji' | 'media'`、`EmChatComposerTouchEvent`（`{ touches: Array<{ clientY: number }> }`，原生 `TouchEvent` 结构兼容）。行为核心 `useChatComposer(options)` 亦从 `libs` 导出，供完全自研聊天页复用同一套键盘/面板/录音逻辑（`options`：`disabled` / `onDisabledTap` / `onVoiceSend`；返回与上表同名的状态与动作）。

### `EmSelectContactItem`

`userId` / `name` / `avatar`，供 `em-select-contact` 使用。

### `MentionContact`

`userId` / `name` / `avatar?`，供 `em-mention-picker` 与 @ 高亮解析使用。

### `EmContactGroup` / `EmPinyinResult`

拼音分组结果：`key`（A-Z/#）、`contacts`；`setPinyinAdapter` 见 [EmKit API](./API-KIT.md) 之外的导出列表。

## 5. 主题与语言

### `THEME_MODE`

`AUTO='auto'`、`LIGHT='light'`、`DARK='dark'`；实际生效主题类型 `EmThemeMode = 'light' | 'dark'`。

### `LOCALE`

`ZH_CN='zh-CN'`、`EN='en'`；类型 `EmLocaleName`。

### `LOG_LEVEL`

`DEBUG` / `INFO` / `WARN` / `ERROR` / `SILENT`。

### `CONNECTION_STATUS`

`IDLE` / `CONNECTING` / `RECONNECTING` / `ONLINE` / `CLOSED`。

### `ERROR_CODE`

UIKit 业务错误码（挂在 `Error.code` 上，与 SDK `errorCode` 无关），供发送失败归因等场景识别：

- `NETWORK_OFFLINE='EM_NETWORK_OFFLINE'`：发送前预检测命中系统网络离线（该次发送未触达 SDK，消息按失败落库、可重发）。
- `NETWORK_TIMEOUT='EM_NETWORK_TIMEOUT'`：发送/拉取前的连接等待超时。
- `SEND_TIMEOUT='EM_SEND_TIMEOUT'`：SDK `onSendTimeout` 信号，仍在发送中的己方消息统一落失败并归因（失败气泡可重发）。
- `MEDIA_UNAVAILABLE='EM_MEDIA_UNAVAILABLE'`：失败重发时本地媒体临时文件已被系统清理，且没有可复用的远端 URL。

## 6. 平台与媒体类型

### `EmPickedImage`

`path` / `name` / `size` / `webFile`（H5 的 `File` 对象，其他端为 `null`）。

### `EmPickedVideo`

`path` / `name` / `duration` / `width` / `height` / `size`。

### `EmPickedFile`

`path` / `name` / `size` / `webFile`，并扩展 `EmAttachment` 的 `mimeType?` / `temporary?` / `release?`。

### `EmAttachment`

宿主附件能力返回的可发送附件：`path`（本地真实路径）/ `name` / `size` / `mimeType?` / `temporary?` / `release?(path)`。

### `EmAttachmentPickOptions`

`conversationId?` / `chatType?` / `mimeTypes?` / `multiple?`。

### `EmAttachmentProvider`

`isAvailable?()` / `pick(options): Promise<EmAttachment[]>` / `resolve?(uri, options?): Promise<EmAttachment | null>`。经 `EmKit.setAttachmentProvider()` 注册，用于 App 端文件选择。

### `EmAttachmentCapability`

`available` / `providerName`；`EmKit.attachments` 返回该快照。

### `EmRecordResult` / `EmRecordOptions`

`EmRecordResult = { path, duration }`；`EmRecordOptions = { onError?, onAutoStop? }`。

### `EmPlatformCapabilities`

`videoPreview` / `filePick` / `fileOpen` 三个布尔值；运行时 `PLATFORM_CAPABILITIES` 是只读快照。`videoPreview` 当前全端为 `true`；`filePick` 只表示“有内置选择器”（小程序/H5），App 端注册附件能力后判断入口请用 `EmKit.canPickAttachment`。

## 7. 其他

- `EmAvatarShape = 'circle' | 'square'`。
- `EmSenderNameMode = 'always' | 'hidden'`。
- `EmTokenRenewalResult = { token, expireAt }`。
- `EmUnreadCounts = { conversationUnread, contactRequestUnread }`（均为 `ComputedRef<number>`）。
- `EmTabBarBadgeOptions` / `EmTabBarBadgeController`：见 [页面指南 · 会话列表](./PAGES-CONVERSATION.md)。
- `EmKitConfig` / `EmUiConfig` / `EmInputFeatures`：见 [配置参考](./CONFIG.md)。

完整字段以 `libs/types/index.ts` 为准；新增类型会同步导出到门面。
