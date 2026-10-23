# 更新日志

## 1.0.0-rc.2（未发布）

### 修复

- **App 端弹层偶发「底部 tabBar 收起但弹层不出现」**：蒸汽端（uni-app x App）新建 `v-if` 分支时，新分支的视觉节点会偶发整批不建（只建出命中区），表现为「底部 tabBar 已被收起、弹层却看不见，且整页点击被透明命中区吞掉」（Android 真机实测约 3/12，与点击位置、tabBar 隐藏、延迟补写无关）。`em-popup` 改为**常驻挂载**：去掉 `v-if`，页面挂载时就把 root/遮罩/面板建好；关闭态用根节点内联 `top: 200%` 移到视口下方（不绘制、不吃点击），打开/关闭只改这一个内联样式，不再创建/销毁节点。同时默认态即最终态（遮罩默认不透明、面板默认在最终位置，去掉 `--show` 类与 250ms 进出场动画）。真机 14/14 次开合全部正常、每次 tabBar 如实归还（改前 3/12 失败）。同类弹层（长按会话菜单、选人、@提及、聊天页长按菜单）一并修复；原生 tabBar 持锁同时改为实例级「谁持有谁释放」，`releaseTabBar()` 在计数为 0 时不再调 `showTabBar`。

- **iOS 拍摄黑屏**：iOS 相机授权被拒绝后，`uni.chooseImage` 仍会打开系统拍摄页并停在纯黑画面且不再弹窗。`em-chat-page` 在调起相机前用 `uni.getAppAuthorizeSetting` 预检 `cameraAuthorized`：`denied` 弹窗引导到系统设置（`uni.openAppAuthorizeSetting`），`config error` 提示安装包缺少权限描述；`not determined` 仍交给系统首次弹窗。新增 `getCameraAuthorizeState` / `openAppAuthorizeSetting` 从 `libs` 透出；H5/小程序/未知基座跳过预检，行为不变。示例工程在 `app-ios.distribute.privacyDescription` 补齐相机/相册/麦克风用途描述（改后需重新云打包或重打自定义基座生效）。
- **`primaryColor` 在 App 端不生效**：页面级组件根节点同时绑定主题 class 与内联品牌色变量，而 App（uni-app x）端同一节点上 class 规则定义的 CSS 变量会顶掉内联同名变量，导致 `EmKit.init({ primaryColor })` / `setConfig({ primaryColor })` 在 App 端一直被主题值覆盖。七个页面级组件统一新增品牌作用域内层节点，内联品牌色变量下沉一层（与主题 class 分节点），App 端品牌色恢复正常。
- **App 视频播放页黑屏（自定义基座缺 `uni-video` 模块）**：视频组件属于 uni-app x 内置模块 `uni-video`，会按代码用量摇树。基座如果是在接入视频组件之前打的，`<video>` 会被降级成 `<view>`，表现为点开播放器后全屏黑屏、无控制条。示例工程在 `manifest.json` 的 `app` / `app-android` / `app-ios` / `app-harmony` → `distribute.modules` 显式声明 `"uni-video": {}`；宿主接入视频后需重新打一次自定义基座，JS 热更不包含原生模块。
- **iOS 视频一直转圈 `00:00`**：EaseMob chatfiles 直链无扩展名且不支持 HTTP Range（带 `Range` 仍返回 200 全量），iOS AVPlayer 远程渐进播放会卡死。App 端改为 `uni.downloadFile` 整包下载 → 复制为本地 `.mp4` → 播放；下载期显示进度，关闭时中止，同一 URL 会话内缓存。
- **iOS 视频进度条在走但画面不动**：原生 `autoplay` 会在 `<video>` 事件绑定前起播，`play` 事件丢失后组件一直保留首帧/封面层。改为 `autoplay=false`、挂载后显式 `createVideoContext().play()`（未收到 `@play` 每 500ms 重试），且不再把 `poster` 传给 `<video>`（封面只用于下载 loading 背景）。iOS 真机已验证画面随进度更新。
- **账号切换与异步时序一致性**：会话、联系人、群读取增加账号代次与请求顺序保护，登出后的旧响应不能恢复已清状态或复用旧 pending；同账号旧会话快照不覆盖新快照。会话刷新失败不再回退为内存空成功，联系人重试使用 SDK 受控刷新；后台同步失败直接进入列表重试态并保留缓存。SDK 没有群全量手动重启同步 API，群列表在失败后明确提示恢复连接或重新登录，不把内存重读当作同步成功。
- **操作与编辑并发一致性**：删除会话、删除好友、退群/解散共享提交与完成锁，只产生一次成功事件。失败重发在 domain 按会话与消息共享实际结果；切换会话或编辑输入期间，旧发送/选择器完成回调不会误清新草稿、引用、@选择或解锁新请求，未发送的宿主临时附件会按 `release` 契约清理。好友快照会把历史 pending 申请收敛为已接受并同步未读角标；两人英文群通知修正为 `1 other`。

