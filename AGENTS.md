# AGENTS.md — easemob-uikit-uniapp

> 本文件面向 AI 编码代理，假定读者对本项目一无所知。

## 1. 项目现状（重要，先读）

**本项目 M1（demo 最小闭环）已落地，处于 M1/M2 之间。** 已有内容：`PLAN.md`（立项计划书 v0.1，唯一执行依据）、`README.md`、`uni_modules/easemob-uikit-uni/`（`libs/`：EmKit 门面 + client/chat/store（connection/conversation/message/theme）/platform/use/locale/utils 功能拆分；`components/`：`em-avatar`、`em-popup`（内部弹层基座）、`em-action-sheet`（底部动作菜单）、`em-conversation-page`、`em-chat-page`（含自绘 header）、`em-chat-info-page`（聊天详情）、`em-nav-bar`（自绘导航栏原子组件：safe-top + 44px 行，title/subtitle/showBack/actionIcon props + back/action 事件，小程序胶囊避让内置——`#ifdef MP-WEIXIN` 量 `uni.getMenuButtonBoundingClientRect()` 预留右侧宽度）、`em-button`（按钮原子组件，对齐 vue 版 uikit-core EmButton 一期裁剪：type default/primary/danger/outline + size large(42px)/medium(32px) + pill/block/disabled），`em-chat-inputbar`（输入栏：文本/语音/emoji/媒体面板/引用条）、气泡族 `em-text-message`/`em-image-message`/`em-audio-message`/`em-video-message`/`em-file-message`；`em-text`（文本溢出/折叠收口原子组件，lines 折叠 + word-break，布局 class 落宿主标签、文字样式走 text-class））、`demo/`（uni-app x 蒸汽工程：入口 `main.uts`+`App.uvue`、页面 `.uvue`（script 保持纯 ts）、manifest 含 `vapor-render-target: bytecode`；页面：login（appkey/userId/token + 密码换 token 开发入口，页头展示 easemob-websdk 版本常量 `SDK_VERSION`，升级依赖时同步改）、conversation、chat 三个闭环页 + spike/style-lab 两个开发页，`uni_modules` 为指向仓库根的符号链接）、`scripts/uni.sh`（HBuilderX 内置编译器的 CLI 封装，build 支持 web/mp-weixin；**dev web 模式不转换 .uts 入口，H5 验证用 build + 静态伺服**）、`docs/SPIKE-SDK-CONNECTIVITY.md`（五端验证记录：H5 全通；微信小程序、鸿蒙真机登录/收发/重连已实测通过；Android 真机登录/收发已通，重连待验；iOS 待验）、`docs/HARMONY-REALDEVICE-RUN.md`（鸿蒙真机运行与签名配置实测沉淀：包名三方一致原则、自动/手动申请调试证书流程、常见报错处理）。`tests/` 尚未创建。枚举字符串已统一收口 `libs/constants/`（MESSAGE_TYPE/MESSAGE_STATUS/CONVERSATION_TYPE/MESSAGE_EXT_KEY/CONNECTION_STATUS/THEME_MODE/LOCALE + 三组菜单 action key；types 的联合类型改为从 constants 派生，对外类型名不变；SDK wire 字段兼容映射保留字面量于 chat 层边界）。SDK 定稿 `easemob-websdk 5.1.3`（精确锁定；peer 同步声明 5.1.3）（ChatClient + Manager 注册制，已注册 ChatManager/PushManager/UserInfoManager/ContactManager；`enableSyncData: ['conversation','contact']` 显式选择——SDK 默认仅 conversation）。内置 logger 服务已落地：`libs/utils/logger.ts`（零依赖，级别 debug/info/warn/error/silent 收口 constants `LOG_LEVEL`，`createLogger(ns)` 输出统一 `[emkit:<ns>]` 前缀，控制台按 `emkit:` 过滤；debug 走 console.log 求全端稳定）；`EmKitConfig.logLevel`（默认 info）/`sdkConsoleLog`（默认 true）/`sdkLogLevel`（默认 WARN）三项配置在 client init 时接线，SDK 侧管理走 websdk 导出的 `setLogLevel`/`setConsoleLogEnabled`，SDK 结构化日志经 ChatClient 级 `onLog` 事件统一转发进 `[emkit:sdk]`（sdkConsoleLog 关闭后此通道仍在，业务只盯一条 funnel）；对外导出 `createLogger/setLogLevel/getLogLevel/EmLogger`。日志导出已落地：logger 内置 2000 行内存环形缓冲（**与 console 输出级别解耦——被 level 过滤掉的 debug 行也进缓冲**，支持「界面静默、事后导出全量」），`EmKit.exportLogs()` 分端导出（H5 Blob 下载返回 'download'；小程序/App `uni.getFileSystemManager` 写 `USER_DATA_PATH` 返回路径并 best-effort 复制剪贴板；写文件失败兜底剪贴板返回 'clipboard'），配套 `getLogText/clearLogs`、platform 层 `exportTextFile/copyText`，demo mine 页有「导出调试日志」入口。弹层体系已落地：`usePopup`（z-index 运行时递增分配器，基准 2000；`holdTabBar`/`releaseTabBar` 计数器——小程序/App 原生 tabBar 页面内盖不住，弹层打开时 `uni.hideTabBar`、全关后恢复，H5 走条件编译跳过）；`useSafeArea` 已落地（底部/顶部 inset 统一入口，输入栏与弹层面板已接入，无面板时输入栏根节点承担底部安全区）+ `em-popup`/`em-action-sheet`；会话页加号菜单与会话长按（置顶/免打扰/删除，走 EmKit.pinConversation/setConversationMuted/deleteConversation）、聊天页消息长按四菜单已补齐（复制/引用/撤回 2 分钟窗口/本地删除，撤回事件 onMessageRecalled 落 recalled 态）；引用（quote）已落地：`EmMessageItem.quote`（EmQuoteInfo 快照，含可选 type 用于引用卡类型图标），发送时挂消息 ext（`emQuote` key），接收方与历史消息经 `toMessageItem` 解析还原，输入栏上方引用条（发送成功/手动关闭/切会话清除），气泡下方引用卡（无背景竖杠样式，对齐 vue 版 quote-card；己方 row-reverse 竖杠在右，两行折叠）；失败重发已落地：failed 消息原位保留，气泡旁状态列红叹号（仅己方）点击触发 `EmKit.resendMessage`（重建消息再投递，sending/failed 回写，sending 态用 spinner-cycle 图标）。单聊已读回执与 typing 已落地：`EmKitConfig.enableReadReceipt`（默认 true，demo init 显式传）；进入会话/当前会话收到对方消息时 `sendMessageReadReceipts` 批量回执（≤50 条 serverId），对端回执经 `onMessageReadReceipts` 落 `messageStore.peerReadTimeByConversationId`，仅最新一条己方已发送消息显示已读对勾/未读空心圆（对齐 vue 版 readIconDisplay latest）；typing 走 cmd 消息（action `TypingBegin`，constants `CMD_ACTION`，与 vue 版跨端互认），chat 层 5s 节流发送 + 5s 超时消失，cmd 在 onMessage/loadHistory 边界拦截不落消息列表，提示条在聊天页顶部居中（uni 一期无自绘 header，vue 版在 header 副标题区）。气泡族已拆分为原子组件（`em-text-message`/`em-image-message`/`em-audio-message`/`em-video-message`/`em-file-message`，头像/引用卡/状态列留在 chat-page；**气泡下不再逐条显示时间**——时间只走分隔条，对齐 vue 版 config.showTime 默认 false）；语音/视频/文件消息收发已接入（`EmMessageItem` 加 duration/fileName/fileSize；发送走 `EmKit.sendAudio/sendVideo/sendFile`，媒体选择与录音/播放收口在 platform.ts：chooseVideo 全端、chooseFile 仅小程序+H5（App 空实现待补）、录音仅小程序+App（H5 抛错降级）、播放用 createInnerAudioContext 全局互斥；视频点击预览仅 H5 window.open，其它端 toast；文件点击 toast 暂不下载；会话摘要兼容 5.x `image`/`voice` 与 4.x `img`/`audio`）。输入栏已下沉为 `em-chat-inputbar` 原子组件（v-model 草稿 + quote 引用条 props，send/quote-close/media-select/voice-send 事件上抛）：底部面板状态机 `none|emoji|media` 三态互斥（与键盘互斥、占键盘位顶起输入栏）；emoji 字符面板（96 字符集、flex-wrap 网格；光标位置跨端不可得故追加末尾）；媒体面板为输入栏下方内嵌格子（相册/拍摄/视频/文件，56×56 瓷贴，对齐 vue 版 h5-input more-grid，**不再是 action-sheet**；语音走左侧 mic 切换不进格子）；按住说话（touchstart/move/end 手势，上滑 60px 阈值取消，platform 层 cancelRecord 丢弃语义）；拍摄项（chooseImage sourceType camera，H5 退化为文件选择器）。用户属性体系已落地（对齐 vue 版 user-info 三层裁剪版）：`libs/store/user.ts`（userStore.infoByUserId 按 userId 缓存昵称/头像 + loadingByUserId/failedByUserId 防重拉，mergeUserInfo 合并写落 reactive 代理，`displayNameOf`/`avatarOf` 展示 helper，回落链 nickname > conversation.name > userId）+ `libs/chat/user-info.ts`（`ensureUserInfos` 微任务合批——同事件循环多次调用合并为一次 `userInfoManager.getUserInfoByAttribute({userIds, attributes:['nickname','avatarUrl']})`，wire 小写 avatarurl 在边界归一；`onOwnInfoUpdated`/`onUserInfoUpdated` 事件回写；登录成功自拉己方资料，会话同步/收消息/拉历史/进会话自动补拉对端）；消费点：会话列表名称/头像/搜索、聊天页气泡头像（己方也显示）、导航标题（昵称拉到后自动更新）、引用卡发送者、demo mine 页；订阅 subscribeUsersInfo 一期不做。时间展示已对齐 vue 版：会话列表五档（今天 HH:mm / 昨天 / 一周内周X / 今年 MM/DD / 往年 YYYY/MM/DD，均补零）+ 聊天页时间分隔条（首条必显，相邻 >5 分钟插入，常量 `TIME_DIVIDER_INTERVAL` 收口 constants；格式四档：HH:mm / 昨天 HH:mm / 前天 HH:mm / MM-DD HH:mm，跨年 YYYY-MM-DD HH:mm，`formatDividerTime` 于 libs/utils/time.ts）。进入聊天页体验优化已落地（对齐腾讯 TUIKit uniapp 版）：会话页点击 navigateTo 前 fire-and-forget 预热（enterConversation + loadHistory，模块级 messageStore 跳转不销毁，热进入命中缓存零等待）；聊天页 onMounted 并行非阻塞（原串行双 await 是停顿主因）；滚底改 scrollTop 数值方案（初始 999999 预置底部方向，999999/1000000 两值交替赋值保证必触发，免 SelectorQuery 测量；scroll-into-view 只留引用定位与历史保位锚点）；首帧隐藏（消息区 opacity:0，首次滚底后 nextTick 显示 + 500ms 兜底防白屏，遮蔽「顶部首帧→跳底」残留）；加载历史 prepend 锚点保位（记录旧首条 localId → 加载后 scroll-into-view 回位 → 500ms 清空）。聊天页与会话列表页自绘导航栏已落地（小程序胶囊遮挡的通行解）：pages.json 两页均配 `navigationStyle: custom` + `app-plus.titleNView: false`，header 收口为 `em-nav-bar` 原子组件（em-chat-page：标题走昵称回落链，typing 副标题迁入 subtitle，右侧 more-filled 详情按钮落胶囊左侧；em-conversation-page：showBack=false + plusempty 发起单聊按钮，替代原页内 header 行，消除系统栏与页内栏双标题）。**坑：pages.json 变更（如 navigationStyle）dev watch 不会热更新，需重启 dev 编译或重新 build，否则系统栏与自绘栏并存出现双 header**；dev watch 被中途杀掉还可能造成新组件 wxss 残缺（曾致聊天详情页按钮样式丢失），改动后务必让 dev 编译完整跑完一轮。聊天详情页已落地（对齐 vue 版 ChatInfoDrawer 移动端全屏语义 → uni 独立页）：`em-chat-info-page`（对方头像昵称条 + 免打扰/置顶 switch cell（乐观更新失败回滚）+ 清空聊天记录/删除会话胶囊按钮，uni.showModal 二次确认），chat 层新增 `clearConversationMessages`（`removeHistoryMessages` beforeTimestamp 截断清漫游 + 本地缓存/游标复位 + 会话摘要清零）；详情入口走 `em-chat-page` 的 `open-info` emit，路由跳转由宿主页面接线（demo：chat → chat-info，删除后 navigateBack delta 2）。联系人页已落地（M2.5，对齐 vue 版 contact-list/alphabet-nav/notice-list 移动端语义，PLAN.md M2.5 节）：`em-contact-page`（自绘导航栏 + 本地搜索 + 新请求入口卡（pending 红点）+ 字母分组列表（A-Z + `#`，组头 28px、条目 64px/48px 头像、展示名回落链 remark > nickname > userId）+ 右侧字母索引条 + 长按删除好友（showModal 二次确认），emits `select`/`open-requests`/`add`）、`em-contact-requests-page`（好友申请列表：pending 态接受/拒绝双胶囊按钮 + 已处理弱化态，processingIds 幂等）、`em-alphabet-nav` 原子组件（始终渲染完整 27 格、空组淡化不响应、点按走单元格 touchstart 精确命中（免几何测量）、按住滑动走容器 touchmove 占比映射（`resolveAlphabetKeyByOffsetY`，rect 经 createSelectorQuery 惰性查询缓存，查询失败仅滑动降级）、跳转用 scroll-into-view + 组头锚点 id，同组连跳先清空再赋值保证必触发）；数据层 `libs/chat/contact.ts`（bind 模式 + readyContactManager cast 套路；`getContacts()` 内存快照整量回写，好友资料在边界归一并入 userStore；roster 六事件驱动刷新；**联系人自动同步必须显式选择：`ChatClient.init` 的 `enableSyncData` SDK 默认仅 `['conversation']`，不传 `'contact'` 则好友同步不启动、快照永远只有本地缓存残留（H5 靠 localStorage 缓存假象、小程序必空的真根因）——`libs/client/index.ts` 已显式传 `enableSyncData: ['conversation','contact']`（不含 group：依赖 GroupManager，未注册会抛错）；另挂 ChatClient 级 `onSyncDataFinished`（dataType=contact 且 status=success 才回填，failed 只告警）做同步完成后重读自愈，见 SPIKE 踩坑 11**；申请 invite 内存 + `uni.setStorage` 持久化 key `emkit.contact.invites`）+ `libs/store/contact.ts` + `libs/utils/pinyin.ts`（**拼音为 `setPinyinAdapter` 可选注入口，零依赖降级**：未注入时非 A-Z 首字符落 `#` 组、搜索仅原文匹配，与 vue 版默认降级一致）；demo tabBar 加「联系人」第三项（纯文本无图标），添加好友为 demo 级 modal（对齐 vue 版「只 emit add、弹窗业务侧实现」契约）。未做/降级（二期）：黑名单、群组入口、联系人详情页（备注/拉黑 UI）、选人穿梭框、presence、组头 sticky 蒸汽端待实测（不生效则随列表滚动）、索引条滚动反向驱动高亮（SelectorQuery 实测后再补）。H5 实测：登录 → 联系人页渲染/搜索过滤/添加好友（pfh→hfp 申请发送成功）/新请求页空态通过；收申请红点与接受/拒绝链路待双账号实测。

