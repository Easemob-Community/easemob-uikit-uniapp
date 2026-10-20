# easemob-uikit-uniapp

环信 IM 的 uni-app 版 UIKit（uni-app x 蒸汽模式），面向 DCloud 插件市场社区分发。MIT 开源。

> 当前状态：**一期开发中（M2.9 群基础、M2.11/M2.12 多场景扩展 P0/P1、M2.13 AI 流式消息已落地）**。一期执行依据见 [PLAN.md](./PLAN.md)，逐日进度与各端验证状态见 [docs/STATUS.md](./docs/STATUS.md)。

## 开发环境（锁定）

- HBuilderX **5.26+**（或 HBuilder V 5.21+，蒸汽模式硬性要求）
- Node.js 18+（CLI 编译用）
- 目标平台：Android 6+ / iOS 15+ / 鸿蒙 API20+ / 现代浏览器 / 微信小程序

## 仓库结构

```
uni_modules/easemob-uikit-uni/   # UIKit 插件本体（组件前缀 em-）
demo/                            # 演示工程（uni-app x，manifest.json 开启 vapor）
docs/                            # 文档（含 SDK 五端连通性 spike 记录）
scripts/                         # 编译/发布脚本
```

## 快速开始（最小可验证用例）

最小用例是 `demo/pages/spike/spike.vue`：手填 appkey/userId/token 登录环信，给指定 peer 发文本消息并显示收发流，用于验证 SDK 各端连通性。

方式一（HBuilder）：用 HBuilderX / HBuilder V 打开 `demo/` 目录，运行到浏览器 / 微信开发者工具 / 真机。

方式二（CLI，走 HBuilderX 内置编译器）：

```bash
cd demo && npm install        # 安装 easemob-websdk
cd ..
scripts/uni.sh build web      # H5 出包
scripts/uni.sh build mp-weixin # 微信小程序出包（用微信开发者工具打开 demo/unpackage/dist/build/mp-weixin）
# H5 本地验证：dev 模式暂不支持 .uts 入口，用构建产物 + 静态伺服
cd demo/unpackage/dist/build/web && python3 -m http.server 5180
```

> appkey 与测试 token 从环信控制台获取（仅限开发用途），**不要**把真实凭据提交进仓库。

## 未读角标 / tabBar（响应式）

UIKit 对外暴露两个响应式未读数，口径与 vue 版一致：

- `conversationUnread`：所有会话 `unreadCount` 之和（含免打扰会话）
- `contactRequestUnread`：收到的、仍 pending 的好友申请/群邀请（我方发出后被处理的通知不计）

```ts
import { onShow } from '@dcloudio/uni-app'
import { useUnreadCounts, useTabBarBadge, useConversationUnreadCount } from '@/uni_modules/easemob-uikit-uni/libs'

// 1) 只取响应式数值，自定义 tabbar / 页面红点：
const { conversationUnread, contactRequestUnread } = useUnreadCounts()

// 2) 原生 tabBar 角标（在任一 tab 页 setup 调用一次；tab 页常驻，切换 tab 后仍持续更新）：
const tabBarBadge = useTabBarBadge({ conversationIndex: 0, contactIndex: 1 })
onShow(() => tabBarBadge.sync()) // 从聊天页返回 tab 页时补同步（平台要求当前页必须是 tabBar 页）

// 3) 单会话未读（业务入口角标，P1）：
const peerUnread = useConversationUnreadCount(peerUserId)
```

- 非 setup 场景（App onLaunch、原生回调）用 `getUnreadCounts()` 取快照，或 `EmKit.conversationUnreadCount` / `EmKit.contactRequestUnreadCount` getter；单会话快照用 `EmKit.conversationUnreadCountOf(conversationId)`。
- 角标封顶默认 99（显示 `99+`），可通过 `maxCount` 调整；`enabled: false` 可整体关闭。
- 自定义 tabbar 直接用 `em-icon` + `em-badge` 渲染 computed 值，不依赖 `uni.setTabBarBadge`。
- 原生 tabBar 的 `iconPath` 只接受图片（平台限制），demo 用 `scripts/build-tabbar-icons.py` 从 `em-icons.ttf` 同源字形生成 81×81 PNG（`demo/static/tabbar/`）；组件内图标仍统一用 `em-icon` 字体。

