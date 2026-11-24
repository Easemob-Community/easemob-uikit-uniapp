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
- **解法**：动画改 JS 定时器驱动（参考 chat-page 引用定位 `HIGHLIGHT_PULSE_SEQ` 双脉冲）；文本折行走 em-text 的 `lines` + 宽度约束。旋转类动画（loading spinner）用 `useSpinRotation`（`libs/use/useSpinRotation.ts`）逐帧写内联 `transform: rotate()`，em-button / em-load-more 已接入。

### 4. 软键盘把自绘 nav-bar 顶飞（Android 实测）
- **症状**：输入框聚焦后整个页面上移，顶部自绘导航栏被推出屏幕。
- **根因**：**uni-app x 没有经典 uni-app 的 adjustResize/adjustPan 体系，`pages.json` 的 `app-plus.softinputMode` 在 x 端无效**（配了也从未生效）。x 端上推由 input 组件 `adjust-position`（默认 true）控制：输入框在 scroll-view 之外时 transform 上移**整个页面**（输入框在 scroll-view 内才只滚动容器）。
- **解法**（对齐 hello-uni-app-x `keyboard-adjust` 官方示例）：input 置 `:adjust-position="false"` 关系统上推 → 用键盘高度手动顶起底部输入栏（flex column 下消息区自动压缩，nav-bar 不动）。本库已封装 `libs/use/useKeyboardHeight.ts` + `em-chat-inputbar` 落地。
- **要点**：iOS/鸿蒙上报键盘高度**已含底部安全区**，但「面板高度」与「上推 margin」要用不同口径——面板扣安全区、上推直接用上报值（鸿蒙 + iOS 均已实测踩坑，见 4d）；`@blur` 清零兜底部分端收起不补发 0 高度事件；H5 端 `adjust-position` 无效（浏览器自管 resize，行为不变）。
- **遗留**：会话页/联系人页搜索聚焦同因顶飞，fix 待铺。

### 4a. H5 运行时没有 `uni.onKeyboardHeightChange`（聊天页白屏 P0，2026-10-20 修复）
- **症状**：H5 登录后点会话，聊天页空白；控制台 `TypeError: uni.onKeyboardHeightChange is not a function`。App/小程序正常。
- **根因**：uni-app x 的 H5 运行时未实现该 API，且编译器只重写它认识的 API，不认识的 `uni.*` 会原样留成裸全局；H5 的 `window.uni` 只有统计 `report`。该调用在 `useKeyboardHeight` 顶层、又被 `em-chat-page`/`em-chat-inputbar` 的 setup 立即执行，异常直接打断整页挂载。
- **解法**：`useKeyboardHeight` 用 `#ifndef WEB` 包住 on/off 注册；H5 分支不监听（浏览器 visualViewport 自管）。验证口径：H5 产物所有 chunk 中 `onKeyboardHeightChange` 出现次数必须为 0，并用未登录 mock 页把聊天页挂起来做运行时冒烟。
- **对照**：同一文件内 `uni.hideKeyboard()` 在 H5 运行时**有**实现（`defineAsyncApi("hideKeyboard")` = blur 当前 input），App（含鸿蒙 4.23+）/微信小程序亦支持，可放心用于「点击聊天区收键盘」这类场景；但**不要据此推断其它键盘 API 也在 H5 有**（`onKeyboardHeightChange` 就是反例）。
- **纪律**：H5 新增 uni API 前先确认运行时是否实现；不确认就条件编译 + 可选调用，禁止裸调。

### 4b. H5 长按后仍派发 click（菜单与点击同时触发）
- **症状**：H5 长按会话条目，长按菜单和“进入会话”同时发生；长按图片/语音，菜单与预览/播放同时发生。
- **根因**：uni-app 的 longpress 只是 350ms 定时器派发的自定义事件，没有 preventDefault，也不会抑制 touchend 后的原生 click；`@longpress` + `@click` 同元素必然双触发（Chrome 实测点击序列 `touchstart → longpress → touchend → click`）。
- **解法**：`libs/use/useLongPressClickGuard.ts`——touchstart 记时，click 时按住 ≥350ms 视为长按抬手并吞掉；桌面鼠标/键盘 click 无 touchstart 不受影响。已接入会话条目、好友列表行、图片/语音/视频/文件气泡。
- **纪律**：任何同时有 `@longpress` 与 `@click` 的元素都套该守卫，不要用“longpress 标记位 + 超时”方案（长按持有时长不定，会误伤或漏放）。

### 4c. 长页面只给根节点 `height: 100%` → 内容被裁、页面「能滚却不滚」（Android 实测，2026-10-20）
- **症状**：tabBar 页面（demo「我的」）内容明显超过一屏，上下滑完全不动；最后一行/底部按钮像被 hidden，tabBar 正好压在内容上。`uiautomator` 里页面原生 ScrollView `scrollable=false`。
- **根因**：页面根节点写死 `height: 100%`（= 可视区高度）且没有 scroll-view。超出根节点的子内容被裁掉，App 原生页面滚动容器只量到根节点高度（恰好一屏），判定「无溢出」所以不滚。H5 由浏览器滚动兜底，因此只有 App 暴露；tabBar 只是减少可视高度、让问题更早出现，**不是 tabBar 遮挡**（App 页面可视区已扣除 tabBar，实测 scroll-view 底边正好止于 tabBar 上沿）。
- **解法**：长页面必须显式用 scroll-view 承载内容——根 `display:flex; flex-direction:column; height:100%` + `.xxx__scroll { flex:1; height:0 }`（会话/联系人页本来就是这套，正常）。demo「我的」已按此修复。备选：根节点改 `min-height:100%`，让页面容器能量到真实内容高度（依赖页面级滚动，不如 scroll-view 可控）。
- **纪律**：App 页面内容可能超过一屏时，禁止只给根节点 `height:100%` 就结束；必须给 scroll-view 明确高度（`flex:1` + `height:0`）。排查时先看根节点是否固定 100% + 有没有 scroll-view，再看 scroll-view 底边是否止于 tabBar 上沿。

