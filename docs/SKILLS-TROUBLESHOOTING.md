<!-- Generated from skills/em-host-troubleshooting/SKILL.md by scripts/sync-skills-docs.mjs. Do not edit directly. -->

# 接入排错与平台边界

> 基线：UIKit `1.0.5` · websdk `5.2.0`。先按第 1 节收集信息，再用第 2 节分流；不要凭感觉改代码。

## 1. 先收集 6 项信息

| # | 信息 | 为什么 |
|---|---|---|
| 1 | 端：H5 / 微信小程序 / Android / iOS / 鸿蒙 | 平台能力差异大 |
| 2 | 构建方式：HBuilderX GUI / CLI；dev / build | dev 与 build 产物、后处理不同 |
| 3 | 版本：HBuilderX、UIKit、`easemob-websdk`、基础库 | 版本错配是常见根因 |
| 4 | Console 第一条报错 + 完整堆栈 | 症状常是二次反应 |
| 5 | 复现步骤：登录后第几步、哪个页面 | 区分初始化/路由/数据问题 |
| 6 | 登录态：`EmKit.state.userId`、`status`、`reason`、`errorCode` | 判断是未登录、断网还是被踢 |

```ts
console.log('im state', {
  userId: EmKit.state.userId,
  status: EmKit.state.status,
  reason: EmKit.state.reason,
  errorCode: EmKit.state.errorCode
})
```

## 2. 5 分钟分流

```text
页面打不开/空白
├── 整页白屏、无任何组件 → 高度链 / 页面路径 / easycom / 编译失败
├── 有导航栏但列表空 → 未登录 / 未同步 / 数据为空
└── 有内容但输入栏不见 → 高度链 / 键盘避让

登录相关
├── 点登录一直 loading → SDK 未就绪（小程序分包）/ 网络 / token 接口
├── 登录成功马上回登录页 → 守卫用了 status !== online
└── 发送失败、断开 → token 过期 / 被踢 / 设备超限

消息相关
├── 发不出去 → waitOnline 超时 / token / 网络
├── 收不到 → 未登录 / 事件未注册（正常不应发生）/ 会话 id 错
└── 重复/错乱 → 宿主自己又注册了一套 SDK 事件

小程序
├── module 'sub-sdk/im-sdk.js' is not defined → 见 em-host-mp-subpackage
└── 主包超限 → 同上
```

### 2.1 构建期症状（编译直接失败，与运行时无关）

| 报错原文 | 根因 | 修复 |
|---|---|---|
| 构建日志第一行打「VDOM模式」，但工程是蒸汽模式 | CLI 下 Web 蒸汽模式以工程根目录的 `.vapor` 文件为开关，缺失时静默退回 VDOM | 工程根目录创建空文件 `.vapor` 并提交进仓库；HBuilderX GUI 构建无此问题 |
| `[uts] node_modules/easemob-websdk/chunks/*.js：Identifier "h" has already been declared` | HBuilderX 5.34 编译链与 SDK 压缩 chunk 的已知兼容问题，宿主工程与官方 demo 都可能命中 | 在宿主工程根目录通过 `vite.config.ts` 忽略 `h` 自动导入（配置见下）；不要重打包或覆盖 `node_modules` |
| `"default" is not exported by App.uvue?vue&type=script&setup=true&vapor=true&lang.uts`（页面文件同理） | vapor-web 模式下 `lang="uts"` 的 `<script setup>` 块不产出 default export（5.34 出现，旧版本正常） | 报错页面的 `<script setup>` 改 `lang="ts"`；`common/` 下的 `.uts` 工具模块不受影响，不用改 |

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