## 多场景扩展（业务直进会话）

客服 / 医疗 / 招聘 / 二手交易共享「业务页面放入口 → 直进 1v1 聊天页」模型，无需会话列表。P0/P1 扩展点：

| 能力 | 用法 |
|---|---|
| 业务上下文 ext | `EmKit.sendText(to, chatType, text, quote?, mentions?, ext?)`，对端从 `message.ext` 读取 |
| 卡片消息 | `EmKit.sendCustom(to, chatType, event, params?, ext?)`；接收侧 `#custom-message` 插槽按 `message.customEvent` 渲染 |
| 顶部业务条 | `em-chat-page` 的 `#banner` 插槽（固定位，不随消息滚动）；`title` / `showAction` 控制标题与详情入口 |
| 系统提示灰条 | `EmKit.insertLocalNotice(conversationId, chatType, text)`（只插本地，不发服务端） |
| 单会话未读 | `useConversationUnreadCount(conversationId)`（响应式）/ `EmKit.conversationUnreadCountOf(id)`（快照） |
| 快捷回复 | `em-chat-page` 的 `quickReplies` + `quickReplyMode`（`fill` 填草稿 / `send` 直发） |
| 业务长按动作 | `em-chat-page` 的 `extraMessageMenus` + `@message-menu(key, message)` |

完整代码示例（easycom、init→login→navigateTo、四场景配方、平台边界）见 [docs/GUIDE-MULTI-SCENARIO.md](./docs/GUIDE-MULTI-SCENARIO.md)。

**demo 体验**：「我的」→「多场景能力演示」→ 选对端进入会话（`?scene=1`），点「场景开关」实时切换横幅/标题/详情入口/快捷回复/业务菜单，并可发送商品卡片、带 ext 文本、交易提示。

## AI 流式消息（Stream Message，M2.13）

对齐 vue 版「内核薄、插件厚」：**数据链路与纯文本流式渲染内置、零配置可用**；markdown 等富格式由宿主插槽接管。
典型场景：AI 客服 / IM 内 AI 对话 / 分段生成内容。流式内容由**业务服务端**经环信 RESTful 下发，客户端只收不发。

### 开箱即用能力

1. **分片合并**：`onStreamMessage` 按 `msgServerId` 把分片幂等合并进同一条 TEXT 气泡（`body.content = stream.fullText`），不产生多条气泡；
2. **丢片补偿**：离线/断连错过分片时，随后到达的完整消息（`onMessage`）覆盖未完成流式副本并收敛终态，不残留半截内容；
3. **纯文本流式状态**：传输中尾部打字机光标 → 终态收敛普通文本；`STREAM_ERROR` 尾部追加「内容生成异常」；
4. **高性能**：分片索引 O(1) 定位 + 按 `streamThrottle` 合批写 store（默认 50ms，≤20 次重绘/秒），终态立即落盘；聊天页跟随滚动独立节流（120ms），用户上翻时自动暂停；
5. **配置化**：`EmKitConfig.enableStreamMessage` 可关闭整条流式链路（等完整消息一次上屏），运行时用 `setConfig()` 切换。

### 接入代码

