# 常见问题

这页按“症状 → 优先检查 → 处理”组织。接入步骤见 [快速开始](./QUICKSTART.md)，平台差异见 [平台能力与差异](./PLATFORM.md)。

## 环境与接入范围

### 能在经典 uni-app 或 uni-app x vdom 模式工程里使用本插件吗

不能。本插件仅支持 **uni-app x 蒸汽模式（Vapor）**：页面需 `.uvue` + `main.uts` 入口，`manifest.json` 开启 `uni-app-x.vapor`，并要求 HBuilderX 5.21+。经典 uni-app（Vue2/Vue3、nvue）与 uni-app x 的 vdom 模式均不提供兼容。

背景与升级路径：DCloud 官方已于 2024 年停止 nvue 与 5+ 的维护，并将于 2027 年初停止 uni-app 的 App 平台与 uni-app x vdom 平台的维护；uni-app x 蒸汽模式已兼容 js/ts 写法，老 uni-app 工程可方便升级。依据见 [DCloud 官方文档 · FAQ「老 uni-app 还维护吗？」](https://doc.dcloud.net.cn/uni-app-x/)，升级指引见官方「uni-app 升级 uni-app x」专题。

### HBuilderX 5.34 引入 SDK 后报 `Identifier "h" has already been declared`

这是 HBuilderX 5.34 编译链的已知问题，不是 UIKit 业务代码导致。DCloud 已在 [issue #34492](https://issues.dcloud.net.cn/pages/issues/detail?id=34492) 中确认，并回复将由 HBuilderX 后续修复。

当前在宿主工程根目录新增 `vite.config.ts`：

```ts
import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';

export default defineConfig({
	plugins: [uni({
		autoImportOptions: {
			ignore: ['h']
		}
	})],
});
```

已有 `vite.config.ts` 时，将 `autoImportOptions` 合并到现有 `uni()` 配置中，保留其他插件配置。无需重打包或覆盖 `node_modules/easemob-websdk`；保存配置后重新编译。

## 平台与设备差异

### 同一份代码在不同机型上表现不同，是 UIKit 的问题吗

先按四步判断，再决定报给谁：

1. **版本**：HBuilderX ≥ 5.21、UIKit 是否为当前版本（见[更新日志](/uniapp/guide/changelog)）、`easemob-websdk` 5.2.0、小程序基础库 ≥ 2.11.2 是否一致；App 端是否重新打过自定义基座。
2. **范围**：同一产物换一台同系统版本的设备是否正常；只在一台设备出现时，记录厂商、型号与系统版本。
3. **复现**：新建空白 uni-app x 蒸汽工程，只调用对应的 `uni.*` API（如 `uni.chooseVideo`、`uni.onKeyboardHeightChange`）。能复现属于上游或平台，提交 uni-app x 官方 issue；不能复现再在示例工程复现。
4. **登记**：确认归因后记录到[设备与端差异](./PLATFORM-DEVICES.md)，其中「反馈需要的信息」可直接作为 issue 模板。

## 页面与布局

### 页面白屏 / 列表或输入栏高度为 0

**优先检查**：

1. 页面根节点是否有确定高度：`height: 100%`，父级 flex 链是否完整。
2. 聊天页/会话页内部是否是 `flex: 1` + `height: 0` 的 `scroll-view`。
3. 页面是否放在 `subPackages` 中，路径是否正确。

```css
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
```

### 出现双导航栏

聊天页、聊天信息页、会话页、通讯录页都自带 `em-nav-bar`。宿主 `pages.json` 需要对它们设置：

```json
{
  "navigationStyle": "custom",
  "app-plus": { "titleNView": false }
}
```

漏配就会出现系统导航栏 + 组件导航栏两层标题。

### 鸿蒙深色页面上下拖动时露出白边

这是宿主页面容器发生整体回弹，露出了默认白色窗口底色，不是 UIKit 内部列表的背景色问题。在对应页面的 `pages.json` → `style` 中设置：

```json
{
  "disableScroll": true
}
```

该配置禁止页面整体拖动，不影响会话、消息等内部 `scroll-view` 的滚动。需要逐页配置，写在 `globalStyle` 中无效；需要使用页面级下拉刷新的页面不要开启。

### 小程序右上角按钮压住聊天页操作入口

`em-nav-bar` 已按胶囊位置预留右侧空间；如果宿主替换了导航栏或自定义了右上角操作，需要按同样规则避让。不要直接把按钮固定在 `right: 12px`。

### 键盘弹起把导航栏顶飞

UIKit 的输入栏使用手动避让：输入框 `adjust-position=false`，按键盘高度顶起输入栏，导航栏不动。宿主页面如果自己包了一层输入框，需要采用同样策略；不要让页面整体被系统推上去。平台细节见 [平台能力与差异](./PLATFORM.md)。

### App 端页面白屏且控制台没有任何报错

真机整页白屏、控制台没有任何报错时，优先怀疑「组件渲染期抛了异常被引擎吞掉」，而不是样式/布局问题：蒸汽端（uni-app x App）不冒泡组件 setup / 首次渲染期的 `ReferenceError`，页面白屏且控制台干净。

**排查**：diff 最近改过的组件，检查 `<script setup>` 作用域里新引用的标识符是否都有定义——尤其注意模板自动暴露的 props 名在 script 里不可用（要写 `props.xxx`）。CLI 构建不做这类检查，构建成功不代表运行正常。

**预防**：给组件加新的计算属性/方法后，自查一遍标识符定义；H5 上不报错也不等于 App 端安全（桌面端可能被重渲染掩盖）。

### App 端自绘弹层偶发不出现、整页点击被吞

仅在宿主**自己用 `v-if` 实现弹层/浮层**时出现：打开弹层时新建分支的视觉节点偶发整批不建（只建出命中区），表现为弹层不可见、整页点击被透明层吞掉，再点一次只是把弹层关掉。UIKit 内置弹层（action sheet、选人、@提及、长按菜单）已改为常驻挂载，不受此影响。

**规避**：弹层树常驻挂载——页面挂载时就把节点建好，关闭态用根节点内联样式（如 `top: 200%`）把整棵树移到视口下方（不绘制、不吃点击），打开/关闭只改这一个内联样式。进场动画用 JS 逐帧写内联位移，并保证任意一帧写入丢失时终态仍可见；不要依赖「隐藏初始态 + 挂载后翻 class」的 CSS 动画写法（App 端 CSS 动画不执行，见 [平台能力与差异](./PLATFORM.md)）。

**全屏弹层的顶部安全区**：由内容节点自己注入 `padding-top: getSafeAreaTop()`（`getSafeAreaTop` 见 [工具函数](./API-UTILS.md#平台与媒体)），内容高度同步扣除同一值；iOS 蒸汽端全屏弹层容器的 padding 不参与布局，不能靠弹层容器承载顶部安全区，否则底部确认键会被顶出屏。

### App 端多行输入框高度异常 / 无底色无占位符

App 端 `textarea` 是原生组件（iOS 为 UITextView）：`flex:1` 不生效，背景、圆角等装饰样式渲染不可靠；`auto-height` 与 JS 固定高度混用还可能出现先高后低、清空后仍残留多行高度。自绘输入栏（`#input-bar` 插槽）或业务页面里用到 textarea 时：

- 尺寸与装饰（高度、灰底、圆角、裁切）由外层包裹 `view` 承担；
- 使用固定 px 行高并始终显式设置 textarea 高度，不要依赖 `auto-height` 的二次重测；`linechange` 只取行数，不拿事件高度反推行高；
- 空草稿由草稿状态直接恢复单行高度，长草稿在首个原生事件前就先按最大行数封顶；
- iOS 另设 `disable-default-padding` 去掉默认内边距。

UIKit 内置多行输入区使用固定 19px 行高，按 `19 × min(行数, 5)` 计算文本区高度，包裹层额外承担上下内边距。自绘输入栏契约见 [聊天页](./PAGES-CHAT.md)。

### H5 刷新 404

H5 使用 history 路由时，服务端需要把未知路径 fallback 到 `index.html`。本地静态预览直接访问构建产物即可；生产环境请配置 rewrite。

## 登录与连接

### 登录后立刻被踢回登录页

不要用 `EmKit.state.status !== 'online'` 判断未登录。断网重连时 `status` 会短暂变成 `reconnecting` 或 `closed`，但用户仍然已登录。正确判断：

```ts
if (EmKit.state.userId === '') {
  // 未登录
}
```

### 没登录就打开聊天页，为什么显示「请先登录」

聊天页会检查 `EmKit.state.userId`。空账号时不等待连接超时，立即显示「请先登录」并发出 `unauthorized` 事件，宿主可在这里跳登录页或展示自己的登录入口。登录成功后当前聊天页会自动重新加载历史；已登录但断线重连不会误报未登录。

### Token 过期后无法自动恢复

实现 `onTokenWillExpire`，由宿主服务端签发新 token 并返回；UIKit 会自动续期。Token 已经过期时，`onTokenExpired` 会被调用，通常在这里跳登录页。

```ts
EmKit.init({
  appkey: 'your-appkey',
  onTokenWillExpire: async () => await fetchNewImToken(),
  onTokenExpired: () => uni.reLaunch({ url: '/pages/login/login' })
})
```

### 连接状态一直是 `connecting`

检查网络、appkey 与 token 是否匹配；查看 `EmKit.state.reason` / `errorCode`。如果开启了 `logLevel: 'debug'`，可用 `EmKit.exportLogs()` 导出日志。

### 同一设备换账号后看到上一个账号的数据

正常 `EmKit.logout()` 会清空账号私有状态。如果宿主自己管理登录态，请确保退出时调用 `await EmKit.logout()`，不要只跳登录页。

## 设备标识

### 设备标识（deviceId）是怎么生成和持久化的

UIKit 默认在 `EmKit.init()` 时向 SDK 注入固定 deviceId（`enableDeviceInfo` 总开关，默认开启，关闭则停止自动注入、SDK 用默认行为）。自动派生的格式与优先级：

- **格式**：固定为三段式 `Platform_uikitVersion_uuid`（例 `android_1.0.5_<uuid>`）。为避免设备型号合规风险，不包含品牌、型号或系统版本；旧六段式持久化值会自动按三段式重新派生。
- **优先级**：当前格式的持久化值（本地存储 key `emkit.device.id`）→ `uni.getDeviceInfo()` 框架设备标识 → 自生成 UUID。一经得出即持久化，跨启动保持稳定。设备 API 只请求 `deviceId/platform/osName` 必要字段。
- **显式覆盖**：宿主传入 `config.deviceId` 时原样使用、不加任何段；`devicePlatform` 是向环信申请注册的 1–100 编号，传入后 SDK 会把 resource 改写为 `custom<N>_` 形态。

相关配置见 [配置参考 · 设备信息](./CONFIG.md#设备信息)。

### 控制台里的 resourceId 和注入值对不上

环信控制台设备列表的 resourceId 不是 UIKit 注入值的原样展示，差异来自 SDK 侧两步处理：

1. websdk 会给注入的 deviceId 再拼一层 `webim_${平台}_` 前缀——看到的 `webim_web_...` 开头是 SDK 拼的，不是 UIKit 产生的；UIKit 注入值位于尾部。
2. SDK 的 `useFixedDeviceId` 默认开启且**本地历史值优先**（浏览器 localStorage key `websdk2:device-info`）：老用户浏览器里已有历史值时，init 传入的 deviceId 会被忽略，表现为 resourceId 出现双层前缀、注入不生效。UIKit 注入 deviceId 时会同步关闭该开关，无需宿主处理。

**确认本机当前 deviceId**：读本地存储 key `emkit.device.id`（H5 在浏览器 DevTools 的 localStorage 里看；App/小程序经各自调试工具查看），或登录后在环信控制台设备列表看 resourceId 尾段。

### 升级 UIKit 后设备列表多了一台设备

自动派生的 deviceId 带 UIKit 版本段，升级 UIKit 后版本段变化，服务端会视为新设备，旧记录会随登出/超时消失。这是设计行为：版本段让服务端可以区分不同 UIKit 版本的接入。已持久化的旧格式值会在下次启动时自动按新格式重新派生，无需手动清理。

**想强制重新生成 deviceId**：删除本地存储 key `emkit.device.id`（H5 清 localStorage；小程序/ App 清除应用缓存）后重启应用即可。

## 会话与消息

### 会话列表为空

- 是否已登录（`EmKit.state.userId` 非空）。
- 是否关闭了 `em-conversation-page` 的 `autoSync`；关闭后需要自己调 `EmKit.syncConversations()`。
- 从聊天页返回时，是否在 `onShow` 补调 `syncConversations()`。
- 用 `logLevel: 'debug'` 看同步日志与错误。
- **鸿蒙端不要开 `sdkLogLevel: 'DEBUG'`**：SDK 的 DEBUG 级日志脱敏会对二进制帧调用 `Object.entries`，而 ArkTS 运行时不支持该用法，会抛 `Object entries is not supported` 并让会话列表同步整体失败（列表退化为本地缓存，缓存为空时看起来像「加载失败」）。UIKit 默认 `sdkLogLevel` 就是 `WARN`，需要 SDK 原始日志请在其它端复现。
- **空列表与同步失败是两种状态**：没有任何会话时页面显示空态；同步失败时也落在空态上，只在空态里多一个「重试」入口，不会整页替换成错误提示。所以看到空态但确认账号里有会话时，先看日志里有没有 `conversation sync failed`。

### 好友/群列表为空

登录后 SDK 会后台同步联系人/群。列表通过 `loaded / syncing / syncFailed` 区分未加载、加载中、失败与权威空列表；失败时先检查网络与 SDK 连接状态。`EmKit.syncContacts()` 会调用 SDK 受控刷新；`EmKit.getJoinedGroups()` 只读群快照，SDK 没有群全量手动重启同步 API，群同步失败后需恢复连接或重新登录，不能把内存重读当作同步成功。

### 未读清零后回列表又出现

聊天页会在进入、当前会话收消息、离开时清服务端未读（按会话合批）。如果宿主自建了消息入口，读完消息后调用：

```ts
EmKit.clearConversationUnread(conversationId, chatType)
```

### 发送一直失败

- token 是否过期；
- 当前是否 `online`（看连接状态条）；
- 图片/语音/视频/文件是否超过服务端限制；
- 失败消息是否显示红色感叹号，点击可重发；
- 查看 `EmKit.state.errorCode` 与日志。

### 引用卡不显示

- 业务 ext 是否覆盖了 `msgQuote` / `emQuote`；
- 对端是否为支持引用协议的版本；
- 引用摘要是否为空（空文本消息可能没有可展示摘要）。

### 群消息没有 @ 高亮 / 群列表没有 @我 徽标

- 仅群聊支持；
- 发送时 `mentions` 是否传了有效 userId；
- 对端是否写入 `ext.em_at_list`；
- 昵称含空格时，高亮只到第一个空格。

### 消息列表没有自动滚到底

- 聊天页进入、收新消息、键盘弹起时会滚底；
- 如果用户主动上翻，流式消息会暂停跟随，回到底部或主动发送后恢复；
- 宿主自绘列表需要自己维护滚动锚点。

## 媒体与平台能力

### H5 没有语音按钮

当前版本 H5 不支持录音，语音入口自动隐藏。文本、图片、视频选择、文件发送可用；详见 [平台能力与差异](./PLATFORM.md)。

### App 文件按钮的显示条件

App 未内置通用文件选择器。宿主注册附件 provider 且当前可用时，输入栏显示「文件」入口；未注册或 provider 不可用时入口隐藏。可用 `EmKit.canPickAttachment`（或响应式 `canPickAttachment()`）检查当前状态。小程序与 H5 使用内置文件选择。

### 图片/视频/文件怎么保存或下载

长按图片/视频/文件气泡，在菜单里选「下载」：

- App 与微信小程序：图片/视频保存到系统相册；文件下载到本地后尝试调用系统文档预览打开（App 对 doc/docx/xls/xlsx/ppt/pptx/pdf 指定类型、其他类型交给系统尝试；微信小程序仅支持这七类，其他类型提示无法打开）。
- H5：走浏览器下载，不写相册；跨域直链可能在新标签页打开，文件名以响应头为准。
- 微信小程序需要在微信公众平台配置 `downloadFile` 合法域名，否则下载会被平台拦截。
- 相册权限被拒绝时提示「请允许访问相册后重试」。文件单击与长按「下载」共用本地优先链路：自己刚发送且本地仍可用的文件直接打开；其他文件显示一次下载状态，下载后尝试打开。
- App 端保存相册依赖内置模块 `uni-media`、打开文档依赖 `uni-openDocument`；旧自定义基座没有这些模块时调用会失败，需要重新打自定义基座（与 `uni-video` 同理）。
- 宿主自绘消息卡片时可以调用 `EmKit.downloadAttachment(message)`（或门面导出的 `downloadAttachment`）复用同一套下载逻辑。

### 调试基座能登录，发行包却无法建立长连接

先检查 Android、iOS 的 `manifest.json` 是否都在 `app-android` / `app-ios` → `distribute.modules` 中显式声明：

```json
"uni-websocket": {}
```

环信 SDK 通过运行时适配对象调用 `connectSocket`，uni-app x 的静态摇树可能识别不到，导致发行包漏掉 WebSocket 原生模块。`uni-network`、`uni-getNetworkType`、`uni-fileSystemManager`、`uni-media` 等直接调用通常能自动扫描，不需要因此复制一份全量模块清单。

修改后必须重新打自定义基座或发行包，JS 热更新不会补入原生模块。若仍失败，再检查 token、网络状态与连接日志；不要通过反复 `EmKit.init()` 尝试恢复。

### Android 私有服务提示 CLEARTEXT not permitted

Android 9+ 发行包默认禁止 HTTP 明文请求。优先把服务切换为 HTTPS/WSS；如果宿主其他网络能力确实必须使用 HTTP/WS，在项目原生 `AndroidManifest.xml` 的 `application` 节点增加 `android:usesCleartextTraffic="true"`，然后重新打基座或发行包。该配置属于原生清单，不是 `distribute.modules` 中的模块。

### 视频点击没有播放 / App 播放器黑屏

视频气泡在 App、H5、微信小程序都内置全屏播放器。若点击后停在黑屏或提示「视频加载失败」，按顺序排查：

1. **App 自定义基座**：`<video>` 依赖内置模块 `uni-video`。基座如果是在接入视频组件之前打的，组件会被降级为 `<view>`，播放页只显示黑底，控制台通常报 `uni-video 模块不存在，请重新打自定义基座`。接入视频后重新打一次自定义基座，或在 manifest 的 `app-ios` / `app-android` → `distribute.modules` 显式声明 `"uni-video": {}`（示例工程已配置）。
2. **视频地址/编码**：确认 `message.url` 可访问、格式为设备支持的编码（推荐 H.264/AAC 的 MP4）。
3. **H5 自动播放**：浏览器可能拦截带声音的自动播放，点播放器内的播放键即可。
4. **App 先下载再播**：EaseMob chatfiles 直链不支持 Range，App 端会先把视频整包下载到本地再播放，下载期显示百分比；大视频需要等下载完成，关闭播放器会中止下载。
5. **进度条在走但画面停在首帧**：当前版本已通过「关闭原生 autoplay + 挂载后显式起播 + 不把封面传给 video」处理；若仍出现，确认使用的是最新 UIKit，且没有自行替换播放器。

需要自定义播放器时，宿主可接管 `preview` 事件。

### 图片/语音/视频发送失败

检查对应平台权限：相机、相册、麦克风。用户拒绝权限后，对应功能不可用，但不影响文本收发。小程序还需要检查域名白名单与上传配置。

鸿蒙还有一个额外前提：权限必须写进工程配置才会被系统识别。语音与拍摄要在 `harmony-configs/entry/src/main/module.json5` 的 `requestPermissions` 声明 `ohos.permission.MICROPHONE` / `ohos.permission.CAMERA`；没声明时系统不弹窗、直接拒绝，现象就是「录音失败」或点拍摄无反应。具体写法与两个坑（整文件覆盖、相册无需权限）见 [鸿蒙真机运行](./HARMONY-REALDEVICE-RUN.md)。用 `hdc shell bm dump -n <bundleName>` 可确认权限是否真的进了安装包。

### 点击「拍摄」调起摄像头后是黑屏

先确认不是 iOS 模拟器（模拟器没有摄像头，必黑）。真机上 iOS 在相机权限被拒绝后仍会打开拍摄页并停在黑屏，且系统不再弹窗；UIKit 会在调起前预检 `uni.getAppAuthorizeSetting().cameraAuthorized`，`denied` 时引导去系统设置。若状态是 `config error`，说明安装包没有声明 `NSCameraUsageDescription`，需要在 `manifest.json` 的 `app-ios.distribute.privacyDescription` 补上并重新打包/重打自定义基座。

### 长按菜单弹出后又进入了会话/播放了语音

UIKit 已处理 H5 长按后补发 click 的冲突。如果宿主自定义了长按区域，需要自行吞掉长按抬手时的 click，避免同时触发点击行为。

### App 端触摸拖拽没有反应（点按也无响应）

如果拖拽/滑动定位依赖 `uni.createSelectorQuery().boundingClientRect()` 查询节点位置：蒸汽端（App）该查询可能拿不到有效矩形，就绪标记永不置位，touch 事件被静默跳过且控制台无任何报错。

**规避**：几何可推导的位置同步计算——例如通栏拖拽条用 `uni.getWindowInfo().windowWidth` 减已知页面边距，`touchstart` 时即可用，不做异步查询；`createSelectorQuery` 只作增强/兜底。scroll-view 页面里拖拽期间用 `:scroll-y="!dragging"` 锁定滚动，防止手势被滚动接管。

## 主题与图标

### 暗色模式下局部还是浅色

页面根节点绑定 `themeClass`，宿主自定义颜色改用 `--em-*` 变量。App 端没有 `:root`，变量必须从页面根节点向下传递。

### 切主题后系统导航栏没变

原生 chrome 不随页面 class 变化，需要在 `onShow` 或切换后调用 `syncNativeThemeUI()`。

### 小程序图标空白

- 确认 `em-icons.ttf` 与 `em-icon.css` 一起打包；
- 微信小程序会按字体族名缓存 `@font-face`，升级字体后需要递增族名版本；
- 不要只替换 ttf 而不更新 CSS 内联字体或码点映射；
- 运行仓库内的图标校验脚本可定位空字形/映射缺失。

### 原生 tabBar 图标不显示

原生 tabBar 的 `iconPath` 只接受图片，不接受字体图标。使用 `scripts/build-tabbar-icons.py` 从字体生成 PNG，或自备 81×81 PNG。

## 小程序分包

### `module 'sub-sdk/im-sdk.js' is not defined`

按当前实际打开的 dev/build 产物目录检查：

1. `sub-sdk/im-sdk.js` 是否存在，dev 重编译期间是否保持 `dev:mp` 或 `watch:mp`；
2. `pages.json` 是否声明 `sub-sdk` 普通分包与 `preloadRule`；
3. `project.config.json` 的两个 ignore 项是否均为 `false`；
4. 如果存在 `project.private.config.json`，其中两个 ignore 项是否也为 `false`——私有配置会覆盖公共配置。

直接运行 `npm run build:mp` 可完成编译、后处理和检查；单独复查用 `npm run check:mp`。完整步骤见 [微信小程序分包接入](./GUIDE-WEAPP-SDK-SUBPACKAGE.md)。

### 微信提示“项目根目录未找到 `app.json`”

这不是分包加载错误，而是 HBX 没有生成完整产物。先查看并修复 HBX 控制台中的模板或脚本编译错误，再重新执行 `npm run build:mp`。不要手工创建一个空 `app.json` 绕过编译。

### 主包超过 1.5MB

按分包指引把 websdk 移到 `sub-sdk`，并运行 `check-mp-size.mjs` 做防回归检查。不要把 SDK 静态 import 回主包。

## 包体积

### 没用到群聊，产物里却有 `em-group-page`

说明 `pages.json` 里还声明着群组页。UIKit 只编译宿主声明过的页面，把它从 `pages.json` 删掉（连同页面文件）即可，产物里对应的组件目录会一起消失。核对方法见 [按需接入与包体积](./GUIDE-ON-DEMAND.md)。

### 关掉了 `inputFeatures.video`，包体积没有变小

配置项只影响渲染与交互，不影响编译范围。语音、视频、文件、@ 提醒等组件由聊天页静态引入，只要声明了聊天页就会进包。要让它们消失，只能不声明该页面，或改用原子组件自绘。

## 群组与联系人

### 群邀请点“同意”后没有入群

群邀请与好友申请共用申请列表，但处理链路不同。确认 `invite.kind === 'group'` 时走 `acceptGroupInvite`，不要走好友接受接口。UIKit 页面组件已按 kind 分流。

### 群成员管理没有入口

- 群成员宫格常驻一个假搜索框，点击进入成员管理；
- 成员数超过 8 时还有“查看全部”入口；
- 只有群主/管理员能邀请、移除、设置管理员、转让群主；
- 全员禁言时普通成员输入栏被禁用。

### 通讯录字母索引不准

中文昵称需要宿主注入拼音适配器 `setPinyinAdapter()`；未注入时非 A-Z 归入 `#` 组，搜索只按原文匹配。

## 日志与排查

```ts
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'

EmKit.init({ appkey: 'your-appkey', logLevel: 'debug' })
// 复现问题后
const result = await EmKit.exportLogs()
console.log(result)
```

- 日志按 `[emkit:<ns>]` 前缀输出；
- 默认不记录 SDK 原始 payload；
- 生产环境保持 `logLevel: 'info'`、`logPayload: false`；
- 导出文件可能包含 userId、昵称等，反馈问题时先脱敏。
