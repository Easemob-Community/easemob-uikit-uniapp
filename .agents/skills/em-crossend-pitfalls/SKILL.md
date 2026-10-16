---
name: em-crossend-pitfalls
description: Use when a bug appears on 蒸汽真机/Android/iOS/鸿蒙/mp-weixin but not on H5（文本裁切、样式不生效、键盘顶飞导航栏、事件触发两次、动画不跑、监听泄漏、热更新失效、滚动不生效）。环信 uni UIKit 跨端实测坑集：症状 → 根因 → 定案解法，附蒸汽端能力边界。
---

# em-crossend-pitfalls — 跨端实测坑集（症状 → 根因档案）

> 每条都是真机实测结论。排查顺序建议：先对症状，再翻对应解法；蒸汽端（App 三端）能力边界见文末汇总。编码期预防对应规则见 skill `em-coding-discipline`。

## 蒸汽端（Android/iOS/鸿蒙 vapor）

### 1. 多行文本气泡裁切（高度 + 行尾缺字，两个独立子 bug）
- **症状 A**：长文本气泡最后一行被切一半（竖直方向）。
- **根因 A**：Android 蒸汽端 `<text>` 无单位倍数行高（`line-height: 1.5`）测量不可靠。改 px 行高（15px 字号取 23px）后高度全端正确（探针 R/W/S/Q 全组验证）。
- **症状 B**：每行行尾恰好丢 1 个汉字（水平方向）；`lines: 999`、负 margin、去 margin、去 word-break、overflow:visible、改 padding 全部无效。
- **根因 B**：**含多行 text 的宽度链里有 `max-width: N%` 时，蒸汽端对 text 的布局/绘制宽度双重解析不一致**（约差 1 字宽，行尾字被裁）；探针对照：百分比链全缺字、`max-width: 480rpx` 定宽全完整。
- **解法**：宽度链改 rpx 定宽——`.em-chat-page__content` `max-width: 70%` → `max-width: 480rpx`（≈手机屏宽 70% 减头像与页边距，平板略窄可接受）。text 层自由换行 + px 行高即可，**不需要 `lines` 属性**（`lines: 999` 是排查弯路，已回退）。诊断工具：`demo/sub-im/pages/text-probe`（两轮探针页，spike 页有入口）。
- **纪律：蒸汽端多行用户文本的容器宽度链禁用 % max-width，一律 rpx 定宽；`<text>` 行高一律 px，禁用无单位倍数。**

### 2. scroll-view `scroll-top` 大值滚底技巧失效（Android 蒸汽端）
- **症状**：进聊天页停在历史顶部，不自动滚到底部；收到新消息也不滚底。
- **根因**：TUIKit 式技巧（scroll-top 赋超大值靠引擎钳位到底）只在**赋值瞬间**按当时内容高度钳位——`onMounted` 赋值时列表未布局（高度=0）被钳到 0，内容渲染后不重钳，永远停顶部。H5/小程序端内容变化会重钳所以旧方案只在两端有效。
- **解法**：滚底改 `scroll-into-view` 锚点——列表末尾放 1px 空 view（`em-chat-bottom-anchor`），先清 `anchorId` 再 `nextTick` 赋值（同值不重触发）。同机已被引用定位（同款锚点机制）验证可用；进页滚底与收消息滚底同走 `scrollToBottom()`。scroll-top 初始预置大值保留作首帧语义，无干扰。
- **纪律：蒸汽端 scroll-view 定位一律锚点（scroll-into-view），禁用 scroll-top 大值技巧。**

### 3. CSS 动画 / word-break 不生效
- **症状**：`@keyframes` 动画、闪烁高亮、`word-break: break-all` 在 App 端静默失效。
- **根因**：HBuilderX 5.26 蒸汽引擎不支持 CSS 动画与 word-break（5.31 alpha 才新增）。
- **解法**：动画改 JS 定时器驱动（参考 chat-page 引用定位 `HIGHLIGHT_PULSE_SEQ` 双脉冲）；文本折行走 em-text 的 `lines` + 宽度约束。已知降级：发送中 spinner 蒸汽端为静态图标，二期再议。

### 4. 软键盘把自绘 nav-bar 顶飞（Android 实测）
- **症状**：输入框聚焦后整个页面上移，顶部自绘导航栏被推出屏幕。
- **根因**：**uni-app x 没有经典 uni-app 的 adjustResize/adjustPan 体系，`pages.json` 的 `app-plus.softinputMode` 在 x 端无效**（配了也从未生效）。x 端上推由 input 组件 `adjust-position`（默认 true）控制：输入框在 scroll-view 之外时 transform 上移**整个页面**（输入框在 scroll-view 内才只滚动容器）。
- **解法**（对齐 hello-uni-app-x `keyboard-adjust` 官方示例）：input 置 `:adjust-position="false"` 关系统上推 → 用键盘高度手动顶起底部输入栏（flex column 下消息区自动压缩，nav-bar 不动）。本库已封装 `libs/use/useKeyboardHeight.ts` + `em-chat-inputbar` 落地。
- **要点**：iOS/鸿蒙上报键盘高度**已含底部安全区，须扣除**（composable 内已处理，Android/小程序/H5 不扣）；`@blur` 清零兜底部分端收起不补发 0 高度事件；H5 端 `adjust-position` 无效（浏览器自管 resize，行为不变）。
- **遗留**：会话页/联系人页搜索聚焦同因顶飞，fix 待铺。