### 4d. 键盘「面板口径」被当成「上推口径」→ 输入栏顶起了但仍被键盘压住一截（鸿蒙 + iOS 实测，2026-10-21）
- **症状**：聊天页输入框聚焦，输入栏确实上移了，但底部仍被键盘盖住一截（鸿蒙实测 84px / 28vp、iOS 实测 102px / 34pt：输入框只露出上半部分，发送键下半截被压），H5/Android 不复现。
- **根因**：键盘上报值有**两种口径**，原实现只算了一种就复用：
  - **面板口径** = 面板对齐用的高度（历史口径：iOS/鸿蒙上报值含底部安全区、面板自身还有 safe-bottom padding，故扣掉安全区后交给 `height`；本次只复用该口径，不改面板看感）。
  - **上推口径** = 从屏幕底边算起的实际遮挡高度。App 端页面边到边（页面底 = 屏幕底），要的是键盘画到屏幕底的那一段。
  - 鸿蒙实测（6.0.1 / API 20，25PVB24711005055，density 3）：上报 314vp == 屏幕高 804vp − 键盘上沿 490vp，**就是实际遮挡高度（含手势导航条 28vp）**。原代码把面板口径（314−28=286vp）直接写进 `margin-bottom` → 输入栏底边落在键盘上沿下方 84px。
  - iOS 实测（iPhone 14 Pro 1179×2556 / 3x，第三方九宫格键盘，按用户截图量）：键盘上沿 y=1407px、输入栏 top 1350 + 栏高 159px → 栏底 1509px，**被压 102px = 34pt = `safeAreaInsets.bottom`**，同因同量级。即 iOS 上报值同样含安全区，上推不能再扣。
- **判定方法（可复用，三个数一对）**：
  - `hdc shell "uitest dumpLayout -p /data/local/tmp/l.json"` 取输入栏根节点 bounds（bottom 会被键盘裁到键盘上沿，top 是真实值）→ `margin-bottom = 屏幕高 − (root.top + root.height)`；
  - `hdc shell snapshot_display -f /data/local/tmp/s.jpeg` 截图找键盘面板上沿 → `实际遮挡 = 屏幕高 − 键盘上沿`；
  - `hdc shell "hidumper -s WindowManagerService -a '-a'"` 看应用窗口 rect（0..screenHeight 即边到边）与手势导航条窗口 rect（本机 84px）；`hidumper -s DisplayManagerService` 看 Density。
  - 判据：`margin == 实际遮挡` 才对；`margin == 实际遮挡 − 安全区` 就是把面板口径当上推口径。
  - iOS 无 `dumpLayout`：直接用系统截图逐像素量「键盘面板上沿 y」与「输入栏根节点 top + 栏高」（有分隔线的栏顶好认），差值应 == 0；差值恰等于 `safeAreaInsets.bottom`（刘海机 34pt / 3x=102px）即同一 bug。输入栏栏高已知 = 1px 边框 + 8 + 36 + 8 = 53pt（159px @3x），可用来交叉校验。
- **解法**：`useKeyboardHeight` 拆两个 ref——`keyboardHeight`（面板口径 = 上报值 − 安全区，iOS/鸿蒙）与 `keyboardLift`（上推口径 = 上报值原值，App 全端，**iOS 也不要再扣安全区**）；`em-chat-inputbar` 的 `margin-bottom` 用 `keyboardLift`、面板 `height` 仍用 `keyboardHeight`；blur / `hideKeyboard` 统一 `resetKeyboardHeight()` 一起清零。
- **纪律**：同一份 `uni.onKeyboardHeightChange` 值不要同时喂给「面板高度」和「margin-bottom」——两者语义不同；改用 `margin-bottom` 前先按上面的判定方法量一次。OS 大版本升级后复测。

### 5. `uni.onXxx` 反注册签名不同（监听泄漏）
- **症状**：按经典 uni-app 写法 `uni.offXxx(callback)` 编译告警，运行时不解绑，反复进出页面回调 N 次。
- **根因**：uni-app x 的 `uni.onXxx(callback)` 返回监听 **id（number）**，`uni.offXxx(id)` 按 id 反注册；经典 uni-app 是按函数引用。
- **解法**：保存 onXxx 返回值，offXxx 传 id。范式见 `libs/use/useKeyboardHeight.ts`（onMounted 注册、onUnmounted 反注册）。`EmKit.onMessage` 泄漏 P0 修复同理（返回取消函数，页面 onUnmounted 必须调用）。

### 5a. 全屏弹层顶部贴屏顶，被刘海/灵动岛遮挡（Android/iOS 实测）
- **症状**：全屏弹层（如建群选人 `em-select-contact` multiple）的标题行与系统状态栏同一行，被刘海/灵动岛遮挡。
- **根因**：Android 蒸汽端窗口 edge-to-edge，内容渲染到状态栏/刘海下；页面级自绘导航（`em-nav-bar`）有 `padding-top: getSafeAreaTop()`，但弹层路径（`em-popup` fullscreen）原本只处理底部 safeArea，顶部漏了。iOS 复现时 `getSafeAreaTop()` 实测为 59（不是 0），对照探针中 `em-popup` panel 额外增加 60pt 标题不动、内层 sheet 增加 60pt 标题立即移动，证明 fullscreen panel 的 padding 在 iOS 蒸汽端不参与布局，不能把它当作安全区承载节点。
- **解法**：顶部安全区直接由 `em-select-contact` multiple 的 `sheetStyle` 注入 `padding-top: top`，同时 `height: windowHeight - top`，padding 与内容高度合计仍为窗口高，底部确认键不被顶出屏；`em-popup` 只保留底部 safeArea。底部短弹层（action-sheet 等）够不到屏幕顶，无需处理。
- **口径**：app-android `safeAreaInsets.top` 自 HBuilderX 4.25 起返回状态栏高度（官方 getWindowInfo 文档），`getSafeAreaTop()` 直接读即可。iOS 出现遮挡时先用「外层/内层同值对照」确认 padding 是否生效，不要未测取值就加 statusBarHeight 兜底或盲目加大 inset。

