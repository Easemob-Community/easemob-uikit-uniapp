# EmKit 发送消息

## `EmKit.sendText(to, chatType, text, quote?, mentions?, ext?)`

发送文本消息。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `to` | `string` | 是 | 单聊为对方 userId，群聊为 groupId |
| `chatType` | `'singleChat' \| 'groupChat'` | 是 | 会话类型 |
| `text` | `string` | 是 | 文本内容 |
| `quote` | `EmQuoteInfo` | 否 | 引用信息，通常由 `makeQuote` 生成 |
| `mentions` | `string[]` | 否 | 被 @ 的 userId 列表；仅群聊有意义 |
| `ext` | `Record<string, unknown>` | 否 | 业务上下文载荷，与 UIKit 内部 key 合并 |

返回 `Promise<EmMessageItem>`。UIKit 内部 key（引用、@ 提及）优先，业务 ext 不要占用 `msgQuote` / `emQuote` / `em_at_list`。

## `EmKit.makeQuote(item)`

从一条消息生成引用快照，返回 `EmQuoteInfo`。

```ts
const quote = EmKit.makeQuote(message)
await EmKit.sendText('user-b', 'singleChat', '收到', quote)
```

## `EmKit.sendCustom(to, chatType, event, params?, ext?)`

发送自定义消息，是业务卡片/结构化消息的统一通道。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `to` | `string` | 是 | 单聊 userId / 群聊 groupId |
| `chatType` | `'singleChat' \| 'groupChat'` | 是 | 会话类型 |
| `event` | `string` | 是 | 业务事件名，接收侧用 `message.customEvent` 分发 |
| `params` | `Record<string, string>` | 否 | 字符串参数 |
| `ext` | `Record<string, unknown>` | 否 | 结构化业务载荷 |

返回 `Promise<EmMessageItem>`。接收侧在 `#custom-message` 插槽中按 `customEvent` 渲染，UIKit 不内置卡片样式。详见[消息与扩展协议](./MESSAGING.md)。

## `EmKit.sendImage(...)` / `sendAudio(...)` / `sendVideo(...)` / `sendFile(...)`

```ts
EmKit.sendImage(to, chatType, image)
EmKit.sendAudio(to, chatType, filePath, duration)
EmKit.sendVideo(to, chatType, video)
EmKit.sendFile(to, chatType, file)
```

发送媒体消息。媒体对象一般来自 `chooseImage` / `chooseVideo` / `chooseFile` 或 `em-chat-inputbar` 的媒体选择事件。

```ts
import { chooseImage, EmKit } from '@/uni_modules/easemob-uikit-uni/libs'

const images = await chooseImage(1, 'album')
await EmKit.sendImage('user-b', 'singleChat', images[0])
```

返回 `Promise<EmMessageItem>`。语音录制仅 App/小程序，内置文件选择仅小程序/H5；App 端可注入宿主文件选择能力，详见[平台能力与差异](./PLATFORM.md)。

## `EmKit.setAttachmentProvider(provider)` / `pickAttachments(options)` / `resolveAttachment(uri, options?)`

App 端没有跨端通用的系统文件选择器。宿主注册附件 provider 后，输入栏「文件」通过 `pick()` 请求宿主选择文件；发送、失败重发和临时文件清理由 UIKit 统一处理。

```ts
EmKit.setAttachmentProvider({
  pick: async (ctx) => {
    const attachments = await selectFiles({
      multiple: ctx.multiple ?? true,
      mimeTypes: ctx.mimeTypes,
    })
    return attachments.map(file => ({
      path: file.path,
      name: file.name,
      size: file.size,
      mimeType: file.mimeType,
      temporary: true,
      release: path => removeTempFile(path),
    }))
  }
})
```

- `setAttachmentProvider(null)` 注销；H5/小程序继续使用内置选择器。
- `pick` 的 `ctx` 带 `conversationId`、`chatType`、`mimeTypes`、`multiple`。
- `temporary: true` + `release(path)`：发送成功、重发成功、删除消息或登出时释放；取消发送的临时文件也会释放，同一路径最多调用一次。
- `resolve(uri, ctx)` 可把分享进入/open-with 等外部 URI 转为可发送附件。
- `EmKit.attachments` 返回 `{ available, providerName }`，`EmKit.canPickAttachment` 返回当前是否可选文件；可用性变化后调用 `EmKit.refreshAttachmentAvailability()`。
- `pickAttachments(options)` 与 `resolveAttachment(uri, options?)` 是低层入口，内置聊天流程不需要手动调用。

完整宿主适配示例见 demo 的 `demo/common/attachment-provider.uts`。
