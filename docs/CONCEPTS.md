# 核心概念与架构

这页说明 UIKit 由哪些层组成、一次登录到收发消息经历什么、页面组件和原子组件如何分工，以及宿主应该把哪些职责留在自己的应用里。先读这页，再按 [快速开始](./QUICKSTART.md) 接入，会更容易定位问题。

## 1. 设计目标

- **一套组件覆盖五端**：uni-app x 蒸汽模式（Android / iOS / 鸿蒙）、H5、微信小程序，平台差异集中在库内处理。
- **页面级开箱即用**：会话、聊天、聊天信息、通讯录、好友申请、群组都是完整页面组件，宿主只负责路由与业务入口。
- **业务可以逐层接管**：从全局配置、页面 props，到具名插槽、`EmKit` API、store，按需要深入到任意一层。
- **零运行时依赖**：除 peer 依赖 `easemob-websdk@5.1.3` 外不引入第三方运行时库；状态用 Vue `reactive`，样式用 ucss 子集。

## 2. 分层结构

```text
uni_modules/easemob-uikit-uni/
├── components/
│   ├── pages/                  # 页面级组件（em-*-page），需要 easycom custom 规则
│   └── em-*/                   # 原子组件（气泡、头像、弹层、输入栏等）
└── libs/
    ├── index.ts                # EmKit 门面：宿主唯一 API 入口
    ├── client/                 # SDK 初始化、登录、连接状态、Token 续期、SDK 加载
    ├── chat/                   # 消息、会话、联系人、群组、用户资料等业务域
    ├── store/                  # reactive 状态：connection / conversation / message / contact / group / user / config / theme / draft
    ├── platform.ts             # 存储、媒体选择、录音、播放、文件导出等平台适配
    ├── use/                    # useTheme / useLocale / useSafeArea / useKeyboardHeight / usePopup / useUnreadCounts / useTabBarBadge
    ├── locale/                 # zh-CN / en 文案
    ├── style/                  # variables.css（--em-*）、气泡基类、文字样式
    ├── constants/              # 枚举与常量单一真相源
    ├── types/                  # 对外类型
    └── utils/                  # 日志、时间、引用、@ 提及、拼音、流式判定
```

**依赖方向**：`components → libs`；`libs` 不反向依赖任何 UI 组件。宿主只应依赖 `libs/index.ts` 的公开导出，不要直接 import `libs/chat/*` 或 `libs/store/*` 内部模块。

## 3. 生命周期

### 3.1 初始化（每个应用进程一次）

```ts
import { EmKit, initTheme } from '@/uni_modules/easemob-uikit-uni/libs'

onLaunch(() => {
  initTheme()
  EmKit.init({
    appkey: 'your-appkey',
    onTokenWillExpire: async () => {
      // 由宿主服务端签发新 token
      return await fetchNewImToken()
    },
    onTokenExpired: () => {
      uni.reLaunch({ url: '/pages/login/login' })
    }
  })
})
```

- `initTheme()` 越早越好，避免首屏主题闪烁；详见 [主题与国际化](./THEME-I18N.md)。
- `EmKit.init()` 是同步返回的：内部异步加载 SDK、创建 `ChatClient`、注册 Manager。
- **初始化每个进程只生效一次**；`logout()` 后直接重新 `login()`，不要再次 `init()`。需要切换 appkey 时重启应用进程。
- 初始化失败（例如小程序分包文件缺失）会清空内部缓存，修正配置后可重新调用 `init()`。

### 3.2 就绪门

所有依赖 SDK 的异步方法都会先 `await whenReady()`：

```ts
await EmKit.whenReady()
// 此时 SDK 模块已加载、ChatClient.init 完成，可以登录
```

宿主需要在首屏显示“加载消息服务…”占位态时，`await EmKit.whenReady()` 后再渲染；未 `init()` 就调用会 reject。需要原生 `ChatClient` 注册 SDK 事件时，用语义更明确的 `await EmKit.getSDKClient()`；它只等待初始化完成，不代表登录或连接在线，普通收发仍优先走 EmKit。

