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
- **要点**：iOS/鸿蒙上报键盘高度**已含底部安全区**，但「面板高度」与「上推 margin」要用不同口径——面板扣安全区、上推直接用上报值（鸿蒙已实测踩坑，见 4d）；`@blur` 清零兜底部分端收起不补发 0 高度事件；H5 端 `adjust-position` 无效（浏览器自管 resize，行为不变）。
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

### 4d. 鸿蒙键盘「面板口径」被当成「上推口径」→ 输入栏顶起了但仍被键盘压住一截（鸿蒙实测，2026-10-21）
- **症状**：聊天页输入框聚焦，输入栏确实上移了，但底部仍被键盘盖住一截（实测 84px / 28vp：输入框只露出上半部分，发送键下半截被压），H5/Android 不复现。
- **根因**：键盘上报值有**两种口径**，原实现只算了一种就复用：
  - **面板口径** = 面板对齐用的高度（历史口径：iOS/鸿蒙上报值含底部安全区、面板自身还有 safe-bottom padding，故扣掉安全区后交给 `height`；本次只复用该口径，不改面板看感）。
  - **上推口径** = 从屏幕底边算起的实际遮挡高度。App 端页面边到边（页面底 = 屏幕底），要的是键盘画到屏幕底的那一段。
  - 鸿蒙实测（6.0.1 / API 20，25PVB24711005055，density 3）：上报 314vp == 屏幕高 804vp − 键盘上沿 490vp，**就是实际遮挡高度（含手势导航条 28vp）**。原代码把面板口径（314−28=286vp）直接写进 `margin-bottom` → 输入栏底边落在键盘上沿下方 84px。
- **判定方法（可复用，三个数一对）**：
  - `hdc shell "uitest dumpLayout -p /data/local/tmp/l.json"` 取输入栏根节点 bounds（bottom 会被键盘裁到键盘上沿，top 是真实值）→ `margin-bottom = 屏幕高 − (root.top + root.height)`；
  - `hdc shell snapshot_display -f /data/local/tmp/s.jpeg` 截图找键盘面板上沿 → `实际遮挡 = 屏幕高 − 键盘上沿`；
  - `hdc shell "hidumper -s WindowManagerService -a '-a'"` 看应用窗口 rect（0..screenHeight 即边到边）与手势导航条窗口 rect（本机 84px）；`hidumper -s DisplayManagerService` 看 Density。
  - 判据：`margin == 实际遮挡` 才对；`margin == 实际遮挡 − 安全区` 就是把面板口径当上推口径。
- **解法**：`useKeyboardHeight` 拆两个 ref——`keyboardHeight`（面板口径 = 上报值 − 安全区，iOS/鸿蒙）与 `keyboardLift`（上推口径 = 上报值，App 全端）；`em-chat-inputbar` 的 `margin-bottom` 用 `keyboardLift`、面板 `height` 仍用 `keyboardHeight`；blur / `hideKeyboard` 统一 `resetKeyboardHeight()` 一起清零。iOS 的上推口径暂沿用旧值（未真机验，见 STATUS 待验）。
- **纪律**：同一份 `uni.onKeyboardHeightChange` 值不要同时喂给「面板高度」和「margin-bottom」——两者语义不同；改用 `margin-bottom` 前先按上面的判定方法量一次。OS 大版本升级后复测。

### 5. `uni.onXxx` 反注册签名不同（监听泄漏）
- **症状**：按经典 uni-app 写法 `uni.offXxx(callback)` 编译告警，运行时不解绑，反复进出页面回调 N 次。
- **根因**：uni-app x 的 `uni.onXxx(callback)` 返回监听 **id（number）**，`uni.offXxx(id)` 按 id 反注册；经典 uni-app 是按函数引用。
- **解法**：保存 onXxx 返回值，offXxx 传 id。范式见 `libs/use/useKeyboardHeight.ts`（onMounted 注册、onUnmounted 反注册）。`EmKit.onMessage` 泄漏 P0 修复同理（返回取消函数，页面 onUnmounted 必须调用）。

### 5a. 全屏弹层顶部贴屏顶，被刘海/状态栏遮挡（Android 实测）
- **症状**：全屏弹层（如建群选人 `em-select-contact` multiple）的标题行与系统状态栏同一行，被刘海遮挡。
- **根因**：Android 蒸汽端窗口 edge-to-edge，内容渲染到状态栏/刘海下；页面级自绘导航（`em-nav-bar`）有 `padding-top: getSafeAreaTop()`，但弹层路径（`em-popup` fullscreen）原本只处理底部 safeArea，顶部漏了。
- **解法**：`em-popup` 的 `panelStyle` 在 `fullscreen` 时追加 `padding-top: getSafeAreaTop()`；**内容方配 `height: windowHeight` 时必须扣除同一值**，否则总高超窗把底部确认键顶出屏（`em-select-contact` 已按此口径落地）。底部短弹层（action-sheet 等）够不到屏幕顶，无需处理。
- **口径**：app-android `safeAreaInsets.top` 自 HBuilderX 4.25 起返回状态栏高度（官方 getWindowInfo 文档），`getSafeAreaTop()` 直接读即可；若真机发现返回 0，另起 spike 修 `useSafeArea.ts`。

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

### 5d. `<text>` 内 v-if 增删子 text → 整条气泡空白（鸿蒙实测 2026-10-21，M2.13 流式光标）
- **症状**：AI 流式气泡分片增长正常（末尾带 `▍` 光标），**流结束瞬间整条气泡变空白**：气泡底色与高度都在（甚至按全文撑开），但一个字也不绘制；该条消息后续一直空白。
- **根因**：蒸汽端 `<text>` 内用 `v-if` 增删子 `<text>`，**移除子节点后父 text 的字形不再绘制**（布局高度保留、绘制层丢字）。流式光标 `v-if="isStreaming"` 在终态翻 false → 子 text 被移除 → 父 text 全白。不是数据层问题（`message.text` 始终是全文）。
- **解法**：`text` 内的光标/异常提示改「**常驻子 text + 内容切换**」——节点永远挂载，只把 `'▍'` / i18n 文案 / `''` 作为 computed 文本写进去（`em-text-message` 的 `streamCursorText`/`streamErrorText`，`STREAM_CURSOR_CHAR` 在 constants）。改后真机完成态全文保留、异常态尾部提示正常。
- **纪律**：`<text>` 内禁止用 `v-if`/`v-else`/`v-for` 增删子 text；需要条件展示就改成常驻节点换内容，或把分支移到 text 外、用 view 承载。
- **验证口径**：鸿蒙真机装 HAP 后跑聊天页「AI 演示」的完成态 + 异常态，各自等 10s 以上确认文本不消失。

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
| `getAndroidView`/`getIOSView` | ⚠️ 蒸汽模式 js 拿不到原生 view，须 uts 插件 |
| 发送中 spinner 动画 | ⚠️ 降级为静态图标 |
| for-of / for-in（App 编译降级） | ⚠️ 生成 `__values` 等 helper 并提升到任意 chunk；**libs 内禁用**（会造成 `libs → components/pages` 循环依赖，首屏 `Xxx is not initialized` 白屏） |
| `<text>` 内 v-if 增删子 text | ❌ 移除子节点后父 text 字形丢失（气泡空白但高度保留）；改常驻子节点换内容 |
