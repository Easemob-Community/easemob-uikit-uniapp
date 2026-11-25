<!-- Generated from skills/em-host-theme-i18n/SKILL.md by scripts/sync-skills-docs.mjs. Do not edit directly. -->

# 主题 / i18n / 品牌与配置

> 基线：UIKit `1.0.4`。主题与语言偏好都存设备本地，**不随登出清理**。

## 1. 主题：三档偏好 + 解析后的明暗

```ts
import { initTheme, THEME_MODE, useTheme, syncNativeThemeUI } from '@/uni_modules/easemob-uikit-uni/libs'
```

| 概念 | 取值 | 说明 |
|---|---|---|
| `preference` | `auto / light / dark` | 用户偏好，默认 `auto`，持久化 `emkit.themeMode` |
| `mode` | `light / dark` | 解析后的实际主题，`themeClass` / `isDark` 用它 |
| `themeClass` | `em-theme-light` / `em-theme-dark` | 必须绑到**页面根节点** |

### 1.1 初始化（App.uvue，onLaunch）

```ts
onLaunch(() => {
  initTheme({
    tabBarPages: ['pages/conversation/conversation', 'pages/contact/contact', 'pages/mine/mine']
  })
})
```

- `initTheme` 幂等；重复调用只合并 `tabBarPages` / `mode`。
- `auto`：App 跟随 `osTheme`，H5 跟随 `prefers-color-scheme`，微信小程序跟随 `hostTheme`。
- 系统主题变化由 UIKit 订阅并实时回写，宿主不用自己监听。

### 1.2 页面接线

```vue
<template>
  <view class="page" :class="themeClass">
    <em-chat-page :conversation-id="id" :chat-type="chatType" />
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { syncNativeThemeUI, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass } = useTheme()

onShow(() => {
  syncNativeThemeUI()   // 原生导航栏 / tabBar 不随页面 class 变化，必须走 API
})
</script>
```

- App 端没有 `:root`，主题 class **必须挂页面根节点**；组件内部根节点也会绑，但页面背景 token 需要宿主根节点。
- `syncNativeThemeUI()` 在 `onShow` 调；主题切换后也要再调一次。
- `tabBarPages` 命中当前页才会同步 tabBar，避免非 tab 页调用平台 API 报错。

### 1.3 切换

```ts
import { setTheme } from '@/uni_modules/easemob-uikit-uni/libs'

setTheme(THEME_MODE.DARK)   // 强制深色
setTheme(THEME_MODE.AUTO)   // 恢复跟随系统
```

`useTheme()` 还提供 `themeStore`（`preference/mode/systemMode/locale`）、`isDark`、`getTheme`。

### 1.4 首帧不闪（宿主工程三件套）

照抄 `demo/` 的做法：

1. `pages.json` 的 `globalStyle` / tabBar 用 `@变量`（如 `@navBgColor`），变量定义在工程根 `theme.json` 的 `light`/`dark`；
2. `manifest.json` 开 `mp-weixin.darkmode: true`、`web.darkmode: true`，App 设 `app.defaultAppTheme: "auto"`；
3. H5 用 `index.html` 的 `html[data-em-theme]` 规则给 uni 内置导航栏/tabBar 兜底（H5 没有 `setNavigationBarColor` / `setTabBarStyle`）。

### 1.5 H5 限制

- H5 运行时没有 `setNavigationBarColor` / `setTabBarStyle`；`syncNativeThemeUI` 会跳过。
- 宿主需自己处理 `.uni-page-head` / `.uni-tabbar` 的颜色（可参考 `demo/common/theme.ts` 的 `syncH5Chrome`），或改用自绘导航。
- 深色下原生 tabBar 选中色等细节，以宿主设计为准。

## 2. 品牌色与设计 token

### 2.1 品牌色

```ts
EmKit.init({
  appkey: 'YOUR_APPKEY',
  primaryColor: '#009EFF'
})
```

- 写入 `--em-primary-color`，影响发送按钮、选中态、链接等。
- 必须是合法 CSS 颜色值；不传用默认 `#33B1FF`。
- 运行时 `setConfig({ primaryColor })` 会更新 UIKit 组件根节点的内联变量，但 H5 `document` 根变量、宿主自绘卡片与原生 chrome 不会自动跟随；推荐在 `init` 时定好，运行时切换需自行同步这些位置。