已有 `vite.config.ts` 时，把 `autoImportOptions` 合并到现有 `uni()` 配置中，保留其他插件配置。DCloud 已在 [issue #34492](https://issues.dcloud.net.cn/pages/issues/detail?id=34492) 中确认该问题，并回复将由 HBuilderX 后续修复；当前使用上述配置后重新编译即可。

## 3. 白屏 / 布局

| 症状 | 根因 | 修复 |
|---|---|---|
| 聊天页整页白，导航栏都没有 | 页面没进路由 / 编译失败 / `v-if` 条件永假 | 看 Console；确认 `conversationId` 非空 |
| 有导航栏，消息区空白 | 根节点无高度，`scroll-view` 被压成 0 | `.page { height:100%; display:flex; flex-direction:column }`，逐级检查父容器 |
| 输入栏消失 | 同上，或父级 `overflow:hidden` / 固定高度 | 去掉固定高度；保持 flex 链 |
| 双导航栏 | 没关原生导航 | `navigationStyle: "custom"` + `app-plus.titleNView:false` |
| 页面只显示一半 | 用了 `height: 100vh` 或写死 px | 用 `height: 100%`，让页面容器决定 |
| 组件标签不渲染 | 页面组件 easycom 规则缺失 | 补 `^em-([a-z-]+)-page$` 规则 |
| 控制台 `Failed to resolve component` | 同上，或组件名拼错 | 检查标签名与规则 |
| 真机白屏、H5 正常 | 蒸汽端入口/编译问题 | 确认 `manifest.json` 的 `uni-app-x.vapor`，用 HBuilderX 5.21+ 重编 |

## 4. 登录 / token / 连接

| 症状 | 根因 | 修复 |
|---|---|---|
| 登录后立刻被踢回登录页 | 守卫写了 `status !== 'online'` | 改 `EmKit.state.userId === ''`；断网重连不算未登录 |
| 点登录长时间 loading | 小程序分包未下载完 / token 接口慢 / 网络差 | 给 loading 与失败重试；小程序跑 `--watch` 或预下载 |
| `call EmKit.init() first` | 没调 `init`，或绕过 `whenReady` 直接调 SDK | 在 `App.uvue` onLaunch 调一次 `EmKit.init` |
| 登录失败但无提示 | `login` 的 Promise 没 catch | `try/catch` + toast + 打日志 |
| token 过期后发送全失败 | 没实现 `onTokenWillExpire` / `onTokenExpired` | 补回调；或手动 `EmKit.renewToken(token)` |
| 被踢/设备超限 | 同账号别处登录 / 多设备限制 | 读 `state.reason`（`limit` 等），引导重新登录 |
| 换账号后看到上一个账号数据 | 没走 `EmKit.logout()` | 登出必须调用，内部会清会话/消息/联系人/草稿 |
| 切换 appkey 不生效 | `init` 每进程只生效一次 | 重启应用进程，不能靠再次 `init` |

## 5. 消息收发

| 症状 | 根因 | 修复 |
|---|---|---|
| 发送一直失败（红叹号） | 未登录 / token 过期 / 网络断开 | 查 `state`；补 token 回调；恢复网络后点重发 |
| `WebSocket is not connected` | 登录 resolve 后 socket 尚未就绪（UIKit 已等待最多 8s） | 检查网络与 token；不要绕过 UIKit 直接调 SDK |
| 收不到对方消息 | 未登录 / 会话 id 或 chatType 错 / 对端发错人 | 核对 `conversationId` 语义（单聊=userId，群=groupId） |
| 群消息当单聊处理 | 路由没传 `chatType=groupChat` | 用 `select` 事件给的 chatType |
| 引用卡不显示 | 业务 ext 占用了 `msgQuote` / 对端不是 1.0 或 vue 版 | 换业务 key；确认对端协议 |
| 撤回项不出现 | 超过 2 分钟窗口 / 非己方消息 | 正常限制，可用 `recallTimeLimit` 调整 |
| 历史消息加载失败 | 网络 / 游标异常 | 点空态「重试」，看 `loadHistory` 日志 |
| 非当前会话历史变少 | 内存只保留最近 100 条 | 正常限制；完整历史需宿主自持久化 |
| 消息列表长会话卡顿 | `scroll-view` 全量渲染 | 当前版本需控制单会话消息规模；完整历史由宿主持久化并按需展示 |
| 宿主自己收到两次消息 | 宿主又注册了一套 SDK 事件 | 只通过 UIKit 的 `EmKit.onMessage` 订阅，不要重复 `addEventHandler` |

## 6. 会话列表 / 未读

| 症状 | 根因 | 修复 |
|---|---|---|
| 会话列表空 | 未登录 / 未同步 / `autoSync=false` 且没手动同步 | onShow 调 `EmKit.syncConversations()`；真实 `refreshSessionList` 失败会显示重试，不以内存快照冒充成功 |
| 从聊天页返回不刷新 | 只在 onLoad 同步 | 改到 onShow |
| 未读不消 | 未进会话 / 宿主自建入口没清 | 聊天页会自动清；自建入口调 `clearConversationUnread` |
| 未读又复活 | 只清了本地没清服务端 | 用 `clearConversationUnread`（本地+服务端） |
| 免打扰会话还有未读 | 免打扰只抑制提醒，不清未读 | 口径如此；总未读包含免打扰 |
| tabBar 角标不更新 | 在非 tab 页调用 / 没在 onShow 补同步 | 在 tab 页 setup 用 `useTabBarBadge`，onShow 调 `sync()` |
| 置顶顺序乱 | 宿主自己排序 | 用组件默认排序（置顶区间按置顶时间） |

## 7. 好友 / 群

| 症状 | 根因 | 修复 |
|---|---|---|
| 好友列表空 | 后台同步未完成或失败 / `enableSyncData` 缺 contact | 看 `syncFailed` 并重试，`syncContacts()` 会调用 SDK 受控刷新；不要覆盖 UIKit 的 enableSyncData |
| 新请求不显示 | 邀请事件未到 / 本地缓存未持久化 | 重进页面；查 `contactStore.invites` |
| 已是好友的申请仍显示 pending | 旧持久化数据或漏 roster 事件 | 好友快照加载会自动收敛 accepted 与未读角标，不需要再点接受 |
| 接受好友申请后列表不更新 | 同步延迟 | onShow 调 `syncContacts()` |
| 群列表同步失败 | 后台群同步失败 | SDK 无群全量手动重启 API；恢复连接或重新登录，内存重读不会被当作成功 |
| 群邀请接受后没群 | 群快照未刷新 | 组件内部会刷新；重进群列表 |
| 建群后进不去聊天 | `created` 未接线 / chatType 错 | `created` 里 `navigateTo` 且 `chatType=groupChat` |
| 群公告/成员管理不显示 | 当前用户角色不足 | 组件按角色显隐；用 owner/admin 验证 |
| 退群后会话还在 | 没等 `leaved` 退场 / 组件已删会话 | 在 `leaved` 里退场，不要重复删 |

## 8. 主题 / 语言 / 品牌

| 症状 | 根因 | 修复 |
|---|---|---|
| 深色下页面白底 | 根节点没绑 `themeClass` | `:class="themeClass"` |
| 原生导航栏不跟主题 | 没调 `syncNativeThemeUI` | 页面 onShow 调用 |
| 首帧闪白 | 没配 `theme.json` / `@变量` / `darkmode` | 照抄 demo 三件套 |
| 英文只变一部分 | 宿主业务文案没走自己的 i18n | UIKit 只管组件文案 |
| 品牌色不生效 | 颜色非法 / 没引 variables.css | 合法色值；页面 import token |
| H5 导航栏颜色不对 | H5 无平台 API | 宿主 CSS 接管或自绘导航 |

## 9. 小程序专项

| 症状 | 根因 | 修复 |
|---|---|---|
| `module 'sub-sdk/im-sdk.js' is not defined` | 文件缺失 / 公共或私有配置开启未使用文件忽略 / dev 重发 | 跑统一 prepare/check；见 `em-host-mp-subpackage` |
| 项目根目录未找到 `app.json` | HBX 编译中断，产物不完整 | 先修 HBX 的模板/脚本错误，不要手补空文件 |
| 聊天页迁移后跳转不存在 | 仍使用主包旧路径 | 改为 `/sub-im/pages/chat/chat` 或宿主实际分包路径 |
| `SyntaxError: Unexpected token .` | 分包产物未降级 es2017 | 重跑后处理 |
| 主包 > 2MB | SDK 静态进主包 | 分包异步化 |
| 分包面板没有 `/sub-sdk/` | `subPackages` 写法错 / pages 为空 | 对照分包技能第 4 节 |
| 预览总包变大 | 正常，SDK 搬到分包 | 只看主包 |
| `require is not a function` | 基础库 < 2.11.2 | 升级微信 |

## 9.1 App 发行与长连接专项

| 症状 | 根因 | 修复 |
|---|---|---|
| 调试基座能登录，发行包无法建连或一直重连 | SDK 通过运行时适配对象调用 `connectSocket`，静态摇树漏掉 `uni-websocket` | Android/iOS 都在 `app-android` / `app-ios` → `distribute.modules` 显式声明 `"uni-websocket": {}`，重新打基座或发行包 |
| 改完 manifest 后运行仍提示原生模块不存在 | 只做了 JS 热更新，或仍在使用旧基座 | 重新打自定义基座或发行包；原生模块、权限和隐私声明都不能靠热更新补入 |
| 其他 uni 模块是否需要全部手动声明 | 直接调用通常会被自动扫描，全量复制清单只会增加维护成本 | 只明确保留必要模块；自定义 UTS 插件或动态 `uni.xxx` 调用以实际生成清单为准 |
| Android 私有服务报 `CLEARTEXT communication ... not permitted` | Android 9+ 发行包默认禁止 HTTP 明文请求 | 优先 HTTPS/WSS；必须明文时在原生 `AndroidManifest.xml` 的 `application` 节点设置 `android:usesCleartextTraffic="true"` 后重打包 |

## 9.2 App 视频播放专项

| 症状 | 根因 | 修复 |
|---|---|---|
| 点视频全屏黑、无控制条，控制台报 `UTSSDKModulesDCloudUniVideoBrightnessByJs, uni-video 模块不存在` | 自定义基座是在接入 `<video>` 之前打的，内置模块 `uni-video` 被摇树 | 重新打自定义基座；或在 manifest 的 `app-ios`/`app-android` → `distribute.modules` 声明 `"uni-video": {}`（示例工程已配） |
| 一直 loading、`00:00 / 00:00`，同一 URL 在 Safari 能播 | EaseMob chatfiles 直链无扩展名且不支持 HTTP Range，iOS AVPlayer 远程播放卡死 | 升级到当前 UIKit（App 先下载本地 `.mp4` 再播）；服务端支持 `Accept-Ranges` 才能流式 |
| 进度条在走、画面停在首帧 | 原生 autoplay 抢跑导致 play 事件丢失，poster 首帧层盖住播放层 | 升级到当前 UIKit（关闭 autoplay、挂载后显式起播、poster 不进 video） |
| 打开视频要等一会才播 | App 端先整包下载再播放（chatfiles 不支持 Range） | 预期行为；下载期有百分比进度，关闭会中止 |

## 9.3 附件下载专项

| 症状 | 根因 | 修复 |
|---|---|---|
| 微信小程序长按「下载」失败 | `uni.downloadFile` 合法域名未配置 | 微信公众平台 → 开发管理 → 服务器域名，把文件服务域名加入 `downloadFile` 白名单 |
| 保存图片/视频提示「请允许访问相册后重试」 | 系统相册写入权限被拒绝 | 到系统设置授权；小程序可在失败后引导 `uni.openSetting` |
| 文件提示「已下载，但当前类型无法打开」 | 微信小程序仅支持 doc/docx/xls/xlsx/ppt/pptx/pdf；App 会交给系统尝试 | 小程序换支持的类型或由宿主自行打开；App 检查系统是否有对应查看器 |
| H5 点击下载后在新标签页打开 | 跨域直链的 `download` 属性被浏览器忽略 | 预期行为；服务端返回 `Content-Disposition: attachment` 可强制下载 |

## 9.4 录音 / 拍摄权限专项

| 症状 | 根因 | 修复 |
|---|---|---|
| 鸿蒙按住说话立刻提示「录音失败」，且从未弹授权框 | 工程没声明 `ohos.permission.MICROPHONE`，系统直接拒绝 | 在 `harmony-configs/entry/src/main/module.json5` 的 `requestPermissions` 补 `MICROPHONE`（带 `$string:` 资源形式的 `reason` + `usedScene.inuse`），并给 `resources/base/element/string.json` 加文案；**文件要完整**，该目录是整文件覆盖 |
| 鸿蒙点「拍摄」无反应，且从未弹授权框 | 同上，缺 `ohos.permission.CAMERA` | 同上补 `CAMERA` |
| 鸿蒙网络状态不更新或网络探测不可用 | 生成工程缺 `ohos.permission.GET_NETWORK_INFO` | 在 `requestPermissions` 补 `GET_NETWORK_INFO`（只需 `name`）；不要假设框架或基座一定已添加，以实际生成文件为准 |
| 按上面改完仍失败 | 改的是仓库里的 `harmony-configs`，但没重新组装工程，或只做了 JS 热更新 | 必须重新「运行到鸿蒙」（`uni.sh build app-harmony` 只出 assets、不组装 `entry/`）；用 `hdc shell bm dump -n <bundle>` 核对 `reqPermissionDetails` 是否已含目标权限 |
| 鸿蒙编包里 `module.json5` 的 `abilities` 全没了 / 启动崩溃 | 只把 `requestPermissions` 片段放进 `harmony-configs`，整份覆盖把结构打掉 | 复制生成工程的完整 `module.json5` 再改，并保留已有 `INTERNET` 等声明 |
| 鸿蒙授权框曾出现，用户拒绝后不再出现 | 系统记住了拒绝状态 | 引导到系统设置开启；不是继续补声明或重复调用录音 |
| 安卓真机录音无反应 | 最终包缺少 `RECORD_AUDIO`，或用户拒绝 | 检查合并后的 `AndroidManifest.xml` 与 `uni-recorder` 模块；缺失时补声明，拒绝后引导到系统设置 |
| iOS 录音无反应 / 拍摄黑屏且不再弹窗 | `privacyDescription` 缺对应用途描述，或用户已拒绝 | 补 `NSMicrophoneUsageDescription` / `NSCameraUsageDescription` 后重打自定义基座；拒绝态引导 `uni.openAppAuthorizeSetting` |

> 判断口诀：**系统从未弹窗 = 优先查声明；弹过窗但被拒 = 查用户授权状态并引导设置**。RecorderManager / 系统拍摄能力会自动发起运行时授权，无需另写 UTS 插件；UIKit 侧只在失败时 toast「录音失败」，不会自动跳设置。选择相册/文件和保存图片/视频均走系统 Picker 或确认框，不要为了这些路径额外添加相册、文件或读取剪贴板权限。

## 10. 平台能力矩阵（1.0 如实告知）

| 能力 | H5 | 微信小程序 | App（Android/iOS/鸿蒙） |
|---|---|---|---|
| 图片/拍照 | ✅ | ✅ | ✅ |
| 语音发送 | ❌（入口隐藏，仅接收播放） | ✅ | ✅ |
| 视频发送 | ✅ | ✅ | ✅ |
| 视频播放 | ✅（内置全屏播放器） | ✅（内置全屏播放器） | ✅（内置全屏播放器，先下载后播） |
| 文件发送 | ✅ | ✅ | 需宿主注册附件 provider 且当前可用；未注册或不可用时入口隐藏 |
| 文件打开/下载 | ✅（长按菜单下载，浏览器下载） | ✅（长按菜单下载后打开文档） | ✅（长按菜单下载，保存相册/打开文档） |
| 软键盘避让 | 浏览器自管 | ✅ | ✅（手动顶起） |
| 宽屏/多栏 | ❌（移动端布局） | — | — |

不支持的能力已直接隐藏入口，不会出现「点一下只弹暂不支持」。App 文件入口是否显示用 `EmKit.canPickAttachment`（或响应式 `canPickAttachment()`）判断，不要只看 `PLATFORM_CAPABILITIES.filePick`。

## 11. 当前版本已知限制

- `@` 提及为**追加式插入**（uni `<input>` 无光标位置 API）；
- App 视频先整包下载再播（chatfiles 直链不支持 Range），大视频需等待；文件下载走长按菜单「下载」：App/小程序保存相册或下载后打开文档，H5 走浏览器下载；App 文件选择需宿主注册附件 provider，未注册或不可用时入口隐藏；
- 录音 60s 自动发送，麦克风权限失败只 toast，不跳系统设置；
- 日志原始 payload 默认关闭；开启后可能含 userId/昵称/群名；
- 非当前会话只保留最近 100 条内存消息；
- 消息列表为 `scroll-view` 全量渲染，超长会话性能优化未做；
- 不内置卡片组件/schema，卡片由宿主自绘；
- 无会话滑动删除（用长按菜单）、无黑名单/联系人详情/群共享文件/presence。

## 12. 日志与证据

```ts
// 临时排查（生产用完即关）
EmKit.init({ appkey: 'YOUR_APPKEY', logLevel: 'debug', logPayload: true })

const path = await EmKit.exportLogs()   // H5 下载；小程序/App 文件路径，失败兜底剪贴板
```

导出前脱敏（userId、昵称、群名、手机号）。给开发提 issue 时附：端/版本/复现步骤/Console 第一条错误/日志片段。

## 13. 最小验收清单（回归用）

- [ ] 登录成功，会话列表有历史会话
- [ ] 单聊发文本、图片、语音（按平台），对端可收/可播
- [ ] 群聊：公告、@、成员昵称、群管理按角色
- [ ] 引用、撤回、失败重发、已读回执
- [ ] 返回列表未读清零，杀进程重进仍为 0
- [ ] 断网重连不误踢，token 过期能续期或跳登录
- [ ] 深色/浅色、中/英切换
- [ ] 五端各一次构建 + 冒烟（H5 静态伺服 200、小程序开发者工具、App 真机）

## 14. 什么时候该停手

- 报错来自 UIKit 内部且可稳定复现：收集日志与最小复现，交给 UIKit 维护方；不要在宿主里改 `uni_modules` 源码。
- 真机差异（文本裁切/键盘/动画）：先确认版本，再按[常见问题](./FAQ.md)与[平台能力与差异](./PLATFORM.md)中的当前边界处理。
- 平台根本限制（如 H5 无录音、uni input 无光标 API）：不要硬绕，向用户说明并提供替代交互。
