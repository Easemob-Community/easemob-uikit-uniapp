# 样式定制

> [!INFO]
> 适用版本 **1.0.6**；相关定制能力自 **1.0.0** 起提供。
>
> 这页解决什么问题：不改 UIKit 源码的前提下，把组件外观调成自己的品牌与业务风格。UIKit 提供四条定制通道——`custom-style`、`custom-class`、`--em-*` 设计变量、具名插槽，本文给出选型决策、各通道用法与平台边界。

先给结论：

| 想改什么 | 用哪条通道 | 平台可靠性 |
|---|---|---|
| 品牌主色 | `EmKit.init({ primaryColor })` / `setConfig({ primaryColor })` | 五端 |
| 全局/子树的颜色、圆角、间距、字号 | 覆盖 `--em-*` 变量（见 [设计变量](./DESIGN-TOKENS.md)） | 五端 |
| 某一个组件实例的样式 | `custom-style`（内联） | 五端 |
| 某一个组件实例的样式（class 方式） | `custom-class` | H5、微信小程序（页面级样式）；App 端见下文限制 |
| 整块区域换成自己的 UI | 具名插槽（`#empty` / `#banner` / `#input-toolbar` / `#custom-message` / `#input-bar` 等） | 五端 |

## 1. custom-style：单实例覆盖（五端可靠）

所有 `em-*` 组件（页面组件与原子组件）都接受 `custom-style` 属性。它的值会**拼接到组件根节点内联样式的末尾**，因此优先级高于组件内部的一切 class 规则，也不受小程序样式隔离影响，值里可以引用 `var(--em-*)`。

```vue
<template>
  <view class="page" :class="themeClass">
    <em-empty
      icon="list-bullet"
      description="custom-style：卡片底 + 圆角 + 内边距"
      custom-style="background-color: var(--em-bg-secondary); border-radius: var(--em-radius); padding: 16px;"
    />
  </view>
</template>
```

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `custom-style` | `string` | `''` | 宿主自定义内联样式，拼接到组件根节点 `style` 末尾（五端生效，`var()` 可用） |

弹层类组件（`em-action-sheet`、`em-select-contact`、`em-mention-picker`）的 `custom-style` 落在最外层遮罩容器上；要改面板本体，用变量或插槽。

## 2. custom-class：单实例覆盖（class 方式）

所有组件同样接受 `custom-class`，值会追加到组件根节点的 class 列表：

```vue
<em-empty icon="search" description="主色描边" custom-class="my-empty" />
```

```css
.my-empty {
  border-width: 1px;
  border-style: solid;
  border-color: var(--em-primary-color);
  border-radius: var(--em-radius);
}
```

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `custom-class` | `string` | `''` | 宿主自定义类，追加到组件根节点 class（生效范围见下方平台边界） |

`custom-class` 的生效范围受各端样式机制约束：

| 平台 | 边界 |
|---|---|
| H5 | 完整 CSS，规则写在哪里都能命中，也可以用更高特异性选择器直接覆盖组件内部 class |
| 微信小程序 | 规则必须写在**页面级** wxss（或 app.wxss）里才能穿透组件样式隔离；写在**父组件** wxss 里够不到子组件内部。对 `em-icon`、`em-text` 等 virtualHost 组件，布局类请写在页面级样式中 |
| App（uni-app x） | 只支持单类选择器、无后代选择器。与组件内部同名属性的覆盖依赖声明顺序，而合并顺序不受宿主控制——**不要用 custom-class 覆盖组件已设置的同名属性**；只用它追加组件没有设置的属性（如边框、阴影、外边距），覆盖需求走 `custom-style` |

一条各端通用的经验法则：**追加新属性用 `custom-class`，覆盖旧属性用 `custom-style`，批量换肤用变量。**

## 3. `--em-*` 变量：全局与子树换肤

全部视觉值（颜色、间距、圆角、字号、气泡、列表行高等）都以 CSS 变量提供，完整清单与覆盖方法见 [设计变量](./DESIGN-TOKENS.md)。跨端可靠的子树覆盖方式是**在内层包裹节点上内联绑定变量**：

```vue
<template>
  <!-- themeClass 由页面根节点承担；内联变量挂内层包裹节点，不与 themeClass 同节点 -->
  <view class="my-brand-panel" :style="brandStyle">
    <em-button text="品牌色按钮" type="primary" />
  </view>
</template>

<script setup lang="ts">
const brandStyle = '--em-primary-color: #FF6B00;'
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';

.my-brand-panel {
  padding: var(--em-spacing-3);
  background-color: var(--em-bg-secondary);
  border-radius: var(--em-radius);
}
</style>
```