### 2.2 token

所有视觉 token 在：

```css
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';
```

宿主页面/卡片**优先消费** `--em-*`，不要抄死组件内部色值：

| token | 用途 |
|---|---|
| `--em-primary-color` / `--em-primary-hover` | 品牌主色 |
| `--em-text-primary/secondary/tertiary/inverse` | 文本层级 |
| `--em-bg-base/secondary/tertiary/elevated/hover/active` | 背景层级 |
| `--em-border-color` / `--em-border-light` | 边框 |
| `--em-chat-bg` / `--em-conversation-list-bg` | 聊天/会话页背景 |

完整清单见 `libs/style/variables.css`（light/dark 两套）。

### 2.3 覆盖边界

- 可以：`primaryColor`、子树根节点内联 `:style` 覆盖 token（App 端 class 方式覆盖变量会被主题类顶掉，必须内联）、组件的 `custom-class` / `custom-style`（全组件根节点透出，custom-style 内联五端可靠）、宿主自己的卡片样式。
- 不要：改 `uni_modules/easemob-uikit-uni/libs/style/*.css` 源码（升级被覆盖）；用 `!important` 硬压组件内部类名（跨端不稳定）；App 端用同名 class 覆盖组件已设置的属性（单类选择器无特异性可言，拼声明顺序不可靠——覆盖走 custom-style，追加才用 custom-class）。

## 3. 语言（i18n）

### 3.1 初始化与切换

```ts
import { EmKit, getLocale, setLocale, mergeMessages, useLocale } from '@/uni_modules/easemob-uikit-uni/libs'

EmKit.init({ appkey: 'YOUR_APPKEY', locale: 'en' })  // 初始化时指定并持久化
setLocale('zh-CN')                                   // 运行时切换（立即生效 + 持久化）
getLocale()                                          // 'zh-CN' | 'en'
```

- 默认：先读本地偏好 `emkit.locale`，没有则跟随系统（英文环境 `en`，其余 `zh-CN`）。
- 模块加载时自动 `initLocale()`；宿主不需要手动调。
- `setLocale(locale, false)` 可临时切换不持久化。

### 3.2 宿主组件用文案

```ts
const { t } = useLocale()

t('chat.placeholder')
t('chat.mentionAll')                      // 支持 {name} 插值
```

- 缺 key 先回落 `zh-CN`，再回落 key 本身。
- UIKit 内置文案走同一张表；宿主自己的业务文案请用宿主 i18n，不要往 UIKit 表里塞业务 key。
- 注入/覆盖文案：

```ts
mergeMessages('en', { 'chat.placeholder': 'Type a message…' })
```

- 内置 locale 只有 `zh-CN` / `en`，类型即 `EmLocaleName`；要新增语言需先扩展 UIKit，不建议在宿主硬塞。
- 覆盖文案只影响 UIKit 内置 key；业务文案请留在宿主自己的 i18n 表。
- 跨语言收发消息时，业务 ext 存 code，不要存已翻译句子。

## 4. 行为配置（`EmKit.init`）

| 配置 | 默认 | 说明 |
|---|---|---|
| `enableReadReceipt` | `true` | 单聊已读回执 |
| `enableDraft` | `true` | 输入栏草稿 |
| `enableTyping` | `true` | typing 信令（发送节流 + 接收展示） |
| `recallTimeLimit` | `120000` | 撤回窗口 ms |
| `typingThrottle` | `5000` | typing 发送节流 ms |
| `typingTimeout` | `5000` | typing 展示超时 ms |
| `timeDividerInterval` | `300000` | 聊天页时间分隔条间隔 ms |
| `enableStreamMessage` | `true` | AI 流式分片合并 |
| `streamThrottle` | `50` | 流式合批 ms |
| `inputFeatures` | 工具全开、`inputMode` 未设置、`sendOnReturn=true` | `voice/emoji/image/camera/video/file` 工具子集；`inputMode('single'|'multiline')` 显式单/多行，优先于旧 `sendOnReturn` |
| `messageMenuKeys` | 八项全量 | `copy/quote/edit/pin/download/recall/resend/delete` 及顺序；`download` 仅对已发送的图片/视频/文件出现 |
| `conversationMenuKeys` | 三项全量 | `pin/mute/delete` 及顺序 |
| `emojiList` | 内置 96 | emoji 面板字符集 |
| `primaryColor` | `''` | 品牌色 |
| `locale` | 系统/持久化 | `zh-CN` / `en` |
| `logLevel` | `info` | `debug/info/warn/error/silent` |
| `logPayload` | `false` | 是否记录 SDK 原始 payload |
| `sdkConsoleLog` | `true` | SDK 自身 console 输出 |
| `sdkLogLevel` | `WARN` | SDK 侧日志级别 |

