# 1.0 发布就绪评审（2026-10-21）

> 评审对象：`uni_modules/easemob-uikit-uni`（32 个组件：25 原子 + 7 页面级；`libs/` 39 个 ts 约 6.1k 行；组件约 5.6k 行）
> 评审目的：判断当前代码能否直接对外发 1.x；若不能，列出发布前必须清零的项。
> 评审方式：全量代码走读 + 双端构建门禁 + 元数据/文档/协议对照（vue 版 uikit、websdk 5.1.3 typings）。
> 未覆盖：真实账号端到端、iOS/真机（本机无可用测试凭据与设备，文末列为发布前必须补做的验证）。

---

## 0. 结论

**功能完成度高，但“可发布度”不足：不建议现在直接发 1.0.0 GA。**

- 功能面：单聊/群聊/通讯录/多场景扩展/AI 流式/主题/未读角标的主干完整，组件与 API 设计总体自洽，构建门禁全绿。按“1.0 应有能力”估约 **85%**。
- 发布面：版本/物料/平台元数据/公开仓安全/接入文档/真机验证均未就绪，估约 **50%**。
- 建议路径：
  - **稳妥（推荐，约 1 周）**：清完 §3 的 7 个 P0 → 打 `v1.0.0`。
  - **赶时间（约 2–3 天）**：先发 `1.0.0-rc.1`（或 `0.9.0` 公测），只做 P0-1/2/4/6/7，视频/文件与真机矩阵写入已知限制，1.0.0 再收口。
  - **不建议**：保持现状直接发 `1.0.0`——平台市场兼容性会显示“不确定”、iOS 无任何实测、文件/视频在 App/小程序点开即“不支持”、Token 过期无续期入口，这四项任意一项都会在首发周形成集中 issue。

评分（10 分制，主观但按证据）：

| 维度 | 分数 | 说明 |
|---|---|---|
| 功能覆盖 | 8 | 主干齐全；视频/文件查看、Token 续期、联系人详情/黑名单等缺口 |
| API 易用性 | 7 | 门面清晰、类型完整；`init` 一次性、chat 页返回硬编码、部分错误静默 |
| 接入易用性 | 5 | 缺“从零跑起来”的 Quick Start；宿主页骨架（高度/导航/同步）未文档化 |
| 跨端一致性 | 6 | H5/Android/mp 有实测；iOS 全未验；多端能力不对等（录音/文件/视频） |
| 工程质量 | 7 | 分层/零依赖/构建门禁/图标校验好；无自动化测试、日志含 PII、少量死配置 |
| 发布就绪度 | 4 | 版本 0.0.1、changelog 未发布、无根 LICENSE、平台矩阵未知、签名配置入库 |

---

## 1. 本次实测结果（可复现）

| 检查 | 结果 |
|---|---|
| `scripts/uni.sh build web` | ✅ 通过（仅 demo `demo-card` 的 nullable 编译 warning） |
| `scripts/uni.sh build mp-weixin` | ✅ 通过，11 项防回归全绿；主包 **833KB** / 分包合计 1367KB |
| H5 产物静态伺服 | ✅ 200 |
| `scripts/check-icon-parity.py` | ✅ 287 SVG / 420 键 / 调用点全部一致 |
| `scripts/verify-icons.py` | ⚠️ 2 条 WARN：166 个未映射私用区码点（体积）、`hhea.descent=0` + 负 y 字形（mp 固定高度可能裁底） |
| i18n 键一致性 | ✅ zh/en 各 215 键，完全对齐；模板无硬编码中文；静态扫描 56 键未直接命中（`time.*` 为动态使用，另有 **40+ 个预留键未接线**：`status.*`/`error.*`/`contact.add*`/`conversation.loadHistoryFailed` 等） |
| 自动化测试 / CI | ❌ 无测试文件、无 `.github` |

---

## 2. 已具备的能力（可以冻结的部分）