变量沿节点树向下继承，子树里的组件（含弹层之外的嵌套组件）都会跟随。App 端有两条额外限制：

1. **不要用 class 方式覆盖变量**（`.my-brand { --em-primary-color: ... }`）：覆盖规则与主题类（`.em-theme-*`）是同名单类选择器，胜负取决于各组件样式合并后的声明顺序，宿主无法控制，实测同一写法两次构建结果相反。class 方式仅 H5 与微信小程序可用。
2. **内联变量不要与 `themeClass` 同节点**：App 端同一节点上 class 规则定义的变量会顶掉内联 style 里的同名变量（内联只能赢过继承来的值）。内联变量挂到内层包裹节点即可，如上例。

要点回顾（细节都在设计变量一页）：

- 变量挂在 `.em-theme-light` / `.em-theme-dark` 上，页面根节点必须绑定 `themeClass`，漏绑时变量取不到值、对应 CSS 属性整条失效。
- 明暗两套各自全量定义，覆盖时两套一起改；App 端只支持单类选择器，按主题区分要用 `isDark` 切换第二个 class，不能写后代选择器。
- 不要改包内的 `variables.css` 本体，插件升级会覆盖；覆盖写进宿主自己的页面或样式文件。
- 改品牌色优先用 `primaryColor` 配置（见 [配置参考](./CONFIG.md)），它会以内联形式写到页面根节点的 `--em-primary-color`。

### 运行时换主题色（如拖拽取色器）

`setConfig({ primaryColor })` 运行时立即生效——页面级组件根节点的内联变量随响应式配置更新（H5 在 `EmKit.init` 时还会同步 `documentElement`）。做一个「拖动色块换全局主题色」时注意两点：

1. **派生色不自动跟随**：`--em-primary-hover`、`--em-bubble-bg-self`、`--em-bg-active` 等不由 `primaryColor` 派生。要整页协调换色，在页面根节点内联绑定这组变量一起更新。示例工程「样式实验室」的「主题定制」页（`sub-im/pages/style-lab/theming`）的色相条演示就是这套链路：拖动 → JS 算 hex 与派生色 → 更新页面根节点内联变量串（本页全子树跟随）+ `setConfig({ primaryColor })`（页面级组件跟随）。
2. **不持久化**：`setConfig` 是运行时配置，重启应用失效；需要记住用户选择时由宿主自行存储，下次 `EmKit.init` 传回 `primaryColor`。

## 4. 具名插槽：整区替换

要换掉的不只是样式而是整块结构时，用页面组件的具名插槽，插槽内容用 `--em-*` 变量即可自动跟随明暗主题：

| 插槽 | 所在组件 | 用途 |
|---|---|---|
| `#empty` | 各列表页 / 聊天页 | 空状态整体替换（默认 `em-empty`） |
| `#banner` | `em-chat-page` | 导航栏下方固定位横幅 |
| `#input-toolbar` | `em-chat-page` | 消息列表与输入栏之间的业务工具条 |
| `#input-bar` | `em-chat-page` | 输入栏整栏自绘（行为经作用域契约保持，见 [聊天页](./PAGES-CHAT.md)「整栏自绘输入栏」） |
| `#custom-message` | `em-chat-page` | 自定义消息整卡自绘（配合 `EmKit.sendCustom`） |
| `#stream-message` | `em-chat-page` | AI 流式消息富格式渲染 |

各插槽的作用域与示例见对应页面指南（如 [聊天页](./PAGES-CHAT.md)）与 [多场景接入](./GUIDE-MULTI-SCENARIO.md)。

## 5. 聊天气泡定制

气泡是最高频的定制点。己方与对方气泡的底色、文字色各自独立成变量，几何尺寸（内边距、文件卡宽度）同样是变量——绝大多数气泡定制不需要写任何 CSS 规则，覆盖变量即可：

| 想改什么 | 覆盖哪个变量 |
|---|---|
| 对方气泡底色 | `--em-bubble-bg-other` |
| 己方气泡底色 | `--em-bubble-bg-self` |
| 对方 / 己方气泡文字色 | `--em-bubble-text-other` / `--em-bubble-text-self` |
| 气泡圆角 | `--em-bubble-radius`（靠头像侧小圆角为 `--em-bubble-radius-square`） |
| 文本气泡内边距 | `--em-bubble-padding-x` / `--em-bubble-padding-y` |
| 语音气泡内边距 | `--em-audio-bubble-padding-x` / `--em-audio-bubble-padding-y` |
| 文件卡内边距与宽度 | `--em-file-card-padding-x` / `--em-file-card-padding-y`、`--em-file-card-min-width` / `--em-file-card-max-width` |
| 气泡间距 | `--em-bubble-gap`（同发送者相邻气泡）、`--em-message-gap`（消息行） |

