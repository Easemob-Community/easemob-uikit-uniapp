# 消息类型与常量

```ts
import {
  MESSAGE_TYPE,
  MESSAGE_STATUS,
  type EmMessageItem,
} from '@/uni_modules/easemob-uikit-uni/libs'
```

## `EmMessageItem`

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 服务端消息 ID（发送前可能为空） |
| `localId` | `string` | 本地唯一 ID，列表 key 与重发/引用定位使用 |
| `conversationId` | `string` | 所属会话 ID |
| `chatType` | `EmChatType` | `singleChat` / `groupChat` |
| `type` | `EmMessageType` | 见 `MESSAGE_TYPE` |
| `text` | `string` | 文本内容；流式消息为当前累计全文 |
| `url` | `string` | 图片/语音/视频/文件地址 |
| `thumbUrl` | `string` | 缩略图/封面地址 |
| `originalUrl` | `string` | 图片原图地址（SDK `originalImageUrl`），未携带时为空串 |
| `isGif` | `boolean` | 是否为 GIF 图片；发送时按 File MIME 或 `.gif` 文件名/URL 识别，接收与历史读取 SDK body |
| `width` / `height` | `number` | 图片/视频尺寸（未知为 0） |
| `time` | `number` | 消息时间戳（毫秒） |
| `from` / `to` | `string` | 发送方 / 接收方 |
| `self` | `boolean` | 是否本人发送 |
| `status` | `EmMessageStatus` | `sending` / `sent` / `failed` / `recalled` |
| `quote` | `EmQuoteInfo \| null` | 引用快照 |
| `duration` | `number` | 语音/视频时长（秒） |
| `fileName` | `string` | 文件消息文件名 |
| `fileSize` | `number` | 文件大小（字节） |
| `ext` | `Record<string, unknown>` | SDK ext 透传与自定义业务载荷 |
| `rawType` | `string` | 未识别 wire 类型原文 |
| `customEvent` | `string` | 自定义消息事件名 |
| `customParams` | `Record<string, string>` | 自定义消息字符串参数 |
| `stream` | `EmStreamInfo \| undefined` | 流式消息元信息 |
| `modifiedInfo` | `EmMessageModifiedInfo \| undefined` | 编辑元信息 |
| `pinned` | `boolean \| undefined` | 是否被置顶 |
| `recalledBy` | `string \| undefined` | 撤回操作者 userId |
| `failCode` | `number \| string \| undefined` | 最近一次发送失败归因码，成功后清空 |
| `contentReplaced` | `boolean \| undefined` | 内容是否被审核替换 |
| `delivered` | `boolean \| undefined` | 单聊消息是否已送达 |
| `uploadProgress` | `number \| undefined` | 附件上传进度（0–100），发送结束后清空 |
| `groupReadCount` | `number \| undefined` | 群聊己方消息已读人数 |

## `EmMessageDownloadKind` / `EmMessageDownloadOptions` / `EmMessageDownloadResult`

`downloadAttachment` 的类型：

- `EmMessageDownloadKind = 'image' | 'video' | 'file'`。
- `EmMessageDownloadOptions = { onProgress?: (percent: number) => void }`，仅 App/小程序提供进度。

| `EmMessageDownloadResult` 字段 | 类型 | 说明 |
|---|---|---|
| `kind` | `EmMessageDownloadKind` | 下载类型 |
| `fileName` | `string` | 生成的安全文件名 |
| `filePath` | `string` | App/小程序本地路径；H5 为空串 |
| `savedToAlbum` | `boolean` | 图片/视频是否写入系统相册 |
| `opened` | `boolean` | 文件是否成功调用系统预览 |

## `EmMessageStatusPresentation`

发送状态呈现配置，只改变呈现形式，不改变状态判定。

| 字段 | 类型 | 说明 |
|---|---|---|
| `position` | `'left' \| 'right'` | 状态列相对气泡的位置，默认 `left` |
| `icons` | `Partial<Record<EmMessageStatusKind, string>>` | 按状态覆盖图标名 |
| `texts` | `Partial<Record<EmMessageStatusKind, string>>` | 按状态追加快捷文案 |

`EmMessageStatusKind = 'sending' | 'failed' | 'unread' | 'read'`。

## `EmMessageModifiedInfo`

| 字段 | 类型 | 说明 |
|---|---|---|
| `operatorId` | `string` | 编辑操作者 userId |
| `operationCount` | `number` | 已编辑次数（单条上限 10 次） |
| `operationTime` | `number` | 最近一次编辑时间戳 |

## `EmPinnedMessageItem` / `EmPinnedRow`

| 字段 | 类型 | 说明 |
|---|---|---|
| `message` | `EmMessageItem` | 被置顶消息 |
| `pinnedAt` | `number` | 置顶时间戳 |
| `operatorId` | `string` | 置顶操作者 userId |

`EmPinnedRow = { id: string; preview: string; item: EmPinnedMessageItem }`，预览由 `em-chat-page` 预计算，`em-pinned-bar` 纯展示消费。

## `EmQuoteInfo`

| 字段 | 类型 | 说明 |
|---|---|---|
| `msgId` | `string` | 被引用消息 ID |
| `from` | `string` | 被引用消息发送人 userId |
| `fromName` | `string` | 引用时展示名快照 |
| `text` | `string` | 引用摘要 |
| `type` | `EmMessageType` | 被引用消息类型 |
| `thumbUrl` | `string` | 图片/视频缩略图（可选） |

## `EmStreamInfo`

| 字段 | 类型 | 说明 |
|---|---|---|
| `customType` | `string` | 业务流类型，如 `text` / `markdown` |
| `seq` | `number` | 分片序号 |
| `status` | `EmStreamStatus` | 见 `STREAM_MESSAGE_STATUS` |
| `deltaText` | `string` | 当前分片新增文本 |
| `fullText` | `string` | 当前累计全文 |
| `errorType` | `number` | 流式错误码，0 表示无 |
| `finishReason` | `number` | 服务端结束原因（可选） |

## 消息常量

- `MESSAGE_TYPE`：`TEXT`、`IMAGE`、`AUDIO`、`VIDEO`、`FILE`、`CUSTOM`、`NOTICE`、`OTHER`。
- `MESSAGE_STATUS`：`SENDING`、`SENT`、`FAILED`、`RECALLED`。
- `STREAM_MESSAGE_STATUS`：`START`、`IN_PROGRESS`、`START_COMPLETED`、`COMPLETED`、`ERROR`。
- `STREAM_CUSTOM_TYPE`：`TEXT='text'`、`MARKDOWN='markdown'`。
- `MESSAGE_EXT_KEY`：`QUOTE='msgQuote'`、`QUOTE_LEGACY='emQuote'`、`MENTION='em_at_list'`。

业务 ext 不要占用以上引用和 @ 提及 key；发送时 UIKit 会覆盖。