- 单聊全链路：会话列表（置顶/免打扰/未读/草稿/筛选 tab）、聊天页（文本/图片/语音/视频/文件/自定义/系统提示）、引用/撤回/失败重发/已读回执/typing、聊天详情。
- 群基础：群列表/建群/群聊（公告、@提及、昵称行）/群资料/成员管理/邀请/管理员/转让/退群解散/全员禁言/群系统通知。
- 通讯录：入口页、好友列表、好友申请（含群邀请 kind 分化）。
- 多场景：`sendText` ext、`sendCustom` + `#custom-message`、`#banner`、`#input-toolbar`、`title`/`showAction`、`insertLocalNotice`、快捷回复、业务长按菜单、单会话未读。
- AI 流式：分片合并/丢片补偿/合批/光标/异常态/富格式插槽/可关闭。
- 主题与 i18n：三档主题（跟随系统）+ 原生 chrome 同步 + 明暗 token；zh/en 全量。
- 未读与角标：总未读/单会话/好友申请 + 原生 tabBar 角标。
- 工程质量：零运行时依赖（vue + websdk peer）、常量收口、BEM/样式独立、五端条件编译收口、图标字体与校验工具链、mp 分包 11 项防回归。

这些是 1.0 的底子，**不需要在 1.0 前重构**。

---

## 3. P0：发布前必须清零（7 项）

### P0-1 发布物料与平台元数据仍是 0.x 状态

**证据**
- `uni_modules/easemob-uikit-uni/package.json:4` `version: 0.0.1`；`:9` `engines.HBuilderX: ^5.21.0`，而 `README.md:9` 要求 5.26+。
- `package.json:29-86` 平台矩阵是 HBuilderX 4.71 之前的旧结构（`App`/`H5-mobile`/`H5-pc`/`小程序`），所有“本应支持”的项都写成 `"u"`（Unknown），不支持的项才是 `"n"`。按 DCloud 规范，4.71+ 需要 `uni-app-x` 节点 + `√/x/-` 值；当前发布到插件市场，兼容性会显示“不确定”，且没有 uni-app x 维度。
- `dcloudext` 未声明 `darkmode` / `i18n` / `widescreen`（本插件实际支持前两项）。
- `dcloudext.declaration.permissions: "无"`、`data: "插件不采集任何数据"` 与实际能力不符（麦克风、相册/相机、文件读写；消息经环信服务器）。
- `changelog.md:3` 仍是 `0.0.1（未发布）`；`README.md:5`、`uni_modules/.../readme.md:5` 仍写“开发中”；根目录无 `LICENSE`（只有插件内 `license.md`）；仓库无 tag。

**影响**：插件市场首发可信度、审核、用户预期全部受影响；这是“能不能发”的第一道门。

**建议**
1. 版本统一 `1.0.0`（demo `manifest.json` 同步），changelog 以人话重写 1.0.0（按模块聚合，保留 0.x 迁移说明）。
2. `engines` 改为 `{ "HBuilderX": "^5.26.0", "uni-app-x": "^5.26.0" }`（与 README 对齐；HBuilder V 版本另行说明）。
3. `platforms` 改新规范：
   - `client["uni-app-x"]`：`web.chrome/safari: "√"`、`app.android/harmony: "√"`、`app.ios: "-"`（未验证就写不确定/不支持，别写支持）、`mp.weixin: "√"`；`client["uni-app"]` 全部 `"x"`。
   - `dcloudext.darkmode: "√"`、`i18n: "√"`、`widescreen: "-"`（当前无桌面适配）。
4. 根目录补 `LICENSE`（MIT）；插件 `readme.md` 重写为自包含版本（见 P0-4）。
5. 声明权限/数据：麦克风、相册/相机、文件读写；数据“消息与资料经宿主配置的环信服务端传输”。
6. 建议加 `scripts/check-release.mjs`：版本=changelog 首条、无 `"u"` 平台值、README 无“开发中”、tracked 文件无本地绝对路径/签名配置、build+size 门禁，一条命令跑完。

**验收**：插件市场预览的兼容性表五个端显示正确；`git tag v1.0.0` 与 changelog 对应。

### P0-2 Token 生命周期与连接原因缺失（生产必踩）

**证据**
- `libs/client/index.ts:78-84` 只监听 `onConnected` / `onDisconnected`，且完全忽略 `ConnectionEventPayload`（`reason` / `errorCode` / `attempt` / `isOnline`）。
- 全库没有 `renewToken` 封装，也没有 `onTokenWillExpire` / `onTokenExpired` 接线（websdk 5.1.3 均提供）。
- `connectionStore` 只有 `status/appkey/userId`；i18n 里 `status.reconnecting`、`status.kicked*`、`error.tokenExpired` 等 10+ 个键从未使用——说明设计过但没落地。
- `onDisconnected` 不区分“网络抖动自动重连”“被踢”“设备超限”“Token 过期”，宿主与 UI 都无法给出正确提示。

