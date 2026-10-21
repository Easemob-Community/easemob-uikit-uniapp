# 更新日志

## 1.0.0-rc.1（2026-10-21）

首个 1.0 候选版本。能力范围：单聊、群聊、联系人、多场景扩展与 AI 流式消息；五端为 uni-app x（Android / iOS / 鸿蒙）、H5 与微信小程序。

### 首发能力

- **会话与消息**：会话列表（筛选 tab、搜索、置顶、免打扰、未读、草稿、连接状态条）、聊天页（文本/图片/语音/视频/文件/自定义消息、引用、撤回、失败重发、单聊已读回执、typing、时间分隔、历史加载、键盘避让）。
- **群聊**：群列表、建群、群资料、成员宫格与成员管理、邀请/移除成员、管理员设置、转让群主、退群/解散、群公告、全员禁言、@ 提及、群系统通知。
- **通讯录**：通讯录入口页、好友列表（字母索引、搜索、删除好友）、好友申请与群邀请处理、拼音适配器注入口。
- **多场景扩展**：`sendText` 业务 ext、`sendCustom` + `#custom-message` 整卡插槽、`#banner`、`#input-toolbar`、`title`/`showAction`、`insertLocalNotice`、快捷回复、业务长按菜单、单会话未读。
- **AI 流式消息**：`onStreamMessage` 分片合并、丢片补偿、纯文本打字机光标与异常提示、`#stream-message` 富格式插槽、分片合批与跟随滚动。
- **工程能力**：明暗主题与跟随系统、中英文、设计变量、连接状态条、日志导出、微信小程序 SDK 分包、鸿蒙真机签名指引。

### 新增

- **平台能力开关**：新增 `PLATFORM_CAPABILITIES`（`videoPreview` / `filePick` / `fileOpen`），组件按端显隐入口。视频播放仅 H5 可用，小程序与 App 隐藏播放按钮；文件发送在 App 内置入口隐藏；文件打开/下载未接入，文件气泡改为纯展示，不再弹「暂不支持」。
- **App 附件能力注入**：新增 `EmKit.setAttachmentProvider(provider)` / `EmKit.pickAttachments(options)` / `EmKit.resolveAttachment(uri)` / `EmKit.attachments` / `EmKit.canPickAttachment`。UIKit 不静态依赖任何文件选择器 UTS 插件；宿主注册 provider 后输入栏「文件」格自动出现。附件 `temporary: true` + `release(path)` 的临时副本在发送成功、重发成功、删除消息或登出时由 UIKit 清理，失败消息保留供重发。`sendFile` 的 `EmPickedFile` 同步扩展 `mimeType` / `temporary` / `release`，原生端透传 `MiniAppFile.type`。
- **Token 与连接生命周期**：`EmKitConfig` 新增 `onTokenWillExpire`（返回新 token 自动续期）与 `onTokenExpired`；新增 `EmKit.renewToken(token)`；`EmKit.state` 新增 `reason` / `errorCode` / `reconnecting` / `reconnectAttempt`，`CONNECTION_STATUS` 新增 `reconnecting`。
- **连接状态条**：`em-conversation-page` / `em-chat-page` 顶部内置 `em-connection-banner`，按 `status` / `reason` 显示连接中、重连中、网络异常、设备超限、Token 过期；新增 `showConnectionBanner` 属性可关闭。
- **未读清理接口**：新增 `EmKit.clearConversationUnread(conversationId, chatType)`，供宿主在自建入口清理服务端未读。
- **语言偏好持久化**：新增 `initLocale` / `setLocale` / `getLocale` 与 `EmKit.setLocale`，偏好存 `emkit.locale`；未设置时跟随系统语言（英文环境用 en），`EmKitConfig.locale` 支持初始化时指定。
- **会话列表自动同步**：`em-conversation-page` 新增 `autoSync`（默认 `true`），首次挂载拉取会话快照，宿主漏调 `syncConversations` 也不会出现空列表。
- **聊天页返回契约**：`em-chat-page` 新增 `back` 事件与 `autoBack` 属性（默认 `true`，保持原行为；`false` 时只发事件，由宿主接管退场）。
- **日志隐私开关**：新增 `EmKitConfig.logPayload`（默认 `false`）。好友与群同步的原始 payload 仅在 `logLevel = 'debug'` 且显式开启时序列化入日志，生产默认不记录 userId、昵称等原始数据。
- **录音参数**：`startRecord()` 新增可选 `EmRecordOptions`。

### 变更

