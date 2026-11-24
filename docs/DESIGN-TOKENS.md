# 设计变量（`--em-*`）

> [!INFO]
> 适用版本 **1.0.3**。
>
> 这页解决什么问题：UIKit 的全部视觉值（颜色、间距、圆角、字号、气泡、文件图标底色等）都以 CSS 自定义属性形式提供，宿主可以按品牌与业务需要覆盖它们，而不必改组件源码。本文列出变量命名规则、完整清单、覆盖方法与平台限制。

变量定义在 `uni_modules/easemob-uikit-uni/libs/style/variables.css`；主题由根节点上的 `.em-theme-light` / `.em-theme-dark` 两个 class 承载，通过 `useTheme().themeClass` 绑定。

```vue
<template>
  <view class="page" :class="themeClass">
    <em-conversation-page />
  </view>
</template>

<script setup lang="ts">
import { useTheme } from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass } = useTheme()
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';
</style>
```

相关的主题切换与暗色模式机制见 [主题与国际化](./THEME-I18N.md)，品牌色初始化参数见 [配置参考](./CONFIG.md)。

## 1. 命名规则

```
--em-<域>-<属性>[-<档位>]
```

- 前缀恒为 `--em-`；域用短横线分段，全小写（`bubble`、`file-icon`、`conversation-list`）。
- 颜色变量按「语义」命名，不按色值命名：用 `--em-text-secondary`，不要新增 `--em-gray-600`。
- 阶梯类变量用数字档位且与数值同序（`--em-spacing-1` = 4px … `--em-spacing-7` = 48px）。
- 同一语义在明暗两套里**同名**，值不同。

## 2. 主题类

| 项 | 说明 |
|---|---|
| `.em-theme-light` / `.em-theme-dark` | 主题作用域。挂在页面根节点（或需要独立主题的子树根节点） |
| `useTheme().themeClass` | `em-theme-light` / `em-theme-dark` 的计算属性，随主题切换自动更新 |
| `useTheme().setTheme('auto'\|'light'\|'dark')` | 切换偏好并持久化；`auto` 跟随系统 |
| `initTheme({ mode?, tabBarPages? })` | 初始化主题引擎（App 的 `onLaunch` 调一次；幂等） |
| `syncNativeThemeUI()` | 同步原生导航栏与 tabBar 颜色（H5 无原生导航栏，自动跳过） |

主题靠 **根节点 class** 生效而不是 `:root`（App 端没有 `:root`）。因此：

- 页面级组件（如 `em-chat-page`）会在自身根节点绑定 `themeClass`，库内组件始终有主题。
- 宿主自己写的页面外壳与业务样式要用 `--em-*`，根节点也要绑 `themeClass`（`useTheme()` 提供）；漏绑时这些变量取不到值，用到它们的 CSS 属性会整条失效。
- 原生导航栏与 tabBar 不读 class，需要用 `syncNativeThemeUI()` 同步；tabBar 颜色还要在 `initTheme({ tabBarPages: [...] })` 里声明 tabBar 路由。

## 3. 颜色变量

### 3.1 主色与功能色

| 变量 | 用途 | 亮色 | 暗色 |
|---|---|---|---|
| `--em-primary-color` | 品牌主色（选中、链接、@提及、焦点态） | `#33B1FF` | `#33B1FF` |
| `--em-primary-hover` | 主色按下 / 悬停 | `#00A1FF` | `#007ECC` |
| `--em-success-color` | 成功 | `#16A34A` | `#09C26F` |
| `--em-warning-color` | 警告 | `#FFAA19` | `#FFAB00` |
| `--em-danger-color` | 危险 / 错误 | `#FF3355` | `#FF3333` |
| `--em-info-color` | 信息提示 | `#33B1FF` | `#33B1FF` |
| `--em-mention-color` | 气泡内 @提及高亮 | `#33B1FF` | `#33B1FF` |

> `--em-primary-color` 是唯一会被 `EmKit.init({ primaryColor })` 改写的变量；其余主色派生值（hover 等）保持不变。

