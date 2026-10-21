# 主题与国际化

UIKit 内置明暗主题与中英文文案。页面级组件根节点已经绑定主题 class，宿主通常只需要初始化一次、把 `themeClass` 绑到自己的页面根节点，并在设置页调用 `setTheme()`。

## 1. 主题模型

| 概念 | 说明 |
|---|---|
| 偏好 `preference` | `auto`（默认，跟随系统）/ `light` / `dark` |
| 生效主题 `mode` | `light` 或 `dark`，由偏好与系统主题解析得到 |
| 主题 class | `em-theme-light` / `em-theme-dark`，绑定在页面根节点 |
| 持久化 key | `emkit.themeMode`（设备级，登出不清理） |

所有颜色、字号、间距通过 `--em-*` 变量提供，明暗两套值在 `libs/style/variables.css` 中定义。详见 [设计变量](./DESIGN-TOKENS.md)。

## 2. 初始化

在 `App.uvue` 的 `onLaunch` 调用一次：

```ts
import { initTheme } from '@/uni_modules/easemob-uikit-uni/libs'

onLaunch(() => {
  initTheme({
    // 可选：声明 tabBar 页面，主题切换时只在 tab 页同步原生 tabBar
    tabBarPages: ['pages/conversation/conversation', 'pages/contact/contact', 'pages/mine/mine']
  })
})
```

`initTheme()` 是幂等的，重复调用只会合并配置。它会：

1. 读取持久化偏好；没有则 `auto`；
2. 读取系统主题（App 用 `osTheme`，H5 用 `prefers-color-scheme`，微信小程序用 `hostTheme`）；
3. 订阅系统主题变化；
4. 计算生效主题并写入 `themeStore`；
5. App 端调用 `uni.setAppTheme`，让原生弹窗等系统 UI 跟随。

## 3. 在页面中使用

```vue
<template>
  <view class="page" :class="themeClass">
    <em-conversation-page />
  </view>
</template>

<script setup lang="ts">
import { useTheme } from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass, isDark, setTheme } = useTheme()
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';

.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--em-bg-base);
}
</style>
```

`useTheme()` 返回：

| 成员 | 类型 | 说明 |
|---|---|---|
| `themeClass` | `ComputedRef<string>` | `em-theme-light` / `em-theme-dark` |
| `isDark` | `ComputedRef<boolean>` | 当前是否深色 |
| `themeStore` | `reactive` | `preference` / `mode` / `systemMode` / `locale` |
| `setTheme(mode)` | `(mode: 'auto' \| 'light' \| 'dark') => void` | 设置偏好并持久化 |
| `getTheme()` | `() => 'light' \| 'dark'` | 读取生效主题 |

### 页面根节点必须绑定 `themeClass`

App 端没有 `:root`，变量只能从页面根节点向下传递。如果根节点没有 `themeClass`，暗色模式下组件会继续使用浅色变量。

### 切换主题

```ts
const { setTheme } = useTheme()

setTheme('auto')  // 跟随系统
setTheme('light') // 强制浅色
setTheme('dark')  // 强制深色
```

切换后页面根节点的 class 立即变化，组件颜色随变量更新。原生导航栏、tabBar 不会自动跟随，需要在页面 `onShow` 或主题变化时调用 `syncNativeThemeUI()`：

```ts
import { onShow } from '@dcloudio/uni-app'
import { syncNativeThemeUI } from '@/uni_modules/easemob-uikit-uni/libs'

onShow(() => {
  syncNativeThemeUI()
})
```

`syncNativeThemeUI(options?)`：

| 选项 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `navigationBar` | `boolean` | `true` | 同步原生导航栏前景/背景色 |
| `tabBar` | `boolean` | `false` | 强制同步 tabBar；默认只在当前页命中 `initTheme({ tabBarPages })` 时同步 |

H5 没有原生导航栏 API，会自动跳过；H5 的页面 chrome 由宿主 CSS 处理。

### 首帧原生 chrome

小程序/App 的原生导航栏与 tabBar 颜色来自 `pages.json`。为了避免深色偏好用户首帧看到白条，可以：

- 在 `pages.json` 的 `globalStyle` / `tabBar` 使用主题变量（`@navBgColor` 等），并提供 `theme.json` 的 light/dark 两套值；
- 微信小程序 `manifest.json` 开启 `mp-weixin.darkmode`；
- App 端 `manifest.json` 设置 `app.defaultAppTheme: "auto"`。

具体字段随宿主工程配置不同，核心是让原生 chrome 的首帧与 `themeStore.mode` 一致。

## 4. 品牌色

```ts
EmKit.init({
  appkey: 'your-appkey',
  primaryColor: '#009EFF'
})
```

或运行时：

```ts
import { setConfig } from '@/uni_modules/easemob-uikit-uni/libs'
setConfig({ primaryColor: '#FF6B00' })
```

品牌色会写到页面根节点的 `--em-primary-color`；H5 还会写到 `document.documentElement`。适合主色替换，不适合做完整换肤；如果需要大面积自定义，直接覆盖 `--em-*` 变量。

## 5. 国际化

### 初始化与切换

```ts
import { initLocale, setLocale, getLocale } from '@/uni_modules/easemob-uikit-uni/libs'

initLocale()          // 读取持久化偏好，否则跟随系统语言
setLocale('en')       // 立即切换并持久化
setLocale('zh-CN', false) // 临时切换，不写持久化
getLocale()           // 'zh-CN' | 'en'
```

- 持久化 key：`emkit.locale`。
- 未设置时跟随系统语言：英文环境用 `en`，其余回落 `zh-CN`。
- 模块加载时会自动恢复一次偏好，因此未显式调用 `initLocale()` 也能工作。

### 在组件/页面中取文案

```ts
import { useLocale } from '@/uni_modules/easemob-uikit-uni/libs'

const { t, setLocale } = useLocale()
const title = t('chat.title')
const count = t('chat.memberCount', { count: 12 })
```

- `t(key, params?)` 支持 `{name}` 插值。
- 缺 key 时先回落 `zh-CN`，再回落 key 本身。
- 组件内部所有文案都走 `t()`，没有硬编码中文。

### 覆盖或新增文案

```ts
import { mergeMessages } from '@/uni_modules/easemob-uikit-uni/libs'

mergeMessages('zh-CN', {
  'chat.title': '在线咨询',
  'conversation.title': '消息'
})
```

`mergeMessages(locale, table)` 是浅合并：同 key 覆盖，新 key 追加。适合品牌化文案，不建议修改结构性 key。

### 组件内响应语言切换

`useLocale()` 的 `t` 读取的是响应式文案 store，页面组件会在语言切换后重新渲染。宿主自己的页面如果缓存了 `t()` 结果到非响应式变量，需要自行 watch `themeStore.locale`。

## 6. 常见问题

| 现象 | 原因 | 处理 |
|---|---|---|
| 暗色下只有部分区域变黑 | 页面根节点没绑 `themeClass`，或宿主写了固定颜色 | 根节点绑定 `themeClass`，颜色改用 `--em-*` |
| 切主题后原生导航栏还是白的 | 原生 chrome 不随页面 class 变化 | 在 `onShow`/切换后调用 `syncNativeThemeUI()` |
| 首帧闪白 | `pages.json`/`theme.json` 没配深色首帧 | 配置原生主题变量与 `darkmode` |
| 语言切换后文案没变 | 页面缓存了字符串 | 用 `useLocale()` 的 `t()` 在模板/computed 中取 |
| 英文环境仍是中文 | 系统语言不是 `en` 开头，或持久化了 `zh-CN` | 调 `setLocale('en')` 或清除 `emkit.locale` |
