# 主题、语言与状态常量

## `THEME_MODE`

`AUTO='auto'`、`LIGHT='light'`、`DARK='dark'`；实际生效主题类型 `EmThemeMode = 'light' | 'dark'`。

## `LOCALE`

`ZH_CN='zh-CN'`、`EN='en'`。`EmLocaleName` 保留内置字面量提示并允许扩展字符串；先用 `mergeMessages` 注册文案表，再 `setLocale` 切换，扩展语言也可持久化恢复。

## `LOG_LEVEL`

`DEBUG` / `INFO` / `WARN` / `ERROR` / `SILENT`。

## `CONNECTION_STATUS`

`IDLE` / `CONNECTING` / `RECONNECTING` / `ONLINE` / `CLOSED`。

## `ERROR_CODE`

UIKit 业务错误码（挂在 `Error.code` 上，与 SDK `errorCode` 无关）：

- `UNAUTHORIZED='EM_UNAUTHORIZED'`：当前没有登录账号，依赖连接的操作立即失败。
- `NETWORK_OFFLINE='EM_NETWORK_OFFLINE'`：发送前预检测命中系统网络离线，消息按失败落库、可重发。
- `NETWORK_TIMEOUT='EM_NETWORK_TIMEOUT'`：发送/拉取前的连接等待超时。
- `SEND_TIMEOUT='EM_SEND_TIMEOUT'`：SDK `onSendTimeout` 信号，仍在发送中的己方消息统一落失败。
- `MEDIA_UNAVAILABLE='EM_MEDIA_UNAVAILABLE'`：失败重发时本地媒体已清理且没有可复用远端 URL。
- `DOWNLOAD_AUTH_DENIED='EM_DOWNLOAD_AUTH_DENIED'`：下载图片/视频时未授予相册权限。
- `DOWNLOAD_UNSUPPORTED='EM_DOWNLOAD_UNSUPPORTED'`：消息没有可下载附件或 URL 为空。

## 其他公共类型

- `EmAvatarShape = 'circle' | 'square'`。
- `EmSenderNameMode = 'always' | 'hidden'`。
- `EmTokenRenewalResult = { token, expireAt }`。
- `EmUnreadCounts = { conversationUnread, contactRequestUnread }`，均为 `ComputedRef<number>`。
- `EmTabBarBadgeOptions` / `EmTabBarBadgeController`：见[会话列表页](./PAGES-CONVERSATION.md)。
- `EmKitConfig` / `EmUiConfig` / `EmInputFeatures`：见[配置参考](./CONFIG.md)。