### 3.2 文字与图标

| 变量 | 用途 | 亮色 | 暗色 |
|---|---|---|---|
| `--em-text-primary` | 正文、标题 | `#171A1C` | `#E8EAED` |
| `--em-text-secondary` | 次要信息、副标题 | `#5E686E` | `#9AA0A6` |
| `--em-text-tertiary` | 弱化说明、时间戳 | `#919BA1` | `#737B82` |
| `--em-text-inverse` | 强调色/彩色底上的文字 | `#FFFFFF` | `#FFFFFF` |
| `--em-icon-muted` | 弱化图标、输入提示图标 | `#949A9E` | `#9AA0A6` |

### 3.3 背景阶梯

| 变量 | 用途 | 亮色 | 暗色 |
|---|---|---|---|
| `--em-bg-base` | 页面基础底 | `#FFFFFF` | `#1E2123` |
| `--em-bg-secondary` | 次级容器底（列表分组、横幅） | `#F3F4F6` | `#2A2A30` |
| `--em-bg-tertiary` | 三级容器底 | `#F0F0F0` | `#333537` |
| `--em-bg-elevated` | 浮层 / 卡片底 | `#FFFFFF` | `#1E2123` |
| `--em-bg-hover` | 按下 / 悬停底（也用于骨架屏底色） | `#F5F5F5` | `#2A2A30` |
| `--em-bg-active` | 选中底 | `rgba(51, 177, 255, 0.12)` | `#0D2840` |
| `--em-control-bg` | 控件填充（默认按钮、对方气泡、引用块） | `#F3F4F6` | `#333537` |
| `--em-switch-off-bg` | Switch 关闭态轨道 | `#E3E6E8` | `rgba(255, 255, 255, 0.12)` |

> 暗色的 `--em-bg-active` 是固定藏青值，不由主色派生；改品牌色时它不会跟着变。

### 3.4 边框与分割线

| 变量 | 用途 | 亮色 | 暗色 |
|---|---|---|---|
| `--em-border-color` | 常规边框 | `#E5E7EB` | `#3C3F42` |
| `--em-border-light` | 浅边框 | `#F3F4F6` | `#333537` |
| `--em-divider-color` | 分割线 | `rgba(0, 0, 0, 0.06)` | `#333537` |

### 3.5 气泡与消息

| 变量 | 用途 | 亮色 | 暗色 |
|---|---|---|---|
| `--em-bubble-bg-other` | 对方气泡底 | `#E4E6E7` | `#333537` |
| `--em-bubble-bg-self` | 己方气泡底（固定品牌蓝） | `#009EFF` | `#33B1FF` |
| `--em-bubble-text-other` | 对方气泡文字 | `#171A1C` | `#E8EAED` |
| `--em-bubble-text-self` | 己方气泡文字 | `#FFFFFF` | `#1E2123` |
| `--em-bubble-text-self-secondary` | 己方气泡内次要文字 | `#EFEFEF` | `rgba(30, 33, 35, 0.72)` |
| `--em-message-chip-bg` | 时间分隔条、撤回提示等胶囊底 | `#E4E6E7` | `#333537` |
| `--em-quote-line-color` | 引用卡竖线 | `#C9CDCF` | `#3C3F42` |

> `--em-bubble-bg-self` 在亮色下**不跟随** `--em-primary-color`（设计上固定为品牌蓝 `#009EFF`）。需要己方气泡随品牌色变化时，同时覆盖这两个变量。

### 3.6 页面语义背景

| 变量 | 用途 | 亮色 | 暗色 |
|---|---|---|---|
| `--em-chat-bg` | 聊天页消息区底 | `#FFFFFF` | `#1E1E23` |
| `--em-input-bg` | 输入栏底 | `#FFFFFF` | `#1E2123` |
| `--em-chat-emoji-delete-bg` | 表情面板悬浮退格键的半透明背景 | `rgba(255, 255, 255, 0.72)` | `rgba(42, 42, 48, 0.78)` |
| `--em-conversation-list-bg` | 会话列表底 | `#FFFFFF` | `#1E2123` |
| `--em-input-border-color` | 输入框描边 | `#C9CDCF` | `#3C3F42` |