**PLAN 一期范围核对（截至 M2 收尾）**：已完成——会话页（头像/未读徽标/摘要/时间/草稿/置顶免打扰标记（em-icon 字体图标，已去 emoji）/本地搜索（带前置搜索图标）/长按置顶免打扰删除；header 与「+」纯图标按钮、会话项规格已逐项对齐 vue 版 conversation-list/conversation-item）、聊天页 5 种气泡 + 不支持占位、长按四菜单、引用（引用卡 + 输入栏引用条）、撤回 2 分钟窗口、失败重发、单聊已读回执（enableReadReceipt）、typing、草稿、输入栏（语音按住说话/emoji 面板/相册/拍摄/视频/文件）、主题/i18n/图标/零依赖基座。未做/降级——`@我` 提示、会话滑动删除（长按菜单替代）、链接识别与 @高亮、语音播放波形动画与未读红点、视频原生 video 播放（H5 window.open/其它端 toast）、文件下载进度（点击 toast）、`em-custom-message` 自定义消息插槽出口、引用点击定位原文、消息列表 list-view 复用（仍 scroll-view）、avatarShape 主题开关、下拉加载历史（现为点击加载）。M1 H5 端到端已实测（登录 → 会话列表 → 聊天收发文本）；图片发送、微信小程序与 App 端 M1 链路待实测。

