---
name: em-host-troubleshooting
description: Use when easemob-uikit-uni 接入后出现白屏、输入栏消失、双导航栏、会话/好友列表为空、登录后被踢回、发送失败、收不到消息、未读不消、视频播放黑屏/卡 loading/画面不动、小程序 module 'sub-sdk/im-sdk.js' is not defined、SyntaxError 或主题/语言异常，需要按症状定位根因并给出修复步骤。
---

# 接入排错与平台边界

> 基线：UIKit `1.0.0-rc.1` · websdk `5.1.3`。先按第 1 节收集信息，再用第 2 节分流；不要凭感觉改代码。

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
| 消息列表长会话卡顿 | `scroll-view` 全量渲染 | 1.0 已知限制，长列表优化在后续版本 |
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
| `module 'sub-sdk/im-sdk.js' is not defined` | 文件缺失 / 被依赖分析剔除 / dev 抹掉 | 见 `em-host-mp-subpackage` |
| `SyntaxError: Unexpected token .` | 分包产物未降级 es2017 | 重跑后处理 |
| 主包 > 2MB | SDK 静态进主包 | 分包异步化 |
| 分包面板没有 `/sub-sdk/` | `subPackages` 写法错 / pages 为空 | 对照分包技能第 4 节 |
| 预览总包变大 | 正常，SDK 搬到分包 | 只看主包 |
| `require is not a function` | 基础库 < 2.11.2 | 升级微信 |

## 9.1 App 视频播放专项

| 症状 | 根因 | 修复 |
|---|---|---|
| 点视频全屏黑、无控制条，控制台报 `UTSSDKModulesDCloudUniVideoBrightnessByJs, uni-video 模块不存在` | 自定义基座是在接入 `<video>` 之前打的，内置模块 `uni-video` 被摇树 | 重新打自定义基座；或在 manifest 的 `app-ios`/`app-android` → `distribute.modules` 声明 `"uni-video": {}`（示例工程已配） |
| 一直 loading、`00:00 / 00:00`，同一 URL 在 Safari 能播 | EaseMob chatfiles 直链无扩展名且不支持 HTTP Range，iOS AVPlayer 远程播放卡死 | 升级到当前 UIKit（App 先下载本地 `.mp4` 再播）；服务端支持 `Accept-Ranges` 才能流式 |
| 进度条在走、画面停在首帧 | 原生 autoplay 抢跑导致 play 事件丢失，poster 首帧层盖住播放层 | 升级到当前 UIKit（关闭 autoplay、挂载后显式起播、poster 不进 video） |
| 打开视频要等一会才播 | App 端先整包下载再播放（chatfiles 不支持 Range） | 预期行为；下载期有百分比进度，关闭会中止 |

## 10. 平台能力矩阵（1.0 如实告知）

| 能力 | H5 | 微信小程序 | App（Android/iOS/鸿蒙） |
|---|---|---|---|
| 图片/拍照 | ✅ | ✅ | ✅ |
| 语音发送 | ❌（入口隐藏，仅接收播放） | ✅ | ✅ |
| 视频发送 | ✅ | ✅ | ✅ |
| 视频播放 | ✅（内置全屏播放器） | ✅（内置全屏播放器） | ✅（内置全屏播放器，先下载后播） |
| 文件发送 | ✅ | ✅ | 需宿主注册附件 provider 且当前可用；未注册或不可用时入口隐藏 |
| 文件打开/下载 | ❌（仅展示） | ❌（仅展示） | ❌（仅展示） |
| 软键盘避让 | 浏览器自管 | ✅ | ✅（手动顶起） |
| 宽屏/多栏 | ❌（移动端布局） | — | — |

不支持的能力已直接隐藏入口，不会出现「点一下只弹暂不支持」。App 文件入口是否显示用 `EmKit.canPickAttachment`（或响应式 `canPickAttachment()`）判断，不要只看 `PLATFORM_CAPABILITIES.filePick`。

## 11. 一期已知限制

- `@` 提及为**追加式插入**（uni `<input>` 无光标位置 API）；
- App 视频先整包下载再播（chatfiles 直链不支持 Range），大视频需等待；文件打开全端未接；App 文件选择需宿主注册附件 provider，未注册或不可用时入口隐藏；
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
- 真机差异（文本裁切/键盘/动画）属于 UIKit 已知坑：先确认版本，再按仓库 `docs/STATUS.md` 的已知降级处理。
- 平台根本限制（如 H5 无录音、uni input 无光标 API）：不要硬绕，向用户说明并提供替代交互。
