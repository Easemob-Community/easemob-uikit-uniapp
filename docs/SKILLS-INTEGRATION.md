<!-- Generated from skills/em-host-integration/SKILL.md by scripts/sync-skills-docs.mjs. Do not edit directly. -->

# 宿主接入总纲（easemob-uikit-uni）

> 适用基线：UIKit `1.0.0-rc.2` · websdk `5.2.0` · HBuilderX `5.21+` · uni-app x（Vue3、蒸汽模式）。
> 本技能只做**总纲与最短可用链路**；页面细节按任务加载文末「细分技能」。

## 1. 先判断边界

**适用**：宿主已有（或即将创建）一个 uni-app x 工程，用现成 `em-*` 组件收发 IM 消息，**不改 UIKit 源码**。

**不适用**：
- 经典 uni-app（Vue2 / 非 x 编译器）——本插件是 uni-app x 插件，页面需 `.uvue`；DCloud 2024 年已停 nvue/5+ 维护、2027 年初停 App 平台与 vdom 平台维护，老工程请升级蒸汽模式（见 https://doc.dcloud.net.cn/uni-app-x/ 的 FAQ「老 uni-app 还维护吗？」）；
- 要新增/修改 UIKit 组件、libs、样式——那是在开发 UIKit，读仓库根 `AGENTS.md` 的 `.agents/skills/`；
- 只想接环信 SDK、不用 UIKit UI——用 `easemob-websdk` 官方文档即可。

## 2. 动代码前必须确认的 5 件事

| # | 信息 | 用途 | 缺失时怎么办 |
|---|---|---|---|
| 1 | 环信 **AppKey** | `EmKit.init({ appkey })` | 用占位符 `YOUR_APPKEY` 并明确标记待填写，不要编造 |
| 2 | **token 签发接口** | 客户端拿 `userId + token` 登录 | 用 `POST /api/im/token` 占位；生产 token **必须服务端签发** |
| 3 | userId 来源 | 宿主账号体系与 IM userId 的映射 | 明确是复用业务 userId 还是另建映射 |
| 4 | 入口形态 | 完整 IM（会话列表）还是业务页直进聊天 | 决定接 `em-conversation-page` 还是只接 `em-chat-page` |
| 5 | 目标端 | H5 / 微信小程序 / App（Android/iOS/鸿蒙） | 小程序必须额外做 SDK 分包；App 需真机 |

用户没说清就先问；不要在未确认 token 接口的情况下写死假 token 进业务代码。

边界补充：私有部署（自定义 IM / REST 服务器地址）当前版本不支持——`EmKit.init` 不透传服务器地址配置，仅连接默认公有云 endpoint。需要私有部署时先与环信确认版本支持。

## 3. 环境自检

| 项 | 要求 | 怎么确认 |
|---|---|---|
| HBuilderX | 5.21+（推荐 5.26+） | 关于面板 |
| uni-app x | 4.71+，Vue3 组合式 API | `manifest.json` |
| 蒸汽模式 | `"uni-app-x": { "vapor": true }` | 见 `demo/manifest.json` |
| Node.js | 18+ | `node -v` |
| 环信 SDK | `easemob-websdk` **精确 5.2.0** | `package.json` 不带 `^`/`~` |

**用 CLI 构建 H5 还要补一个开关**：CLI（`uni build -p web`）下 Web 蒸汽模式以**工程根目录存在 `.vapor` 文件**为准——不读 `manifest.json` 的 `vapor` 字段。缺失时会静默退回 VDOM 模式，构建期直接报错（典型报错见 `em-host-troubleshooting` 的构建期症状）。HBuilderX GUI 构建无需关心。

```bash
# 工程根目录；空文件，提交进仓库
touch .vapor
```

## 4. 安装

```bash
# 宿主工程根目录
npm install easemob-websdk@5.2.0 --save-exact
```

把插件放进宿主工程：

