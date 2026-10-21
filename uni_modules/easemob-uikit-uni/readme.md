# easemob-uikit-uni

环信 IM 的 uni-app x 版 UIKit（蒸汽模式），一套代码覆盖 Android / iOS / 鸿蒙 / H5 / 微信小程序。

> 当前版本：**1.0.0-rc.1**。已包含登录接入、会话列表、聊天页（文本/图片/语音/视频/文件 + 引用/撤回/重发/已读回执 + AI 流式消息）、群聊、联系人/好友申请、聊天详情、连接状态条与日志导出；语言偏好持久化（中/英）。逻辑层在 `libs/`，组件层在 `components/`。
>
> 完整接入步骤、常见问题与平台边界见仓库 `docs/QUICKSTART.md`；本文给出最短可运行路径。
> 用 AI 接入时，可直接加载仓库 `skills/` 下的宿主接入 Agent Skills（入口 `em-host-integration`）。

## 兼容性

| 项 | 要求 |
|---|---|
| HBuilderX | 5.21+（蒸汽模式；推荐 5.26+） |
| uni-app x | HBuilderX 4.71+ |
| Vue | Vue 3 组合式 API（不支持 Vue2） |
| 环信 SDK | `easemob-websdk` **5.1.3**（peer 依赖，需宿主安装） |
| App | Android 6+ / iOS 15+ / 鸿蒙 API20+ |
| 小程序 | 微信小程序（SDK 需按下方「分包」接入） |
| H5 | 现代浏览器移动端；未做桌面宽屏布局 |

## 快速开始（宿主工程）

### 1. 安装依赖

```bash
npm install easemob-websdk@5.1.3
```

把 `uni_modules/easemob-uikit-uni/` 放入宿主工程（插件市场导入或直接拷贝）。

### 2. pages.json：页面组件 easycom

页面级组件位于 `components/pages/`，不在默认 easycom 扫描规则内，需要补一条 custom 规则：

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

聊天页/详情页使用自绘导航栏，页面 style 必须关闭原生导航：

```json
{
  "path": "pages/chat/chat",
  "style": {
    "navigationStyle": "custom",
    "app-plus": { "titleNView": false }
  }
}
```

### 3. App.uvue：初始化主题与 EmKit

```vue
<script setup lang="uts">
import { onLaunch } from '@dcloudio/uni-app'
import { EmKit, initTheme } from '@/uni_modules/easemob-uikit-uni/libs'

onLaunch(() => {
  initTheme()
  EmKit.init({
    appkey: 'your-appkey',
    // 可选：Token 约 80% 生命周期时回调，返回新 token 后 UIKit 自动续期
    onTokenWillExpire: async () => {
      const res = await uni.request({ url: 'https://your-api/im/token' })
      return (res.data as Record<string, string>).token
    },
    onTokenExpired: () => {
      uni.reLaunch({ url: '/pages/login/login' })
    }
  })
})
</script>
```

> `EmKit.init()` 每个应用进程只生效一次，`appkey` 固定；`logout()` 后直接重新 `login()`，切换 appkey 需重启应用进程。

### 4. 登录页

```ts
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'

// token 必须由宿主服务端签发；不要在前端硬编码 appkey/token
await EmKit.login({ userId: 'user-id', token: 'access-token' })
uni.reLaunch({ url: '/pages/conversation/conversation' })
```

### 5. 会话页与聊天页

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

onLoad(() => { EmKit.syncConversations().catch(() => {}) })
onShow(() => { EmKit.syncConversations().catch(() => {}) })

function onSelect(conversationId: string, chatType: ConversationTypeValue) {
  uni.navigateTo({ url: `/pages/chat/chat?conversationId=${conversationId}&chatType=${chatType}` })
}
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';

.page {
  display: flex;
  flex-direction: column;
  height: 100%;
}
</style>
```

```vue
<template>
  <em-chat-page
    :conversation-id="conversationId"
    :chat-type="chatType"
    @open-info="onOpenInfo"
  />