**影响**：长连接会话在 Token 到期后掉线，客户端没有任何续期入口；用户只会看到“发送失败”。多设备登录被踢也无感知。这是 IM SDK 的 1.0 硬门槛。

**建议**
1. `EmKitConfig` 增 `onTokenWillExpire?: () => Promise<string> | string`（宿主返回新 token）与 `onTokenExpired?: () => void`；内部 `client.renewToken(newToken)`，失败则落 `CONNECTION_STATUS.CLOSED` 并抛可识别错误。
2. `connectionStore` 增 `reason` / `attempt` / `maxAttempts` / `reconnecting`；`onConnecting` / `onReconnectFailed` / `onDisconnected(payload)` 全部接线。
3. 对外暴露 `EmKit.renewToken(token)`，并补 `onConnectionChange` 订阅或直接让宿主绑 `state`。
4. 页面层提供最小离线条（见 P1-3），或至少在 README 给出宿主接法。
5. 验收：token 过期→自动续期成功；续期失败/被踢→状态可区分；断网重连→UI 有“重连中”。

### P0-3 视频/文件消息在 App/小程序不可用（“5 种气泡”名不副实）

**证据**
- `components/pages/em-chat-page/em-chat-page.vue:921-929`：视频点击仅 H5 `window.open`，App/小程序直接 toast“暂不支持预览”。
- `em-chat-page.vue:934-936`：文件点击在**所有端**都只 toast“暂不支持”。
- `libs/platform.ts:137-143`：App 端 `chooseFile` 空实现（`logger.warn` + `resolve(null)`），即 App 不能发文件。
- 但 `package.json:5`、README、插件 readme 均宣传“视频/文件”能力，未标平台差异。

**影响**：用户在小程序/App 收到视频不能播、收到文件不能开、App 不能发文件；首发口碑风险最高的功能缺口。

**建议（1.0 前至少做到“能看”，App 发文件可列 known issue）**
1. 视频：封装 `EmVideoViewer`（全屏 `video` 组件 + 关闭），App/小程序/H5 统一；或 `uni.previewMedia` 可用则优先。
2. 文件：`uni.downloadFile` + `uni.openDocument`（App/小程序）+ H5 `<a download>`/`window.open`；失败 toast 可重试。
3. App 发文件：接原生文件选择（plus.io / uts 插件）或明确写入 README“App 仅接收文件”。
4. 在 README/插件 readme 增加“能力 × 端”矩阵，别让用户自行踩。
5. 验收：五端各收到一条视频/文件，可点开/下载；App 发文件按最终决策验证。

### P0-4 接入文档缺“从零跑起来”的最后一公里

**证据**
- `README.md:22` 的“快速开始”指向 `demo/pages/spike`（裸 SDK 连通性），不是 UIKit 接入；`:85` 的多场景指引只覆盖“直进聊天页”。
- 插件 readme `:11` 标题仍是“使用方式（**目标形态**）”，只有 3 行 `init/login` + easycom，没有可运行的页面骨架。
- `docs/GUIDE-MULTI-SCENARIO.md:46` 的推荐模板 `<view class="page">` **没有对应样式**；而 `em-chat-page` 内部是 `flex:1` + `height:0`，宿主页必须 `display:flex; flex-direction:column; height:100%`，否则输入栏/列表高度异常。
- 全仓文档没有提到页面级组件需要 `navigationStyle: custom` / App `titleNView:false`（demo 已配，但用户不知道会双 header）。
- 会话页不会自己 `syncConversations()`（demo `pages/conversation/conversation.uvue:28` 手调），文档未说明。
- 插件 readme 没有截图、H5 在线预览、已知限制、平台矩阵、最小示例工程入口。

**影响**：新用户 10 分钟内跑不起来，直接流失；也是 issue 的主要来源。