**`PLAN.md` 是一期开发的唯一执行依据**（其原文：「任何范围/选型变更先改本文档再动手」）。做任何实现工作前先通读 `PLAN.md`；范围或技术选型需要调整时，必须先修改 `PLAN.md` 再动代码，而不是相反。第 4 节描述的 `pages_init.json` 等仍是**目标结构**，尚未创建（气泡族原子组件已随 M2 落地五种）。

**结构治理（2026-10-14）**：`components/` 已分层——页面级 5 个（`em-conversation-page`/`em-chat-page`/`em-chat-info-page`/`em-contact-page`/`em-contact-requests-page`）迁入 `components/pages/`，宿主 `pages.json` 需配 easycom custom 规则（demo 已配：`"^em-([a-z-]+)-page$": "@/uni_modules/easemob-uikit-uni/components/pages/em-$1-page/em-$1-page.vue"`，原子组件仍走内置规则零配置）；全部 22 个组件样式抽离为同目录同名 `.css`，`.vue` 的 style 块仅留一行 `@import './em-xxx.css'`（ucss 子集与 styleIsolation 纪律不变）。同日抽出新原子组件 3 个：`em-search-bar`（搜索条：modelValue/update:modelValue + placeholder 宿主传 i18n 文案，36px 高圆角条 + search 图标，替换会话页/联系人页两份复制）、`em-badge`（徽标：count/max(默认 99)/dot，0/负数不渲染，18px 药丸 + 8px 圆点，替换会话列表未读/联系人新请求入口/头像角标三处 99+ 截断复制；em-avatar 保留 `__badge` 绝对定位壳、本体收口 em-badge，定位偏移仍随头像尺寸换算）、`em-conversation-item`（会话条目：item/name/avatar/timeText/draft 五 props 收页面装配数据，组件内不连 store，emits click + long-press，模板从 `em-conversation-page` 迁入，类名改 `em-conversation-item` 命名空间）。libs 同步治理：`libs/chat/index.ts` 按域拆为 `message.ts`（消息生命周期 + typing + 已读回执）/`conversation.ts`（会话域 + 共享 `findConversation`），index 收敛为门面（对外 import 路径与 EmKit 方法签名不变，唯 `onMessage` 返回类型改 `() => void`——**P0 修复**：原 handlers 只增不减、聊天页进出反复注册导致每条消息 N 次回调，现 onMounted 注册、onUnmounted 反注册）；constants 增 `RECALL_TIME_LIMIT`/`TYPING_THROTTLE`/`TYPING_TIMEOUT`，chat-page 滚底双值/高亮/保位时长提模块级命名常量；新增 `libs/style/bubble.css`（`.em-bubble`/`.em-bubble--self` 气泡壳基类，5 气泡 + chat-page 占位气泡接入，消 6 处底色/圆角重复）、`libs/style/textStyles.ts`（TEXT_STYLE_NAME/SUBTITLE 共享内联文本档，补 nowrap）、`libs/utils/quote.ts`（引用映射纯函数收口，参数注入 t/displayNameOf）；variables.css 增 `--em-mask-color`（明暗两套）/`--em-chat-panel-height`；死代码清理（removeStorage、usePopup 死段、onTextMessage 废弃链含 spike 页改造、安全区统一走 useSafeArea 删 shim）；`-page` 组件路由契约收口（contact-requests 页 navigateBack 改 emit `back` 宿主接线）；修饰类统一 ns.m 块级形态（元素级 `__x--y` 手写串遗留 alphabet-nav 与气泡内部，二期再收）。**待验项**：switch `color="var(--em-primary-color)"` 与 em-badge 的 mp-weixin 真机视觉。

