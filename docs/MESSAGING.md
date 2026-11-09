# 消息与扩展协议

这页讲消息从发送到渲染的完整模型，以及引用、@ 提及、自定义消息、本地提示、流式消息这些扩展点。发送 API 的签名见 [EmKit 发送消息 API](./API-KIT-MESSAGES.md)，消息字段见 [消息类型与常量](./API-TYPES-MESSAGES.md)。

## 1. 消息模型

UIKit 把 SDK 消息归一化为 `EmMessageItem`。无论来自发送回执、实时接收还是历史拉取，最终都会经过同一套转换，因此：

- 引用、@ 提及、自定义消息的结构一致；
- 图片/语音/视频/文件字段一致；
- 失败重发、撤回、已读回执行为一致；
- 业务只需要认 `EmMessageItem`，不需要理解 SDK wire 字段。

内置消息类型：

| 类型 | 常量 | 说明 |
|---|---|---|
| 文本 | `MESSAGE_TYPE.TEXT` | 支持引用、@ 提及、流式 |
| 图片 | `MESSAGE_TYPE.IMAGE` | 支持预览、长按 |
| 语音 | `MESSAGE_TYPE.AUDIO` | 支持播放、时长宽度 |
| 视频 | `MESSAGE_TYPE.VIDEO` | 支持 H5 预览 |
| 文件 | `MESSAGE_TYPE.FILE` | 支持文件名/大小展示 |
| 自定义 | `MESSAGE_TYPE.CUSTOM` | 业务卡片统一通道 |
| 复合消息 | `MESSAGE_TYPE.MULTI_BODY` | 接收 `multi_body`，通过 `segments` 按顺序展示多类内容，不提供发送 API |
| 位置分段 | `MESSAGE_TYPE.LOCATION` | 仅用于复合消息内部的位置卡片；独立位置消息不属于当前能力 |
| 本地提示 | `MESSAGE_TYPE.NOTICE` | 居中灰条，不发服务端 |
| 其他 | `MESSAGE_TYPE.OTHER` | 未识别类型，可被 `#custom-message` 接管 |

## 2. 发送

```ts
import { EmKit, CONVERSATION_TYPE } from '@/uni_modules/easemob-uikit-uni/libs'

await EmKit.sendText('user-b', CONVERSATION_TYPE.SINGLE_CHAT, '你好')
await EmKit.sendImage('user-b', CONVERSATION_TYPE.SINGLE_CHAT, image)
await EmKit.sendAudio('user-b', CONVERSATION_TYPE.SINGLE_CHAT, filePath, 12)
await EmKit.sendVideo('user-b', CONVERSATION_TYPE.SINGLE_CHAT, video)
await EmKit.sendFile('user-b', CONVERSATION_TYPE.SINGLE_CHAT, file)
```