五种消息气泡（文本/图片/语音/视频/文件）共用同一套底色与文字色变量，一次覆盖全部生效；变量值见 [设计变量](./DESIGN-TOKENS.md)，明暗两套主题各自定义，覆盖时两套一起改。

### 只改某一个聊天页

`em-chat-page` 的 `custom-style` 拼接在组件根节点内联样式的末尾，而变量沿节点树向下继承——把变量串经 `custom-style` 传入，只影响该聊天页实例，不污染其他页面：

```vue
<em-chat-page
  conversation-id="user-b"
  :chat-type="CHAT_TYPE.SINGLE"
  custom-style="--em-bubble-bg-other: #FFF7E8; --em-bubble-bg-self: #FF6B00; --em-bubble-padding-y: 14px;"
/>
```

这是改气泡样式在五端都可靠的最短路径；全局换肤则把同样的变量串绑在页面根节点上（机制见第 3 节）。

### 边界

- 图片、视频气泡无底色（媒体内容即气泡），可调的是圆角与尺寸；文件卡圆角用 `--em-file-card-radius`。
- 要换掉气泡的整块结构（不只是样式）：自定义消息用 `#custom-message` 插槽整卡自绘，AI 流式富格式用 `#stream-message`（见 [聊天页](./PAGES-CHAT.md)）；标准消息类型没有整卡插槽。
- 气泡加描边/阴影、己方与对方用不同字号这类「非对称个性」没有对应变量：H5 可用高特异性选择器覆盖组件 class；App 端受单类选择器限制（第 2 节），同名属性覆盖不可靠，建议在变量能力范围内调整，或经插槽自绘。

## 6. 文字样式的特殊性

- App 端样式无继承：文字样式必须落在 `<text>` 节点上。组件内可能溢出的用户文本都收口在 `em-text`，它提供 `text-class`（H5/App）与 `text-style`（内联，微信小程序可穿透）双通道，宿主自己拼列表行时直接复用（见 [基础组件](./COMPONENTS-BASIC.md) 的 `em-text` 一节）。
- 组件内部文字的颜色与字号大多有对应变量（`--em-text-*`、`--em-font-size-*`），改文字优先改变量；要改某个实例的文字，用 `custom-style` 控制容器，或换插槽自绘。

## 7. 完整示例

```vue
<template>
  <view class="page" :class="themeClass">
    <!-- 单实例：custom-style 五端可靠 -->
    <em-nav-bar
      title="客服"
      custom-style="background-color: var(--em-bg-secondary);"
      @back="onBack"
    />

    <!-- 子树换肤：内联变量挂内层包裹节点（不与 themeClass 同节点） -->
    <view class="ticket-panel" :style="ticketBrandStyle">
      <em-button text="发送订单卡片" type="primary" block @click="sendTicket" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { useTheme } from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass } = useTheme()
const ticketBrandStyle = '--em-primary-color: #FF6B00;'

function onBack(): void {
  uni.navigateBack()
}

function sendTicket(): void {
  // 见「多场景接入」的 sendCustom 示例
}
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';

.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--em-bg-base);
}

.ticket-panel {
  margin: var(--em-spacing-4);
  padding: var(--em-spacing-3);
  background-color: var(--em-bg-secondary);
  border-radius: var(--em-radius);
}
</style>
```

示例工程的「样式实验室」→「覆盖机制」页（`sub-im/pages/style-lab/overrides`，见 [示例工程](./DEMO.md)）内置了 `custom-style`、`custom-class` 与变量覆盖三组对照演示，可在各端直接查看效果。

## 8. 注意事项

1. **不要改包内文件。** `variables.css` 与组件 `.css` 会在插件升级时被覆盖；所有定制写在宿主自己的代码里。
2. **不需要 `!important`。** 组件样式全是扁平单类选择器且不含 `!important`；`custom-style` 走内联天然最高优先级，变量覆盖靠声明顺序即可。
3. **明暗两套一起验证。** 覆盖颜色类变量或写死色值时，切到深色模式再检查一遍。
4. **App 端的 class 覆盖限制**见第 2 节表格；变量覆盖的两条 App 限制（不用 class 方式、内联不与 themeClass 同节点）见第 3 节。跨端工程把 `custom-style` 与内联变量作为覆盖的默认选择，`custom-class` 只用于追加组件未设置的属性。