```text
your-app/
├── uni_modules/
│   └── easemob-uikit-uni/        ← 插件市场导入，或直接拷贝仓库同名目录
├── pages/
└── package.json                  ← peer 依赖 easemob-websdk 5.2.0
```

- `easemob-websdk` 是 **peer 依赖**，UIKit 不自带，也不允许再装第二份。
- UIKit 零运行时依赖；不要为它引入 UI 库、请求库或状态库。
- 小程序端不要自己 `import 'easemob-websdk'`（会进主包）；UIKit 已内置跨分包加载，见 `em-host-mp-subpackage`。

### 4.1 App 发行与权限声明（宿主必做）

先补 Android/iOS 的 WebSocket 原生模块，再检查媒体权限。环信 SDK 通过运行时适配对象调用 `connectSocket`，静态摇树可能漏掉 `uni-websocket`；缺失时调试基座可能正常，发行包却无法建立 IM 长连接：

```json
{
  "app-android": {
    "distribute": {
      "modules": { "uni-websocket": {} }
    }
  },
  "app-ios": {
    "distribute": {
      "modules": { "uni-websocket": {} }
    }
  }
}
```

`uni-network`、`uni-getNetworkType`、`uni-fileSystemManager`、`uni-media` 等直接调用通常能被自动扫描，不要复制全量模块清单。自定义 UTS 插件或新增动态 `uni.xxx` 调用时，检查实际生成清单。

| 必要项 | 要写在哪 | 要求 |
|---|---|---|
| 文件插件最低版本 | `manifest.json` → `app-android.distribute.minSdkVersion`；插件 `deploymentTarget` | 使用 `easemob-file-picker` 时为 Android API 24 / iOS 16；不使用该插件时 UIKit 基础环境为 Android 6 / iOS 15 |
| Android 媒体权限 | 最终合并后的 `AndroidManifest.xml` | 确保实际使用的 `CAMERA`、`RECORD_AUDIO`、相册能力存在；通常由 uni 模块引入，不重复添加过宽存储权限 |
| iOS 用途描述 | `manifest.json` → `app-ios.distribute.privacyDescription` | `NSCameraUsageDescription`、`NSMicrophoneUsageDescription`、`NSPhotoLibraryUsageDescription`；保存到相册再加 `NSPhotoLibraryAddUsageDescription`，文案必须对应实际用途 |
| 鸿蒙权限 | 工程根目录 `harmony-configs/entry/src/main/module.json5` → `requestPermissions` | `ohos.permission.MICROPHONE`、`ohos.permission.CAMERA`（都要带 `reason` 与 `usedScene.inuse`）；生成工程未包含 `ohos.permission.GET_NETWORK_INFO` 时也要补上 |
| 微信小程序 | 微信公众平台「用户隐私保护指引」+ `app.json` 的 `permission` / `requiredPrivateInfos` | 麦克风、相机、相册按实际用到声明 |
| H5 | 无需声明 | 不录音、不写相册 |

修改模块、权限或隐私声明后，必须重新打自定义基座或发行包；JS 热更新不会补入原生能力。

**推荐发行配置**：

| 配置 | 建议 |
|---|---|
| `app-android.distribute.targetSdkVersion` | 按发行渠道与当前 HBuilderX 支持情况显式设置，并回归对应系统行为；不要照抄固定数值 |
| `app-android.distribute.abiFilters` | 64 位真机发行可明确为 `["arm64-v8a"]`；按真实设备需求增加其他 ABI |
| `defaultAppTheme` | 跟随系统主题时在 `app-android` / `app-ios` 设为 `"auto"`；微信小程序和 H5 分别开启 `darkmode` |
| `web.router.mode` | 简单静态托管用 `"hash"`；`history` 需要服务端回退到 `index.html` |
| HTTP/WS | 优先 HTTPS/WSS；宿主其他网络能力必须用明文时，Android 需在原生 `AndroidManifest.xml` 的 `application` 节点设置 `android:usesCleartextTraffic="true"`，不要默认全局放开 |