### 5b. 原生 `<button>` 文字贴按钮底部（Android/鸿蒙蒸汽端，H5/小程序正常居中）
- **症状**：原生 `<button>` 同时写了 `height` 与 `line-height`（如都 40px），App 端文字贴在按钮下沿、上方空一大截；H5 与微信小程序同一份样式却天然居中。
- **根因**：蒸汽端 button 是原生实现，**文字竖直居中是靠组件默认的上下 padding，不靠 line-height**（官方 `docs/component/button.md` tips；默认文字 18px / 行高 2.5）。显式 `height` 把盒子钉死，但默认 `padding-top/bottom` 仍在，把行盒整体下推、底部被固定高度裁掉，视觉上只剩贴底的字。H5/mp 是 CSS/WebView button：line-height 直接负责居中、默认竖直 padding 为 0，所以只有 App 端翻车。**不是编译器 bug**。
- **解法**：凡给原生 button 写了 `height` + `line-height`，必须同时 `padding-top: 0; padding-bottom: 0`（官方推荐写法；`padding: 0 12px` 这类简写已含竖直 0，天然正常）。
- **现状**：本库组件一律用 `em-button`（view + text + flex `align-items:center`，不走原生 button）→ 免疫；demo 原生 button 已按上述修完（login / mine / style-lab），contact / spike 原本就是 `padding: 0 xx` 故无此 bug。
- **纪律**：ucss 只有 class 选择器、App 端样式不继承，写不出全局 `button {}` 复位——约束只能落在每个 button 的 class 上；新写原生 button（仅 mp 开放能力才需要）必自查 height / line-height / padding 三件套。

### 5c. App 端首屏白屏：store 反向依赖页面 chunk → ESM 循环（`Xxx is not initialized`，鸿蒙实测 2026-10-21）
- **症状**：鸿蒙真机启动白屏，控制台 `conversationStore is not initialized`，栈为 `at EmKitImpl entry (libs/index.js:22:26)` + `at func_main_0 (libs/index.js:342:15)`；报错行恰是 `this.conversations = conversationStore`。H5/小程序常不复现，Android/iOS 属于同一编译管线，同样有风险。
- **根因**（不是 store 写法错）：App/鸿蒙编译把 TS 降级辅助函数（`__values` 等）**提升到共享 chunk**。`libs/store/conversation.ts` 里一句 `for (const item of conversationStore.items)` 让 `__values` 落进 `components/pages/em-chat-page/em-chat-page.js`，产物因此多出一条反向 import：`libs/store/conversation.js → components/pages/em-chat-page/em-chat-page.js`。完整循环：`libs/index → chat/index → store/conversation → em-chat-page → libs/index`。首屏页面（demo 是 `pages/login`，经 `common/theme` 先摸到 store/conversation）进入后，循环回到 `libs/index` 执行 `new EmKitImpl()` 时 `conversationStore` 仍是 TDZ 未初始化 → 抛错 → 整页挂载失败 → 白屏。
- **判定方法**（产物就是 ESM，可静态查）：直接跑 `node scripts/check-app-module-graph.mjs`（零依赖，默认扫 `demo/unpackage/dist/dev/.app-harmony/assets`，也可传 App 产物目录）——命中 `libs → components` 反向 import 或 libs/index 参与的循环即 exit 1 并打印链路。手工口径：① 在 App 产物 `assets/uni_modules/easemob-uikit-uni/libs/` 里 grep `from "../../components/`；② 从各页面/App 入口模拟 ESM 求值（模块 state 1=求值中 / 2=完成），看 `libs/index.js` body 执行时 `store/conversation.js` 是否仍在求值中。本机修复前只有 1 条循环，`pages/login/login.js` 等 8 个入口必现。
- **解法**：**libs 内禁用 for-of / for-in**（改 `forEach` 或索引 `for`），消除 `__values` 这类被提升的 helper；`em-chat-page` 里唯一的 for-of（字符串按码点计宽）也一并改索引 + 代理对跳过。改后重跑同一检查：循环 0 条、所有入口模拟 ok。
- **纪律**：libs 模块（尤其 store）必须保持「零反向依赖组件」；新增 for-of 或其它会触发 helper 提升的语法前，先确认产物里没有 `libs → components/pages` 的 import。`components/` 下的 `.vue/.uvue` 也建议不用 for-of，避免 helper 落点随编译批次漂移再次串成环。

### 5m. App 端白屏无报错：setup/render 期 ReferenceError 被蒸汽引擎吞掉（iOS 真机实测 2026-10-22，M2.18 回归）
- **症状**：改动后从会话进聊天页整页白屏，控制台**没有任何报错**；H5 开发时同样代码可能只是 warn（VDOM 重渲染掩盖）或不触发，难在桌面端复现。
- **根因**：`<script setup>` 里误用了模板自动暴露的 props 名（如计算属性写 `features.sendOnReturn` 而 script 只有 `props.features`），vite 转译不做类型/未定义检查，产物为裸自由变量；computed 在首次渲染求值时 ReferenceError，蒸汽端挂载期异常不冒泡 → 整页白屏。
- **解法/排查**：先 diff 最近改动的组件，重点查 script 作用域新引用的标识符是否都有定义（props 自动暴露名在 script 不可用）；真机白屏无报错时按「setup 期异常」方向查，别先怀疑样式/布局。
- **纪律**：script 里引用 props 一律 `props.xxx`；给组件加新计算属性/方法后，自查一遍标识符定义（构建绿不代表运行绿，CLI 构建不做类型检查）。

### 5d. `<text>` 内 v-if 增删子 text → 整条气泡空白（鸿蒙实测 2026-10-21，M2.13 流式光标）
- **症状**：AI 流式气泡分片增长正常（末尾带 `▍` 光标），**流结束瞬间整条气泡变空白**：气泡底色与高度都在（甚至按全文撑开），但一个字也不绘制；该条消息后续一直空白。
- **根因**：蒸汽端 `<text>` 内用 `v-if` 增删子 `<text>`，**移除子节点后父 text 的字形不再绘制**（布局高度保留、绘制层丢字）。流式光标 `v-if="isStreaming"` 在终态翻 false → 子 text 被移除 → 父 text 全白。不是数据层问题（`message.text` 始终是全文）。
- **解法**：`text` 内的光标/异常提示改「**常驻子 text + 内容切换**」——节点永远挂载，只把 `'▍'` / i18n 文案 / `''` 作为 computed 文本写进去（`em-text-message` 的 `streamCursorText`/`streamErrorText`，`STREAM_CURSOR_CHAR` 在 constants）。改后真机完成态全文保留、异常态尾部提示正常。
- **纪律**：`<text>` 内禁止用 `v-if`/`v-else`/`v-for` 增删子 text；需要条件展示就改成常驻节点换内容，或把分支移到 text 外、用 view 承载。
- **验证口径**：鸿蒙真机装 HAP 后跑聊天页「AI 演示」的完成态 + 异常态，各自等 10s 以上确认文本不消失。