### 3.7 状态、徽标与遮罩

| 变量 | 用途 | 亮色 | 暗色 |
|---|---|---|---|
| `--em-empty-icon-color` | 空状态图标 | `#C9CDCF` | `#464E53` |
| `--em-empty-text-color` | 空状态文案 | `#919BA1` | `#737B82` |
| `--em-badge-bg` | 未读数 / 红点底（独立于 danger） | `#FF7070` | `#FF7070` |
| `--em-badge-text` | 未读数文字 | `#FFFFFF` | `#1E1E23` |
| `--em-mask-color` | 弹层遮罩、视频时长胶囊底 | `rgba(0, 0, 0, 0.4)` | `rgba(0, 0, 0, 0.6)` |
| `--em-skeleton-line-radius` | 骨架屏行圆角（明暗共用） | `4px` | `4px` |
| `--em-skeleton-bubble-self` | 骨架屏己方气泡浅蓝底（聊天页首屏骨架，由品牌气泡蓝派生、不跟随主色） | `rgba(0, 158, 255, 0.16)` | `rgba(51, 177, 255, 0.2)` |

## 4. 尺寸与排版变量

### 4.1 间距阶梯

| 变量 | 值 | 变量 | 值 |
|---|---|---|---|
| `--em-spacing-1` | `4px` | `--em-spacing-5` | `24px` |
| `--em-spacing-2` | `8px` | `--em-spacing-6` | `32px` |
| `--em-spacing-3` | `12px` | `--em-spacing-7` | `48px` |
| `--em-spacing-4` | `16px` | | |

### 4.2 圆角

| 变量 | 值 | 用途 |
|---|---|---|
| `--em-radius` | `8px` | 通用圆角（卡片、按钮、引用块） |
| `--em-bubble-radius` | `16px` | 气泡圆角（带尖角侧） |
| `--em-bubble-radius-square` | `8px` | 气泡靠头像侧的小圆角 |
| `--em-file-card-radius` | `12px` | 文件卡圆角 |
| `--em-input-radius` | `999px` | 单行输入框胶囊 |
| `--em-component-radius` | `6px` | 组件小圆角（多行输入区等非胶囊容器） |

### 4.3 字体、字号、字重、行高

| 变量 | 值 |
|---|---|
| `--em-font-family` | `'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', 'Source Han Sans SC', sans-serif` |
| `--em-font-size-9` … `--em-font-size-20` | `9px` / `10px` / `11px` / `12px` / `13px` / `14px` / `15px` / `16px` / `18px` / `20px` |
| `--em-font-size-28` | `28px` |
| `--em-font-weight-regular` / `medium` / `semibold` / `bold` | `400` / `500` / `600` / `700` |
| `--em-lineheight-tight` / `normal` / `relaxed` | `1.25` / `1.5` / `1.75` |

> 字号是静态 px 值，不随系统字体大小缩放。字体栈在 App 与小程序端只对已安装字体生效，实际以系统字体为准。

### 4.4 列表与消息尺寸

| 变量 | 值 | 用途 |
|---|---|---|
| `--em-cell-height` | `64px` | 会话/联系人列表行高 |
| `--em-bubble-gap` | `8px` | 同一发送者相邻气泡间距 |
| `--em-message-gap` | `16px` | 消息行间距 |
| `--em-message-padding` | `12px` | 消息区左右内边距 |
| `--em-bubble-padding-x` / `--em-bubble-padding-y` | `14px` / `12px` | 文本气泡内边距 |
| `--em-audio-bubble-padding-x` / `--em-audio-bubble-padding-y` | `14px` / `10px` | 语音气泡内边距 |
| `--em-file-card-padding-x` / `--em-file-card-padding-y` | `12px` / `10px` | 文件卡内边距 |
| `--em-file-card-min-width` / `--em-file-card-max-width` | `166px` / `240px` | 文件卡宽度上下限 |
| `--em-chat-panel-height` | `240px` | 输入栏 emoji / 媒体面板高度 |