### 3.3 登录 / 登出

```ts
await EmKit.login({ userId, token })
// 登录成功后 UIKit 会拉取自己的资料、好友快照与群快照

await EmKit.logout()
// 退出当前会话、断开 SDK，并清空会话/消息/联系人/群/草稿/邀请等账号私有状态
```

登录后的数据同步由 SDK 事件驱动，页面组件读取 reactive store 即可自动更新；`loaded / syncing / syncFailed` 区分未加载、加载中、失败与权威空列表，后台失败不会清掉缓存。会话列表页默认在首次挂载时调用真实 `refreshSessionList`；从二级页返回时，宿主可在 `onShow` 再调 `EmKit.syncConversations()` 补刷新。联系人重试使用 SDK 受控刷新；群快照只读，群后台同步失败后需恢复连接或重新登录。

### 3.4 页面生命周期与事件订阅

- 页面级组件在 `onMounted` 注册事件、`onUnmounted` 反注册；宿主自己的 `EmKit.onMessage` 订阅也必须保存返回的取消函数并在页面卸载时调用。
- 聊天页进入时会：进入会话、拉历史、未读清零、滚底、已读回执、草稿恢复。宿主不需要重复这些动作。
- 返回行为：`em-chat-page` 默认自行 `navigateBack`；传 `:auto-back="false"` 后只触发 `@back`，由宿主接管退场。

## 4. 数据流

```text
环信 SDK 事件
   ↓
libs/chat/* 业务域（归一化 wire 字段、过滤 cmd、合并流式分片）
   ↓
libs/store/* reactive 状态
   ↓
页面组件 computed / 原子组件渲染
   ↑
宿主调用 EmKit 方法（发送、置顶、免打扰、群管理…）
```

- **wire 字段只在 `libs/chat` 边界出现**：组件与宿主看到的是 `EmMessageItem`、`EmConversationItem`、`EmGroup` 等中立类型。
- **消息统一走 `toMessageItem`**：发送、接收、历史三条路径归一化，引用、@ 提及、自定义消息、流式消息的结构一致。
- **store 是模块级单例**：跨页面共享；登出会清空账号私有状态，避免同设备换账号串数据。
- **列表排序在 UI 层显式完成**：会话页不直接使用 SDK 快照顺序，置顶会话与普通会话分别按置顶时间/最后消息时间排序。

## 5. 页面组件模型

页面组件（`em-*-page`）是“带导航栏和完整交互的页面”，不是普通原子组件：

| 组件 | 职责 | 宿主需要做 |
|---|---|---|
| `em-conversation-page` | 会话列表、筛选、搜索、置顶/免打扰/删除、发起会话 | 路由到聊天页；`onShow` 补同步 |
| `em-chat-page` | 消息列表、输入栏、历史、引用/撤回/重发、群聊形态、流式消息 | 路由到聊天信息页；可选业务插槽 |
| `em-chat-info-page` | 单聊资料、群资料、成员管理、退群/解散 | 返回/退场；成员私聊跳转 |
| `em-contact-page` | 通讯录入口（新请求/群组/好友列表） | 按 entry key 分发路由 |
| `em-contact-list-page` | 好友列表、字母索引、搜索、长按删除 | 返回；点击好友发起会话 |
| `em-contact-requests-page` | 好友申请/群邀请处理 | 返回 |
| `em-group-page` | 群列表、建群面板 | 点击群进聊天；建群成功进聊天 |

页面组件自带 `em-nav-bar`（安全区、小程序胶囊避让）。宿主 `pages.json` 必须：

1. 为页面组件配置 easycom custom 规则：

```json
{
  "easycom": {
    "autoscan": true,
    "custom": {
      "^em-([a-z-]+)-page$": "@/uni_modules/easemob-uikit-uni/components/pages/em-$1-page/em-$1-page.vue"
    }
  }
}
```

2. 对自带导航栏的页面设置 `navigationStyle: "custom"`，否则会出现双标题栏：

```json
{
  "path": "pages/chat/chat",
  "style": {
    "navigationStyle": "custom",
    "app-plus": { "titleNView": false }
  }
}
```