### 5e. 登录直接失败：`undefined class: UTSSDKModulesDCloudUniGetNetworkTypeIndexSwift`（iOS 真机实测 2026-10-21）
- **症状**：iOS 真机点「立即登录」，红字 `登录失败：undefined class: UTSSDKModulesDCloudUniGetNetworkTypeIndexSwift, uni-getNetworkType 模块不存在，请重新打自定义基座。`；H5/小程序不复现。**业务代码里搜不到 `getNetworkType`**。
- **根因**：`easemob-websdk@5.1.3` 的默认 uni runtime 适配器 `onNetworkChange` 里既注册 `uni.onNetworkStatusChange`，又同步调 `uni.getNetworkType` 探测网络类型；SDK 在 `login → core 构造` 时立即 `registerNetworkListeners()`。这两个 API 同属 iOS/Android 的 `uni-getNetworkType` UTS 模块，**自定义基座**没编入 → 同步抛错 → 冒泡成 login reject。
- **为什么重打基座不一定补得上**：基座模块清单（`demo/unpackage/cache/vapor/uts_custom_ios/uniapp-x-uts.json` 的 `duts`）是编译期按代码里的**字面量** `uni.xxx` 收集的；SDK 产物里是 `e2.getNetworkType(...)`（变量取值），静态扫描看不见，所以 `duts` 里始终没有 `uni-getNetworkType`（该文件里 `uni-network`/`uni-websocket` 有是因为我们自己的代码有字面量调用）。uni-app x 的 manifest **没有**「勾选内置 UTS 模块」的开关（`app-ios.distribute.modules` 是经典 App 模块，且为 `{}`）。
- **解法**：把这层依赖从库里摘掉，别让登录依赖一条诊断信息。`libs/platform.ts` 的 `subscribeNetworkStatus()` 只注册 `uni.onNetworkStatusChange` + 整段 try/catch；`libs/client/index.ts` 用 `platformAdapterOptions.overrides` 替换 SDK runtime（委托 `getPlatform`/`onAppVisibilityChange`，自管 `onNetworkChange`，**不提供可选的 `getNetworkType`**）。基座有模块时照常收网络事件，缺模块时降级为不监听（心跳/重连循环兜底）。
- **纪律**：App 端新增任何 `uni.*` 调用前，先确认它是否落在可选 UTS 模块里、宿主基座是否一定包含；SDK 内部通过变量调用的 API（`e.xxx`）不会进基座模块清单，等于给宿主埋一个必须重打基座的坑。**登录/建连路径禁止依赖可选模块**。
- **验证口径**：`demo/unpackage/cache/vapor/uts_custom_ios/uniapp-x-uts.json` 的 `duts` 里没有 `uni-getNetworkType` 时，iOS 仍能登录成功即算修复。

### 5f. `inset` box-shadow 在 iOS 蒸汽端丢 alpha → 元素内上沿一条实色白线（iOS 真机实测 2026-10-21）
- **症状**：登录页输入框内上沿有一条**实色白线**（像描了白边），H5/Android 同 CSS 只有几乎看不见的微光。像素实测：顶边亮带 lum≈215，四周边框 lum≈62 正常。
- **根因**：iOS 蒸汽端渲染 `box-shadow: inset 0 1px 0 rgba(255,255,255,0.04)` 时**丢掉颜色的 alpha**（0.04 的白被画成实色白），描出一条贴内上沿的线（跟圆角走）。登录页是全库唯一用 inset 阴影的地方，属样式问题不是组件问题。
- **解法**：App 端不用 `inset` 阴影装饰；需要「顶部高光」就用 `border-top`/渐变背景等确定能渲染的属性。登录页已去掉输入框全部 `box-shadow`，聚焦反馈只靠 `border-color` + `background-color`。
- **纪律**：蒸汽端样式优先只用坑集能力边界表里验证过的属性；写 `box-shadow` 前先问「inset 能否避免」——避免，或真机确认真会画对。

### 5g. 导出日志/写本地文件在 App 失败：`encoding: 'utf8'` + 沙盒路径不可见（2026-10-21）
- **症状**：demo「我的 → 导出调试日志」在 H5/微信小程序正常，App 上只弹「写文件失败，日志全文已复制到剪贴板」。
- **根因 1（真失败）**：`FileSystemManager.writeFile` 的 `encoding` 在 App 端只支持 `ascii` / `base64` / `utf-8`（错误码 1200002），而 `'utf8'` 是微信小程序接受的写法。同一份代码小程序能写、App 直接 fail。
- **根因 2（看似失败）**：`uni.env.USER_DATA_PATH` 在 App 是**应用沙盒**，文件管理器看不到；写成功也没有「下载目录」可找，弹窗里那串 `file://usr/...` 用户点不开。
- **解法**：`exportTextFile` 的 encoding 写 `'utf-8'`（或省略，默认 utf-8）；`USER_DATA_PATH` 为空时提前 reject（别拼出 `/xxx.txt`）；失败原因 `logger.warn` 进 `[emkit:kit]`，别静默吞。真机取日志以剪贴板/宿主分享为准；`uni.getFileSystemManager` 属可选 UTS 模块，自定义基座缺模块时同样回退剪贴板。
- **纪律**：跨端写文件的 encoding 一律 `'utf-8'`；「写进沙盒」不等于「用户能拿到文件」，App 端返回值只用于分享/上传。