### 5. `uni.onXxx` 反注册签名不同（监听泄漏）
- **症状**：按经典 uni-app 写法 `uni.offXxx(callback)` 编译告警，运行时不解绑，反复进出页面回调 N 次。
- **根因**：uni-app x 的 `uni.onXxx(callback)` 返回监听 **id（number）**，`uni.offXxx(id)` 按 id 反注册；经典 uni-app 是按函数引用。
- **解法**：保存 onXxx 返回值，offXxx 传 id。范式见 `libs/use/useKeyboardHeight.ts`（onMounted 注册、onUnmounted 反注册）。`EmKit.onMessage` 泄漏 P0 修复同理（返回取消函数，页面 onUnmounted 必须调用）。

### 5a. 全屏弹层顶部贴屏顶，被刘海/状态栏遮挡（Android 实测）
- **症状**：全屏弹层（如建群选人 `em-select-contact` multiple）的标题行与系统状态栏同一行，被刘海遮挡。
- **根因**：Android 蒸汽端窗口 edge-to-edge，内容渲染到状态栏/刘海下；页面级自绘导航（`em-nav-bar`）有 `padding-top: getSafeAreaTop()`，但弹层路径（`em-popup` fullscreen）原本只处理底部 safeArea，顶部漏了。
- **解法**：`em-popup` 的 `panelStyle` 在 `fullscreen` 时追加 `padding-top: getSafeAreaTop()`；**内容方配 `height: windowHeight` 时必须扣除同一值**，否则总高超窗把底部确认键顶出屏（`em-select-contact` 已按此口径落地）。底部短弹层（action-sheet 等）够不到屏幕顶，无需处理。
- **口径**：app-android `safeAreaInsets.top` 自 HBuilderX 4.25 起返回状态栏高度（官方 getWindowInfo 文档），`getSafeAreaTop()` 直接读即可；若真机发现返回 0，另起 spike 修 `useSafeArea.ts`。

## 小程序（mp-weixin）

### 6. 原生事件穿组件边界冒泡
- **症状**：父组件 `@longpress` 拿到 `type='longpress'` 的原生事件而非子组件 emit 的载荷。
- **解法**：自定义事件禁止与原生同名，子组件透传长按用 `long-press`（见编码纪律）。

### 7. wxss 不认 uvue `lines` 属性
- **症状**：单行省略在小程序里两行重叠/裁切。
- **解法**：单行折叠档必须同时给 `white-space: nowrap`（em-text 内部已处理，宿主传 line1 即可）。

### 8. 样式隔离 apply-shared 限制
- **症状**：父组件给子组件内部 text 写的 class 规则全部失效（摘要落默认 16px 近黑）。
- **解法**：跨隔离文字样式走内联 `text-style`（var() token 可穿透）+ `text-class` 双通道。

### 8a. 父组件 class 打在 virtualHost 子组件（EmIcon 等）上静默失效
- **症状**：`<EmIcon :class="ns.e('flag')">` 的 margin/color 在 mp 不生效（置顶图标紧贴名字）；H5/App 正常。EmIcon/em-text 均为 virtualHost，class 穿透到内部节点后被隔离拦截。
- **解法**：间距/布局一律用普通 `<view>` 包裹子组件（class 落包裹 view）；颜色等文字样式走子组件 props（em-icon 的 `color` prop / em-text 的 `text-style`）。em-text 宿主布局 class（flex/min-width）是唯一验证可用的例外（见编码纪律）。

### 8b. @font-face 字体按族名持久缓存，ttf 更新不重载
- **症状**：`em-icons.ttf` 合并新字形后，模拟器里旧字形正常、新字形全 blank；改 post 表/换官方 Merger 重打包/重启开发者工具全无效；H5（Chromium）同字体渲染正常。
- **根因**：微信 mp 端 @font-face 按 **font-family 族名**持久缓存字体内容，同名不重新注册。
- **解法**：族名带版本号（`em-icons-vN`），**每次改动 ttf 内容必须递增版本号**（em-icon.css @font-face 与 .em-icon 同步改；纪律见 skill `em-icon-strategy`）。

## 编译/热更新（dev watch）

### 9. pages.json 变更不热更
- **症状**：改了 navigationStyle 等 pages.json 配置，模拟器里双 header/旧行为。
- **解法**：pages.json 变更后重启 dev 编译或重新 build 再验证。

### 10. dev watch 中途被杀 → wxss 残缺
- **症状**：新组件/样式在小程序端部分丢失（曾致聊天详情页按钮样式丢失）。
- **解法**：改动后让 dev 编译完整跑完一轮再验；异常时清缓存重建（`rm -rf demo/unpackage/dist/cache/.vite demo/node_modules/.vite`）。

## 蒸汽端能力边界速查（5.26）

| 能力 | 状态 |
|---|---|
| CSS @keyframes / transition 动画 | ❌ 不支持（5.31 alpha 新增） |
| word-break | ❌ 不支持（5.31 alpha 新增） |
| 伪元素 | ❌ ucss 全集禁用 |
| scroll-view scroll-top 超出钳位 | ⚠️ 只钳赋值瞬间，不重钳（禁用大值技巧，用 scroll-into-view 锚点） |
| 多行 text 倍数行高 | ⚠️ 测量不可靠，一律 px |
| 含多行 text 的 % max-width 宽度链 | ⚠️ 行尾缺字，改 rpx 定宽 |
| `adjust-position` 手动键盘避让 | ✅ 官方支持（App 三端） |
| `getAndroidView`/`getIOSView` | ⚠️ 蒸汽模式 js 拿不到原生 view，须 uts 插件 |
| 发送中 spinner 动画 | ⚠️ 降级为静态图标 |