**建议**：新增 `docs/QUICKSTART.md`（README 首屏链接），至少包含：
1. 安装 `easemob-websdk@5.1.3` + 复制 uni_modules；
2. `pages.json`：easycom、页面注册、`navigationStyle: custom`（App `titleNView:false`）；
3. `App.uvue`：`initTheme()`；
4. 登录页：`EmKit.init` → `login`；
5. 会话页 wrapper：高度骨架 + `onShow` `syncConversations()`；
6. 聊天页 wrapper：`conversationId`/`chatType` + `onOpenInfo` 路由；
7. tabBar / 未读角标（可选）；
8. 常见错误：module not found、easycom 不生效、双 header、键盘顶飞、mp 分包、白屏；
9. 平台能力矩阵与“已知限制”。

**验收**：一个空 uni-app x 工程按文档 15 分钟内跑通登录→会话→聊天→发文本/图片。

### P0-5 iOS 与真机验证债（含一个未闭环的 H5 数据问题）

**证据**
- `docs/SPIKE-SDK-CONNECTIVITY.md:30/42/63`：iOS 所有项“待验证”；README 却写“iOS 15+”。
- `docs/STATUS.md` 的待验表 20+ 行，绝大多数最近 5 天落地的功能（M2.11–M2.15、深色模式、tabBar 角标、图标替换、群管理）只有 build + H5 截图，没有真实账号 E2E。
- `docs/STATUS.md:207`：H5 端联系人同步为 0（同账号 mp 有 5 个），标注“疑似存量 H5 数据层问题，待查”，此后无结论。若属实，这是 H5 好友列表直接不可用。
- 群链路（建群/成员/公告/@/系统通知）真实账号端到端仍挂账。

**影响**：1.0 首发即“带病上线”，且 iOS 用户是 App 端一半。

**建议**
1. 发布前跑一张最小真实账号矩阵（见 §7），至少覆盖：登录→会话同步→单聊 5 类消息→群聊@/公告→通讯录/申请→免打扰/置顶→深色模式→杀进程冷启。
2. iOS 必须真机跑一遍；跑不了就在 README/商店页明确“iOS 未验证”，并把平台矩阵 `ios` 标 `-`。
3. 复现 H5 联系人 0：优先查 `onSyncDataFinished` 时序与 `getContacts()` 快照；修不了就在 UI 加“重新加载”入口并在已知限制公示。
4. 把 STATUS 的待验项收敛成“发版验收清单”，别让发布判断依赖 400 行流水账。

### P0-6 公开仓安全与合规清理

**证据**
- `demo/manifest.json:55/59` 提交了鸿蒙签名 `keyPassword` / `storePassword`（HBuilderX 加密值）与 `certpath/storeFile` 的本机绝对路径 `/Users/<user>/...`。
- 4 个 tracked 文件含本机绝对路径：`AGENTS.md`、`docs/STATUS.md`、`.agents/skills/vue-uikit-design-reference/SKILL.md`、`demo/manifest.json`。
- `.agents/`（内部 AI 指令）、`PLAN.md`、`docs/STATUS.md`（内部进度/评审流水）是否要进公开 MIT 仓，需要明确决策。
- 无根 `LICENSE`、无 issue 模板/CI。

**影响**：公开仓泄露签名配置与个人路径；内部计划/评审文档公开也会增加维护负担。

**建议**
1. 发布前 scrub `demo/manifest.json`：签名配置清空或移到本地 `manifest.local.json`（`.gitignore`），只保留 `bundleName` 等非敏感项；文档中的绝对路径改相对描述。
2. 明确 `publish` 白名单：GitHub 只发 `uni_modules/` + `demo/` + `docs/`（用户向） + README/LICENSE；`.agents/`、`PLAN.md`、`STATUS.md` 移到内部仓或 `.gitignore`。
3. 补根 `LICENSE`、`CONTRIBUTING.md`、issue 模板；加 CI（build web + mp + size + icon parity）。
4. 跑一次 `git grep -nE "/Users/|Password|secret|appkey.*=.*['\"][a-z0-9]{8,}"` 确认干净。

---

### P0-7 当前会话内收到的新消息不会清服务端未读（重同步/冷启后未读“复活”）