**鸿蒙特有坑（必读）**：

- HBuilderX 是把 `harmony-configs/` 下的文件**整份覆盖**到生成工程，**不是按节点合并**。只放一段 `requestPermissions` 会把 `abilities` 等结构打掉，工程直接坏。必须提供**完整**的 `module` 配置（可直接拿生成工程的 `entry/src/main/module.json5` 改），并保留已有 `INTERNET` 等声明。
- `GET_NETWORK_INFO` 用于网络状态监听和发送前预检，是否由框架/基座自动加入以实际生成文件为准；缺失时显式补上。它属于系统授权，不会弹用户授权框。
- 选择相册和文件**不用**声明权限：`uni.chooseImage` / `uni.chooseVideo` / `uni.chooseFile` 走系统 Picker。保存图片/视频走系统保存确认框，也无需声明 `READ_IMAGEVIDEO` / `WRITE_IMAGEVIDEO`。
- UIKit 只写剪贴板、不读取，无需声明 `READ_PASTEBOARD`。
- 用户授权类权限声明后，按住说话或首次拍摄会**自动弹出系统授权框**（正文即 `reason` 的文案），无需自己写 UTS 插件请求；修改后必须重新「运行到鸿蒙」组装安装，JS 热更新不会改变安装包权限。

**症状对照**：发行包无法建连且调试基座正常 → 先查 `uni-websocket`；从未弹授权框且按住说话立刻「录音失败」→ 查麦克风声明；点「拍摄」无反应或黑屏 → 查相机声明（iOS 还会因 `privacyDescription` 缺失报 `config error`）。如果弹窗曾出现但被用户拒绝，应引导到系统设置开启，与漏声明是两种处理路径。

## 5. pages.json：easycom、页面、导航

### 5.1 页面组件必须加 easycom 规则

页面级组件在 `components/pages/`，默认 easycom 扫不到；原子组件（`em-avatar`、`em-icon` 等）零配置：

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

漏了这条的典型报错：`Failed to resolve component: em-conversation-page`，或页面渲染成空标签。

### 5.2 页面声明与原生导航

`em-chat-page` / `em-chat-info-page` 自带导航栏（含安全区、小程序胶囊避让）。宿主页面必须关原生导航，否则双标题栏：

```json
{
  "path": "pages/chat/chat",
  "style": {
    "navigationStyle": "custom",
    "app-plus": { "titleNView": false }
  }
}
```

`navigationStyle: "custom"` 对 uni-app x 蒸汽端生效；`app-plus.titleNView` 只对经典 App 端生效，保留是为了兼容。

### 5.3 推荐页面结构

```json
{
  "pages": [
    { "path": "pages/login/login", "style": { "navigationStyle": "custom" } },
    { "path": "pages/conversation/conversation", "style": { "navigationStyle": "custom" } }
  ],
  "subPackages": [
    {
      "root": "sub-im",
      "independent": false,
      "pages": [
        { "path": "pages/chat/chat", "style": { "navigationStyle": "custom", "app-plus": { "titleNView": false } } },
        { "path": "pages/chat-info/chat-info", "style": { "navigationStyle": "custom", "app-plus": { "titleNView": false } } }
      ]
    }
  ]
}
```

把聊天页/详情页放普通分包可以减小主包；**不要开独立分包**（`independent: true` 的独立分包拿不到主包组件/模块，SDK 分包更必须为 `false`）。页面分包与小程序 SDK 分包（`sub-sdk`）是两件独立的事。

**路径约定**：本文代码里的 `/sub-im/pages/...` 是 demo 路由，宿主按自己 `pages.json` 的实际路径替换；`@/uni_modules/easemob-uikit-uni/libs` 保持不变。

### 5.4 页面高度链（白屏头号原因）

页面根节点必须撑满，且父级 flex 链完整：