## 2. 项目概述

环信 IM 的 **uni-app 版 UIKit**，定位为环信 SDK 在 uni 生态的获客漏斗，面向 DCloud 插件市场社区分发。MIT 免费开源，GitHub 主仓 + DCloud 插件市场免费发布。

- 仓库名：`easemob-uikit-uniapp`
- 插件 id / uni_modules 目录名：`easemob-uikit-uni`
- 组件前缀：`em-`；CSS 变量前缀：`--em-*`

## 3. 已确认的决策（来自 PLAN.md 第 0 节，D1–D8）

| 决策点 | 结论 |
|---|---|
| 目标框架 | **uni-app x 蒸汽模式（vapor-only）**，代码守纯 ts 纪律；老 uni-app Vue3「能用算白捡，不做官方承诺」 |
| 目标平台 | Android / iOS / 鸿蒙（蒸汽原生渲染）+ H5 + 微信小程序（后两者走 VDOM 管线编译），共五端 |
| Vue 版本 | 仅 Vue3 组合式 API；不支持 Vue2 |
| 一期范围 | 最小闭环：登录接入 + 会话列表页 + 聊天页（文本/图片/语音/视频/文件 5 种气泡 + 长按四菜单）+ demo 工程 |
| 二期候选 | 通讯录、群基础（建群/群信息/成员列表）、单条转发 |
| 系统地板 | HBuilderX / HBuilder V 5.21+；Android 6+ / iOS 15+ / 鸿蒙 API20+ / 现代浏览器 / 微信小程序基础库 |
| SDK | 环信 websdk（npm `easemob-websdk`，纯 js），作为 **peer 依赖**；小程序端验证既有小程序 SDK 线 |