- 单聊 `to` 为对方 userId，群聊 `to` 为 groupId。
- 媒体对象来自 `chooseImage` / `chooseVideo` / `chooseFile` 或输入栏事件。
- App 端文件选择由宿主注册附件能力（`EmKit.setAttachmentProvider`）；`EmKit.sendFile` 接收 `{ path, name, size, mimeType?, temporary?, release? }`，`temporary` 附件在发送成功后由 UIKit 回调 `release` 清理，失败时保留供重发。详见 [EmKit 附件能力注入](./API-KIT-MESSAGES.md#emkitsetattachmentproviderprovider--pickattachmentsoptions--resolveattachmenturi-options)。
- 发送成功后返回 `EmMessageItem`；失败会抛错，聊天页同时把消息置为 `failed` 并显示重发入口。
- 附件消息发送中，SDK 回传 `onFileUploadProgress` 时会把百分比写入 `EmMessageItem.uploadProgress`（0-100），图片/视频气泡蒙层与文件气泡会显示进度；发送结束（成功或失败）后该字段清空。

### 业务上下文 `ext`

`sendText` 的第 6 个参数是业务 ext：

```ts
await EmKit.sendText('user-b', 'singleChat', '订单已发货', undefined, undefined, {
  orderId: 'SO-20261021-001',
  source: 'order-detail',
  status: 'shipped'
})
```

对端从 `message.ext` 读取。ext 会与 UIKit 内部 key 合并，**内部 key 优先**：业务不要占用 `msgQuote`、`emQuote`、`em_at_list`。

## 3. 引用

### 发送

```ts
const quote = EmKit.makeQuote(targetMessage)
await EmKit.sendText('user-b', 'singleChat', '收到，我看下', quote)
```

`EmQuoteInfo` 会写入消息 ext：

- `ext.msgQuote`：1.0 主协议，与 vue 版 UIKit 同 key、同结构，可跨 UIKit 互通。
- `ext.emQuote`：旧版 uni 兼容字段，发送时双写；接收时优先 `msgQuote`，旧消息回落 `emQuote`。

引用卡包含发送人、摘要、类型图标；点击引用卡会尝试定位原消息并高亮。输入栏引用条由聊天页内部管理，宿主不需要自己拼 ext。

### 业务扩展

如果宿主需要引用之外的“业务上下文卡片”，用 `sendCustom` + `ext`，不要改引用协议。

## 4. @ 提及

@ 提及仅群聊有意义，协议 key 为 `ext.em_at_list`（userId 数组），与 vue 版 UIKit 互通。

```ts
await EmKit.sendText(
  groupId,
  'groupChat',
  '@张三 请看下这个工单',
  undefined,
  ['user-zhang'],
  { ticketId: 'T-1001' }
)
```

- 聊天页在群聊 + `enableMention` 时，输入 `@` 会打开成员选择器；选人后追加 `@名字 `。
- 发送前会过滤“已不存在的提及”，只把有效 userId 写入 `em_at_list`。
- 气泡渲染时按 `em_at_list` 高亮 `@名字` 片段；点击片段触发 `mention-click`，载荷优先为解析后的 userId。
- 群会话列表会显示 `@我` 徽标；进入会话后清除。
- 纯工具函数：`filterActiveMentions()`、`parseMentions()`，可从门面导入。

限制：群成员昵称包含空格时，高亮只到第一个空格；这是文本协议本身的边界。需要更强结构时使用自定义消息 + `ext`。

## 5. 自定义消息

自定义消息是业务卡片/结构化消息的唯一通道。UIKit 不内置卡片组件，也不规定 schema；它只负责传输、透出字段和提供插槽。

### 发送

```ts
await EmKit.sendCustom(
  'user-b',
  'singleChat',
  'orderCard',
  { orderId: 'SO-20261021-001' },
  {
    title: '订单已发货',
    subtitle: '预计明天送达',
    amount: '¥ 128.00',
    status: 'shipped'
  }
)
```

| 参数 | 说明 |
|---|---|
| `event` | 业务事件名，接收侧用 `message.customEvent` 分发 |
| `params` | 字符串参数，写入 wire `body.params` |
| `ext` | 结构化载荷，写入消息 ext，适合对象/数组 |

### 接收与渲染

```vue
<template>
  <em-chat-page :conversation-id="id" :chat-type="chatType">
    <template #custom-message="{ message }">
      <OrderCard v-if="message.customEvent === 'orderCard'" :message="message" />
      <FallbackCard v-else :message="message" />
    </template>
  </em-chat-page>
</template>
```

- 插槽作用域是 `{ message: EmMessageItem }`。
- 外层容器承接原生 longpress，因此卡片内部也能打开消息长按菜单。
- 未提供插槽或未命中时，默认占位为 `[自定义消息]`。
- `message.customEvent` / `customParams` / `ext` 原样透出；`rawType` 对自定义消息为 `'custom'`，旧代码可用它做兼容判别。
- 卡片内按钮/跳转由宿主自己处理，不经过 UIKit。

### 失败重发

`EmKit.resendMessage` 会按 `customEvent` / `customParams` / `ext` 重建自定义消息，不需要宿主额外处理。

### 建议

- `event` 用稳定的英文标识，不要用展示文案。
- 结构化数据放 `ext`，`params` 只放简单字符串。
- 对未知 event 提供兜底卡片，避免旧客户端白屏。
- 卡片样式、多语言、脱敏都由宿主负责。

## 6. 本地系统提示

用于“订单已发货”“客服已接入”“患者已报到”等不需要发服务端的提示：

```ts
EmKit.insertLocalNotice(conversationId, chatType, '订单已进入售后流程')
EmKit.insertGroupNotice(groupId, '群公告已更新')
```

- 生成 `MESSAGE_TYPE.NOTICE`，在消息列表居中显示灰条。
- 只落本地消息列表，不发送服务端；重新进入会话时通过本地合并保留。
- 长按菜单对 notice 禁用。
- 群事件（建群、成员进出、改名、公告、转让等）会自动插入群提示。

## 7. 流式消息

AI 流式输出通过 SDK 的 `onStreamMessage` 驱动：

- 按 `msgServerId` 合并到同一条 TEXT 气泡，不新建多条消息。
- 首个分片立即建气泡，后续分片按 `streamThrottle` 合批写入。
- 终态立即落盘；`onMessage` 的完整消息到达时做丢片补偿。
- 纯文本流显示打字机光标与异常提示；markdown 等富格式由 `#stream-message` 插槽接管。

完整接入见 [AI 流式消息](./AI-STREAM.md)。

## 8. 删除、复制、撤回、重发、已读、typing

### 删除与复制

- `EmKit.deleteMessage(message)` 对有服务端 ID 的消息先删除当前账号的漫游历史，成功后再删除本地消息；无服务端 ID 的本地消息不调用 SDK。它不是撤回，不会删除接收方已经收到的消息。
- 漫游删除失败会抛错并保留本地气泡。聊天页删除前需要确认，取消确认不执行请求；成功后通过气泡消失反馈并派发 `delete`，失败显示提示。
- 删除后按剩余的最后一条消息校正会话摘要与时间；若剩余最新的是撤回消息，摘要仍显示撤回提示，不恢复原文。仅需显式本地删除时可调用 `EmKit.deleteLocalMessage(conversationId, localId)`，本地删除不等待 SDK，未命中时不改摘要或缓存。
- `copyText(text)` 返回 `Promise<void>`，空文本或系统剪贴板失败会 reject；聊天页据此显示复制成功或失败提示，并关闭剪贴板原生提示以避免重复反馈。

### 撤回

- 仅本人消息、且在 `recallTimeLimit`（默认 2 分钟）内显示撤回菜单；执行时再次检查时间窗，不额外弹确认框。
- 同一 `localId` 的撤回完成前会拦截重复提交；撤回后消息变为 `recalled`，列表显示居中提示。
- `EmKit.recallMessage(conversationId, chatType, messageId)` 可由宿主自绘菜单调用。

### 失败重发

- 失败消息保留原位，显示红色感叹号；domain 按 `conversationId + localId` 共享在途重发 Promise，页面实例或宿主重复调用都会得到同一实际成功/失败结果，失败后仍可重试。
- 点击红色感叹号先弹出失败面板：标题带失败原因，提供「重新发送 / 删除」；也可在长按菜单选「重发」，最终都调用 `EmKit.resendMessage`，锁在等待 SDK 就绪前占有，页面防重仍保留。
- 失败原因按 SDK 错误码归因后写入 `EmMessageItem.failCode`（如 `1200` 审核未通过、`501` 违规内容、`508` 外部策略拦截、`222` 被对方拒收、`300` 未连接、`219` 管理员禁言、网络类业务码），toast 与失败面板共用同一套中英文案。
- 媒体消息按原类型重建；本地临时文件缺失时会明确报错（`ERROR_CODE.MEDIA_UNAVAILABLE`），不会退化成空文本。
- 其他设备删除漫游消息（含审核删除）时，本端经 `onMultiDeviceMessageRemoved` 同步移除；`onSendTimeout` 触发时，仍在发送中的己方消息统一落失败并归因。

### 已读回执

- 功能开关 `enableReadReceipt` 默认开启（是否发送/接收已读回执），单聊生效。
- 已读态图标另有纯展示开关 `showReadStatus`，默认关闭；开启后仅最新一条己方已发送消息显示已读/未读图标。
- 群聊已读回执由独立开关 `enableGroupReadReceipt` 控制（默认关闭）：开启后群消息带 `needReadReceipt`、自动回执群内消息，并在己方群消息下方展示「N 人已读」。人数来自 `onMessageReadReceipts` 的群回执事件（服务端下发累计值）或 `EmKit.refreshGroupReadCounts` 批量查询，只增不减；关闭时群聊不产生回执请求。
- 发送状态呈现可用 `messageStatus` 配置图标、文案与位置（气泡左侧/右侧）；它只改变呈现形式，不改变状态判定。
- 发送中/失败状态不受以上两个开关影响：发送中恒显 loading，失败恒显红色感叹号。
- 进入会话、当前会话收消息、离开聊天页都会清理服务端未读（按会话合批）。

### typing

- 单聊生效，群聊不发 typing。
- 发送节流 `typingThrottle`，展示超时 `typingTimeout`，默认 5 秒。
- 通过 cmd 信号 `TypingBegin` 传输；cmd 不会落消息列表。
- 可通过 `enableTyping=false` 关闭。

## 9. 历史、分页与内存

- 聊天页进入时自动 `loadHistory`，点击顶部“加载更早消息”继续翻页。
- 历史加载是 prepend，会保持当前滚动锚点，不会把用户甩到底部。
- 非当前会话只保留最近 100 条（`CONVERSATION_MESSAGE_RETAIN_LIMIT`）；被裁剪的会话下次进入会重新拉最新页。
- 当前会话在一次会话内不设上限。
- 宿主自绘列表时，注意保持 `localId` 作为列表 key，避免分页合并时错位。

## 10. 复合消息（接收展示）

SDK 5.2.0 的 `multi_body` 消息经 `toMessageItem` 归一为 `MESSAGE_TYPE.MULTI_BODY`，父消息的 `segments` 按发送顺序保存展示子项。聊天页使用 `em-multi-body-message` 在一个气泡内展示文本、图片、语音、视频、文件、位置和自定义分段。

- 父消息保留方向、状态、发送人、会话与 ext；每个子项有独立的 `localId`（父 `localId` 加分段下标），文本复制按原顺序拼接所有文本分段并以换行分隔。
- 会话列表、长按菜单标题、引用与置顶预览共用首段摘要：文本取内容、文件优先取文件名、其他类型取对应标签，非空摘要追加 `...`；空内容回落 `[复合消息]`。
- 图片、视频、语音和文件子项分别支持预览、播放和下载；位置子项展示地址与经纬度，自定义子项展示事件与字符串参数。长按任意分段都操作父消息。
- 当前只提供实时接收与历史展示，不提供复合消息创建、编辑、发送、重发或转发 API。独立位置消息仍按不支持类型处理。

## 11. 安全与协议约定

- 引用与 @ 提及的 key 是跨 UIKit 互通的公共协议，业务 ext 不要覆盖。
- 自定义消息的 `ext` 可能来自不可信对端；宿主渲染前应校验字段、做长度限制与转义。
- 如果卡片展示 markdown/HTML，必须在宿主侧净化，不要直接插入不可信 HTML。
- 不要把真实 token、手机号等敏感信息写入消息 ext；需要脱敏展示的字段由宿主在渲染层处理。
- 日志中的消息 payload 默认不记录；`logPayload` 仅用于调试，生产关闭。
