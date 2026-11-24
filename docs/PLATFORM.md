# 平台能力与差异

一套 `em-*` 组件要同时跑在 Android、iOS、鸿蒙、H5 与微信小程序上，平台差异必须收口在库内。这页给出环境要求、逐项能力矩阵、各端注意事项、权限、构建命令与已知约束，帮你在立项阶段就判断「这个功能在我的端上能不能用」。

> 相关页面：[快速开始](./QUICKSTART.md) · [设计变量](./DESIGN-TOKENS.md) · [主题与国际化](./THEME-I18N.md) · [聊天与消息组件](./COMPONENTS-CHAT.md) · [示例工程](./DEMO.md) · [常见问题](./FAQ.md)

> [!WARNING]
> **仅支持 uni-app x 蒸汽模式（Vapor）**：DCloud 官方已于 2024 年停止 nvue 与 5+ 的维护，并将于 2027 年初停止 uni-app 的 App 平台与 uni-app x vdom 平台的维护（见 [DCloud 官方文档 · FAQ「老 uni-app 还维护吗？」](https://doc.dcloud.net.cn/uni-app-x/)）；蒸汽模式已兼容 js/ts 写法，老 uni-app 工程可方便升级。本插件不提供经典 uni-app（Vue2/Vue3、nvue）与 vdom 模式的兼容，下表环境要求以蒸汽编译目标为准。

## 界面预览

同一套组件在两端渲染同一屏（左 Android、右 HarmonyOS），完整六屏对照与更多状态见[界面截图](./SCREENSHOTS.md)。

**会话列表**（左 Android、右 HarmonyOS）：

<DocsImage src="assets/shots/compare/cmp-conversation-list.webp" alt="会话列表双端对照" :width="1299" :height="1400" eager />

**聊天**：

<DocsImage src="assets/shots/compare/cmp-chat.webp" alt="聊天双端对照" :width="1299" :height="1400" />

**聊天信息**：

<DocsImage src="assets/shots/compare/cmp-chat-info.webp" alt="聊天信息双端对照" :width="1299" :height="1400" />

## 环境要求

| 项 | 要求 | 说明 |
|---|---|---|
| HBuilderX | 5.21+（建议 5.26+） | 蒸汽模式（Vapor）的编译与真机运行依赖较新版本 |
| uni-app x | HBuilderX 4.71+，Vue 3 组合式 API | 仅支持蒸汽模式；经典 uni-app（vue2 / vue3）与 vdom 模式不提供兼容（DCloud 2024 年已停 nvue/5+，2027 年初停 App 平台与 vdom 平台维护，见上文公告） |
| Node.js | 18+ | 仅在 CLI 编译、分包后处理、体积校验时需要 |
| 环信 SDK | `easemob-websdk` 5.2.0（peer 依赖） | 精确锁版；升级前先看更新日志 |
| 渲染模式 | uni-app x 蒸汽模式（`manifest.json` 开 `vapor`） | `.uvue` 页面 + `main.uts` 入口 |
| Android | 6.0+ | 真机与模拟器均可 |
| iOS | 15.0+ | 真机运行需开发者证书 |
| 鸿蒙 | API 20+ | 真机运行需 DevEco Studio 与签名配置，见[鸿蒙真机运行与签名](./HARMONY-REALDEVICE-RUN.md) |
| H5 | 现代浏览器（Chrome / Safari） | 移动端布局，未做 PC 宽屏适配 |
| 微信小程序 | 基础库 2.11.2+ | 跨分包 `require` 依赖该基础库；SDK 需分包接入，见[微信小程序 SDK 分包](./GUIDE-WEAPP-SDK-SUBPACKAGE.md) |

> [!WARNING]
> HBuilderX 5.34 引入 `easemob-websdk` 后可能报 `Identifier "h" has already been declared`。DCloud 已确认该编译链问题；当前需在宿主工程的 Vite 配置中忽略 `h` 自动导入，完整配置与官方 issue 见[快速开始](./QUICKSTART.md#hbuilderx-534-sdk-编译异常)。

## 能力矩阵

### 消息能力

| 能力 | App（Android / iOS / 鸿蒙） | H5 | 微信小程序 |
|---|---|---|---|
| 文本消息收发 | 支持 | 支持 | 支持 |
| 图片：选择与发送 | 支持（相册 / 拍摄） | 支持（浏览器文件选择；「拍摄」退化为选文件） | 支持（相册 / 拍摄） |
| 图片：预览 | 支持（`uni.previewImage`） | 支持 | 支持 |
| 图片：保存/下载 | 支持（保存到系统相册） | 支持（浏览器下载，不写相册） | 支持（保存到系统相册） |
| 语音：录制与发送 | 支持（最长 60 秒，超时自动结束并按正常语音发送） | 不支持（语音入口隐藏） | 支持 |
| 语音：播放 | 支持（全局互斥，播新停旧） | 支持 | 支持 |
| 视频：选择与发送 | 支持（相册） | 支持（浏览器文件选择，宽高/时长依赖浏览器解析） | 支持（相册） |
| 视频：播放/预览 | 支持（内置全屏播放器 + 原生 `video`） | 支持（内置全屏播放器 + 原生 `video`） | 支持（内置全屏播放器 + 原生 `video`） |
| 视频：保存/下载 | 支持（保存到系统相册） | 支持（浏览器下载，不写相册） | 支持（保存到系统相册） |
| 文件：选择与发送 | 支持（需宿主注册附件能力；未注册时「文件」入口隐藏） | 支持（浏览器文件选择） | 支持（从会话选择文件） |
| 文件：下载/打开 | 支持（长按菜单下载，下载后尝试系统文档预览打开：doc/docx/xls/xlsx/ppt/pptx/pdf 显式指定类型，其他类型交给系统尝试） | 支持（长按菜单走浏览器下载，不打开文档） | 支持（长按菜单下载，下载后尝试 `uni.openDocument`；仅支持 doc/docx/xls/xlsx/ppt/pptx/pdf） |
| 自定义消息收发 | 支持 | 支持 | 支持 |
| 本地系统提示灰条 | 支持 | 支持 | 支持 |

### 端能力

| 能力 | App | H5 | 微信小程序 |
|---|---|---|---|
| 主题跟随系统 | 支持（读系统深浅色并监听变化） | 支持（`prefers-color-scheme`） | 支持（宿主主题 `hostTheme`） |
| 软键盘避让 | 支持（监听键盘高度，输入栏按实际遮挡高度上推） | 由浏览器自行处理（不注册键盘高度监听） | 支持（同上推口径） |
| 顶部安全区 | 支持（`safeAreaInsets.top`，自绘导航栏） | 支持（`safeAreaInsets` 可能缺失，按 0 处理） | 支持 + 右上角胶囊避让 |
| 底部安全区 | 支持（Home 指示条） | 支持（移动浏览器） | 支持 |
| 页面可见性判定 | 恒为可见 | 读 `document.visibilityState`，切后台不自动清未读/发已读回执 | 恒为可见 |
| SDK 引入方式 | 静态打包 | 静态打包 | 独立分包 + 运行时跨分包加载 |
| 小程序胶囊避让 | 不适用 | 不适用 | 内置（按胶囊矩形预留右侧空间） |
| 图片长按/预览手势 | 支持 | 支持 | 支持 |

### 能力开关 `PLATFORM_CAPABILITIES`

库内对外暴露一个只读能力快照，宿主可据此隐藏或改写自己的入口，避免「点一下只弹不支持」：

```ts
import { PLATFORM_CAPABILITIES } from '@/uni_modules/easemob-uikit-uni/libs'

const canPreviewVideo = PLATFORM_CAPABILITIES.videoPreview // 全端为 true
const canPickFile = PLATFORM_CAPABILITIES.filePick         // 表示“内置选择器”：小程序与 H5 为 true，App 为 false
const canOpenFile = PLATFORM_CAPABILITIES.fileOpen         // 全端为 false
```

| 字段 | 类型 | 取值 | 说明 |
|---|---|---|---|
| `videoPreview` | `boolean` | 全端 `true` | 视频播放入口与点击播放（内置全屏播放器） |
| `filePick` | `boolean` | 小程序、H5 `true`；App `false` | 是否有内置文件选择器；App 端注册附件能力后入口由 `EmKit.canPickAttachment` 变为 `true` |
| `fileOpen` | `boolean` | 全端 `false` | 文件**单击**打开/下载开关（当前版本不提供）；长按菜单的「下载」不读该开关，始终按平台能力执行 |

App 端判断「能否发文件」请用 `EmKit.canPickAttachment`（或响应式的 `canPickAttachment()`），不要只看 `PLATFORM_CAPABILITIES.filePick`。宿主注册方式见 [EmKit 附件能力注入](./API-KIT-MESSAGES.md#emkitsetattachmentproviderprovider--pickattachmentsoptions--resolveattachmenturi-options)。

其余差异（键盘、安全区、主题跟随、分包加载）不是布尔开关，而是平台分支内置行为，宿主无需判断。

## 各端注意事项

### Android / iOS（蒸汽 App 端）

- **自绘导航栏**：聊天页、会话页、详情页统一用 `em-nav-bar`（安全区 + 44px 内容行），页面需在 `pages.json` 配 `navigationStyle: "custom"`，否则会出现双标题栏。
- **键盘避让**：`em-chat-inputbar` 关闭系统默认上推（`adjust-position="false"`），按键盘高度自行设置 `margin-bottom`；iOS、鸿蒙与 Android 的上报值口径不同（iOS/鸿蒙含底部安全区），库内已分别换算——输入栏上推直接用上报值（即从屏幕底边算起的实际遮挡高度），emoji/媒体面板高度按扣除安全区后的值对齐，宿主不需要再叠加偏移。
- **CSS 是子集**：App 端只支持 class 选择器、不支持伪元素与 CSS 动画（`@keyframes` 不执行），库内动画改用 JS 定时器。见文末「已知平台约束」。
- **宽度链用 rpx**：多行文本气泡在 App 端使用固定 `rpx` 宽度，避免百分比 `max-width` 造成的行尾裁字。
- **原生 `<button>` 垂直居中**：App 端按钮靠默认上下 `padding` 居中，不要用固定 `height` + `line-height` 对齐，否则文字贴底。
- **视频组件与基座**：`<video>` 属于内置模块 `uni-video`，会参与模块摇树。自定义基座若是在接入视频组件之前打的，组件会被降级成普通 `<view>`，表现为点开播放器后全屏黑屏；接入视频后重新打一次自定义基座即可，或在 `app-ios` / `app-android` → `distribute.modules`（HBuilderX 4.71 以下为 `app` → `distribute.modules`）显式声明 `"uni-video": {}`。示例工程已配置。
- **视频播放链路**：App 端先把视频整包下载到本地 `.mp4` 再交给 `video` 播放（EaseMob chatfiles 直链不支持 Range、无扩展名，远程直接播会停在 `00:00`）；下载期显示进度，关闭会中止下载。因此大视频需要等待完整下载后才能起播，这是服务端不支持 Range 时的预期行为。
- **iOS 15+ / Android 6+**：低于该版本的系统不在支持范围。
- **文件发送**：App 端没有跨端内置的系统文件选择器。宿主安装文件选择器插件后，用 `EmKit.setAttachmentProvider()` 注册选择/复制/清理能力，输入栏「文件」格才会出现；UIKit 不静态依赖插件，未注册时入口保持隐藏。接入示例见 [EmKit 附件能力注入](./API-KIT-MESSAGES.md#emkitsetattachmentproviderprovider--pickattachmentsoptions--resolveattachmenturi-options)。附件上传由 `uni.uploadFile` 以原生方式读取本地路径；SDK 的 md5 预检在路径不在 uni 文件系统可读范围时会自动跳过，不影响发送。

### App 发行配置：必要与推荐

**以下必要项直接影响登录或对应消息能力：**

| 必要项 | 配置与适用范围 |
|---|---|
| IM 长连接 | Android、iOS 都在 `app-android` / `app-ios` → `distribute.modules` 显式声明 `"uni-websocket": {}`。SDK 通过运行时适配对象调用 `connectSocket`，静态摇树可能漏掉；缺失时发行包无法建立长连接 |
| 文件插件系统版本 | 使用 `easemob-file-picker` 时最低为 Android 7（API 24）/ iOS 16；Android 在 `app-android.distribute` 设置 `"minSdkVersion": 24`。不使用该插件时，UIKit 基础环境仍为 Android 6 / iOS 15 |
| 媒体权限与用途 | 确保最终包包含实际使用的相机、麦克风、相册能力；iOS 在 `app-ios.distribute.privacyDescription` 配置相机、相册、麦克风用途，保存到相册时还需 `NSPhotoLibraryAddUsageDescription` |
| 原生配置生效方式 | 修改模块、权限或隐私声明后重新打自定义基座或发行包；JS 热更新不会补入原生能力 |

**以下推荐项用于明确发行基线与减少平台差异：**

| 推荐项 | 建议 |
|---|---|
| Android target API | 显式设置 `app-android.distribute.targetSdkVersion`，以发行渠道要求和当前 HBuilderX 支持为准，并回归对应系统行为 |
| Android ABI | 64 位真机可显式设置 `abiFilters: ["arm64-v8a"]`；按真实设备需求增加其他 ABI |
| 系统主题 | 在 `app-android` / `app-ios` 设置 `defaultAppTheme: "auto"`；微信小程序和 H5 分别开启 `darkmode` |
| H5 路由 | 简单静态托管使用 `web.router.mode: "hash"`；`history` 需要服务端回退配置 |
| 网络安全 | 使用 HTTPS/WSS。确实需要 HTTP/WS 时，Android 还需在原生 `AndroidManifest.xml` 的 `application` 节点设置 `android:usesCleartextTraffic="true"`，并评估明文传输风险 |

`uni-network`、`uni-getNetworkType`、`uni-fileSystemManager`、`uni-media`、`uni-video` 等直接调用的模块通常会被自动扫描，不必全量显式声明。`uni-video` 在旧基座缺失时会导致播放器黑屏，可单独显式保留；自定义 UTS 插件或新增动态 `uni.xxx` 调用时，应检查实际生成清单，而不是假定所有调用都能被扫描。

### 鸿蒙（HarmonyOS）

- **签名三处一致**：AGC 注册包名、HBuilderX 签名配置、构建产物 `bundleName` 必须完全一致，否则签名失败。完整步骤见[鸿蒙真机运行与签名](./HARMONY-REALDEVICE-RUN.md)。
- **安全区**：导航栏顶部安全区读取 `safeAreaInsets.top`（HBuilderX 4.25+ 返回状态栏高度）；全屏弹层同样需要自己补顶部安全区。
- **动画与光标**：CSS 动画不执行；流式打字机光标是静态字符，语音播放波形由 JS 定时器驱动。
- **视频组件**：`<video>` 依赖内置模块 `uni-video`；鸿蒙自定义基座/HAP 同样需要在接入视频后重新打包，否则播放页黑屏。
- **真机联调**：需要 DevEco Studio 与鸿蒙开发者账号；模拟器有额外系统版本要求，以官方文档为准。

### H5

- **不要用 dev 模式验证**：`scripts/uni.sh dev web` 不会转换 `.uts` 入口，浏览器必白屏。H5 验证固定走「`build web` + 静态伺服」。
- **没有键盘高度 API**：uni-app x 的 H5 运行时未实现 `uni.onKeyboardHeightChange`，UIKit 在 H5 不注册该监听，键盘避让交给浏览器。
- **没有原生导航栏/tabBar 样式 API**：H5 无 `setNavigationBarColor` / `setTabBarStyle`，内置导航栏与 tabBar 是普通 DOM，需要宿主用 CSS 同步主题（示例工程在 `index.html` 与 `common/theme.ts` 里做了这件事）。
- **不录音**：`startRecord` 在 H5 直接抛错，输入栏因此隐藏语音入口；语音消息可以播放。
- **H5 视频播放**：点击视频气泡打开内置全屏播放器；浏览器可能拦截带声音的自动播放，点播放器里的播放键即可。
- **拍摄退化为选文件**：浏览器没有相机概念，`chooseImage` 的 `camera` 来源退化为文件选择器。
- **页面可见性**：H5 标签页隐藏时不把当前会话的新消息清未读、不发已读回执，避免用户不在页面上时被误清。

### 微信小程序

- **SDK 必须在分包**：`easemob-websdk` 不进主包，UIKit 通过跨分包 `require` 异步加载；`pages.json` 需要 `sub-sdk` 分包与 `preloadRule` 预下载。完整做法见[微信小程序 SDK 分包](./GUIDE-WEAPP-SDK-SUBPACKAGE.md)。
- **基础库 2.11.2+**：更老的基础库不支持跨分包 `require`，表现为加载失败。宿主应做特性检测与提示，不要静默失败。
- **主包体积**：平台限制 2MB；本仓库的构建门禁按 **1.5MB** 校验主包（`scripts/check-mp-size.mjs`），为业务页面留余量。
- **文件发送**：从微信会话选择文件（`chooseMessageFile`），不能直接读系统文件管理器。
- **胶囊避让**：`em-nav-bar` 按右上角胶囊矩形预留空间，右侧动作按钮落在胶囊左侧。
- **原生 tabBar 图标**：`iconPath` 只接受图片，不能使用字体图标；示例工程用脚本从同一套字形生成 PNG。

## 权限

| 端 | 涉及的权限 | 触发时机 | 拒绝后的表现 |
|---|---|---|---|
| Android / iOS / 鸿蒙 | 相机、相册读取、相册写入、麦克风 | 用户主动拍摄/选图、录制语音、保存图片/视频到相册时由系统弹窗申请 | 对应入口不可用；保存到相册被拒绝时提示「请允许访问相册后重试」，文本收发、图片预览等其余能力不受影响 |
| 微信小程序 | 相机、相册读写、录音 | 用户主动使用对应入口时由微信授权弹窗申请 | 同上 |
| H5 | 浏览器文件选择授权；不涉及摄像头/麦克风/相册写入（不录音、不写相册） | 点击「图片/视频/文件」入口或下载附件时 | 不选文件即不上传；下载由浏览器接管 |

App 端发布前需要在打包配置中声明相机、录音与相册用途（Android 权限声明、iOS 用途描述，鸿蒙见下条）；未声明时系统会直接拒绝，表现为「点选图没反应」或「按住说话后提示录音失败」。插件市场声明中已注明：相机、相册、麦克风仅在用户主动发送图片/视频/语音时调用，拒绝后对应功能不可用，不影响文本收发。

**鸿蒙权限声明**：鸿蒙的权限必须写进工程配置才会被系统识别，路径是工程根目录的 `harmony-configs/entry/src/main/module.json5`，节点为 `requestPermissions`。语音消息需要 `ohos.permission.MICROPHONE`（用户授权类，需同时提供 `reason` 指向的字符串资源）；未声明时录音会被系统直接拒绝，UIKit 只能提示「录音失败」。注意 HBuilderX 是把 `harmony-configs` 下的文件**整份覆盖**到生成工程，而非按节点合并，因此该文件需要包含完整的 `module` 配置（`abilities` 等），不要只放权限片段；`requestPermissions` 里也无需重复框架已声明的 `ohos.permission.INTERNET`。签名用的 `harmony-configs/build-profile.json5` 已被 `.gitignore` 排除，权限配置则需要随仓库分发。

**iOS 拍摄黑屏**：iOS 在用户拒绝相机授权后，系统仍可能拉起拍摄页并停在纯黑画面（且不再弹窗），看起来像「摄像头调起了但是黑的」。`em-chat-page` 在调起相机前会读 `uni.getAppAuthorizeSetting().cameraAuthorized`：`denied` 弹窗引导到系统设置（`uni.openAppAuthorizeSetting`），`config error` 提示安装包缺少权限描述；`not determined` 仍交给系统首次弹窗。发布包还需要在 `manifest.json` 的 `app-ios.distribute.privacyDescription` 中声明 `NSCameraUsageDescription`（相册/麦克风同理），改完需重新云打包或重打自定义基座才生效。iOS 模拟器没有摄像头，拍摄必为黑屏，请用真机验证。

## 构建与运行

### HBuilderX（图形界面）

1. 用 HBuilderX 打开仓库根目录下的 `demo/`。
2. 运行 → 运行到浏览器（H5）、运行到小程序模拟器 → 微信开发者工具、运行到手机或模拟器（Android / iOS / 鸿蒙）。
3. 首次运行 App 前安装 `easemob-websdk`：在 `demo/` 下执行 `npm install`。

### 命令行（HBuilderX 内置编译器）

```bash
# 1) 安装 peer 依赖
cd demo && npm install && cd ..

# 2) H5：构建后用静态服务器预览（dev web 会在浏览器白屏，不要用）
bash scripts/uni.sh build web
bash scripts/uni.sh serve 5180

# 3) 微信小程序：构建 + 自动注入 SDK 分包 + 体积门禁
bash scripts/uni.sh build mp-weixin
# 用微信开发者工具导入 demo/unpackage/dist/build/mp-weixin

# 4) 小程序 dev（带分包伴随 watch，改代码后重编译）
bash scripts/uni.sh dev mp-weixin
```

补充：

- HBuilderX 不在默认路径时用 `HBUILDERX_PATH` 指向安装目录。
- `serve` 默认端口 5180，可传第二个参数改端口。
- 小程序构建结束后自动跑 `scripts/check-mp-size.mjs`：校验 SDK 精确锁版、分包文件存在、主包无 SDK 残留、主包体积与产物语法。
- H5 产物需要以 HTTP 静态伺服访问（`file://` 直接打开会因模块加载策略失败）。

## 已知平台约束

### App 端样式子集（ucss）

| 约束 | 表现 | 规避方式 |
|---|---|---|
| 只有 class 选择器 | 标签选择器、`*`、复杂组合选择器不可用 | 所有样式挂在 class 上 |
| 无 CSS 继承 | 父节点 `color` / `font-size` 不会下传 | 逐 class 显式声明 |
| 不支持伪元素与 CSS 动画 | `::before` / `::after`、`@keyframes` 不生效 | 用真实节点 + JS 定时器（语音播放波形、引用定位高亮均如此） |
| `calc()` 与 CSS 变量组合受限 | `calc(Npx * var(--x))` 类写法不可靠 | 直接写死 px 值或拆成多个 class |
| 不支持 `color-mix()` | 半透明派生色不可用 | 明暗各写一份字面量 |
| 字体族无效 | webfont 栈不生效 | 使用系统字体 |

### 其他约束

- **文件单击与下载**：文件卡单击与长按菜单「下载」共用同一链路。App/小程序优先打开自己已发送且仍存在的本地文件，不显示远端下载 loading；本地文件不可用或打开失败时回退远端下载，并尝试系统文档预览打开（doc/docx/xls/xlsx/ppt/pptx/pdf 显式指定类型，其他类型交给系统尝试）。环信附件的 HTTP 地址在 App 下载前统一升级为 HTTPS。微信小程序仅支持这七类，其他类型提示「文件已下载，但当前类型无法打开」；H5 走浏览器下载。宿主也可直接调用 `EmKit.downloadAttachment(message)`。
- **App 下载相关内置模块**：保存图片/视频到相册依赖 `uni-media`，打开文档依赖 `uni-openDocument`；旧自定义基座未包含这些模块时调用会失败，需要重新打自定义基座（与 `uni-video` 同理）。
- **微信小程序下载域名**：`uni.downloadFile` 受微信公众平台 `downloadFile` 合法域名限制，接入前需把环信文件服务域名加入白名单，否则图片/视频保存与文件下载都会被平台拦截。
- **H5 下载**：图片/视频/文件都走浏览器下载，不能写入手机相册；跨域文件直链的 `download` 属性可能被浏览器忽略，此时会在新标签页打开文件。
- **小程序主包体积**：平台 2MB，仓库门禁 1.5MB；新增业务页面优先放分包。
- **H5 未做 PC 宽屏**：布局按移动端设计，桌面浏览器建议限制视口宽度。
- **主题必须绑根节点**：App 端没有 `:root`，页面根节点要绑定 `themeClass`，否则明暗变量不下行。
- **App 端 `v-if` 新建分支的浮层会偶发整批不渲染**：弹层/浮层类 UI 常驻挂载，开合只改内联样式；详见 [常见问题](./FAQ.md)。
- **App 端原生组件只保证内容区**：`textarea`、`button` 的 flex 尺寸与背景/圆角等装饰渲染不可靠，由外层包裹节点承担。多行 textarea 使用固定 px 行高与显式高度，不混用 `auto-height` 和 JS 重测；详见 [常见问题](./FAQ.md)。

## 平台差异在库内的位置

| 关注点 | 实现位置 |
|---|---|
| 能力开关、媒体选择、录音、播放 | `libs/platform.ts` |
| 键盘高度与上推口径 | `libs/use/useKeyboardHeight.ts` |
| 顶部/底部安全区 | `libs/use/useSafeArea.ts` |
| 输入栏语音入口与文件入口显隐 | `components/em-chat-inputbar/em-chat-inputbar.vue` |
| 视频播放入口 | `components/em-video-message/em-video-message.vue` |
| 视频全屏播放器 | `components/em-video-preview/em-video-preview.vue` |
| 文件卡点击行为 | `components/em-file-message/em-file-message.vue` |
| 导航栏安全区与小程序胶囊避让 | `components/em-nav-bar/em-nav-bar.vue` |
| 小程序 SDK 分包加载 | `libs/client/sdk.ts` |

宿主侧不需要写平台条件编译，按能力布尔值与文档给出的平台范围组织入口即可；确有自定义需求时，推荐同样把平台分支收口到一个文件。

## 相关命令速查

| 命令 | 作用 |
|---|---|
| `bash scripts/uni.sh build web` | 构建 H5 产物到 `demo/unpackage/dist/build/web` |
| `bash scripts/uni.sh serve 5180` | 静态伺服 H5 产物 |
| `bash scripts/uni.sh build mp-weixin` | 构建微信小程序、注入 SDK 分包、跑体积门禁 |
| `bash scripts/uni.sh dev mp-weixin` | 小程序 dev 编译（带分包伴随 watch） |
| `node scripts/prepare-sdk-subpackage.mjs <产物目录>` | 手动注入 SDK 分包（HBuilderX 图形界面 dev 时使用） |
| `node scripts/check-mp-size.mjs` | 校验小程序产物与主包体积 |

构建细节与排错见[快速开始](./QUICKSTART.md)、[微信小程序 SDK 分包](./GUIDE-WEAPP-SDK-SUBPACKAGE.md)与[常见问题](./FAQ.md)。