**证据**
- `libs/chat/conversation.ts:62` 全库唯一一处 `clearConversationUnreadMessageCount`，只在 `enterConversation` 调用。
- `libs/chat/index.ts:57-60` 当前会话收到对方消息时**只发已读回执**，没有清服务端未读；`onConversationListUpdate` 会把 wire 的 `unreadCount` 原样写进 store（`libs/chat/index.ts:70`）。
- SDK 的 `setCurrentConversation` 只抑制**本地**未读自增（`chat-manager.d.ts:240`），服务端未读仍会累加；vue 版因此在 `onMessage` 里对“当前会话 + 页面可见 + 非自己发送”显式清未读，并注释“避免刷新/重新同步后服务端未读数再次浮现”（`packages/uikit-sdk-websdk5/src/event/chat-events.ts:508-522`）。
- demo 在会话页 `onShow` 会 `refreshSessionList()`（`demo/pages/conversation/conversation.uvue:28/37`），正好把服务端未读重新拉回列表。

**影响**：用户停留在聊天页读完消息，返回列表/杀进程重进/换端同步后，刚读过的会话又显示未读、tab 角标复活。属于 IM 核心状态正确性问题，且“时有时无”最难被用户理解。

**建议**
1. 在 `onMessage` 的“当前会话”分支里，与已读回执同一判定下调用 `clearConversationUnreadMessageCount`（失败只 warn，不打断）。
2. 加“页面可见”守卫：聊天页 `onHide`/`onShow` 维护 visible 标记（App 退后台时不清未读），或由 `EmChat` 暴露 `setForeground(bool)`。
3. 清未读成功后同步把 `conversationStore` 对应项 `unreadCount` 置 0，避免等 SDK 回包。
4. 顺带确认当前会话收到的 @ 消息是否应置 `atMe`（`libs/chat/index.ts:51-55`）：vue 当前也置位，建议与产品口径一起定，避免“刚看完的群回列表仍有 @ 我”。

**验收**：停留在聊天页收 3 条消息 → 返回列表该会话未读为 0、tab 角标不复活；杀进程重进仍为 0；App 退后台收消息 → 未读正常累计。

---

## 4. P1：1.0 前修，或明确写进“已知限制”

| # | 问题 | 证据 | 建议 |
|---|---|---|---|
| P1-1 | `em-chat-page` 返回硬编码 `uni.navigateBack`，其他页面都是 emit `back` | `em-chat-page.vue:317-319` vs `em-chat-info-page.vue:148`、`em-contact-list-page`、`em-group-page` | 增 `back` emit（保留默认行为或由宿主 `:show-back` 控制）；1.0 冻结前统一契约 |
| P1-2 | 引用协议与 vue 版不互通：本项目 `ext.emQuote`，vue 用 `ext.msgQuote` | `libs/constants/index.ts` `MESSAGE_EXT_KEY.QUOTE='emQuote'`；vue `packages/uikit-im/src/composables/use-quote.ts:16/73` | 1.0 是改协议的最后窗口：发送写 `msgQuote`（或双写），接收兼容两者；否则明确写“与 vue 版引用不互通” |
| P1-3 | 无连接状态 UI；断网/重连/被踢只有“发送失败” toast | `connectionStore` 仅 3 字段；组件无消费；i18n `status.*` 未用 | 增 `em-connection-banner`（或页面内条）：重连中/已断开/被踢，带重试/重新登录 |
| P1-4 | 首屏空态闪烁 + 历史加载失败静默 | `em-chat-page.vue:252/684`（500ms 兜底即显示空态）、`:47` 空槽、`:670-672/782` 仅 logger | ready 以“首次历史请求结束”为准（兜底只解 opacity，不置空态）；失败 toast + “点击重试”；首屏用 skeleton |
| P1-5 | 录音权限/60s 上限会静默丢消息 | `platform.ts:159-215`（无 `onError`、`onStop` 每次注册、60s 自动停但 `recordStopResolve` 为空）；`inputbar:360-375` `.catch(() => {})` | 录音 `onError` + 权限引导；到 60s 自动发送；每次 start 前 `offStop`；失败 toast |
| P1-6 | 原始 payload 进日志缓冲，且 debug 关闭时也 eager `JSON.parse(JSON.stringify())` | `contact.ts:40/60/168`、`group.ts` 16 处；`logger.ts:41-60` 全级别入 2000 行环形缓冲，`exportLogs` 可导出 | 增 `logPayload`（默认 false）或脱敏；序列化前判级别；README 提示生产勿导出 |
| P1-7 | 无自动化测试/CI、无 `pages_init.json` | 全仓无 `*.test.*`；PLAN M3 要求 uni-automator | 至少：domain 纯函数单测（time/mention/quote/stream）+ 一条 H5 冒烟；CI 跑双端 build + size + icon parity |
| P1-8 | 语言不持久化、无顶层 `setLocale`/系统语言初始化 | `store/theme.ts:12` locale 固定 zh-CN；`libs/index.ts:415` 只导出 `useLocale` | `EmKitConfig.locale` + 持久化 key + `initLocale`；门面导出 `setLocale/getLocale` |
| P1-9 | `EmKit.init` 一次性，换 appkey 无法重新初始化 | `client/index.ts:21-24` 直接 return；logout 不重置 | 支持 logout 后重新 init，或显式 `destroy()`；README 写明“appkey 终身固定” |
| P1-10 | 消息全量常驻内存，所有会话的 onMessage 都 append | `chat/index.ts:47` → `message.ts:197-225`；无 per-conversation 上限 | 每会话保留最近 N 条（如 500）或仅当前会话保留；长会话/多群场景必踩 |
| P1-11 | 页面数据自举不一致：群列表页自拉，会话/好友列表页不自拉 | `em-group-page.vue:185-187` `onMounted` 调 `getJoinedGroups`；`em-conversation-page` 无 `onMounted/onShow`；demo 在 `conversation.uvue:28` 手调 `syncConversations` | 页面级组件首次挂载自拉一次（或提供 `autoSync` prop，默认 true）；否则宿主漏调就是空列表，且与群页行为不一致 |

