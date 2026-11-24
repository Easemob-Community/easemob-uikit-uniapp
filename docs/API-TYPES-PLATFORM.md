# 平台与媒体类型

## `EmPickedImage`

`path` / `name` / `size` / `webFile`（H5 的 `File` 对象，其他端为 `null`）。

## `EmPickedVideo`

`path` / `name` / `duration` / `width` / `height` / `size`。

## `EmPickedFile`

`path` / `name` / `size` / `webFile`，并扩展 `EmAttachment` 的 `mimeType?` / `temporary?` / `release?`。

## `EmAttachment`

宿主附件能力返回的可发送附件：`path`（本地真实路径或 Android `content://` URI）/ `name` / `size` / `mimeType?` / `temporary?` / `release?(path)`。Android 可直接使用 `uni.chooseFile` 的原始返回值。文件发送成功后本地副本保留到删除消息或登出，用于单击即时预览；`release` 收到的路径应与 `path` 一致。

## `EmAttachmentPickOptions`

`conversationId?` / `chatType?` / `mimeTypes?` / `multiple?`。

## `EmAttachmentProvider`

`isAvailable?()` / `pick(options): Promise<EmAttachment[]>` / `resolve?(uri, options?): Promise<EmAttachment | null>`。经 `EmKit.setAttachmentProvider()` 注册，用于 App 端文件选择。

## `EmAttachmentCapability`

`available` / `providerName`；`EmKit.attachments` 返回该快照。

## `EmRecordResult` / `EmRecordOptions`

`EmRecordResult = { path, duration }`；`EmRecordOptions = { onError?, onAutoStop? }`。

## `EmPlatformCapabilities`

`videoPreview` / `filePick` / `fileOpen` 三个布尔值；运行时 `PLATFORM_CAPABILITIES` 是只读快照。`videoPreview` 当前全端为 `true`；`filePick` 只表示“有内置选择器”（小程序/H5），App 端注册附件能力后判断入口请用 `EmKit.canPickAttachment`。