D1/D4/D5 如需调整，必须先改 PLAN.md 第 0 节的决策表。

## 4. 技术选型与编码纪律（来自 PLAN.md 第 3 节）

| 层 | 选型 / 约束 |
|---|---|
| 语言 | `<script setup lang="ts">` 纯 TS。**禁 uts 方言**：`UTSJSONObject`、`UniElement`、`.uts` 文件不进组件公共面（`UniElement` 相关隔离在 `#ifdef APP` 与 `platform.ts` 内） |
| 组件文件 | 一律 `.vue`；`.uvue` 仅作双文件逃生舱（如消息列表需要 list-view 独占红利时允许 `.uvue` 双实现） |
| 样式 | **ucss 子集**：flex-only、class 选择器、无继承、无 scoped、无伪元素、文字样式只在 `<text>` 上。SCSS 编译期能力（@each/@mixin）可用，产物必须落在子集内。BEM 命名（如 `em-button--primary__text`），由 `useNamespace` composable 生成。**组件样式独立为同目录同名 `.css`（2026-10-14 起），`.vue` 的 style 块仅留 `@import './em-xxx.css'` 一行** |
| 样式隔离 | 策略 2.0：`defineOptions({ styleIsolation: 'app-and-page' })`，**不写 `scoped`** |
| overflow 默认值 | uni-app x 的 view **默认 `overflow: hidden`**（与经典 web 不同），绝对定位负偏移探出盒子的子元素会被根节点裁剪（实测坑：em-avatar 徽标 1/4 探出盒子被切成平顶）——需要探出时根节点显式 `overflow: visible`；圆形裁切交给子元素自身 border-radius，不依赖根节点 overflow |
| 条件编译 | 二维矩阵：模式（`UNI-APP-X`）× 平台（`APP`/`MP-WEIXIN`/`WEB`）；微信小程序开放能力用 `#ifdef MP-WEIXIN` 叠原生 `<button>` |
| 内置组件 | 只用两边共有的内置组件；x 独占组件（page-container/list-view/rich-text 新特性）必须包进内部适配组件：`EmMessageList`（list-view/scroll-view）、`EmPopup`（自研 overlay+view，**不用** page-container） |
| 状态管理 | 裸 `reactive` store，**零运行时依赖**（不装 pinia/dayjs/lodash）。**状态回写必须落在 store 的响应式代理上**：原始对象 push 进 reactive 数组后直接改原始对象不触发蒸汽端细粒度绑定（VDOM 端被整树重渲染掩盖），真机会卡状态——先 `getMessages().find(...)` 取回代理再改。**字段命名约定**：store 内按 key 分组的 Record 一律 `<值语义>By<Key语义>`（如 `infoByUserId`/`draftByConversationId`/`messagesByConversationId`/`cursorByConversationId`/`peerReadTimeByConversationId`）；数组快照一律 `items`（如 `conversationStore.items`/`contactStore.items`）；禁止裸 `map`/`data`/`list` 等无语义命名（局部临时 Record 同样适用） |
| 软键盘 | 聊天页 pages.json 配 `app-plus.softinputMode: adjustResize`（adjustPan 在鸿蒙端键盘收起后布局不回弹） |
| 主题 | `--em-*` CSS 变量双层 class（`.em-theme-light` / `.em-theme-dark`），App 端主题类挂组件根节点（RiceUI trick）；`useTheme().setTheme('dark'\|'light')` |
| i18n | 中/英，文案无硬编码 |
| 枚举字符串 | 统一走 `libs/constants/`（const 对象 + 类型别名），业务代码禁硬编码字面量；**例外**：SDK wire 协议字段（5.x `image`/`voice` vs 4.x `img`/`audio` 双兼容映射、PushManager remindType 等）保留字面量，集中在 `libs/chat` 的 `toMessageItem`/`summaryOf` 边界（对齐 vue 版同名规范） |
| 自定义事件命名 | **禁止与原生事件同名**（`longpress`/`click`/`tap` 等）：小程序里原生事件会穿组件边界冒泡，父组件 `@longpress` 会被原生事件对象二次触发并覆盖自定义 emit 的载荷（实测坑：长按消息菜单拿到 `type='longpress'` 的原生事件）。子组件透传长按用 `long-press` |
| 文本溢出 | 可能溢出的用户内容文本一律走 `em-text` 原子组件（`lines` 折叠 + `word-break` + 省略号 + virtualHost），不再手写 lines/ellipsis。用法：布局 class（flex/min-width）落组件标签；**文字样式必须双通道——`text-class`（H5/App）+ `text-style` 内联（小程序）同时给**：小程序样式隔离下 `app-and-page` 编译为 apply-shared，只放行页面级 wxss，父组件 wxss 的 class 规则够不到 em-text 内部 text（实测坑：会话摘要字号/颜色全失效落默认 16px 近黑），内联 style 不受隔离限制且 var() token 可穿透组件边界；**单行折叠档（line1）必须带 `white-space: nowrap`：mp-weixin 的 wxss 不认 uvue 独占的 `lines` 属性，缺 nowrap 时 text 自由换行，父容器固定行高 + overflow:hidden 会把第二行拦腰裁切，视觉上像两行文字重叠**（实测坑）；宿主标签必须补 `min-width: 0` 等约束，否则 flex 约束链断裂横向溢出（实测坑） |
| 平台适配层 | `libs/platform.ts` 收口存储（`uni.setStorage`）、网络状态、媒体选择/录制，平台差异不落组件 |
| 图标 | iconfont 字体图标（本地 ttf 组件同级目录 + `@font-face` 相对路径，RiceUI/uni-ui x 同款，五端零条件编译），`em-icon` 原子组件收口；复杂图形用 view+transform 绘制。**禁打包 svg/png 图标**。占位字体为 uni-icons `uniicons.ttf`（Apache-2.0），正式版换设计师 iconfont.cn 导出，只改 ttf + 映射表 |