```css
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
```

聊天页内部消息区是 `flex: 1 + height: 0` 的 `scroll-view`；根节点没高度会被内容压成 0，表现为白屏或输入栏消失。

## 6. App.uvue：初始化

`initTheme()` 早于首屏；`EmKit.init()` 是**同步**的，内部异步加载 SDK / 注册 Manager。业务调用（`login`/`syncConversations`）会自动经过 `whenReady()` 就绪门。

```vue
<!-- App.uvue -->
<script setup lang="uts">
import { onLaunch } from '@dcloudio/uni-app'
import { EmKit, initTheme } from '@/uni_modules/easemob-uikit-uni/libs'

onLaunch(() => {
  initTheme({
    tabBarPages: ['pages/conversation/conversation', 'pages/contact/contact']
  })

  EmKit.init({
    appkey: 'YOUR_APPKEY',
    // Token 约 80% 生命周期触发；返回新 token，UIKit 自动 renewToken
    onTokenWillExpire: async () => {
      const res = await uni.request({
        url: 'https://your-api.example.com/im/token',
        method: 'POST'
      })
      return (res.data as Record<string, string>)['token']
    },
    // SDK 已因 token 过期断开：引导重新登录；UIKit 同时把状态置 CLOSED
    onTokenExpired: () => {
      uni.reLaunch({ url: '/pages/login/login' })
    }
  })
})
</script>
```

### init 时机：appkey 固定 vs 运行时可知

- **appkey 编译期固定**（绝大多数宿主）：按上面在 `App.uvue` 的 `onLaunch` 里调一次，填入真实 appkey。
- **appkey 运行时才知道**（用户在登录页输入 / 环境配置下发）：把 `EmKit.init()` 延后到**首次登录提交时、`EmKit.login()` 之前**调用，仍保证每个进程只生效一次；`logout()` 后直接重新 `login()`，不要再次 `init()`。官方 demo 即此写法。

### 生命周期硬规则

- `EmKit.init()` **每个应用进程只生效一次**，appkey 初始化后固定。
- `logout()` 之后直接重新 `login()`，**不要再次 `init()`**。
- 切换 appkey（多租户/多环境）只能重启应用进程；SDK 没有 `ChatClient.destroy()`，UIKit 也不提供 `destroy()`。
- 小程序首次 `init` 失败（如 appkey 非法、分包未就绪）后会清缓存，修正配置可重新 `init()`。
- 需要「加载消息服务…」占位态时 `await EmKit.whenReady()`；不要靠延时猜。

### 连接状态怎么判断

`EmKit.state.status` 取值：`idle / connecting / reconnecting / online / closed`。

**判断未登录只看 `EmKit.state.userId === ''`**。不要用 `status !== 'online'`：断网重连时状态会短暂离开 `online`，用 status 判断会把用户误踢回登录页。

## 7. 登录 / 登出

服务端签发 token 后：

```ts
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'

async function login(userId: string, token: string): Promise<void> {
  await EmKit.login({ userId, token })
  uni.reLaunch({ url: '/pages/conversation/conversation' })
}
```

登录页典型写法（带 loading 与服务端换 token）：

```ts
import { ref } from 'vue'

const loading = ref(false)

async function onSubmit(): Promise<void> {
  if (loading.value) return
  loading.value = true
  try {
    const res = await uni.request({
      url: 'https://your-api.example.com/im/token',
      method: 'POST',
      data: { /* 宿主登录态，如 code / session */ }
    })
    const data = res.data as Record<string, string>
    await EmKit.login({ userId: data['userId'], token: data['token'] })
    uni.reLaunch({ url: '/pages/conversation/conversation' })
  } catch (e) {
    console.error('[im] login failed', e)
    uni.showToast({ title: '登录失败，请重试', icon: 'none' })
  } finally {
    loading.value = false
  }
}
```

登出：