### 5h. App 发附件必失败：`UploadError: Miniapp file read failed`（SDK md5 读文件被 FSM 沙盒拦住，2026-10-21）
- **症状**：App 选文件成功，发送时日志走到 `Attachment md5 compute start` 就抛 `sendFile fail: UploadError: Miniapp file read failed`，气泡落失败态；`upload.prepare.entry/normalized`、`upload.precheck.skip(md5-check-disabled)` 都正常。H5/小程序不复现。
- **根因**：`easemob-websdk@5.1.3` 每次附件上传前都会调 `imageProcessor.computeMd5`（`resolveUploadMetadata`）。App 上 SDK 解析到的是小程序处理器 → `uni.getFileSystemManager().readFile`；而 App 的 FSM **只能读 uni 沙盒目录**（`uni.env.CACHE_PATH` / `USER_DATA_PATH` / `SANDBOX_PATH` / `ANDROID_INTERNAL_SANDBOX_PATH`，内部实现 `isSandyBoxPath` 前缀校验）。宿主选择器把副本放在**系统缓存**（iOS `NSTemporaryDirectory()`、Android 原生 `getCacheDir()`、鸿蒙 `context.cacheDir`）→ 越界 fail（1300013 无权限 / 1300002 未找到）→ SDK 包装成 `Miniapp file read failed`。SDK 只对「FSM 能力缺失」容错（MISSING_CAPABILITY + capability 含 FileSystem），运行期 readFile 失败是硬错误。**注意 `uni.uploadFile` 不受影响**：它是原生读文件，能正常上传同一路径。
- **解法**：`libs/client/index.ts` 的 `platformAdapterOptions.overrides` 包装 `imageProcessor`：`computeMd5` 失败降级为空 md5（warn 带 `details`），上传继续；`getImageInfo`/`generateBigImage` 原样委托。md5 只用于服务端秒传预检，SDK 自身对缺能力平台也是不传 md5 继续上传，消息内容/接收端无差异。
- **纪律**：App 端**不要**用 `uni.getFileSystemManager` 读宿主给的文件路径；需要读字节（md5/解析）的能力都要有「读不到就不做」的降级。选择器副本路径只承诺「`uni.uploadFile` 可上传」，不承诺「FSM 可读」。
- **排查口径**：若仍失败，看 `[emkit:client] attachment md5 unavailable ...` 的 warn——`details.filePath` + `errCode` 可区分「读不到」与「路径已不存在」；此时错误若变成 `Mini program upload failed`，才是上传链路问题。
- **2026-11-24 Android 复测定案**：ALI-AN00 / Android 15 上，旧自研选择器返回的 `/data/user/0/<package>/cache/<uuid>.pdf` 会被拼到应用 `www` 下并抛 `FileNotFoundException`。最终方案不复制或转换该路径，改用内置 `uni.chooseFile` 返回的原始 `content://` URI；自定义基座已验证 SDK 可直接计算 MD5、上传成功，单击刚发送文件可本地打开。文件下载另有独立坑：SDK `body.url` 为 `http://` 时 Android 以 cleartext 策略拒绝，必须在下载入口归一为 HTTPS（RD-16/RD-17 已修已验，iOS/鸿蒙未复测）。

### 5v. 下载进度反复 `uni.showLoading` → 原生页面堆积并被低内存查杀（Android 实测，2026-11-24）
- **症状**：3.15MB 附件已经完整下载，但 loading 不消失，数秒后应用回登录页；连续两次复现。不是 SDK 下载失败，也不是业务 crash。
- **根因**：进度回调每个百分点调用一次 `uni.showLoading`，Android 蒸汽端每次创建新的原生 loading 页面（logcat 连续出现新 pageId）。进程 RSS 约 277–290MB 后被 `lowmemorykiller` 以 `oom_score_adj 0` 查杀；同一时刻桌面、文档预览和多个系统应用也被回收，属于内存压力结果。
- **定案解法**：一次下载只在开始显示一个「下载中...」，不要在 `onProgress` 中反复调 `showLoading`；成功/失败仍各关闭一次。百分比需要展示时使用页面内自有状态，不用原生 loading 页面承载高频更新。
- **验证**：`scripts/test-attachment.mjs` 覆盖禁止进度 showLoading；修复后真机只有一次 `uni:showLoading`，PID 不变，远端 PDF 下载并在系统预览器打开（RD-18）。
- **同类审计**：录音计时是页面内 `setInterval` 更新文本，录音 toast 仅在过短/失败结果出现一次；真机持续录音 8 秒并发送，无 `uni:showToast` / `uni:showLoading`。全库定时器与录音手势由 `scripts/test-native-popup-lifecycle.mjs` 防回归；其他高频状态也不要反复创建原生 toast/modal。

### 5i. App 端 class 方式覆盖 `--em-*` 变量结果随构建漂移（顺序无契约，两次真机构建相反，2026-10-22）
- **症状**：子树根节点挂 `themeClass` + 自定义 class（`.my-brand { --em-primary-color: #FF6B00; }`）覆盖变量：同一写法第一版构建 App 真机是蓝的（被主题类顶掉），探针版构建 P1 对照组又是橙的——**没改任何相关代码，结果随样式合并顺序漂移**。H5/小程序稳定生效。
- **根因**：库内每个组件 css 都 `@import` variables.css，蒸汽端样式合并后 `.em-theme-*` 的多份拷贝与宿主自定义 class 是**同特异性单类选择器**，同名自定义属性胜负拼声明顺序；宿主页面 css 与各组件拷贝的合并顺序不受宿主控制，随构建批次漂移。
- **解法**：App 端变量覆盖走内联（见 §5k 的节点分离规则）；class 方式仅 H5/小程序可用。
- **纪律**：跨端覆盖三原则——变量覆盖走内联 `:style`（注意 §5k 节点分离）；属性覆盖走 `custom-style` 内联；`custom-class` 只追加组件未设置的属性（边框/间距等）。

### 5k. 蒸汽端同节点 class 变量顶掉内联变量 → `primaryColor` 在 App 端失效（iOS 探针实测 2026-10-22）
- **症状**：节点同时绑 `themeClass` 与 `:style="'--em-primary-color: #FF6B00;'"`，内联变量不生效（按钮仍是主题蓝）；同一内联变量改挂到**不带 themeClass 的子包裹节点**立即生效。探针矩阵（style-lab P1–P5）：内联→组件 ✓、内联→宿主文本 ✓、custom-style 字面量 ✓、custom-style 内 var() ✓，唯「同节点 themeClass + 内联变量」 ✗。
- **根因**：蒸汽端自定义属性级联非标准——**同一元素上 class 规则定义的自定义属性优先于内联 style 里的同名自定义属性**；内联只能赢过继承值。普通属性无此问题（custom-style 字面量在同节点正常覆盖 class）。库内 7 个页面级组件根节点 `themeClass + primaryColorStyle()` 同节点绑定正踩中此坑，`EmKit.init({ primaryColor })` 在 App 端从未生效。
- **解法**：内联变量与 themeClass **分节点**——themeClass 挂根，内联变量挂子层包裹节点（页面级组件已统一加 `__brand-scope` 内层：`:style="primaryColorStyle()"`，css `flex:1 + height:0` 接替根的 flex 容器角色；根节点 `:style` 只留宿主 customStyle）。宿主自己的页面同样照此分层。
- **纪律**：蒸汽端给子树注入自定义属性时，携带节点不得同时绑定义了同名变量的 class（themeClass/主题类）；一律下沉一层。