## 5. 一期功能范围（PLAN.md 第 1–2 节）

**In scope**：页面级组件 `em-conversation-page`（会话列表）、`em-chat-page`（聊天页）、demo 内置登录页；5 种消息气泡 + 自定义消息出口（插槽）；长按菜单仅「复制 / 引用 / 撤回 / 删除」四项（action-sheet 形态）；引用、撤回（2 分钟窗口）、失败重发、单聊已读（`enableReadReceipt` 开关）、输入栏（语音/emoji 字符面板/相册/拍摄/文件）；typing 与草稿默认开、不配开关。

**明确不做（一期）**：tiptap 富文本、消息编辑/翻译/合并转发/多选/消息搜索/语音转文字/位置消息/群已读详情/会话分栏/H5 适配层/浏览器通知/Electron 持久化/双 SDK adapter/名片转发/群管理全套/Presence（保留接口默认关闭）/表情包商店/自研图片预览手势层。完整裁剪对照见 PLAN.md 附录 A——**写代码前先核对，不要实现清单外的功能**。

## 6. 规划的仓库结构（PLAN.md 第 4 节）

```
easemob-uikit-uniapp/
├── PLAN.md
├── README.md                      # 插件市场门面
├── uni_modules/
│   └── easemob-uikit-uni/
│       ├── components/            # 页面级在 pages/ 子目录，其余为原子级 + em-*-message 气泡族
│       │   ├── pages/             # 页面级组件（宿主 pages.json 配 easycom custom 规则自动导入）
│       │   └── em-*/              # 原子级（内置 easycom 零配置），每目录 = 组件 .vue + 同名 .css
│       ├── libs/
│       │   ├── platform.ts        # 存储/网络/媒体适配层
│       │   ├── use/               # useNamespace/usePopup/useSafeArea...
│       │   ├── store/             # reactive 裸 store（会话/消息/主题/i18n）
│       │   ├── style/             # variables.css（--em-* token 明暗两套）+ mixins
│       │   └── types/
│       ├── pages_init.json        # 页面模板自动注册
│       ├── package.json           # uni_modules 清单（platforms 兼容矩阵全勾）
│       ├── changelog.md / readme.md / license.md（MIT）
├── demo/                          # uni-app x 演示工程（manifest.json: vapor: true），相对路径引用 ../uni_modules
├── tests/                         # uni-automator 全端测试
├── scripts/                       # 发布/校验脚本
└── docs/                          # 文档（一期 readme 先行）
```