### 新增

- **聊天详情页删除好友**：`em-chat-info-page` 单聊分支新增「删除好友」按钮（红色字档），仅对方已是好友时显示；二次确认后删除，带提交锁，成功 toast 并新增 `contact-deleted` 事件通知宿主退场（不连带删除会话与本地消息），失败 toast 停留当前页。
- **消息删除、复制与提交防重**：新增 `EmKit.deleteMessage(message)`，有服务端 ID 时先删当前账号的漫游历史再删本地，失败保留气泡，删除后校正会话摘要与时间；保留 `deleteLocalMessage` 作为显式本地删除入口。聊天页删除增加确认与失败提示，复制按系统结果提示成功或失败。`em-chat-inputbar` 新增 `submitting`，`em-quick-reply-bar` 新增 `disabled`，文本发送、直发快捷回复、失败重发与撤回均拦截重复提交，撤回执行时重新检查时间窗。
- **通用提交态与加载失败重试**：`em-button` 新增 `loading`（默认 `false`），加载中显示 JS 驱动的旋转图标并拦截点击；`em-select-contact` 新增 `submitting`（默认 `false`），提交中禁止选择、重复确认与关闭；`LOAD_MORE_STATE` 新增 `ERROR`，加载失败可点击重试。
- **会话与群管理操作闭环**：会话置顶/免打扰按会话与设置项独立串行并保护最新意图；删除会话、清空记录、删除好友、退群/解散增加确认与提交锁。群管理补设撤管理员/转让/移除确认、权限重验、保存中关闭保护；移除后强制刷新群详情与成员首屏，`getGroupMemberList` 以 `applied` 标识响应是否实际写入 store。
- **选择异常与列表失败恢复**：图片、视频与内置文件选择区分用户取消和真实失败，取消静默、失败提示；会话、好友、群列表及聊天/群成员分页在无缓存失败时提供重试，有缓存时保留列表。
- **输入栏多行输入**：新增 `inputFeatures.sendOnReturn`（默认 `true`，对齐微信「回车键发送消息」）：置 `false` 进入换行输入模式，输入框随打字生长（封顶 5 行，超出内部滚动），回车换行、发送走输入栏右侧的纸飞机发送键；`true` 时回车发送（iOS 上输入框仍可随粘贴内容生长，Android 保持单行输入）。
- **视频消息全端播放**：新增 `em-video-preview` 全屏播放器（原生 `video` + 安全区关闭键 + 加载失败提示），聊天页点击视频消息即播放；`PLATFORM_CAPABILITIES.videoPreview` 全端 `true`，App/小程序不再隐藏播放入口，H5 由新窗口改为内置播放。App 端会先把视频下载到本地再播放（EaseMob chatfiles 直链不支持 Range，iOS 直接远程播放会卡 loading），下载期显示进度、关闭时中止；点击前会停掉正在播放的语音，关闭或离开页面时释放原生播放器。
- **组件样式透出**：所有页面组件与原子组件新增 `custom-class` / `custom-style` 属性，用于在组件根节点追加宿主 class 与内联样式。`custom-style` 拼接到根节点内联样式末尾，五端生效且支持 `var()`；弹层类组件（`em-action-sheet`、`em-select-contact`、`em-mention-picker`）两属性落在最外层遮罩容器上。
- **样式定制指南**：文档门户新增「样式定制」一页，汇总 `primaryColor` 配置、`--em-*` 变量、`custom-class` / `custom-style`、具名插槽四条定制通道的选型与平台边界；示例工程「样式实验室」页面新增 custom-style / custom-class / 变量覆盖三组对照演示，以及「拖动色相条实时换全页主题色」演示（根节点内联变量 + `setConfig` 双通道）。

### 变更

- **输入栏发送键改为纸飞机**：不再常驻文字「发送」按钮，右侧发送位与「+」同槽互斥——草稿为空显示「+」媒体入口，草稿有内容时换成品牌色纸飞机发送键（`plane`）。输入框不再被发送按钮挤窄，空草稿也不会出现无反馈的发送键。

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