### 4.5 文件类型图标底色

文件图标本体固定白色，底色按扩展名取：

| 变量 | 值 | 变量 | 值 |
|---|---|---|---|
| `--em-file-icon-pdf` | `#DA3034` | `--em-file-icon-md` | `#424242` |
| `--em-file-icon-xls` | `#1D7044` | `--em-file-icon-img` | `#00897B` |
| `--em-file-icon-doc` | `#2B5797` | `--em-file-icon-video` | `#E91E63` |
| `--em-file-icon-ppt` | `#D24625` | `--em-file-icon-audio` | `#7B1FA2` |
| `--em-file-icon-file` | `#4CAF50` | | |

## 5. 如何安全地覆盖

> 变量之外的三条通道（`custom-style` / `custom-class` / 具名插槽）与选型决策见 [样式定制](./GUIDE-STYLING.md)。

### 5.1 品牌主色：优先用 `primaryColor`

```ts
EmKit.init({ appkey: 'your-appkey', primaryColor: '#0F8CFF' })
```

`primaryColor` 会写入 `--em-primary-color`：页面级组件把它内联在根节点上（子树继承），H5 同时写到 `documentElement`。这是改品牌色最省事也最稳妥的路径。

需要更完整的品牌适配（例如气泡也换色）时，在页面根节点**内层**追加一个包裹节点绑定内联变量（内联变量不要与 `themeClass` 同节点：App 端同节点的 class 变量会顶掉内联变量）：

```vue
<view class="page" :class="themeClass">
  <view class="page__brand" :style="brandStyle">
    <!-- 页面内容 -->
  </view>
</view>
```

```ts
const brandStyle = '--em-primary-color: #0F8CFF; --em-primary-hover: #0A78DB; --em-bubble-bg-self: #0F8CFF;'
```

```css
.page__brand {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 0;
}
```

### 5.2 局部覆盖：写自己的 class

> [!WARNING]
> **App 端注意**：class 方式覆盖变量与主题类（`.em-theme-*`）是同名单类选择器，胜负取决于各组件样式合并后的声明顺序，App（uni-app x）端宿主无法控制该顺序，可能出现覆盖不生效。App 端请改用 5.1 的内联 `:style` 绑定变量；class 方式在 H5 与微信小程序可用。

覆盖变量不需要 `!important`，只要让自定义 class 与主题类落在同一节点（同名特异性时按声明顺序，后声明的生效）：

```vue
<template>
  <view class="page" :class="[themeClass, isDark ? 'my-brand--dark' : 'my-brand']">
    <em-conversation-page />
  </view>
</template>

<script setup lang="ts">
import { useTheme } from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass, isDark } = useTheme()
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';

.my-brand {
  --em-primary-color: #0F8CFF;
  --em-bg-secondary: #F5F8FF;
}

.my-brand--dark {
  --em-primary-color: #4FC3FF;
  --em-bg-secondary: #1B2430;
}
</style>
```

变量沿 DOM 向下继承，所以覆盖在页面根节点即对整棵子树生效。只想影响某个区域时，在该区域的根节点再挂一层 `themeClass` + 自定义 class：

```vue
<view class="biz-panel" :class="[themeClass, 'my-panel']">
  <em-file-message :message="fileMessage" />
</view>
```

```css
.my-panel {
  --em-radius: 12px;
}
```

### 5.3 三条注意事项

1. **明暗两套一起改。** 颜色变量在 `.em-theme-light` 与 `.em-theme-dark` 中各自全量定义。App 端只支持单类选择器，不能写 `.em-theme-dark .my-brand` 这类后代选择器，按主题覆盖要靠 `isDark` 切换第二个 class（见上一节）。
2. **不要改 `variables.css` 本体。** 插件市场升级会覆盖该文件；把覆盖写进宿主自己的页面或样式文件。
3. **变量缺失会整条属性失效。** 自定义属性取不到值时，使用它的 CSS 属性会被丢弃（不会回退到某个默认值），组件可能整块样式消失。新增变量名不如复用现有变量。

