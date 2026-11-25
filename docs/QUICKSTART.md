# Quick Start：从空工程到收发消息

> [!INFO]
> 适用版本：**1.0.6**。目标读者是已有一个 uni-app x（Vue3、蒸汽模式）工程的宿主开发者。

> [!WARNING]
> **支持范围**：本插件仅支持 **uni-app x 蒸汽模式（Vapor）**；经典 uni-app（Vue2/Vue3）与 vdom 模式不在支持范围。DCloud 官方已于 2024 年停止 nvue 与 5+ 维护，并将于 2027 年初停止 uni-app App 平台与 uni-app x vdom 平台维护（见 [DCloud 官方文档 · FAQ「老 uni-app 还维护吗？」](https://doc.dcloud.net.cn/uni-app-x/)）；蒸汽模式已兼容 js/ts 写法，老工程可直接升级。差异见 [平台能力与差异](./PLATFORM.md)。

> [!NOTE]
> **端差异**：能力矩阵按 Android、iOS、鸿蒙、H5 与微信小程序的环境要求整理，同一能力在不同机型、系统版本与厂商 ROM 上的表现可能不同，也不排除存在尚未记录的差异。已知差异、当前状态与处理方式见 [设备与端差异](./PLATFORM-DEVICES.md)；遇到文档未覆盖的情况，按该页「反馈需要的信息」提交。

> 本文只覆盖「最小可用链路」。完整页面契约见 [页面指南](./PAGES-CONVERSATION.md)，组件与 API 见 [组件参考](./COMPONENTS.md)、[EmKit API](./API-KIT.md)，业务扩展见 [多场景接入](./GUIDE-MULTI-SCENARIO.md) 与 [AI 流式消息](./AI-STREAM.md)。

下面的完整流程适合搭建完整 IM。若你只需要一个单聊页面，`chat-only` 模板已预置工程结构、登录恢复、聊天页和微信小程序 SDK 分包，省去从完整 Demo 删减页面与重新接线的步骤。它仍是需要修改的宿主工程：appkey、服务端 token 接口、对端资料和会话存储都要按你的业务配置，并非独立 SDK 或免配置服务。

| 你的目标 | 推荐入口 |
|---|---|
| 只要一个可运行的单聊天页 | 使用仓库 `templates/chat-only`（[模板源码与说明](https://github.com/Easemob-Community/easemob-uikit-uniapp/tree/main/templates/chat-only)），修改 appkey、token 接口和对端资料 |
| 搭建完整 IM | 按本文接入，页面组合与事件处理参考仓库 `demo/` |
| 让 AI 辅助接入或排错 | 安装并按场景使用 [Agent Skills](./GUIDE-AGENT-SKILLS.md) |
| 已有业务页，直进单聊 | 使用单聊天模板，或阅读 [多场景接入](./GUIDE-MULTI-SCENARIO.md) 手动集成 |

`em-chat-page` 面向整页使用；嵌入半屏、弹窗或侧栏请使用原子组件自行组合。

## 1. 前置条件

| 项 | 要求 |
|---|---|
| HBuilderX | 5.21+（推荐 5.26+） |
| uni-app x | HBuilderX 4.71+，Vue3 组合式 API |
| Node.js | 18+ |
| 环信 | 已创建环信 AppKey，并能从**业务服务端**签发用户 token |
| 端 | Android 6+ / iOS 15+ / 鸿蒙 API20+ / 现代浏览器 / 微信小程序 |

> [!CAUTION]
> **安全底线**：AppKey 可以放前端，**token 必须由业务服务端签发**；不要把 AppSecret、管理员密码、长期 token 写进代码或仓库。

## 2. 安装插件与 SDK

```bash
cd your-uniapp-x-project
npm install easemob-websdk@5.2.0
```

把 `easemob-uikit-uni/` 放进宿主工程的 `uni_modules/` 目录（插件市场导入或直接拷贝仓库中的 `uni_modules/easemob-uikit-uni`）。

> `easemob-websdk` 是 peer 依赖，版本精确锁定 `5.2.0`；升级前先看 UIKit 的 changelog 与对应版本发布说明。

### HBuilderX 5.34：SDK 编译异常

HBuilderX 5.34 引入 `easemob-websdk` 后，构建可能报 `Identifier "h" has already been declared`。DCloud 已在 [issue #34492](https://issues.dcloud.net.cn/pages/issues/detail?id=34492) 中确认该问题，并回复将由 HBuilderX 后续修复。当前可在宿主工程根目录新增 `vite.config.ts`，忽略 uni 插件对 `h` 的自动导入：

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

若已有 `vite.config.ts`，把 `autoImportOptions` 合并到现有 `uni()` 配置中，不要覆盖其他插件配置。该配置不需要修改或重新打包 `node_modules`；保存后重新编译即可。

## 3. pages.json：easycom 与页面样式

### 3.1 页面组件 easycom

页面级组件在 `components/pages/`，默认 easycom 不会扫描到，需要加一条 custom 规则：

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

原子组件（`em-avatar`、`em-text` 等）走插件内置 easycom，零配置。

### 3.1.1 只声明你要用的页面

UIKit 不会预置页面清单：`pages.json` 里声明了哪些页面，就只有哪些页面参与编译。只做会话列表就不要声明聊天页，产物里也不会出现聊天页的组件。

各页面带进来的组件数量、以及哪些东西无法通过配置裁掉，见 [按需接入与包体积](./GUIDE-ON-DEMAND.md)。

### 3.2 聊天页 / 详情页关闭原生导航

这两个页面自带 `em-nav-bar`（含安全区、小程序胶囊避让）。若保留原生导航会出现双标题栏：

```json
{
  "path": "pages/chat/chat",
  "style": {
    "navigationStyle": "custom",
    "disableScroll": true,
    "app-plus": { "titleNView": false }
  }
}
```

`app-plus.titleNView` 只对经典 App 端生效；uni-app x 蒸汽端以 `navigationStyle: "custom"` 为准。

### 3.3 关闭页面整体回弹

UIKit 整页组件由内部的 `scroll-view` 承担滚动。会话、聊天、通讯录等宿主页面的 `style` 中应设置 `"disableScroll": true`，禁止页面容器在顶部或底部继续整体拖动：

```json
{
  "style": {
    "navigationStyle": "custom",
    "disableScroll": true
  }
}
```

鸿蒙深色页面如果没有关闭该行为，上下回弹时可能露出默认白色窗口底色。`disableScroll` 只禁止宿主页面整体滚动，不影响会话、消息等内部列表。该配置需要逐页设置，写在 `globalStyle` 中无效；需要使用页面级下拉刷新的宿主页面不要开启。

### 3.4 页面高度

**这是最常见的白屏原因**。会话页、聊天页的根节点必须撑满页面，且父级 flex 链完整：

```css
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
```

聊天页内部的消息区是 `flex: 1` + `height: 0` 的 `scroll-view`；根节点不设高度时会被内容压成 0，表现为「页面白屏 / 输入栏消失」。

## 4. 初始化：App.uvue

`initTheme()` 要早于首屏；`EmKit.init()` 是同步的，内部会异步加载 SDK / 注册 Manager。业务调用（`login` / `syncConversations`）会自动走 `whenReady()` 就绪门。

```vue
<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { EmKit, initTheme } from '@/uni_modules/easemob-uikit-uni/libs'

onLaunch(() => {
  initTheme()

  EmKit.init({
    appkey: 'your-appkey',
    // Token 约 80% 生命周期时触发；返回新 token，UIKit 自动 client.renewToken(token)
    onTokenWillExpire: async () => {
      // 用宿主自己的登录态（Cookie / Bearer / 自定义 header）换 IM token
      const res = await uni.request({
        url: 'https://your-api.example.com/im/token',
        method: 'POST'
      })
      return (res.data as Record<string, string>).token
    },
    // SDK 已因 token 过期断开：这里跳登录；UIKit 同时把连接状态置 CLOSED
    onTokenExpired: () => {
      uni.reLaunch({ url: '/pages/login/login' })
    }
  })
})
</script>
```

补充：

- `EmKit.init()` 每个应用进程只生效一次，`appkey` 固定；`logout()` 后直接重新 `login()`，不要再次 `init()`。切换 appkey 需重启应用进程。
- 自定义小程序 SDK 加载（自管分包/预下载）用 `sdkLoader` 或 `sdkModule`，默认不需要传。
- 需要展示「加载消息服务…」占位态时，`await EmKit.whenReady()`。
- `EmKit.state.status` 可能为 `idle / connecting / reconnecting / online / closed`；**不要用 `status !== online` 判断未登录**，断网重连时 `status` 会短暂离开 `online`，应判断 `EmKit.state.userId === ''`。

## 5. 登录与 token

登录页从宿主服务端拿到 userId + token 后：

```ts
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'

async function login(userId: string, token: string) {
  try {
    await EmKit.login({ userId, token })
    uni.reLaunch({ url: '/pages/conversation/conversation' })
  } catch (e) {
    uni.showToast({ title: '登录失败，请重试', icon: 'none' })
    console.error(e)
  }
}
```

退出：

```ts
await EmKit.logout()
uni.reLaunch({ url: '/pages/login/login' })
```

- token 由服务端签发；前端只持有当前会话所需 token。
- 生产环境不要把 token 明文写入 `uni.setStorage`；使用平台安全存储或每次启动重新换取。
- token 过期不要只靠「发送失败」兜底：实现 `onTokenWillExpire` / `onTokenExpired`（见上一节）。

语言与日志（可选）：

```ts
import { setLocale } from '@/uni_modules/easemob-uikit-uni/libs'

setLocale('en') // 立即切换并持久化；默认跟随系统/上次选择
// 也可在第 4 节的 EmKit.init 配置里加：locale: 'en'、logPayload: false
```

调试同步/资料问题时再临时开 `logLevel: 'debug', logPayload: true`，排查完关闭。

## 6. 会话列表页

```vue
<template>
  <view class="page" :class="themeClass">
    <em-conversation-page @select="onSelect" />
  </view>
</template>

<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { EmKit, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'
import type { ConversationTypeValue } from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass } = useTheme()

function ensureLogin(): boolean {
  if (EmKit.state.userId === '') {
    uni.reLaunch({ url: '/pages/login/login' })
    return false
  }
  return true
}

onLoad(() => {
  // 页面组件默认 autoSync=true，首次挂载会自拉快照；这里只需做登录守卫。
  // 若宿主想自己控制时机，传 :auto-sync="false" 后在此手动 syncConversations。
  ensureLogin()
})

// 从聊天页/二级页返回时补同步；tabBar 角标也在这里补
onShow(() => {
  if (ensureLogin()) EmKit.syncConversations().catch(() => {})
})

function onSelect(conversationId: string, chatType: ConversationTypeValue) {
  uni.navigateTo({
    url: `/pages/chat/chat?conversationId=${conversationId}&chatType=${chatType}`
  })
}
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';

.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--em-conversation-list-bg);
}
</style>
```

`em-conversation-page` 默认 `autoSync=true`，首次挂载自动拉取；从聊天页返回后的刷新仍建议在 `onShow` 调 `EmKit.syncConversations()`。若宿主想完全自管时机，传 `:auto-sync="false"`。联系人页登录后由 SDK 自动同步，页面读取 store 即可。

## 7. 聊天页

```vue
<template>
  <view class="page" :class="themeClass">
    <em-chat-page
      v-if="conversationId !== ''"
      :conversation-id="conversationId"
      :chat-type="chatType"
      @open-info="onOpenInfo"
      @back="onBack"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { EmKit, CONVERSATION_TYPE, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'
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

function onOpenInfo(id: string) {
  uni.navigateTo({ url: `/pages/chat-info/chat-info?conversationId=${id}&chatType=${chatType.value}` })
}

function onBack() {
  // 默认 autoBack=true，组件已自行 navigateBack；这里可做埋点/未保存拦截。
  // 需要接管退场时传 :auto-back="false"，只监听 @back。
}
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';

.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--em-chat-bg);
}
</style>
```

聊天页会自行处理：进入会话、拉历史、滚底、未读清零、已读回执、草稿、键盘避让、引用/撤回/重发。

### 引用协议（跨 UIKit 互通）

1.0 起引用消息同时写入：

- `ext.msgQuote`：与 vue 版同 key、同结构（`msgID / msgPreview / msgSender / msgType / msgThumbUrl?`）；
- `ext.emQuote`：0.x uni 版兼容字段。

接收侧优先解析 `msgQuote`，旧消息回落 `emQuote`。业务 ext 不要占用这两个 key；发送时 UIKit 会覆盖。

## 8. 五端运行

### 8.1 H5

```bash
scripts/uni.sh build web
cd demo/unpackage/dist/build/web
python3 -m http.server 5180
```

H5 的 `history` 路由需要服务端 fallback 到 `index.html`；本地静态伺服直接用构建产物。

### 8.2 微信小程序

新工程建议复制 `templates/chat-only`，模板已同时配置 `sub-im` 页面分包和 `sub-sdk` SDK 分包。安装依赖并填写 `common/im-config.ts` 后，在模板根目录执行：

```bash
npm run dev:mp      # HBX dev + 分包 watch
npm run build:mp    # HBX build + SDK 后处理 + 完整检查
npm run check:mp    # 单独复查 build 产物
```

使用 HBuilderX GUI 开发时，保持 `npm run watch:mp` 运行，再从 HBX 运行到微信开发者工具。开发产物在 `unpackage/dist/dev/mp-weixin`，构建产物在 `unpackage/dist/build/mp-weixin`。

完整 IM 页面组合参考 `demo/`。既有工程需要手工声明实际页面路由，再复用统一脚本；配置、脚本复制和报错诊断见 [微信小程序分包接入](./GUIDE-WEAPP-SDK-SUBPACKAGE.md)。

### 8.3 App（Android / iOS / 鸿蒙）

用 HBuilderX 打开 `demo/` 或宿主工程，运行到真机。鸿蒙签名步骤见 [HARMONY-REALDEVICE-RUN.md](./HARMONY-REALDEVICE-RUN.md)。

#### 必要：WebSocket 模块

Android 与 iOS 都要在 `manifest.json` 显式声明 `uni-websocket`。环信 SDK 通过运行时适配对象调用 `connectSocket`，uni-app x 的静态摇树可能识别不到；缺失时调试基座可能正常，发行包却无法建立 IM 长连接：

```json
{
  "app-android": {
    "distribute": {
      "modules": {
        "uni-websocket": {}
      }
    }
  },
  "app-ios": {
    "distribute": {
      "modules": {
        "uni-websocket": {}
      }
    }
  }
}
```

`uni-network`、`uni-getNetworkType`、`uni-fileSystemManager`、`uni-media` 等直接调用的模块通常能被自动扫描，不需要复制一份全量模块清单。若自行封装原生插件或增加动态 `uni.xxx` 调用，应检查生成包是否包含对应模块。

#### 必要：系统版本与权限

- UIKit 基础环境为 Android 6+ / iOS 15+；使用 `easemob-file-picker` 时，插件把最低版本提高到 **Android 7（API 24）/ iOS 16**。此时在 `app-android.distribute` 设置 `"minSdkVersion": 24`，iOS 以插件的 `deploymentTarget` 为准。
- Android 的相机、麦克风、相册能力由对应 uni 模块引入。不要重复添加过宽的存储权限；若自行裁剪模块或权限，需在最终合并后的 `AndroidManifest.xml` 中确认 `CAMERA`、`RECORD_AUDIO` 和实际使用的相册能力仍然存在。
- iOS 在 `app-ios.distribute.privacyDescription` 声明 `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` / `NSMicrophoneUsageDescription`；保存图片或视频到相册时还要声明 `NSPhotoLibraryAddUsageDescription`。用途文案应与实际行为一致，例如相机写“拍摄图片或视频并发送”，不要误写成相册。
- 鸿蒙权限写在工程根目录的 `harmony-configs/entry/src/main/module.json5` 的 `requestPermissions`：语音与拍摄分别需要 `ohos.permission.MICROPHONE`、`ohos.permission.CAMERA`，都带 `reason` 与 `usedScene.inuse`。该目录被**整份覆盖**而非按节点合并，文件必须包含完整的 `module` 结构；相册和文件选择走系统 Picker，无需额外存储权限。

上述原生模块、权限和隐私配置变更后，必须重新打自定义基座或发行包，JS 热更新不会补入这些原生能力。

#### 推荐：发行配置

| 配置 | 建议 |
|---|---|
| `app-android.distribute.targetSdkVersion` | 按发行渠道与当前 HBuilderX 支持情况显式设置，并回归对应 Android 版本行为；不要只照抄固定数值。Google Play 等渠道应以其最新 target API 要求为准 |
| `app-android.distribute.abiFilters` | 64 位真机发行可明确为 `["arm64-v8a"]`；只有实际需要时才增加 32 位或 x86/x86_64，避免无谓增大包体 |
| `defaultAppTheme` | 需要跟随系统深浅色时，在 `app-android` / `app-ios` 设置为 `"auto"`；微信小程序另开 `mp-weixin.darkmode`，H5 另开 `web.darkmode` |
| Web 路由 | 简单静态托管可在 `web.router` 使用 `"mode": "hash"`；使用 `history` 时由服务端配置回退到 `index.html` |
| 网络安全 | 优先使用 HTTPS/WSS。宿主其他网络能力若必须使用 HTTP/WS，Android 9+ 还需在原生 `AndroidManifest.xml` 的 `application` 节点配置 `android:usesCleartextTraffic="true"`；不要为了省事默认全局放开 |

视频消息依赖内置模块 `uni-video`。它通常会被直接组件引用自动扫描；如果旧自定义基座缺少该模块，`<video>` 会降级为普通 `<view>`，表现为播放器全屏黑屏。重新打基座即可；需要提前固定模块时，可在 `app-ios` / `app-android` → `distribute.modules` 显式声明 `"uni-video": {}`。

## 9. 排错与验收

| 症状 | 优先检查 |
|---|---|
| 页面白屏 / 输入栏不见 | 根节点 `height: 100%`、父级 flex 链、`scroll-view` 是否 `flex:1;height:0` |
| 双导航栏 | 聊天页/详情页是否 `navigationStyle: "custom"` |
| 会话列表空 | 是否已登录（`state.userId`）；`autoSync` 是否被关闭、`onShow` 是否补调 `EmKit.syncConversations()` |
| 好友列表空 | SDK 同步未完成（等待 `onSyncDataFinished`）；H5 清缓存后重试 |
| 小程序 `sub-sdk/im-sdk.js` 未定义 | 跑分包 prepare 脚本；检查 `pages.json` 分包与预下载 |
| App 点视频进播放器但全屏黑 | 当前自定义基座是否包含 `uni-video` 模块（接入视频后需重打基座；manifest 可显式声明） |
| 登录后立刻被踢回登录页 | 是否用 `status !== online` 判断；断网重连不应视为未登录 |
| 发送一直失败 | token 是否过期；实现 `onTokenWillExpire`；查看 `EmKit.state.reason/errorCode` |
| 聊天页一直骨架 / 历史加载失败 | 看网络与 `loadHistory` 日志；点空态「点击重试」或顶部重试行；确认 `conversationId/chatType` 正确 |
| 读过的会话又显示未读 | 确认使用 1.0 的未读清零逻辑；宿主自建入口用 `EmKit.clearConversationUnread()` 兜底 |
| 引用卡不显示 | 业务 ext 是否覆盖了 `msgQuote`；对端是否支持引用协议 |

### 最小验收清单

- [ ] 登录成功，会话列表能拉到历史会话
- [ ] 进入单聊，发文本，对端收到；对端回复，本端实时显示
- [ ] 发图片/语音（按平台能力），对端可播放/查看
- [ ] 引用一条消息发送，对端显示引用卡
- [ ] 撤回、失败重发、已读回执
- [ ] 返回会话列表，未读为 0；杀进程重进仍为 0
- [ ] Token 过期自动续期（或跳登录）
- [ ] 群聊：公告、@ 提及、成员昵称
- [ ] 五端各跑一遍构建 + 一次真机/开发者工具冒烟

## 下一步

- [核心概念与架构](./CONCEPTS.md)：理解分层、生命周期与数据流。
- [页面指南](./PAGES-CONVERSATION.md)：会话、聊天、聊天信息、通讯录、群组的完整契约。
- [组件参考](./COMPONENTS.md)：原子组件的 props / events / slots。
- [消息与扩展协议](./MESSAGING.md)：引用、@ 提及、自定义消息、本地提示、流式消息。
- [常见问题](./FAQ.md)：按症状排查白屏、空列表、分包、媒体能力等问题。
