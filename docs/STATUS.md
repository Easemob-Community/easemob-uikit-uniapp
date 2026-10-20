# STATUS.md — 项目进度日志（自 AGENTS.md 拆出，2026-10-15）

> 本文件按时间顺序记录已落地功能与实测结论，**事实详情以本文为准**；AGENTS.md 只保留最小路由。
> 新增进度继续追加到本文末尾；「待验项」汇总在文末。

## 基线：M1/M2 已实现全景（截至 M2.8）

- **库结构**：`uni_modules/easemob-uikit-uni/` —— `libs/`（EmKit 门面 + client/chat/store（connection/conversation/message/theme）/platform/use/locale/utils 功能拆分）、`components/`（`em-avatar`、`em-popup`（内部弹层基座）、`em-action-sheet`（底部动作菜单）、`em-conversation-page`、`em-chat-page`、`em-chat-info-page`（聊天详情）、`em-nav-bar`（safe-top + 44px 行，title/subtitle/showBack/actionIcon props + back/action 事件，小程序胶囊避让内置）、`em-button`、`em-chat-inputbar`（文本/语音/emoji/媒体面板/引用条）、气泡族 `em-text-message`/`em-image-message`/`em-audio-message`/`em-video-message`/`em-file-message`、`em-text`（lines 折叠 + word-break 收口原子组件））。枚举字符串统一收口 `libs/constants/`。
- **SDK**：`easemob-websdk 5.1.3` 精确锁定（peer 同声明；demo login 页头展示 `SDK_VERSION`，升级时同步改）。ChatClient + Manager 注册制（已注册 ChatManager/PushManager/UserInfoManager/ContactManager）；`enableSyncData: ['conversation','contact']` 显式选择。
- **logger 服务**：`libs/utils/logger.ts`（零依赖，`[emkit:<ns>]` 前缀；`EmKitConfig.logLevel/sdkConsoleLog/sdkLogLevel` 三项接线；SDK 结构化日志经 ChatClient 级 `onLog` 转发进 `[emkit:sdk]`）。2000 行内存环形缓冲（与 console 级别解耦），`EmKit.exportLogs()` 分端导出（H5 Blob 下载；小程序/App 写 `USER_DATA_PATH` + 兜底剪贴板），demo mine 页有入口。
- **聊天链路**：引用（`EmMessageItem.quote` 快照，ext `emQuote` key，toMessageItem 三路径统一解析）、撤回（2 分钟窗口，onMessageRecalled 落 recalled 态）、失败重发（原位红叹号，resendMessage 重建投递）、单聊已读回执（enableReadReceipt，≤50 条批量回执，仅最新己方消息显示对勾/空心圆）、typing（cmd 消息 action `TypingBegin`，5s 节流 + 5s 超时，cmd 在 onMessage/loadHistory 边界拦截不落列表）、语音/视频/文件收发（platform.ts 收口媒体选择/录音/播放，录音仅小程序+App、chooseFile 仅小程序+H5、视频预览仅 H5）。
- **输入栏**（`em-chat-inputbar` 原子）：面板状态机 `none|emoji|media` 三态互斥（与键盘互斥、占键盘位）；emoji 96 字符集网格；媒体面板 56×56 瓷贴四格；按住说话（上滑 60px 取消）；引用条（发送成功/手动关闭/切会话清除）。
- **用户属性**：`libs/store/user.ts`（infoByUserId 缓存 + 防重拉，回落链 nickname > conversation.name > userId）+ `libs/chat/user-info.ts`（ensureUserInfos 微任务合批，wire avatarurl 边界归一；登录/会话同步/收消息/拉历史/进会话自动补拉）。
- **时间**：会话列表五档（今天 HH:mm / 昨天 / 周X / MM/DD / YYYY/MM/DD）+ 聊天页时间分隔条（`TIME_DIVIDER_INTERVAL` 默认 5 分钟，`formatDividerTime` 四档）。
- **进入聊天页优化**（对齐 TUIKit uniapp）：navigateTo 前 fire-and-forget 预热；onMounted 并行非阻塞；滚底 scrollTop 双大值（999999/1000000 交替）；首帧隐藏 + 500ms 兜底；加载历史 prepend 锚点保位（500ms 清空）。
- **自绘导航栏**：pages.json 两页 `navigationStyle: custom` + `app-plus.titleNView: false`，header 收口 `em-nav-bar`。
- **聊天详情页**：`em-chat-info-page`（头像昵称条 + 免打扰/置顶 switch（乐观更新失败回滚）+ 清空记录/删除会话（二次确认）；`clearConversationMessages` = removeHistoryMessages 截断 + 本地缓存/游标复位 + 摘要清零）；入口走 `open-info` emit 宿主接线。
- **联系人页（M2.5）**：`em-contact-page`（字母分组 A-Z + `#`、索引条、搜索、新请求入口、长按删除）+ `em-contact-requests-page`（pending 双按钮 + processingIds 幂等）+ `em-alphabet-nav`（27 格恒渲染、touchstart 点按/touchmove 占比滑动、scroll-into-view 同组先清空再赋值）；数据层 `libs/chat/contact.ts`（bind + readyContactManager cast；roster 六事件刷新；**enableSyncData 不传 'contact' 好友同步不启动**；onSyncDataFinished success 才回填自愈；invite 持久化 key `emkit.contact.invites`）+ `libs/utils/pinyin.ts`（setPinyinAdapter 可选注入，零依赖降级）。未做（二期）：黑名单、群组、详情页、穿梭框、presence。
- **一期范围未做/降级清单**：`@我` 提示、会话滑动删除（长按菜单替代）、链接识别与 @高亮、语音波形动画/未读红点、视频原生播放（H5 window.open/其它端 toast）、文件下载进度、引用点击定位原文、消息列表 list-view 复用（仍 scroll-view）、下拉加载历史（点击加载）。

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
| 手动避让时序与高度精度（iOS/鸿蒙扣安全区后贴合度；鸿蒙原「adjustPan 不回弹」是否随手动方案消失） | App 三真机 | 用户已验 Android「顶飞消解」 |
| 会话页/联系人页搜索聚焦顶飞 nav-bar（同根因，fix 待从 chat-page 铺到 conversation/contact 页） | App | 已立案 |
| mp-weixin `onKeyboardHeightChange` 回调与面板跟随观感 | 小程序 | |
| iOS/Android 真机 SDK 分包语法兼容与收发回归、双端互发 | App + 小程序 | |
| 菜单裁剪/feature 开关/自定义消息插槽冒烟 | H5/mp | |
| switch `color=var(--em-primary-color)` 与 em-badge mp 真机视觉 | mp | |
| Android 重连回归（SPIKE 记录）；iOS 端整体待验 | App | |
| 聊天页进页偶尔「二次置底闪动」（补偿拉取触发的列表二次变化 × 两次 scrollToBottom 时序；已搁置，优化方向见上方 2026-10-15 滚底条目） | App | 功能正常，观感优化项 |
| 组头 sticky 蒸汽端实测 | App | 不生效则随列表滚动 |
| 群链路端到端（真实账号：登录 → 建群/群列表 → 群聊收发 → 公告条/@我徽标/成员昵称行） | H5/mp/App | M2.9 各 Phase 共同挂账 |
| 双角色群管理（owner/admin 成员操作矩阵、邀请入群全流程、公告编辑/改名/转让/退群解散/全员禁言禁输入） | H5/mp/真机 | |
| @ 提及全链路（@→选人→ext→高亮/徽标；蒸汽端嵌套 text 的 mention click） | H5/真机 | |
| 群系统通知上屏（建群/成员进出/改名/公告/转让）+ notice 长按菜单禁用 | H5/mp | |
| 蒸汽真机群形态视觉：成员管理覆盖层 fixed 定位与弹层叠放、角色角标、宫格五列、multiple 已选条横滚 | App 三真机 | |
| `EmContactNavEntry` 预留 `visible` 字段未加（PLAN 裁剪项「黑名单入口预留 visible 控制」），M4 黑名单落地时补 | 全端 | 非 breaking |

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
- **待验（需真实账号/真机）**：聊天内发送/接收 12 种卡片、宿主 `action` 回传、未知 event 兜底、聊天页插槽在群聊/单聊的布局；宿主自定义样式在 mp-weixin 的生效范围。