## 6. 暗色模式

- 默认 `auto`：App 读系统 `osTheme`，H5 读 `prefers-color-scheme`，小程序读 `hostTheme`（需在 `manifest.json` 打开 `mp-weixin.darkmode`）。
- 偏好持久化在 `emkit.themeMode`，`setTheme('light')` / `setTheme('dark')` 可强制。
- 页面根节点 class 变化后组件立即换肤；**原生导航栏与 tabBar 不跟随**，在页面 `onShow` 调 `syncNativeThemeUI()`，tabBar 颜色还要在 `initTheme({ tabBarPages: [...] })` 里声明 tabBar 路由。
- 小程序首帧闪烁由 `theme.json` + manifest 的 `darkmode` 配合解决（示例工程有现成配置）。

## 7. 平台 CSS 约束

变量能用，但消费方式受各端 CSS 子集限制：

| 约束 | 说明 |
|---|---|
| App 端没有 `:root` | 全局变量必须落在页面根节点（`themeClass` 所在节点）；不能靠 `html`/`:root` 定义 |
| 无伪元素 | `::before` / `::after` 在 App 端不可用，装饰元素要显式写节点 |
| 无 `color-mix()` | 派生色（半透明主色、混色）请直接写 `rgba()` 或明暗两套字面量 |
| 不依赖 CSS 动效 | `@keyframes` / `transition` 在 App 端不能作为状态驱动手段，动效用 JS 定时器切换 class |
| `calc()` 仅限简单四则 | 只做「一个变量 ± 常量」这类计算（如 `calc(var(--em-message-gap) - 4px)`），不要叠加复杂派生 |
| 样式无继承 | 颜色、字号不会从父节点自动继承到文字节点；文字样式要写在 `<text>` 上（`em-text` 用 `text-class` + `text-style`） |
| 小程序样式隔离 | 跨组件改文字样式必须走 `em-text` 的 `text-class`（类）与 `text-style`（内联）双通道，内联值里的 `var()` 可以穿透 |

更多端间差异（能力开关、键盘、滚动等）见 [平台能力与差异](./PLATFORM.md)，组件级样式契约见 [基础组件](./COMPONENTS-BASIC.md)。

## 8. 完整示例

宿主业务卡片复用 UIKit 变量，自动跟随明暗主题：

```vue
<!-- components/my-card/my-card.vue：宿主组件，主题由所在页面根节点提供 -->
<template>
  <view class="my-card">
    <text class="my-card__title">九成新公路车</text>
    <text class="my-card__price">¥1,280</text>
    <view class="my-card__divider"></view>
    <text class="my-card__hint">点击查看商品详情</text>
  </view>
</template>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';

.my-card {
  display: flex;
  flex-direction: column;
  padding: var(--em-spacing-3);
  border-radius: var(--em-radius);
  border-width: 1px;
  border-style: solid;
  border-color: var(--em-border-color);
  background-color: var(--em-bg-elevated);
}

.my-card__title {
  color: var(--em-text-primary);
  font-size: var(--em-font-size-14);
  font-weight: var(--em-font-weight-medium);
}

.my-card__price {
  margin-top: var(--em-spacing-1);
  color: var(--em-primary-color);
  font-size: var(--em-font-size-16);
  font-weight: var(--em-font-weight-semibold);
}

.my-card__divider {
  height: 1px;
  margin-top: var(--em-spacing-2);
  margin-bottom: var(--em-spacing-2);
  background-color: var(--em-divider-color);
}

.my-card__hint {
  color: var(--em-text-tertiary);
  font-size: var(--em-font-size-12);
}
</style>
```

配合 [多场景接入](./GUIDE-MULTI-SCENARIO.md) 的 `#custom-message` 插槽使用时，卡片外观与 UIKit 消息气泡完全一致地跟随明暗切换，无需为两套主题各写一份样式。