示例：只要文本和图片，去掉语音/视频/文件：

```ts
EmKit.init({
  appkey: 'YOUR_APPKEY',
  inputFeatures: { voice: false, video: false, file: false }
})
```

只保留「复制/引用/删除」，去掉撤回：

```ts
import { MESSAGE_MENU_KEY } from '@/uni_modules/easemob-uikit-uni/libs'

EmKit.init({
  appkey: 'YOUR_APPKEY',
  messageMenuKeys: [MESSAGE_MENU_KEY.COPY, MESSAGE_MENU_KEY.QUOTE, MESSAGE_MENU_KEY.DELETE]
})
```

### 运行时配置

```ts
import { setConfig } from '@/uni_modules/easemob-uikit-uni/libs'

setConfig({ enableDraft: false, inputFeatures: { voice: false } })
```

- `setConfig` 只覆盖 UI 行为配置（`EmUiConfig`）；`locale`、`logLevel`、`enableReadReceipt` 等初始化项不支持运行时改。
- `inputFeatures` 是**合并**，只传要改的键。
- `uiConfig` 是响应式的，多数 UI 开关会即时生效；涉及已打开页面布局的改动，建议重进页面验证一次。

## 5. 日志与隐私

```ts
EmKit.init({
  appkey: 'YOUR_APPKEY',
  logLevel: 'debug',     // 排查时临时打开
  logPayload: true       // 会记录 userId/昵称等，生产勿开
})

const path = await EmKit.exportLogs()   // H5 下载；小程序/App 写文件路径，失败兜底剪贴板
EmKit.getLogText()                      // 内存环形缓冲（2000 行）
EmKit.clearLogs()
```

- 默认 `logPayload: false`，好友/群同步原始 payload 不落日志。
- 开启后日志可能含 userId、昵称、群名；导出前脱敏，排查完立即关闭。
- 生产包不要把「导出日志」入口暴露给终端用户。
- 控制台 SDK 日志太多时：`sdkConsoleLog: false`、`sdkLogLevel: 'ERROR'`。

## 6. 验收清单

- [ ] 系统切深色/浅色，页面与原生导航栏同步变化
- [ ] 手选 `light/dark` 后杀进程重进仍保持；`auto` 能恢复跟随
- [ ] 切英文后组件文案立即变，重进仍英文
- [ ] 品牌色生效（发送按钮、选中态）
- [ ] 关掉的输入栏功能入口确实消失；关掉的菜单项不出现
- [ ] 生产包 `logPayload` 为 false，无凭据进日志

## 7. 常见坑

| 现象 | 根因 | 修复 |
|---|---|---|
| 深色下页面仍是白底 | 根节点没绑 `themeClass` | `:class="themeClass"` |
| 组件变深色但原生导航栏没变 | 没调 `syncNativeThemeUI` | 页面 `onShow` 调用 |
| H5 导航栏不变 | H5 无平台 API | 宿主 CSS 接管（见 1.5） |
| 首帧闪白 | 没配 `theme.json` / `@变量` / `darkmode` | 照抄 demo 三件套 |
| 品牌色不生效 | 传了非法颜色或页面没引入 variables.css | 用合法值并在页面 import token |
| 英文只变了一部分 | 宿主业务文案没走自己的 i18n | UIKit 只负责组件内置文案 |
| 改 `setConfig` 后语言没变 | locale 不是 `EmUiConfig` | 用 `setLocale` |
| 日志里出现昵称/群名 | `logPayload: true` | 排查完关闭并脱敏 |
