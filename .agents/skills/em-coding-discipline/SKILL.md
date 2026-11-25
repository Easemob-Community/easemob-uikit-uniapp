---
name: em-coding-discipline
description: Use when writing or reviewing ANY code in easemob-uikit-uni（新组件、改样式、动 store、加事件、加枚举、写平台分支、提交前自查）。环信 uni UIKit 编码纪律全集：纯 ts、ucss 子集、样式隔离、状态管理命名、事件命名、em-text 用法、条件编译、主题/i18n/枚举收口。
---

# em-coding-discipline — 编码纪律全集

> 违返任何一条在蒸汽端/小程序真机几乎必踩坑。与「跨端实测坑集」（skill `em-crossend-pitfalls`）互补：本文是**规则**，坑集是**症状→根因档案**。

## 语言与文件

- `<script setup lang="ts">` 纯 TS。**禁 uts 方言**：`UTSJSONObject`、`UniElement`、`.uts` 文件不进组件公共面（`UniElement` 相关隔离在 `#ifdef APP` 与 `platform.ts` 内）。
- 组件一律 `.vue`；`.uvue` 仅作双文件逃生舱。蒸汽工程结构约定见 skill `uniapp-x-vapor-structure`。
- **libs 内禁 for-of / for-in**：App/鸿蒙编译会把降级辅助函数（`__values` 等）提升到共享 chunk，曾把 `__values` 放进 `em-chat-page`，形成 `libs/store/conversation → 页面组件 → libs/index → libs/store/conversation` 的 ESM 循环，鸿蒙首屏抛 `conversationStore is not initialized` 白屏。循环改 `forEach` 或索引 `for`；组件脚本也一并不用 for-of（避免 helper 落点漂移再串环）。详见 skill `em-crossend-pitfalls` §5c。

## 样式（ucss 子集）

- **flex-only、class 选择器、无继承、无 scoped、无伪元素、文字样式只在 `<text>` 上**。SCSS 编译期能力可用，产物必须落在子集内。
- BEM 命名（`em-button--primary__text`），由 `useNamespace`（ns.b()/ns.e()/ns.m()）生成，不手写类名串。
- 组件样式独立为同目录同名 `.css`，`.vue` 的 style 块仅留一行 `@import './em-xxx.css'`。目录与 easycom 规则见 skill `em-component-structure`。
- **样式隔离**：`defineOptions({ styleIsolation: 'app-and-page' })`，不写 scoped。
- **overflow 默认值坑**：uni-app x 的 view 默认 `overflow: hidden`——绝对定位负偏移探出的子元素会被根节点裁剪（实测：em-avatar 徽标被切成平顶）。需要探出时根节点显式 `overflow: visible`；圆形裁切交给子元素自身 border-radius。**裁剪沿祖先链逐层生效**：组件根放行了，紧贴的宿主包裹层（如恰好等高的 flex 行）仍会二次裁掉探出部分（2026-10-22 style-lab 原子组件页实测：em-avatar 根已放行，外层 flex 行把徽标顶边切平）——探出路径上的每一层包裹都要显式放行。

## 条件编译

二维矩阵：模式（`UNI-APP-X`）× 平台（`APP`/`MP-WEIXIN`/`WEB`）。平台差异一律收口 `libs/platform.ts` / `libs/use/*` 的条件编译分支，**不落组件模板**。微信小程序开放能力用 `#ifdef MP-WEIXIN` 叠原生 `<button>`。

## 状态管理

- 裸 `reactive` store，**零运行时依赖**（不装 pinia/dayjs/lodash）。引入新运行时依赖前先改 PLAN.md 1.4。
- **状态回写必须落在 store 的响应式代理上**：原始对象 push 进 reactive 数组后直接改原始对象不触发蒸汽端细粒度绑定（VDOM 端被整树重渲染掩盖），真机卡状态——先 `getMessages().find(...)` 取回代理再改。
- **字段命名约定**：按 key 分组的 Record 一律 `<值语义>By<Key语义>`（`infoByUserId`/`draftByConversationId`/`messagesByConversationId`/`cursorByConversationId`/`peerReadTimeByConversationId`）；数组快照一律 `items`（`conversationStore.items`/`contactStore.items`）；禁止裸 `map`/`data`/`list` 命名（局部临时 Record 同样）。

## 自定义事件命名

**禁止与原生事件同名**（`longpress`/`click`/`tap` 等）：小程序里原生事件会穿组件边界冒泡，父组件 `@longpress` 会被原生事件对象二次触发并覆盖自定义 emit 的载荷（实测坑：长按消息菜单拿到 `type='longpress'` 原生事件）。子组件透传长按用 `long-press`。

## 文本溢出（em-text 收口）