---

## 5. P2：可以进 1.0 known issues / 1.1

- `EmKitConfig.showTime` 是死配置（只存不用）——删掉或实现逐条时间。
- `CONVERSATION_TYPE.GROUP_CHAT` 注释仍写“预留，一期仅单聊”；`em-conversation-page` 的 create-group 注释仍写“Phase 4 占位”——发布前清 stale 注释。
- 添加好友弹窗只在 demo（`demo/pages/contact`），UIKit 无组件；文档需说明宿主自建，或补 `em-add-contact`。
- 会话/好友列表无下拉刷新；同步失败后只能杀进程/重进。
- demo `ensureLogin` 把 `CLOSED` 一律 reLaunch 登录页，网络抖动会误踢用户到登录页。
- demo 把 token 明文存 storage（`emkit.token`）；README 应提示生产用安全存储。
- 图片/视频/文件上传无进度；大文件只有 sending 转圈。
- 消息列表仍 `scroll-view` 全量渲染，长会话滚动性能一般（PLAN 已列二期）。
- 切换 `conversationId` 时未重载草稿/历史（同实例复用场景）。
- **栈内多聊天页会互相重置当前会话**：`em-chat-page` 只在 `onMounted` `enterConversation`、`onUnmounted` 无条件 `leaveConversation`（`em-chat-page.vue:648/722`），没有 `onShow`/`onHide`；从群成员「私聊」再开一个聊天页后返回旧页，旧页的已读回执/未读抑制/typing 会失效。建议 `onShow` 重新 `enterConversation`、`onHide` 仅在当前会话仍是自己时 `leaveConversation`。
- 图标字体 166 个未映射字形、`hhea.descent=0` 裁底风险（`verify-icons.py` WARN）。
- H5-pc 无桌面布局（rpx 放大、无 max-width），`widescreen` 建议标 `-`，文档别写“PC 支持”。
- 视频/文件/语音的加载失败态、多图预览、转发/搜索/黑名单/联系人详情（PLAN 已明确二期）。

---

## 6. 发布物料清单（可直接勾）

**插件包 `uni_modules/easemob-uikit-uni/`**
- [x] `package.json` version=1.0.0-rc.1；engines 与 README 一致；平台矩阵新规范、无 `"u"`；darkmode/i18n/widescreen；声明权限/数据
- [x] `changelog.md` 1.0.0-rc.1（人话版 + 0.x 迁移说明）
- [x] `readme.md` 自包含：Quick Start、平台矩阵、已知限制、版本要求、支持渠道（截图/在线预览待发布时补）
- [x] `license.md` 保留；根 `LICENSE` 补 MIT