npm 包为一期可选项：组件本体以 uni_modules 为主，npm 只发纯 js 逻辑层（如需要）。

## 7. 构建与测试

**当前可用的构建命令**：`scripts/uni.sh <dev|build> <web|mp-weixin>`（封装 HBuilderX 5.26 内置 `uniapp-cli-vite` 编译器；需先 `cd demo && npm install` 安装 easemob-websdk）。App 端（Android/iOS/鸿蒙）编译仍依赖 HBuilderX/HBuilder V 图形界面流程。测试框架尚未搭建。规划中的工具链：

- 开发 IDE：**HBuilder V 5.21+**（版本已锁进 README；本机 HBuilderX 5.26 验证可用）
- CI 出包：`@dcloudio/uni-cli`（规划）/ 本机暂用 `scripts/uni.sh`
- 测试：uni 官方自动化测试框架（uni-automator，一套 test.js 驱动全端）+ jest 快照（参照 uni-ui x 的 `jest.config.js`）；**每个 issue 修复配测试例**
- 发布动作 = git tag + 插件市场更新（HBuilder V 右键发布）+ changelog 同步

## 8. 验证门禁（PLAN.md 第 6 节，每次提交前）

1. demo 工程五端编译通过（Android / iOS / 鸿蒙 / H5 / 微信小程序）
2. `uni-automator` 核心用例全绿
3. 新增组件自查清单：纯 ts？ucss 子集？无 scoped？文字在 text 上？easycom 路径规范？条件编译显式？
4. 包体积基线：微信小程序主包（demo）≤ 1.5MB（UIKit+SDK 进分包），每次发版记录数字