### 5j. 蒸汽端 `createSelectorQuery` 查不到 rect → 触摸拖拽整体静默失效（iOS 实测 2026-10-22）
- **症状**：style-lab 色相条拖拽换主题色，mp-weixin 正常，iOS 真机完全拖不动（点按也无反应）。
- **根因**：拖拽几何靠 `uni.createSelectorQuery().in(getCurrentInstance()).boundingClientRect()` 异步查询，蒸汽端回调拿不到有效 rect，就绪标记永不置位，所有 touchstart/touchmove 被静默跳过（无任何报错）。em-alphabet-nav 的滑动定位是同一查询路径，在蒸汽端有同样失效风险。
- **解法**：几何可推导的位置一律同步算——通栏条用 `uni.getWindowInfo().windowWidth` 减已知页面边距，touchstart 即可用，不做异步查询；纵向 scroll-view 页面里拖拽期间 `:scroll-y="!sliding"` 锁定滚动，防手势被 scroll-view 接管。
- **纪律**：蒸汽端触摸拖拽优先同步几何；selectorQuery 只能做增强/兜底，不能做唯一路径。

### 5l. 蒸汽端原生 `textarea` 不吃 flex 尺寸/背景样式 → 多行输入区「消失」（iOS 真机实测 2026-10-22，M2.18）
- **症状**：输入栏换行档（`sendOnReturn=false`）多行生长态，textarea 区域整体不可见（无灰底、无占位符、不随行数长高）；H5/mp 正常。
- **根因**：textarea 是原生组件（iOS 为 `UITextView`），蒸汽端 `flex:1` 不生效（文档明示 App 默认宽 300px）、`background-color`/`border-radius` 等装饰样式渲染不可靠；内联 `height` 也可能被组件自身布局覆盖。参照 §5b（原生 button 文字基线）——**原生组件只保证内容区，装饰与尺寸必须由外层包裹承担**。
- **解法**：包裹层 view 承担高度（固定行高 × `linechange.lineCount`，封顶 5 行）+ 灰底 + 圆角 + 裁切，textarea 自身 `width:100%` + 显式高度、`background` 不设（iOS 另加 `disable-default-padding` 去默认内边距）。已收口到 `em-chat-inputbar/em-chat-multiline-input`；高度细节见 §5r。
- **纪律**：蒸汽端给原生输入类组件（textarea/button）做定制样式时，尺寸、背景、圆角一律落包裹层；组件自身只留文字相关样式。

### 5n. App 播放器全屏黑屏：自定义基座缺 `uni-video` 模块，`<video>` 被降级为 `<view>`（iOS 真机实测 2026-10-22，M2.19）
> 视频播放问题先按三连排查：① 基座 `uni-video` 模块 → ② App 下载本地再播（chatfiles 无 Range/无后缀）→ ③ 关 autoplay、挂载后显式 play、poster 不进 video。分别见 §5n / §5o / §5p。
- **症状**：点视频消息能进入全屏播放页，但整页黑底、无原生控制条、无声音；H5/小程序同一份代码正常。控制台通常报 `undefined class: UTSSDKModulesDCloudUniVideoBrightnessByJs, uni-video 模块不存在，请重新打自定义基座。`（栈从 `video` 组件 setup 起），也可能提示「未找到 "video" 组件，已自动当做 "view" 组件处理」。
- **根因**：uni-app x 对内置模块做摇树。自定义基座在接入 `<video>` 之前打包时，基座 `duts` 清单里没有 `uni-video`（查 `unpackage/cache/vapor/uts_custom_ios/uniapp-x-uts.json`），运行时 video 组件不存在，被降级成普通 view → 黑屏。不是组件样式或视频 URL 问题（后者会走 error/失败提示）。
- **解法**：工程引用 video 组件后重新打包自定义基座；需要固定模块时在 manifest 的 `app-ios` / `app-android` → `distribute.modules`（HBuilderX 4.71 以下为 `app` → `distribute.modules`）显式声明 `"uni-video": {}`（鸿蒙同理）。demo 的 manifest 三端均已配置。
- **纪律**：新增依赖内置组件的功能（video/map/canvas 等）后，真机验证前必须重打自定义基座；「H5 正常、App 黑屏」先查基座 `duts`，不要先怀疑布局或样式。

### 5o. iOS 播放器一直转圈 `00:00 / 00:00`：chatfiles 不支持 Range + URL 无后缀（iOS 真机实测 2026-10-22，M2.19）
- **症状**：基座已含 `uni-video`，能拉起原生播放器并显示 poster/控制条，但一直 loading、两端时长都是 `00:00`；同一 URL 在 iPhone Safari 能正常播；控制台无 `play error`。
- **根因**：EaseMob chatfiles 直链形如 `https://.../chatfiles/<uuid>`，**没有扩展名**；实测响应 `Content-Type: video/mp4`、有 `Content-Length`，但带 `Range: bytes=0-1023` 仍返回 `HTTP 200` 全量、没有 `Accept-Ranges`/`Content-Range`。iOS AVPlayer 的远程渐进播放依赖 Range，且对无后缀 URL 容忍差，于是停在 prepared 前一直转圈。浏览器/小程序内部下载器是整包拉取，所以浏览器正常。
- **解法**：App 端不要直接把远程直链喂 `<video>`：`uni.downloadFile` 整包下载 → `FileSystemManager.copyFile` 到 `USER_DATA_PATH/em-video-*.mp4` 补后缀 → 用本地路径播放；下载期显示进度，关闭时 `DownloadTask.abort()`，同一 URL 会话内缓存。H5/小程序保持远程 URL；HLS（`.m3u8`）与本地路径不整包下载。
- **排查口径**：`curl -sI -H 'Range: bytes=0-1023' <url>` 看是否 206 + `Content-Range`；若 200 全量，iOS 远程播放必卡。另看 URL 是否带扩展名、`Content-Type` 是否 `video/*`。
- **纪律**：IM 文件直链（chatfiles/无后缀 CDN/需鉴权链接）在 iOS 上优先「下载到本地再播」；不要指望 AVPlayer 像浏览器一样边下边播。