**仓库**
- [x] README 去掉“开发中”，改为 1.0 状态 + 兼容矩阵 + 已知限制 + Quick Start 链接
- [x] `docs/QUICKSTART.md`（P0-4 的 9 节）
- [x] `docs/RELEASE-1.0.md`（发布操作清单 + 真机矩阵 + 回滚）
- [x] demo `manifest.json` 清签名/绝对路径
- [x] `.gitignore` 增本地 manifest / 签名目录
- [x] `scripts/check-release.mjs` 物料自检通过（历史签名密码仍 WARN，发布前需轮换/重写历史）
- [ ] `git tag v1.0.0-rc.1`（待发布动作）

**发布动作**
- [x] `scripts/uni.sh build web` + `build mp-weixin`（11 项）全绿（主包 837KB / 分包 1367KB）
- [x] H5 产物伺服 200
- [ ] 真实账号矩阵（§7）通过
- [ ] 插件市场：分类/截图/更新日志/示例工程/H5 链接齐备
- [ ] GitHub Release：release notes + 迁移说明 + 已知限制

---

## 7. 发布前最小真实账号矩阵（建议照此验收）

| 场景 \ 端 | H5 | 微信小程序 | Android | iOS | 鸿蒙 |
|---|---|---|---|---|---|
| 登录 → 会话同步 | 必测 | 必测 | 必测 | 必测 | 必测 |
| 单聊：文本/图片/语音/视频/文件 收发 | 必测 | 必测 | 必测 | 必测 | 必测 |
| 引用/撤回/重发/已读/typing | 必测 | 必测 | 必测 | 必测 | 抽测 |
| 群：建群/群聊/@/公告/成员/退群 | 必测 | 必测 | 必测 | 必测 | 抽测 |
| 通讯录/好友申请/群邀请 | 必测 | 必测 | 抽测 | 抽测 | 抽测 |
| 免打扰/置顶/未读/角标/草稿 | 必测 | 必测 | 抽测 | 抽测 | 抽测 |
| 深色模式（含原生 nav/tabBar） | 必测 | 必测 | 必测 | 必测 | 抽测 |
| 断网/重连/Token 过期/被踢 | 必测 | 必测 | 必测 | 必测 | 抽测 |
| 冷启动/杀进程/换账号 | 必测 | 必测 | 必测 | 必测 | 抽测 |
| 小程序 SDK 分包（首次/更新） | — | 必测 | — | — | — |

> “必测”= 发版验收必须有人签字；“抽测”= 至少一条主路径。建议把结果回填 `docs/STATUS.md` 的“已验证基线”，而不是只写“待验”。

---

## 8. 建议排期

**方案 A（推荐，1 周）**
1. D1：P0-1 元数据/物料 + P0-6 安全清理 + P0-4 Quick Start（并行）
2. D2–D3：P0-2 Token/连接 + P0-7 未读 + P1-1 返回契约 + P1-4 首屏/失败态
3. D3–D4：P0-3 视频/文件
4. D5–D6：P0-5 真机矩阵 + H5 联系人复现/修复 + 回归
5. D7：打 tag / 市场发布 / release notes

**方案 B（赶时间，2–3 天，发 `1.0.0-rc.1` 或 `0.9.0`）**
- 必做：P0-1、P0-6、P0-4、P0-2（Token 不能省）、P0-7（未读，改动小但显眼）
- 写进 known issues：视频/文件 App/mp、iOS 未验证、H5 联系人、P1 其余
- 明确“GA 前还会改协议/组件契约”，避免用户按 1.0 稳定版预期接入

---

## 9. 附：本次未做但建议尽快做的验证

- 真实账号双端互发（H5↔mp、Android↔H5）——所有 M2.11–M2.15 能力。
- iOS 真机（登录/收发/键盘/深色/分包不适用）。
- 群链路全流程（双角色：owner/admin/member）。
- Token 过期/被踢/设备超限的真实复现（可用控制台强制下线）。
- H5 联系人 0 的复现（同账号 mp 对照）。
- 大会话（1000+ 条）滚动与内存。

---

## 10. 修复进展（2026-10-21，批次 1）

> 本次按“先按平台显隐视频/文件，再逐步修其他项”的决策落地；详细记录见 `docs/STATUS.md` 同日条目。