## 9. 实施路线（PLAN.md 第 5 节）

- **M0（先行，唯一未知风险）**：SDK 五端连通性 spike——websdk 在 Android（蒸汽 release 包）/iOS/鸿蒙登录 + WebSocket 长连接 + 收发文本 + 断线重连；微信小程序 SDK 线；H5；存储差异清单（`localStorage` 不可用点换 `uni.setStorage`）。产出 `docs/SPIKE-SDK-CONNECTIVITY.md`。**M0 不过则暂停 UI 开发，回头评估 SDK 方案（必要时封装 uts 插件）。**
- **M1**：demo 最小闭环（登录页 + 会话列表 + 聊天骨架，文本/图片气泡先通）——先于一切抽象。
- **M2**：聊天页完整化（语音/视频/文件气泡、长按四菜单、引用/撤回/重发/已读、输入栏、主题、i18n）。
- **M2.5**：联系人页面（通讯录核心链路自 M4 提前）——`em-contact-page`（字母分组 + 索引条 + 搜索 + 新请求入口 + 删除好友）+ `em-contact-requests-page`（好友申请接受/拒绝）+ ContactManager 数据层；黑名单/群组/详情页/穿梭框仍留二期。
- **M3**：组件沉淀与发布（解耦出页面级+原子组件、pages_init.json、token 体系定稿、README/changelog/license、uni-automator 核心链路用例、插件市场首发 0.1.0 + GitHub 开源）。
- **M4**（二期，另行立项）：群基础、单条转发、联系人详情页/黑名单、文档站。

## 10. 参考资产与样本（PLAN.md 附录 B）

- **视觉/交互设计权威依据（本机只读源码，做 UI 前必读对应模块）**：`/Users/neohuang/Desktop/WorkCommonUse/UIKIT/easemob-uikit-vue`——具体模块路径与「vue web CSS → ucss」翻译纪律见 skill `.agents/skills/vue-uikit-design-reference/SKILL.md`；只读引用，禁止修改该仓库
- 设计 token 平移来源：`easemob-uikit-vue/docs/DESIGN-TOKEN-MAPPING.md`（本仓库外）
- 组件 API 契约参照：`easemob-uikit-vue/packages/uikit-im/src`（props/emits 命名、i18n key、Avatar 徽标规范；实现不可复用，全部重写）
- 开源参照：uni-ui x（gitcode.com/dcloud/uni-ui-x，**alpha 分支**）、RiceUI（gitee.com/riceui/rice-ui，**release_vapor 分支**）、hello-uni-app-x（官方示例 + 自动化测试例）、unibestX（工程模板）
- 反面教材：FirstUI-uvue（选项式 + uts 强类型的历史包袱，避免回退）
- DCloud 官方文档为规范与约束的唯一权威来源（ucss 子集规范、蒸汽模式专题、uni_modules 包管理规范等链接见 PLAN.md 附录 B.1）

## 11. 安全注意事项

- 环信登录使用 appkey + userId + token；demo 的「测试 token 获取」入口**仅限开发用**，不得带入正式分发。
- 仓库 MIT 开源，提交前注意不要把任何真实 appkey、token、账号凭据写进代码或文档。
- websdk 为 peer 依赖；引入任何新的运行时依赖前须对照「零运行时依赖」纪律（PLAN.md 1.4 节），确有必要先改 PLAN.md。