3. 页面根节点撑满高度并保持 flex 链：

```css
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
```

## 6. 原子组件模型

原子组件只负责一个视觉/交互单元，数据通过 props 传入，动作通过 events 透出，不直接连 store（少数页面内组合组件除外）。典型分层：

- **基础**：`em-avatar`、`em-badge`、`em-button`、`em-icon`、`em-text`、`em-empty`、`em-skeleton`、`em-nav-bar`、`em-popup`、`em-action-sheet`、`em-search-bar`、`em-load-more`。
- **会话**：`em-conversation-item`、`em-conversation-tabs`、`em-connection-banner`。
- **聊天**：`em-chat-inputbar`、5 种消息气泡、`em-quick-reply-bar`、`em-mention-picker`。
- **联系人与群**：`em-contact-nav`、`em-alphabet-nav`、`em-select-contact`、群资料/成员相关组合组件。

完整契约见 [组件参考](./COMPONENTS.md)。

## 7. 三种接入形态

### 7.1 完整 IM 应用

使用会话页 + 聊天页 + 通讯录 + 群组页，宿主只做登录、tabBar 和业务入口。适合独立 IM App 或 App 内的完整消息中心。

### 7.2 业务直进会话

没有会话列表，业务页面放一个“联系客服/联系卖家/沟通职位”按钮，直接 `navigateTo` 到聊天页：

```ts
uni.navigateTo({
  url: `/pages/chat/chat?conversationId=${peerUserId}&chatType=singleChat`
})
```

聊天页自身完成进入会话、历史、未读、发送。业务上下文可通过 `sendText` 的 `ext`、`#banner`、`title` 等注入。详见 [多场景接入](./GUIDE-MULTI-SCENARIO.md)。如果需要包含登录恢复、聊天页和小程序分包的完整工程，可直接使用仓库 [`templates/chat-only`](https://github.com/easemob/easemob-uikit-uniapp/tree/main/templates/chat-only)。

### 7.3 只用数据层

宿主自绘 UI，只使用 `EmKit` 与响应式 store：

```ts
import { EmKit, useUnreadCounts, useConversationUnreadCount } from '@/uni_modules/easemob-uikit-uni/libs'

const { conversationUnread } = useUnreadCounts()
const peerUnread = useConversationUnreadCount('user-b')

const list = EmKit.conversations.items
```

## 8. 样式与主题

- 所有颜色、字号、间距、圆角走 `--em-*` 设计变量；页面根节点绑定 `themeClass`（`em-theme-light` / `em-theme-dark`）。
- App 端没有 `:root`，变量通过页面根节点内联/类名下行；不要在组件里写死颜色。
- 自定义品牌色：`EmKit.init({ primaryColor: '#009EFF' })`，或运行时 `setConfig({ primaryColor })`。
- ucss 是 CSS 子集：App 端不支持伪元素、复杂选择器、`calc()` 与变量组合等；跨端样式请参考 [设计变量](./DESIGN-TOKENS.md) 与 [平台能力与差异](./PLATFORM.md)。

## 9. 安全边界

- `appkey` 可以放前端；**token 必须由业务服务端签发**，不要在前端保存 AppSecret、管理员密码或长期 token。
- `onTokenWillExpire` 中通过宿主自己的登录态（Cookie / Bearer / 自定义 header）换取新 token，返回给 UIKit。
- 生产环境不要打开 `logPayload`；调试完成后关闭，避免日志包含 userId、昵称等原始数据。
- 自定义消息的卡片内容由宿主渲染；如果展示服务端下发的 markdown/HTML，请在宿主侧做净化。

## 10. 下一步

- [快速开始](./QUICKSTART.md)：从空工程到收发消息。
- [页面指南](./PAGES-CONVERSATION.md)：每个页面组件的完整契约与接线。
- [EmKit API](./API-KIT.md)：所有公开方法与返回值。
- [配置参考](./CONFIG.md)：初始化、行为开关与页面级配置。
- [平台能力与差异](./PLATFORM.md)：五端能力矩阵与限制。