可能溢出的用户内容文本一律走 `em-text` 原子组件（`lines` 折叠 + 省略号 + virtualHost），不再手写 lines/ellipsis：

- 布局 class（flex/min-width）落**组件宿主标签**；**文字样式必须双通道**——`text-class`（H5/App）+ `text-style` 内联（小程序）同时给：小程序样式隔离下 `app-and-page` 编译为 apply-shared，父组件 wxss 够不到 em-text 内部 text（实测：摘要字号全失效落默认 16px），内联 style 不受隔离限制且 var() 可穿透。
- **单行折叠档（line1）必须带 `white-space: nowrap`**：mp-weixin 的 wxss 不认 uvue 独占的 `lines` 属性，缺 nowrap 时 text 自由换行被父容器固定行高拦腰裁切，视觉像两行重叠。
- 宿主标签必须补 `min-width: 0` 等约束，否则 flex 约束链断裂横向溢出。
- **`<text>` 内禁止用 `v-if`/`v-else`/`v-for` 增删子 text**：鸿蒙蒸汽端移除子 text 后父 text 字形整块丢失（气泡空白但高度保留，流式光标终态即踩中）。条件展示改「常驻子 text + 内容切换」，或把分支移到 text 外用 view 承载（见坑集 §5d）。
- **局部例外：`em-action-sheet` 动作项不用 `em-text`**。鸿蒙在动作行的 auto/flex 文本上启用 `text-overflow: ellipsis` 会误吃短文案末字，动作项统一用原生 `<text>` 渲染 `action.text + ' '`，并保留 `min-width: 0`、`flex-shrink: 1`、`overflow: hidden`、`white-space: nowrap`、图标不收缩及整行左右 16px 内边距；不要重新加 `lines` 或改回 `em-text`。标题等其他文本仍按上方规则收口（见坑集 §5w）。

## 枚举与字面量

统一走 `libs/constants/`（const 对象 + 类型别名），业务代码禁硬编码字面量。**唯一例外**：SDK wire 协议字段（5.x `image`/`voice` vs 4.x `img`/`audio` 双兼容、PushManager remindType 等）保留字面量，集中在 `libs/chat` 的 `toMessageItem`/`summaryOf` 边界。

## 主题 / i18n / 图标

- 主题：`--em-*` CSS 变量双层 class（`.em-theme-light`/`.em-theme-dark`），App 端主题类挂组件根节点；`useTheme().setTheme('auto'|'light'|'dark')`（默认 auto 跟随系统，偏好持久化 `emkit.themeMode`）。新增页面需 `initTheme()`（App onLaunch 或页面 setup 兜底）+ 根节点绑 `themeClass`；原生导航栏/tabBar 用 `syncNativeThemeUI()` 同步（H5 无对应 API，由宿主 CSS/DOM 接管）。
- i18n：中/英，文案无硬编码；宿主注入用 `mergeMessages(locale, table)`（门面透出）。
- 图标：一律 `em-icon` 字体图标，**禁 svg/png**（策略见 skill `em-icon-strategy`）。

## 内置组件选型

只用蒸汽/VDOM 两边共有的内置组件；x 独占组件（page-container/list-view 新特性）必须包进内部适配组件：`EmMessageList`（list-view/scroll-view）、`EmPopup`（自研 overlay + view，**不用** page-container）。

## 平台适配层

存储（`uni.setStorage`）、网络状态、媒体选择/录音/播放等全部收口 `libs/platform.ts`，平台差异不落组件。录音仅小程序+App（H5 抛错降级）、chooseFile 仅小程序+H5（App 空实现待补）等现状以 `platform.ts` 实现为准。

## 提交前自查清单（新组件/新代码必过）

1. 纯 ts？uts 方言隔离在允许位置？
2. ucss 子集（flex-only / class / 无 scoped / 无伪元素 / 文字样式在 text 上）？
3. 组件样式在同目录 `.css`，style 块仅 `@import` 一行？
4. 溢出文本走 em-text 且双通道（text-class + text-style）？单行档带 nowrap？
5. 事件名避开原生同名（long-press 形态）？
6. 枚举/字面量收口 constants？store 命名遵守 `By<Key>`/`items` 约定？
7. 条件编译显式（`#ifdef` 平台/模式标注）？平台差异在 platform.ts/use 层？
8. 无 for-of / for-in（libs 内硬禁，组件脚本建议不用）？App 产物 `libs/` 下无 `from "../../components/` 反向 import？
9. 构建门禁：`scripts/uni.sh build web` + `build mp-weixin` 全绿 + H5 伺服 200（用法见 skill `hbuilderx-cli-compile`）；小程序主包 ≤1.5MB（防回归脚本自动断言）。