```ts
import { EmKit, setConfig } from '@/uni_modules/easemob-uikit-uni/libs'

EmKit.init({
  appkey: 'your-appkey',
  // 默认 true；false = 忽略 onStreamMessage 分片，等完整消息一次性上屏
  enableStreamMessage: true,
  // 分片合批间隔（ms），默认 50；0 = 逐片即写（高刷演示/调试）
  streamThrottle: 50
})
await EmKit.login({ userId, token })

// 可选：外部 AI 面板/埋点订阅流式更新（分片已合批，msg.stream 携带最新全文与状态）
const off = EmKit.onStreamMessage((msg) => {
  console.log(msg.conversationId, msg.stream?.status, msg.stream?.fullText)
})
// 页面 onUnmounted 必须 off()
```

消息上的流式元信息（`EmMessageItem.stream`，仅流式消息携带）：

| 字段 | 说明 |
|---|---|
| `fullText` | 截至当前分片的累计全文（与 `message.text` 同值） |
| `deltaText` | 当前分片增量（供自定义动画/统计，展示以 fullText 为准） |
| `status` | `STREAM_START` / `STREAM_IN_PROGRESS` / `STREAM_COMPLETED` / `STREAM_START_COMPLETED` / `STREAM_ERROR` |
| `customType` | 业务自定义流类型，如 `'text'` / `'markdown'` |
| `seq` / `errorType` / `finishReason` | 分片序号 / 错误码 / 服务端结束原因 |

### 富格式（markdown）由宿主接管

内核只渲染 `customType='text'`（含缺省）的纯文本流；`markdown` 等富格式经 `em-chat-page` 的 `#stream-message` 插槽接管（未提供插槽时纯文本兜底，内容仍随分片增长）：

```vue
<em-chat-page :conversation-id="id" :chat-type="chatType">
  <template #stream-message="{ message }">
    <my-markdown-bubble :message="message" />
  </template>
</em-chat-page>
```

### Demo 演示

- **聊天页「AI 演示」悬浮入口**：向当前会话注入 mock AI 流式回复（完成 / 异常 / 停止），演示光标与终态/异常；
- **「我的」→ AI 流式消息**：运行时开关 `enableStreamMessage`；
- **样式实验室 → AI 流式消息**：独立流式气泡演示（不依赖登录/会话），显示分片数与状态。

> 生产接入务必走**业务服务端代理**：服务端调用模型 → 经环信 RESTful 下发流式消息 → 客户端 `onStreamMessage` 接收；不要把模型 API Key 放到前端。

## 深色模式（默认跟随系统）

主题偏好三档 `auto | light | dark`，默认 `auto`：App 跟随系统深色（`osTheme`）、H5 跟随 `prefers-color-scheme`、微信小程序跟随宿主主题（`hostTheme`）；系统切换实时生效，用户手选档位持久化在设备本地（`emkit.themeMode`，不随登出清理）。

```ts
import { onShow } from '@dcloudio/uni-app'
import { initTheme, useTheme, syncNativeThemeUI, THEME_MODE } from '@/uni_modules/easemob-uikit-uni/libs'

// App.vue 的 onLaunch 调用一次（页面 setup 里 useTheme 也会兜底初始化）
initTheme({ tabBarPages: ['pages/conversation/conversation', 'pages/contact/contact', 'pages/mine/mine'] })

// 页面 setup：根节点绑定 themeClass（App 端无 :root，主题 class 必须挂根节点）
const { themeClass, themeStore, setTheme } = useTheme()
onShow(() => syncNativeThemeUI()) // 同步原生导航栏 / tabBar（主题变化时也要再调一次）

setTheme(THEME_MODE.DARK)   // 强制深色；setTheme(THEME_MODE.AUTO) 恢复跟随系统
themeStore.mode             // 解析后的实际主题：'light' | 'dark'
```