## 2026-10-20 输入栏业务入口 + 场景化发卡（M2.15）

- **内核**：`em-chat-page` 新增 `#input-toolbar` 具名插槽——位置在消息列表与输入栏之间（快捷回复条之上），无作用域、随软键盘上移、不参与消息滚动；不注入时不占高度。无新增 props/emits/组件/类型，仍维持「内核薄」。
- **Demo 宿主实现**：新增 `demo/components/demo-composer-bar`（横向胶囊条，独立 `.vue` + `.css`；场景主色只染图标，容器/胶囊用 `--em-*` token）；聊天页 `#input-toolbar` 注入本场景入口，点击 → `EmKit.sendCustom` 发对应卡片；「场景开关」新增第 7 项「输入栏业务入口」（默认开），可实时关掉验证「不注入即不占位」。
- **场景目录**：每条卡片补 `entryLabel`（短动词文案）/`entryIcon`；新增 `orderCard`（客服「发订单」，kind=order）与 `resumeCard`（招聘「发简历」，kind=profile），卡片总数 12 → 14；入口清单直接由 `scenario.chat.cards` 生成，新增卡片自动多一个入口。`capabilities/steps` 文案从「注册表」改为「宿主卡片/输入栏发卡」。
- **详情页**：新增「输入栏业务入口（进入聊天后可见）」免登录预览——直接复用 `demo-composer-bar`，点击弹窗解释「进聊天后 = sendCustom(event) → 对端 #custom-message 渲染」。
- **文档**：`docs/GUIDE-MULTI-SCENARIO.md` 新增 §3.10（`#input-toolbar` 用法 + 位置/开关/边界/数量建议 + 配图 `assets/scene-lab-composer.png`），§4 增各场景入口清单，§6 七项开关与 14 种卡片；README/PLAN M2.15/EVAL §7/changelog/契约 skill 同步。
- 验证：`build web` ✓；`build mp-weixin` 11 项防回归全绿（主包 832KB / 分包合计 1367KB）；H5 产物伺服 200；500×1100 截图走查客服/医患/招聘详情页入口条（发订单/发工单/退款审核、发病例/发处方、发简历/发邀约/换手机号），免登录卡片预览 14 种 + 未知回落（长图 500×4114）。
- **待验（需真实账号）**：聊天页内入口条与键盘联动（弹起/收起时是否跟随）、点击发卡在对端渲染、入口条在群聊/单聊/小程序的布局与滚动；入口条与快捷回复条同时开启时的两行占位是否压消息列表。