```ts
await EmKit.logout()   // 内部清会话/消息/联系人/草稿/邀请，换账号不串数据
uni.reLaunch({ url: '/pages/login/login' })
```

安全底线：AppKey 可以在前端；**AppSecret、管理员密码、长期 token 不得进客户端或仓库**。token 只持有当前会话所需值，不要明文写 `uni.setStorage`。

## 8. 最小页面骨架与路由

会话页：

```vue
<template>
  <view class="page" :class="themeClass">
    <em-conversation-page @select="onSelect" @menu="onMenu" />
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { EmKit, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'
import type { ConversationTypeValue } from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass } = useTheme()

onShow(() => {
  if (EmKit.state.userId === '') {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  EmKit.syncConversations().catch(() => {})
})

function onSelect(conversationId: string, chatType: ConversationTypeValue): void {
  EmKit.enterConversation(conversationId, chatType).catch(() => {})
  EmKit.loadHistory(conversationId, chatType).catch(() => {})
  uni.navigateTo({ url: `/sub-im/pages/chat/chat?conversationId=${conversationId}&chatType=${chatType}` })
}

function onMenu(key: string): void {
  // new-chat / pin / mute / delete 由页面组件内置；
  // create-group 需要宿主跳群列表页（见 em-host-contacts-groups）
}
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';
.page { display: flex; flex-direction: column; height: 100%; background-color: var(--em-conversation-list-bg); }
</style>
```

聊天页：

```vue
<template>
  <view class="page" :class="themeClass">
    <em-chat-page
      v-if="conversationId !== ''"
      :conversation-id="conversationId"
      :chat-type="chatType"
      @open-info="onOpenInfo"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { CONVERSATION_TYPE, EmKit, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'
import type { ConversationTypeValue } from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass } = useTheme()
const conversationId = ref('')
const chatType = ref<ConversationTypeValue>(CONVERSATION_TYPE.SINGLE_CHAT)

onLoad((query) => {
  if (EmKit.state.userId === '') {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  conversationId.value = (query?.['conversationId'] ?? '') as string
  chatType.value = query?.['chatType'] === CONVERSATION_TYPE.GROUP_CHAT
    ? CONVERSATION_TYPE.GROUP_CHAT
    : CONVERSATION_TYPE.SINGLE_CHAT
})

function onOpenInfo(id: string): void {
  uni.navigateTo({ url: `/sub-im/pages/chat-info/chat-info?conversationId=${id}&chatType=${chatType.value}` })
}
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';
.page { display: flex; flex-direction: column; height: 100%; background-color: var(--em-chat-bg); }
</style>
```

**参数语义**：单聊 `conversationId` = 对端 userId；群聊 `conversationId` = groupId。`chatType` 必传，传错会导致单聊走群逻辑（或反之）。

业务页直进聊天（不需要会话列表）时同样是这套：`EmKit.login` 后直接 `navigateTo` 到含 `em-chat-page` 的页面，详见 `em-host-business-extension`。

## 9. 最小验收

- [ ] `em-conversation-page` 能渲染，历史会话能拉到
- [ ] 点击会话进入聊天页，单聊/群聊 `chatType` 正确
- [ ] 发文本，对端收到；对端回复，本端实时显示
- [ ] 返回会话列表，未读清零；杀进程重进仍为 0
- [ ] token 过期能续期或跳登录，不被误踢
- [ ] 目标端各跑一次（H5 构建 + 静态伺服 200；小程序开发者工具；App 真机）

## 10. 症状 → 加载哪个技能