- **原生 chrome**：`syncNativeThemeUI()` 动态设置导航栏/tabBar 颜色；`tabBarPages` 命中当前页才会同步 tabBar（避免非 tab 页 API 报错）。
- **首帧不闪**：`pages.json` 用 `@变量` 引用 `theme.json`，并在 `manifest.json` 开 `mp-weixin.darkmode` / `web.darkmode`；App 配 `app.defaultAppTheme: 'auto'`（本仓库 demo 已接线）。
- **H5 限制**：H5 运行时没有 `setNavigationBarColor` / `setTabBarStyle`，内置导航栏/tabBar 由宿主接管（参考 `demo/index.html` 的 `html[data-em-theme] .uni-page-head` / `.uni-tabbar` 规则，以及 `demo/common/theme.ts` 的 `syncH5Chrome()` 选中态同步）。
- 宿主页面若自己实现主题切换，监听 `themeStore.mode` 后调 `syncNativeThemeUI()` 即可；`demo/common/theme.ts` 的 `useDemoTheme()` 是完整封装示例。

## 路线图与能力边界

已落地（一期，里程碑与验收口径见 [PLAN.md](./PLAN.md)，逐日进度见 [docs/STATUS.md](./docs/STATUS.md)）：

- 单聊全链路：会话列表（置顶/免打扰/未读/草稿）、聊天页（文本/图片/语音/视频/文件、引用/撤回/失败重发/已读回执/typing）、聊天详情、通讯录（好友列表/好友申请）
- **群基础（M2.9）**：群列表、建群、群聊（公告条 / @ 提及 / 成员昵称行）、群详情管理（公告编辑 / 改名 / 管理员 / 转让 / 退群解散 / 全员禁言 / 成员管理 / 邀请入群）、联系人页入口化（新请求 / 群组 / 好友列表三入口）
- **多场景扩展 P0（M2.11）**：`sendText` 业务 ext、`sendCustom` 自定义消息、`#banner` 顶部业务条、`title`/`showAction`、`insertLocalNotice` 系统提示灰条
- **多场景扩展 P1（M2.12）**：单会话未读 API、`em-quick-reply-bar` 快捷回复条、`extraMessageMenus` 业务长按动作
- **AI 流式消息（M2.13）**：`onStreamMessage` 分片合并/丢片补偿、纯文本打字机光标与异常提示、`enableStreamMessage`/`streamThrottle` 配置、`EmKit.onStreamMessage` 订阅、`#stream-message` 富格式插槽

二期（M4 起，另行立项）：单条转发、联系人详情页/黑名单、文档站等，见 PLAN.md 第 5 节。一期范围外的功能会在发版时逐条冻结公示，避免重复 issue。

### 不做什么（一期，群侧裁剪）

黑名单/白名单管理页、群共享文件、公开群入群申请审批、群名片、群已读回执详情、群聊消息搜索、群公告富文本、presence 在线状态。完整裁剪清单见 PLAN.md 第 2 节与各里程碑「明确不做」。

### 已知限制

- **@ 提及为追加式插入**：选人后追加到草稿尾部，不支持光标处插入——uni `<input>` 无光标位置 API（无 selectionStart），属平台物理上限。
- 其余平台降级项（蒸汽端 CSS 动画、H5 录音等）见 docs/STATUS.md 各条目「已知降级」。

### 迁移说明（M2.9 breaking 变更）

- `em-contact-page` 由「好友主页」重构为「入口页」（新请求/群组/好友列表三入口，emits `entry-click` + `add`）；原好友列表零回归平移至新页面级组件 `em-contact-list-page`（emits `select`/`back`），宿主按入口 key 接线路由。
- `em-chat-page` / `em-chat-info-page` 新增**必传** `chatType` prop（`'singleChat' | 'groupChat'`）；消息/会话域 API 同步增必传 `chatType` 参数，`EmMessageItem`/`EmConversationItem` 增 `chatType` 字段。

### 迁移说明（M2.11 非 breaking）

- `MESSAGE_TYPE` 新增 `CUSTOM`（`'custom'`），`EmMessageItem` 新增 `customEvent` / `customParams` 字段；仅当宿主**手工构造** `EmMessageItem`（如单测/假数据）时需要补 `customEvent: ''`、`customParams: {}`，正常收发链路不受影响。