| 项 | 状态 | 落地 |
|---|---|---|
| P0-3 视频/文件 | ◐ 已按平台显隐 | 新增 `PLATFORM_CAPABILITIES`（`videoPreview` 仅 WEB、`filePick` App=false、`fileOpen` 全端 false）；App 隐藏「文件」入口、App/mp 隐藏视频播放按钮、文件卡点击不再 toast；README/插件 readme 增平台能力矩阵。播放器/下载器本身仍待接 |
| P0-7 未读复活 | ✅ 代码已修 | `clearUnread`：本地归零 + 服务端合批清；进会话/当前会话收消息/离页 force 三处调用；`EmKit.clearConversationUnread` 透出 |
| P0-2 Token/连接 | ◐ 代码已接，待真机 | `onTokenWillExpire/onTokenExpired` 配置 + `EmKit.renewToken`；补齐 `onConnecting/onReconnectFailed` 与 `reason/errorCode` 状态；`CONNECTION_STATUS.RECONNECTING`；demo 守卫改按 userId |
| P1-3 连接状态 UI | ◐ 仅数据层 | 状态/原因/重连次数已可读，离线条组件仍未做 |
| 其余 P0 | — | 未动：发布物料/元数据、Quick Start、公开仓清理、真机矩阵、H5 联系人复现 |

**验证**：`build web` ✓；`build mp-weixin` 11 项全绿（主包 836KB / 分包 1367KB）。**待真实账号/真机**：视频/文件显隐后的三端行为、未读不复活、Token 续期与被踢。

## 11. 修复进展（2026-10-21，批次 2）

| 项 | 状态 | 落地 |
|---|---|---|
| P0-1 发布物料 | ✅ 代码/文档已备 | 插件版本 `1.0.0-rc.1`；平台矩阵按 HBuilderX 4.71+ 新规范；暗黑/多语言/宽屏声明；权限与数据声明；changelog；根 MIT LICENSE |
| P0-4 Quick Start | ✅ | 新增 `docs/QUICKSTART.md`（9 节 + 排错 + 验收清单）；根 README 顶部改 1.0 状态/兼容矩阵/最短路径；插件 readme 自包含重写 |
| P0-6 公开仓安全 | ◐ 当前树已清 | 删除 demo manifest 鸿蒙签名绝对路径/密码；`.gitignore` 补签名材料；**已推送历史仍需重写/轮换** |
| P1-1 返回契约 | ✅ 非 breaking | `em-chat-page` 增 `back` emit + `autoBack`（默认 true 保持原行为） |
| P1-2 引用协议 | ✅ 代码已修 | 主协议 `msgQuote`（vue 同结构）+ 旧 `emQuote` 双写；接收优先 `msgQuote`、回落旧 key；重发排除双 key |
| P1-3 连接状态 UI | ✅ 代码已接 | 新增 `em-connection-banner`；会话页/聊天页默认内置，`showConnectionBanner=false` 可关 |
| P1-4 首屏空态/失败重试 | ✅ 代码已修 | 首次历史结束前显示骨架；500ms 兜底只解 opacity；失败 toast + 空态/顶部重试行；`#empty` 只在成功空列表展示 |
| P1-5 录音兜底 | ✅ 代码已修 | `EmRecordOptions.onError/onAutoStop`；权限失败 toast；60s 自动停止后正常发送；单例监听 |
| P1-6 日志脱敏 | ✅ 代码已修 | `logPayload` 默认 false；仅 debug + 显式开启才序列化；contact/group 原始 dump 全部替换 |
| P1-8 语言持久化 | ✅ 代码已修 | `initLocale/setLocale/getLocale` + `EmKit.setLocale` + `emkit.locale`；系统语言兜底 |
| P1-11 列表自同步 | ✅ 代码已修 | `em-conversation-page` / `em-contact-list-page` 增 `autoSync`（默认 true），首次挂载自拉 |
| P1-10 消息内存上限 | ✅ 代码已修 | 非当前会话保留最近 100 条；离开当前会话裁剪；`trimmed` 标记触发下次重拉最新页，避免游标断层 |
| 其余 P0/P1 | — | 真机矩阵、H5 联系人、测试/CI 等未动 |

**验证**：`build web` ✓；`build mp-weixin` 11 项全绿（主包 850KB）；H5 产物伺服 200；headless Chrome 登录页渲染正常；`check-release.mjs` ✓。**待验**：多群消息数组 ≤100、被裁剪会话重进不断层、连接条真机文案/布局、录音权限与 60s、语言持久化、`logPayload` 导出、与 vue 版双向引用、`autoBack=false` 拦截、插件市场新矩阵展示、鸿蒙签名本地重配。