</template>
```

> **关键**：页面根节点必须有确定高度（`height: 100%` 且父级 flex 链完整），否则列表/输入栏会被压成 0 高，表现为白屏。

### 6. 微信小程序 SDK 分包

小程序主包 2MB 限制下，websdk 不能静态进主包。UIKit 已内置跨分包异步加载入口，宿主只需：

1. 用 `scripts/prepare-sdk-subpackage.mjs` 把 SDK IIFE 处理为 `sub-sdk/im-sdk.js`；
2. `pages.json` 声明 `sub-sdk` 分包与 `preloadRule`；
3. 无需改业务代码，`EmKit.init()` / `login()` 会自动等待 SDK 就绪。

完整步骤、体积阈值与排错见仓库 `docs/GUIDE-WEAPP-SDK-SUBPACKAGE.md`。

## 平台能力（1.0）

不支持的端已直接隐藏入口（能力源 `libs/platform.ts` 的 `PLATFORM_CAPABILITIES`），不会出现「点一下只弹暂不支持」：

| 能力 | H5 | 微信小程序 | App（Android/iOS/鸿蒙） |
|---|---|---|---|
| 视频消息：发送 | ✅ | ✅ | ✅ |
| 视频消息：播放 | ✅ 新窗口 | ⏳ 仅展示封面/时长 | ⏳ 仅展示封面/时长 |
| 文件消息：发送 | ✅ | ✅ | ✅ 需注册附件能力 |
| 文件消息：打开/下载 | ⏳ 仅展示 | ⏳ 仅展示 | ⏳ 仅展示 |
| 语音消息：发送 | ⏳ 入口隐藏 | ✅ | ✅ |

## App 端文件发送（宿主注入）

App 端没有跨端内置的系统文件选择器。UIKit 不静态依赖任何 UTS 插件；宿主安装文件选择器插件后，用 `EmKit.setAttachmentProvider()` 注册 `pick`（返回已复制到本地的附件路径）即可，输入栏「文件」格自动出现，发送成功后的临时文件清理由 UIKit 负责。

```ts
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'

EmKit.setAttachmentProvider({
  pick: async (ctx) => {
    // 调起宿主文件选择器（如 easemob-file-picker 的 chooseFile → prepareFile），
    // 返回 { path, name, size, mimeType, temporary: true, release(path) }[]
    return []
  }
})
```

完整契约、清理时机与 `resolve(uri)` 用法见仓库 `docs/API-KIT.md`；demo 工程的 `common/attachment-provider.uts` 是一份可直接照抄的适配器。

## 已知限制（1.0）

- 视频播放仅 H5；App/小程序隐藏播放入口。
- 文件打开/下载全端未接入，文件气泡为纯展示。
- App 端发送文件需宿主注册附件能力（见上节）；未注册时「文件」入口保持隐藏。
- H5 为移动端布局，未做桌面宽屏适配。
- 语音发送仅 App/小程序；录音 60s 上限自动发送，麦克风权限失败只 toast（不自动跳系统设置）。
- `@` 提及为追加式插入（uni `<input>` 无光标位置 API）；消息列表仍为 `scroll-view` 全量渲染（长会话性能优化在 1.1）。
- 非当前会话只保留最近 100 条内存消息，回会话时重拉最新页；完整本地历史需宿主自行持久化。
- 日志原始 payload 默认关闭（`logPayload`），生产排查请临时开启并及时关闭。

## 更多文档

- 仓库根 `README.md`：能力全景、未读/tabBar、Token 续期、多场景扩展、AI 流式消息、深色模式
- 仓库 `skills/`：宿主接入 Agent Skills（总纲/会话聊天/通讯录群组/业务卡片/AI 流式/主题 i18n/小程序分包/排错）
- `docs/QUICKSTART.md`：从空工程到收发消息的完整步骤与排错
- `docs/GUIDE-MULTI-SCENARIO.md`：客服/医疗/招聘/交易等业务直进会话
- `docs/GUIDE-WEAPP-SDK-SUBPACKAGE.md`：小程序 SDK 分包接入
- `docs/HARMONY-REALDEVICE-RUN.md`：鸿蒙真机与签名

## License

MIT，见 `license.md` 或仓库根 `LICENSE`。