### 5p. iOS 视频进度条在走、画面停在首帧（2026-10-22，M2.19 已定案，iOS 真机验证）
- **症状**：本地文件已下载并播放，时间/进度条前进（可能有声音），但画面停在约 0s 的首帧/封面；同一文件用 `AVAssetImageGenerator` 抽 0s/2s 帧内容不同，说明文件与编码正常。
- **根因**：原生 `autoplay` 在 `<video>` 事件绑定完成前就起播，`play` 事件丢失，组件一直把首帧/封面层留在画面上；`poster` 又进一步把静态首帧盖在播放层上。表现为「有进度、没画面」。
- **定案解法**：`<video>` 不传 `poster`（封面只用于下载 loading 的背景图）；`:autoplay="false"`，等组件挂载后显式 `createVideoContext(id, instance).play()`，未收到 `@play` 每 500ms 重试、最多 8 次。改后 iOS 真机画面随进度更新、声音正常。
- **排查口径**：先确认文件可解（`AVAssetImageGenerator` 抽两帧对比）；若时间不自己走，是起播问题；若时间走画面不动，按本节处理；仍不动时点原生全屏按钮——全屏能播说明内联层问题，可 `requestFullScreen` 兜底，全屏也黑才是播放器缺陷。
- **纪律**：不要用 `autoplay=true` + 延迟 `play()` 混用（会双起播/丢事件）；`poster` 只用于加载态，不要让它盖在播放层上。视频源链路（下载本地）见 §5o。

### 5q. 弹层「挂载了但看不见」：v-if 新建分支的渲染会整条丢失（Android 真机实测 2026-10-23，两轮定案）
- **症状**：会话列表右上角「+」偶发只收起底部 tabBar、action sheet 不出来；整页点击被吞（有全屏透明命中区），再点「+」只会把弹层关掉。约 3/12 概率，与点击位置无关。同类弹层（长按会话、选人、@提及、聊天页长按菜单）同源。
- **根因（两轮插桩结论）**：① 第一轮：`v-if` 新建分支时，**该子树的动态 class 写入会整条丢失/回落到旧值**（`watch`/渲染 effect 日志全对，原生仍是隐藏态）。② 第二轮（真机给根节点/面板打内联绿色/红色标记）：失败时**连内联背景色都不落笔**，说明不是 class 级联问题，而是**新分支的视觉节点整批没建出来**——只建出命中区，所以弹层不可见但仍吃点击；而 `holdTabBar()` 已先隐藏原生 tabBar，于是「tabBar 没了、弹层也没出来」。
- **已排除**：页面状态互斥（失败时 JS 状态完全正确）、`hideTabBar` 干扰（关掉仍失败）、点击坐标（固定点可复现）、延迟补写 class（80/240ms 补写仍 2/10）、延时 50ms 挂载（仍 4/10）、把显示态写死进挂载（仍 2/6）。
- **定案解法**：**弹层树常驻挂载，不在打开时建节点**——`em-popup` 去掉 `v-if`，页面挂载时就把 root/遮罩/面板建好；关闭态用根节点内联 `top: 200%` 把整棵移到视口下方（不绘制、不吃点击），打开/关闭只改这一个内联样式（节点早已附着，写不会丢）。默认态即最终态：遮罩默认不透明、面板默认在最终位置（不依赖 `--show` 类）。真机 14/14 次开合全通过、每次 tabBar 如实归还（改前 3/12 失败）。
- **动画（要过渡看这里）**：进场动画只能做「附加位移」——JS 逐帧写内联 `transform: translateY(100%→0%)`（约 200ms，同 `useSpinRotation` 思路），尾段直接写 0%，这样任意一帧丢写都只表现为「少一段动画/位置差一截」，不会回到不可见态。**禁止**再用 CSS `translateY(100%)`/`opacity:0` + 挂载后翻 class 的老写法；退场动画同理不要做（收尾那次写入若丢会留下幽灵弹层）。
- **代价**：弹层内容（如选人列表）会在页面挂载时就建好（不再等首次打开）；收起为瞬隐（无退场动画）。
- **纪律**：蒸汽端凡「打开时才建起来」的 UI（弹层/浮层/面板）都不要依赖新分支的首次渲染；要么常驻挂载 + 只改样式，要么接受它偶发不出现。要动画用 JS 逐帧写内联样式（同 `useSpinRotation`），并保证任意一帧丢写时终态仍可见。

### 5r. 生长 textarea 高度塌陷、先高后低、清空后残留超高（App 三端，M2.22/M2.23）
- **症状**：多行草稿恢复时灰底可能塌成细线、文字溢出且点不聚焦；输入/删行时视觉先高后低；清空后 placeholder 已恢复但灰底仍停在约 5 行高。Android、iOS、鸿蒙均有用户真机复现，属于通用实现问题，不是单平台兼容性分支。
- **根因**：旧实现混用三套时序——≤5 行交给原生 `auto-height`，>5 行切 JS 固定高度，删行/清空再用 `nextTick` 开关 `auto-height` 逼原生重测。官方明确 `auto-height=true` 时 `style.height` 不生效；`nextTick` 只保证 Vue 更新，不保证原生文本控件完成布局。封顶后 `linechange.height` 还可能停在布局残留值，反推行高会形成越学越大的回路。
- **定案解法**：固定 textarea `line-height:19px` 并始终 `auto-height=false`；文本区高度恒为 `19 × min(visualLineCount,5)`，包裹层恒为该值 +16px。`linechange` 只取 `lineCount`，不读 height/heightRpx；空草稿由 modelValue watcher 同步回 1 行，硬换行减少同步收缩，>5 个硬换行的草稿首帧直接按 5 行封顶。禁止再靠开关 auto-height、延时或平台补丁做二次矫正。
- **交互保留**：灰底包裹层 `@click` 转发焦点（先 `:focus=false` 再 `nextTick` 置 true，同值不重发请求），输入栏根保持 `flex-shrink:0`；这里的 nextTick 只用于焦点请求，不参与高度测量。
- **纪律**：原生 textarea 的装饰和尺寸由包裹层承担，文本行高用 px；任何分支高度都必须 >0，且高度只能有「固定行高 × 行数」一种算法。软折行依赖 linechange 校正，清空/硬换行减少不等待原生事件。
- **验证口径**：三端同测空态、1→6 行、6→2 行、发送清空、>5 行草稿重进、软折行和灰底点击；不得出现先高后低、空草稿高框、文字裁切或无法聚焦。