| 症状 | 优先技能 |
|---|---|
| 白屏 / 输入栏不见 / 双导航栏 | `em-host-conversation-chat` |
| 会话列表空 / 未读不消 / 返回不刷新 | `em-host-conversation-chat` |
| 好友列表空 / 群邀请不显示 / 建群后进不去 | `em-host-contacts-groups` |
| 要做卡片、banner、输入栏业务入口 | `em-host-business-extension` |
| AI 流式回复不增长 / markdown 不渲染 | `em-host-ai-stream` |
| 深色模式不生效 / 英文没切 / 品牌色不生效 | `em-host-theme-i18n` |
| 小程序 `module 'sub-sdk/im-sdk.js' is not defined` | `em-host-mp-subpackage` |
| 登录弹回、发送失败、收不到消息、其他报错 | `em-host-troubleshooting` |

## 11. EmKit 公开 API 地图（按需查）

| 域 | 方法 |
|---|---|
| 生命周期 | `init` / `whenReady` / `login` / `logout` / `renewToken` / `setLocale` / `getLocale` |
| 会话 | `syncConversations` / `enterConversation` / `loadHistory` / `clearConversationUnread` / `pinConversation` / `setConversationMuted` / `deleteConversation` / `clearConversationMessages` / `addConversation` |
| 消息 | `sendText` / `sendCustom` / `sendImage` / `sendAudio` / `sendVideo` / `sendFile` / `recallMessage` / `deleteMessage` / `deleteLocalMessage` / `resendMessage` / `sendTyping` / `makeQuote` / `onMessage` / `onStreamMessage` |
| 本地提示 | `insertLocalNotice` / `insertGroupNotice` |
| 联系人 | `syncContacts` / `addContact` / `deleteContact` / `setContactRemark` / `acceptContactInvite` / `declineContactInvite` |
| 群 | `getJoinedGroups` / `enterGroup` / `getGroupInfo` / `getGroupMemberList` / `getGroupAnnouncement` / `createGroup` / `inviteUsersToGroup` / `acceptGroupInvite` / `declineGroupInvite` / `leaveGroup` / `destroyGroup` / `changeGroupOwner` / `updateGroupInfo` / `updateGroupAnnouncement` / `removeGroupMembers` / `addGroupAdmin` / `removeGroupAdmin` / `muteAllGroupMembers` / `unmuteAllGroupMembers` |
| 状态/数据 | `state`（连接）/ `conversations` / `messages` / `users` / `contacts` / `groups`；`conversationUnreadCount` / `contactRequestUnreadCount` / `conversationUnreadCountOf` |
| 主题/i18n | `initTheme` / `useTheme` / `setTheme` / `syncNativeThemeUI` / `useLocale` / `setLocale` / `mergeMessages` |
| 配置/日志 | `useConfig` / `setConfig` / `exportLogs` / `getLogText` / `clearLogs` |

所有导出都在 `@/uni_modules/easemob-uikit-uni/libs` 一个入口；组件内不要直接 import `libs/` 内部文件。

## 12. 禁止事项

1. 不要在宿主页面里 `import 'easemob-websdk'`——小程序会把 SDK 打进主包；其余端 UIKit 已收口。
2. 不要每个页面调 `EmKit.init()`；不要登出后重新 init。
3. 不要用 `status !== 'online'` 判断未登录。
4. 不要把 `em-chat-page` 包在固定高度/`overflow: hidden` 的容器里而不给 flex 链。
5. 不要给页面组件加 `scoped` 后试图覆盖其内部类名；需要改视觉走 props、插槽、CSS token。
6. 不要把真实 appkey/token/凭据提交进仓库或写进示例。
7. 不要复制 demo 的「测试 token 获取」入口进生产。

## 细分技能

- `em-host-conversation-chat`：会话列表 / 聊天页 / 聊天详情完整契约
- `em-host-contacts-groups`：通讯录 / 好友申请 / 群组 / 群管理
- `em-host-business-extension`：业务直进会话与自定义卡片
- `em-host-ai-stream`：AI 流式消息
- `em-host-theme-i18n`：主题 / 语言 / 品牌 / 配置 / 日志
- `em-host-mp-subpackage`：微信小程序 SDK 分包
- `em-host-troubleshooting`：症状排查与平台边界