- **引用协议互通**：发送时同时写入 `ext.msgQuote`（主协议）与 `ext.emQuote`（0.x 兼容字段）；接收优先解析 `msgQuote`，旧消息回落 `emQuote`。`EmQuoteInfo` 新增可选 `thumbUrl`。
- **未读清零时机**：进入会话、当前会话收到消息、离开聊天页三处清理服务端未读（按会话 2 秒合批）。
- **消息内存上限**：非当前会话只保留最近 100 条（`CONVERSATION_MESSAGE_RETAIN_LIMIT`），离开当前会话时同样裁剪；被裁剪的会话下次进入重拉最新一页，避免游标指向已丢弃的消息。当前会话在单次会话内不设上限。
- **输入栏收起交互**：输入栏 emoji/媒体面板或软键盘展开时，点击消息区即收起（`em-chat-inputbar` 新增 `collapseSignal` 属性，聊天页点击消息区时递增；打开面板前自动收键盘，面板与键盘不再同时占高度）。
- **配置清理**：移除只存不用的 `EmKitConfig.showTime`；逐条消息时间由聊天页时间分隔条承担。
- **发布物料**：插件版本 `1.0.0-rc.1`；平台矩阵按 HBuilderX 4.71+ 规范更新；补充暗黑模式、多语言、宽屏声明与相机/相册/麦克风权限、数据声明；根目录补 MIT `LICENSE`；示例工程清除签名路径与密码。

### 修复

- **输入栏被键盘遮挡（鸿蒙 / iOS）**：修复键盘弹起后输入栏底部仍被压住一截。根因是同一份键盘高度被当成两种口径混用——「面板口径」（iOS/鸿蒙上报值含底部安全区，面板自身还有 safe-bottom padding，故扣除后交给面板）被直接写进了输入栏的 `margin-bottom`（应为「上推口径」= 从屏幕底边算起的实际遮挡高度）。实测少顶量恰为一个底部安全区：鸿蒙 28vp / 84px、iOS 34pt / 102px。`useKeyboardHeight` 拆分 `keyboardHeight`（面板口径）与 `keyboardLift`（上推口径 = 上报值原值），输入栏 `margin-bottom` 使用后者，面板高度仍用前者；新增 `resetKeyboardHeight()` 统一清零。
- **iOS 登录失败（自定义基座缺 `uni-getNetworkType` 模块）**：websdk 5.1.3 默认 runtime 在 `login → 建连` 阶段会同步调 `uni.getNetworkType` 探测网络类型，iOS/Android 自定义基座没编入该可选 UTS 模块时报 `undefined class: UTSSDKModulesDCloudUniGetNetworkTypeIndexSwift`，表现为登录失败。改为经 `platformAdapterOptions.overrides` 覆盖 runtime：只监听 `uni.onNetworkStatusChange`（失败降级为不监听），不再依赖 `uni.getNetworkType`，登录不再需要为一条诊断信息重打基座。
- **App 导出日志失败**：`EmKit.exportLogs()` 写文件时 `encoding` 传了 `'utf8'`，而 App 端 `FileSystemManager.writeFile` 只接受 `ascii` / `base64` / `utf-8`，非法值直接失败（错误码 1200002），表现为只弹「写文件失败，已复制到剪贴板」；微信小程序同时接受 `utf8`，所以只在 App 复现。已改为 `'utf-8'`，并在 `USER_DATA_PATH` 缺失时提前失败、失败原因写入日志。另需明确：小程序与 App 的导出路径是**应用沙盒**，文件管理器不可见，真机取日志请用剪贴板或由宿主分享该文件。
- **App 附件发送失败（`Miniapp file read failed`）**：SDK 每次上传前都会用 `uni.getFileSystemManager().readFile` 计算附件 md5，而 App 的文件系统只能读 uni 沙盒目录；宿主文件选择器把临时副本放在系统缓存目录时读取失败，整条附件消息随之发送失败。已在 `platformAdapterOptions.overrides` 中包装图片处理器：md5 读取失败时降级为不携带 md5 继续上传（`uni.uploadFile` 原生读文件，不受该限制），图片宽高与大图处理保持原行为。
- **未读复活**：修复「读完消息回到列表或冷启动后未读数回升」。
- **录音静默丢弃**：录音改为单例监听，新增 `onError` 回调（麦克风权限失败时提示）；达到 60 秒上限自动停止后按正常语音发送，不再静默丢弃。
- **首屏历史闪烁与失败无出口**：聊天页首次历史请求结束前显示气泡骨架，不再先闪「暂无消息」（500ms 后只解除透明度）；历史加载失败给出 toast 与「点击重试」，已有缓存消息时改为顶部重试行，不遮挡消息。

### 升级说明

- 依赖：`easemob-websdk` 为 peer 依赖，精确锁定 `5.1.3`。
- 0.x 未正式发布，直接按 1.0 文档接入即可。
- 若从仓库旧提交升级：引用消息会双写 `msgQuote` + `emQuote`，新旧客户端可互读；业务 `ext` 不要占用这两个 key。
- `em-chat-page` 默认返回行为不变；需要拦截返回（如未保存的表单）时传 `:auto-back="false"` 并监听 `@back`。
- 示例工程的 `manifest.json` 不再包含鸿蒙签名配置，本地真机运行需在 HBuilderX 中重新配置签名（步骤见文档门户「鸿蒙真机运行与签名」一页）；签名材料不要提交到仓库。

### 已知限制

- 视频播放仅 H5；App 与小程序隐藏播放入口，只展示封面与时长。
- 文件打开/下载全端未接入，文件气泡为纯展示。
- App 端不支持发送文件（无跨端通用文件选择器），入口已隐藏。
- 语音发送仅 App 与小程序；H5 隐藏录制入口，只能接收播放。
- H5 为移动端布局，未做桌面宽屏适配。
