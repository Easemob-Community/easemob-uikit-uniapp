# EmKit 日志与调试

## `EmKit.exportLogs()`

导出内存环形缓冲中的日志全文。

- H5：触发浏览器下载，返回 `'download'`。
- 小程序/App：写入应用沙盒的用户数据目录（`uni.env.USER_DATA_PATH`）并返回文件路径，同时尽力复制全文到剪贴板；写文件失败时返回 `'clipboard'`。

小程序与 App 的沙盒目录不对用户可见，返回的路径用于分享或上传，不是系统「下载目录」。要在真机上取出日志，直接用剪贴板粘贴，或宿主自行把该文件分享/上传出去。App 端写文件依赖 `uni.getFileSystemManager`；自定义基座未编入该模块时回退剪贴板。

返回 `Promise<string>`。

## `EmKit.getLogText()` / `EmKit.clearLogs()`

读取/清空日志缓冲。返回 `string` / `void`。日志包含 `[emkit:<ns>]` 前缀，可按命名空间过滤。

日志级别通过 `EmKitConfig.logLevel` 或 `setLogLevel()` 控制；`logPayload` 默认关闭，打开后会记录 SDK 原始 payload，生产环境慎用。详见[配置参考](./CONFIG.md)。
