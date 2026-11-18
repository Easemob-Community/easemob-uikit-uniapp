# STATUS.md — 项目进度日志（自 AGENTS.md 拆出，2026-10-15）

> 本文件按时间顺序记录已落地功能与实测结论，**事实详情以本文为准**；AGENTS.md 只保留最小路由。
> 新增进度继续追加到本文末尾；「待验项」汇总在文末。

## 基线：M1/M2 已实现全景（截至 M2.8）

- **库结构**：`uni_modules/easemob-uikit-uni/` —— `libs/`（EmKit 门面 + client/chat/store（connection/conversation/message/theme）/platform/use/locale/utils 功能拆分）、`components/`（`em-avatar`、`em-popup`（内部弹层基座）、`em-action-sheet`（底部动作菜单）、`em-conversation-page`、`em-chat-page`、`em-chat-info-page`（聊天详情）、`em-nav-bar`（safe-top + 44px 行，title/subtitle/showBack/actionIcon props + back/action 事件，小程序胶囊避让内置）、`em-button`、`em-chat-inputbar`（文本/语音/emoji/媒体面板/引用条）、气泡族 `em-text-message`/`em-image-message`/`em-audio-message`/`em-video-message`/`em-file-message`、`em-text`（lines 折叠 + word-break 收口原子组件））。枚举字符串统一收口 `libs/constants/`。
- **SDK**：`easemob-websdk 5.1.3` 精确锁定（peer 同声明；demo login 页头展示 `SDK_VERSION`，升级时同步改）。ChatClient + Manager 注册制（已注册 ChatManager/PushManager/UserInfoManager/ContactManager）；`enableSyncData: ['conversation','contact']` 显式选择。
- **logger 服务**：`libs/utils/logger.ts`（零依赖，`[emkit:<ns>]` 前缀；`EmKitConfig.logLevel/sdkConsoleLog/sdkLogLevel` 三项接线；SDK 结构化日志经 ChatClient 级 `onLog` 转发进 `[emkit:sdk]`）。2000 行内存环形缓冲（与 console 级别解耦），`EmKit.exportLogs()` 分端导出（H5 Blob 下载；小程序/App 写 `USER_DATA_PATH` + 兜底剪贴板），demo mine 页有入口。
- **聊天链路**：引用（`EmMessageItem.quote` 快照，1.0 主协议 ext `msgQuote` 与 vue 版互通 + 旧 `emQuote` 兼容双写，toMessageItem 三路径统一解析）、撤回（2 分钟窗口，onMessageRecalled 落 recalled 态）、失败重发（原位红叹号，resendMessage 重建投递）、单聊已读回执（enableReadReceipt，≤50 条批量回执，仅最新己方消息显示对勾/空心圆）、typing（cmd 消息 action `TypingBegin`，5s 节流 + 5s 超时，cmd 在 onMessage/loadHistory 边界拦截不落列表）、语音/视频/文件收发（platform.ts 收口媒体选择/录音/播放，录音仅小程序+App、chooseFile 仅小程序+H5；视频播放全端内置全屏播放器，M2.19）。
- **输入栏**（`em-chat-inputbar` 原子）：面板状态机 `none|emoji|media` 三态互斥（与键盘互斥、占键盘位）；emoji 96 字符集网格；媒体面板 56×56 瓷贴四格；按住说话（上滑 60px 取消）；引用条（发送成功/手动关闭/切会话清除）。
- **用户属性**：`libs/store/user.ts`（infoByUserId 缓存 + 防重拉，回落链 nickname > conversation.name > userId）+ `libs/chat/user-info.ts`（ensureUserInfos 微任务合批，wire avatarurl 边界归一；登录/会话同步/收消息/拉历史/进会话自动补拉）。
- **时间**：会话列表五档（今天 HH:mm / 昨天 / 周X / MM/DD / YYYY/MM/DD）+ 聊天页时间分隔条（`TIME_DIVIDER_INTERVAL` 默认 5 分钟，`formatDividerTime` 四档）。
- **进入聊天页优化**（对齐 TUIKit uniapp）：navigateTo 前 fire-and-forget 预热；onMounted 并行非阻塞；滚底 scrollTop 双大值（999999/1000000 交替）；首帧隐藏 + 500ms 兜底；加载历史 prepend 锚点保位（500ms 清空）。
- **自绘导航栏**：pages.json 两页 `navigationStyle: custom` + `app-plus.titleNView: false`，header 收口 `em-nav-bar`。
- **聊天详情页**：`em-chat-info-page`（头像昵称条 + 免打扰/置顶 switch（乐观更新失败回滚）+ 清空记录/删除会话（二次确认）；`clearConversationMessages` = removeHistoryMessages 截断 + 本地缓存/游标复位 + 摘要清零）；入口走 `open-info` emit 宿主接线。
- **联系人页（M2.5）**：`em-contact-page`（字母分组 A-Z + `#`、索引条、搜索、新请求入口、长按删除）+ `em-contact-requests-page`（pending 双按钮 + processingIds 幂等）+ `em-alphabet-nav`（27 格恒渲染、touchstart 点按/touchmove 占比滑动、scroll-into-view 同组先清空再赋值）；数据层 `libs/chat/contact.ts`（bind + readyContactManager cast；roster 六事件刷新；**enableSyncData 不传 'contact' 好友同步不启动**；onSyncDataFinished success 才回填自愈；invite 持久化 key `emkit.contact.invites`）+ `libs/utils/pinyin.ts`（setPinyinAdapter 可选注入，零依赖降级）。未做（二期）：黑名单、群组、详情页、穿梭框、presence。
- **一期范围未做/降级清单**：`@我` 提示、会话滑动删除（长按菜单替代）、链接识别与 @高亮、语音波形动画/未读红点、文件下载进度、引用点击定位原文、消息列表 list-view 复用（仍 scroll-view）、下拉加载历史（点击加载）。

## 2026-10-14 结构治理

- `components/` 分层：页面级 5 个迁入 `components/pages/`（宿主 pages.json 配 easycom custom 规则）；全部 22 个组件样式抽离同名 `.css`，`.vue` style 块仅一行 `@import`。
- 新原子组件：`em-search-bar`（36px 圆角条 + search 图标，placeholder 宿主传 i18n）、`em-badge`（count/max(99)/dot，0/负数不渲染；em-avatar 保留 `__badge` 壳）、`em-conversation-item`（item/name/avatar/timeText/draft 五 props，emits click + long-press）。
- libs 治理：`libs/chat/index.ts` 按域拆 message.ts / conversation.ts，index 收敛门面（onMessage 返回 `() => void`，**P0 修复**：handlers 只增不减导致消息 N 次回调，现 onMounted 注册、onUnmounted 反注册）；constants 增 RECALL_TIME_LIMIT/TYPING_THROTTLE/TYPING_TIMEOUT；新增 `libs/style/bubble.css`（气泡壳基类）、`libs/style/textStyles.ts`、`libs/utils/quote.ts`；variables.css 增 `--em-mask-color`/`--em-chat-panel-height`；死代码清理（removeStorage、usePopup 死段、onTextMessage 废弃链、安全区 shim）；`-page` 路由契约收口（contact-requests 改 emit `back`）。
- 遗留：元素级 `__x--y` 修饰类手写串（alphabet-nav 与气泡内部）二期再收；switch `color="var(--em-primary-color)"` 与 em-badge 的 mp-weixin 真机视觉待验。

## 2026-10-15 微信小程序 SDK 分包异步化（PLAN M2.8）

详见 skill `em-mp-subpackage` 与 `docs/GUIDE-WEAPP-SDK-SUBPACKAGE.md` / `docs/SPIKE-SDK-SUBPACKAGE.md`。要点：主包 1768KB→493KB；websdk IIFE 873KB 完全移出主包；机制 = `scripts/prepare-sdk-subpackage.mjs`（构建后处理）+ `scripts/check-mp-size.mjs`（11 项防回归）+ `libs/client/sdk.ts`（全库唯一 websdk 运行时导入收口，MP 走跨分包异步 require）；`EmClient` 三阶段就绪门（init 同步 / whenReady 缓存 Promise / `EmKit.whenReady()` 透出）；`EmKitConfig.sdkLoader/sdkModule` 注入口。验证：build mp-weixin 全绿 + 开发者工具实测登录收发通。**待验**：iOS/Android 真机语法兼容与收发回归、双端互发。

## 2026-10-15 组件配置体系（M2.6）

三层混合：**全局 EmKitConfig 行为开关 + 页面组件呈现 props + 少量具名插槽**（不做 provider/inject 重构）。基建 `libs/store/config.ts`（reactive `uiConfig`，`useConfig`/`setConfig`/`applyKitConfig`/`primaryColorStyle`）；`EmKitConfig` 扩 13 项（enableDraft/enableTyping/showTime/recallTimeLimit/typingThrottle/typingTimeout/timeDividerInterval/inputFeatures/messageMenuKeys/conversationMenuKeys/emojiList/primaryColor）；primaryColor 落 `--em-primary-color`。组件透出：chat-page 增 `avatarShape` + `send`/`recall`/`delete` emits + `#custom-message`/`#empty`；conversation-page 增 `showSearch`/`emptyText` + `#empty`；contact-page 增 `menuKeys`；inputbar 改 `features`/`emojis` 双 props；video/file 消息点击上移到 chat-page（`preview`/`download` emit）；nav-bar 补 `#title`/`#action` 插槽；avatar 占位五色板提 prop。i18n 注入口 `mergeMessages(locale, table)` 透出。零行为变更落地。**待验**：菜单裁剪/feature 开关/自定义消息插槽 H5 与 mp 冒烟。同日晚 `EmMessageItem` 增 `ext`（自定义消息业务载荷唯一通道）与 `rawType` 两字段，`#custom-message` 按 `rawType` 判别渲染。

## 2026-10-15 空状态与骨架屏（M2.7）

新原子组件 `em-empty`（icon/title/description/size small|normal|large + `#default`；token `--em-empty-icon-color`/`--em-empty-text-color`）与 `em-skeleton`（variant avatar|text|paragraph、shape、rows/width/height；`--em-skeleton-line-radius: 4px`；**静态灰块，shimmer 因 ucss 禁伪元素留二期**；card variant 不实现）。会话/联系人页同步中改骨架列表（SKELETON_COUNT 6/8 + SKELETON_LINE_WIDTHS 40%/70%、35%/65%）；三页手写空态收编 em-empty（icon 随搜索态切换 search/list）；聊天页 `#empty` 补默认 em-empty（新 i18n key `chat.noMessages`）；死文案 `conversation.syncing` 删除；style-lab 加预览段。

## 2026-10-15 Android 蒸汽端两项真机修复

①多行文本气泡裁切——实为两个独立子 bug：**A 竖直裁切**根因 = `<text>` 无单位倍数行高测量不可靠，改 px 行高 23px 解决（`lines: 999` 是排查弯路已回退）；**B 行尾缺字**根因 = 含多行 text 的 `max-width: N%` 宽度链布局/绘制双重解析不一致（每行行尾约丢 1 字），负 margin/去 margin/去 word-break/overflow:visible/改 padding 全无效（探针 W1/W3/W4/W5/W7 实测），唯一有效 = **宽度链 rpx 定宽**：`.em-chat-page__content` `70%` → `480rpx`。探针工具沉淀 `demo/sub-im/pages/text-probe`（两轮对照页，spike 页入口）。②引用定位背景闪烁失效——CSS `@keyframes` 蒸汽端不跑，改 JS 定时器双脉冲（`HIGHLIGHT_PULSE_SEQ` 0/500/840/1960ms，`onUnmounted` 清计时器）。已知降级：发送中 spinner 蒸汽端静态图标，二期再议。

## 2026-10-15 聊天页滚底改 scroll-into-view 锚点（Android 蒸汽端）

症状：Android 从会话页进聊天页停在历史顶部不自动滚底，收新消息也不滚底。根因：TUIKit 式 `scroll-top` 超大值钳位技巧**只在赋值瞬间按当时内容高度钳位**——onMounted 赋值时列表未布局被钳到 0，内容渲染后不重钳（H5/mp 会重钳故旧方案仅两端有效）；引用定位的 `scroll-into-view` 同机验证可用。解法：滚底改锚点方案——列表末尾 1px 空 view（`em-chat-bottom-anchor`），`scrollToBottom()` 先清 `anchorId` 再 nextTick 赋值（同值不重触发）；进页滚底与收消息滚底共用；scroll-top 初始预置值保留无干扰。已验：Android 真机冷进入滚底 + 收消息滚底正常。**已知问题（搁置，后续优化）**：偶尔二次置底闪动——疑似 onMounted 热路径与 loadHistory.finally 两次 scrollToBottom 之间发生补偿拉取/历史合并导致列表二次变化，第一次滚底后页面已显示（ready 翻转），第二次锚点重定位形成可见跳动。后续方向：ready 展示 gate 到 finally 滚底完成之后 / 滚底去重（列表无变化不重滚）/ 二次滚底前短暂保持透明。

**待验**：rpx 定宽方案在真实聊天页的长消息（尤其己方长消息左裁场景）复测。

## 2026-10-15 软键盘手动避让（机制更正：x 端无 adjustResize/adjustPan）

真机实测 Android 蒸汽端键盘弹起把自绘 nav-bar 顶飞——根因：**uni-app x 没有经典 uni-app 的 adjustResize/adjustPan 体系，pages.json 的 `app-plus.softinputMode` 在 x 端从未生效**（鸿蒙此前「adjustPan 不回弹」的观察也基于此误解）；x 端键盘上推由 input 组件 `adjust-position`（默认 true）控制：默认策略下输入框在 scroll-view 之外时 transform 上移整个页面（input 在 scroll-view 内才只滚动容器）。落地（对齐 hello-uni-app-x `keyboard-adjust` 官方示例）：
- `em-chat-inputbar` input 置 `:adjust-position="false"`，`margin-bottom = 键盘有效高度` 手动顶起（flex column 消息区自动压缩，nav-bar 不动）；`@blur` 清零兜底部分端收起不补发 0 高度事件。
- `useKeyboardHeight`（`libs/use/useKeyboardHeight.ts`）：iOS/鸿蒙上报键盘高度**已含底部安全区须扣除**（`uni.getWindowInfo().safeAreaInsets.bottom`；Android/小程序/H5 不扣）；返回值可写（blur 清零用）；**坑：uni-app x 的 `uni.onXxx` 返回监听 id（number）、`offXxx` 按 id 反注册**（经典 uni-app 是按函数引用）。
- chat-page 键盘弹起滚底（watch 0→弹起双调 `scrollToBottom()`+nextTick）；输入栏面板高度 `max(键盘高, PANEL_MIN_HEIGHT=280)`（constants 新增，对齐 vue 版 panelHeightVar；面板默认高度 240→280，`--em-chat-panel-height` token 保留）。
- demo pages.json 的 `softinputMode` 无效配置已删除。H5 端 `adjust-position` 无效（浏览器自管），行为不变。

## 2026-10-15 mp dev 模式 SDK 分包缺失修复（踩坑二自动化）

症状：开发者工具开 `dist/dev/mp-weixin` 登录报 `module 'sub-sdk/im-sdk.js' is not defined`。根因：dev watch 全量重发产物抹掉 `sub-sdk/im-sdk.js`（build 产物有 1.26MB 文件、dev 产物仅剩 pages/），而 prepare 后处理只挂在 build 模式。落地：
- `scripts/prepare-sdk-subpackage.mjs` 增 `--watch`：立即跑一次后轮询产物 `app.json` mtime（2s 间隔、1.5s debounce），变化即重跑后处理；单轮失败只打日志不退出。覆盖逻辑 = app.json 变更 **或** `im-sdk.js` 缺失（增量重发不改 app.json 也不抹文件，两情形都兜住）。
- `scripts/uni.sh dev mp-weixin` 自动伴随 watch 进程（trap EXIT 回收）；build 分支零变更。
- HBuilderX GUI 起的 dev 仍需手动 `node scripts/prepare-sdk-subpackage.mjs demo/unpackage/dist/dev/mp-weixin --watch`。
- 验证：`build mp-weixin` 防回归 11 项全绿；CLI dev 起 watch、触发重编译后 `im-sdk.js` 仍在。

## 2026-10-15 联系人索引条重构（em-alphabet-nav 去 max-height 依赖）

症状：联系人页右侧 A-Z 索引条又窄又散（mp 开发者工具实测字母格被拉伸到 ~40px 铺满整屏）。根因：**uni 版照搬 vue 版「flex:1 + max-height: 20px 封顶」写法，编译端对 flex 子项的 max-height 不生效**，格子全部拉伸；叠加 16px 视觉宽 + 9px 字号本身偏窄。落地：
- 容器改「内容定高 + 垂直居中」：`top: 50% + transform: translateY(-50%)`（em-popup 已验证惯用法），宽 16px→**28px**（视觉=热区，不再靠 padding 扩热区），高度由组件内联 style 按 `keys.length × 22px` 给定（模板新增 `CELL_HEIGHT=22` 常量 + `navStyle` computed）——容器高 = 字母块高，触摸/视觉/滑动占比映射三者天然一致。
- 单元格去掉 flex:1/max-height/min-height，改定高 22px；字号 `--em-font-size-9`→`--em-font-size-10`；高亮仍主色底 + `--em-radius`，淡化仍 opacity 0.45；点按/滑动/事件契约零改动。
- 验证：build web + build mp-weixin 全绿（分包防回归 11 项过，主包 495KB）；H5 产物伺服 200。**待验**：mp 开发者工具与真机肉眼复核（居中紧凑 28px 宽字母块、点按/滑动定位、高亮淡化）。

## 2026-10-15 多场景易用性评估归档（零代码变更）

评估结论落 `docs/EVAL-MULTI-SCENARIO.md`：四场景（客服/医疗/招聘/二手交易，H5 移动端形态）共享「入口按钮 → 直进 1v1 聊天页」模型，底座（`em-chat-page` 单组件直引 + init/login/whenReady 链路）已可用。核心缺口（按复用度）：P0 = 发送侧 ext/sendCustom、`#banner` 插槽（3/4 场景要会话顶部固定位）、`title`/`showAction` 透出、系统提示消息（居中小灰条 + 本地插入 API）；P1 = 未读 API、快捷回复条、自定义菜单动作。继承聊天记录场景拆两路线：**路线 A**（共享身份账号单聊）今天零改动可用，客服/招聘/交易主荐；**路线 B**（群伪装单聊）完全阻塞于 M2.9，且 M2.9 之上需增补「伪装模式」（群形态 UI 全套隐藏开关 + 昵称行档位 + 成员事件灰条化 + open-info 宿主接管）——须在 M2.9 设计群形态时预留开关位。H5 边界：录音物理不支持（医疗/客服受影响）、chooseFile 可用。落地时按评估文档 §6 先改 PLAN.md 再动代码。

## 待验项汇总

| 项 | 端 | 备注 |
|---|---|---|
| 多场景 P0 端到端（sendCustom 收发/失败重发、sendText 业务 ext 对端回读、`#banner`/`title`/`showAction`、`insertLocalNotice` 灰条） | H5/mp | 需真实账号双端互发 |
| 多场景 P1 端到端（`quickReplies` fill/send 与禁言隐藏、`extraMessageMenus` 顺序/`types` 过滤/`message-menu` 回传、单会话未读入口角标与进会话清零） | H5/mp | 需真实账号；键盘弹起时快捷条占位观感一并看 |
| IM 场景实验室 6 场景（单聊/群聊进会话、详情页群选择、场景开关面板、场景卡片/提示） | H5/mp | 需真实账号；群场景需先有群 |
| 自定义卡片端到端（14 种宿主卡片双端收发/动作回传、未知 event 回落、手机号脱敏、`#custom-message` 注入） | H5/mp/App | 免登录预览页已验渲染；聊天内收发需真实账号 |
| 输入栏业务入口端到端（`#input-toolbar` 注入/开关、点胶囊 sendCustom 对端渲染、键盘弹起时跟随与两行占位） | H5/mp/App | 详情页入口条免登录已验渲染；聊天内点击需真实账号 |
| AI 流式消息端到端（真实 `onStreamMessage`：分片合并/丢片补偿/终态收敛/异常、`enableStreamMessage=false` 完整消息延迟上屏、断连重连） | H5/mp/App | 需业务服务端下发流式消息；H5 demo mock 已验渲染态 |
| 手动避让时序与高度精度（上推口径 = 上报值原值；鸿蒙已验贴合、iOS 已复现并同因修复，待 iOS 复测贴合度） | App 三真机 | Android「顶飞消解」已由用户验；鸿蒙 2026-10-21 实测贴合；iOS 2026-10-21 截图量化后修复 |
| 视频消息全端播放（点气泡拉起全屏播放器、声音输出、暂停/进度/全屏、关闭后无后台声音、切会话/退页释放、坏 URL 失败提示） | App 三真机 / mp / H5 | M2.19；**iOS 真机已验**（下载本地 + 关闭 autoplay 显式起播）；Android/鸿蒙/mp/H5 待回归；H5 自动播放被拦截时点播放键 |
| 会话页/联系人页搜索聚焦顶飞 nav-bar（同根因，fix 待从 chat-page 铺到 conversation/contact 页） | App | 已立案 |
| 聊天页「点击消息区收起输入栏」（emoji/媒体面板 + 软键盘；键盘弹起时点击不误触消息操作） | App 三真机 / mp / H5 | 需真实账号；H5 桌面端外部点击已由浏览器 blur 兜底 |
| mp-weixin `onKeyboardHeightChange` 回调与面板跟随观感 | 小程序 | |
| iOS/Android 真机 SDK 分包语法兼容与收发回归、双端互发 | App + 小程序 | |
| 菜单裁剪/feature 开关/自定义消息插槽冒烟 | H5/mp | |
| em-switch 与 em-badge mp 真机视觉 | mp | em-switch H5 明暗与交互已验（2026-11-03）；mp/App 真机待验 |
| Android 重连回归（SPIKE 记录）；iOS 端整体待验 | App | |
| iOS 真机复跑：登录成功（登录链路已不依赖 `uni-getNetworkType` 基座模块）、登录页输入框/聚焦态观感 | iOS | 2026-10-21 首次 iOS 运行暴露，已修（见文末同日条目） |
| iOS 缺 `uni-getNetworkType` 模块基座下的断网/恢复重连（网络监听降级为心跳重连） | iOS | 同上 |
| 聊天页进页偶尔「二次置底闪动」（补偿拉取触发的列表二次变化 × 两次 scrollToBottom 时序；已搁置，优化方向见上方 2026-10-15 滚底条目） | App | 功能正常，观感优化项 |
| 组头 sticky 蒸汽端实测 | App | 不生效则随列表滚动 |
| 群链路端到端（真实账号：登录 → 建群/群列表 → 群聊收发 → 公告条/@我徽标/成员昵称行） | H5/mp/App | M2.9 各 Phase 共同挂账 |
| 双角色群管理（owner/admin 成员操作矩阵、邀请入群全流程、公告编辑/改名/转让/退群解散/全员禁言禁输入） | H5/mp/真机 | |
| @ 提及全链路（@→选人→ext→高亮/徽标；蒸汽端嵌套 text 的 mention click） | H5/真机 | |
| 群系统通知上屏（建群/成员进出/改名/公告/转让）+ notice 长按菜单禁用 | H5/mp | |
| 蒸汽真机群形态视觉：成员管理覆盖层 fixed 定位与弹层叠放、角色角标、宫格五列、multiple 已选条横滚 | App 三真机 | |
| `EmContactNavEntry` 预留 `visible` 字段未加（PLAN 裁剪项「黑名单入口预留 visible 控制」），M4 黑名单落地时补 | 全端 | 非 breaking |
| 群已读回执端到端（真实群 + 多名成员：消息带 needReadReceipt、群成员回执后己方看到「N 人已读」、进会话批量补齐、关闭开关后无请求/无人数） | H5/mp/App | 需真实群与至少两名成员；单账号单设备无法构造 |
| 附件上传进度抓帧（大文件中/弱网下图片/视频蒙层与文件气泡的百分比、发送结束清空） | App/mp/H5 | 需可观测的慢上传；本轮真机上传过快未抓到 sending 帧 |
| 附件下载（M2.24：图片/视频存相册、文件下载打开、H5 浏览器下载、相册权限拒绝、小程序 downloadFile 域名） | App/mp/H5 | 需真实账号与真机；H5 需可下载的 chatfiles 直链 |

## 已验证基线（历史 SPIKE）

- H5：登录 → 会话 → 收发全通（M1 起多次回归）。
- 微信小程序（开发者工具模拟器）：登录 → 跨分包 require 加载 SDK → 收发通。
- 鸿蒙真机：登录/收发/重连实测通过（签名配置见 `docs/HARMONY-REALDEVICE-RUN.md`）。
- Android 真机：登录/收发通；键盘顶飞已修复（用户复测确认）。

## 2026-10-15 M2.9 群基础 Phase 1（数据层 + chatType 贯通）

- `libs/chat/group.ts` + `libs/store/group.ts` 落地：GroupManager 注册 + `enableSyncData` 增 `'group'`；getJoinedGroups/getGroupInfo（飞行中去重）/getGroupMemberList 游标分页/公告读写/建群/邀请/退群/解散/转让/改名/管理员/全员禁言；群事件 12 handler（成员进出/资料变更/公告/被移出/解散/邀请）「更新 store + 系统通知」双写（`insertGroupNotice` 暂空实现，Phase 5 接）。
- chatType 显式贯通：消息/会话域 16 处方法签名增必传 `chatType`（breaking，无默认值）；`EmMessageItem`/`EmConversationItem` 增字段，`mapWireChatType` 含 4.x 兼容；会话同步不再 filter 群聊；`sendReadReceipts` 群聊短路；新增 `addConversation` 本地构造（发起会话用，不调 SDK）。
- 新类型 EmGroup/EmGroupMember/CreateGroupParams/MentionContact；constants 增 GROUP_MEMBER_ROLE/`MESSAGE_EXT_KEY.MENTION='em_at_list'`/GROUP_MEMBER_GRID_COUNT=9/GROUP_MEMBER_PAGE_SIZE=20/GROUP_ANNOUNCEMENT_MAX_LENGTH=512（对齐 vue）；`libs/utils/mention.ts` 两纯函数（filterActiveMentions/parseMentions，对齐 vue）；EmKit 透出 17 个群方法 + enterGroup 预热。
- 验证：build web ✓ / build mp-weixin 11 项全绿（主包 516KB）/ H5 伺服 200。
- **过渡态挂账**：①群会话已进列表但 chat 页进入仍按 singleChat 调 SDK（Phase 2 路由贯通修复）；②群邀请写入 contact invites 但无 kind 维度，请求页对群邀请点同意会走好友语义（Phase 4 修）；③insertGroupNotice 空实现（Phase 5）；④SDK 链式 API 与事件 payload 字段名仅编译期验证，待 spike + 真机冒烟。

## 2026-10-15 M2.9 Phase 2（会话/聊天页群化 + 发起会话）

- **路由贯通**：demo `chat`/`chat-info` URL 增 `chatType`，三处贯通（conversation→chat→chat-info）；`em-chat-page`/`em-chat-info-page` 增必传 `chatType` prop（breaking）。过渡态 Important #1 已修。
- **会话列表群化**：群名回落 `groupDisplayNameOf` > conversation.name > groupId；`@我` 徽标全链路（onMessage 群消息查 `ext.em_at_list` → `atMeByConversationId` → `hasAtMe` prop → 进会话清除；前缀主色+medium、名字 is-at-me 高亮，对齐 vue；@ 字形图标因 iconfont 无字形挂账）；长按菜单群会话可用。
- **聊天页群形态**（三元素独立 props 默认显示，伪装模式预留位）：`showMemberCount`（群名+人数副标题，typing 仅单聊）、`senderNameMode('always'|'hidden')`（气泡昵称行，回落：群成员名片 > userStore > userId）、`showAnnouncement`（公告条：单行省略+展开弹层，读 `announcementByGroupId`）；群聊不发 typing、不显示已读回执。
- **发起会话**：新原子组件 `em-select-contact`（single 模式：props items/show，emits select/update:show，半屏弹层+搜索+空态，不连 store）；会话页「+」菜单增 `new-chat`/`create-group`（create-group 暂 toast 占位，Phase 4 落地）；选人 → 拒绝自己 → `addConversation` 本地构造 → 跳聊天。
- 验证：build web ✓ / build mp-weixin 11 项全绿（主包 534KB）/ H5 伺服 200（评审员独立复跑确认）。**待验**：群链路运行时端到端（需真实账号 H5+真机冒烟）。

## 2026-10-15 M2.9 Phase 3（@ 提及全链路）

- 新原子组件 `em-mention-picker`（契约照抄 vue：props show/contacts/keyword/title，emits update:show/select；底部半屏 + 搜索过滤 + 成员 Cell + 空态；去 PC 锚定/键盘导航；空态图标 search 代 at——字体无字形挂账）。
- 触发：inputbar watch 草稿尾部插入 `@` → `mention-trigger`（仅群聊，chat-page `enableMention` prop 默认 true，伪装预留位）；选人 `lastIndexOf('@')` 截断后追加 `@名字 `（修复评审发现的 keyword 残留致 ext 丢失缺陷）；发送前 `filterActiveMentions` 过滤挂 `ext.em_at_list`，重发从 ext 还原。
- 高亮：em-text-message ext 分片渲染，`--em-mention-color: #33B1FF` 明暗两块（对齐 vue 主色值），己方气泡 `--mention-self` 变体；@ 片段点击 `mention-click` 透传。
- 已知限制：群成员昵称含空格时高亮只到首个空格（vue 同限制）；蒸汽端嵌套 text 的 click 待真机。**待验**：真实账号「@ → 选人 → ext → 高亮/徽标」端到端冒烟。

## 2026-10-16 M2.9 Phase 4a（群列表页 + 选人 multiple + 建群）

- 新原子组件 `em-load-more`（三态 loading/noMore/button + `load` emit；消费契约 scrolltolower + hasMore&&!loading 锁写入组件注释）。
- `em-select-contact` 扩 multiple 模式（`selectMode`/`disabledIds` props：自绘 checkbox、已选区横滚可移除、`confirm(userIds)`、字母分组+索引条；single 零回归）。
- 新页面级组件 `em-group-page`（nav-bar + 搜索过滤 + 骨架/空态 + store 驱动；内置建群弹层：群名必填 + public/allowInvites 开关 + createGroup → addConversation + toast；底部 em-load-more 契约预留 hasMore=false）。
- demo：`sub-im/pages/group/group.uvue` 薄包装（click-group → chat?chatType=groupChat）；会话页 create-group 菜单 → 跳群列表页；占位 key `conversation.createGroupComing` 已删。
- 验证：build web ✓ / build mp-weixin 11 项全绿（主包 575KB）/ H5 伺服 200。**待验**：建群/群列表运行时端到端；multiple 已选条横滚 mp 真机。

## 2026-10-16 M2.9 Phase 4b（联系人页入口化重构 + 群邀请 kind 分化，breaking）

- `EmContactInvite` 增 `kind('contact'|'group')` + `groupId`/`groupName`；旧持久化数据 loadInvites 兜底 contact；群邀请接受/拒绝走 `acceptInvitation`/`rejectInvitation`（websdk 5.1.3 实名，与 vue 同口径）+ 状态回写 + getJoinedGroups 刷新；`removeInviteByFrom` 收窄只清 contact kind；`onContactAgreed` 补 kind 过滤（修复存量误置同人群邀请缺陷）。
- 新原子组件 `em-contact-nav`（entries/entry-click 契约对齐 vue ContactNavEntry 子集）。
- `em-contact-page` 重构为**入口页**（breaking）：标题 + 搜索只过滤入口项 + 三入口（新请求红点计数/群组计数/好友列表计数），emits `entry-click` + `add`；好友列表全部移出。
- 新页面级组件 `em-contact-list-page`：好友列表零回归平移（分组/索引/搜索/menuKeys 长按删除/骨架空态），emits select/back。
- demo：`sub-im/pages/contact-list` 注册；contact.uvue 三入口分发（notice→contact-requests、group→group、contact→contact-list）。
- 验证：build web ✓ / build mp-weixin 11 项全绿（主包 590KB）/ H5 伺服 200。**待验**：三入口跳转、群邀请接受入群全链路、群邀请事件真机载荷字段。

## 2026-10-16 M2.9 Phase 5a（chat-info 群分支 + 全员禁言禁输入）

- 新内聚子组件 `em-group-info-blocks`（纯展示）+ `em-group-field-dialog`（页面根级弹层）：成员宫格（9 格=成员角色排序+邀请/更多占位格，emit invite/open-members 待 Task 9 接真）、群名 owner 可编辑（乐观更新失败回滚，maxlength=255）、群公告查看/编辑（owner/admin，x/512 计数，对齐 vue 权限与上限）。
- 退群（成员）/解散（owner）红色区：二次确认 → leaveGroup/destroyGroup（domain 清 6 项群缓存）→ 复用删除会话链路（消息/游标/atMe 复位）→ emit `leaved`，demo 返回会话列表。
- 全员禁言：群聊 + `group.mute` + 非 owner/admin → inputbar 禁用（placeholder「全员禁言中」+ guardDisabled 拦截发送/面板/语音 + toast）；mute 事件实时回写响应式生效；owner/admin 豁免。
- 伪装预留：宫格/群名/公告三区块独立 props（showMemberGrid/showGroupName/showAnnouncement，默认显示）。
- 单聊分支零回归。验证：build web ✓ / build mp-weixin 11 项全绿（主包 621KB）/ H5 伺服 200。**待验**：群分支端到端（双角色真实账号）、宫格五列蒸汽真机视觉。

## 2026-10-16 M2.9 Phase 5b（成员管理 + 邀请接真 + 群系统通知）与 Phase 6 收尾

- **成员管理视图** `em-group-members-view`（chat-info 页内全屏覆盖层，z-index 1000 低于弹层基准 2000）：角色排序列表（owner 蓝/admin 橙角标）+ 搜索 + 按钮式游标翻页（em-load-more button 态，domain 回写 store 游标/hasMore）+ 成员操作 action-sheet（权限矩阵对齐 vue 裁剪：任意角色私聊 / owner 设撤管理员·转让·移出 / admin 移出；转让/移出 uni.showModal 二次确认）；首屏 `getGroupMemberList` 兜底。
- **邀请入群接真**：chat-info 根级挂 `em-select-contact`（multiple，disabledIds=在群成员）→ `inviteUsersToGroup` → 成功 toast + 重拉首屏兜底（事件计数增量）；`invite`/`open-members` 保留纯通知 emit，demo 零接线。成员私聊新增 `chat-member` emit，demo 接线 addConversation 跳单聊。
- **群系统通知**：`MESSAGE_TYPE.NOTICE='notice'` 一等本地类型（id 恒空串跳过去重/回执、localId 唯一、不发服务端、loadHistory 合并保留）；`insertGroupNotice` 落六类消费点——建群（em-group-page 成功链路）/成员加入（含多成员「等 N 人」）/成员退出/群名变更（仅实际变化时）/公告变更/转让群主；管理员变更/全员禁言/被移出/解散不插（后两者随清会话即擦除，语义裁剪）。聊天页 NOTICE 居中灰条 chip 渲染（复用撤回条形态，560rpx 定宽规避蒸汽端 % max-width 坑），长按菜单对 notice 禁用。
- **Phase 6 评审 minor 扫尾**：conversation-item props 注释「红色前缀」→主色；死 i18n key `chat.announcementBanner.expand/collapse` 删除；spike 页 `loginAt===0` 守卫（同步先于 login resolve 不输出垃圾耗时）；成员操作「移出群聊」去 danger（vue 设计稿警示色从严，红色区仅退群/解散）；透出契约表补 `hasAtMe`。i18n 全量核查：zh/en key 集一致（199 个），模板无硬编码中文。
- 验证：build web ✓ / build mp-weixin 11 项全绿（**主包 642KB** ≤ 1.5MB，分包 1234KB）/ H5 伺服 200。**待验**：群链路端到端与双角色群管理真实账号冒烟（汇总表新增五行）。

## 2026-10-16 H5 视觉/交互按 vue 权威口径整改（用户红框四项）

- **通讯录入口计数**：`em-contact-nav` 删右侧红色数字徽标，计数内联进标题（`entryText` 对齐 vue `entryTitle`：「群组列表 (30)」）；hot 红点保留（仅新请求）；`contact.entryGroup` 文案「群组」→「群组列表」（对齐 vue zh-CN）。
- **chat-info 成员宫格**：「邀请(+)」「更多(···)」两格 → vue 口径「添加(+)」「移除(−)」+ 宫格下方通栏「查看全部 ⌄」；`GROUP_MEMBER_GRID_COUNT` 9→8（对齐 vue displayedMembers）；权限门控（添加 = owner/admin 或 `allowInvites`，移除 = 仅 owner/admin）；移除闭环复用 `em-select-contact`（候选=排除自己与群主的成员）→ `EmKit.removeGroupMembers` 批量接口；新增 i18n `chat.info.add`/`chat.info.checkAll`/`group.memberList.remove`/`group.memberRemoveSuccess/Failed`（zh/en 同步）。
- **双 header 修复**：`demo/pages.json` chat-info 补 `navigationStyle:custom` + `titleNView:false`（同分包其余页既有配置，此页漏配）；`em-chat-info-page` 顶部加 `em-nav-bar`（back 透出，demo 接线 navigateBack，与 contact-list 同约定）；`em-group-members-view` 自绘 header 换 `em-nav-bar`（胶囊/状态栏避让内置），旧 header 样式删除。
- **字母索引条**：`em-alphabet-nav` 定高 27×22px 居中 → 撑满列表区、字母格 flex:1 等比（封顶 20px、9px/500、视觉 16px/热区 24px content-box padding + background-clip，对齐 vue contact-alphabet-nav；max-height 蒸汽端不生效时退化为等比撑满，无裁剪）。已选头像 × 角标与 vue 同构，未动。
- 验证：build web ✓ / build mp-weixin 11 项全绿（主包 644KB ≤ 1.5MB）/ H5 伺服 200。**待验**：四屏真实账号视觉回归（通讯录内联计数、宫格添加/移除/查看全部、成员视图单 header、建群字母条密度与 × 角标）。

## 2026-10-16 创建群组面板按 vue mobileFullscreen 复刻（二次整改）

- **分组头居中 bug**：`em-select-contact__group-header` 缺 `flex-direction: row`，uvue/mp 端 view 默认 column 致 `align-items:center` 把字母水平居中（用户截图 L/P/W 居中即此）；已补并注释防回退（em-contact-list-page 同位置本就有 row）。
- **multiple 全屏化**：选人弹层 multiple 模式 80% 半屏 → 窗口全高（对齐 vue contact-transfer-modal 的 mobileFullscreen；列表区过矮曾是 27 个字母挤成一团的根因）；`em-popup` 新增 `fullscreen` prop（面板去顶部圆角），sheet 同步去圆角；single 模式 0.6 半屏不变。
- **搜索框位置**：multiple 下搜索从头部下移到 panel-top 之下、紧贴列表（对齐 vue 视觉序：strip → 表单 → 搜索 → 列表）；single 不变。
- **胶囊避让**：multiple 全屏时头部 × 关闭键在 MP-WEIXIN 端按 em-nav-bar 同公式右移避让胶囊。
- **字母条单元格**：回退 content-box/background-clip 写法（蒸汽端不支持时内容盒 8px 会裁 9px 字母），单元格定宽 24px、active 高亮块覆盖整格（与原 28px 高亮口径一致）。
- 验证：build web ✓ / build mp-weixin 11 项全绿（主包 645KB）/ H5 伺服 200。**待验**：建群面板全屏形态、分组头左对齐、字母条密度三端真机/模拟器视觉。

## 2026-10-16 建群/成员列表入口三连问对齐 vue（三次整改）

- **成员列表入口**：`em-group-info-blocks` 宫格区补假搜索框（常驻，36px/圆角 999/`--em-bg-hover`，对齐 vue `chat-info-drawer__fake-search`），点击进成员管理视图；与「查看全部」（>8 人时）构成双入口，修复 ≤8 人群无成员管理入口的缺口。
- **建群后进聊天页**：`em-group-page` 建群成功新增 `created` emit（对齐 vue `selectConversation` 语义），demo group.uvue 复用 `onClickGroup` 接线（预热 + 跳聊天页）。
- **建群面板配置门控（对齐 vue create-group-modal config 默认值）**：新增 `showNameInput`/`showSettings` props（均默认 false）——默认面板 = 纯选人 + 自动群名（前 3 名成员昵称「、」拼接、>3 补「...」，新增 i18n `group.createDefaultName`「群聊」），公开群/允许成员邀请开关与群名输入框仅宿主显式开启才显示；群名不再必填（空值回落自动群名，对齐 vue finalName）。vue 设置区的入群需审批/被邀请人需确认/最大成员数属一期裁剪未实现。
- 验证：build web ✓ / build mp-weixin 11 项全绿 / H5 伺服 200（上一轮已验，本轮构建产物同链路）。**待验**：假搜索框入口、建群直跳聊天页、默认无开关的建群面板三端视觉。

## 2026-10-16 新建群群列表置顶（产品决策，偏离 vue 口径）

- 事实核查：vue 原版 `store.addGroup` 同样 push 到群列表**末尾**（group-list 默认 `sortBy:'none'` 保持 store 顺序），「新群排最下」与原 uikit 一致，非实现偏差；vue 建群后直跳聊天页弱化了该感知。
- 按用户明确期望改为置顶：`upsertGroup(group, toFront?)` 新增第二参（默认 false 保持 vue push 语义），`chat/group.ts createGroup` 传 `toFront: true`（unshift 头部）。
- 已知边界：`getJoinedGroups` 全量刷新后列表顺序以 SDK 返回为准（EmGroup 无时间戳字段，无法持久按创建时间排序），置顶仅保证本地创建当次回显。
- 验证：build web ✓ / build mp-weixin 11 项全绿。**待验**：建群后回群列表确认新群在顶部。

## 2026-10-16 四屏视觉对齐 vue demo 整改（会话 tab / 卡片化 / 图标补字形）

- **范围依据**：用户提供的 mp 真机截图 vs 本机 vue uikit demo 截图四屏对照（会话列表/通讯录/好友列表/群组列表）。`PLAN.md` 会话页清单已补「筛选 tab」范围项（纯 UI+本地过滤、数据零新增）。
- **会话筛选 tab（新）**：新原子组件 `em-conversation-tabs`（胶囊 13px/bg-secondary/active 主色+bg-active，对齐 vue conversation-tabs，可横滑无翻页箭头）；`CONVERSATION_TAB_KEY` + `DEFAULT_CONVERSATION_TABS` 入 constants；i18n 增 tabAll/tabUnread/tabAtMe/tabSingle/tabGroup + 分 tab 空态 emptyUnread/emptyAtMe/emptySingle/emptyGroup（zh/en 与 vue 同文案）；`em-conversation-page` 新增 `tabs` prop（默认五项，空数组隐藏）+ activeTab 内部状态 + 四维过滤（unread/atMe/single/group，store 数据零改动）。
- **列表统一卡片口径（对齐 vue cell card 变体）**：会话/好友/群/通讯录入口四列表全部去 hairline 分隔线，改 白底圆角 8px + 项间距 4px + 容器 padding 4px；条目行高 64、内容 padding 8/12；会话置顶整项 `--em-bg-hover` 灰底；群 item 成员数改 11px secondary；好友列表底部补 `em-load-more`「没有更多了」footer。
- **通讯录首页**：入口顺序改 contact/group/notice（对齐 vue entryOrder，黑名单维持二期裁剪）；`EmContactNavEntry.icon` 改可选（缺省不渲染左图标，对齐 vue 默认）；`em-contact-page` 不再硬编码图标。
- **mp 宿主类失效清理**：`em-conversation-item`（__flag/__unread）、`em-contact-nav`（__icon/__dot）改普通 view 包裹（父组件 class 打 virtualHost 子组件在 mp 静默失效，坑集 #8a）；`em-search-bar__icon` 删冗余 color。
- **图标补字形（pin/bell-slash）**：`scripts/patch-icons.py`（Remix Icon Apache-2.0，subset+官方 Merger+码点重映射，幂等）合并 U+E700 pin / U+E701 bell-slash；`em-icons.ts` 补映射；会话 item 置顶/免打扰与长按菜单换用新字形（原 top/eye-slash 代偿与过时注释清除）。
- **mp 字体缓存坑（根因定案）**：合并字形后模拟器恒渲染旧字体（旧字形正常、新字形 blank），改 post 表/官方 Merger 重打包/重启开发者工具均无效，H5 Chromium 同字体正常——微信 mp @font-face 按**族名**持久缓存。定案：族名带版本号 `em-icons-v2`，**每次改 ttf 必须递增**（坑集 #8b + em-icon-strategy skill 已落纪律）。
- 验证：build web ✓ / build mp-weixin 11 项全绿（主包 652KB ≤ 1.5MB）/ H5 伺服 200；H5 真实账号四屏截图复核全对（tab 过滤正确、置顶灰底+pin+bell-slash、通讯录顺序、群卡片）；mp 模拟器四屏复核全对（族名升版后 pin/bell-slash 渲染正常、好友列表 footer、旧红框两处空白均消失；pfh 会话实为群聊属正常数据）。
- **待验/遗留**：① em-alphabet-nav active 高亮色（vue 源码=主色块，demo 截图似深色块）未与 vue demo 实机并排核对；② 群 item 是否有 1px 描边（demo 截图似有）同待核对；③ H5 端联系人同步为 0（群组 33 正常，mp 联系人 5 正常）疑似存量 H5 数据层问题，与本轮无关，待查；④ 蒸汽 App 端四屏回归未做。

## 2026-10-16 修复：Android 刘海屏遮挡全屏弹层顶部（建群页标题入状态栏）

症状：Android 真机（刘海屏）从会话页「+」进创建群组，「创建群组」标题与关闭 × 与系统状态栏同一行、被刘海遮挡。根因：`em-select-contact` multiple 走 `em-popup` 的 **fullscreen** 形态全屏贴屏顶，而 `em-popup` 的 `panelStyle` 只处理底部 `padding-bottom`（Home 指示条），**顶部安全区从未处理**；页面级路径（`em-nav-bar`）早已有 `padding-top: getSafeAreaTop()`，弹层路径漏了。`em-select-contact` 是全库唯一 `:fullscreen` 使用方。落地：
- `em-popup.vue`：`panelStyle` 重构——bottom 位统一拼装；`fullscreen` 时追加 `padding-top: getSafeAreaTop()`（>0 才加），底部 safeArea 逻辑不变。
- `em-select-contact.vue`：multiple 全屏 sheet 高度 `windowHeight` → `windowHeight - getSafeAreaTop()`（panel 新增 top padding 后不扣会把底部确认键顶出屏）；single 半屏不变。
- 坑集 skill 蒸汽端新增条目（全屏弹层顶部安全区口径）。官方文档佐证：app-android `safeAreaInsets.top` 自 HBuilderX 4.25 起返回状态栏高度，读法本身没错。
- 验证：build web ✓ / build mp-weixin 11 项全绿 / H5 伺服 200。**待验**：Android 刘海真机复测建群页标题与确认键位置；顺带抽查聊天页/会话页导航栏在 Android 上未受影响（若 `getSafeAreaTop()` 在 Android 蒸汽端返回 0，需另起 spike 修 `useSafeArea.ts`）。

## 2026-10-16 修复：建群选人弹层关窗后已选/搜索词不重置

根因：重置逻辑挂在 `onPopupVisible`（em-popup 的 `update:visible`，仅遮罩点击触发）；× 按钮与建群成功宿主关窗（`createVisible=false`）两条路径直接改 `show` prop，绕过重置，而弹层组件随页面存活（ref 状态不销毁），下次打开残留上次人选。解法：`em-select-contact` 改 `watch(() => props.show)` 置 false 时统一重置 `keyword`/`selectedIds`，三条关窗路径全覆盖。验证：build web + mp-weixin 11 项全绿。

## 2026-10-16 弹层状态重置全量审计（同类问题排查）

对全库弹层/有内部状态组件排查「关窗重置挂错钩子」同类问题，结论与落地：
- **em-mention-picker**：同款模式（searchText 重置挂在 `update:visible`，仅遮罩点击触发），当前被父级 `mentionKeyword` computed（关窗即置 ''）掩盖未暴露；已对齐 `watch(props.show)` 统一重置，去掉对父级行为的隐式依赖。
- **em-popup 竞态（真 bug）**：关窗 260ms 后摘 DOM 的 `setTimeout` 未取消——260ms 内快速重开，stale 定时器会把已打开的弹层摘掉。已加 `hideTimer`（clearTimeout + `!props.visible` 双保险）。
- **em-select-contact**：关窗重置补 `activeKey` 清零（重开索引条高亮回落首组，语义同冷启动）。
- 无问题：em-group-field-dialog（nameInput 打开回显 / announcementEditing 关窗复位均走 watch）；em-action-sheet（无内部状态）；em-conversation-page / em-chat-page / em-group-page 宿主侧状态均有显式重置路径。

## 2026-10-16 正式图标库接入：build-icons.py 全量构建 em-icons 字体（287 字形）

占位字体（DCloud uni-icons + Remix 补丁）替换为 vue 版 uikit 权威图标库全量字形。落地：
- **新脚本 `scripts/build-icons.py`**（依赖 `.venv-icons`：fonttools/svgpathtools/skia-python，.gitignore 已含）：扫描 vue 仓库 `packages/uikit-core/src/assets/icons-v2`（sibling 路径，可 `--icons` 覆盖）→ 9 个描边图标经 skia `Paint.getFillPath` 转填充轮廓（round cap/join，栅格 IoU 全 1.0）→ 2 个非 24 画布（list/bullet 17×15、filled/circle/checked 20×20）等比缩放居中 → 三次贝塞尔 cu2qu 转二次 → FontBuilder 打包私用区 U+E000–U+E11E，59KB。
- **命名**：规范名 = 路径拍平 kebab（`filled/` → `-filled` 后缀，`_` 统一转 `-`）；`em-icons.ts` 由脚本全量生成（420 键 = 287 规范 + 133 旧版 uni-icons 别名；与规范名同键的旧名不重复输出），存量业务与外部接入者零改动。34 个在用的旧名全部有映射；36 个语义弱匹配别名（cart→rects、flag→pin-fill、heart→flower 等，多为未使用键）已在构建报告单列，待设计师/业务复核后可改 ALIASES 表重跑。
- **族名升版**：`em-icon.css` `em-icons-v2` → `em-icons-v3`（mp 按族名持久缓存，改 ttf 必升版）。
- **skill 更新**：`em-icon-strategy` 正式字体流程改为 build-icons.py 全量重建（幂等，--dry-run 只校验）；patch-icons.py 降级为补单个临时字形用。
- 验证：字形抽检 31/31 与源 SVG 栅格 IoU=1.0；build web ✓ / build mp-weixin 11 项全绿（主包 673KB ≤1.5MB）/ H5 伺服 200。**待验**：mp 模拟器与 H5 实际渲染走查一轮常用图标（聊天页输入栏 mic/compose/plus、会话 item pin/bell-slash、消息状态等）；弱匹配别名清单复核。

## 2026-10-20 图标字体排查工具：verify-icons.py（mp「图标全不显示」分诊）

新增 `scripts/verify-icons.py`（零侵入，只读）：一次检查 6 类导致 mp 端 blank 的成因 —— ①空字形(numberOfContours==0) ②`em-icons.ts`↔cmap 双向覆盖 ③`em-icon.css` 内联 base64 与 `em-icons.ttf` 的 md5 是否同一份（**码点位移 + 只更新一半 = 整片 blank，最常见**）④族名版本号存在性 ⑤css 体积（>200KB 警戒）⑥几何异常（越界 / advance=0 / 整片字形脱离 em box= y 翻转写错，mp 会整块裁掉）。退出码 0/1，可直接进 `uni.sh` 门禁。
当前基线跑通：ttf 85.9KB / 450 字形 / 287 码点 + 133 别名 / inline md5 一致 / `em-icons-v10`。两条 WARN 挂账：①基础字体残留 166 个未映射私用区码点（体积浪费，可裁）②`hhea.descent=0` 且存在负 y 字形（head.yMin=-113），mp `text` 固定宽高时会裁掉下探部分——待真机确认是否有图标底部缺角。

## 2026-10-20 P0/P1 缺陷修复（H5 运行时回归 + 数据正确性）

- **P0 H5 聊天页白屏**：`useKeyboardHeight` 在 H5 调用不存在的 `uni.onKeyboardHeightChange`（uni-app x H5 运行时未实现，编译器留成裸 `uni.*`，H5 的 `window.uni` 只有统计 `report`），`em-chat-page`/`em-chat-inputbar` setup 直接抛错、整页挂载失败。改为 `#ifndef WEB` 才注册监听；App/小程序逻辑不变。验证：H5 产物全部 chunk 中 `onKeyboardHeightChange` 出现 **0 次**；临时 mock 页（未登录、塞两条消息）实测聊天页成功挂载（`.em-chat-page`/`.em-chat-inputbar` 存在、气泡渲染），仅剩预期的 `loadHistory: call EmKit.init() first` 日志。
- **P1 H5 长按与点击冲突**：新增 `libs/use/useLongPressClickGuard.ts`（touchstart 记时，click 时按住 ≥350ms 视为长按抬手并吞掉）。接入会话条目、好友列表行、图片/语音/视频/文件气泡；长按菜单不再连带进入会话、打开预览或开始播放。桌面鼠标/键盘 click 无 touchstart，不受影响。
- **P1 好友申请页返回键**：补 `defineEmits<{ (e: 'back'): void }>()`（模板原先引用了未定义的 `emit`，点击会 TypeError）。
- **P1 媒体失败重发**：`resendMessage` 按类型重建（图片/语音/视频/文件），远端 URL 走 `originalUrl`，本地临时文件缺失时明确抛错而不是退化成空文本；H5 失败消息把原始 `File` 留在内存供重发；`sendVideo` 对 H5 `blob:` URL 转 `File` 后再交给 SDK，修复 H5 视频发送的输入类型。
- **P1 登出账号隔离**：`EmKit.logout` 现在清 conversation/message/contact/group/user/draft（含持久化的邀请与草稿）以及域内 typing 计时器/失败 File 缓存；历史加载增加 sessionEpoch，登出后返回的旧请求直接丢弃。修复同设备换账号串上一账号数据的问题。
- **P1 发送失败反馈**：聊天页文本/图片/视频/文件/语音/重发失败统一 toast `message.send.failed`；用户取消选图不再误报。
- **H5 语音入口**：H5 暂隐藏麦克风（录音尚未接 MediaRecorder，`platform.startRecord` 在 H5 直接抛错），App/小程序保持 `inputFeatures.voice` 语义。
- **P2**：发送成功后回写图片/视频 body 宽高与缩略图（自发送图片不再固定 120×160）；引用快照增 `fromName`（输入栏引用条不再显示 userId，老数据回落）；`em-text` 两行折叠补 `max-height: 36px` 兜底（H5/小程序不认 `lines`）；会话列表热路径去掉整份 payload 深拷贝；`loadHistory` 飞行中去重（预热与聊天页 mount 并发不再重复拉页）。
- 验证：`build web` ✓ / `build mp-weixin` 11 项防回归全绿（主包 734KB、分包 1283KB）/ H5 产物伺服 200。**待验（需真实账号）**：H5 长按菜单、媒体失败重发、H5 视频发送、换账号隔离；视频内联播放/文件下载/链接识别仍是一期未落地项，本轮未动。

## 2026-10-20 图标 1:1 对齐 vue icons-v2（组件调用点全面收口）

字体本体此前已由 `build-icons.py` 全量收录 vue `icons-v2` 287 字形，但组件内部大量沿用旧版 uni-icons 别名（`close`/`compose`/`more`/`sound`/`image`/`videocam`/`checkmarkempty`/`info-filled`/`spinner-cycle`/`chatbubble`/`personadd` 等），其中 36 个是「语义最近」弱匹配，导致同一功能在 vue 与本项目显示不同字形。本轮按 vue 对应组件逐个对齐调用点，别名只留给外部接入者：
- **输入栏 ↔ vue h5-input / simple-input / quote-bar**：语音=mic（去掉 compose）、表情=circle-face（替换 😀 文本）、更多=circle-plus、更多面板=rect-img/camera/video/folder；引用条类型图标=file-img/file-video/mic/doc/circle-quote（文本也带 circle-quote，size 14），引用关闭=circle-xmark 18（不是弹层通用的 xmark-bold）。
- **消息状态 ↔ vue message-bubble-wrapper**：发送中=loading-arc-normal、失败=circle-bang、单聊已读/未读=circle-checked / circle-empty-1（原 checkmarkempty/circle 代偿）。
- **长按菜单 ↔ vue message-interactive**：复制=rects、引用=arrow-turn-left、撤回=arrow-lft-uturn、删除=trash；action-sheet 图标尺寸 20→16（对齐 vue list 项）。
- **会话条目/菜单 ↔ vue conversation-item/list**：置顶/免打扰徽标=filled 版 pin-filled / bell-slash-filled；右键菜单按状态切 pin-slash↔pin、bell↔bell-slash；新建会话=bubble-rect-empty、建群=person-double；空态=list-bullet。
- **输入气泡 ↔ vue voice-message / video-message / file-message**：语音空闲=triangle 22、播放态=3 根 6/10/6 波柱（无动画）；视频播放覆盖层=triangle 20 白色（删掉 border 手绘三角与 videocam 占位）；文件类型图标逐项=file-pdf/file-xls/doc/file-ppt/file-md/file-img/file-video/file-audio/file-empty。
- **会话/通讯录/群组页 ↔ vue address-book / chat-info-drawer / group-member-list**：header 动作=vertical（聊天详情）/person-plus（加好友）/circle-plus（会话、群组）；通讯录右箭头=chevron-right、返回=chevron-left；群成员更多=vertical 16，成员菜单=bubble-circle/shield-person/person-arrows/person-minus；群资料编辑=rect-notched-pen 22、查看全部=chevron-down 16；空态=person-single/person-double/bubble-rect-2/list-bullet/at（@提及）。
- **会话条目补图标**：@我=名字前 at 14px 主色、草稿=rect-pencil 14px 警示色（此前只留文本前缀，status 里挂账的「@ 字形缺失」随正式字体解决）；通讯录申请页「对方已拒绝」头像位=dspntd 48px 白底圆（对齐 vue contact-notice-list）。
- **多选 ↔ vue EmCheckbox**：选人弹层 checkbox 从「自绘圆框 + checkmarkempty」改为 circle-checked-filled（主色）/ circle-empty（弱化灰），容器不再画描边底色；关闭/移除=xmark-bold。
- **新增 `scripts/check-icon-parity.py`**：校验 287 个 vue SVG 均有同名规范键、420 键均有 ttf 字形、组件/demo 字面量图标名全部存在，内部再用旧别名即 WARN（退出码 0/1）。当前输出 `OK 全部一致`（420 键 = 287 规范 + 133 别名）。
- **demo/style-lab**：图标走查列表与 em-empty 示例改用规范键（chevron-left/rect-img/plane/bubble-rect-2 等），去掉“占位字体”过时文案。
- 验证：`check-icon-parity.py` ✓（287/287）；`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 736KB / 分包 1283KB）；H5 产物伺服 200；另生成 287 字形 SVG↔字体双列对照图人工走查（描边转曲仅字重轻微差异，轮廓与源 SVG 一致）。**待验**：H5/小程序真机逐屏对照（输入栏、状态列、会话徽标、成员菜单、选人 checkbox）。

## 2026-10-20 修复：会话免打扰 icon 回列表后消失（本地状态被会话快照重置）

症状：会话已标记免打扰，列表条目偶尔不显示 bell-slash-filled；进入聊天页再返回后必现消失，但免打扰实际仍生效。

根因（非 Vue 响应式问题）：会话列表同步协议不携带免打扰字段，SDK `ConversationItem.remindType` 在快照中恒为 `DEFAULT`（群会话仅 joined-group 同步可能带入）。原 `toConversationItem` 直接 `isMuted: c.remindType === 'NONE'`，因此每次会话列表重建都会把本地已标记的 `isMuted` 抹成 false；进入聊天页时 `enterConversation` → `clearConversationUnreadMessageCount` 会触发 `onConversationListUpdate(reason='local')`，返回列表时 demo `onShow` 又调 `syncConversations`，两条路径都会触发重建，所以「进聊天页才正常、回会话就丢」。

落地（对齐 vue `uikit-sdk-websdk5` 的 `patchConversationMuteStates` / `mergeWithExistingConversations`）：
- `libs/chat/conversation.ts`：`toConversationItem` 已有会话保留本地 `isMuted`（新会话才用快照兜底）；新增 `syncConversationMuteStates()` 走 `PushManager.getConversationSilentModes` 批量权威校正（单次 ≤20，`CONVERSATION_SILENT_MODE_BATCH_SIZE`；`DURATION` 规则按 `expireTimestamp` 未过期判定），`syncConversations` 与「服务端会话同步/基线重置」后异步触发；`setConversationMuted` 改乐观回写 + 失败回滚。
- `libs/chat/index.ts`：绑定 ChatClient 级 `onMultiDeviceConversation`，处理 `CONVERSATION_MUTE_INFO_CHANGED`，其他端切免打扰实时回写。
- `libs/constants/index.ts`：新增批量查询上限常量。
- 验证：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 738KB / 分包 1283KB）；H5 产物伺服 200。**待验（需真实账号）**：单聊/群聊标记免打扰 → 进聊天 → 返回列表 icon 保持；杀进程冷启动后 icon 回显；A 端切免打扰 B 端实时同步。

## 2026-10-20 修复：进入会话后置顶会话顺序被打乱

症状：有 2 个置顶会话时，点击进入其中一个再返回，置顶区间内的先后顺序会变；置顶时间/最后消息都没变。

根因：列表页直接按 SDK `conversationStore.items` 的快照顺序渲染，自身没有排序。SDK 的快照顺序会被 `lastAccess`、资料刷新（`updatedAt`）、未读清零等非「最后消息」因素带动（其会话排序在 `pinnedTimestamp` 缺失/相等时回落到 `lastMessageAt ?? updatedAt`），进入会话恰好会触发 `setCurrentConversation` / `clearConversationUnreadMessageCount` / `ensureUserInfos`，于是置顶区间重排。vue 版不直接使用 SDK 顺序，而是 `sortedConversationList` 显式排序。

落地：
- `libs/types/index.ts`：`EmConversationItem` 增 `pinnedTime`（毫秒，未置顶 0）。
- `libs/chat/conversation.ts`：`toConversationItem` 映射 `pinnedTimestamp`（缺失沿用前值，置顶状态缺失也不回退）；`pinConversation` 取 SDK 返回的 `pinnedTime` 回写，取消置顶清零；`addConversation` 初始化 0。
- `components/pages/em-conversation-page/em-conversation-page.vue`：列表 computed 末尾显式排序——置顶优先、置顶区间按 `pinnedTime` 倒序（无置顶时间回落 `lastMessageTime`），非置顶按 `lastMessageTime` 倒序；`sort` 稳定，同时间保持原相对顺序。进入会话/新消息都不会改变置顶区间顺序，只有重新置顶/取消置顶才变。
- 验证：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 738KB / 分包 1283KB）；H5 产物伺服 200。**待验（需真实账号）**：2 个置顶会话反复进出顺序稳定；置顶/取消置顶后顺序按操作时间正确；非置顶会话仍按最后消息时间排。

## 2026-10-20 语音播放态波形跳动（效果补齐）

- 症状：语音气泡点击播放后，三根波形柱是静止的（组件已有 wave 结构，柱高固定 6/10/6）。
- 落地：`em-audio-message` 播放态改为 4 帧高度序列（4/9/6 → 9/5/10 → 6/10/5 → 10/6/8），**180ms/帧 JS `setInterval` 驱动**（蒸汽端不跑 CSS `@keyframes`，同引用定位脉冲口径）；柱高走内联 style，柱间改用 BEM `--wave-bar-gap` 修饰类；播放态整体 `opacity: 0.85`（对齐 vue `voice-message__bubble--playing`）；停止播放/切歌/组件卸载都清计时器，播放结束回调复位 `playing`。
- 验证：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 738KB / 分包 1283KB）；H5 产物伺服 200。**待验**：三端真机播放态跳动观感与停止/切歌时序。

## 2026-10-20 底部 tabBar 图标 + 响应式未读角标（P1-1 部分落地）

- **tabBar 图标**：demo `pages.json` 三项补 `iconPath`/`selectedIconPath`（81×81 透明 PNG，未选 `#919BA1` / 选中 `#009EFF`，与 tabBar color/selectedColor 一致）：会话=bubble/rect、联系人=person/double、我的=person/single 的线性/面性档。
- **PNG 生成链路**：新增 `scripts/build-tabbar-icons.py`，直接取 `em-icons.ttf` 字形轮廓（字体由 `build-icons.py` 从 vue icons-v2 同源构建），24 设计画布映射 60×60 居中，skia 输出 81×81；换 tabBar 图标或重构建字体后重跑即可，不再手绘/另找图。原生 tabBar 只接受图片是平台限制，也是 em-icon「禁 png」策略的唯一例外（skill 已注明）。
- **响应式未读数 API**：
  - `store/conversation.ts` 新增 `totalConversationUnread` computed（所有会话 unreadCount 之和，含免打扰，微信口径）。
  - `store/contact.ts` 新增 `contactRequestUnreadCount` computed（收到的 pending 好友申请/群邀请；`pendingInviteCount()` 保留为同步快照）。
  - 新增 `libs/use/useUnreadCounts.ts`：`useUnreadCounts()` 返回 `{ conversationUnread, contactRequestUnread }` 两个 ComputedRef；`getUnreadCounts()` 供非 setup 快照。
  - `libs/index.ts` 导出以上能力；`EmKit` 增 `conversationUnreadCount` / `contactRequestUnreadCount` getter（非响应式便捷值）。
- **原生 tabBar 角标**：新增 `libs/use/useTabBarBadge.ts`（`useTabBarBadge(options)` + `syncTabBarBadges(options)`）：watch 两个 computed → `uni.setTabBarBadge/removeTabBarBadge`，0 移除、>99 显示 `99+`、失败静默。平台限制「当前页必须是 tabBar 页」，故除 `onMounted`/watch 外在 `onShow` 再同步一次，从聊天页返回 tab 页可补上期间错过的角标更新。
- **demo 接线**：会话页/联系人页 setup 调 `useTabBarBadge({ conversationIndex: 0, contactIndex: 1 })`；文档 README 增「未读角标 / tabBar（响应式）」示例，EVAL 表 P1-1/入口角标标记部分落地。
- 验证：`build web` ✓ / `build mp-weixin` 11 项防回归全绿（主包 749KB / 分包 1283KB）/ H5 产物 tabBar 三图标渲染截图核对（含选中态）、原生角标 `3` / `99+` 截图核对通过；`app.json` tabBar 三项 iconPath 与 static 产物已核对。**待验**：微信模拟器/真机角标数字与 99+ 截断、从聊天页返回 tab 页角标补齐、免打扰会话是否计入总未读的产品口径确认。

## 2026-10-20 修复：原生 `<button>` 在 App 端文字贴底（蒸汽端按钮居中口径）

- **症状**：demo 登录页 / 我的页 / 样式实验室的原生 `<button>`（`height` 与 `line-height` 同值）在 Android 蒸汽端文字贴在按钮下沿、上方空一大截；H5 与微信小程序同一份样式却垂直居中。
- **根因**：蒸汽端 button 是原生实现，**文字竖直居中靠组件默认的上下 padding，不靠 line-height**（官方 `docs/component/button.md` tips）。显式 `height` 把盒子钉死，但默认 `padding-top/bottom` 仍在，把行盒整体下推、底部被固定高度裁掉，视觉上只剩贴底的字。H5/mp 的 button 是 CSS/WebView 实现，line-height 直接居中、默认竖直 padding 为 0，所以只有 App 端异常。**不是编译器 bug，也不需要全局 reset**。
- **落地**：
  - `demo/pages/login/login.uvue` `.login__btn`、`demo/pages/mine/mine.uvue` `.mine__logout`、`demo/sub-im/pages/style-lab/style-lab.uvue` `.lab__btn` 各补 `padding-top: 0; padding-bottom: 0`；`contact` / `spike` 的 button 原本就是 `padding: 0 xx`（竖直 0），实测正常，无需改动。
  - 组件库零改动：库内按钮一律走 `em-button`（view + text + flex 居中，非原生 button），天然免疫。
  - 沉淀 skill `em-crossend-pitfalls` 5b，含「ucss 只有 class 选择器、App 无继承，写不出全局 `button {}` 复位，约束只能逐 class 落地」的口径。
- 验证：Android 真机（HBuilderX dev + HMR）逐页截图对照——登录页「登录 / SDK Spike 页」、我的页「退出登录」、样式实验室「切到暗色 / English」修复前后均由贴底变为垂直居中；`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 749KB / 分包 1283KB）；H5 产物伺服 200。**待验**：鸿蒙真机同规则复核（同一 App 原生实现，预期一致）、iOS 未验。

## 2026-10-20 深色模式跟随系统 + Demo 全量接线（M2.10）

- **主题引擎（libs）**：`THEME_MODE` 增 `AUTO`；`themeStore` 拆 `preference`（auto/light/dark，持久化 `emkit.themeMode`）/ `mode`（解析后实际主题）/ `systemMode`。`initTheme()`（幂等，App onLaunch + 页面 setup 兜底）读偏好与系统主题并订阅变化：App 用 `getDeviceInfo().osTheme` + `onOsThemeChange`，Web 用 `matchMedia('(prefers-color-scheme: dark)')`，微信小程序用 `getAppBaseInfo().hostTheme` + `onHostThemeChange`（`onThemeChange` 兜底）。`setTheme()` 支持三档并写存储；`useTheme()` 增 `isDark`，`themeClass` 仍由根节点消费。
- **原生 chrome**：新增 `syncNativeThemeUI(options)`（导航栏 + tabBar，`tabBarPages` 命中当前页才同步 tabBar，H5 无 `setNavigationBarColor` 时判函数存在跳过）；App 端 `setAppTheme({theme: preference})` 让原生弹窗等系统 UI 跟随。H5 没有上述 API：生效主题写到 `<html data-em-theme>`，`demo/index.html` 的全局 CSS 覆盖导航栏/tabBar 底色，`demo/common/theme.ts` 的 `syncH5Chrome()` 再按 hash 路由直写 tabBar 选中态文字色（H5 runtime 无 `getCurrentPages`，不能靠路由 API）。
- **Demo 接线（13 页全覆盖）**：`demo/common/theme.ts` 的 `useDemoTheme()` = `initTheme({tabBarPages})` + onShow/主题变化时 `syncNativeThemeUI()`；全部页面根节点绑定 `themeClass` 并 `@import variables.css`。登录页为固定深色品牌页（渐变 + 光晕，两种主题下都不变），只接 `useTheme()` 初始化与 `navigationBarTextStyle: white` 状态栏前景，不消费明暗 token、不做原生 chrome 同步；其余页面（我的/通讯录添加好友弹窗/Spike/Text Probe/占位等）硬编码色值全部改 `--em-*` token（含 input 文字色，避免暗色黑字黑底）。「我的」页深色开关改为「跟随系统 / 浅色 / 深色」三档单选（`em-icon` circle-checked-filled/circle-empty），即时生效并持久化；样式实验室改为三档循环，显示「跟随系统（当前深色/浅色）」。
- **首帧原生 chrome**：新增 `demo/theme.json`（light/dark 双份 nav/tab 色），`pages.json` globalStyle/tabBar 改 `@变量` 引用；`manifest.json` 增 `mp-weixin.darkmode: true`、`web.darkmode: true`、`app.defaultAppTheme: "auto"`。
- **库内暗色修复**：好友申请「对方已拒绝」白底圆形图标由 `--em-text-primary` 改固定 `#5E686E`（暗色下原值在白圆上不可见）。
- **验证**：`build web` ✓ / `build mp-weixin` 11 项防回归全绿（主包 775KB ≤ 1.5MB，分包 1313KB）/ H5 伺服 200。H5 headless Chrome + CDP 实测：①系统亮色 → 浅色；②系统强制深色（`--force-dark-mode`）→ 全页深色（导航栏/tabBar/卡片/输入框/文字均正确）；③系统深色 + 持久化 `light` → 整页浅色且导航栏/tabBar 同步（`data-em-theme` + tabBar DOM 覆盖生效）；④「我的」页点「浅色」→ `em-theme-light`、原生 chrome、tabBar 选中态（我的蓝/其余灰）同帧切换且 `localStorage.emkit.themeMode='light'`；⑤`Emulation.setEmulatedMedia` 切系统 light/dark（偏好 auto）→ 页面与原生 chrome 动态跟随；⑥style-lab 冷启动深色整页截图复核（文字/背景/气泡/图标/em-empty/em-skeleton 全 token 正确）。登录页为固定深色品牌页（新渐变设计），两种系统主题下截图一致、无导航栏白条。
- **待验**：微信开发者工具/真机（`hostTheme` 跟随与手选覆盖、tabBar/nav 动态色、`darkmode:true` 下首帧）；Android/iOS/鸿蒙真机（`onOsThemeChange` 动态切换、`setAppTheme` 对 `showModal` 的跟随、自定义 nav 页状态栏前景色）；「我的」三档选择与样式实验室循环的三端观感。

## 2026-10-20 Demo 登录页按 vue3 Demo 复刻（H5 窄屏断点）

- 参照 `/Users/neohuang/Desktop/WorkCommonUse/Demo/easemob-demo-vue3` 登录页 `<768px` 断点（hero 隐藏、单列表单卡片）重做 `demo/pages/login/login.uvue`：
  - **背景**：150deg 深蓝渐变 `#100c35 → #1e1272 → #133080 → #0062c0` + 两层满屏线性渐变光晕（右上紫粉、210px 级过渡）模拟 vue3 的 conic + blur 光斑。未用圆形光斑（会留圆弧硬边与 banding），未用 radial/conic（uni-app x App 端 `background-image` 仅支持 `linear-gradient`）。
  - **卡片**：24px 圆角、`rgba(12,8,40,.78)` + 1px 10% 白描边 + `backdrop-filter: blur(24px)`，上下各 1px shimmer 线；右上 `</>` 开发者入口（展开时紫色高亮）。
  - **表单**：8px 圆角输入框（1.5px 描边、6% 白底、`#b0bec5` placeholder、聚焦 0.7 蓝边 + 3px 光晕、`cursor-color` 品牌蓝）、52px `#009eff` 主按钮（16px/700、2px 字距，`view + text` 实现避开原生 button 端差）、红色小字错误行。
  - **品牌/页脚/导航**：左上「环信 + 简开发 智连接 / 声网旗下品牌」字标；页脚版权 + SDK 版本 + Spike 页入口；登录页改 `navigationStyle: custom`（H5 无白条），`safeAreaInsets.top` 补状态栏、底部 safe area 补页脚。
  - **能力不变**：appkey/userId/token 登录、开发者密码换 token、Spike 入口、SDK 版本展示均保留。
- 验证：H5 390×844 截图与 vue3 参考并排比对（背景/卡片/输入框/按钮/页脚色彩与尺寸对齐）；320/360/768/1440 断点目测无横向溢出（320 标题换行可接受）；空值校验错误态、输入聚焦态、开发者面板展开态截图核对；`build web` ✓、`build mp-weixin` 11 项防回归全绿（主包 774KB / 分包 1313KB）、H5 产物伺服 200。**待验**：App/小程序真机（`backdrop-filter` 在 App 5.25+ Vapor 生效、mp 忽略；自定义导航栏状态栏让位）；≥768 桌面断点的 hero 双栏本期未复刻（按 H5 窄屏断点复刻，hero 依赖 1.2MB 位图与多层装饰）。
- **Android 底部白底修复**：App 端 `min-height: 100vh` 的 vh 只到系统栏以内，而页面画布是含手势条区域的全屏高度，差集露出页面容器背景（`backgroundColorContent` 默认白，Android 系统导航栏背景也取该色）→ 底部一条白带；H5/小程序 vh 即可视区，无此问题。修复：根节点 `height: 100%`（占满 App 画布）+ `min-height: 100vh`（H5/小程序兜底）+ `box-sizing: border-box`；登录页 style 补 `backgroundColorContent: "#100c35"`。H5 390/1440 截图与修复前一致；`build web` ✓、`build mp-weixin` 11 项防回归全绿。**待验**：Android 真机复核白带消失、手势条区域渐变连续。

## 2026-10-20 多场景扩展能力 P0 批次（M2.11，承 docs/EVAL-MULTI-SCENARIO.md）

- **P0-1 发送侧业务载荷**：`EmKit.sendText(to, chatType, text, quote?, mentions?, ext?)` 增第 6 参业务 ext，`buildTextExt` 先铺业务 key、再写 `emQuote`/`em_at_list`（内部 key 优先，业务不可覆盖）；新增 `EmKit.sendCustom(to, chatType, event, params?, ext?)`；`MESSAGE_TYPE.CUSTOM='custom'` 一等类型，`EmMessageItem` 增 `customEvent`/`customParams`（`toMessageItem` 从 wire `body.event/params` 归一，`rawType` 仍置 `'custom'` 兼容旧判别），发送/接收/历史三路径统一；失败重发支持 custom（event/params/ext 重建），文本重发保留业务 ext；`makeQuote` 与聊天页菜单摘要对 custom 回落 `message.custom`；`#custom-message` 默认占位由「暂不支持」改「[自定义消息]」。
- **P0-2 `#banner` 插槽**：`em-chat-page` 在 nav-bar 与群公告条之间新增固定位具名插槽（不随消息滚动；无作用域，宿主自管样式），承载医疗病情条/招聘职位条/交易商品条。
- **P0-3 `title` / `showAction` props**：`title` 非空覆盖导航标题（空串回落原昵称链）；`showAction` 默认 true，false 时 `action-icon` 置空隐藏右上角详情入口（`open-info` 由宿主接管，服务伪装模式）。
- **P0-4 系统提示消息通用化**：`EmKit.insertLocalNotice(conversationId, chatType, text)` 对外；`EmKit.insertGroupNotice(groupId, text)` 保留为群聊别名（内部转调）。渲染复用既有 `MESSAGE_TYPE.NOTICE` 居中灰条 + 长按菜单禁用，本地条目跨 `loadHistory` 合并保留。
- **文档**：新增 `docs/GUIDE-MULTI-SCENARIO.md`（四场景 init→login→navigateTo、P0 能力代码示例、平台边界）；`docs/EVAL-MULTI-SCENARIO.md` 增 §7 落地状态并校正 §5.2 路线 B 现状；`PLAN.md` 新立 M2.11。
- 验证：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 776KB / 分包 1313KB）；H5 产物伺服 200。**待验（需真实账号）**：H5/mp 双端 sendCustom 收发 + `customEvent` 插槽分发 + 失败重发；sendText 业务 ext 对端回读与引用/@同发时的 key 优先级；`#banner`/`title`/`showAction` 三端视觉；`insertLocalNotice` 灰条进出会话保留。

## 2026-10-20 多场景 P1 批次（M2.12）

- **P1-1 单会话未读**：`libs/store/conversation.ts` 增 `conversationUnreadCountOf(conversationId)`（同步快照，含免打扰口径与总未读一致）；`useUnreadCounts.ts` 增 `useConversationUnreadCount(conversationId): ComputedRef<number>`；`EmKit.conversationUnreadCountOf(id)` 便捷快照；`libs` 门面导出三者。入口角标：「客服/卖家/HR 未读」不再需要宿主自己遍历会话数组。
- **P1-2 快捷回复条**：新原子组件 `em-quick-reply-bar`（props `items: EmQuickReply[]`（label/text），emits `select`，横向滚动胶囊，样式对齐 conversation-tabs）；`em-chat-inputbar` 增 `quickReplies` prop + `quick-reply` emit（禁用态/空列表自动隐藏，内部置顶渲染）；`em-chat-page` 增 `quickReplies` 与 `quickReplyMode('fill'|'send')`（默认 fill = 整句替换草稿；send = 直接发送，不挂引用/@提及），发送失败统一 toast。
- **P1-3 自定义长按菜单动作**：`EmMessageMenuExtra`（继承 `EmActionSheetAction` + `types` 过滤）与 `EmQuickReply`/`EmQuickReplyMode` 类型；`em-chat-page` 增 `extraMessageMenus` prop 与 `message-menu(key, message)` emit；业务项追加在 `messageMenuKeys` 配置项之后、删除项之前（删除保持末位），内置 key（copy/quote/recall/delete）保留不可覆盖，NOTICE 灰条不显示，`types` 缺省为全部类型。
- **文档**：`docs/GUIDE-MULTI-SCENARIO.md` 增 §3.7/§3.8 与单会话未读用法、场景配方更新；`docs/EVAL-MULTI-SCENARIO.md` §7 P1 三项置 ✅；`PLAN.md` 新立 M2.12；契约 skill 与 README 同步。
- 验证：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 784KB / 分包 1313KB）；H5 产物伺服 200。**待验（需真实账号）**：快捷回复 fill/send 两模式与禁言群隐藏；extraMessageMenus 追加顺序/`types` 过滤/`message-menu` 回传；单会话未读随进会话清零、入口角标三端视觉。

## 2026-10-20 AI 流式消息（M2.13）

- **数据链路**：`libs/chat/index.ts` 接线 SDK `chatManager.onStreamMessage` → `EmMessageDomain.onStreamMessage`；按 `msgServerId`（兜底 `msgLocalId`）定位同一条 TEXT 消息，`text` 以 `stream.fullText` 幂等覆盖、不新建气泡；首个分片立即建气泡（低首字延迟）。`toMessageItem` 把 wire `stream` 归一为中立 `EmStreamInfo`（status 走 `STREAM_MESSAGE_STATUS` 常量，wire 值只在此边界出现）；`EmMessageItem` 增可选 `stream`。
- **丢片补偿**：`onMessage` 改走 `ingestIncoming`——同 `msgServerId` 的流式副本存在时用完整消息覆盖并收敛 `COMPLETED` 终态（保留原 `localId` 作列表 key/滚动锚点），离线/断连错过分片不再残留半截内容。
- **高性能**：`streamItemByKey`（`conversationId|msgServerId` → store 响应式代理）做 O(1) 定位；分片按 `uiConfig.streamThrottle`（默认 `STREAM_FLUSH_INTERVAL=50ms`）合批写 store + 通知（终态立即落盘、0=逐片即写）；`appendMessage` 改为返回 reactive 代理（蒸汽端 mutation 原始对象不触发更新）；流式增量走 `EmKit.onStreamMessage` 专用订阅，不进 `onMessage` 新消息语义。
- **渲染**：`em-text-message` 仅对 `customType` 缺省/`'text'` 的流展示内核态——传输中尾部 `▍` 光标（H5/mp `@keyframes` 闪烁，5.26 蒸汽端静态降级）、终态收敛普通文本、`STREAM_ERROR` 尾部 i18n「内容生成异常」；`em-chat-page` 新增 `#stream-message` 作用域插槽接管 markdown 等富格式（未提供时纯文本兜底）。
- **配置**：`EmKitConfig.enableStreamMessage`（默认 true；false 时忽略分片，等完整消息一次上屏）+ `streamThrottle`；`EmUiConfig`/`uiConfig`/`applyKitConfig`/`setConfig` 全链路贯通（运行时可切）。
- **滚动**：聊天页新增 `@scroll`/`@scrolltolower` 维护 `streamFollow`，流式跟随独立节流 120ms；用户上翻暂停跟随、回底/主动发送恢复；另加「列表尾部 localId 变化才滚底」watch，历史 prepend 不误滚（纯文本流也适用宿主本地注入）。
- **Demo**：聊天页悬浮「AI 演示」（完成 / 异常 / 停止，mock 分片注入当前会话）；「我的」页运行时开关 `enableStreamMessage`；样式实验室独立流式气泡演示（分片数/状态/合批间隔）。`demo/common/ai-stream-demo.ts` 为参考实现（`startMockStream`/`runMockAiStream`），关闭流式时按完整消息一次性注入。
- **文档**：README 增「AI 流式消息」章节（能力、接入代码、配置表、`#stream-message` 用法、Demo 路径、安全提示）；`docs/GUIDE-MULTI-SCENARIO.md` 增 §3.9（AI 客服配方）与场景表 AI 流式项；PLAN 新立 M2.13；changelog/插件 readme/架构 skill 同步。
- 验证：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 796KB ≤ 1.5MB / 分包合计 1337KB）；H5 产物伺服 200；H5 headless Chrome + CDP 冒烟（样式实验室：点「开始流式」0.9s 后分片 16/状态传输中/光标存在/文本 91 字 → 终态分片 27/状态完成/光标消失/文本 155 字；「异常中断」→ 状态异常 + 尾部「（内容生成异常）」；「我的」运行时开关：描述即时在「已启用」/「已禁用」间切换）；临时 Node 域逻辑用例 13 项全过（首片建气泡/节流窗口不落盘/窗口末端写最新全文/乱序旧片不回退/终态立即落盘且只一条气泡/终态订阅回调/final onMessage 丢片补偿与 localId 保持/关闭开关忽略分片/forgetStreams 丢 pending）。**待验（需真实账号/真机）**：真实 `onStreamMessage` 端到端（H5/mp/App 三端分片合并、丢片补偿、断连重连）；聊天页「AI 演示」悬浮入口与真实会话内的跟随滚动；蒸汽端光标观感（静态降级）与高频流式滚动是否抖动；markdown 插槽宿主接管形态；`enableStreamMessage=false` 时完整消息延迟上屏。

## 2026-10-20 IM 场景实验室（6 场景 Demo，P0/P1 可交互验收）

- **场景目录**：新增 `demo/common/scenario-catalog.ts`——6 个场景（在线客服/医患沟通/二手交易/招聘沟通/家校沟通/兴趣社群）的「业务字段 + 能力点 + 横幅 + 快捷话术 + 业务卡片 event/params/ext + 长按菜单 + 系统提示文案」集中配置；`scenarioOf(key)` 取配置，聊天页/详情页零场景分支。新增场景 = 加一条配置。
- **场景列表页** `demo/sub-im/pages/scenario/scenario.uvue`（我的页入口「IM 场景实验室」）：单聊演示 userId 输入 + 最近会话 chips + 6 张场景卡（图标/主色/单群标记/业务摘要）。
- **场景详情页** `demo/sub-im/pages/scenario/detail.uvue`：业务上下文（科室/订单/职位/班级等）、能力点 chips、演示步骤；单聊填 userId、群聊选已有群组（无群时给「去群组列表」入口）；底部主按钮带 `scenario` + `chatType` + `scene=1` 进共享聊天页。
- **共享聊天页** `demo/sub-im/pages/chat/chat.uvue`：按 `?scenario=` 读目录配置——
  - 右侧「场景开关」浮钮（与既有「AI 演示」浮钮上下错开）打开 `em-popup` 面板；
  - 六项开关实时改 props：`#banner`（场景横幅）/ `title`（场景标题）/ `showAction=false` / `quickReplies` / `quickReplyMode('fill'|'send')` / `extraMessageMenus`；
  - 面板动作按场景：卡片（`sendCustom`）、带业务 ext 文本（`sendText`）、系统提示（`insertLocalNotice`）；
  - 面板顶部用 `useConversationUnreadCount(conversationId)` + `useUnreadCounts()` 实时显示本会话/总未读；
  - `#custom-message` 按 `customEvent` 渲染场景卡（`ext.title/subtitle/meta`）+ 兜底卡；长按卡片/气泡命中 `scene-context` 业务动作并展示载荷。
  - 既有 AI 流式演示入口原样保留。
- 演示样式全部留在 demo 层（`--em-*` token），不进入 UIKit 组件默认行为；无 `scenario` 参数时聊天页与原有形态一致。
- 验证：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 806KB / 分包 1354KB）；H5 产物伺服 200；H5 headless 500×900 截图走查场景列表 + 医患详情 + 家校详情（macOS headless 最小布局宽 500，390 宽截图只是裁切、非页面溢出）。
- **待验（需真实账号）**：6 场景逐一进会话（单聊/群聊）与六项开关回归；390 宽真机/小程序模拟器下场景面板高度与快捷条占位；发送场景卡片在对端/重进会话后的渲染；群场景 @/公告/昵称行与三人群的交互。

## 2026-10-20 自定义卡片插槽化 + Demo 宿主卡片（M2.14）

- **设计结论（评审后调整）**：卡片不内置到 UIKit。卡片布局/字段/多语言随业务差异大，内置 schema 必然不够；uni-app x 五端也无法动态实例化宿主组件，「注册表 + 固定模板」的灵活性不如整卡自绘。内核只保留 `sendCustom` + `#custom-message` 插槽，呈现完全下沉。
- **内核**：保持 M2.11 的 `EmKit.sendCustom(to, chatType, event, params?, ext?)`、`MESSAGE_TYPE.CUSTOM`、`EmMessageItem.customEvent/customParams/ext`；`em-chat-page` 的 `#custom-message` 默认占位恢复「[自定义消息]」，插槽作用域 `message`，外层容器继续承接原生 longpress（卡片长按可开消息菜单）。**UIKit 未新增**卡片组件/类型/注册表 API（`demo-card` 位于 demo 层，不计入内核）。
- **Demo 宿主实现**：新增 `demo/common/demo-card-data.ts`（宿主自己的 event→视觉族映射 + ext 解析 + `phoneExchange` 手机号脱敏）与 `demo/components/demo-card`（独立 `.vue` + `.css`，不引用 UIKit 卡片代码；标题/副标题/角标/字段/主次按钮，`action` emit）；12 种卡片覆盖工单/退款/病例/处方/商品/砍价/邀约/手机号交换/作业/请假/活动/装备。
- **Demo 接线**：聊天页 `#custom-message` 直接注入 `<demo-card :message fallback-text @action>`；未知 event / 无标题回落 `[自定义消息]`；「场景开关」面板保留 12 种卡片发送 + 「未知事件」按钮（不再有注册表开关）。免登录预览页 `sub-im/pages/scenario/cards` 改为宿主卡片渲染，无注销/重注册。
- **文档**：`docs/GUIDE-MULTI-SCENARIO.md` §3.2 重写为「sendCustom + #custom-message 插槽 + 宿主卡片示例 + 样式/多语言/动作/兜底」；README、PLAN M2.14、EVAL §7 同步为插槽方案；契约 skill 移除内置卡片组件，保留插槽说明。
- 验证：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 824KB / 分包合计 1365KB）；H5 产物伺服 200；宿主卡片预览页 500×900 截图走查（12 种卡片 + 未知回落，样式与改前一致）。
- **待验（需真实账号/真机）**：聊天内发送/接收 12 种卡片、宿主 `action` 回传、未知 event 兜底、聊天页插槽在群聊/单聊的布局；宿主自定义样式在 mp-weixin 的生效范围（2026-10-22 已静态验证机制成立——app-and-page 经运行时映射为 apply-shared，页面级 wxss 可穿透组件隔离；真机视觉见同日「组件样式透出」条目待验）。

## 2026-10-20 输入栏业务入口 + 场景化发卡（M2.15）

- **内核**：`em-chat-page` 新增 `#input-toolbar` 具名插槽——位置在消息列表与输入栏之间（快捷回复条之上），无作用域、随软键盘上移、不参与消息滚动；不注入时不占高度。无新增 props/emits/组件/类型，仍维持「内核薄」。
- **Demo 宿主实现**：新增 `demo/components/demo-composer-bar`（横向胶囊条，独立 `.vue` + `.css`；场景主色只染图标，容器/胶囊用 `--em-*` token）；聊天页 `#input-toolbar` 注入本场景入口，点击 → `EmKit.sendCustom` 发对应卡片；「场景开关」新增第 7 项「输入栏业务入口」（默认开），可实时关掉验证「不注入即不占位」。
- **场景目录**：每条卡片补 `entryLabel`（短动词文案）/`entryIcon`；新增 `orderCard`（客服「发订单」，kind=order）与 `resumeCard`（招聘「发简历」，kind=profile），卡片总数 12 → 14；入口清单直接由 `scenario.chat.cards` 生成，新增卡片自动多一个入口。`capabilities/steps` 文案从「注册表」改为「宿主卡片/输入栏发卡」。
- **详情页**：新增「输入栏业务入口（进入聊天后可见）」免登录预览——直接复用 `demo-composer-bar`，点击弹窗解释「进聊天后 = sendCustom(event) → 对端 #custom-message 渲染」。
- **文档**：`docs/GUIDE-MULTI-SCENARIO.md` 新增 §3.10（`#input-toolbar` 用法 + 位置/开关/边界/数量建议 + 配图 `assets/scene-lab-composer.png`），§4 增各场景入口清单，§6 七项开关与 14 种卡片；README/PLAN M2.15/EVAL §7/changelog/契约 skill 同步。
- 验证：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 832KB / 分包合计 1367KB）；H5 产物伺服 200；500×1100 截图走查客服/医患/招聘详情页入口条（发订单/发工单/退款审核、发病例/发处方、发简历/发邀约/换手机号），免登录卡片预览 14 种 + 未知回落（长图 500×4114）。
- **待验（需真实账号）**：聊天页内入口条与键盘联动（弹起/收起时是否跟随）、点击发卡在对端渲染、入口条在群聊/单聊/小程序的布局与滚动；入口条与快捷回复条同时开启时的两行占位是否压消息列表。

## 2026-10-20 三大 tab 入口页纵向滚动排查（demo「我的」修复，Android 真机）

- **症状**：Android 真机 tabBar 页面内容超过一屏时上下滑不动，底部像被 hidden（「我的」页「退出登录」不可达）。
- **真机排查**（adb + uiautomator + `wm size` 强制缩短屏幕制造溢出）：
  - 会话页：列表 scroll-view `[0,474][1080,1018]`，底边止于 tabBar 上沿，`scrollable=true`，滑动正常；列表滚到底最后一条完整可见。
  - 联系人页：同为 scroll-view（内容短通常无溢出；500px 高强制溢出时 scroll-view `scrollable=true`），底边同样止于 tabBar 上沿。
  - 我的页：根节点 `.mine { height:100% }` 且**没有 scroll-view**；超出的子内容被根节点裁掉，页面原生滚动容器只量到根节点高度（恰好一屏）→ `scrollable=false`，所以「能滚却不滚」。tabBar 并非遮挡元凶（App 页面可视区已扣除 tabBar）。
- **解法**：`demo/pages/mine/mine.uvue` 全页内容包进 `<scroll-view class="mine__scroll" scroll-y>`，根 flex column + `.mine__scroll { flex:1; height:0 }`，与 `em-conversation-page` / `em-contact-page` 同口径。
- **复验**：真机新 scroll-view `[0,201][1080,2158]`、`scrollable=true`，底边止于 tabBar 上沿；滑到最底「退出登录」完整可见。会话/联系人页回归无变化。
- **验证门禁**：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 833KB ≤ 1.5MB / 分包合计 1367KB）；H5 产物伺服 200。
- 坑与纪律已写入 skill `em-crossend-pitfalls` §4c + 蒸汽端能力边界表。

## 2026-10-21 1.0 就绪批次 1：视频/文件平台显隐 + 未读清零 + Token/连接生命周期

承 `docs/REVIEW-1.0-READINESS.md` 的 P0-2 / P0-3 / P0-7，先做「不支持的平台隐藏入口 + 核心状态修复」，不新增播放器/下载器实现。

- **平台能力开关**：`libs/platform.ts` 新增 `EmPlatformCapabilities` + `PLATFORM_CAPABILITIES`（`videoPreview`/`filePick`/`fileOpen`），条件编译只出现在该文件；门面透出快照供宿主判端。
  - 视频：`videoPreview` 仅 WEB=true；`em-video-message` 非支持端不渲染播放按钮、不发 `preview`；`em-chat-page` 的 `onVideoPreview` 门控并删除「暂不支持」toast。
  - 文件发送：`filePick` APP=false；`em-chat-inputbar` 媒体面板隐藏「文件」格，`onPickFile` 兜底门控；`chooseFile` APP 分支保留为后续接入点。
  - 文件打开：`fileOpen` 全端 false；`em-file-message` 点击不发 `download`，`onFileDownload` 门控并删除 toast，文件卡退化为纯展示。
  - 文档：README「已知限制」补三条；插件 readme 增「平台能力（1.0）」矩阵。
- **未读清零（P0-7）**：`EmConversationDomain.clearUnread`（本地 store 归零 + 服务端异步清，按会话 `CONVERSATION_UNREAD_CLEAR_THROTTLE=2000ms` 合批）；三处调用——进会话 force、当前会话收消息、聊天页 `onUnmounted` force；`EmKit.clearConversationUnread` 透出。修复「读完返回列表/冷启动/重同步后未读复活」。
- **Token/连接生命周期（P0-2）**：`EmKitConfig` 增 `onTokenWillExpire`（返回新 token，UIKit 自动 `client.renewToken`）/`onTokenExpired`；`EmKit.renewToken` + `EmClient.renewToken`；连接事件补齐 `onConnecting`/`onReconnectFailed`/`onTokenWillExpire`/`onTokenExpired`，`onDisconnected` 消费 `reason/errorCode`；`connectionStore` 增 `reason/errorCode/reconnecting/reconnectAttempt`；`CONNECTION_STATUS` 增 `RECONNECTING`。demo 登录守卫统一改按 `state.userId`（断网/重连不再误踢登录页），mine/spike 状态文案补「重连中」。
- 验证：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 836KB ≤ 1.5MB / 分包合计 1367KB）。
- **待验**：App/mp 收视频（无播放按钮、点击无 toast）与收文件（点击无 toast）；H5 视频仍可播；当前会话收消息角标不复活、离页后列表未读 0、冷启仍 0；Token 过期（控制台强制）自动续期成功/失败、被踢 reason 透出；iOS/鸿蒙未真机。

## 2026-10-21 1.0 就绪批次 2：发布物料 + Quick Start + 契约收口

承 `docs/REVIEW-1.0-READINESS.md` 的 P0-1 / P0-4 / P0-6，并提前收口 P1-1 / P1-2。

- **发布物料（P0-1）**：
  - 插件 `package.json` version → `1.0.0-rc.1`；关键词收敛到 5 个；`engines` 增加 `uni-app-x`。
  - 平台矩阵按 HBuilderX 4.71+ 新规范重写：`uni-app` 全 `x`，`uni-app-x` 的 Android/iOS/鸿蒙/H5/微信小程序为 `√`；移除旧 `u` 值。
  - `dcloudext` 补 `darkmode=√` / `i18n=√` / `widescreen=x`；权限声明补相机/相册/麦克风，数据声明明确「经宿主集成的环信 SDK 传输」。
  - `changelog.md` 新增 `1.0.0-rc.1` 人话版（新增/修复、0.x→1.0 升级说明、已知限制）；根目录补 MIT `LICENSE`。
- **Quick Start（P0-4）**：新增 `docs/QUICKSTART.md`（9 节：前置条件、安装、pages.json/easycom/自定义导航/高度、App 初始化与 Token 回调、登录、会话页、聊天页与引用协议、五端运行、排错+验收清单）；根 README 顶部改为 1.0 状态 + 兼容矩阵 + 5 分钟接入最短路径 + 迁移说明；插件 readme 重写为自包含接入文档。
- **公开仓安全（P0-6）**：`demo/manifest.json` 删除鸿蒙 `signingConfigs`（绝对路径、key/store 密码）与版本号更新；`.gitignore` 增签名材料（`*.p12/*.cer/*.p7b/*.jks/*.keystore`、`manifest.local.json`、`build-profile.json5`）；`docs/HARMONY-REALDEVICE-RUN.md` 增「本地重配、提交前还原」提示。
- **引用协议（P1-2）**：`MESSAGE_EXT_KEY.QUOTE` 改为 `msgQuote`，新增 `QUOTE_LEGACY='emQuote'`；`buildTextExt` 双写 vue 结构（`msgID/msgPreview/msgSender/msgType/msgThumbUrl`）与旧 uni 结构；`parseQuote` 优先 `msgQuote`、回落 `emQuote`，`voice→audio` 映射，`EmQuoteInfo` 增 `thumbUrl`；重发排除两个内部 key。
- **返回契约（P1-1）**：`em-chat-page` 增 `back` emit + `autoBack` prop（默认 true，保持 `navigateBack` 行为；false 时只发事件由宿主接管）。
- **发布自检脚本**：新增 `scripts/check-release.mjs`（零依赖）——校验插件版本=changelog 首节、README 无「开发中」且含当前版本、平台矩阵无旧 `u` 值、根 LICENSE、demo manifest 无签名/绝对路径、公开文档无 `/Users/`；命中历史签名密码时只 WARN 并提示轮换/重写历史。
- 验证：`scripts/check-release.mjs` ✓（1 条 WARN：历史提交仍含 keyPassword）；`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 837KB / 分包 1367KB）；H5 产物伺服 200。**待验**：与 vue 版互发引用（双向）、`autoBack=false` 的返回拦截、插件市场新平台矩阵展示、鸿蒙签名本地重配后真机运行。

## 2026-10-21 鸿蒙真机首屏白屏修复：store 反向依赖页面 chunk（ESM 循环 / `conversationStore is not initialized`）

- **症状**：鸿蒙真机启动即白屏，日志 `conversationStore is not initialized`，栈 `at EmKitImpl entry (libs/index.js:22:26)` / `at func_main_0 (libs/index.js:342:15)`；报错行正是编译后的 `this.conversations = conversationStore`。
- **根因**：不是 store 初始化逻辑缺失，而是 App 编译产物出现 **ESM 循环依赖**。App/鸿蒙编译把 for-of 的降级辅助 `__values` 提升到共享 chunk，落点被选在 `components/pages/em-chat-page/em-chat-page.js`，于是 `libs/store/conversation.js` 多出一条 `import { __values } from "../../components/pages/em-chat-page/em-chat-page.js"`。循环：`libs/index → chat/index → store/conversation → em-chat-page → libs/index`。首屏页面（demo 首页 `pages/login`，经 `common/theme` 先摸到 store/conversation）求值时绕回 `libs/index` 执行 `new EmKitImpl()`，此时 `conversationStore` 仍处 TDZ → 抛错中断页面挂载 → 白屏。H5/小程序不复现（helper 落点不同、H5 是另一条 Vite 管线）。
- **排查**：把 App 产物当 ESM 图静态查——① `libs/` 下是否出现 `from "../../components/`；② 按 ESM 求值语义（state 1=求值中 / 2=完成）从各页面入口模拟，检测 `libs/index.js` body 执行时 store 是否仍在求值。修复前实测：1 条循环，`pages/login`、`pages/contact`、`sub-im/pages/chat`、`scenario/*`、`style-lab`、`text-probe` 共 8 个入口必现。
- **修复**：`libs/store/conversation.ts` 的 `totalConversationUnread` 由 for-of 改 `forEach`（产物不再 import 组件）；`em-chat-page.vue` 公告宽度估算的字符串 for-of 改索引 `for` + 代理对跳过（CJK 1 字宽 / 其余 0.55，行为不变）。全库现无 for-of / for-in。
- **新增自检**：`scripts/check-app-module-graph.mjs`（零依赖，默认扫 `demo/unpackage/dist/dev/.app-harmony/assets`）——命中 `libs → components` 反向 import 或 libs/index 参与的循环即 exit 1；用注入反向 import 的合成产物验证可复现报错。
- **验证**：`app-harmony` 重编译（dev + prod 两轮）后 module graph ✓（0 反向 import、0 循环、`__values` 0 处）；HBuilderX GUI 的 app-harmony dev watch 已按新源码重出 `.app-harmony` 产物；`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 837KB / 分包 1367KB）；H5 伺服 200。
- **纪律**：libs 内禁 for-of / for-in（改 `forEach` / 索引 `for`）；新增语法后复查 App 产物无 `libs → components/pages` 反向 import。已写入 skill `em-crossend-pitfalls` §5c、能力边界表与 `em-coding-discipline`（自查清单 8）。
- **待验**：鸿蒙真机重新「运行到鸿蒙」（HBuilderX 会重建并推送新的 JS 产物）确认首屏渲染与登录/会话链路；Android/iOS 同管线回归。

## 2026-10-21 聊天页点击消息区收起输入栏（emoji/媒体面板 + 软键盘）

- **需求**：输入栏展开 emoji/媒体面板、或软键盘弹起时，点击聊天消息区应收起（对齐 vue 版 `chat.vue` 的 `onChatContentClick` → `messageInput.blur()`）。
- **落点**：
  - `em-chat-inputbar` 新增 `collapseSignal?: number`（默认 0）：数值变化即 `panel → 'none'` + 收键盘。面板状态仍归组件内部、父级不持有，故用递增信号传达一次性命令，不用 `$refs` 调子组件实例方法（蒸汽端/小程序/H5 行为一致）。
  - 收键盘走 `uni.hideKeyboard()`（App 三端 + H5 + 微信小程序均实现，H5 是 blur 当前 input）。收前按 `focused || keyboardHeight > 0` 判定（H5 不监听键盘高度，靠输入框 focus/blur 兜底），避免每次点击空调一次 API；收后主动清零键盘高度（部分端不补发 0 高度事件，口径同 `onInputBlur`）。
  - `em-chat-page` 的消息 scroll-view 增 `@click="onChatAreaClick"`：点消息气泡/空白区冒泡上来即收，递增 `inputbarCollapseSignal` 传入输入栏；无展开态时子组件内为空操作。
  - 顺带对齐 vue：开 emoji/媒体面板前先收键盘（此前键盘弹起时点表情会「键盘 + 面板」叠加占位）。
- **验证**：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 837KB ≤ 1.5MB / 分包合计 1367KB）；产物核对——H5 编译到真实运行时 API（`defineAsyncApi('hideKeyboard')`，blur activeElement），mp 编译为 `index.hideKeyboard()` 且 scroll-view 挂 `bindtap`，inputbar props 含 `collapse-signal`。`build app` CLI 路径不支持（`main.uts` 无法解析 vue，属工具链限制，非本次改动）。
- **待验**：App 三真机（键盘弹起点消息区能收起且不连带触发气泡操作）、微信小程序（面板/键盘收起观感）、H5（面板展开点消息区收起）。

## 2026-10-21 鸿蒙流式气泡终态空白修复：`<text>` 内 v-if 增删子 text 导致字形丢失

- **症状（鸿蒙真机复现）**：聊天页「AI 演示」的流式回复分片增长完全正常（末尾带 `▍` 光标），**终态瞬间整条气泡变空白**——底色与高度都在（高度按全文撑开），但一个字也不绘制；该条消息之后一直空白，日志无 JS 异常。
- **根因**：蒸汽端 `<text>` 内用 `v-if` 增删子 `<text>`，**移除子节点后父 text 的字形不再绘制**（布局层高度保留、绘制层丢字）。`em-text-message` 的光标 `v-if="isStreaming"`、异常提示 `v-else-if="isStreamError"` 在终态翻 false → 子 text 被移除 → 父 text 全白。与数据层无关：`message.text` 始终是全文，store 侧 `stored.text`/`stored.stream` 写入顺序也正确。
- **修复**：光标/异常提示改「**常驻子 text + 内容切换**」——子节点永远挂载，只写 computed 文本（`streamCursorText` = `'▍'`/`''`，`streamErrorText` = i18n 文案/`''`）；光标字符收口 constants `STREAM_CURSOR_CHAR`，模板里不再有 text 内的条件增删。
- **真机复现/验证**（鸿蒙 25PVB24711005055，安装重编 HAP 后操作）：修复前完成态气泡空白（截图对照）；修复后完成态全文保留、等待 13s 复截仍稳定，异常态尾部「…（内容生成异常）」正常内联；光标传输中出现、终态消失。
- **门禁**：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 837KB / 分包 1367KB）；H5 伺服 200；`check-app-module-graph.mjs` ✓（0 反向 import / 0 循环）。
- **纪律**：`<text>` 内禁止 `v-if`/`v-else`/`v-for` 增删子 text（改常驻节点换内容，或把分支移到 text 外用 view 承载）。已写入 skill `em-crossend-pitfalls` §5d + 能力边界表、`em-coding-discipline` 文本章节。
- **待验**：H5/微信小程序的流式观感（光标位置、常驻空 text 无副作用）；@提及气泡的 `segments` 分支同样是 text 内 `v-for`（静态消息暂未触发，若后续做动态 @/流式 @ 需按同口径改造）。

## 2026-10-21 鸿蒙软键盘遮挡输入栏修复：面板口径被当成上推口径（少顶 28vp）

- **症状（鸿蒙真机）**：聊天页输入框聚焦，键盘弹起后输入栏确实上移了，但底部仍被键盘压住一截——输入框只露出上半截、发送键下半截被压，看起来像「避让没做干净」。
- **定位（真机量出来，不是猜）**：设备 25PVB24711005055 / HarmonyOS 6.0.1（API 20）/ density 3 / 1084×2412px（361×804vp）。
  - `uitest dumpLayout`：输入栏根节点 top=1395、去掉安全区 padding 后的高度 159px（1+52×3 边框/栏高）→ `margin-bottom = 2412 − 1554 = 858px(286vp)`；
  - `snapshot_display`：键盘面板上沿 y=1470 → **实际遮挡 942px(314vp)**；
  - `hidumper -s WindowManagerService -a '-a'`：应用窗口 0..2412 全屏（边到边）、手势导航条窗口 `[0,2328,1084,84]`（84px = 28vp = `safeAreaInsets.bottom`）。
  - 结论：上报值(314vp) == 实际遮挡(314vp)，而代码算出的 margin 是 `314 − 28 = 286vp` → 少顶 28vp（84px）。
- **根因**：一份 `uni.onKeyboardHeightChange` 值被当成两种口径混用。`keyboardHeight` 原本是**面板口径**——iOS/鸿蒙上报值含底部安全区，而 emoji/媒体面板自身还有 safe-bottom padding，所以扣掉安全区再交给面板；`em-chat-inputbar` 又把这个「已扣过的值」直接写进 `margin-bottom`（**上推口径**，要的是「键盘画到屏幕底的那一段」）。面板扣一次没问题，上推也扣就必然少一个安全区。官方 hello-uni-app-x `keyboard-adjust` 示例只用它调悬浮条位置，照搬到 margin-bottom 会复现同一 bug。
- **修复**：
  - `libs/use/useKeyboardHeight.ts` 拆两个 ref：`keyboardHeight`（面板口径，行为不变）+ `keyboardLift`（上推口径 = 上报值原值，App 全端；iOS 随当日下一条一并改正）；新增 `resetKeyboardHeight()` 两个值一起清零（替换 inputbar 里两处手写 `keyboardHeight.value = 0`）。
  - `em-chat-inputbar`：`margin-bottom` 改用 `keyboardLift`，面板 `height` 仍用 `keyboardHeight`，`keyboardMaybeOpen()` 同步改用 lift。
- **真机验证**（改完源码经 HBuilderX dev watch 重出 `.app-harmony` → `hvigorw assembleHap` 重编签名 HAP → `hdc install -r` 装包实测）：
  - 修复前输入栏根节点 `[0,1395][1084,1554]`，底边比键盘上沿低 84px（截图：输入框/发送键被压掉下半截）；
  - 修复后 `[0,1311][1084,1470]`（高 159px），底边 1470 == 键盘上沿，输入框与发送键完整可见、与键盘无缝隙；
  - 点消息区收起后根节点回到 `[0,2169][1084,2412]`（243px，含 28vp 安全区 padding），与改前基线一致；媒体面板 280vp、面板顶 1572 与改前一致（面板行为未动）。
- **门禁**：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 837KB / 分包合计 1367KB）；H5 产物伺服 200；`check-app-module-graph.mjs` ✓（0 反向 import / 0 循环）。
- **纪律/口径**：同一份键盘高度不要同时喂给「面板高度」和「margin-bottom」；改 margin 前按 skill `em-crossend-pitfalls` §4d 的三数法（dumpLayout / 截图键盘上沿 / hidumper 窗口 rect）实测一次。已同步 skill §4 要点与新增 §4d。
- **待验**：Android 回归（口径未变，预期无感）；键盘 ↔ emoji/媒体面板互切的面板高度观感（面板 280vp vs 键盘 314vp，切换有 28vp 收缩，属历史行为本次未改）；会话页/联系人页搜索框聚焦（仍走系统默认上推，遗留项）。

## 2026-10-21 iOS 同样复现输入栏被压一截：同因（上推口径多扣了一个底部安全区 34pt）

- **症状（iOS 真机，用户 16:43 截图）**：iPhone 14 Pro 竖屏 1179×2556（3x）、深色主题、第三方九宫格键盘。键盘弹起后输入栏确实被顶起，但栏底仍压在键盘面板下——发送键只剩上半截可见（键盘面板半透明，能隔着看到被压住的输入栏残留）。
- **截图量化（未接设备，按用户截图逐像素量，三数一对）**：
  - 键盘面板上沿 y=1407px → **实际遮挡 = 2556 − 1407 = 1149px = 383pt**；`safeAreaInsets.bottom` = 34pt = 102px（1179×2556 / 3x = 393×852pt，Home 指示条机型）。
  - 输入栏根节点上沿 y=1350px（顶部 1px 分隔线可认），栏高 159px = 53pt（css：1px 边框 + 8 + 36 输入框 + 8 = 53）；
  - 故栏底 y=1509px → 实际生效 `margin-bottom = (2556 − 1509) / 3 = 349pt = 383 − 34`：**少顶的 102px 恰好是一个底部安全区**，同时反证上报值 383pt == 实际遮挡（含安全区）。
- **根因**：与鸿蒙同一个 bug 的遗留面。上一轮把「上推口径」从面板口径拆出来时，iOS 分支仍写成 `lift = reported − safeAreaInsets.bottom`（当时注记「未真机验，沿用旧值」），而 iOS 会话页同样是边到边（页面底 = 屏幕底），上报值本身已含安全区 → 少顶一个安全区。
- **修复**：`libs/use/useKeyboardHeight.ts` 的 `keyboardLift` 改为**全端 = 上报值原值**（iOS 不再扣安全区），`keyboardHeight`（面板口径）保持「iOS/鸿蒙扣安全区」不变；`em-chat-inputbar` 无需改动（已用 lift 写 `margin-bottom`）。同步 `docs/PLATFORM.md` 键盘避让口径与 `changelog.md` 修复条目；skill `em-crossend-pitfalls` §4 要点/§4d 写入「iOS 已实测同因」。
- **验证口径**：iOS 真机聚焦输入框，输入栏底边应 == 键盘面板上沿（截图量：栏底 y 与键盘上沿 y 相等）；同时确认 emoji/媒体面板高度与切换观感未被带偏（面板仍用 `keyboardHeight`，口径未变）。
- **待验**：iOS 真机复测（本次依据截图量化，未接设备实测）；iOS 无 Home 指示条机型（`safeAreaInsets.bottom`=0，口径等价于改前，预期无变化）；Android 回归（口径未变）。

## 2026-10-21 1.0 就绪批次 3：连接状态条 + 录音兜底 + 日志脱敏 + 语言持久化/列表自同步

承批次 2 之后的 P1-3 / P1-5 / P1-6 / P1-8 / P1-11。

- **连接状态条（P1-3）**：新增原子组件 `em-connection-banner`（消费 `connectionStore`，不新增宿主接线）——`connecting/reconnecting` 显示连接中/重连中；`closed` 按 `reason` 分流 `token-expired` / `limit` / 普通网络异常；`em-conversation-page`（nav 下、tabs 上）与 `em-chat-page`（nav 下、业务 banner 上）默认内置，新增 `showConnectionBanner` prop（默认 true）可关闭。新增 i18n `status.tokenExpired`（中/英）。
- **录音兜底（P1-5）**：`libs/platform.ts` 录音改为单例 `RecorderManager` 监听（避免每次 start 累积 onStop），新增 `EmRecordOptions.onError/onAutoStop`；麦克风权限/设备错误回调输入栏 toast「录音失败，请检查麦克风权限」并退出语音模式；60s 上限自动停止后按正常语音发送，不再静默丢弃；`stopRecord` 手动路径与自动路径共用同一结果出口。新增 i18n `chat.voice.recordFailed`。
- **日志隐私（P1-6）**：`EmKitConfig.logPayload` 默认 false；新增 `logPayload(logger,label,payload)`，仅当 `logPayload=true` 且 `logLevel=debug` 才 `JSON.parse(JSON.stringify())` 入缓冲。contact/group 的 24 处 `logger.debug(..., JSON.parse(JSON.stringify(...)))` 全部替换；生产默认日志不再含好友/群原始快照与用户资料。
- **语言持久化（P1-8）**：`useLocale` 新增 `initLocale`（优先 `emkit.locale`，否则系统语言）/`setLocale`（持久化）/`getLocale`；模块加载自动初始化；`EmKitConfig.locale`、`EmKit.setLocale/getLocale` 与门面导出补齐。新增 `LOCALE_STORAGE_KEY`。
- **列表自同步（P1-11）**：`em-conversation-page` 与 `em-contact-list-page` 新增 `autoSync`（默认 true），首次挂载且已登录时分别调 `syncConversations` / `syncContacts`；demo 去掉会话页重复的 onLoad sync，保留 onShow 补同步。群页原有自举逻辑不动。
- 文档：README 增「连接状态条 / 语言 i18n / 日志与隐私 / 1.0 体验收口」，Quick Start 更新 autoSync 与排错；changelog 1.0.0-rc.1 同步。
- 验证：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 845KB / 分包 1367KB）；H5 产物伺服 200；headless Chrome 打开 H5 登录页渲染正常（无 Uncaught/ReferenceError）；`check-release.mjs` ✓。**待验**：真机断网重连/被踢时条幅文案与布局、`showConnectionBanner=false`；App/mp 录音权限拒绝/60s 自动发送；语言切换持久化与系统语言初值；`logPayload=true` 的导出内容。

## 2026-10-21 1.0 就绪批次 4：聊天首屏骨架 + 历史加载失败重试（P1-4）

- **首屏不再闪空态**：`em-chat-page` 新增 `historySettled` / `historyFailed` / `historyLoading`；`showHistorySkeleton = !historySettled && list.length===0`。首次历史请求结束前显示 4 行「头像 + 两行气泡」骨架，不再把「请求未回包」误判成「暂无消息」。
- **500ms 兜底语义修正**：`READY_FALLBACK_MS` 现在只解除 scroll-view 的 `opacity:0`，不再把 `ready` 当成空态开关；空态必须 `historySettled && !historyFailed && list.length===0` 才展示。
- **失败可重试**：首次历史失败 → toast「消息加载失败」+ 空态区「点击重试」（`em-button`，重试中 disabled）；已有缓存消息时失败不遮消息，改为顶部「消息加载失败，点击重试」行。`onLoadMore` 失败也补 toast。
- **i18n**：新增 `chat.historyFailed` / `chat.historyFailedRetry` / `chat.retry`（中/英）。
- 验证：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 849KB / 分包 1367KB）；H5 产物伺服 200。**待验**：弱网/断网首次进聊天页的骨架→空态/错误态切换、重试成功回填、已有缓存时失败提示、`#empty` 插槽在错误态下不被误渲染。

## 2026-10-21 1.0 就绪批次 5：消息内存上限（P1-10）

- **背景**：所有会话的 `onMessage` 都 append 到 `messageStore.messagesByConversationId`，多群/久用后内存无界增长。
- **策略**：新增 `CONVERSATION_MESSAGE_RETAIN_LIMIT = 100`；**非当前会话**每次 append 后只保留最近 100 条；离开当前会话时也按 100 裁剪；当前会话单次会话内不设限（避免正在浏览时被截断）。
- **游标一致性**：被裁剪的会话记 `trimmedByConversationId`；下次 `loadHistory` 时丢弃旧消息/游标/`hasMore`，从最新页重拉，避免旧游标指向已丢弃消息造成时间断层。
- **当前会话同步**：`EmConversationDomain.enterConversation/leaveConversation` 调 `messages.setActiveConversation`，消息域据此判断是否裁剪；`EmChat.reset` 清空标记。
- 验证：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 850KB / 分包 1367KB）。**待验**：多群连续收消息后各会话消息数组 ≤100、进入被裁剪会话能重拉最新页且不重复/不断层、当前会话长聊不被裁剪、群/单聊切换正常。

## 2026-10-21 1.0 清理：init 生命周期文档 + 移除死配置 showTime

- **P1-9 收口**：README / Quick Start / 插件 readme 明确「`EmKit.init()` 每进程只生效一次、appkey 固定；logout 后直接 login；换 appkey 需重启进程」——SDK 无 ChatClient destroy，不引入不可靠的重初始化。
- **移除死配置 `showTime`**：`EmKitConfig`/`EmUiConfig`/`uiConfig`/`applyKitConfig` 全链路删除（此前只存不用，逐条时间仍由时间分隔条承担）；`setConfig({showTime})` 不再生效，1.0 前无正式用户。
- **stale 注释**：`CONVERSATION_TYPE.GROUP_CHAT` 去掉「一期仅单聊」；会话页 create-group 注释改为「建群已落地，emit 由宿主接群列表页」。
- 验证：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 850KB / 分包 1367KB）。

## 2026-10-21 独立文档门户接入

- 新增 `docs/docs.manifest.mjs` 与 `docs/HOME.md`：公开文档仍由本仓库维护，VitePress 站壳位于同级 `../easemob-community-docs`；首批接入快速开始、多场景、小程序分包、鸿蒙真机、Design Tokens 与 changelog。
- 公开内容采用 entries 白名单；`PLAN.md`、`STATUS.md`、SPIKE、REVIEW、RELEASE、EVAL 等内部材料不进入门户。Quick Start 同步移除对内部 STATUS 的公开引用并修正聚合后的指南链接。
- 验证：门户 `pnpm test` 9/9 通过；`pnpm build` 通过；uniApp 首页版本、产品切换、回源编辑链接、场景图片、搜索、暗色模式与移动端导航均经浏览器实测。此次仅改文档与门户配置，未改组件代码，不重复五端构建。

## 2026-10-21 宿主接入 Agent Skills（skills/）

- 新增对外分发的宿主接入技能包 `skills/`（8 份）：`em-host-integration`（总纲）、`em-host-conversation-chat`、`em-host-contacts-groups`、`em-host-business-extension`、`em-host-ai-stream`、`em-host-theme-i18n`、`em-host-mp-subpackage`、`em-host-troubleshooting`；每份含触发 description、可复制代码、组件契约/事件/插槽、平台边界与验收清单。
- 与 `.agents/skills/`（UIKit 开发技能）明确分仓：README / 插件 readme / AGENTS 文档索引各加入口；`skills/README.md` 给出复制到宿主 `.claude/skills` / `.agents/skills` 的安装方式与任务路由。
- 新增 `skills/em-host-mp-subpackage/scripts/prepare-sdk-subpackage.mjs` 宿主版分包后处理（参数化 project/out/sdk/esbuild，支持 `--watch`，含 IIFE 全局名校验、es2017 降级、导出探针、project.config ignore 开关）；新增 `scripts/check-skills.mjs` 校验 frontmatter/目录同名/描述长度/代码围栏/本地链接。
- 验证：`node scripts/check-skills.mjs` 8/8 通过；宿主分包脚本对 demo 的 websdk 5.1.3 实测生成 1234KB `sub-sdk/im-sdk.js`，导出探针与 `project.config.json` patch 通过（临时目录，未改产物）。

## 2026-10-21 对外文档门户完整装载（页面/组件/API/配置/平台）

- **文档技能**：新增 `.agents/skills/em-public-docs`，定义公开边界、真源映射、页面地图、四套模板、更新流程与发布前清单；AGENTS 增加「对外文档门禁」与技能索引。
- **公开页面**：guide 从 6 篇扩到 26 篇（加首页共 27 页）——核心概念与架构、5 篇页面指南（会话/聊天/聊天信息/通讯录/群组）、5 篇组件参考（总览/基础/会话/聊天/联系人）、EmKit API、类型与常量、配置参考、消息与扩展协议、主题与国际化、设计变量、平台能力与差异、常见问题、AI 流式消息、示例工程；重写多场景、设计变量、小程序分包、鸿蒙与 changelog，移除 P0/P1、里程碑、一期/二期、待验/规划、内部材料名等内部口径。
- **manifest**：`docs/docs.manifest.mjs` 改为 `pages` 清单驱动 entries/sidebar/markdownReplacements；editLink 字面量映射由校验脚本比对；nav 增加页面/组件/API 入口。
- **门禁**：新增 `scripts/check-docs.mjs`（零依赖）——未登记页面、内部术语、相对链接、entries/sidebar/editLink/replacements 一致性、33 个组件目录 + 65 个 EmKit 方法 + 24 个配置字段覆盖；当前全绿。
- **门户验证**：`easemob-community-docs` 执行 `pnpm build` 全流程通过（68/68 API 生成 → 内容同步 → 公开边界检查 → VitePress 构建 → 产物复查），产物 `uniapp/` 27 个页面；侧边栏 7 组、26 条页面链接。
- **demo 口径清理**：mine/style-lab/chat 注释、pages.json 标题、spike 页标题移除 M2.13/二期/P1/Spike 等内部字样（仅文案，无行为变更）。
- 本次改动为文档、文档脚本与 demo 文案，未改组件运行时逻辑，不重复五端构建。

## 2026-10-21 iOS 真机首跑两项修复：登录被 uni-getNetworkType 拖死 + 输入框内上沿白线

- **症状（iOS 真机，1.0.0-rc.1 首跑）**：① 点「立即登录」直接失败，红字 `登录失败：undefined class: UTSSDKModulesDCloudUniGetNetworkTypeIndexSwift, uni-getNetworkType 模块不存在，请重新打自定义基座。`；② 登录页三个输入框的内上沿各有一条**实色白线**（像顶部描了白边），H5 同页无。
- **根因 ①（不是业务代码调 API）**：`easemob-websdk@5.1.3` 的默认 uni runtime 适配器 `onNetworkChange` 里既注册 `uni.onNetworkStatusChange` 又**同步**调 `uni.getNetworkType` 探测网络类型；而 SDK 在 `login → core 构造` 阶段就 `registerNetworkListeners()`。这两个 API 同属 iOS/Android 的 `uni-getNetworkType` UTS 模块，旧自定义基座没把该模块编进去 → 同步抛 `undefined class`；异常冒泡成 login reject，用户看到的就是「登录失败」（不是网络探测失败——探测本身在 Promise 里且已被 SDK catch）。H5/小程序运行时自带该 API，故不复现。
- **修复 ①**：`libs/platform.ts` 新增 `subscribeNetworkStatus()`（只注册 `uni.onNetworkStatusChange`，`offNetworkStatusChange(id)` 反注册，整段 try/catch，基座缺模块时降级为不监听）；`libs/client/index.ts` 经 `platformAdapterOptions.overrides` 把 SDK runtime 换成「委托 getPlatform/onAppVisibilityChange + 自管 onNetworkChange」的实现，**不提供可选的 `getNetworkType` 能力**（SDK 缺省即跳过）。这样登录链路不再依赖 `uni-getNetworkType` 模块，宿主无需为一条诊断信息重打基座；基座有该模块时仍能收网络变化，缺模块时由心跳/重连循环兜底。
- **根因 ②**：iOS 蒸汽端把 `inset` box-shadow 的颜色 alpha 丢了——`box-shadow: inset 0 1px 0 rgba(255,255,255,0.04)` 被画成一条实色白线贴住输入框内上沿（像素实测顶边 lum≈215，而四周边框 lum≈62 正常；H5 同 CSS 无该线）。登录页是全库唯一用 inset 阴影的地方，属 demo 样式不是组件问题。
- **修复 ②**：`demo/pages/login/login.uvue` 输入框去掉全部 `box-shadow`（聚焦态也去掉外发光），聚焦反馈只靠 `border-color` + `background-color`（两端表现一致）。
- **验证**：`build web` ✓（产物 CSS 已无 box-shadow，登录页输入框仅 border + 背景）；`build mp-weixin` 11 项防回归全绿（主包 850KB / 分包合计 1367KB）；H5 产物伺服 200；`check-app-module-graph.mjs` ✓（0 反向 import / 0 循环）；HBuilderX dev watch 已重出 `.app-ios`（`app-service.js` 含 `platformAdapterOptions` 覆盖，`GenPagesLoginLoginSharedData.style.bytes` 已更新）。**待验**：iOS 真机复跑（登录成功、输入框观感、聚焦态）；iOS 断网/恢复时重连是否仍及时（缺模块基座降级为无网络监听，靠心跳重连）；其余 App 端页面在 iOS 的样式巡检（本轮只发现登录页这一处 inset 阴影）。

## 2026-10-21 App 附件能力注入（宿主 provider + 临时文件生命周期）

- **能力注入**：新增 `libs/attachment.ts` 与 `EmKit.setAttachmentProvider(provider)` / `refreshAttachmentAvailability()` / `pickAttachments(options)` / `resolveAttachment(uri, options?)` / `attachments` / `canPickAttachment`。UIKit 不静态 import 任何文件选择器 UTS 插件；App 端 provider 注册后输入栏「文件」格响应式出现，注销/`isAvailable() === false` 时隐藏。H5/小程序继续走 `platform.chooseFile` 内置实现。
- **发送链路**：`em-chat-page.onPickFile` 改为 `pickAttachments`（带 conversationId/chatType/multiple）+ 逐条 `sendFile`，多选任一失败不影响其余；新增 `pickingFile` 防连点与 `error.filePickFailed` 中英文案。`em-chat-inputbar` 的「文件」格改读 `canPickAttachment()`（读 reactive provider 状态），不再直接读 `PLATFORM_CAPABILITIES.filePick`。
- **临时文件**：`EmPickedFile` 扩展 `mimeType?/temporary?/release?`（继承 `EmAttachment`）；`sendFile` 登记 `path → release`，发送成功/重发成功/删除本地消息/`reset()`（登出）时回调清理，失败保留供重发；`asCompatibleFile` 在原生端把 MIME 透传为 `MiniAppFile.type`。
- **demo**：新增 `demo/common/attachment-provider.uts`（chooseFile → prepareFile → removeTempFile 包装为 provider，含多选串行 prepare、取消返回 []、失败提示）；`demo/App.uvue` 用 `#ifdef APP` 条件 import + onLaunch 注册，H5/小程序产物不含插件引用（已 grep 校验 0 命中）。
- **文档**：API-KIT 新增「附件能力注入」章节与导出表；API-TYPES 补 `EmAttachment`/`EmAttachmentProvider`/`EmAttachmentPickOptions`/`EmAttachmentCapability`；PLATFORM 更新 App 文件能力与能力开关语义；MESSAGING 补 sendFile 临时文件说明；changelog/readme 同步。
- **验证**：`build web` ✓；`build mp-weixin` 防回归全绿（主包 853KB / 分包合计 1367KB）；H5 产物静态伺服 200；`check-docs.mjs` ✓（71 个 EmKit 方法）；`check-app-module-graph.mjs` ✓。**待验**：App 真机（Android/iOS/鸿蒙）三端选文件→发送→对端收文件→失败重发→登出清理；HBuilderX CLI `-p app` 资源构建因 demo 外置 `vue` 解析失败不可用，App 侧类型/编译需在 HBuilderX GUI 或真机基座确认。

## 2026-10-21 App 导出日志失败：encoding 传了小程序口径 `'utf8'`

- **症状**：demo「我的 → 导出调试日志」在 App 上只弹「写文件失败，日志全文已复制到剪贴板」；H5 正常下载，微信小程序正常写文件。
- **根因 1**：`libs/platform.ts` 的 `exportTextFile` 给 `FileSystemManager.writeFile` 传 `encoding: 'utf8'`。App 端（Android/iOS/鸿蒙）只支持 `ascii` / `base64` / `utf-8`，非法值走 fail 回调（错误码 1200002），Promise reject → 回退剪贴板。`'utf8'` 恰好是微信小程序接受的写法，所以只有 App 复现。DCloud 文档与 `uni-fileSystemManager` 类型声明均只列 `ascii | base64 | utf-8`。
- **根因 2（观感）**：`uni.env.USER_DATA_PATH` 在 App 是应用沙盒，文件管理器不可见；即便写成功，弹窗里 `file://usr/...` 用户也点不开，容易被当成「导出失败」。
- **修复**：`encoding` 改 `'utf-8'`；`USER_DATA_PATH` 为空时提前 reject（不再拼 `/xxx.txt`）；`exportLogs` 的 catch 补 `kitLogger.warn`（原因进 `[emkit:kit]` 日志，不再静默吞）；`copyText` 补 fail 日志（超长文本剪贴板失败不再假装成功）；demo 弹窗文案区分「写失败（原因见控制台）」与「沙盒路径不可见」。
- **文档/纪律**：API-KIT 的 `exportLogs` 补充沙盒路径说明；skill `em-crossend-pitfalls` 新增 §5g + 能力边界两行（writeFile encoding、USER_DATA_PATH）。
- **验证**：`build web` ✓；`build mp-weixin` 防回归全绿；`check-docs.mjs` ✓；`check-app-module-graph.mjs` ✓。**待验**：App 真机（Android/iOS/鸿蒙）点导出→生成文件且返回沙盒路径、剪贴板可粘贴全文；自定义基座缺 `uni-fileSystemManager` 时回退 `'clipboard'` 且控制台有告警。

## 2026-10-21 App 附件发送失败：SDK md5 读取被 App 文件系统沙盒拦住（`Miniapp file read failed`）

- **症状（App 真机；选文件已成功，发送必失败）**：选完文件后日志停在 `Attachment md5 compute start` → `sendFile fail: UploadError: Miniapp file read failed`，气泡落失败态；`upload.prepare.*` / `upload.precheck.skip(md5-check-disabled)` 都正常，说明问题不在选择器、也不在上传接口。
- **根因**：`easemob-websdk@5.1.3` 的附件上传在**每次上传前**都会用平台 `imageProcessor.computeMd5` 算 md5（`resolveUploadMetadata`），App 上解析到的是小程序处理器：`uni.getFileSystemManager().readFile`。而 App 的 FileSystemManager 只能读 uni 沙盒路径（`uni.env.CACHE_PATH` / `USER_DATA_PATH` / `SANDBOX_PATH` / `ANDROID_INTERNAL_SANDBOX_PATH`），宿主文件选择器（demo 用 `easemob-file-picker`）把副本放在**系统缓存**（iOS `NSTemporaryDirectory()`、Android/鸿蒙原生 cache），FSM 里路径越界 → fail（1300013/1300002）→ SDK 包装成 `Miniapp file read failed` 抛给业务。SDK 只对「FSM 能力缺失（MISSING_CAPABILITY + capability 含 FileSystem）」做容错，readFile 运行期失败是硬错误。H5 走 web-file 处理器、小程序路径本来就在沙盒内，故只有 App 复现。
- **修复**：`libs/client/index.ts` 的 `platformAdapterOptions.overrides` 增加 `imageProcessor` 包装——`getImageInfo` / `generateBigImage` 原样委托平台实现；`computeMd5` 读取失败时降级为空 md5 并打一行 `[emkit:client] attachment md5 unavailable, upload continues without md5: <message + details>`，让 `uni.uploadFile`（原生读文件，不受 FSM 沙盒限制）继续完成上传。md5 只用于服务端秒传预检，SDK 自身对缺能力平台也是「不传 md5 继续上传」，因此不改变消息内容与接收端表现。顺带补 `platformErrorDetail()`：SDK 的 `PlatformAdapterError.details`（filePath/errCode/cause）不再被 message 吞掉。
- **验证**：`build web` ✓（产物含降级 warn，`platformAdapterOptions` 仍传函数单例）；`build mp-weixin` 11 项防回归全绿（主包 854KB / 分包合计 1367KB）；H5 产物静态伺服 200；`check-app-module-graph.mjs` ✓（0 反向 import / 0 循环）；HBuilderX dev watch 已重出 iOS 产物（`demo/unpackage/dist/dev/app-ios/app-service.js`，含 `attachment md5 unavailable` 降级分支，App 编译无新增告警）。**待验**：App 真机复跑选文件→发送→对端收到文件（iOS 优先，Android/鸿蒙随后）；若仍失败，`[emkit:client]` 的 warn 会带 `details.filePath` 与 `errCode`，据此判断是上传阶段问题还是 md5 之外的新问题。
- **纪律**：App 端凡是依赖 `uni.getFileSystemManager` 读**宿主提供的文件路径**的能力都不可靠（FSM 只认 uni 目录）；选择器/分享进入的副本路径一律视为「上传可用、FSM 不可读」。详见 skill `em-crossend-pitfalls` §5h。

## 2026-10-22 会话页 `showTabs` 布尔开关

- **改动**：`em-conversation-page` 新增 `showTabs?: boolean` prop（默认 `true`），`false` 时无论 `tabs` 传什么都不渲染筛选 tab 栏；与既有「`tabs` 传空数组隐藏」并存（模板条件 `showTabs && tabs.length > 0`）。原子组件 `em-conversation-tabs` 不加该 prop，保持纯呈现 + 空数组约定。PLAN.md M2.6 透出清单补登记。
- **文档**：CONFIG / PAGES-CONVERSATION / COMPONENTS-CONVERSATION 三处 `em-conversation-page` 配置表各补一行。

## 2026-10-22 组件样式透出（custom-class / custom-style）+ 样式定制指南

- **背景**：评估宿主「改 UIKit 内部组件样式」的可用通道，结论——变量覆盖五端可靠但只能改全局/子树；同名 class 覆盖在 App 蒸汽端不可靠（ucss 单类选择器无特异性武器、宿主与库 css 合并顺序无契约）；中层组件无单实例样式透出口。据此落地统一样式透出契约。
- **契约**：全部 33 个公开组件（26 原子 + 7 页面级）根节点统一新增 `customClass` / `customStyle` 两个可选 prop：customClass 追加到根节点 class；customStyle 拼接到根节点内联 style 末尾（五端必生效、可引用 `var()`）。特殊结构：弹层类（em-action-sheet / em-select-contact / em-mention-picker）显式透传给 em-popup、落在最外层遮罩容器（em-action-sheet 初版走 class fallthrough，已统一为显式 prop 透传）；em-skeleton 三个互斥根各自绑定；em-text 保留既有 textClass/textStyle 双通道（文字节点），customClass/customStyle 落在根 view；页面级组件拼在 `primaryColorStyle()` 之后，宿主可覆盖品牌色内联值。
- **使用口径（写进对外文档）**：追加组件未设置的属性用 custom-class；覆盖组件已设置的属性用 custom-style；批量换肤用 `--em-*` 变量；整区结构替换用具名插槽。App 端不要用同名 class 覆盖组件内部属性。
- **Demo**：`sub-im/pages/style-lab` 新增「宿主样式覆盖」三组对照——custom-style 卡片底（em-empty）、custom-class 主色描边（em-empty，只加组件未设置的边框属性）、变量覆盖品牌橙（themeClass + 自定义 class 子树换 `--em-primary-color`）。
- **文档**：新增公开页 `docs/GUIDE-STYLING.md`（manifest 已登记，「设计与运行」组，四通道决策表 + 平台边界矩阵 + 文字样式特殊性 + 完整示例）；COMPONENTS.md 总览补统一定段 + 四个家族页各补一句透出说明；DESIGN-TOKENS §5 加交叉链接；changelog 起 `1.0.0-rc.2（未发布）` 段；宿主技能 `em-host-theme-i18n` §2.3 覆盖边界同步；AGENTS.md 文档索引登记。
- **验证**：`check-docs.mjs` ✓（28 页 / 33 组件 / 71 EmKit 方法 / 24 配置字段）；`check-skills.mjs` ✓；`build web` ✓；H5 产物静态伺服 200 ✓；`build mp-weixin` 11 项防回归全绿（主包 857KB / 分包合计 1369KB）。**mp-weixin 穿透机制静态验证**：产物 style-lab.wxss 含 `.lab__empty-override` / `.lab__brand` 页面级规则；style-lab.wxml 向 em-empty 传 `custom-class`；em-empty.js 的 Component options 带 `styleIsolation:"app-and-page"` 且 vendor 运行时将其映射为 `apply-shared`（页面 wxss 可影响组件内部，父组件 wxss 不可）——与评估结论一致。
- **真机反馈修复（2026-10-22 当晚）**：style-lab「变量覆盖品牌橙」在 App 真机不生效——class 方式覆盖变量与 `.em-theme-*` 各组件拷贝同特异性拼声明顺序被顶掉（坑集新增 §5i）。demo 改内联 `:style` 绑定变量（`brandVarStyle`，与 `primaryColorStyle()` 同机制）；GUIDE-STYLING §3 改以内联形式为主示例、§6/§7 同步；DESIGN-TOKENS §5.2 补 App 端警示。
- **运行时主题色拖拽演示（2026-10-22 当晚二轮）**：style-lab 新增「拖动色相条换全页主色」——36 段 JS 预算 hex 拼纯色相条（不依赖各端 CSS 渐变/色函数），拖拽几何用 em-alphabet-nav 同款 `createSelectorQuery().in(instance).boundingClientRect()` 惰性缓存模式；双通道生效：页面根 scroll-view 内联 `brandVars`（`--em-primary-color` + 派生 `--em-primary-hover`/`--em-bubble-bg-self`/`--em-bg-active` 一起算）+ `setConfig({ primaryColor })`（页面级组件跟随）。setConfig 运行时不写 H5 documentElement（仅 init 路径写）、不持久化——GUIDE-STYLING §3 新增「运行时换主题色」小节写明这两条边界。
- **iOS 拖拽修复（2026-10-22 当晚三轮，真机确认）**：色相条在 iOS 完全拖不动、mp 正常——`createSelectorQuery` 异步查询在蒸汽端拿不到 rect（坑集新增 §5j）。改 `getWindowInfo().windowWidth` 同步算几何（条在 16px 页面边距内通栏）+ 拖拽期间 `:scroll-y="!hueSliding"` 锁定根 scroll-view；iOS 真机已确认可拖。style-lab 另加「覆盖机制探针」P1–P5（class 变量 / 内联变量→组件 / custom-style 字面量 / custom-style var / 内联变量→宿主文本），用于定位蒸汽端内联 `--em-*` 的真实支持度。
- **蒸汽端变量级联定论（2026-10-22 当晚四轮，iOS 探针实证）**：探针 P1–P5 全橙但「品牌橙」仍蓝，对比定位两条非标准规则——① class 方式覆盖变量结果随构建漂移（§5i 改写：同写法两版构建一蓝一橙，顺序无契约铁证）；② **同节点 class 变量顶掉内联变量**（新增 §5k：内联只能赢继承值；普通属性不受影响，P3 字面量正常）。由此发现库 bug：7 个页面级组件根节点 `themeClass + primaryColorStyle()` 同节点绑定，`primaryColor` 在 App 端从未生效——统一加 `__brand-scope` 内层节点（css `flex:1 + height:0` 接替根的 flex 角色），根 `:style` 只留宿主 customStyle。style-lab 同步分层：根 scroll-view 留 themeClass，内层 `.lab__theme-scope` 绑 brandVars；「品牌橙」demo 去掉同节点 themeClass。文档：GUIDE-STYLING §3 重写（两条 App 限制 + 分节点示例）；DESIGN-TOKENS §5.1 改内层包裹写法；THEME-I18N §4 品牌色描述同步；changelog rc.2 增「修复」段。
- **待验**：iOS 真机复测——拖色相条整页实时换色（brandVars 下沉内层后应生效）、品牌橙按钮变橙、登录后各页面组件跟随 `primaryColor`；em-alphabet-nav 滑动定位改同步几何；四个 COMPONENTS-* 家族页 props 表逐组件补两行；package.json 版本随 rc.2 发布时再 bump。

## 2026-10-22 输入栏整栏自绘（`#input-bar`）+ `useChatComposer` 行为核心抽取（M2.16）

- **背景**：宿主对整个输入栏不满意时只能 fork em-chat-inputbar（约 470 行），但键盘避让（iOS/鸿蒙安全区双口径）、键盘↔面板互斥、录音手势状态机、禁言守卫、@ 触发检测是跨端实测收口的逻辑，裸 fork 必丢。定案「受约束整栏替换」：行为核心下沉 composable 单一实现，插槽 scope 即契约。
- **内核**：新增 `libs/use/useChatComposer.ts`（自 em-chat-inputbar 纯搬迁：rootStyle/panelStyle、面板三态互斥、录音状态机、禁用守卫）；em-chat-inputbar 改消费之（props/emits 不变）；em-chat-page 新增 `#input-bar` 作用域插槽（`EmChatInputBarScope`，页面保留键盘顶起壳），自绘路径 @ 触发检测上移页面（watch draft 同款逻辑）、消息区点击直调 composer.collapse；插槽有无静态确定（setup 实例化 composer），不支持同实例运行时切换。`libs` 导出 `useChatComposer` 及四个新类型（EmChatInputBarScope/EmChatComposerPanel/EmChatComposerPanelKind/EmChatComposerTouchEvent，均进 libs/types）。
- **Demo**：`demo/components/demo-custom-inputbar`（全自绘参考实现：快捷回复/引用/语音/emoji/媒体全走 scope）；聊天页 `?inputbar=custom` 切换。两个可见入口：场景详情页主按钮下方描边次按钮「用自绘输入栏进入」（openChat 带 inputbar=custom）；聊天内场景面板「整栏自绘输入栏」按钮（redirectTo 重进生效——插槽有无必须页面级静态确定）。DEMO.md 补组件表行 + 「整栏自绘输入栏」小节。
- **文档**：PAGES-CHAT 新增「整栏自绘输入栏」节（scope 契约表：必须接/库内保持清单 + 最小示例）；API-TYPES 增 `EmChatInputBarScope`；COMPONENTS-CHAT 补「行为核心复用」段；GUIDE-STYLING/COMPONENTS/HOME 各补入口行；PLAN 登记 M2.16；skill em-component-structure 透出契约表补行。
- **验证**：`check-docs.mjs` ✓（28 页/33 组件/71 方法/24 字段）；`check-skills.mjs` ✓；`build web` ✓（demo-custom-inputbar 的 possibly-null warning 与 demo-composer-bar 等本地 ns 对象为同款编译器存量告警）；H5 产物静态伺服 200 ✓；`build mp-weixin` 11 项防回归全绿（主包 876KB / 分包合计 1371KB）。**待验**：自绘路径真机（App/小程序）键盘顶起、面板互切、录音发送、群聊 @ 面板、禁言 toast；demo-custom-inputbar 五端渲染。

## 2026-10-22 气泡几何尺寸 token 化 + 气泡定制配方文档

- **背景**：盘点「改对方/己方气泡样式」的便捷度。结论：颜色类已便捷（`--em-bubble-bg-self/other`、`--em-bubble-text-self/other/-self-secondary` 收口 `libs/style/bubble.css` 基类，五种气泡共用，明暗全量）；缺口在几何尺寸写死（文本气泡 `12px 14px`、语音 `10px 14px`、文件卡 `166~240px` + `10px 12px`），App 端无同名 class 覆盖武器，实质改不了。
- **改动（零破坏，默认值=原写死值）**：`variables.css` 共享块新增 8 个几何 token——`--em-bubble-padding-x/y`（文本气泡）、`--em-audio-bubble-padding-x/y`（语音气泡）、`--em-file-card-padding-x/y` + `--em-file-card-min-width/max-width`（文件卡）；`em-text-message.css` / `em-audio-message.css` / `em-file-message.css` 改消费 var()。图片/视频气泡无 padding（媒体即气泡），不动。
- **顺带发现（未改）**：`em-chat-page.css:242` 注释称占位气泡 padding 来自 `.em-bubble` 基类，但基类只定义底色/圆角——占位气泡实际无 padding，注释与实现不一致，留待后续确认是否补 padding。
- **文档**：DESIGN-TOKENS §4.4 登记 8 个新 token；GUIDE-STYLING 新增 §5「聊天气泡定制」——高频诉求→变量对照表、「`em-chat-page` 的 `custom-style` 传变量串 = 单页气泡换肤」配方（根节点内联变量沿子树继承，五端可靠、不污染其他页面）、边界说明（标准消息无整卡插槽，结构替换走 `#custom-message`/`#stream-message`；描边/阴影/非对称字号 App 端不可靠）。原 §5–§7 顺延为 §6–§8。
- **Demo**：style-lab 新增「气泡变量定制」对照组——内层包裹节点绑 `bubbleVarStyle`（对方暖黄底/棕字、己方橙底白字、padding-y 16px），渲染一对方一己方两条 em-text-message，验证子树内联变量只影响本组气泡（与色相条 brandVars 的全局 `--em-bubble-bg-self` 形成作用域对照）。
- **验证**：`check-docs.mjs` ✓（28 页 / 33 组件 / 71 方法 / 24 字段）；`build web` ✓（产物 css 已含 `--em-bubble-padding-*`，style-lab 产物含 `lab__bubble-row`；存量 demo-custom-inputbar null 告警不变）；H5 产物静态伺服 200 ✓；`build mp-weixin` 11 项防回归全绿（主包 887KB / 分包合计 1380KB）。**待验**：style-lab 新演示组各端渲染（尤其 App 端内联变量对 padding 的生效）。

## 2026-10-22 样式实验室改版：hub 目录页 + 五个二级专项页

- **背景**：style-lab 单页 743 行、14 个板块混杂 token 阶梯/原子组件/交互演示；「我的」页两个入口（流式气泡演示、样式实验室）同指一页，单页已超载。
- **结构**（照搬场景实验室 hub + 二级页模式，全部在 sub-im 分包）：`style-lab.uvue` 改造为目录页（保留主题三档循环 + 中英切换，themeStore 全局对子页生效；入口卡片列表 navigateTo）；新增五个专项页——`tokens`（文字/背景/气泡徽标/间距/字号五组阶梯）、`components`（em-avatar/em-icon/em-empty/em-skeleton）、`theming`（运行时色相条换色 + 气泡变量定制）、`overrides`（宿主覆盖三组对照 + P1–P5 探针）、`stream`（AI 流式气泡演示）。模板/脚本/样式纯搬运不改演示逻辑，坑集约束随代码走（内联变量与 themeClass 分节点、流式气泡 rpx 定宽、色相条同步几何）。
- **入口**：「我的」页「流式气泡演示（样式实验室）」改为直达 `/sub-im/pages/style-lab/stream`、文案改「AI 流式气泡演示」；「样式实验室」仍进 hub。pages.json sub-im 注册 5 条新路由。
- **文档**：DEMO.md（目录说明 + 我的页/样式实验室表格行 + 体验矩阵两行）、GUIDE-STYLING §3/§7（指向 theming/overrides 子页路径）、AI-STREAM.md 入口表同步。
- **验证**：见当日门禁记录（check-docs + build web + build mp-weixin 11 项 + H5 伺服）。**待验**：hub 跳转与各专项页在 App/小程序真机渲染（尤其 theming 页色相条拖拽与 overrides 探针分层结构未变、预期行为一致）。

## 2026-10-22 修复：style-lab 原子组件页 em-avatar 徽标被裁平顶（蒸汽端祖先层二次裁剪）

- **症状**：样式实验室「原子组件」页（iOS 真机截图）em-avatar 的 `badge=3` / `badge=120` 徽标顶边被水平切平；dot 小红点基本正常（负偏移仅 2px）。
- **根因**：坑集「overflow 默认值坑」的祖先链版本——em-avatar 根节点早已显式 `overflow: visible`，但徽标负偏移探出头像盒后，外层 `.lab__avatars` flex 行（高度恰等于头像高）在蒸汽端默认 `overflow: hidden`，把探出部分二次裁掉。H5/mp view 默认 visible 所以只在 App 端暴露。库内消费点（会话列表未读在行尾、通讯录入口红点）都不经过「徽标负偏移探出」路径，不受影响；该路径仅 demo 演示页走到。
- **修复**（demo 侧）：`components.uvue` 的 `.lab__avatars` 与 `.lab__avatar-item` 显式 `overflow: visible`；顺手把打在 virtualHost 组件上的 `lab__avatar-item` 布局 class 改为普通 view 包裹（坑集 §8a：mp 上该类会被样式隔离拦截，margin 丢失）。
- **沉淀**：编码纪律 skill「overflow 默认值坑」补「裁剪沿祖先链逐层生效，探出路径上每一层包裹都要放行」；COMPONENTS-BASIC em-avatar「行为与平台」补两条边界（App 祖先层 overflow、mp 布局 class 用 view 包裹）。
- **验证**：`check-docs.mjs` ✓；`build web` ✓；H5 伺服 200 ✓；`build mp-weixin` 11 项防回归全绿（主包 888KB / 分包合计 1412KB）。**待验**：App 真机复看徽标完整药丸形态。


## 2026-10-22 修复：iOS 创建群组标题被灵动岛遮挡（全屏选人安全区承载层）

- **根因**：iPhone 14 Pro 实测 `getSafeAreaTop()` 返回 59，并非安全区读取为 0。对照探针证明：`em-popup` fullscreen panel 额外增加 60pt 时标题不动，内层 `em-select-contact__sheet` 增加同样数值时标题立即移动——iOS 蒸汽端该 panel 的 padding 不参与布局，原先放在 `em-popup.panelStyle` 的顶部安全区实际未生效。
- **修复**：`em-select-contact` multiple 的 `sheetStyle` 直接注入 `padding-top: getSafeAreaTop()`，内容高度同步扣除同一值，保持总高不变；`em-popup` 移除失效的顶部处理、保留底部安全区。建群、邀请入群、批量移除成员三条 multiple 路径共用此修复。
- **同类走查**：群成员管理全屏覆盖层及 7 个 custom 页面均复用 `em-nav-bar`，登录页单独读取 `getSafeAreaTop()`，本次未改其路径；单聊选人、@ 提及、action-sheet、居中编辑弹层均为半屏/居中形态，其余 demo 页使用原生导航栏，不属于同类贴顶风险。未发现另一套完全缺失顶部安全区的贴顶交互页。
- **验证**：iOS 真实群组路径渲染确认标题/关闭键位于灵动岛下方、底部确认键正常；临时诊断与直达探针全部还原。`build web` ✓；H5 产物静态伺服 200 ✓；`build mp-weixin` 11 项防回归全绿（主包 888KB / 分包合计 1412KB）。邀请/移除成员共享组件已做调用链走查，真实群数据下的逐项操作仍随群链路真机回归。

## 2026-10-22 消息删除、复制与发送/撤回防重（M2.17 Task 2）

- **删除**：新增 `EmKit.deleteMessage(message)`；`message.id` 非空时先 `removeHistoryMessages` 再本地移除，空 id 不等待 SDK、仅本地删除，漫游失败保留气泡并抛错。`deleteLocalMessage` 保留显式本地删除；chat 门面组合会话域 `syncMessageSummary`，按剩余最后一条校正摘要/时间，空列表清零。聊天页删除先确认、按 localId 防重，成功才 emit `delete`，失败 toast `message.delete.failed`。
- **复制**：`copyText` 改 Promise，空文本/同步异常/原生 fail 均 reject，`showToast:false` 关闭原生提示；聊天页统一 `message.copySuccess/copyFailed`，日志导出两个既有调用点均 await 并保持 best-effort 语义。
- **防重**：`em-chat-inputbar.submitting=false` 与 `em-quick-reply-bar.disabled=false` 非 breaking 扩展；文本/直发快捷回复共享提交锁，重发按 localId 在等待 SDK 前占锁（失败仍由 domain 恢复 FAILED），撤回按 localId 防重且执行时重查 `recallTimeLimit`，不新增撤回确认。
- **文档**：API-KIT / MESSAGING / PAGES-CHAT / COMPONENTS-CHAT / changelog、宿主技能与内部架构/组件契约同步；PLAN M2.17 补消息交互范围。
- **验证**：一次性 RED 0/10 → GREEN 10/10（真实 EmChat/platform + 组件源码契约；临时文件已删除）；`check-docs.mjs` ✓（72 方法）；`check-skills.mjs` ✓；`build web` ✓；`build mp-weixin` 11 项全绿（主包 892KB / 分包合计 1414KB）；H5 静态伺服 200 ✓；`git diff --check` ✓。**待验**：真实账号漫游删除后重进/重拉不复活、漫游失败保留、各端连点与复制原生提示（H5/mp/App 真机或模拟器）。
- **审查修复**：`syncMessageSummary` 对剩余最新 recalled 消息改用 `message.recalledPreview`，不再还原原文；`deleteLocalMessage` 内部返回实际命中状态，未加载列表/陈旧 localId 的 no-op 不改摘要或上传缓存，只有真实删除才校正，已加载空列表仍清零。专项 RED 2/5（3 个预期失败）→ GREEN 5/5；web/mp/H5 与文档/技能门禁复跑通过。真实账号与五端人工矩阵仍未执行，明确留 Task 6。

## 2026-10-22 会话与联系人操作闭环（M2.17 Task 3）

- **会话设置**：pin/mute 按会话与设置项独立串行，乐观回写最新意图，旧成功/失败不回写，最新失败回滚最近已确认值；pin 在途快照保留本地状态，mute 批量校正按请求序号忽略旧响应。chat-info 开关改 computed 直读 conversationStore，请求中 disabled。
- **破坏性操作**：会话列表删除先原生确认，pin/mute/delete 按会话+动作加锁；chat-info 清空/删除/退群/解散及联系人删除增加提交锁，deleted/leaved 设成功闩，每个页面实例最多发一次，覆盖宿主导航完成前的二次点击。`removeConversationLocal` 同步清持久化草稿。
- **联系人/demo**：`onContactAdded` 将匹配 received contact pending 置 accepted 并持久化，申请页操作区与未读角标响应式收敛；删除好友按 userId 防重。demo 添加好友表单补 sending/disabled 与请求代次，旧完成回调不影响重开表单，UI 仍留在宿主。
- **验证**：一次性首轮 RED 1/10 → GREEN 10/10；自审补旧同步响应/在途快照两条后 RED 10/12 → GREEN 12/12；最终补删除/退群成功闩专项 RED→GREEN 1/1（临时文件已删除）；`build web` ✓；`build mp-weixin` 11 项全绿（主包 896KB / 分包合计 1414KB）；H5 静态伺服 200 ✓；App 模块图 ✓；`git diff --check` ✓。**待验**：真实账号并发/失败矩阵、各端原生连点与确认弹层、roster 事件及持久化冷启动、微信开发者工具与 App 真机。

## 2026-10-22 聊天详情页删除好友入口（M2.17 Task 3 规划项补落地）

- **背景**：PLAN M2.17「chat-info …删除好友增加提交锁，成功事件只发一次」中 chat-info 的删除好友入口当时未随 Task 3 落地（仅好友列表长按删除可用）；vue 版 locale 已预留 `chat.info.deleteFriend*` 四条文案。
- **实现**：`em-chat-info-page` 单聊分支 footer 新增 danger 档「删除好友」按钮（与退群/解散同档样式），仅对方已是好友（`contactStore.items` 命中）时显示；`uni.showModal` 二次确认 → `EmKit.deleteContact`（内部刷新好友快照）；`deletingContact` 提交锁 + `contactDeleted` 成功闩，成功 toast 并 emit `contact-deleted`（每实例最多一次），失败 toast `chat.info.deleteFriendFailed` 停留当前页；不连带删会话/清消息，会话去留由宿主决定。i18n 中英新增 `chat.info.deleteFriend/deleteFriendConfirm/deleteFriendSuccess/deleteFriendFailed`（key 与 vue 版一致）。
- **demo/文档**：demo `chat-info.uvue` 接线 `@contact-deleted` → 退回会话列表（delta 2，与 deleted/leaved 同处理）；PAGES-CHAT-INFO（能力/Events/宿主接线/行为边界）、宿主技能 `em-host-conversation-chat`（接线示例/事件表/页面一句话）、changelog 1.0.0-rc.2 同步。
- **验证**：`check-docs.mjs` ✓（28 页 / 33 组件 / 72 方法）；`check-skills.mjs` ✓；`build web` ✓；H5 产物静态伺服 200 ✓；`build mp-weixin` 11 项防回归全绿（主包 899KB / 分包合计 1414KB）。**待验**：真实账号删除好友后双方 roster 事件联动、非好友单聊（陌生人会话）按钮不显示、五端连点防重。

## 2026-10-22 AI 演示浮钮：可配置显隐 + 上移避让引用条

- **问题**：聊天页「AI 演示」浮钮（demo 层，`chat.uvue`）无条件渲染不可关闭；`bottom:96px` 正好落在输入栏引用条（`.em-chat-inputbar__quotebar`）垂直带上，右侧盖住引用条关闭按钮。
- **改动**：`demo/common/ai-stream-demo.ts` 新增 `AI_STREAM_FAB_VISIBLE` 常量总开关（置 false 即关，仍属 demo 层不进 UIKit）；`chat.uvue` 浮钮加 `v-if` 消费。浮钮 `bottom: 96px → 150px` 抬到引用条/快捷回复条之上、浮于消息列表右下角；「场景开关」浮钮同步 `140px → 194px` 保持 44px 错开。
- **文档**：`docs/AI-STREAM.md` 演示入口表同步位置描述与关闭方式。
- **验证**：`check-docs.mjs` ✓（28 页/33 组件/72 方法/24 配置）；`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 898KB / 分包合计 1414KB）；H5 产物静态伺服 200 ✓。**待验**：App/小程序真机复看浮钮与引用条、场景浮钮的相对位置。

## 2026-10-22 会话与联系人闭环审查修复（Task 3 Fix Round 1）

- **跨动作退出**：chat-info 的 deleted/leaved 改用共享 `exitCompleted`，动作入口与成功回调双重检查；delete/leave 同时 pending 时仅先完成者发事件，后完成者不再触发第二次导航。
- **回滚基线**：无本地在途意图时，多设备 mute、批量 mute 校正及 pin 快照同步更新队列 `settledValue`，后续本地失败不得恢复更旧的本地状态。
- **生命周期失效**：pin/mute 队列增加会话与账号代次；删除会话和 reset 分别提升代次，旧成功/失败闭包不得写入重建的同 ID 会话或新账号状态。
- **申请收敛**：`onContactAdded` 接受同发送者全部 received contact-pending，不再只处理第一条；outgoing/group/其他用户不受影响。
- **验证**：domain/contact 首轮 RED 0/8，分阶段 3/8、7/8，最终 GREEN 8/8；真实 chat-info setup 两种交叉完成顺序 RED 0/2 → GREEN 2/2；`build web` ✓；`build mp-weixin` 11 项全绿（主包 899KB / 分包合计 1414KB）；H5 静态伺服 200 ✓；App 模块图与 `git diff --check` ✓。保留同期 Task 4 删除好友与 demo 其他改动，未扩大修复范围。真实账号与端侧人工矩阵仍待验。

## 2026-10-22 样式实验室「通用提交态与错误态」独立子页 + loading spinner 转圈修复

- **背景**：10-22 改版拆出 hub + 5 个专项页时，「通用提交态与错误态」仍内联在 hub 页；且 em-button / em-load-more 的 spinner 是静态 iconfont 字形从未绑动画——蒸汽端 5.26 不跑 `@keyframes`，vue 版 CSS 动画方案不可移植，组件注释写死「静态 spinner 一期不用动画」。
- **结构**：新增 `demo/sub-im/pages/style-lab/states.uvue`（照搬专项页范式），迁入三个 demo——em-button loading 常显档、em-load-more 错误态（**重试改为真实状态流转**：点击 → LOADING 1.2s → 回 ERROR，此前只计数不切状态、点击零反馈）、选人提交态弹层。hub `style-lab.uvue` 删内联 section（含无用 script/styles），ENTRIES 加第 6 张卡片；pages.json sub-im 注册路由；DEMO.md 目录表加一行。
- **动画**：新增 `libs/use/useSpinRotation.ts`——watch 启停 `setInterval`（30°/80ms，一圈 800ms，对齐 vue 版 `uikit-spin 0.8s`；初版 400ms 被反馈太快难看，已调慢）逐帧写内联 `transform: rotate()`，inactive 归零、onUnmounted 清理；em-button / em-load-more 的 EmIcon 绑 `custom-style="spinStyle"`（EmIcon 已透传）。口径同 em-audio-message 波柱 / chat-page 引用定位脉冲。范围外：chat-page 发送中 spinner 仍 keyframes（H5/mp 转、蒸汽静态）不动。
- **文档/skill**：坑集 §3 解法与能力表「发送中 spinner」行更新为 JS 驱动口径。
- **验证**：`check-app-module-graph` ✓（131 模块无环）；`check-docs.mjs` ✓（28 页/33 组件/72 方法/24 字段）；`check-skills.mjs` ✓；`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 900KB / 分包合计 1420KB）；H5 静态伺服 200 ✓ + headless Chrome 冒烟：states 页三个板块渲染、spinner 内联 rotate 角度随采样时点变化（90°/225°）、hub 第 6 张卡片文案在 DOM。**待验**：蒸汽端真机 `<text>` 内联 transform 逐帧渲染性能与观感、mp 真机重试流转。

## 2026-10-22 设置在途权威更新回滚基线（Task 3 Fix Round 2）

- **语义**：multi-device/batch/pin 权威值在本地请求在途时仍写 `queue.settledValue`，但只作最新确认/回滚基线，不覆盖当前乐观 UI；本地成功以本地值为最终确认，失败读取失败当下的基线回滚。
- **过期与排队保护**：批量查询和会话 refresh 按 requestId 排除发出后产生更新本地意图的过期响应；多个 queued intents 按实际完成顺序更新基线。会话/账号 generation 失效机制保持不变。
- **验证**：有效 RED 6/10（4 个目标失败）→ GREEN 10/10，覆盖三类 pending→authoritative→failure/success、queued intents、stale batch/refresh 与 generation；`build web` ✓；`build mp-weixin` 11 项全绿（主包 900KB / 分包合计 1420KB）；H5 静态伺服 200 ✓；App 模块图与 `git diff --check` ✓。真实 SDK 多设备/同步时序及端侧快速切换仍待验。

## 2026-10-22 设置读取与本地结算顺序保护（Task 3 Fix Round 3）

- **结算修订号**：pin/mute 队列新增 `settlementRevision`，本地成功/失败结算后递增；批量查询和会话 refresh 同时校验 requestId 与 settlementRevision，防止读取在途期间发生本地结算后，旧响应因 pendingCount 归零而覆盖成功状态或回滚基线。
- **兼容语义**：结算前到达的新鲜权威值仍只更新 pending 回滚基线、不改乐观 UI；结算后新发起的读取正常生效；queued operations 与 generation 失效机制不变。
- **验证**：RED 4/10（6 个 reverse-order 目标失败）→ GREEN 10/10，覆盖 batch/refresh 的成功与失败反序、queued 成功/失败、结算后读取、Round 2 pending 基线和 generation；`build web` ✓；`build mp-weixin` 11 项全绿（主包 905KB / 分包合计 1420KB）；H5 静态伺服 200 ✓；App 模块图与 `git diff --check` ✓。真实网络时序与端侧快速切换仍待验。

## 2026-10-22 输入栏多行撑开输入（PLAN M2.18）

- **背景**：一期输入栏单行 input，长文体验差；vue 版展开交互是 PC 拖拽卡片形态，移动端按微信手机版重做（固定 1/3 屏高，非富文本，图文混排 editor 方案另行评估）。
- **内核**：`useChatComposer` 新增 `expanded`/`textareaFocus` + `toggleExpanded()`；input↔textarea 组件切换期间抑制旧组件 blur 的键盘高度清零（防输入栏掉底闪跳，新组件 focus 到达解除 + 500ms 兜底）；开面板/进语音模式/禁言翻转三处自动退出撑开态。
- **组件**：`em-chat-inputbar` 收起态加撑开按钮（vue 同款 `polyline-topright`，iconfont 已有字形零字体改动）；撑开态 = 固定 1/3 屏高 textarea（windowHeight/3，同 mention-picker 60% 口径）+ chevron-down 收起键 + 工具/发送行（mic/emoji/⊕ 移入下行）。草稿 v-model 共享，禁言守卫沿用。
- **透出**：`EmInputFeatures` 加 `expand`（config.ts 默认 true，`uiConfig.inputFeatures.expand=false` 关闭）；`EmChatInputBarScope` 加 `expanded`/`toggleExpanded`/`textareaFocus`，em-chat-page 插槽绑定同步；i18n 中英 `chat.input.expand/collapse`（vue 同名 key）。文档：CONFIG.md（默认值+说明行）、COMPONENTS-CHAT.md 示例、API-TYPES scope 表、PAGES-CHAT 输入栏节；PLAN 登记 M2.18；changelog rc.2 新增一条。
- **验证**：`check-docs.mjs` ✓（28 页 / 33 组件 / 72 方法 / 24 配置字段）；`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 905KB / 分包合计 1420KB）；H5 产物静态伺服 200 ✓；App 模块图 ✓。
- **真机反馈修正（2026-10-22 晚）**：① 撑开 icon 由常驻改条件显隐——单行 input 承载不了换行，仅当草稿已含 `\n`（典型为粘贴多行文本）才出现入口；② iOS 真机展开态 textarea 区域整体「消失」（无灰底无占位符）——textarea 为原生组件（iOS=UITextView），蒸汽端不吃 flex 尺寸、背景样式不可靠（官方文档明示 App 默认宽 300px），定案为包裹层 view 承担固定 1/3 屏高 + 灰底 + 圆角 + 裁切，textarea `width/height:100%` 填充 + `disable-default-padding`；坑入 `em-crossend-pitfalls` §5l。③ 修②引入的回归：script 计算属性误用模板自动暴露名 `features.expand`（应为 `props.features.expand`），setup 期 ReferenceError 被蒸汽端吞掉 → 进聊天页全屏白屏无报错；坑入 §5m。CLI 构建不做类型检查构建全绿但运行必白屏，引以为戒。
- **交互迭代（2026-10-22 晚，第三版）**：真机反馈「单行 input 存不下换行、打字永远触发不了撑开 icon」是死胡同——按微信「回车键发送消息」三件套重做：`inputFeatures.sendOnReturn`（默认 true 零回归）——false=换行输入档（全端生长 textarea，回车=换行、发送走栏上按钮、封顶 5 行由 linechange 驱动转固定高度内滚）；true=回车发送档（iOS 用生长 textarea + `confirm-type=send`，UITextView 粘贴保留换行且键盘仍发送；Android 系统限制 textarea 键盘恒换行，其余端保持单行 input 零回归）。撑开 icon 规则不变（草稿含 `\n`，换行档打字即可触发）。新增 `EmTextareaLineChangeEvent` 入 libs/types；demo 登录 init 置 `sendOnReturn:false` 演示换行档；文档/PLAN/changelog 同步。验证：check-docs ✓ / build web ✓ / build mp-weixin 11 项全绿 / App 模块图 ✓。**待验**：真机三档各自表现（重点 iOS 换行档生长与封顶、Android 换行档键盘、生长 textarea 包裹层灰底在蒸汽端渲染）。
- **真机反馈修正二（2026-10-22 晚，第四版）**：iOS 真机反馈「多行输入框椭圆难看 + 打了 5 行字不见撑开 icon」。修：① 多行输入区圆角 999px 胶囊改 6px 小圆角（新增 `--em-component-radius` token，值对齐 vue 多行输入卡；全屏 1/3 屏输入区同步，DESIGN-TOKENS 登记）；② 蒸汽端原生 textarea 布局/事件值不可靠实证：文字绘制高度 ≠ 布局高度（文字溢出灰底胶囊）、v-model 不回传 `\n`（draft.includes 判断永不成立、icon 不出现）——定案全部 JS 驱动：包裹层高度跟 linechange 上报值走（含封顶冻结）、padding 归包裹层、撑开 icon 按可视行数 ≥2 显隐（单行 input 档仍回落 draft `\n`）；坑补入 §5l。**待验**：iOS 真机复看小圆角观感、包裹层与文字贴合度、icon 出现时机、封顶内滚。**待验**：蒸汽端（尤其鸿蒙）与小程序真机的 input↔textarea 焦点迁移键盘闪跳、撑开态键盘顶起安全区、`show-confirm-bar` 各端差异、包裹层修复后 iOS 真机复看。

## 2026-10-22 群管理确认、权限与提交反馈（M2.17 Task 4）

- **权限/确认**：新增 `canRemoveGroupMember`，owner 可移除非自己且非 owner 的成员，admin 仅可移除普通 member；单成员菜单、批量候选与提交载荷共用，确认时按最新角色/成员重验。设撤管理员补带成员姓名确认，转让说明自己将成为普通成员；成员写操作共享可 await pending 链并使用独立成功/失败文案。
- **提交/刷新**：邀请、批量移除、建群接入 `em-select-contact.submitting`；批量提交过滤失效/无权限/重复 ID，全部失效不请求并提示。单条/批量移除成功后重拉群详情与成员首屏，移除失败保留批量选择和弹层；群名/公告保存中拦截遮罩与取消关闭。
- **通知**：多成员进出文案同时提供中文总人数 `count` 与英文其余人数 `othersCount`，修正英文 “and N others” 多数一人的问题，中文口径不变。
- **验证**：临时 focused RED 14 项失败 → GREEN（含可执行三角色权限矩阵）；zh-CN/en 241 keys parity ✓；App 模块图 ✓；`build web` ✓；`build mp-weixin` 11 项全绿（主包 910KB / 分包合计 1420KB）；H5 静态伺服 200 ✓；`git diff --check` ✓。**待验**：真实账号 owner/admin/member 菜单与确认、SDK 失败时状态保留、权限变化中的陈旧提交、保存中各端遮罩/取消、群详情与 memberCount 权威刷新。

## 2026-10-22 群移除刷新顺序审查修复（Task 4 Fix Round 1）

- **等待语义**：单条/批量移除后的详情与成员刷新分别 catch，外层等待两个尝试均 settle；一个失败不再提前关窗/解锁或清 pending。
- **权威顺序**：`getGroupInfo(groupId, force=false)` 可选强制重读并透传门面；详情/成员按 groupId 记录请求序号，只有最新响应可写 store，旧预拉不能恢复 memberCount 或重加已移除成员；旧详情 finally 不清新请求 pending。普通 enterGroup/dedupe 不变。
- **验证**：deferred RED 5 项 → GREEN，覆盖一失败一 pending、移除时预拉在途、旧响应晚于强制响应、普通 dedupe；App 模块图 ✓；`build web` ✓；`build mp-weixin` 11 项全绿（主包 910KB / 分包合计 1420KB）；H5 静态伺服 200 ✓。真实 SDK 时序与端侧观感仍待验。

## 2026-10-22 群管理员陈旧合并审查修复（Task 4 Fix Round 2）

- **失效与重拉**：移除成功递增 admin 请求代次、释放旧 pending 引用并复位 adminSynced，移除后首屏可强制新鲜 getAdmins；旧成功响应不得 append/角色回写，旧失败/完成不得清新 pending。
- **普通行为**：无移除时首屏仍复用在途 getAdmins，角色校正、按 ID 去重 append 与 adminSynced 防重不变；公开 API 不变。
- **验证**：deferred RED 5 项 → GREEN，覆盖旧 admin 成功/失败、移除后 fresh 响应及无关普通首屏；App 模块图 ✓；`build web` ✓；`build mp-weixin` 11 项全绿（主包 911KB / 分包合计 1420KB）；H5 静态伺服 200 ✓。真实 SDK 时序与端侧观感仍待验。

## 2026-10-22 选择异常与列表失败恢复（M2.17 Task 5）

- **选择**：platform 统一识别图片/视频/内置文件选择的用户取消，图片返回 `[]`、视频/文件返回 `null`，其他失败 reject；H5 文件 input 补 `oncancel`。聊天页图片/视频使用独立选择失败 toast，内置文件沿用读取失败提示，取消继续静默。
- **列表**：会话、联系人、群列表的挂载同步与重试共用 `syncPending` 锁并记录 `syncFailed`；仅无缓存失败时以 `em-empty + em-button` 替换普通空态，已有缓存或搜索无结果不被全屏错误覆盖。
- **成员/历史**：群成员首屏失败可重试，只有已加载空缓存才显示「暂无成员」；分页失败进入 `LOAD_MORE_STATE.ERROR`。聊天加载更多以独立 `loadMoreFailed` 保留顶部重试行，重试仍走分页锚点路径，首次历史骨架与首屏错误逻辑不变。
- **验证**：临时 focused RED 0/11 → GREEN 11/11（真实 platform MP/WEB 取消与失败 + 页面源码契约）；zh-CN/en 245 keys parity ✓；App 模块图 ✓；`build web` ✓；`build mp-weixin` 11 项全绿（主包 918KB / 分包合计 1421KB）；H5 静态伺服 200 ✓；目标文件无新增编译告警。**待验**：真实断网首进→恢复重试、缓存后台刷新失败、各端原生选择取消/权限或读取失败，以及群成员和聊天分页的端侧点击恢复。

## 2026-10-22 输入栏发送位「+」/纸飞机同槽互斥（M2.18 交互迭代）

- **背景**：真机反馈输入栏常驻文字「发送」按钮占宽太多，输入区被挤窄；改为微信手机版口径——不常驻发送按钮。
- **交互**：`em-chat-inputbar` 收起态把发送键与「+」放同一槽位互斥：草稿 `trim()` 为空显示「+」媒体入口；有可发送内容时同位置换为品牌色纸飞机 `plane`（点击仍走 `onSend`，空值/禁用/提交中拦截不变）。撑开态工具行保留文字发送键（固定 1/3 屏输入区在上方，不挤占输入宽度）；撑开入口移到发送位左侧，多行时纸飞机仍贴右缘。
- **顺带修复**：输入区三态此前是 `v-if` 独立链——`sendOnReturn=false` 且处于撑开态/语音模式时会同时渲染生长 textarea 与撑开区/录音条（两个输入框）。改为 `v-else-if` 收进同一链：撑开态只渲染 1/3 屏 textarea，语音模式只渲染按住说话。
- **验证**：390 宽 H5 隔离 harness（临时工程，未入库）截图确认三态为「emoji +」「emoji 纸飞机」「emoji 撑开 纸飞机」；点击撑开后仅 `expand-row`，无残留 `.multiline-wrap`；输入框可用宽度由约 210px 增至 278px（省出文字发送键 + 间距 68px）。`check-docs.mjs` ✓（28 页 / 33 组件 / 72 方法 / 24 配置字段）；App 模块图 ✓；`build web` ✓；`build mp-weixin` 11 项全绿（主包 918KB / 分包合计 1421KB）；H5 静态伺服 200 ✓；`git diff --check` ✓。**待验**：蒸汽端/小程序真机纸飞机字形渲染与点击热区、输入法组合态下 `trim()` 的显隐切换、暗色主题品牌色对比度。

## 2026-10-22 移除输入栏 1/3 屏撑开输入（M2.18 回退）

- **决定**：真机看点击「撑开」进入固定 1/3 屏全屏输入区的效果不佳，暂时移除该交互与入口 icon；**多行输入保留**（`sendOnReturn=false` 的生长 textarea，封顶 5 行内部滚动）。上一条中 1/3 屏撑开态、撑开 icon、撑开态工具行发送键的描述随之作废；纸飞机发送位不变。
- **移除面**：组件删除撑开态模板/样式（`__expand-*`、`--bar-column`）与 `polyline-topright` 入口；`useChatComposer` 删除 `expanded`/`textareaFocus`/`toggleExpanded`/`onTextareaFocus`/`onTextareaBlur` 及撑开专用的 input↔textarea 焦点迁移抑制；`EmInputFeatures.expand`、`EmChatInputBarScope` 的 `expanded`/`toggleExpanded`/`textareaFocus`、em-chat-page 插槽绑定、i18n `chat.input.expand/collapse`、config 默认项一并删除。文字发送键样式 `__send`/`__send-text` 只在撑开态使用，随之一并删除。
- **保留**：`sendOnReturn` 三态、linechange 驱动生长/封顶、纸飞机发送位、禁言/面板/录音行为；`polyline-topright` 字形保留在 iconfont（图标库是 vue icons-v2 全量镜像，不因单组件停用删字形，parity ✓）。
- **文档**：PLAN M2.18 改为「多行输入（生长 + 回车/换行档）」并注明全屏撑开暂缓；CONFIG / PAGES-CHAT / COMPONENTS-CHAT / API-TYPES / changelog 去掉 `expand` 与 scope 字段；坑集 §5l 示例改为生长输入 `__multiline-wrap`，§5m 示例改用 `sendOnReturn`。
- **验证**：390 宽 H5 隔离 harness（临时工程，未入库）截图确认三态：空草稿 `emoji +`、有草稿 `emoji 纸飞机`、换行档三行生长 `emoji 纸飞机`；DOM 中无 `expand-row` / `expand-toggle`，`multiline-wrap` 正常，输入区宽 278px。`check-docs.mjs` ✓（28 页 / 33 组件 / 72 方法 / 24 配置字段）；图标 parity ✓；App 模块图 ✓；`build web` ✓；`build mp-weixin` 11 项全绿（主包 913KB / 分包合计 1421KB）；H5 静态伺服 200 ✓；`git diff --check` ✓。**待验**：蒸汽端/小程序真机多行生长与封顶内滚、键盘右下角键（回车/换行档）、纸飞机字形与点击热区。

## 2026-10-22 iOS 拍摄黑屏：相机授权预检 + 示例工程 iOS 权限描述

- **现象**：点击「拍摄」系统相机页被拉起但画面全黑。iOS 在用户拒绝相机授权后仍会打开系统拍摄页并停在黑屏且不再弹窗（`uni.chooseImage` 不会因此 reject）；另外 iOS 模拟器无摄像头，拍摄也必黑。
- **代码**：`libs/platform.ts` 新增 `getCameraAuthorizeState()`（仅 `APP-IOS` 读 `uni.getAppAuthorizeSetting().cameraAuthorized`；其它端/缺模块回 `unknown`）与 `openAppAuthorizeSetting()`；`em-chat-page.onPickImage('camera')` 调起前预检——`denied` 弹「去设置」、`config error` 提示安装包缺权限描述、`not determined` 交给系统首次弹窗、`unknown` 走原路径零回归。预检只做 iOS：Android 未授权时也可能返回 `denied`，提前拦截会挡掉首次系统弹窗。i18n 中英新增 4 键（247/247 parity）；两个 helper 从 `libs` 透出。
- **打包配置**：`demo/manifest.json` 的 `app-ios.distribute.privacyDescription` 补 `NSCameraUsageDescription` / `NSPhotoLibraryUsageDescription` / `NSPhotoLibraryAddUsageDescription` / `NSMicrophoneUsageDescription`；改后需重新云打包或重打自定义基座才进 Info.plist。当前 custom base 的 `duts` 已含 `uni-getAppAuthorizeSetting` / `uni-openAppAuthorizeSetting`，JS 热更即可跑预检。
- **文档**：PLATFORM 权限节新增「iOS 拍摄黑屏」判定与打包口径、QUICKSTART 补 iOS 键名、FAQ 新增黑屏条目、API-KIT 平台能力表登记两个 helper、readme 已知限制、changelog rc.2 修复。
- **验证**：`build web` ✓；`build mp-weixin` 11 项全绿（主包 914KB / 分包合计 1421KB）；H5 静态伺服 200 ✓；`check-docs.mjs` ✓（28 页 / 33 组件 / 72 方法 / 24 配置字段）；App 模块图 ✓；locale parity 247/247 ✓；web/mp 产物无 `cameraAuthorized`（`APP-IOS` 分支已条件编译剔除）。**待验**：iOS 真机 `cameraAuthorized` 三态（authorized / denied / config error）与「去设置」跳转、首次授权拒绝后系统仍会停在黑屏页（预检只能在下次点击拦截，无法预判首次弹窗结果）、iOS 模拟器黑屏属预期。

## 2026-10-22 iOS 权限允许后拍摄仍黑屏（排查中）

- **反馈**：补齐 iOS 隐私描述并允许相机后，系统拍摄页仍全黑；权限声明/授权层已排除，问题落在 native 拍摄页预览/会话或运行环境。
- **诊断埋点**：`em-chat-page.onPickImage('camera')` 增加 `logger.info('camera authorize state:', cameraAuth)`；`authorized` 仍黑即证明不是权限层（预检只在 denied/config error 拦截，逻辑未变）。
- **待隔离**：① 确认 HBuilderX 底部当前 target 是 iPhone App 而非「微信小程序」（截图中两个 target 都在；MP 不走 iOS 预检也不读该 manifest）；② 确认真机不是 iOS 模拟器（模拟器无摄像头必黑）；③ 允许后退出拍摄页再点一次（首轮 session 可能未重启）；④ 黑屏页快门能否出图（能=预览层问题，不能=相机会话未起）、系统相机 App 是否正常；⑤ 用 hello-uni-app-x 官方 `chooseImage` 拍摄页 + 当前 base 复现，排除 UIKit；⑥ 自定义基座用当前 HBuilderX 重打（原生相机模块在 base 内，改 manifest/JS 不会更新 base）。
- **验证**：本轮仅为日志埋点，`build web` ✓；`build mp-weixin` 11 项全绿（主包 914KB / 分包合计 1421KB）。**待验**：真机日志 `camera authorize state` 与上述隔离结论。

## 2026-10-22 视频消息全端播放（M2.19）

- **现象与结论**：iOS 真机点视频消息无反应。排查确认不是点击链路丢了：`PLATFORM_CAPABILITIES.videoPreview` 仅 WEB=true，`em-video-message` 在 App 隐藏播放覆盖层且 `onVideoPreview` 直接 return——一期只接了 H5 `window.open`，原生播放器未落地（PLAN 1.2 原设计为「封面 + 原生 `video` 播放」，本轮补齐）。
- **实现**：新增原子组件 `components/em-video-preview`（fixed 黑底全屏 + 原生 `video` + 安全区下移的关闭键 + 加载失败提示；无 CSS 动画依赖）；`em-chat-page` 增 `onVideoPreview` 状态与接线——点击气泡先 `stopAudio()` 再打开播放器，切会话/卸载时关闭并释放原生播放器；App 端下载本地 `.mp4` 后再播、关闭 autoplay + 挂载后显式起播（详见下方回归 2/3）；`em-video-message` 注释与能力口径同步；`platform.ts` 的 `videoPreview` 全端 true（保留字段便于后续按端裁剪）；新增 token `--em-video-viewer-bg` 与 i18n `message.video.playFailed/loading`（zh/en）。
- **文档**：PLATFORM / COMPONENTS / COMPONENTS-CHAT / PAGES-CHAT / CONFIG / FAQ / GUIDE-MULTI-SCENARIO / README / 插件 readme 全面去掉「仅 H5」口径，新增 `em-video-preview` 契约；内部 REVIEW / RELEASE / EVAL 的过期结论以本节为准。
- **验证**：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 924KB / 分包合计 1422KB）；H5 静态伺服 200 ✓；mp 产物 `em-video-preview.wxml` 已生成且 `video` 标签携带 src/controls/object-fit。**iOS 真机已验证**（下载本地 + 显式起播，画面/声音/关闭正常）；**待验**：Android/鸿蒙真机、微信小程序真机全屏与进度拖动、H5 远程播放回归、弱网/坏 URL 失败提示。

## 2026-10-22 iOS 播放页黑屏：自定义基座缺 `uni-video` 模块（M2.19 真机回归）

- **现象**：补上视频播放后，iOS 真机点视频消息能进入全屏播放页，但整页黑底、无控制条、无声音；H5 harness 同组件正常出画面。控制台报 `undefined class: UTSSDKModulesDCloudUniVideoBrightnessByJs, uni-video 模块不存在，请重新打自定义基座。`，栈从 `video` 组件 setup（`uni-app-x-framework-vapor.js` 的 `Video` 组件）起。属于「组件被降级」，不是 URL/编码/布局问题（后者会走 `message.video.playFailed` 提示）。
- **定位**：uni-app x 按代码用量对内置模块摇树。查当前自定义基座清单 `demo/unpackage/cache/vapor/uts_custom_ios/uniapp-x-uts.json` 的 `duts` 共 40 项，**没有 `uni-video`**；对照 HBuilderX 标准基座 `HXDependencies/uniapp-x-uts.json` 的 94 项包含 `uni-video`。基座是在接入 `<video>` 之前打的，运行期找不到 video 组件，被降级为 `<view>` → 黑屏。
- **修复**：`demo/manifest.json` 在 `app` / `app-android` / `app-ios` / `app-harmony` 的 `distribute.modules` 显式声明 `"uni-video": {}`（HBuilderX 4.71+ 读 app-ios/app-android，旧版读 app）；宿主接入文档补充「接入 video 后必须重打自定义基座」。**需要重打一次 iOS 自定义基座并重新运行**，JS 热更不包含原生模块。
- **文档/技能**：QUICKSTART（App 基座说明 + 排错表）、PLATFORM（App/鸿蒙注意事项）、FAQ（黑屏三步排查）、插件 readme（平台矩阵下注）、坑集新增 §5n。
- **验证**：`manifest.json` JSON ✓；`build web` ✓；`build mp-weixin` 11 项全绿（主包 924KB / 分包 1422KB）。**待验**：重打基座后 iOS/Android/鸿蒙真机播放。

## 2026-10-22 视频播放器卡 loading：chatfiles 不支持 Range + URL 无后缀（M2.19 真机回归 2）

- **现象**：重打基座后 iOS 真机已能拉起原生播放器（出现 poster、原生控制条、关闭键），但一直转 loading，进度 `00:00 / 00:00`；报错日志为 `[emkit:video-preview] open: https://ngi-a1.easemob.com/.../chatfiles/<uuid>`，无 `play error`；同一 URL 在 Safari 可播。
- **定位（curl 实测）**：chatfiles 直链无扩展名，响应头 `Content-Type: video/mp4` / `Content-Length: 583483`，但**带 `Range: bytes=0-1023` 仍返回 `HTTP 200` 全量，无 `Accept-Ranges` / `Content-Range`**。iOS AVPlayer 的远程渐进播放依赖 Range，且对无后缀 URL 容忍差，所以停在 prepared 前；浏览器/小程序内部下载器可整包拉取，故浏览器正常。
- **修复**：App 端不再把远程直链喂给 `<video>`：`platform.ts` 新增 `prepareVideoSource`——`uni.downloadFile` 整包下载 → `FileSystemManager.copyFile` 到 `USER_DATA_PATH/em-video-<ts>.mp4`（补后缀）→ 本地播放；下载期显示进度、关闭时 `DownloadTask.abort()`、同 URL 会话内缓存；H5/小程序保持远程 URL，HLS（`.m3u8`）与本地路径不整包下载。
- **辅助兜底（保留）**：打开后 400ms 显式 `uni.createVideoContext(id, instance).play()`（autoplay 偶发不触发）；`normalizeVideoUrl` iOS 上 `http → https`（ATS），`@error` 再切 https 重试一次；`[emkit:video-preview] open/ready/prepare error/play error` 日志。
- **验证**：`build web` ✓；`build mp-weixin` 11 项全绿（主包 924KB / 分包 1422KB）。**待验**：iOS 真机重跑后下载进度与本地播放；Android/鸿蒙同链路；H5/小程序远程播放回归（应不受影响）。

## 2026-10-22 iOS 视频进度条在走、画面停在首帧（M2.19 真机回归 3，已解决）

- **现象**：下载到本地后播放器时间/进度条前进，但画面停在约 0s 的首帧/封面，不动；`AVAssetImageGenerator` 对同一文件抽 0s/2s 帧内容明显不同，文件本身与编码（avc1 / 360×640 / 30fps / AAC）正常，不是坏文件或解码不了。
- **根因（iOS 真机验证）**：原生 `autoplay` 在 `<video>` 事件绑定完成前就起播，`play` 事件丢失，组件一直保留首帧/封面层；`poster` 又进一步把静态首帧盖在播放层上。表现为「有进度、没画面」。
- **定案解法**：`video` 不再传 `poster`（封面只用于下载 loading 背景图）；`:autoplay="false"`，等组件挂载后显式 `createVideoContext().play()`，未收到 `@play` 每 500ms 重试、最多 8 次。iOS 真机复测：画面随进度更新、声音正常、关闭/重开正常。
- **保留的兜底**：下载→本地 `.mp4`（解决 chatfiles 不支持 Range + 无后缀）；`normalizeVideoUrl`（iOS http→https）；全屏按钮可继续用原生全屏。
- **验证**：`build web` ✓；`build mp-weixin` 11 项全绿（主包 924KB / 分包 1422KB）；**iOS 真机已验**。**待验**：Android/鸿蒙同链路、微信小程序真机、H5 远程播放回归。
- **复盘（按症状分层）**：点开黑屏/无控制条 → 基座缺 `uni-video`；卡 `00:00` 一直转圈 → chatfiles 无 Range/无后缀；有进度没画面 → autoplay 抢跑或封面层盖住播放层。三者可能叠加，按此顺序排查。

## 2026-10-23 选择异常与列表恢复审查修复（Task 5 Fix Round 1）

- **聊天历史互斥**：`loadInitialHistory` 与 `onLoadMore` 互相检查对方 loading，页面级请求不再共享同一 domain Promise 后分别写两个错误态；重试只清当前拥有者的错误，首屏骨架和分页 prepend 锚点不变。
- **成员视图代次**：首屏、分页、移除后强制首屏共享 `memberRequestGeneration`；新请求接管 loading，陈旧成功/失败和 finally 不改当前状态。`refreshAfterRemoval` 仍强制首屏并等待详情/成员两个尝试，保留 best-effort 提示语义；分页 ERROR 即使 `hasMore=false` 也可发起重试。
- **选择处理异常**：图片、视频、MP 文件和 H5 文件的 success 映射均加 try/catch，畸形载荷或处理异常 reject 到既有选择失败 toast；用户取消仍静默。
- **验证**：真实页面函数 + deferred 检查 RED 1/9（8 项目标失败）→ GREEN 9/9；原 Task 5 focused 11/11 ✓；App 模块图 ✓；`build web` ✓；`build mp-weixin` 11 项全绿（主包 928KB / 分包合计 1422KB）；H5 静态伺服 200 ✓。**待验**：真实 SDK 反序、原生畸形回调和五端交互仍未做人工回归。

## 2026-10-23 群成员外部请求归属修复（Task 5 Fix Round 2）

- **共享契约**：`getGroupMemberList` 保留 `items/cursor/hasMore` 并新增 `applied`；当前成功且实际写 store 返回 true，陈旧成功/失败返回 false，当前失败仍 reject。facade 同步透出 `EmGroupMemberListResult`，spike 既有分页字段读取不变。
- **视图恢复**：成员视图除本地代次外按 domain `applied` 处理 enterGroup/邀请/父页刷新造成的陈旧结果；陈旧首屏结果后无缓存则显示重试，陈旧失败不得在外部成功缓存上创建 ERROR。
- **兼容性**：Task 4 requestId、强制详情、admin resync 与普通 dedupe 未改；API-KIT/API-TYPES 与内部架构契约同步。
- **验证**：真实 domain + 视图 deferred 外部顺序 RED 1/5 → GREEN 5/5；Fix Round 1 9/9、原 focused 11/11 ✓；`check-docs` ✓；App 模块图 ✓；`build web` ✓；`build mp-weixin` 11 项全绿（主包 928KB / 分包合计 1422KB）；H5 静态伺服 200 ✓。**待验**：真实 enterGroup/邀请/父页刷新反序与五端人工恢复。

## 2026-10-23 群成员陈旧失败兼容性修复（Task 5 Fix Round 3）

- **rejection 兼容**：陈旧失败不再 resolve 空页，改为 reject 结构化 `EmGroupMemberListResult`（`applied=false`）；当前真实失败继续抛原始错误。陈旧成功仍 resolve `applied=false`。
- **视图/消费方**：成员视图区分结构化陈旧拒绝与真实失败，外部成功缓存上不创建 ERROR，无缓存仍保留重试。spike 的 p1/p2/建群成员三处在读取 `items/cursor/hasMore` 前忽略 `applied=false`，不再把陈旧成功当空页成功。
- **文档**：PLAN、API-KIT、API-TYPES、公开类型注释与内部架构 skill 同步精确 resolve/reject 语义；Task 4 requestId/force/admin 保护不变。
- **验证**：真实 domain + 视图 + spike 源码契约 RED 7/9（stale rejection 与 spike 两项失败）→ GREEN 9/9；Fix Round 2 5/5、Round 1 9/9、原 focused 11/11 ✓；`check-docs` ✓；App 模块图 ✓；`build web` ✓；`build mp-weixin` 11 项全绿（主包 928KB / 分包合计 1422KB）；H5 静态伺服 200 ✓。**待验**：真实 SDK 陈旧拒绝和 spike 端侧展示仍未人工回归。

## 2026-10-23 契约文档与整体验收（M2.17 Task 6）

- **文档终审**：按最终源码校正 `em-button.loading`、`em-select-contact.submitting`、四态 `LOAD_MORE_STATE` 与 JS spinner；补全 `deleteMessage` 当前账号漫游/本地顺序、`deleteLocalMessage` 本地 no-op、Promise `copyText`、输入栏/快捷回复提交锁、会话 pin/mute 队列、群管理确认与提交中关闭、选择取消/失败、列表与分页重试、`getGroupInfo(force?)` 和 `getGroupMemberList.applied` 的 resolve/reject 语义。同步公开页面、API/类型、changelog、宿主 skills、内部组件/架构契约与 PLAN；未把内部待验口径写入公开页。
- **自审修复**：`em-load-more` 在 `useSpinRotation` computed 中读取 `props.state`，但 props 声明未保存为变量；已补 `const props = withDefaults(...)`，避免组件 setup 运行时 ReferenceError。仅静态/编译验证，未宣称端侧点击已验。
- **通过的静态与构建门禁**：`node scripts/check-docs.mjs` ✓（28 页 / 34 组件 / 72 方法 / 24 配置字段）；`node scripts/check-skills.mjs` ✓（8 个宿主技能）；`scripts/uni.sh build web` ✓（仅既有编译告警）；`scripts/uni.sh build mp-weixin` ✓（11 项防回归全绿，主包 **928KB** ≤ 1.5MB，分包合计 1422KB）；H5 产物静态 GET / **HTTP 200**；`node scripts/check-app-module-graph.mjs` ✓（现有鸿蒙产物 131 模块，无 libs→components 反向依赖、无 libs/index 循环）；`git diff --check` ✓。
- **本次未执行的运行时验收（全部保留待验，不由上述静态/构建结果替代）**：当前没有可用真实账号、微信开发者工具会话或 Android/iOS/鸿蒙设备矩阵，未进行真实 IM 操作、原生弹层/toast/剪贴板或端侧点击。

| 未验证范围 | 需要补验的实际交互 | 当前状态 |
|---|---|---|
| H5 真实账号 | 漫游/本地删除成功与失败、复制、撤回、重发与连点；会话/好友删除；pin/mute 最新意图；owner/admin/member 三角色群操作与刷新反序；断网首进/缓存/分页失败恢复 | 未验证；仅构建与静态 200 通过 |
| 微信小程序（开发者工具及真机） | 同 H5 全矩阵，另含原生确认/toast/剪贴板、选人提交态、`applied=false` 消费与 ERROR 点击重试 | 未验证；仅 mp 构建和 11 项防回归通过 |
| Android / iOS / 鸿蒙 | 真实账号删除/复制/撤回/重发、会话与好友删除、三角色群操作、断网恢复；原生 modal/toast/剪贴板、弹层提交中禁关闭、键盘与安全区、选择取消/权限或读取失败 | 未验证；仅现有 App 产物模块图通过，未重新做 GUI App 构建或真机运行 |
| `em-load-more` 自审修复 | ERROR 展示、点击重试、LOADING 旋转与状态切换 | 未做端侧交互；源码复核与 web/mp 编译通过 |

完整命令、文件清单与自审记录见 `.superpowers/sdd/gorgon-blue-devil-thor/task-6-report.md`。

## 2026-10-23 修复：App 端弹层偶发「tabBar 收起但 action sheet 不出现」（P0）

- **现象**：Android 10 真机，会话列表右上角「+」偶发只收起底部 tabBar、action sheet 不出来；此时整页点击被吞，再点「+」只会把弹层关掉（看起来「卡死」）。
- **复现**：Redmi Note 7 Pro / Android 10，`adb shell input tap` 固定点图标中心即可复现，10 次开合失败 2–4 次；与点击坐标无关；长按会话菜单、选人、@提及同源。
- **插桩定位**（改 debug 基座已编译 bundle，logcat 取 `console.log`）：失败那次的 `em-popup` `watch`/渲染 effect 日志与成功完全一致（`shown=true`），JS 状态与逻辑正确；失败视图停在关闭态——遮罩 `opacity: 0`（不可见但仍全屏吃点击）、面板 `translateY(100%)`（屏外），而 `holdTabBar()` 已先隐藏原生 tabBar。
- **对照实验**（全部真机 A/B，12 次/组）：关掉 `hideTabBar` 仍 4/10 失败（排除 tabBar 干扰）；「挂载即写死显示态」仍 2/6；+80/240ms 补写 class 仍 2/10；延时 50ms 挂载仍 4/10 → 补写与延后都无效，根因是**蒸汽端 v-if 新分支的动态 class 写入会偶发整条丢失并回落旧值**。
- **修复**：`em-popup` 改「默认态即最终态」——`.em-popup__overlay` 默认不透明、`.em-popup__panel` 默认在最终位置，去掉 `--show` 类与 250ms 进出场动画，显隐只靠 `v-if` 挂载/卸载；`usePopup` 的 tabBar 持锁改实例级配对，`releaseTabBar()` 计数为 0 时直接返回（避免初次挂载误放别人的锁）。
- **修复验证（真机）**：把面板类改成「常量类即最终位置」后同一脚本 **12/12 全部弹出**（改前 8/12～6/12），确认「可见性不能依赖挂载后 class 翻转」这一结论。
- **门禁**：`check-docs` ✓（28 页 / 34 组件 / 72 方法 / 24 配置）；`check-skills` ✓；App 模块图 ✓（131 模块，无反向依赖/循环）；`build web` ✓；`build mp-weixin` 11 项全绿（主包 928KB / 分包合计 1422KB）。坑集新增 §5q + 能力表条目，changelog 已记。
- **待验**：本次 CLI 不能出 App 包，修复后的最终源码需用 HBuilderX 重新运行/打自定义基座后回归——「+」连点 10 次开合（应 10/10 弹出且 tabBar 每次归还）、长按会话菜单、选人弹层、聊天页长按菜单、群公告弹层；另确认去掉进出场动画后的观感可接受。

## 2026-10-23 IM 交互一致性终审修复（8 项）

- **账号切换与读取顺序**：新增共享 account epoch，公共门面在 `whenReady()` 前捕获，conversation/contact/group 在 readiness 后、pending 复用和 store 写前校验；logout/reset 失效旧代次并清空 info/member/admin 等 pending。会话快照按同账号 requestId 只接收最新响应，mute 批量校正也校验代次。
- **真实同步状态与恢复**：三类 store 以 `loaded / syncing / syncFailed` 区分未加载、加载中、失败与权威空列表；`onSyncDataStart/Finished` 直接驱动状态，失败保留缓存。会话只以真实 `refreshSessionList` 成功为完成，不再回退内存快照；联系人重试调用 SDK `refreshContactSnapshot`。SDK 无已加入群全量手动重启 API，群同步失败后 `getJoinedGroups` 明确 reject 并提示恢复连接/重新登录，不伪造权威成功。
- **并发操作**：chat-info 删除会话、删除好友、退群/解散共享 `exitPending / exitCompleted`，确认后、SDK 写操作前占锁且按钮同时禁用，只发一次成功事件。domain 重发按 conversationId+localId 共享在途 Promise，所有调用方得到同一结果，finally 仅清自身 map 项。
- **发送与选择器**：chat-page 按发起 conversationId/chatType + pageGeneration 保护文本、快捷回复、图片/视频/文件/语音完成回调；旧完成不清新会话或发送期间的新编辑，旧 finally 不解新锁，未发送临时附件按 release 清理。
- **展示一致性**：好友快照加载把历史 received pending 好友申请收敛 accepted 并持久化，按钮/processInvite/未读角标同源收敛；两人英文通知改为 `1 other`，中文总人数不变。`delete` 事件文档明确漫游与本地删除均完成后透出。
- **验证**：一次性 deferred RED domain 0/9、真实组件 0/8 → 最终 GREEN domain **10/10**、组件 **8/8**（含 facade logout during readiness、反序快照、三类后台失败/重试、两个重发调用方、交叉退出、发送/选择切会话、历史 pending 好友）。`check-docs` ✓（28 页 / 34 组件 / 72 方法 / 24 配置）；`check-skills` ✓（8 技能）；`build web` ✓（仅既有 demo-custom-inputbar 告警）；`build mp-weixin` ✓（11 项全绿，主包 **935KB** / 分包合计 1422KB）；H5 静态 GET / **HTTP 200**；App 模块图 ✓（131 模块）；`git diff --check` ✓。
- **待验**：未使用真实账号、微信开发者工具或 Android/iOS/鸿蒙设备验证上述交互；deferred fake SDK/真实 setup 检查不替代真实后台同步、账号切换、网络失败、原生选择器与导航回归。完整文件与命令见 `.superpowers/sdd/gorgon-blue-devil-thor/final-fix-report.md`。
- **终审残余修复**：群公告读取补齐账号代次与 pending identity/finally 保护，facade 同样提前捕获代次。三类后台同步 handler 在 logout 时实际 `removeEventHandler` 并解绑，login 重新注册；回调同时带 bind-time epoch，旧回调即使出队也不写新账号，新账号回调不被禁用。`acceptGroupInvite` 在 SDK 接受与申请状态成功后即返回，后续群快照刷新独立 best-effort，不再把接受成功翻成失败。专项 deferred RED 0/3 → GREEN **3/3**，原 domain 回归 **10/10**。

## 2026-10-23 弹层修复第二轮（真机复现后改结构，14/14 通过）

- **第一轮修复不足**：用户按其构建（含第一轮 CSS 默认态修复）连点仍复现 3–5/12。真机重测确认：`watch`/渲染 effect 日志与成功完全一致，但失败时视图仍不可见。
- **第二轮定位（可视化标记）**：给弹层根节点/面板分别注入内联 `background-color` 标记后，失败时**连内联背景色都不落笔** → 不是 class 级联，而是 **v-if 新建分支的视觉节点整批没建出来，只建出命中区**（因此「看不见但吃点击」）。补充排除：延时 50ms 挂载仍 4/10；挂载即写死显示态仍 2/6；80/240ms 补写 class 仍 2/10。
- **定案修复**：`em-popup` 改**常驻挂载**——去掉 `v-if`，页面挂载时建好整棵弹层；关闭态根节点内联 `top: 200%` 移出视口（不绘制、不吃点击），打开/关闭只改这一个内联样式。默认态即最终态（遮罩不透明、面板在最终位置，无 `--show`、无 250ms 动画）。`usePopup` tabBar 持锁为实例级配对。
- **真机验证（Redmi Note 7 Pro / Android 10，app-android 5.26 vapor+bytecode）**：同一 adb 脚本 14 次开合 **14/14 弹出、14/14 关闭后 tabBar 如实归还**（改前 3/12 失败）；长按会话菜单、选人弹层（em-select-contact）回归正常。
- **门禁**：`check-docs` ✓ / `check-skills` ✓ / App 模块图 ✓ / `build web` ✓ / `build mp-weixin` 11 项全绿。
- **代价与待验**：去掉了弹层进出场动画；弹层内容改为页面挂载时创建（选人列表等不再等首次打开）。待验：iOS / 鸿蒙真机、聊天页长按菜单与群公告弹层、宿主自定义 `custom-style` 覆盖观感。

## 2026-10-23 弹层进场动画回归（JS 逐帧，真机 20/20）

- **需求**：弹层瞬现瞬隐观感太差，需要过渡动画；但动画的起点不能是"不可见态"（否则回到 §5q 的 P0）。
- **做法**：`em-popup` 进场改 JS 逐帧写内联 `transform: translateY(100% → 0%)`（约 200ms、ease-out、16ms/帧，同 `useSpinRotation` 思路）；尾段（>85%）直接写 0%，最后一帧清掉内联 transform。退场保持瞬隐（若做退场，收尾那次"隐藏"写入被丢会留下幽灵弹层）。
- **真机验证**（Redmi Note 7 Pro / Android 10）：慢放（2s 时长）实测面板 top 2200→1967→1856→1817→1812，确认是渐进滑动；恢复 200ms 后连点 20 次开合 **20/20 全部正常**（改前 3/12 失败），长按会话菜单回归正常。
- **门禁**：`build web` ✓ / `build mp-weixin` 11 项全绿；坑集 §5q 补「动画只能做附加位移」纪律与退场禁令。

## 2026-10-23 踩坑实录补充进对外文档

- **范围**：近两天坑集（`em-crossend-pitfalls` §5m/5q/5l/5j 及 §5a iOS 口径）中尚未公开的部分补进对外文档。视频三连坑（§5n/5o/5p）、变量覆盖漂移（§5i/5k）、附件 md5（§5h）此前已有公开覆盖，本次不重复。
- **FAQ.md 新增 4 条**：「App 端页面白屏且控制台没有任何报错」（§5m，setup 期 ReferenceError 被蒸汽引擎吞掉）；「App 端自绘弹层偶发不出现、整页点击被吞」（§5q，v-if 新分支视觉节点整批不建 → 常驻挂载 + 只改内联样式 + JS 逐帧动画；附 §5a iOS 全屏弹层 padding 不参与布局的安全区口径，引用公开 API `getSafeAreaTop`）；「App 端多行输入框（textarea）不生长 / 无底色无占位符」（§5l，装饰与尺寸落包裹层）；「App 端触摸拖拽没有反应」（§5j，createSelectorQuery 拿不到 rect 静默失效，几何同步推导）。
- **PLATFORM.md**「其他约束」补两条交叉提示（v-if 浮层、原生组件只保证内容区）；**PAGES-CHAT.md** 整栏自绘输入栏节补 textarea 包裹层提示并链回 FAQ。
- **校验**：`check-docs` ✓（28 页 / 34 组件 / 72 方法 / 24 配置）；门户 `content:sync` + `content:check` + `test`（17/17）+ `build` 全绿；preview 走查 FAQ 四个新条目目录与正文渲染正常。

## 2026-10-23 消息增强五能力 + 好友备注（PLAN M2.20）

- **范围**：群名修改开关（链路 M2.9 已存在，`em-group-info-blocks` 笔入口新增 `uiConfig.enableGroupNameEdit` 门控）、撤回消息「重新编辑」（自己撤回的文本墓碑，`enableReEdit` 默认开，回显输入框发新消息）、撤回条昵称展示（原发送者昵称，群成员名片 > 单聊备注 > 昵称链；SDK `onMessageRecalled` payload 无操作者字段，与 vue 版同款语义）、消息编辑（`modifyMessage` 复用原消息 id，上限 10 次置灰，输入栏编辑条优先引用条，失败保留编辑态）、置顶消息（`em-pinned-bar` 折叠态 + 多条下拉展开，定位复用引用高亮 + 翻页 3 页兜底）、好友备注（联系人列表长按菜单 `remark` 项 + 居中弹层，`EmKit.setContactRemark` 早封装无调用方首次接线；聊天页单聊标题/撤回条/引用卡改 `contactDisplayNameOf` 备注链）。
- **配置**：`messageMenuKeys` 默认插入 `edit`/`pin`（删 key 即禁用，置顶条随之不渲染）；新增 `enableReEdit` / `enableGroupNameEdit` / `contactMenuKeys`（默认 remark/delete，em-contact-list-page 的 `menuKeys` prop 缺省回落 uiConfig）。i18n 中英同步 12+3 个 key。
- **libs**：`EmMessageItem` 增 `modifiedInfo`/`pinned`/`recalledBy`；新类型 `EmMessageModifiedInfo`/`EmPinnedMessageItem`/`EmPinnedRow`；message 域新增 `modifyTextMessage`（ext 原值写回防引用被清空）/`pinMessage`/`unpinMessage`/`refreshPinnedMessages`（epoch 防护、pinnedAt 降序、已加载消息打标）/`applyMessageUpdated`；事件 `onMessageUpdated`/`onPinnedMessageChanged` 接线；门面新增 4 方法（`modifyTextMessage` 成功同步会话摘要）。
- **门禁**：`build web` ✓（仅既有 demo-custom-inputbar 告警）；`build mp-weixin` ✓ 11 项防回归全绿（主包 966KB ≤ 1.5MB）；H5 产物静态 GET / **HTTP 200**；`check-docs` ✓（28 页 / 35 组件 / 79 方法 / 27 配置字段）。
- **待验（真机/真实账号）**：蒸汽端输入框回填长文本后的多行高度重算（linechange 依赖键盘 focus）；置顶条展开列表滚动与点击定位；编辑/置顶/撤回重编辑在 H5 + 微信开发者工具的真实账号链路；好友备注保存后三端展示联动；群名片 vs 好友备注的群场景优先级（当前群成员链保持群名片优先，vue 语义为备注优先，差异待产品裁决）。

## 2026-10-23 公开宣布仅支持 uni-app x 蒸汽模式

- **决策**：不再考虑兼容老模式（经典 uni-app Vue2/Vue3、nvue、vdom），公开口径统一为「仅支持 uni-app x 蒸汽模式（Vapor）」。依据 DCloud 官方公告（https://doc.dcloud.net.cn/uni-app-x/ FAQ「老 uni-app 还维护吗？」）：2024 年已停 nvue/5+ 维护，2027 年初停 uni-app App 平台与 uni-app x vdom 平台维护；蒸汽模式已兼容 js/ts，老工程可升级。PLAN D1 同步改口（原「老 uni-app Vue3 能用算白捡」收回）。
- **波及页面（醒目声明 + 原址引用）**：README 顶部 callout；HOME 新增「支持范围」节；QUICKSTART 首段支持范围声明；PLATFORM 环境要求上方 callout + uni-app x 行扩写；FAQ 新增「环境与接入范围」节第一条（经典 uni-app / vdom 能否使用）；changelog rc.2「变更」段首条。宿主 skill `em-host-integration` 不适用场景补公告背景；AGENTS.md 项目一句话改「蒸汽优先 → 仅蒸汽模式」。
- **校验**：`check-docs` ✓（28 页 / 35 组件 / 79 方法 / 27 配置）；`check-skills` ✓（8 技能）；门户 `content:sync` + `content:check` + `build` 全绿（`.content` 五处新文案核对到位：index / quickstart / platform / faq / changelog）。

## 2026-10-23 业务资料注入能力（set*Presentation 三件套）

- **背景**：此前宿主想替换昵称/头像/群名只能靠 `mergeUserInfo` 或裸写 store，SDK 资料回推与会话快照刷新会冲掉注入值；群名加业务标签无渲染出口。
- **覆盖层**（与 SDK 数据分层存储，回推冲不掉；logout 随账号清空，login 后需重新注入）：
  - `libs/store/user.ts`：`overrideByUserId` + `setUserPresentation(userId, patch|null)`；`displayNameOf`/`avatarOf` 回落链最优先读注入（联系人备注仍最优先）。
  - `libs/store/conversation.ts`：`overrideByConversationId` + `setConversationPresentation`；会话页条目/长按菜单标题/chat-page 标题回落链接入（name/avatar 最优先，ext 随插槽透出）。
  - `libs/store/group.ts`：`overrideByGroupId` + `setGroupPresentation`；`groupDisplayNameOf` 接入注入，新增 `groupAvatarOf`（会话页/群列表群头像走此链）。
  - patch 语义：按字段合并（undefined 不动现有值），null 清除该对象全部注入。
- **门面**：`EmKit.setUserPresentation` / `setConversationPresentation` / `setGroupPresentation`；类型 `EmUserPresentation`/`EmConversationPresentation`/`EmGroupPresentation`（后两者含 `ext` 业务载荷）。
- **渲染出口**：`em-conversation-item` 新增 `#title`/`#title-extra`/`#avatar` 作用域插槽 + `ext` prop；`em-conversation-page` 透传 `#title-extra`；`em-chat-page` 新增 `#title`（scope name/ext/conversationId，fallback 内联样式双通道，nav-bar 未改动）；`em-group-info-blocks` 新增 `#name-extra`，`em-chat-info-page` 透传为 `#group-name-extra`。
- **demo**：场景实验室聊天页「业务资料注入」开关（`demo/common/presentation-demo.ts`：单聊注昵称+会话 ext 标签，群聊注群 ext 标签，关=传 null 还原）；会话列表页 `#title-extra` 渲染同一 ext 标签（返回列表可见）。
- **文档**：API-KIT（三 API 条目）/ API-TYPES（三类型）/ GUIDE-MULTI-SCENARIO（5.7 业务资料注入）/ PAGES-CHAT（#title）/ PAGES-CONVERSATION（#title-extra）/ PAGES-CHAT-INFO（#group-name-extra）/ COMPONENTS-CONVERSATION（ext + 三插槽）；`check-docs` ✓。
- **待验（真机）**：mp/App 端嵌套作用域插槽转发（conversation-page→item、chat-info-page→group-info-blocks、chat-page→nav-bar）真机渲染；注入值在 SDK onUserInfoUpdated 回推后的留存（H5 可手测）。
- **终审修复（子代理评审，Critical 0 / Important 2 / Minor 7）**：置顶拉取加会话级序号 `pinnedEpochByConversationId`（防同会话并发拉取旧回包覆盖乐观打标）；`applyMessageUpdated` 放开自定义消息（patch ext/modifiedInfo，远端编辑不再永久陈旧）；「已编辑」标记改常驻子 text 内容切换（鸿蒙 text 子节点增删红线）；重编辑补原文非空校验 + 先退编辑态；置顶条取消置顶补防重；pin 失败 toast 用快照态；备注保存成功补 toast；编辑失败按错误码 `modifiedCountExceedLimit` 精确归类。Minor 遗留：置顶条/编辑条预览文本手写 ellipsis 未走 em-text 收口（deferred）。

## 2026-10-23 全库骨架屏贴真实内容结构改造

- **聊天页首屏骨架**：从「4 行头像+两行横条」（读感像会话列表）改为气泡对话形态——静态行配置（`skeletonRows`，10 行：peer/self 左右交替、1-2 行文字、时间 chip、200rpx 图片块），宽度一律 **rpx 定宽**（百分比宽度链在蒸汽端有「行尾缺字」前科）；气泡壳与真实气泡同源 token（`--em-bubble-radius`/`--em-bubble-padding-*`），对方底 `--em-bubble-bg-other`，己方新增 token `--em-skeleton-bubble-self`（light `rgba(0,158,255,0.16)` / dark `rgba(51,177,255,0.2)`，品牌蓝派生不跟随主色），内行用 `--em-bg-base` 镂空出文字形态。`em-skeleton` 原子不动。
- **会话页骨架**：条目对齐 `em-conversation-item`——圆 48 头像 + 上排（名字行+右侧 32px 时间块）+ 下排（摘要行+未读圆点，部分行），名字/摘要宽度逐行变化（SKELETON_NAME/SUMMARY_WIDTHS + SKELETON_UNREAD_ROWS），卡片行几何与真实条目一致。
- **联系人页骨架**：原「两行文字」错误（真实条目仅一行名字）——改为字母分组头（28px 通栏 `--em-conversation-list-bg` + 16px 字母占位条）+ 单行名字条目，3 组 8 条，宽度逐行变化。
- **群列表页骨架**：方形 48 头像（原误用 rounded）+ 群名行 + 右侧成员数小块（SKELETON_COUNT_ROWS 部分行，对齐 `memberCount>0` 才渲染），宽度逐行变化。
- **群成员管理视图（em-group-members-view）**：原首屏加载完全空白——补骨架（40 圆头像 + 名单行逐行变宽 + 前两行角色角标占位），行几何（padding/底部分隔线）对齐真实成员行。
- **文档**：DESIGN-TOKENS 登记新 token；PAGES-CHAT（气泡骨架）/ PAGES-CONTACTS（含分组头）/ PAGES-CHAT-INFO（成员骨架）措辞同步；`check-docs` ✓。
- **验证**：`build web` ✓、`build mp-weixin` ✓（含 11 项分包防回归）、H5 产物静态伺服 200。**待验**：骨架视觉真机走查（H5 断网慢速进聊天页/会话页/联系人页/群页/群成员视图，明暗两主题）。

## 2026-10-23 网络调优：无网警示提示 + 全链路网络预检测

- **背景**：减少「无网但无提示，被误判为 SDK 内部问题」的投诉。计划见会话 plan（选项 A，未做 vue 版彩底胶囊/点击重连）。
- **platform**：新增 `checkNetworkOnce()`（一次性探测，`uni.getNetworkType`，基座缺模块同步抛错时 try/catch 降级 `null`=未知不预判；与 `subscribeNetworkStatus` 同一 UTS 模块坑，注释互引）。
- **store/client**：`connectionStore` 增 `networkOnline: boolean | null`；`EmClient.init()` 挂 UI 侧系统网络监听（幂等单例，与 SDK runtime 那路独立并存），开局 `checkNetworkOnce` 写初值；`login` 失败日志带 `(system offline)` 标记。
- **banner**：`em-connection-banner` 状态优先级改为 CLOSED 原因档 > **系统离线先决（error 红 + status.networkError，SDK 还在 connecting/reconnecting 也立即显示）** > connecting/reconnecting（warning 黄）；ONLINE/IDLE 仅凭系统信号判定。无网场景恒为警示红，不再停黄色「连接中」。
- **发送预检测/归因**：新 `ERROR_CODE`（`NETWORK_OFFLINE`/`NETWORK_TIMEOUT`）+ `libs/utils/error.ts`（`errorWithCode`/`errorCodeOf`）；`deliver()` 与新发、重发两条路径离线先拦（不触达 SDK，FAILED 落库保留红叹号）；`waitOnline` 超时抛带 code 错误；`em-chat-page` 7 处发送 catch 统一 `toastSendFailed(e)` 归因（网络类 → `error.network`「网络异常，请稍后重试」，其余 → `message.send.failed`；i18n 双语 key 原已存在，零新增）。
- **对外透出**：`EmKit.state.networkOnline` 自动可见；文档 API-KIT（state 表）/ API-TYPES（`ERROR_CODE`）/ changelog（未发布-新增）已登记。
- **门禁**：`check-docs` ✓（28 页 / 35 组件 / 79 方法 / 27 配置）；`build web` ✓（仅既有 demo-custom-inputbar 告警）；`build mp-weixin` ✓ 11 项防回归全绿（主包 980KB ≤ 1.5MB）；H5 产物静态伺服 / **HTTP 200**。
- **待验（真机）**：App 旧自定义基座缺 `uni-getNetworkType` 模块时降级链路（warn 日志 + 不预判）；断网/恢复过程中 banner 的显示与消隐时序（H5 devtools Network offline 可手测）；离线时发送/重发的 FAILED 气泡与「网络异常」toast。

## 2026-10-23 发送状态支持度审查修复（审核域 + 失败归因 + 体验增强）

- **错误归因**：`libs/utils/error.ts` 的 `errorCodeOf` 兼容 SDK 5.x 数字 `code`（含 `'1200'` 字符串形态；保留 UIKit 字符串业务码）；新增 `SDK_ERROR_CODE_I18N_MAP`（连接/认证/禁言/文件/群组/审核等高频码，含 1200/1299 审核失败、501 违规内容、508 外部策略拦截、222 被拒收、221 不在好友列表、300 未连接、215/219 禁言）与 `sendFailureKeyOf` / `sendFailureKeyOfCode`；文案匹配仅作无 code 兜底。中英 locale 增补 30+ 个错误 key。
- **失败归因落库**：`EmMessageItem` 增 `failCode?: number | string`；`deliver()` 与 `resendMessage` 的 catch 写入、成功后清空；`toastSendFailed` 改读统一映射；失败面板标题展示原因。新增 `ERROR_CODE.SEND_TIMEOUT` / `MEDIA_UNAVAILABLE`。
- **审核域**：`EmMessageItem` 增 `contentReplaced?: boolean`；`toMessageItem`、`applyMessageUpdated`（普通编辑清标 / `isContentReplaced=true` 打标）与发送/重发回包 `applySentModeration`（同步服务端替换后的文本）共同维护；聊天页气泡下方展示「内容已被审核修改」标识（`shield` 图标 + warning 色，中英双文案）。
- **事件补齐**：聊天页/消息域监听 `onMessageDelivered`（`delivered` 标记）、`onMultiDeviceMessageRemoved`（按 messageIds/beforeTimestamp 本地移除并校正会话摘要，顺带释放临时附件）、`onSendTimeout`（仍停在 SENDING 的己方消息统一落 FAILED + `EM_SEND_TIMEOUT`）。
- **体验增强**：图片/视频发送中气泡内压暗蒙层 + 居中 loading（对齐 vue image/video message）；`MESSAGE_MENU_KEY.RESEND`（默认 `messageMenuKeys` 七项）与失败气泡 action-sheet（原因 + 重发/删除）；失败消息长按只保留复制/重发/删除，避免对无 serverId 的消息执行引用/编辑/置顶/撤回；断连/重连时输入栏上方「消息待发」提示；多选附件按 `FILE_SEND_CONCURRENCY=3` 分窗口并发。
- **文档**：API-TYPES（EmMessageItem 三字段、MESSAGE_MENU_KEY、ERROR_CODE）、CONFIG（messageMenuKeys 默认七项）、PAGES-CHAT（失败面板/审核标识/断连提示/媒体蒙层）、MESSAGING（失败重发归因）、changelog 未发布段同步；`check-docs` ✓（28 页 / 35 组件 / 79 方法 / 27 配置）。
- **门禁**：`build web` ✓（仅既有 demo-custom-inputbar 告警）；`build mp-weixin` ✓ 11 项防回归全绿（主包 993KB ≤ 1.5MB，分包合计 1425KB）；H5 产物静态伺服（5183）/ **HTTP 200**。
- **待验（真实账号/真机）**：SDK 数字错误码实际回包文案（审核拒绝/拉黑/禁言）；审核替换事件在真实服务端的 `isContentReplaced` 字段形态；`onMultiDeviceMessageRemoved` 的 messageIds/beforeTimestamp 两种载荷；`onSendTimeout` 触发时多会话并发发送的失败归因是否只命中真正超时的消息；媒体蒙层与失败面板在 H5/微信开发者工具/蒸汽真机的观感。

## 2026-10-23 真机复测：审核拒绝的失败态展示

- **设备**：Redmi Note 7 Pro / Android 10（1080×2340），已连接 adb，运行当前 dev 包。
- **复现**：在 demo 单聊会话发送 `fuck` → 服务端 ACK `MODERATION_001` / `error_type=moderation` → SDK `MessageSendError` code **1200**。
- **表现**：toast「内容审核未通过，请修改后重试」；toast 消失后气泡左侧红色感叹号可见；点红叹号弹出「发送失败：内容审核未通过，请修改后重试」+「重新发送 / 删除」。日志：`[emkit:message] message send failed: <localId> 1200`。
- **结论**：最新代码的失败态链路正常。用户此前看到「无状态」的两个可能：① toast 是居中宽条，显示期间会盖住气泡左下方约 2s，红叹号在 toast 消失后才清晰；② 跑的是未含 `overflow: visible` 修复的旧包，状态图标被蒸汽端默认 `overflow:hidden` 裁掉。
- **已清理**：测试输入草稿已清空；失败消息仅本地内存态，未上报服务端。

## 2026-10-23 已读态展示与发送状态解耦

- **需求**：已读状态图标可独立开关（默认关闭）；发送中 loading 与发送失败红叹号是独立关键状态，不能随已读开关关闭。
- **配置**：`EmKitConfig.showReadStatus` / `EmUiConfig.showReadStatus` 新增，默认 `false`；仅控制单聊最新己方已发送消息的未读/已读图标。`enableReadReceipt` 仍为功能开关（是否收发已读回执）。
- **实现**：`em-chat-page` 的 `showReadState()` 改为读 `config.showReadStatus && EmKit.isReadReceiptEnabled()`；发送中/失败是模板中的独立 `v-if` 分支，未经过该函数，恒展示。模板补注释固定该契约。
- **文档**：CONFIG（`EmKitConfig` / `EmUiConfig` 两处）、PAGES-CHAT（已读态图标/发送状态两段 + 能力表）、MESSAGING（已读回执段）、API-KIT（`isReadReceiptEnabled` 说明）、changelog 未发布段同步。
- **门禁**：`build web` ✓ / `build mp-weixin` ✓ 11 项全绿 / `check-docs` ✓。

- **真机验证（解耦后）**：`showReadStatus` 默认 false 时，单聊已发送成功的「米哈游/煞笔/干嘛」均无已读圆圈；随后发送 `fuck` 被审核拒绝，气泡左侧红叹号仍正常显示，toast「内容审核未通过，请修改后重试」。证明已读展示与发送中/失败状态已解耦。

## 2026-10-23 SDK init 注入固定 deviceId + 设备平台信息

- **实现**：新增 `libs/client/device.ts` 导出 `resolveDeviceInfo(config)`（同步纯函数）；`EmClient.doInit` 的 `ChatClient.init` 入参展开其结果。`EmKitConfig` 增四字段：`enableDeviceInfo`（总开关，默认 true）、`deviceId` / `deviceName` / `devicePlatform`（显式覆盖）。
- **deviceId 优先级（代码注释与公开文档同口径）**：`config.deviceId` → 持久化值（key `emkit.device.id`，platform.ts 存储收口）→ `uni.getDeviceInfo().deviceId` → 自生成 UUID（无依赖）；后两者一经得出即持久化，下次启动直接读回，跨启动稳定（满足 ChatClient 单例配置比对的会话内稳定性要求）。
- **customDeviceName**：`config.deviceName` ?? 「品牌 型号 (系统)」，逐级回落系统名/osName/平台名。
- **customOSPlatform 的偏差说明（重要）**：websdk 5.1.3 对该字段做 zod 校验——**必须 1–100 整数**（登录 proto 的 `osCustomValue`，属向环信注册过的业务自定义平台编号），与计划书假设的字符串平台名不符（照传字符串会 init 抛错）。定案：`devicePlatform?: number` 显式透传，非法值本地跳过并告警（不拖死 init）；UIKit 不自动派生该平台编号，平台维度由 `customDeviceName` 承担。vue 版 uikit 同样只透传 `deviceId`、不自动传 `customOSPlatform`。
- **文档**：API-KIT（init 配置表四行）、CONFIG（新增「设备信息」小节）、changelog 未发布段同步；`check-docs` ✓（28 页 / 35 组件 / 81 方法 / 34 配置字段）。
- **门禁**：`build web` ✓；`build mp-weixin` ✓ 11 项防回归全绿（主包 1002KB ≤ 1.5MB，分包合计 1425KB）；H5 产物静态伺服 200 ✓（产物 JS 含 `emkit.device.id` / `customOSPlatform` 注入代码）。
- **待验（真实账号/真机）**：H5 登录后抓 init 入参确认三字段注入与两次启动 deviceId 一致（localStorage 未清时）；`enableDeviceInfo: false` 时 init 入参不含任何设备字段；App（iOS/Android/鸿蒙 4.61+ 基线）与微信小程序真机的 deviceId 跨启动稳定性（鸿蒙需 4.61+ 才有 `uni.getDeviceInfo`，旧基座走 UUID 兜底分支）。

## 2026-10-23 发送状态 P2 增强：上传进度 / 群已读回执 / 状态呈现可配置

- **范围**：发送状态审查报告剩余 P2 三项（Reaction 事件按用户决定另行排期，未动）。
- **上传进度**：`deliver()` 与 `performResendMessage` 给 `chatManager.sendMessage` 挂 `SendMessageOptions.onFileUploadProgress`，按整数百分比去重后写 `EmMessageItem.uploadProgress`（仅图片/语音/视频/文件，文本/自定义不挂回调）；发送成功/失败均清空。图片/视频蒙层改纵向布局，loading 下方显示百分比；文件气泡在大小行下方显示百分比。`toMessageItem` 不映射该字段（只属于发送中态）。
- **群已读回执**：新配置 `enableGroupReadReceipt`（默认 `false`，`EmKitConfig` / `EmUiConfig` 双入口）。开启后：群消息发送前补 `needReadReceipt = true`（deliver 与重发两条路径）；`sendReadReceipts` 不再对群聊一刀切短路，改为 `groupReceiptWanted(chatType)` 判定；`onMessageReadReceipts` 的群回执分支把 `receiptDetails` 的累计已读人数写入 `EmMessageItem.groupReadCount`（只前进不回退）；新增 `EmKit.refreshGroupReadCounts(conversationId)`（SDK 单次上限 20，取最近 20 条己方已发送消息，`sessionEpoch` 防护，开关关闭时 no-op），聊天页 `loadInitialHistory` finally 里调用；己方群消息下方展示「N 人已读」（`message.groupReadCount` 中英）。新增常量 `GROUP_READ_RECEIPT_BATCH = 20`。
- **状态呈现可配置**：新配置 `messageStatus`（`position: 'left' | 'right'`、`icons`、`texts`），`EmUiConfig` 存 resolved 形态（`Required<EmMessageStatusPresentation>`），`setConfig` 入参放宽为可只传部分字段（`position` 整体替换、`icons`/`texts` 逐项合并），`applyKitConfig` 归一后写入。聊天页状态列改由 `statusIconOf/statusTextOf/stateClass/statusAtEnd` 驱动：图标缺省回落内置；有文案时状态列宽度自适应并横排；`position: 'right'` 用 `--bubble-row-status-end` 镜像到气泡右侧。发送中/失败判定分支未改。
- **文档**：PLAN（M2.21 里程碑 + §1.3 群已读口径）、CONFIG（EmKitConfig 两行 + 新增「发送状态呈现」节 + EmUiConfig 两行 + setConfig 合并语义）、API-TYPES（`uploadProgress`/`groupReadCount`/`EmMessageStatusPresentation`）、API-KIT（`isGroupReadReceiptEnabled`/`refreshGroupReadCounts`）、PAGES-CHAT（群已读人数/状态呈现/上传进度 + 能力表 + 边界）、MESSAGING、COMPONENTS-CHAT（图片/视频/文件发送中）、changelog 未发布段。
- **门禁**：`build web` ✓（仅既有 demo 组件告警）；`build mp-weixin` ✓ 11 项防回归全绿（主包 1002KB ≤ 1.5MB，分包合计 1425KB）；H5 产物静态伺服 `/` **HTTP 200**；`check-docs` ✓（28 页 / 35 组件 / 81 方法 / 33 配置字段）；`check-skills` ✓（8 技能）；`git diff --check` ✓。
- **真机回归（Redmi Note 7 Pro / Android 10，demo 账号）**：重新登录 → 会话列表 → 单聊 `hhhhh` → 相册选 7.6MB 图片发送成功、图片气泡正常渲染、无已读图标（`showReadStatus` 默认关）、发送中/失败状态未被新配置影响；连续抓帧未捕获到 sending 帧（本机上传过快，系统相册压缩阶段先出现「正在加载…」），上传百分比仍待弱网/大文件补验；测试期间向 demo 账号 `hhhhh` 会话发送了两张噪声图（仅测试数据）。
- **待验**：群已读回执需真实群 + 多成员；上传进度弱网抓帧；`messageStatus.position='right'` 与文案的蒸汽端/小程序视觉；iOS/鸿蒙真机。

## 2026-10-23 SDK init 设备信息两处设计调整（同日修订）

- **deviceId 加平台前缀**：自动派生路径最终格式定稿为 `Platform_<稳定id>`（Platform = 归一平台名 android/ios/harmonyos/web/mp-weixin，小程序走 `#ifdef MP-WEIXIN` 直出，其余端由 `uni.getDeviceInfo()` 的 platform/osName 归一，未识别值原样小写兜底）。宿主显式传入的 `config.deviceId` **原样使用、不加前缀**。持久化存拼好前缀的最终值（key `emkit.device.id` 不变），读回即用，跨启动稳定。
- **移除 customDeviceName**：该字段是环信服务端按 appKey 开启的能力（默认关闭），UIKit 不做设置——`device.ts` 删除设备名组装、`SdkDeviceInfo` 删 `customDeviceName`、`EmKitConfig` 删 `deviceName` 字段；平台/版本维度由 deviceId 前缀承担，uikit 版本不注入任何 SDK 字段（零侵入）。
- **EmKitConfig 定稿四字段（实际三个）**：`enableDeviceInfo`（总开关）、`deviceId`、`devicePlatform`（number，1–100，透传 customOSPlatform，本地预校验非法值跳过+告警）。
- 文档同步：API-KIT（删 deviceName 行、deviceId 行改写）、CONFIG「设备信息」小节重写、changelog 未发布段改写。

## 2026-10-23 deviceId 自动派生改三段式 Platform_uikitVersion_uuid

- **格式**：自动派生最终值由 `Platform_<id>` 两段式升级为 `Platform_uikitVersion_uuid` 三段式（例 `web_1.0.0-rc.1_b3fdc46-...`）。版本段来源：新增 `UIKIT_VERSION` 常量（`libs/constants/index.ts`，注释约定与 `uni_modules/easemob-uikit-uni/package.json` 的 version 同步，不运行时读 json——小程序端不可靠）。
- **升级即新设备的落地机制**：持久化读回时校验「平台段 = 当前平台 且 版本段 = UIKIT_VERSION」，不满足（旧两段式值、异版本值）即按当前格式重新派生并覆盖写入——无需迁移逻辑，与公开文档「UIKit 升级后服务端视为新设备」口径一致。宿主显式 `config.deviceId` 仍原样使用、不加前缀。
- **控制台 resourceId 组成调查结论（websdk 5.1.3 buildDeviceInfo 实测）**：控制台/服务端看到的 resourceId = SDK 包装后的最终 deviceId——SDK 对任何注入的 deviceId 再拼 `webim_${platform}_` 前缀（字面 "webim" + 内置平台段 "web"），login 时 `clientResource = 该最终值`。即 UIKit 注入值位于 resourceId 尾部；注入 `web_1.0.0-rc.1_xxx` 后控制台将显示 `webim_web_web_1.0.0-rc.1_xxx`。用户实测的 `webim_webim_web_<uuid>` 说明该次会话的注入尾段是 `webim_web_<uuid>`（SDK `useFixedDeviceId` 默认开启时优先读 SDK 自己 localStorage `websdk2:device-info` 里既有的固定值，而非本次注入值）。
- **文档**：API-KIT（deviceId 行）、CONFIG「设备信息」表（三段式 + 升级视为新设备说明）、changelog 未发布段同步。

## 2026-10-23 修正：注入 deviceId 时同步关闭 SDK useFixedDeviceId

- **反编译结论（websdk 5.1.3 buildDeviceInfo，已核实）**：`useFixedDeviceId` 缺省 true，开启时优先读 SDK 自己的 localStorage（key `websdk2:device-info`），**有历史值则完全忽略 init 传入的 deviceId**——H5 老用户注入不生效，控制台 resourceId 出现 `webim_webim_web_` 双前缀即此因（SDK 给注入值拼 `webim_${平台}_` 包装时，注入值本身已是 SDK 历史持久化的 `webim_web_xxx`）。另：customOSPlatform 非空时 resource 会被改写为 `custom<N>_<uuid>` 形态（UIKit 默认不注入该字段，不影响默认路径）。
- **落地**：`SdkDeviceInfo` 增 `useFixedDeviceId` 字段——`resolveDeviceInfo` 解析出非空 deviceId 时恒带 `useFixedDeviceId: false`，doInit 随展开一并传入（init 组装仍收敛在 ./device.ts 一处）；`enableDeviceInfo: false` 时不出现该字段，保持 SDK 默认行为。我们自己的 `emkit.device.id` 持久化读回不受影响。
- **文档**：CONFIG「设备信息」补说明段、API-KIT deviceId 行、changelog 条目同步。

## 2026-10-23 deviceId App 端扩六段式（机型 + 系统版本上报）

- **格式**：App 端（platform 归一为 android/ios/harmonyos）且 `uni.getDeviceInfo()` 取到非空 `deviceBrand`/`deviceModel`/`system` 时，自动派生为 `${platform}_${UIKIT_VERSION}_${brand}_${model}_${system}_${stableId}` 六段式（例 `android_1.0.0-rc.1_Xiaomi_23127PN0CC_Android15_b3fdc46-...`）；机型段任一缺失退回三段式。H5/微信小程序无可靠机型信息（UA 不可信），恒三段式。
- **取舍记录**：各段剔除全部空白字符（resource 里不允许空格）；机型/系统段不参与持久化读回校验（校验仍只看平台段+版本段）——同一台机器这两个值不变；用户系统升级后沿用旧系统段也可接受（代价仅是控制台展示旧版本串），不强求重派生。宿主显式 `config.deviceId` 仍原样、不加任何段。
- **实现**：device.ts 内 `sanitizeSegment()` + `resolveModelSegments()`（仅 App 平台调用）；无新增条件编译，平台判断复用现有 `resolvePlatformName()` 归一结果。
- **文档**：API-KIT deviceId 行、CONFIG「设备信息」表、changelog 未发布段同步。

## 2026-10-23 生长输入（换行档）塌陷 / 点不聚焦修复（Android 真机）

- **症状（用户真机反馈，均为换行输入档 `sendOnReturn=false` 的 textarea）**：
  1. 从会话进聊天页时输入框高度会先变成最终高度（视觉残留过程）；
  2. 多次换行且**不清空草稿**后，输入框「看着正常」但点击唤不起键盘，没有 placeholder，像被什么东西遮住。
- **真机复现（Redmi Note 7 Pro / Android 10，dev 包 + adb，uiautomator 量原生 bounds + 截图像素量灰底）**：
  - 草稿 7~8 个硬换行 → 退出再进会话（草稿持久化回填）。修复前实测：**灰底被压到 15~24 CSS px、原生 textarea 只剩 6.5 CSS px，草稿文字溢出到麦克风按钮上方**（点文字区落不到原生输入框 → 不聚焦；草稿非空所以没有 placeholder → 看起来像被遮挡）。修复后同流程灰底 109 CSS px（5 行 + 上下 8px padding）、原生 textarea 93 CSS px。
  - 根因三处叠加：① 旧实现只在「lineCount ≤ 5」时冻结高度，恢复 >5 行草稿时首个 linechange 就超上限 → 封顶态高度恒为 0 → 原生 textarea 塌成一条细线（`auto-height=false` 又没 height）；② 包裹层是 border-box，封顶时只写文本高度，padding 被吃掉、文字顶到灰底边缘；③ 灰底比原生 textarea 大一圈（上下 8px、左右 12px padding 不在原生命中区），点灰底边缘本来就不聚焦。
  - 实测 linechange 上报（logcat 插桩）：单行 18.55px，多行 height/lineCount 恒定 ≈18.6px；恢复 8 行草稿首个事件 `{lineCount:8,height:148.7}`；封顶后上报值会停在布局高度（不可再用来反推，否则封顶高度越学越大，实测出现 109→166px 回路）。
  - 另实测：原生 textarea 的 auto-height **删除整行后不回缩**（灰底停在旧高度，点/失焦都不恢复）。
- **修复（`em-chat-inputbar`）**：
  - 高度口径重写：≤5 行不写高度（原生 auto-height + 包裹层自适应，唯一口径）；>5 行关 auto-height、textarea 显式高度 = `lineHeight × 5`、包裹层 = 该高度 + 16px 竖直 padding；单行高度由 `height / lineCount` 反推并夹在 [12,40]px，封顶后不再学习（避免越学越大）。
  - 封顶高度**恒 > 0**：草稿回填时按硬换行数先 seed 一个封顶高度（兜底行高 19px），消灭首帧「先撑成整段再塌回」的高度跳变；首个超上限的 linechange 只在「已知高度不足封顶高度」时反推一次（恢复草稿、一次粘贴多行都覆盖）。
  - 删行后 auto-height 不回缩：草稿换行数下降（或清空）时把 `auto-height` 关一帧再打开，逼原生重测（实测 166px → 53.5px 当场回缩）。
  - 灰底 padding 区点击转发焦点：包裹层 `@click` → 先 `focus=false` 再 `nextTick` 置 true（`:focus` 是布尔 prop，同值不重发请求）；已聚焦时跳过不打断打字。
  - 输入栏根加 `flex-shrink: 0`（页面 flex 列里不被消息区挤扁）。
- **验证**：真机（同机 adb 实测）进页 8 行草稿 = 109 CSS 灰底 / 93 textarea，不再塌陷；点灰底上沿（padding）唤出键盘；8 行→点删到 2 行灰底回缩到 53.5；5 行内草稿进页高度正确（2/3/4 行分别 53/72/91 CSS）。门禁：`build web` ✓、`build mp-weixin` ✓（11 项防回归全绿，主包 1002KB）、H5 产物伺服 200 ✓。
- **待验**：iOS / 鸿蒙换行档的封顶与回缩（iOS 走同一 textarea 分支，linechange 上报口径可能不同）；H5 与微信小程序的灰底 padding 点击转发；长文本「折行到 >5 行但无硬换行」的封顶（只依赖 linechange，未做 seed）。
- **取舍记录（用户确认）**：不采用「离开页面/失焦时收成单行、聚焦再展开」的折叠形态。理由：① 组件随页面销毁，生长状态本就是每次进页面新建，「离开时重置」对下次进页无实际作用，能被带回的只有草稿内容，而框高必须跟着内容走，否则草稿会被裁掉；② 视觉/交互权威 vue 版 `h5-input` 与微信都是「rows=1 起步 + 随内容生长、失焦不回缩」；③ 进页高度残留/塌陷的根因已单独修掉，不需要靠折叠形态兜底。

## 2026-10-26 1.0.0-rc.2 发布物料整理（未发布）

- **范围**：插件 package version、`UIKIT_VERSION`、demo `versionName/versionCode` 与公开文档当前版本统一为 `1.0.0-rc.2`；changelog 合并为单个 `1.0.0-rc.2（未发布）` 小节。按用户口径，本项目从未正式发布，README 删除历史迁移说明；在用户给出发布信号前，rc.2 继续保持「未发布」。
- **提交**：`bbb6f5b chore(release): 统一 1.0.0-rc.2 版本物料`、`9b849d6 docs(release): 同步 1.0.0-rc.2 公开版本口径`。
- **安全事项**：当前树已无 demo 签名配置/绝对路径，但 `check-release.mjs` 仍会 WARN：Git 历史中的旧 `demo/manifest.json` 提交包含 `keyPassword`。本轮未重写历史；公开发布前需轮换证书密码，并决定重写历史或重建公开仓。
- **门禁**：`check-release` ✓（`OK 发布自检通过（1.0.0-rc.2）；WARN 1 项`，WARN 仅为历史签名密码）；`git diff --check` ✓；`check-docs` ✓（28 页 / 35 组件 / 81 方法 / 33 配置字段）；`check-skills` ✓（8 技能）；`build web` ✓（仅既有 demo warning）；`build mp-weixin` ✓ 11 项防回归全绿（主包 1003KB ≤ 1.5MB，分包合计 1425KB）；H5 产物静态伺服 HTTP 200 ✓。

## 2026-10-26 被踢下线误报「网络异常」修复

- **症状**：多端登录互踢（及改密被踢/设备超限）时连接状态条显示「网络异常，请检查网络情况」。
- **根因**：websdk 5.1.3 被踢以 `reason: "error"` + errorCode 206/216/217（另 207 账号被删 / 214 设备超限）派发 `onDisconnected`（bundle 实测 `handleTerminalConnectionError` → `updateStatus("disconnected","error")`）；banner CLOSED 分支只特判 `token-expired`/`limit`，被踢落入网络异常兜底。
- **修复（对齐 vue 版 connection-events）**：`utils/error.ts` 增 `KICK_ERROR_CODE` + `isKickErrorCode()`；`connectionStore` 增 `kicked`/`kickCode`；`client/index.ts` `onDisconnected` 命中打标，`onConnected`/登录成功/登出清除；`em-connection-banner` 按 kickCode 分流既有四条被踢 i18n 文案（kickedAnotherDevice/kickedPasswordChanged/kickedDeviceLimit/kickedOffline）。
- **文档**：API-KIT store 表、`COMPONENTS-CONVERSATION` banner 段、changelog 1.0.0-rc.2 修复段同步。
- **待验**：H5 双标签同账号互踢（206）与改密（216）真机回归；断网兜底、token 过期、limit 行为不回退。


## 2026-10-26 输入栏单/多行模式拆分 + App 高度单源化（M2.23）

- **根因**：旧多行实现混用原生 `auto-height`、JS 封顶和 `nextTick` 重测；`nextTick` 不保证原生文本控件完成布局，清空/删行后 Android、iOS、鸿蒙都会出现先高后低或旧高度残留。
- **公开契约**：`inputFeatures` 新增可选 `inputMode('single'|'multiline')` 与 `CHAT_INPUT_MODE`。显式 single = 全端单行 input 回车发送；multiline = 全端 textarea 回车换行、纸飞机发送、5 行封顶内滚。未传时保留旧 `sendOnReturn` 三态，旧 iOS 回车发送行为不变。
- **组件**：`em-chat-inputbar` 输入区拆为同目录内部 `em-chat-single-input` / `em-chat-multiline-input`；父组件保留发送、引用/编辑条、工具、面板和 composer 行为。
- **高度定案**：textarea 固定 19px 行高并始终 `auto-height=false`，文本区高度 = `19 × min(可视行数,5)`，包裹层另加 16px；`linechange` 只取行数不取高度。空草稿直接回 1 行，硬换行减少同步收缩，>5 行硬换行草稿首帧直接封顶，不再做平台延时或 auto-height 二次重测。
- **门禁**：`build web` ✓；`build mp-weixin` ✓（11 项全绿，主包 1014KB）；H5 最终产物独立静态伺服 `/` HTTP 200 ✓；`check-docs` ✓；`check-skills` ✓；App 模块图 152 模块、libs 反向依赖与循环均 0 ✓；`git diff --check` ✓。
- **Android 真机（vivo NEX A，1080×2316）**：空态单行正常；6 行稳定封顶且原生命中区高 285px=95 CSS px（19×5）；删到 2 行为 38 CSS px，清空为 19 CSS px；>5 行草稿退出重进直接保持 5 行，无先高后低、塌陷或无法聚焦。
- **鸿蒙真机（nova 12）**：6 行稳定封顶 5 行；删到 2 行再清空均按当前内容回缩，placeholder 与单行灰底恢复，未再出现先高后低。
- **iOS 真机（用户复测）**：多行输入高度表现正常，确认修复观感良好；至此 Android、iOS、鸿蒙三端高度问题均已通过真机验证，本问题暂时收口。
- **常规回归待验**：H5 与微信小程序的真实账号交互未执行（H5 仅产物 200，缺测试账号）；旧 `sendOnReturn` 三态的运行时回归未逐项执行。

## 2026-10-26 消息附件下载（M2.24）

- **范围**：长按图片/视频/文件消息的菜单新增「下载」（`MESSAGE_MENU_KEY.DOWNLOAD`，默认 `messageMenuKeys` 八项：copy/quote/edit/pin/download/recall/resend/delete）。发送中、失败、已撤回的消息不出现；文本/语音/自定义/通知不出现。
- **实现**：`libs/utils/download.ts` 编排消息类型判别、文件名生成、结果归一；平台原语与条件编译收口 `libs/platform.ts`：App/小程序 `uni.downloadFile` + `uni.saveImageToPhotosAlbum` / `uni.saveVideoToPhotosAlbum` / `uni.openDocument`（App 对 doc/docx/xls/xlsx/ppt/pptx/pdf 指定类型、其他类型交给系统尝试；小程序仅支持这七类）；App 下载文件复制到 `USER_DATA_PATH` 并补扩展名（FSM 缺失/复制失败退回临时路径）；H5 同步 `a[download]` 浏览器下载，不写相册。
- **公开面**：`downloadAttachment(message, options?)` 从 `libs` 导出，同时以 `EmKit.downloadAttachment` 透出；新增类型 `EmMessageDownloadKind/Options/Result`；新增业务码 `ERROR_CODE.DOWNLOAD_AUTH_DENIED` / `DOWNLOAD_UNSUPPORTED`；新增 i18n 键 `message.action.download` 与 `message.download.*`（中英）。
- **交互**：App/小程序下载中 loading + 百分比；成功按结果提示「已保存到相册 / 文件已下载并打开 / 文件已下载但当前类型无法打开」；H5 提示「下载已开始」。相册权限拒绝提示「请允许访问相册后重试」，其余失败提示「下载失败，请稍后重试」；单条消息按 localId 加锁防重复点击。
- **文档**：PLAN（M2.24 + §1.2/§1.3）、PAGES-CHAT（附件下载节 + 长按菜单 + 行为边界）、PLATFORM（能力矩阵/权限/下载域名）、CONFIG（默认 `messageMenuKeys`）、API-KIT（`EmKit.downloadAttachment` + 工具表）、API-TYPES（三个类型 + `MESSAGE_MENU_KEY.DOWNLOAD` + 两个错误码）、README、changelog、RELEASE-1.0。
- **门禁**：`build web` ✓；`build mp-weixin` ✓（11 项全绿，主包 1021KB）；H5 静态伺服 200 ✓；`check-docs` ✓（28 页 / 35 组件 / 82 方法 / 33 配置）；`check-skills` ✓（8 技能）；`check-release` ✓（仅历史签名 WARN）；`check-icon-parity` ✓（顺带修正 `statusIconOf` 状态键误报与 `refresh` 旧别名）；i18n 315/315；`git diff --check` ✓；文件名/类型判别纯函数手测通过。
- **待验（真机/真实账号）**：Android/iOS/鸿蒙保存相册与打开文档、相册权限拒绝、微信小程序 `downloadFile` 合法域名与 `openDocument`、H5 浏览器下载/跨域新标签打开、大文件下载进度与页面切换。


## 2026-10-27 接入体验反审整改（M2.25 / M2.26）

- **单聊天起点**：新增 `templates/chat-only` 可运行 Vapor 工程，含登录、重新签发 token 恢复会话、单聊天页、小程序 SDK 分包与 `check-template.mjs`。模板 web/mp 构建通过；分包 11 项检查全绿，主包约 731KB。模板不再依赖不可编译的 minimal-host 夹具。
- **聊天页公开契约**：新增 `showNavBar/showBack`、`peerName/peerAvatar`、页面级 `inputFeatures`（按字段覆盖全局）与 `messageMenuKeys`（数组整体覆盖当前页）。默认输入栏与 `#input-bar` 共用 features 解析结果，菜单与置顶条共用菜单解析结果。身份卸载只撤销本页最后写入且仍匹配的值，避免误删宿主后注入。
- **未登录态**：`ERROR_CODE.UNAUTHORIZED`；`waitOnline` 空账号立即失败，登录后重连行为不变。聊天页显示独立「请先登录」空态并 emit `unauthorized`，隐藏骨架、通用历史错误和输入栏；登录后自动恢复历史，历史 generation 防止旧请求覆盖新状态。
- **主题与品牌化**：新增 `useThemeChrome` 收口 App/mp 原生 chrome 和 H5 `.uni-page-head/.uni-tabbar`，demo 已消费；会话/通讯录/群/聊天信息页新增 `title`。`EmLocaleName` 支持扩展字符串，已注册自定义 locale 可恢复偏好，缺 key 仍回退 zh-CN。显式开启但不可用的 voice/file 在开发环境每类一次性 warning。
- **文档与校验**：修正 CONFIG 配置表、版本口径和业务身份示例；公开业务身份统一 `setUserPresentation`。新增 `check-config-docs.mjs`、`check-dx-contract.mjs`、`check-theme-locale-contract.mjs`；扩展 release 与分包脚本宿主参数。五类页面补接线地图；README/插件 readme/文档首页加入口与现有场景图；changelog 同步。
- **已执行验证**：多轮 `build web`、`build mp-weixin` 全绿；`check-template.mjs` 的模板 web/mp 构建与分包检查全绿；`check-docs`、`check-skills`、`check-release`（仅既有历史签名 WARN）、`check-config-docs`、`check-dx-contract`、`check-theme-locale-contract` 通过。
- **未验证边界**：未使用真实账号执行模板登录/收发，未做微信开发者工具、H5 深色 chrome 运行时、双聊天实例、第三语言界面及 Android/iOS/鸿蒙真机专项；这些不得以编译结果替代。DX 处置记录见 `docs/DX-REMEDIATION.md`「实施结果」。

- **最终复核**：自审补上「加载更早消息期间登出，旧失败回调不弹通用历史错误」的短路，契约检查 RED→GREEN。随后 demo 与模板 web/mp 全量复验、全部分包/文档/技能/发布/配置/用量/`git diff --check` 通过；demo 与模板 H5 最终产物静态伺服均 HTTP 200；生产 H5 产物未包含 voice 开发提示文本。未执行门户 sibling 仓同步构建与 App 新产物模块图检查。

- **SDK 实例公开语义**：新增 `EmKit.getSDKClient(): Promise<ChatClient>`，复用同一初始化就绪门和 SDK 单例，供宿主注册原生事件或使用未封装能力；`whenReady()` 保留原行为并将返回类型由 `unknown` 修正为 `ChatClient`。API-KIT 补原生事件注册/卸载与普通业务优先走 EmKit 的边界说明。
- **chat-only 文档补强**：模板 README 增加设立背景、适用边界与宿主必配项；QUICKSTART 解释模板与完整接入流程的分工；GUIDE-MULTI-SCENARIO 与 DEMO 增加最小单聊模板、完整 Demo 和业务扩展指南之间的选型分流。未新增公开页面或 manifest 条目。

## 2026-10-28 组件级水印（M2.27）

- **范围**：新增原子组件 `em-watermark`；`em-conversation-page` / `em-chat-page` / `em-contact-page` / `em-contact-list-page` / `em-group-page` 新增 `watermark?: string | EmWatermarkOptions` prop 与 `#watermark` 作用域插槽；新增公开类型 `EmWatermarkOptions`；demo「我的」页加水印开关（偏好持久化），会话/聊天/好友/群组/通讯录 demo 页接上；新增开发验证页 `sub-im/pages/watermark-probe`。
- **壳口径**（对齐 vue 版 `#watermark`）：每页在 `brand-scope` 内新增 `__stage`（`flex:1;height:0;position:relative`，不加 `overflow` 以免裁掉组件探出元素），覆盖层 `__watermark` 为 `absolute + 四边 0 + z-index:10 + pointer-events:none + overflow:hidden`。聊天页 stage 只包 nav → 消息列表，底边即输入栏上沿，**天然不含输入栏/表情面板/弹层**；会话/好友/群组/通讯录覆盖 nav + 搜索 + 列表。
- **平铺定案**：初稿「按窗口几何算旋转包围盒 + 固定 px 瓦片」在 H5 首帧暴露 `getWindowInfo()` 早于视口稳定（拿到启动默认尺寸）→ 层尺寸偏小留白；改为**覆盖只由 CSS 决定**（平铺层 `200% × 140%` + 负偏移 + 整层旋转），窗口宽高/宽高比只用于行列密度近似，算错只影响疏密。瓦片数典型 40–70（4 列 × 10 行），旋转只落整层 view，`<text>` 内不增删子节点（§5d/§5j/§5q 规避）。
- **运行期开关**：`hasWatermark` 是实例级常量（`slots.watermark != null || watermark prop !== undefined`），不随开关增删壳节点；关闭用空文案（根节点内联 `display:none`），不要切 `v-if`、也不要用 `undefined` 关闭。
- **H5 实测（Chrome headless + CDP，watermark-probe）**：覆盖层铺满整页（含输入框）；`elementFromPoint` 命中底层 `probe__item`；CDP 真实鼠标点击 `tap 0→1`；触摸长按 `longpress 0→1`；滚轮滚动 `scrollTop 0→400`；点击输入框 `document.activeElement=INPUT`。即 H5 端 `pointer-events:none` 穿透成立。
- **门禁**：`build web` ✓；`build mp-weixin` ✓（11 项防回归全绿，主包 1038KB）；H5 最终产物静态伺服 200 ✓；`check-docs` ✓（29 页 / 36 组件 / 83 方法 / 33 配置）；`check-dx-contract` / `check-config-docs` / `check-theme-locale-contract` / `check-skills` / `check-release`（仅既有 keyPassword WARN）✓；`build app-harmony`（prod）✓ 重编后 `check-app-module-graph` ✓（158 模块，0 反向依赖、0 循环）。App 编译产物已确认 `em-chat-page__watermark` 落成 `pointerEvents:"none"`、`em-watermark__layer/__row/__text` 样式齐全，即 ucss 声明被编译器接受、未被丢弃。
- **待验（真机，不得以编译/ H5 结果替代）**：
  1. **App 三端 `pointer-events:none` 穿透**：用 `sub-im/pages/watermark-probe` 逐端验证「点行计 tap / 长按计 longpress / 列表可滚 / 输入框可聚焦」。这是唯一阻塞项——官方 CSS 文档的「App 平台拍平兼容性」对 `pointer-events` 标 `x`，但蒸汽 runtime 的样式映射表含 `pointer-events`，Android 基座有 `pointerEventsIsNone`/`dispatchPointerEvent`、iOS 基座有 `pointerEvents`/`hitTest`，需真机定案。
  2. 若某端穿透失效：该端不能上覆盖层，需另立「垫底水印」方案（内容容器加 `position:relative;z-index:1`，水印层 `z-index:0`），视觉会被不透明卡片/气泡遮挡，属降级而非等价实现。
  3. 五端视觉验收：暗色模式可读、四角无空洞、瓦片不压住输入框/弹层；聊天页 stage 包裹后键盘避让、滚底锚点、引用定位、多选栏、`#input-bar` 自绘栏逐项回归。
  4. H5 桌面端窗口缩放不重排行列（移动优先，明确不支持）；如宿主需要，二期加 `uni.onWindowResize`（需先确认各端实现）。

## 2026-10-29 鸿蒙真机截图基线 + 截图数据种子页

- **范围**：截图台本见 `reports/screenshot-scope.md`（L0 门面 / L1 页面 / L2 特性 / L3 多端矩阵 30 张 / L4 内部验收）。决策：L3 拍满 6 屏 × 5 端、门面用五端横排、**文档主图必须真机**（H5 不作主图）、主端 = 鸿蒙。
- **新增开发验证页** `demo/sub-im/pages/seed/seed.uvue`（`pages.json` 注册 + `spike` 页入口）：一键把会话灌成截图可用状态。覆盖会话置顶/免打扰、7 条文本样本（长文/链接/手动换行/emoji/长英文词）、引用 + 3 张宿主卡片（`orderCard`/`medicalCase`/`resumeCard`）、图片/视频/文件（下载后上传）、建群 + 公告 + @ 提及、清空记录。
- **种子页三个坑**：
  1. 日志区若放在滚动内容里并自动滚底，日志每增一行按钮就位移 → 自动化点击必错位。已改为**页面底部固定面板**（与 body 的 scroll-view 同级）。
  2. 文件气泡 `sendFile` 校验 `fileSize` 不可为 0（图片/视频可传 0，故两者从未暴露此限）。`uni.downloadFile` 返回值不保证带大小，按「downloadFile.fileSize → `uni.getFileInfo` → 兜底 65536」三级取。
  3. `EmKit` 是**具名导出**（`export const EmKit = new EmKitImpl()`），demo 内一律 `import { EmKit }`，不要写成 default。
- **鸿蒙通道实测**（BLK-AL00 / API 24 / hdc 3.2.0b，随 DevEco 自带）：`hdc shell snapshot_display` 截屏、`uitest uiInput`（click/longClick/swipe/drag/inputText/keyEvent）、`uitest dumpLayout` 元素树三条全通，**能力与 adb 同级**。限制：`dumpLayout` 不暴露 `button` 内 `<text>` 的文本，按文本定位不可用，只能按坐标点击（因此页面布局稳定性是自动化的硬前提）。
- **iOS 通道实测**（iPhone 14 Pro / Xcode 27.1）：`xcrun devicectl device capture screenshot` 可用（1179×2556），`device process launch` 可拉起已装的 `com.Sheffi.EasemobIMLab`；但**设备锁屏时只能截到锁屏**，且 devicectl 无任何点击/滑动能力。
- **首轮产物**：`reports/assets/shots/harmony/` —— 六屏基线（`l3-harmony-*`：会话浅色 / 聊天气泡 / 聊天信息 / 好友列表 / 群组列表 / 会话深色）+ `l2-harmony-custom-cards`（卡片特写）+ `l4-harmony-quote-defect`（缺陷证据）。注意 `reports/` 在 `.gitignore` 内，属工作区资产、不入库。
- **真机问题**：鸿蒙引用卡 2 行截断时**不显示省略号**，末字被直接切掉（`l4-harmony-quote-defect.png`）。**已核对 vue 权威源码：引用卡在气泡下方、竖杠在右、文字右对齐均为设计如此（`quote-card--right` 即 `row-reverse + text-align: right`），不是缺陷**；唯一偏差是 `-webkit-line-clamp: 2` 在浏览器会自动补 `…`，鸿蒙没有。详见 `reports/realdevice-issues.md`。
- **教训**：第一次凭截图判读把「设计如此」误判成缺陷，已按 vue 源码修正。真机问题记录必须附权威对照结论。
- **数据面缺口**：会话列表仅 3 条（1 单聊 / 1 群 / 1 自聊），且聊天全部为己方消息（对端无回复）——当前不具备做门面图与页面主图的内容量，需第二账号补对端消息与更多会话。
- **对端驱动方案（已验证）**：用第二账号（`hfp`）在 **H5** 上登录充当对端，经 Chrome CDP（`Runtime.evaluate` 填表单 + `dispatchEvent('input')` 让 v-model 生效，再点发送位 `.em-chat-inputbar__tool` 末位）脚本化发消息，鸿蒙端作主端接收。这样两端对发、未读徽标、双向气泡全部可脚本产出，不必人工点手机。
  - 登录表单三输入框顺序固定为 `appkey / userId / token`；发送后输入框清空即视为成功。
  - **未读只在「已登录且不在会话内」时累计**：先杀掉进程再让对方发消息，重新登录后未读不会出现，做未读态必须先保持登录再发。
  - 凭据处理：token 只走运行期环境变量与内存，不入仓库；已核对 `git log --all -S` 无提交记录。
- **第二轮产物替换**：`l3-harmony-conversation-light` 换成带未读徽标的版本；`l3-harmony-chat-bubbles` 换成双向气泡（左右两侧同屏）；新增 `l1-harmony-chat-menu`（长按四项菜单）、`l1-harmony-chat-emoji`（表情面板）。
- **截图期临时改动**：`demo/common/ai-stream-demo.ts` 的 `AI_STREAM_FAB_VISIBLE` 需临时置 `false`，否则「AI 演示」浮钮会压住气泡；抓完已还原为 `true`（该文件无残留 diff）。
- **问题登记处**：真机验收问题统一记 `reports/realdevice-issues.md`（RD-01…RD-07），供后续集中修复批次逐条处理。当前 **已确认产品缺陷 1 条（RD-01 鸿蒙引用卡无省略号）、待确认 2 条（RD-02 离线消息未读清零、RD-03 群历史为空）、工具链 4 条**。
- **两处误判已纠正并记入「已排除」**：①「自检页标题渲染错字」是低分辨率预览误读；②「引用卡位置/对齐是缺陷」经 vue 源码对照为设计如此。**规则：真机问题必须先放大原图 + 对照 vue 源码，才能定性为缺陷。**
- **数据面补齐（第三轮）**：会话列表由 3 条扩到 7 条（对 `lp1 / pfh2 / wf1 / wyq1` 各灌一轮并按会话补差异化收尾句，避免摘要全为「短句」）；四类附件气泡（文本/图片/视频/文件）齐备，**仅缺语音**（需真实录音）；未读徽标 + tabBar 角标已出图。
- **新增产物**：`l1-harmony-chat-file`（文件气泡，9.3 KB 真实大小，验证 `sendFile` 的 fileSize 修复）、`l3-harmony-conversation-light`（7 条 + 未读）、`l3-harmony-conversation-dark`（7 条深色）。`reports/` 在 `.gitignore` 内，属工作区资产。
- **鸿蒙录音不可用（RD-08，已修待验证）**：根因是**鸿蒙工程从未声明麦克风权限**——生成工程 `module.json5` 的 `requestPermissions` 只有 `INTERNET`，设备 `reqPermissionDetails` 也无麦克风，`demo/harmony-configs/` 一直是空目录。已新增 `demo/harmony-configs/entry/src/main/module.json5`（完整 module 配置 + `ohos.permission.MICROPHONE` + `reason`/`usedScene`）与对应 `string.json`（`reason_microphone`）。
  - **关键认知**：HBuilderX 对 `harmony-configs` 是 `copyDirectoryEx` **整文件覆盖**（仅 `entryability/EntryAbility.ets`、`index.generated.ets`、两个 `www` 目录在保留清单内），**不是按节点合并**；只放 `requestPermissions` 片段会打掉 `abilities`。因此必须给完整文件。
  - 另：`requestPermissions` 不要重复 `ohos.permission.INTERNET`（框架已加），本机设备曾见 `GET_NETWORK_INFO` 由基座补。
  - **待验证**：重新「运行到鸿蒙」后 ①`bm dump` 出现 `MICROPHONE`；②首次录音是否弹系统授权；③若仍失败则需补运行时申请（鸿蒙 user_grant 走 `abilityAccessCtrl`，DCloud 文档指引用 UTS 插件）。
  - **验证结论（同日晚，全部通过）**：`reqPermissionDetails` 已含 `MICROPHONE` 且 reason/usedScene 正确；首次长按**确实弹出系统授权框**（正文为配置的「发送语音消息时需要录制声音」），说明 **RecorderManager 会自动做运行时申请，无需 UTS 插件**；点允许后按住 2 秒成功发出 `▶ 2″` 语音气泡。
  - **自建构建-安装链路（免 GUI）**：签名材料在 `~/Library/Application Support/HBuilder X/extensions/launcher/agc-certs/`，`dist/dev/app-harmony/build-profile.json5` 带完整 `signingConfigs`；用 DevEco 的 node + `hvigorw.js`（`DEVECO_SDK_HOME` 指向 DevEco sdk）`assembleHap --mode module -p buildMode=debug` 可自签，再 `hdc install -r entry-default-signed.hap`。注意 `uni.sh build app-harmony` 只出 assets、**不组装 `entry/`**，必须借「运行到鸿蒙」留下的已组装工程改配置再重打包。
- **语音气泡截图手法（RD-07 结案）**：`uitest uiInput drag 540 2204 541 2205 200`（位移 1px + 最低速度）等效长按约 2 秒；`longClick` 太快会被「说话时间太短」丢弃，`swipe` 起止点相同无效。
- **相机权限同类补齐**：`ohos.permission.CAMERA` 原本同样缺失（「拍摄」入口会以同样方式失败），已与 MICROPHONE 一并写入 `harmony-configs` 并重签安装；设备端 `reqPermissions` = `CAMERA / GET_NETWORK_INFO / INTERNET / MICROPHONE`。相册无需权限（走系统 Picker）。
- **语音气泡已入图**：`l1-harmony-chat-voice`；至此「黄总」会话具备文本 / 图片 / 视频 / 文件 / 语音五类气泡 + 自定义卡片，L0-03 气泡全家福素材齐备（仅受 RD-04 浮钮遮挡影响，需关浮钮后重拍）。
- **权限说明落地到 UIKit 自身的 6 个面**（此前只有 `PLATFORM.md` 一带而过，且完全没提鸿蒙）：
  1. `uni_modules/easemob-uikit-uni/readme.md` ——「已知限制」补鸿蒙一条（整文件覆盖 + 相册免声明）；
  2. `docs/QUICKSTART.md` —— App 端权限段补鸿蒙 `harmony-configs` 写法规约；
  3. `docs/HARMONY-REALDEVICE-RUN.md` —— 新增 **5.1 权限声明**：完整 json5 示例、三个坑、`bm dump` 排查命令；并把原文「首次运行生成 `harmony-configs/`（空目录属正常）」改成「不要空着」——这句正是 RD-08 的认知源头；
  4. `docs/FAQ.md` ——「图片/语音/视频发送失败」补鸿蒙配置前提；
  5. `skills/em-host-integration` —— 新增 **4.1 平台权限声明（宿主必做）**，五端对照表 + 鸿蒙特有坑 + 症状对照；
  6. `skills/em-host-troubleshooting` —— 新增 **9.3 录音/拍摄权限专项**，症状→根因→修复表，并给出判断口诀「系统根本不弹窗=声明问题；弹过窗但被拒=用户态问题」。
  - `package.json` 的 `dcloudext.declaration.permissions` 原本已含「相机、相册、麦克风」，无需改（该字段描述**用到了什么**，不是**怎么声明**）。
  - 结论口径：**权限属于宿主工程，UIKit 不能替宿主声明，但必须把「必做项 + 漏声明的症状」写清楚**，否则宿主只会看到一句「录音失败」。门禁：`check-docs` 29 页 ✓、`check-skills` 8 个技能 ✓。
- **本轮补拍（L1 其余屏）**：`l1-harmony-conversation-pinned`（置顶态：灰底 + pin 图标，且置顶会话稳居首位）、`l1-harmony-chat-dark`（深色聊天页，无浮钮）。至此鸿蒙素材 15 张。
- **新缺陷 RD-09（已确认，中）：会话列表空态永不显示**。搜索无结果、切到空 tab 时列表整片空白，无图标无文案。定位：模板条件是 `conversationStore.loaded && items.length === 0`，而 seed 页实测打点为 **`loaded=false syncing=false items=7`**——items 有 7 条但 `loaded` 恒 false（只在 `refreshSessionList` 与 `onSyncDataFinished` 两处置真，本流程没走这两条）。建议先去掉空态对 `loaded` 的依赖（改 `!syncing && !syncFailed && items.length===0`），再补 `loaded` 语义一致性；`em-group-page` / `em-contact-list-page` 同型写法需一并复核。**因此 L1-05「会话列表空态」暂无法产出。**
- **骨架屏（L1-06）未产出**：需要「本地无缓存 + 正在同步」的窗口；`bm clean -d` 能造但会**连带清掉 demo 预存的 appkey/userId/token**（本次已踩，pfx 的 token 因此丢失，需重新提供）。建议后续给骨架屏加调试开关，或干脆用「登出→重登」窗口抓拍。
- **新缺陷 RD-10（已确认，高）：鸿蒙冷启动会话列表恒失败**。全新安装或清应用数据后登录成功（我的页显示「已连接」），会话列表恒显示「列表加载失败，请重试」，重试/重启/卸载重装均无效。**对照实验**：同账号（pfh）同 token，在 H5 清 `localStorage` + IndexedDB 后登录，列表正常加载 6 条 → 排除 token/账号/冷启动因素，定位为**鸿蒙平台专属**、且仅在会话列表同步路径。旁证：鸿蒙端通讯录（好友 5 / 群 35）正常，说明连接与鉴权没问题。根因推测：`syncConversations()` 的 `chatManager.refreshSessionList()` 在无本地缓存时抛错，而 `onSyncDataFinished()` 的 `getConversationList()` 未被用作兜底。**该问题阻塞全部剩余鸿蒙截图。**
- **本地凭据**：新增 `local.credentials.sh`（已被 `.gitignore` 的 `local.credentials.*` 覆盖），存放 `EM_APPKEY` / `EM_PFH_TOKEN` / `EM_HFP_TOKEN`，登录脚本统一 `source` 读取；已核对 `git status` 不含该文件。
- **RD-10 真因（用户纠正，我上一版判断错误）**：不是「鸿蒙冷启动缺陷」，而是**账号 0 条会话被误判为拉取失败**。`syncConversations()` 里 `refreshSessionList()` 在无会话时返回 `undefined/null`，随后读 `.length` 抛错 → `catch` 置 `syncFailed` → 页面走「加载失败」。**空结果本应走空态。**
  - 我此前拿「H5 清缓存后同账号正常」当反证，**该证据不成立**：H5 的清理（`localStorage` + `indexedDB.databases()`）没有真正删掉 SDK 的 IndexedDB 库，列表实际来自本地缓存。教训：判断服务端返回什么，不能只看 UI 渲染结果，要先确认本地缓存真的清空。
- **修复（RD-10 + RD-09）**：①`refreshSessionList()` / `getConversationList()` 结果归一成数组（`?? []`），成功后显式 `syncFailed=false`；②会话页空态条件由 `conversationStore.loaded && items.length===0` 改为 `!syncing && items.length===0`，不再依赖 `loaded`。门禁：`build web` ✓ / `build mp-weixin` ✓（11 项）/ `check-docs` ✓。
- **⚠️ 手工重编鸿蒙工程的坑（本次踩过）**：不要用「CLI 编译 → rsync 覆盖 `dist/dev/app-harmony` → hvigor 打包」这条路——launcher 的组装不止拷文件，产出的包会白屏/黑屏转圈。**必须走 HBuilderX「运行到鸿蒙」**（它会先 `deleteFiles` 再解压模板 + 拷贝 `harmony-configs`）。本次因此把设备上的包弄坏，等下一次「运行到鸿蒙」恢复。
- **`position: sticky` 蒸汽端已定性**：构建 `app-harmony` 时编译器直接报 `property value 'sticky' is not supported`，即 `em-contact-list-page` 组头吸顶在 App 端不生效（原「待验」项可结案）。若需吸顶须改占位 + 覆盖层自绘方案。
- **公开文档补漏**：`docs/PLATFORM.md` 原文只提 Android 权限声明与 iOS 用途描述，缺鸿蒙；已补「鸿蒙权限声明」段落（`harmony-configs/entry/src/main/module.json5` 的 `requestPermissions`、整文件覆盖语义、签名文件 `build-profile.json5` 已被 gitignore 而权限配置需随仓库分发）。`check-docs` 仍 29 页通过。

## 2026-10-29 鸿蒙重编复验：会话列表同步异常真因（RD-11）

- **前提**：用户手动「运行到鸿蒙」后包恢复正常（不再是黑屏转圈），`demo/unpackage/dist/dev/app-harmony/build-profile.json5` 时间戳显示 13:53 重新组装，编译产物 `assets/uni_modules/easemob-uikit-uni/libs/chat/conversation.js` 已含 `?? []` 归一化，确认 RD-09/RD-10 的改动已进包。参考：手工 CLI 重编会打出坏包，**只能走 HBuilderX「运行到鸿蒙」**（上一条已记）。
- **复验结论：0 会话仍然显示「列表加载失败」，且 1 条会话时同步同样失败。** 用 demo 自带「我的 → 导出调试日志」拿到原生日志（沙盒 `files/emkit-logs-*.txt`，adb 侧可直接 `hdc file recv` 拉取），两段对照：
  ```
  # 0 条会话
  [debug] [chat] onConversationListUpdate, count: 0
  [warn]  [chat] conversation sync failed: fallback Object entries is not supported IsJSUint8Array or IsJSUint16Array
  # 1 条会话（先自己发一条再冷启动）
  [debug] [chat] onConversationListUpdate, count: 1
  [warn]  [chat] conversation sync failed: fallback Object entries is not supported IsJSUint8Array or IsJSUint16Array
  ```
  → **与「有没有会话」无关**，是鸿蒙上会话列表同步每次都抛异常；0 条只是让失败在 UI 上可见（有本地缓存时列表照常渲染、失败被吞）。
- **定位**：`stage=fallback` 是 SDK 自己的错误包装，异常抛在 SDK 的 session-list 同步管线内部（`onConversationListUpdate` 之后约 8ms）；文案 `Object entries is not supported IsJSUint8Array or IsJSUint16Array` 是 **ArkTS 运行时**对 `Object.entries()` 的报错（V8/JSC 不会产出这句），指向**类型化数组**入参。UIKit 编译产物里 `Object.entries` 命中数为 0；SDK 侧候选点是 `chunks/session-list-query-*.js` 的 `stableStringify` / `stripUndefined`，以及 `chunks/common-*.js` 的日志脱敏器（把 `Uint8Array` 当普通对象喂给 `Object.entries`）。
- **最可疑触发条件：`sdkLogLevel: 'DEBUG'`**。SDK 的 `Ve.debug()` 先判级别再 `emit()`，只有 DEBUG 才会跑脱敏 `Fe()`。`demo/pages/login/login.uvue` 之前显式传了 `'DEBUG'`（UIKit 默认 `'WARN'`），是唯一非常规项。
- **本轮代码改动（等下一次「运行到鸿蒙」验证）**：
  1. `demo/pages/login/login.uvue`：`sdkLogLevel` 改 `'WARN'`，并写明原因与「需要 SDK 原始日志时临时改 DEBUG、只在非鸿蒙端复现」。
  2. `demo/common/ai-stream-demo.ts`：`AI_STREAM_FAB_VISIBLE` 置 `false`（截图窗口用，RD-04 浮钮遮挡；出图后再定是修偏移还是恢复）。
- **RD-11 已登记**：`reports/realdevice-issues.md`，状态「待确认」，含复现步骤、原生日志摘录、候选修复（demo 不开 DEBUG / 上游脱敏器对 `ArrayBuffer.isView` 短路 / `syncConversations` 失败回退本地快照）。
- **RD-10 结论修正（第三次）**：`?? []` 归一化仍然是对的方向（防御空结果），但**不是鸿蒙红叉的原因**；「0 会话 → 空态」这条链在鸿蒙上仍被 RD-11 挡着，未通过验收。验收口径已写进清单：0 条属于正常空态，必须显示「暂无会话」。
- **本轮新增真机素材**（`reports/assets/shots/harmony/`，共 27 张）：`l1-harmony-login`（登录页标准态）、`l1-harmony-contact-list`（好友列表 + 字母索引条）、`l1-harmony-group-list`（群卡片流 + 建群入口）、`l1-harmony-new-requests-empty`（新请求空态）、`l1-harmony-chat-media-panel`（相册/拍摄/视频/文件）、`l1-harmony-chat-info`（免打扰 + 置顶双开 + 清空/删除/删好友）、`l1-harmony-conversation-pinned-muted`（置顶灰底 + 免打扰图标）、`l1-harmony-conversation-tab-single`（筛选 tab 单聊）、`l1-harmony-conversation-tab-unread-empty`（未读 tab 空态）、`l1-harmony-conversation-search`（搜索过滤）。**仍缺**：L1-05 会话列表空态（被 RD-11 挡）、L1-06 骨架屏（窗口太短，需加调试开关或登出重登抢拍）、L1-17 新请求待处理双按钮（需对端发起好友申请）。
- **设备侧可复用的确定性坐标/路径**：底部 tabBar 文本中心 `y=2294`（x：会话 181 / 联系人 541 / 我的 904）；好友列表行 `y=499`、群组列表 `y=703`、新请求 `y=906`；聊天页「+」`(988,2290)`、会话列表「＋」`(988,177)`；日志导出后文件在 `/data/app/el2/100/base/uni.app.UNI08EF252/files/emkit-logs-*.txt`。
- **deliverable 提醒**：`reports/` 仍在 `.gitignore`，截图与问题清单都是工作区资产，不进版本库。

## 2026-10-29 RD-11 复验通过：sdkLogLevel=DEBUG 是鸿蒙同步失败的真凶

- **验证手段**：改 `demo/pages/login/login.uvue` 的 `sdkLogLevel` 为 `'WARN'` 后重编，用同账号登录 → 会话列表**一次拉到 8 条服务端会话**（本地缓存里原本没有这些会话），导出日志里 `Object entries` 出现 **0 次**。RD-11 结案：SDK DEBUG 级日志脱敏对二进制帧调 `Object.entries`，ArkTS 抛错并把同步打断；UIKit 默认值本来就是 `WARN`，只有 demo 开了 DEBUG。
- **同时结掉的两个旧账**：
  - 「0 条会话 = 列表加载失败」在真机上**首次看到正确空态**（浅色 + 深色两张图）。此前两次「已修」的判断都不成立，第三次才落到真实链路。
  - 顺手确认 `AI_STREAM_FAB_VISIBLE=false` 生效：聊天页不再有浮钮遮挡。
- **新缺陷 RD-12（高，已修待验）**：传输层同步偶发失败（日志 `sync websocket retry exhausted`，3 次重试耗尽）时，`em-conversation-page` 会把**整页**替换成「列表加载失败，请重试」；且这个失败分支排在空态分支之前 → 空账号一旦失败就永久停在红叉，点重试也只回到同一画面。证据：同一份日志里四次失败，其中一次发生在**有 1 条会话**时，说明不是空账号专属。
  - **修复**：删掉独立失败分支，空态统一由 `!syncing && items.length === 0` 呈现；仅当 `syncFailed` 且无搜索关键词时，在空态里挂一个「重试」。0 条会话永远看到「没有会话」，不再被失败态劫持。
  - 门禁：`build web` ✓ / `build mp-weixin` ✓（11 项）/ `check-docs` ✓（29 页）。
- **待查**：`sync websocket retry exhausted` 本身是服务端限流（本轮短时间内反复登录/删会话/切页触发同步）还是客户端问题，需要一次独立复现；不影响本次渲染层修复。
- **文档补漏（宿主向）**：`docs/FAQ.md`「会话列表为空」补两条（鸿蒙别开 `sdkLogLevel:'DEBUG'`；空列表与同步失败是两种状态）；`docs/HARMONY-REALDEVICE-RUN.md` 新增 **5.2 SDK 调试日志：鸿蒙上不要开 DEBUG**，含排查路径。
- **新增/替换素材**：`l1-harmony-conversation-empty`（浅色空态）、`l1-harmony-conversation-empty-dark`（深色空态）、`l1-harmony-conversation-list`（8 条服务端会话，置顶/免打扰齐备）、`l3-harmony-conversation-light` / `l3-harmony-conversation-dark` 用 8 条版本替换。鸿蒙素材现 30 张。
- **骨架屏（L1-06）仍缺**：seed 页已加「骨架屏保持 12 秒并跳会话页」按钮（`conversationStore.items=[]` + `syncing=true`，12 秒后自动恢复），但本轮触发时正好撞上 RD-12 的失败态，页面显示的是红叉而不是骨架。RD-12 修完再抓。
- **删会话做空态的代价与恢复**：为产出空态把账号下 8 条会话全部删除（服务端也删），已用「发一条消息」重新造出 1 条；后续如需多会话列表，用 seed 页 + H5 对端重灌。

## 2026-10-29 RD-12 复验通过 + L1 会话列表三态补齐

- **RD-12 已修已验**：复验时日志仍报 `sync websocket retry exhausted`（同步确实失败），但页面呈现是**空态「没有会话」+「重试」**，不再是整页红叉。证据图 `l2-harmony-empty-with-retry.png`。渲染层修复生效，传输层抖动不再劫持整页。
- **L1 三态补齐**（此前连续两轮卡住的项）：
  - `l1-harmony-conversation-empty.png` / `l1-harmony-conversation-empty-dark.png` —— 0 条会话空态（浅色/深色），不再出现「列表加载失败」。
  - `l1-harmony-conversation-skeleton.png` —— 首次同步骨架屏（6 行：圆头像 + 双行骨架 + 时间占位 + 未读圆点）。抓拍方式：从「我的」切回会话页触发 `onMounted → syncList()`，用**无间隔连拍**命中；真实窗口约 1 帧（~120ms），seed 页的「保持 12 秒」按钮会被随后到达的 `onSyncDataFinished` 立刻取消，靠它抓不到（该按钮对「慢网」场景仍有效，只是本地同步太快）。
- **教训**：判断「同步失败」要看日志，不要看 UI——同一张「没有会话」空态，可能是同步成功后的空列表，也可能是同步失败后的降级呈现（此时带「重试」）。
- **鸿蒙素材现有 31 张**（`reports/assets/shots/harmony/`）。仍缺：L1-13 群形态（公告 + @ + 群已读，需有公告的群）、L1-17 新请求待处理双按钮（需对端发起好友申请）、L1-10 已读/发送失败（需断网造失败气泡）、L0 门面图（需五端素材齐）。
- **待查（不影响交付）**：`sync websocket retry exhausted` 的稳定性——本轮复验期间又出现两次，且发生在 0 条会话时；需确认是服务端对高频登录/同步的限流，还是 SDK 同步通道自身重试策略问题。

## 2026-10-29 Android 真机接入：L3 六屏 + L1 九屏，并复现同步失败

- **设备**：HLK-AL00 / Android 10 / 1080×2340 @480dpi，`adb` 全通（截屏/点击/输入/滑动/uiautomator）。APK 由用户「运行到 Android」装出（14:34，bundle `uni.app.UNI08EF252`，与鸿蒙同 id），**已含本轮全部修复**。
- **数据清理**：Android 首次登录时发现两条会话的摘要被**日志文本**污染（此前鸿蒙侧导出日志把全文写进剪贴板，输入时被 IME 粘进输入框发出）。处理方式：删掉受污染会话 → 用 seed 页按 `userId` 重灌中文样本（`hfp`=黄总、`lp1`=lp1），得到干净的文本/emoji/图片/视频/文件五类内容。
  - 顺手修掉一个数据坑：seed 页默认的文件 URL `https://www.w3schools.com/html/horse.pdf` 已 404，导致「文件」样本一直失败；换成 `https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf`（13KB）后成功，气泡显示「产品说明.pdf / 64.0 KB」。
- **新增素材（`reports/assets/shots/android/`，15 张）**：
  - L3 六屏：`l3-android-conversation-light` / `chat-bubbles` / `chat-info` / `addressbook` / `groups` / `conversation-dark`；
  - L1：`login`、`chat-bubbles`、`chat-info`、`chat-emoji`、`chat-media-panel`、`contact-list`、`group-list`、`conversation-search`、`conversation-tab-single`。
- **同步问题在 Android 同样出现（重要）**：导出日志里 `conversation sync failed: fallback sync websocket retry exhausted` **8 次**，且与鸿蒙同一账号同一时刻。`sync websocket request sent {attempt:3,maxAttempts:3}` → `closed after complete` → 失败，说明**传输层失败是跨端的**，不是鸿蒙专有；鸿蒙只是「本地缓存为空」时把失败暴露成红叉。相应结论已写回 `reports/realdevice-issues.md` RD-12。
  - 同时反证 RD-11：Android 日志里 `Object entries` **0 次**，确认那是 ArkTS 运行时限制。
- **工具链限制（新登记 RD-13）**：`adb` 的长按注入（`input swipe` 同点/1px、`input motionevent DOWN…UP`）**都不触发** uni-app x 的 longpress，Android 侧抓不到「长按菜单」；鸿蒙的 `uitest uiInput drag` 可以。该类截图暂由鸿蒙承担，Android 若要补需换 uiautomator2/scrcpy。
- **仍未产出**：L1-05 空态（Android 侧需清空会话，会连带影响鸿蒙同账号数据，暂缓）、L1-08 长按菜单（RD-13）、L1-10 已读/发送失败、L1-13 群形态（缺带公告的群）、L1-17 好友申请（需对端发起）。

## 2026-10-29 Android 空列表复验：失败非必现、渲染已兜住

- **背景**：用户手动把 Android 侧会话删空，要求观察空列表是否也出现鸿蒙那类问题。
- **结论**（同一账号、同一构建，15:01–15:04）：
  1. **冷启动 + 登录 → 空态正常**：显示「没有会话」，日志 `onConversationListUpdate, count: 0`，失败 0 次。
  2. **连续切页触发同步 → 4 次里 1 次失败**（`sync websocket retry exhausted`）；此刻 UI 显示**空态 + 重试**（`l2-android-empty-with-retry.png`），**不是红叉** → RD-12 渲染修复在 Android 同样生效。
  3. **「重试」链路有效**：点击后日志确实追加了同步请求（07:02:53 / 07:03:16 各失败一次），只是这段窗口内连续失败 3 次——失败会**成簇**，不是每次必现。
  4. **再冷启动后第一次同步又成功**（failures 0）→ 与「0 条会话必失败」无关。
- **定性**：会话列表同步失败是**跨端、间歇、成簇**的传输层问题（一次性 WebSocket `wss://…/ws?…` 请求发出后连接被关闭、应答未回，重试 3 次耗尽）。UIKit 已把「一次失败」降级为空态 + 重试，不再整页红叉；根因需 SDK/服务端侧修。
- **新增素材**：`l1-android-conversation-empty.png`（Android 空态）、`l2-android-empty-with-retry.png`（Android 失败降级态）。
- **Android 素材累计 17 张**，L3 六屏齐全。

## 2026-10-29 Android 补拍 L2 特性专题层：lab 页直出，L2 十项补齐

- **做法**：L2 全部走 demo 已有 lab 页（`我的 → 样式实验室 / IM 场景实验室`），**不改代码、不造数据**，靠 `adb` 点击 + 滚动拼接产出。滚动拼接采用**慢拖（1400ms / 600px）+ 逐帧位移测量 + 空白行落刀**，避免甩动惯性导致的错位；`input swipe` 快拖带惯性会让每屏位移不一致（实测 913/25/831 乱跳）。
- **新增素材 19 张**（`reports/assets/shots/android/`）：
  - L2-04 `l2-android-ai-stream-{typing,done,error}.png` + `l2-android-ai-stream-3frames.png`（光标态/终态/异常态三帧竖排）。
  - L2-09 `l2-android-atoms-{avatar-icon,empty-skeleton}.png`（原子组件陈列；长图方案被 RD-14 的末端裁切挡掉，改两屏定格）。
  - L2-08 `l2-android-states-{button-loading,load-more,picker}.png`（按钮 loading / 触底失败重试 / 选人弹层已选态）。
  - L2-07 `l2-android-primary-color.png`（同屏对比 #33B1FF 默认 vs #24F26C 业务主色）+ 两张原图。
  - L2-10 `l2-android-scenarios-list.png` + `l2-android-scenario-detail.png`（六场景卡片流 + 在线客服业务上下文页）。
  - L2-03 `l2-android-input-toolbar.png`（#banner + 输入栏发卡胶囊「发订单/发工单/退款审核」+ 快捷回复条「查询订单/退换货/人工客服」+ 场景开关）。
  - L2-01/02 `l2-android-custom-card-closeup.png`（单卡近景）+ `l2-android-custom-cards.png`（14 种卡片 + 未注册回落，1080×12373 长图，含 `orderCard…demoUnregisteredCard` 全部 event 标签）。
  - L2-05 `l2-android-watermark-chat.png`（聊天页水印平铺，**输入栏区无水印**，与 `COMPONENTS-CHAT` 契约一致）。
  - L2-06 `l2-android-i18n-{en,zh-en}.png`（中英同屏对照：好友列表/群组列表/新请求）。
- **两处值得写进文档/坑集的观察**：
  1. **主色不驱动己方气泡底色**：把 `primaryColor` 改成绿色后，头像、筛选胶囊、按钮、索引条全部跟随，但**己方气泡仍是 `#009EFF`**（`--em-bubble-bg-self` 是独立静态变量，不参与 primary 派生）。宿主换肤要改气泡必须单独覆盖该变量。
  2. **原生 tabBar 不吃 i18n**：切到 English 后页面内文案全变，底部 `会话/联系人/我的` 三个 tab 仍是中文（来自 `pages.json`，不走运行时 locale）。
- **新登记缺陷**：RD-14（lab 页 `scroll-view + min-height:100vh` 内容末端被裁，原子组件页最后一段 `em-skeleton` 滚不到、卡片页页脚被切）、RD-15（选人弹层底部「确认」点不动、顶部关闭可点，待定位是滚动容器裁点击区还是 `em-button` disabled→enabled 状态残留；需在「邀请入群」真实链路复验）。
- **状态**：L2 十项在 Android 侧全部有图；L1-06 骨架屏在 Android **抓不到**（缓存直出，切 tab 不出现骨架窗口），该类图继续用鸿蒙 `l1-harmony-conversation-skeleton.png`。

## 2026-10-29 截图进文档栈：新增发布流水线 + 界面截图页

- **目标**：把 Android / 鸿蒙两端的真机截图从内部工作区（`reports/assets/shots/`，gitignored）搬进对外文档栈，并搭一套「后续每端截图直接落位」的机制。
- **新增发布流水线（`scripts/`）**：
  - `sync-shots.mjs`：扫**公开页里的实际引用**（`assets/shots/...`），反查内部原图 → 统一压缩 → 写到 `docs/assets/shots/`；`--check` 校验引用完整性 + 孤儿文件。用「文档引用什么就发布什么」代替维护图片清单，避免资产与文档漂移。
  - `shots-publish.py`：单图压缩（Pillow，**WebP q82、最大宽 750**；实测 750 宽聊天页 404KB PNG → 53KB WebP）。
  - `shots-compose.py` + `shots-compose.json`：把多张截图按**等高并排**拼成一张对照图（图内不写字，平台说明写进 Markdown 图注）。
  - 产出规模：**20 张单图 + 15 张对照图，合计 792KB**（若全部按单图发布是 46 张 / 1616KB）。
- **新增公开页 `docs/SCREENSHOTS.md`**（站点 `/uniapp/guide/screenshots`，侧边栏新增「界面参考」分组、顶部导航新增「截图」）：阅读约定 + 六屏 × 双端对照 + 页面主流程补充状态 + 专题图索引 + 拍摄口径。manifest 的 `pages` / `editLink` 字面量 / `em-public-docs` skill 的文档地图同步登记。
- **页内预览**：`PLATFORM`、`PAGES-CONVERSATION`、`PAGES-CHAT`、`PAGES-CHAT-INFO`、`PAGES-CONTACTS`、`PAGES-GROUPS`、`THEME-I18N`、`COMPONENTS-BASIC`、`COMPONENTS-CHAT`、`AI-STREAM`、`GUIDE-MULTI-SCENARIO` 各加一节「界面预览」，每页 1–3 张，细节图留在各自能力页而不是堆在画廊里。
- **站点验证**：`easemob-community-docs` 侧 `content:sync` + `content:check` + `pnpm build` 全绿；构建产物里 46 张图全部命中 hashed 资源、无 404。
- **一条工具经验**：用 headless Chrome 截图核对长文档页时，不加 `--virtual-time-budget` 会拍到「图片未解码」的占位（alt 文字 + 破图标），看起来像图挂了；加 `--virtual-time-budget=12000` 后同一构建正常渲染。**判断图是否可用要看 DOM/资产，不要只看一张 headless 截图**。
- **遗留**：H5 / iOS / 小程序三端的截图目录（`docs/assets/shots/{h5,ios,mp-weixin}/`）与对照规格留空位，补拍后加一行引用即可，无需改流水线。

## 2026-10-31 Agent Skills 公开文档同步

- 新增 `scripts/sync-skills-docs.mjs`：从 `skills/README.md` 与 8 份宿主技能生成 `GUIDE-AGENT-SKILLS` + `SKILLS-*` 共 9 个公开页；移除 frontmatter、重写技能/公开文档链接，`--check` 拦截缺失或过期产物。
- `check-skills` 纳入生成新鲜度检查；`check-release` 覆盖全部宿主技能版本基线，统一为 `1.0.0-rc.2`；技能公开措辞清理阶段与内部状态引用。
- manifest 新增「AI 接入 Skills」导航组，生成页通过 `editSource` 回源对应技能；首页与快速开始补入口。
- 社区文档站同步前执行技能检查，并补生成、路由与编辑回源回归测试；自定义站壳 `docs-context.ts` 登记新分类，修复页面可打开但分类导航/左侧页面树缺失的问题。
- 验证：门户 `pnpm test` 181/181、`content:sync`、`content:check`、生产 `pnpm build` 全绿；浏览器走查桌面/390px、明暗主题、技能地图、移动抽屉与集成/小程序/排错详情页。

## 2026-10-31 修复 H5 原生 tabBar 深色染色被切 tab 冲掉（useThemeChrome 持久化守护）

- **缺陷**：H5 端切到深色后，切换 tab 时原生 tabBar 会变回 pages.json 浅色。根因：uni-app x 的 H5 runtime 未实现 `uni.setTabBarStyle`（构建产物验证零匹配），tabBar 文字色是 Vue 响应式内联绑定（颜色状态只来自 pages.json 浅色配置，选中 label 无区分 class）；`syncH5Chrome()` 只在 onShow/主题变化时执行一次，切 tab 时 `selectedIndex` 变化触发重渲染，用浅色值重绑内联样式把覆盖冲掉。
- **修复**（`libs/use/useThemeChrome.ts`，行为增强、API 不变）：WEB 端新增进程级单例 MutationObserver，观察 body 子树中触及 `.uni-tabbar` 的变化（label style/class 重绑、整棵重挂载的 added/removedNodes），setTimeout(0) 去抖后重染；写回同值不产生 mutation record，不会自激。遵守 libs 纪律：纯 ts、索引 for、条件编译收口 WEB。
- **验证**：`build mp-weixin` 全绿（含 11 项防回归）；`build web` 卡在与本次无关的预存问题——`demo/node_modules/easemob-websdk@5.1.3` 的 `chunks/common-DHQukb7J.js` 在本机 web 编译链报 `Identifier "h" has already been declared`；已用 `git checkout` 回退本文件复验失败依旧（与改动无关），且与外部可运行 demo 的同名 chunk 逐字节一致，判断为本机 web 编译环境问题，待查。
- **同步**：修复后的 `useThemeChrome.ts` 已拷贝到宿主示例工程 `easemob-uniappx-demo-534/uni_modules`（此前宿主侧的 `common/h5-tabbar-theme.ts` 临时补丁已删除，改由 uikit 内建能力承担）。


## 2026-10-31 微信小程序双分包低操作接入（M2.28）

- **真实根因沉淀**：外部宿主实测公共 `project.config.json` 已关闭 ignore、但 `project.private.config.json` 仍为 true，私有覆盖导致异步 SDK 被剔除；另一故障为模板 `v-else-if` 缺相邻 `v-if` 导致 HBX 中断，微信随后报 app.json 缺失。两类问题均已转成脚本检查与文档诊断，不再只归因 preload。
- **脚本单源**：prepare 支持仓库位置参数与宿主 flags，写 SDK 前校验 app.json/project.config，patch 公共和已存在私有配置；watch 同时跟踪 app.json、SDK 与两层配置。check 新增分包声明/preload、必需导出、私有配置和 app.json 单一诊断。新增 `mp-weixin.mjs` 统一 dev/build/check/watch，`sync-mp-subpackage.mjs --check` 保证根仓库、宿主 Skill、chat-only 三处脚本字节一致。
- **chat-only 双分包**：聊天页迁到 `sub-im/pages/chat/chat`，登录路由同步；模板自包含 `dev:mp/build:mp/check:mp/watch:mp`。新工程复制即用，既有工程手工声明路由后复用脚本，不自动改写任意 pages.json。
- **文档**：QUICKSTART、双分包指南、FAQ、宿主 mp/troubleshooting Skills、插件 readme 统一新命令和排错；Skills 公开页重新生成；模板 README 覆盖 CLI 与 HBX GUI watch 两条路径。
- **验证**：`node --test scripts/test-mp-subpackage.mjs` 11/11（配置覆盖、私有缺省、app.json 缺失、旧位置参数、npm 命令、同步负例、双分包结构、watch 静止、混合新旧路由拒绝）；demo `build mp-weixin` 全绿，主包 1016KB、分包合计 1451KB；chat-only `build:mp` 全绿，主包 717KB、分包合计 1240KB，sub-im 聊天页声明与产物存在；dev watch 删除 SDK + 私有 ignore 改回 true 后自动恢复，成功后无外部变化不再重写；登录源码与编译产物均校验 sub-im 路由；docs/skills/release/config 检查通过；外部宿主真实登录与真实会话列表已验证。
- **独立阻塞**：demo 与模板 `build web` 仍命中已记录的 HBuilderX 5.34 websdk chunk `Identifier "h" has already been declared`；`audit-usage` 仍报本任务前已有的 `em-watermark` 未归类。未修改第三方 SDK 或水印能力清单。chat-only 未配置专用测试账号，未宣称模板真实收发已验证。

## 2026-10-31 HBuilderX 5.34 H5 websdk 构建兼容（M2.29）

- **根因**：HBuilderX 5.34 Web 编译链无法解析 websdk 5.1.3 的压缩 ESM chunk，报 `Identifier "h" has already been declared`；同一源码在仅临时重打包 SDK 根入口后构建通过，确认不是 UIKit 页面改动导致。
- **修复**：新增 `scripts/web-sdk-build.mjs`，仅在 Web 构建期间用 HBuilderX 自带 esbuild 把 SDK 根入口重打包为单文件；成功或失败均恢复原始 `node_modules` 文件。`scripts/uni.sh build web` 与 `check-template.mjs` 共用该包装器，不提交或长期改写依赖。
- **测试**：`test-web-sdk-build.mjs` 覆盖构建期使用单文件、成功恢复、失败恢复与不遗留备份；与分包测试合计 13/13 通过。
- **验证**：demo `build web` 通过，H5 静态伺服 HTTP 200；`build mp-weixin` 全绿（主包 1016KB、分包合计 1451KB）；chat-only 完整 web/mp 门禁通过；docs/skills/release/config 检查通过，发布检查保留既有 keyPassword 历史警告。

## 2026-11-03 通用 Switch 原子组件（M2.30）

- **组件**：新增 `em-switch`（受控 `modelValue` + `update:modelValue`/`change`，medium 36×20 / small 28×16、12px 圆钮、disabled/loading、customClass/customStyle）；关闭轨道走新 token `--em-switch-off-bg`，开启跟随 `--em-primary-color`，loading 复用 `useSpinRotation`，不依赖 CSS 关键帧。
- **应用**：聊天详情免打扰/置顶 2 个原生 switch 统一替换，事件参数改为 boolean，请求中 loading 防重；建群公开群/允许邀请 2 个 48×28 自绘开关统一替换，保留整行点击，以普通 view 的 `@click.stop` 防双触发，旧样式与 helper 删除。
- **预览与文档**：style-lab states 增 6 组实际可点状态；组件总览、基础组件、设计 token、changelog、能力清单和内部组件结构 skill 同步。
- **验证**：`check-theme-locale-contract`、`check-docs`、`git diff --check` 通过；`build web` 通过、H5 静态伺服 200；`build mp-weixin` 全绿（主包 1026KB、分包合计 1455KB）。H5 实际点击 medium/small 状态正确，medium change 单次计数，disabled/loading 四例点击均不增发事件，明暗视觉正常。独立复核发现自定义组件上的 stop 在 mp 编译为 `catchclick`，改普通 view 包裹后复验产物为 2 个 `catchtap`、0 个 `catchclick`。
- **宿主同步**：`easemob-uniappx-demo-534` 的 7 个 UIKit 文件已逐字节同步；登录 dev 的持久化配置/私有服务器 2 个页面级开关收编为 `em-switch`，以 `custom-style` 保留原深色半透明配色，旧样式与 handler 删除，宿主其他未提交改动未触碰。宿主生产 web 构建与静态伺服 200 通过；mp 编译、SDK 分包/配置/语法检查通过，产物确认登录 2 个 `em-switch`、建群 2 个 `catchtap`。宿主主包 1648KB，超过 1.5MB 检查阈值，未为追求绿灯裁剪宿主功能；隐藏 dev 入口未能通过自动化浏览器展开，宿主登录运行时切换未记为已验证。
- **待验**：App 三端/mp 真机视觉与交互；真实账号下聊天详情请求中防重/失败回滚，以及 `showSettings=true` 时建群整行点击不双触发；宿主登录 dev 两开关与私有服务器字段联动。`audit-usage` 仍只报本任务前已有的 `em-watermark` 未归类，本次未修改该既有项。

## 2026-11-03 鸿蒙权限文档补全与校正

- **外部宿主问题**：`easemob-uniappx-demo-534` 的 `harmony-configs/` 为空，实际生成的 `module.json5` 只声明 `INTERNET`，导致录音运行时授权直接失败且从未出现系统弹窗。已在外部宿主补齐 `MICROPHONE`、`CAMERA`、`GET_NETWORK_INFO` 与中英文 `reason` 资源；重新编译后的真机结果由宿主验证。
- **事实校正**：鸿蒙运行时源码明确对录音调用 `requestSystemPermission(MICROPHONE)`，网络状态模块调用 `requestSystemPermission(GET_NETWORK_INFO)`。因此文档不再笼统写「`GET_NETWORK_INFO` 由框架/基座添加、不要重复声明」，改为以实际生成文件为准、缺失时显式补齐；整文件覆盖时必须保留已有 `INTERNET` 等权限。
- **权限边界**：选择图片/视频走系统 Photo Picker，文件选择走系统文件 Picker，保存图片/视频走 `showAssetsCreationDialog`，均无需额外相册/文件权限；UIKit 仅写剪贴板，无需 `READ_PASTEBOARD`。
- **文档落点**：更新 `HARMONY-REALDEVICE-RUN.md` 的声明/运行时授权/拒绝后处理与完整示例、插件 README、`em-host-integration` 与 `em-host-troubleshooting`；重新生成 Skills 公开页，8 个技能结构校验通过。

## 2026-11-03 修复 App 端 emoji 面板字形裁切

- **定位**：Android / 鸿蒙真机截图中 emoji 同行上沿被整齐裁切，iOS 正常。内置 `em-chat-inputbar` 的 24px emoji 使用无单位 `line-height: 1`，24px 行盒不足以容纳 Android / 鸿蒙原生彩色字形；vue 版同字号采用 28px 行高，demo 自绘输入栏采用 32px 行高，作为工作对照。
- **修复**：`.em-chat-inputbar__emoji-char` 改为固定 `line-height: 32px`；字号、8 列布局、48px 单元格、面板高度与交互均不变，不加平台分支。一次性样式回归断言在旧代码上按预期失败、修复后通过。
- **验证**：`build web`、`build mp-weixin` 全绿（主包 1026KB、分包合计 1455KB），H5 静态伺服 HTTP 200，`git diff --check` 通过。
- **实机验证**：2026-11-04 将同一修复同步到外部宿主 `easemob-uniappx-demo-534` 后，用户实机复测确认 emoji 显示正常；该症状与固定 px 行高规则已沉淀进跨端坑集。

## 2026-11-04 录音输入栏视觉对齐 Vue 移动端

- **按钮与入口**：默认「按住说话」改为无描边的 `--em-bg-secondary` 胶囊，15px 文案；按住仅切换 `--em-bg-hover`，不再显示蓝色/红色描边。语音模式的麦克风入口改为主色图标，不再套用面板按钮的圆形底色。
- **录音浮层**：移除输入栏上方会使整栏长高的提示行，改为屏幕 40% 高度处的居中浮层（32px 麦克风 + 秒数 + 上滑/松开取消提示），取消态使用主色边框/图标/秒数。展示计时按 200ms 采样、以实际开始时间计算秒数，结束与卸载清理 interval；发送时长仍取平台录音结果。
- **跨端约束**：浮层常驻挂载，关闭仅以 `top: 200%` 移出视口，规避蒸汽端新建浮层偶发丢渲染；公开 props/emits、`useChatComposer` 状态机和自绘输入栏 scope 均未改。
- **验证**：`git diff --check`、`build web`、`build mp-weixin` 全绿（14 项分包/语法/体积检查通过，主包 1027KB、分包合计 1455KB），H5 静态伺服 HTTP 200；同步到外部宿主 `easemob-uniappx-demo-534` 后，用户复测认可本轮改造效果。


## 2026-11-04 默认输入栏/图片消息通用注入与宿主 GIF Demo（M2.31）

- **UIKit 仅开扩展点**：`em-chat-inputbar` 新增 `#emoji-panel`（字符、禁用、选择、关闭与禁用上报 scope，缺省原网格），chat-page 仅在宿主提供时转发；chat-page 新增 `#image-message`（message/preview/longPress scope，缺省原图片气泡）。`EmKit.sendImage` 增可选 `ext`，远程图片走 `originalUrl`，按 MIME/文件名识别 GIF；`EmMessageItem.originalUrl/isGif` 贯通发送、接收、历史与失败重发。未新增 stickerPacks、GIF 组件或 sticker 摘要特判。
- **宿主实现**：真正 GIF 功能仅在 `easemob-uniappx-demo-534`：`common/demo-stickers.ts` 自定义 `ext.isSticker=true` 图片协议与发送，3 张 GIF/封面，顶部纯图标 Emoji/表情 tab（按用户微信截图调整），Demo 自绘 120px 原图 aspectFit 气泡且不预览，普通图片回落内置组件。H5 资源先 fetch 转 File，App/小程序走本地文件。
- **跨端修复**：App/mp 不支持插槽处的 `v-bind="scope"`，源仓库与宿主均改为逐项显式 props（源 mp 构建曾按预期失败，修复后通过）。鸿蒙实测发现面板空白，产物确认 `sub-im/static` 未复制：App 改读主包 `static/emojis`，H5/mp 继续读 `sub-im/static`，宿主 prepare 删除 mp 主包重复素材。另一定位问题为 HBuilderX 5.34 对 barrel 导入的函数型 scope props 报 EISDIR，Demo 改用同构本地 Props，完整面板恢复后 H5 构建通过。
- **验证**：新增 `test-gif-injection.mjs` 契约 3 项，与既有构建/分包测试合计 16/16 通过；docs/config/skills 校验通过，两仓 `git diff --check` 通过。源 demo web/mp 全绿（主包 1029KB、分包 1455KB），源与宿主 H5 静态伺服均 200，宿主 GIF URL 200。宿主 web/mp 编译及 SDK 分包/语法检查通过，主包 1652KB（此前已超 1.5MB，本次未裁剪宿主功能），分包 4616KB；mp 主包重复 GIF 已删除。最终审查发现 chat 门面漏转 `sendImage.ext`，已补齐源仓库与宿主并加入回归断言后复跑上述测试与构建。
- **真机与待验**：用户已在鸿蒙全量重编译后确认面板显示正常。真实账号双端发送/接收/历史动画、失败重发与 vue 互通未运行；App/Android/iOS/mp 真机未全量验证。`audit-usage` 仍只报此前已有的 `em-watermark` 未归类，本次未修改该既有项。

## 2026-11-04 文件气泡长文件名中间省略

- **定位**：iOS 真机长文件名被直接裁切且扩展名不可见。`em-file-message` 信息列缺少 Vue 参考实现已有的 `min-width: 0`，长内容可撑开 flex 约束后遭裁切；仅恢复尾部省略仍不能保留文件类型。
- **修复**：文件名展示拆为可单行省略的主体与固定保留的短扩展名，信息列和主体补齐 `min-width: 0`，扩展名禁止收缩；不按固定字符数截断，不依赖蒸汽端 `word-break`。无扩展名、点文件、末尾点及异常超长扩展名回退普通单行省略，原始 `message.fileName`、下载和组件 API 不变。
- **验证**：`git diff --check`、`build web`、`build mp-weixin` 全绿（15 项分包/语法/体积检查通过，主包 1052KB、分包合计 1458KB），H5 静态伺服 HTTP 200，浏览器登录页运行正常。
- **宿主同步**：两个组件文件已逐字节同步到 `easemob-uniappx-demo-534`；宿主 web/mp 编译通过，H5 静态伺服 HTTP 200，websdk 5.2.0 小程序分包生成及必需导出校验通过。宿主其他未提交改动未触碰。
- **待验**：H5/mp 真实聊天页与 iOS 真机的长中英文文件名、短文件名、无扩展名、己方/对方及明暗主题视觉；App 需走 HBuilderX GUI 重新运行，本轮未宣称真机修复已验收。

## 2026-11-05 附件下载补齐 SDK URL 与 secret 规则

- **修复**：消息附件仍走 M2.24 的 `uni.downloadFile` 链路，下载前从原始 SDK 消息体取图片原图/大图/缩略图或视频/文件 URL，并按 SDK 源码规则补 `em-redirect=true` 与可选 `share-secret`；消息附件下载不需要 Bearer token。公开 API、进度回调、相册保存与文档预览行为不变。
- **生命周期**：`store/message.ts` 按 `localId` 保存非响应式原始消息；接收/历史转换及发送/重发成功时登记或更新，删除、裁剪、清空会话和登出时清理，避免丢失 `secret` 或残留账号数据。
- **同步**：相关实现已同步到 `easemob-uniappx-demo-534`，未带入该宿主的其他未提交改动。
- **验证**：现有回归测试 16/16 通过；`build web`、`build mp-weixin` 全绿（15 项分包/语法/体积检查通过，主包 1053KB、分包合计 1458KB），H5 静态伺服 HTTP 200，两仓 `git diff --check` 通过。
- **待验**：真实账号下带/不带 `secret` 的图片、视频、文件下载；App 三端及微信小程序真机的相册保存、文档打开、权限拒绝与合法域名配置。


## 2026-11-05 登录 userId 大写归一化

- **规则**：`EmKit.login` 检测到 userId 包含 ASCII 大写 `A-Z` 时，通过 `[emkit:kit]` 打印警告并强制转小写；纯小写、空字符串及无 ASCII 大写字母输入保持原值，不修改宿主传入的 options 对象。全大写 `PFH` 与混合大小写使用同一转换规则。
- **链路**：归一化在公共门面就绪门前执行一次，SDK 登录、`connectionStore.userId`、登录成功/失败日志及 `ensureUserInfos` 统一消费转换后的 ID，token 与 `Promise<void>` 签名不变；公开生命周期 API 文档已同步。
- **验证**：2026-11-09 全大写回归先确认 `PFH` 原样返回导致测试失败，修复后登录测试 3/3、既有测试合计 30/30、docs 检查通过。按用户要求，后续 `build web`、`build mp-weixin`、H5 静态伺服与真实账号登录收发/未读同步交由用户手动验证。


## 2026-11-06 M2.32 复合消息接收展示（websdk 5.2.0）

- **范围**：demo、插件 peer 与 chat-only 统一精确锁 `easemob-websdk 5.2.0`；新增 `MESSAGE_TYPE.MULTI_BODY`、父消息 `segments` 与 `em-multi-body-message`，在单气泡内按序展示文本/图片/语音/视频/文件/位置/自定义七类分段。只接收与历史展示，不提供创建、发送、重发、转发或输入入口。
- **数据与交互**：`message-body.ts` 共享普通消息与分段映射，子项保留顺序、独立 localId、附件 URL/secret；会话快照/本地重建、引用、菜单标题与置顶预览共用首段摘要。复制拼接非空文本分段；父消息承担长按/状态/撤回/删除，子段复用图片预览、视频播放、语音播放和文件下载。独立位置消息保持 `OTHER + rawType='location'`，空文本不形成可复制内容或空白气泡。
- **组件**：五类普通气泡新增默认关闭的 `embedded`，仅复合分段移除重复壳并约束媒体宽度；普通消息路径不变。样式实验室新增七类分段、收发两侧与明暗/窄屏走查样例；公开消息模型、组件 API、宿主 Skills 与 changelog 同步。
- **测试**：`test-multi-body-message.mjs` 11/11（真实 TS 纯函数 + EmMessageDomain 转换 + 下载 URL/secret），分包测试 11/11；docs 57 页/38 组件、Skills 8 个、模板结构、发布检查与 App 模块图通过；`git diff --check` 通过。`audit-usage` 仍只报此前已有的 `em-watermark` 未归类，本次未改。
- **构建与可视化**：Node 22 下 demo `build web` / `build mp-weixin` 全绿，主包 1071KB、分包合计 1493KB；chat-only web/mp 全绿，主包 759KB、分包合计 1273KB；H5 静态伺服 root/components 均 200。内置浏览器实测七类分段顺序、收发两侧配色、长文件名、位置/自定义内容、390px 窄屏与暗色渲染正常。
- **环境**：Node 26.13.0 下 HBuilderX 5.26 mp 构建在加载其 vite.config 时稳定报 `cachedDataRejected`，清项目缓存与禁用 Node 编译缓存无效；同命令切 Node 22.23.4 后通过，未改产品代码规避。
- **待验**：未运行 Vue 5.2.0 → uni 的真实账号互发/漫游重进、真实附件下载，也未做 App 三端与微信开发者工具/真机的交互和视觉验收；上述路径不得记为已验证。


## 2026-11-11 iOS 首次麦克风授权打断录音状态机修复

- **根因**：DCloud iOS RecorderManager 的 `start()` 异步等待 `requestRecordPermission`；授权前 `audioRecorder` 为空，`stop()` 空操作，允许后仍会起录。UIKit 原实现未监听 `onStart`，且旧轮未终止就允许新 `start()` 覆盖回调；下一次原生 `start()` 先停旧录音，旧 `onStop` 被新一轮当成自动停止并按新开始时间算出 0 秒，表现为持续占用麦克风与反复「录音时间太短」。
- **修复**：`libs/platform.ts` 以完整录音轮次管理忙态，stop/cancel 锁存停止意图，单例 `onStart` 对迟到启动补偿停止；旧轮未终止前忽略新 start。`useChatComposer` 手势入口增加平台忙态守卫，默认与自绘输入栏共享修复。公开方法签名、1 秒过短规则和 60 秒自动停止不变。
- **审查补强**：开始后原生错误先进入丢弃/排水态，等旧 `onStop` 后才允许新会话，避免旧结果污染新轮；重复 `stopRecord()` 共享 Promise，取消以 `EM_RECORD_CANCELLED` 拒绝、原生错误同样拒绝，不再悬挂。composable 在原生 start 前初始化手势态，同步回调不会被后续赋值覆盖，真实失败 toast 去重，正常取消不提示失败。
- **测试**：新增 `scripts/test-record-lifecycle.mjs`，真实打包 App 条件分支与 composable，以延迟 `onStart`、原生活跃态错误及同步回调的 mock RecorderManager 模拟时序。首轮修复前 4 个目标用例失败、3 个对照通过；审查补充的 6 个用例也均先失败后通过，最终录音专项 13/13。
- **构建与文档**：Node 22 下全量测试 43/43；最终代码 `build web`、`build mp-weixin` 全绿（主包 1072KB、分包合计 1493KB），H5 静态伺服 HTTP 200；`check-docs` 与 `git diff --check` 通过。
- **真机**：已确认本机有在线 iPhone；首次授权及后续录音复测由用户手动执行，Android/鸿蒙/mp 冒烟同样不记为已验证。


## 2026-11-11 App 发行配置分级沉淀

- **根因与边界**：外部宿主发行实测确认，SDK 经运行时适配对象动态调用 `connectSocket`，Android/iOS 静态摇树均可能漏掉 `uni-websocket`，导致发行包无法建立 IM 长连接；其他直接调用的网络、文件、媒体与界面模块能由 uni-app x 自动扫描，不全量显式声明。原生模块、权限与隐私声明变更必须重打自定义基座或发行包，JS 热更新不生效。
- **必要项**：公开接入主路径明确 Android/iOS 声明 `uni-websocket`；使用 `easemob-file-picker` 时最低 Android API 24 / iOS 16；按实际功能保留相机、麦克风、相册能力和 iOS 用途描述。Android 权限以最终合并清单为准，不重复添加过宽存储权限。
- **推荐项**：按发行渠道与 HBuilderX 支持设置 `targetSdkVersion`，64 位真机可明确 `arm64-v8a`，App 默认主题可设 `auto`，简单静态托管可用 hash 路由，网络优先 HTTPS/WSS；必须明文时单独说明 Android 原生 `usesCleartextTraffic` 配置及风险。
- **文档落点**：更新 `QUICKSTART.md`、`PLATFORM.md`、`FAQ.md`、插件 readme、`em-host-integration` 与 `em-host-troubleshooting`，并由源 Skills 重新生成公开页；社区门户只通过同步生成，不直接编辑 `.content`。
- **验证**：`check-docs` 57 页 / 38 组件 / 83 EmKit 方法 / 33 配置字段通过，8 个 Skills 新鲜度与结构检查通过，两仓 `git diff --check` 通过；门户 `content:sync`、`content:check`、181 项测试及 VitePress 生产构建通过，产物公开边界复查通过。测试输出仍有既有 Vue 测试桩警告与构建 chunk 体积提示，本次未处理。


## 2026-11-12 SDK 初始化配置统一透传 + 默认登录设备扩展

- **配置面**：`EmKitConfig` 新增 `sdkInitOptions`，公开类型 `EmSdkInitOptions = Omit<InitConfig, 'appKey' | 'appId'>`，WebSDK 全部非身份类原生初始化选项经统一对象展开透传；普通字段优先于 UIKit 自动值，既有 `enableDeviceInfo/deviceId/devicePlatform` 保留兼容。
- **默认设备扩展（合规修订）**：`loginExtensionInfo = JSON.stringify({ deviceName })` 仅含归一平台名，例如 `{"deviceName":"android"}`；自动 `deviceId` 固定为 `Platform_uikitVersion_<id>` 三段式，旧六段式持久化值不再复用。`uni.getDeviceInfo` 只请求 `deviceId/platform/osName`，不读取或上报品牌、型号和系统版本。宿主显式 `sdkInitOptions` 不受影响；`enableDeviceInfo: false` 仅关闭自动设备派生。
- **特殊合并**：`libs/client/init-options.ts` 缺省保留 conversation/contact/group 同步，显式 `enableSyncData` 完整替换；五个 UIKit 必需 Manager 保留并与宿主 Manager 按引用去重合并；`platformAdapterOptions` 普通字段透传，overrides 与既有网络/附件兼容修复组合，宿主同名能力优先。相同 base/custom overrides 引用复用组合 resolver，避免 WebSDK 单例在初始化失败重试时误判配置冲突。
- **测试**：`test-sdk-init-options` 8 项 + `test-device-info` 合规/旧格式迁移 1 项 + 既有登录参数 3 项共 12 项通过，覆盖平台名回退、自定义扩展、原生字段透传、同步类型、Manager、两种平台 overrides 和 resolver 引用稳定性。设备测试路径由仓库位置与 `HBUILDERX_PATH` 派生，不绑定本机检出路径。
- **文档**：PLAN / CONFIG / FAQ / API-KIT-LIFECYCLE / API-TYPES / changelog 已登记；`check-docs` 通过（57 页 / 38 组件 / 83 方法 / 34 配置字段）。Demo 内置 UIKit 已定点同步，device/types/两个新模块与源码逐字一致，client 既有的 Demo 私有差异未覆盖。
- **门禁**：Node 22 全量 Node 测试 52/52；UIKit `build web` 成功、H5 静态伺服 HTTP 200；`build mp-weixin` 成功且 11 项分包检查通过（主包 1073KB、分包合计 1493KB）；当前 Demo H5 编译成功；`check-docs` 与两仓 `git diff --check` 通过。Node 26 下 mp 构建在 Vite 配置加载阶段报 `cachedDataRejected`，同环境切换 Node 22 后通过，确认为编译链运行时兼容问题，未改业务代码或清缓存。
- **真实初始化边界**：以真实 `EmClient` + WebSDK 类替换 `ChatClient.init` 捕获参数，默认扩展为 `{"deviceName":"android"}`，默认 deviceId 为 `android_1.0.0-rc.2_stable-id`，完整参数不含品牌、型号或系统版本；显式扩展 `{"deviceName":"我的设备","source":"uniapp"}` 优先，`serviceConfig/enableDeliveryReceipt` 原样透传，默认/自定义 Manager 数为 5/6。未使用真实账号连接服务端，App/小程序真机设备名仍待实机核验。


## 2026-11-13 全局头像形状配置

- **配置链**：`EmKitConfig` / `EmUiConfig` 新增 `avatarShape`（`'circle' | 'square'`，默认 `'circle'`），`EmKit.init` 显式传入时覆盖、未传时保留当前值，`setConfig` 运行时切换立即生效。
- **组件契约**：`em-avatar` 按“显式 `shape` > 全局配置”解析图片与文字头像；`em-chat-page` 保留局部 prop 并改为缺省跟随全局。`em-conversation-page` / `em-conversation-item` 新增可选 `avatarShape`，真实条目与首次同步骨架屏共用解析结果；群列表移除固定方形，真实头像与骨架均跟随全局。`em-avatar` 仅通过 `useConfig` 读取形状，不连接业务 store，内部组件结构 skill 已登记该例外。
- **测试**：新增 `test-avatar-shape.mjs`，旧代码上默认圆形、初始化合并、组件回落 3 项均按预期失败，实现后 3/3 通过；全量 Node 测试 55/55 通过。
- **文档**：CONFIG、CONCEPTS、基础/会话组件、会话/聊天页面、宿主 conversation-chat Skill、内部架构/组件结构 skill 与 changelog 同步；Skills 公开页重新生成。`check-skills` 8 个技能通过，`check-docs` 57 页 / 38 组件 / 83 方法 / 35 配置字段通过。
- **门禁**：Node 22 下 `build web` 成功，H5 独立端口静态伺服 HTTP 200；`build mp-weixin` 成功且 11 项分包检查通过（主包 1073KB、分包合计 1493KB）；`git diff --check` 通过。
- **Android 真机**：在宿主组件示例页运行时切换全局圆形/方形，两个跟随全局配置的头像均立即更新，显式 `shape="square"` 的局部覆盖保持不变。宿主设置页曾出现状态已更新但单选圈动态 class 不刷新，改为明确的内联边框样式后双向切换通过；该问题不涉及 UIKit 头像本体，无需额外修改组件。
- **待验**：iOS 与微信开发者工具/真机的全局圆形/方形切换视觉与局部覆盖；上述路径本轮未运行，不记为已验证。


## 2026-11-17 HBuilderX 5.34 websdk `h` 重复声明文档修订

- **官方上下文**：DCloud 在 issue `#34492` 确认 HBuilderX 5.34 引入 websdk 后的 `Identifier "h" has already been declared` 问题，并回复将由 HBuilderX 后续修复。当前宿主工程通过根目录 `vite.config.ts` 的 `uni({ autoImportOptions: { ignore: ['h'] } })` 配置规避；已有配置需合并，不覆盖其他插件，不修改或重打包 `node_modules`。
- **文档落点**：更新快速开始、FAQ、平台说明、插件 README、宿主接入与排错 Skills，并重新生成 Skills 公开页；公开排错内容不再引导宿主使用 esbuild 覆盖 SDK。内部 websdk v5 坑集同步登记官方 issue 与配置。
- **验证**：用户已在外部宿主 HBuilderX 5.34 实测配置有效。源仓库 Skills 8 个校验、公开文档 57 页门禁通过；社区门户内容同步、公开内容检查、VitePress 生产构建及 181 项测试通过，生产预览确认快速开始中的标题、配置代码和说明正常渲染。构建仅有既存 Vue 测试桩、语法高亮回退和 chunk 体积警告。



## 2026-11-17 鸿蒙发行签名指南补全

- **文档落点**：`docs/HARMONY-REALDEVICE-RUN.md` 新增发行四件套生成顺序、AGC 发布证书与 Profile 操作、HBuilderX 发布配置、签名材料交叉校验和错误速查；公开内容不包含真实密码、本机路径或证书信息。
- **排错沉淀**：覆盖 `11014003` 密钥库密码与文件不配套、`11111002` 别名/私钥/证书链不匹配、`00303242` 加密密文与 `material` 认证失败，并明确 `.p12` 仅在本地生成、Profile 下载时间不代表证书匹配、`.cer` 证书链需选择叶子发布证书。
- **验证**：`node scripts/check-docs.mjs` 通过（57 页 / 38 组件 / 83 方法 / 35 配置字段）；社区门户 `pnpm build`、公开内容检查与产物复查通过，生成 HTML 已确认包含新增章节。构建前后已有的门户修改均保留，临时备份已清理。


## 2026-11-18 大批量会话请求编排修复

- **用户资料**：`ensureUserInfos` 保持公开签名不变，微任务合批后由单飞 Promise 按 100 人串行分片；单片失败只标记当前片并继续后续片，重连仅补拉失败项。登出清空待处理队列，在途旧响应按账号代次隔离，旧 flush 完成后仍可调度新账号队列。
- **免打扰**：`syncConversationMuteStates` 按会话类型与 ID 记录成功查询项，后续只查新增及上次失败项；单轮仍按 20 条串行，运行中重复触发共享 Promise 并合并补跑。既有 requestId、settlementRevision、乐观 UI 与回滚基线保护不变，reset 清理记账和 Promise 状态。
- **行为验证**：一次性 esbuild/Node 校验直接加载真实 TS。资料修复前先复现 205 人单请求，修复后确认 `100/100/5`、`maxActive=1`、缓存/loading/failed/重复 ID 判重、中间片失败隔离、重连仅补失败 100 人、flush 中新增 50 人补排、登出清队列及账号切换旧响应隔离。免打扰修复前先复现 45 条连续两轮 `[20,20,5]`，修复后确认第二轮零请求、新增 2 条仅一批、失败批单独重查、重复触发合并补跑且不重叠、乐观 mute 不被权威查询覆盖、reset 后旧结果与旧 finally 不影响新任务。
- **构建门禁**：两次功能阶段及最终阶段的 `build web`、`build mp-weixin` 均通过；小程序 11 项分包检查通过，最终主包 1054KB、分包合计 1489KB；最终 H5 产物静态伺服 HTTP 200。文档与 Skills 校验通过；能力清单审计仍报历史 `em-watermark` 未归类，本次未修改该组件或清单，不混入无关修复。未使用真实千级会话账号或真机压测，实际服务端时延与各端真机请求日志仍需另行验收。
- **独立审查修复**：审查发现并成功复现四类边界后集中修复：资料 flush 固定整轮账号代次，登出后不再继续旧分片；整轮预占 loading，未来分片热更新不会重复入队；`DURATION` 到期后仅使当前会话记账失效并增量权威校正，避免直接清除在途乐观状态；删除会话清理记账与到期定时器，旧响应还需匹配会话代次才可回写或记账。回归确认账号切换请求由错误的 `[100,100,5,1]` 收敛为 `[100,1]`，未来 ID 重复序列由 `[100,1,1]` 收敛为 `[100,1]`，到期后自动恢复且删除重建会重查；此前完整行为矩阵再次通过。另保留一个低严重度边界：旧账号免打扰请求若以 reject 结束，仍可能继续剩余旧批次，但代次会阻止其写新账号状态，后续另案评估。