### 5s. emoji 面板同行字形上沿被整齐裁切（Android / 鸿蒙，2026-11-04 实机确认）
- **症状**：emoji 网格中同一行字形的上沿被水平裁齐，带光环、爱心、汗滴等探出装饰的 emoji 尤其明显；iOS 与 H5 正常。
- **根因**：24px emoji 使用无单位 `line-height: 1`，原生文本行盒只有 24px；Android / 鸿蒙彩色 emoji 的实际字形边界超出该高度后被裁切。不要用放大单元格、负 margin 或祖先 `overflow` 掩盖文本行盒问题。
- **解法**：emoji 字符使用固定 px 行高，为字形预留完整绘制空间。本库 `.em-chat-inputbar__emoji-char` 定为 `font-size:24px; line-height:32px`，仍由 48px 单元格 flex 居中；无需平台分支。
- **纪律**：蒸汽端 emoji 与普通文本一样禁用无单位倍数行高；彩色字形要按实际装饰边界预留行盒，而不是把行高压成字号。

### 5t. iOS 首次麦克风授权后持续占用、后续录音反复「过短」（2026-11-11，原生时序源码确认）
- **症状**：首次按住说话弹出系统授权，允许后麦克风指示不消失；再次录音反复提示「录音时间太短」，杀进程重进才恢复。
- **根因**：DCloud iOS RecorderManager 的 `start()` 先异步等待 `requestRecordPermission`，授权回调前 `audioRecorder` 为空，此时 `stop()` 是空操作；允许后仍会 `innerStart()`。下一次 `start()` 又会先停止这段遗留录音。旧 UIKit 未监听 `onStart`，且允许新一轮覆盖 `recordOptions`，旧 `onStop` 因此落入新一轮并按刚重置的开始时间算出 0 秒。
- **解法**：JS 录音忙态覆盖「start 请求 → 原生终止」完整轮次；stop/cancel 锁存停止意图，单例 `onStart` 发现该意图时再次 stop；旧轮未终止前忽略新 start。开始后的原生错误不会立即释放 JS 忙态，而是丢弃结果并等待旧 `onStop`；启动前错误才允许立即复位。重复 stop 共享 Promise，取消/原生错误明确 reject。`useChatComposer` 在调用原生 start 前先初始化手势态，同时检查 UI 录音态与平台忙态，避免同步回调和清理期误开浮层。
- **纪律**：不要把 `recorder.start()` 返回当作真实开始，不要用延时或放宽过短阈值掩盖授权时序；启动等待期的停止/取消必须在 `onStart` 补偿收尾，开始后的错误必须排空旧原生录音，停止 Promise 不得被覆盖或静默丢弃。
- **验证**：`scripts/test-record-lifecycle.mjs` 用延迟 `onStart` 的 mock RecorderManager 覆盖授权期停止/取消、清理期防重、开始后错误排水、重复停止、取消/错误结算、同步回调及正常/自动停止/错误重试，13/13 通过；真机结果记 `docs/STATUS.md`。

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
| 长页面根节点 `height: 100%` | ⚠️ 溢出内容被裁、页面不滚；必须 scroll-view（`flex:1` + `height:0`） |
| `adjust-position` 手动键盘避让 | ✅ 官方支持（App 三端） |
| 键盘上报值口径（面板 vs 上推） | ⚠️ iOS/鸿蒙上报值含底部安全区：上推 `margin-bottom` 直接用原值（iOS 34pt / 鸿蒙 28vp 不能再扣），emoji/媒体面板高度才扣安全区（§4d） |
| `getAndroidView`/`getIOSView` | ⚠️ 蒸汽模式 js 拿不到原生 view，须 uts 插件 |
| 发送中 spinner 动画 | ✅ JS 定时器驱动 `useSpinRotation` 逐帧旋转（em-button / em-load-more）；chat-page 发送中仍为 keyframes（H5/mp 转、蒸汽静态） |
| for-of / for-in（App 编译降级） | ⚠️ 生成 `__values` 等 helper 并提升到任意 chunk；**libs 内禁用**（会造成 `libs → components/pages` 循环依赖，首屏 `Xxx is not initialized` 白屏） |
| `<text>` 内 v-if 增删子 text | ❌ 移除子节点后父 text 字形丢失（气泡空白但高度保留）；改常驻子节点换内容 |
| v-if 新建分支（弹层/浮层） | ❌ 新分支的视觉节点会偶发整批不建（只剩命中区）：弹层「看不见但仍吃点击」，约 3/12；改常驻挂载 + 只改内联样式（§5q） |
| `box-shadow` 的 `inset` | ⚠️ iOS 丢 alpha，低透明度高光会被画成实色白线；装饰改用 border/渐变 |
| `uni.getNetworkType` / `uni.onNetworkStatusChange` | ⚠️ 同属可选 UTS 模块 `uni-getNetworkType`；自定义基座可能没有，且 SDK 变量调用不会进基座 `duts` 清单 |
| `uni.onNetworkStatusChange`（有模块的基座） | ✅ 支持，`onXxx` 返回 id、`offXxx(id)` 反注册 |
| `FileSystemManager.writeFile` 的 `encoding` | ⚠️ App 只认 `ascii`/`base64`/`utf-8`（`'utf8'` 报 1200002）；小程序两者都收 |
| `uni.env.USER_DATA_PATH` | ⚠️ App 是应用沙盒，文件管理器不可见；写成功也取不出，日志导出以剪贴板/分享为准 |
| `uni.getFileSystemManager().readFile`（App） | ⚠️ 只认 uni 沙盒目录（`uni.env.*`）；系统缓存里的宿主文件读不到（1300013/1300002），SDK 的附件 md5 即踩中，见 §5h |
| `uni.uploadFile` 读宿主缓存路径（App） | ⚠️ Android 5.34 实测会把 `/data/user/0/...` 错拼到 `www` 导致上传失败；不能跨端承诺绝对缓存路径可直传，见 §5h 修正 |
| textarea 生长输入（App） | ⚠️ 禁止混用 auto-height 与 JS 固定高度；固定 19px 行高并始终显式高度，linechange 只取 lineCount，清空由草稿状态直接复位（§5r） |
| `<video>` 组件（App） | ⚠️ 属内置模块 `uni-video`，参与摇树；自定义基座未包含时组件降级为 `<view>`（播放页黑屏），接入视频后需重打基座或 manifest 显式声明（§5n） |
| iOS 远程视频直链 | ⚠️ chatfiles 无后缀且不支持 Range，AVPlayer 会停在 `00:00`；先下载到本地 `.mp4` 再播（§5o） |
| iOS `autoplay` + `poster` | ⚠️ autoplay 可能抢在事件绑定前起播导致 `play` 丢失、画面停在首帧；改 `autoplay=false` + 挂载后显式 `play()`，`poster` 不进 `<video>`（§5p） |
