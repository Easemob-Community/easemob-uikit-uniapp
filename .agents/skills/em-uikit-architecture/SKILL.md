---
name: em-uikit-architecture
description: Use when touching easemob-uikit-uni library internals（libs/ 任何子系统、EmKit 门面、store、平台层、日志、弹层、配置体系、消息生命周期、联系人数据层），或需要知道「某个能力在哪实现、该改哪」。环信 uni UIKit 库结构与各子系统导览。
---

# em-uikit-architecture — 库结构与子系统导览

> 组件目录/样式规范另见 skill `em-component-structure`；视觉对齐另见 `vue-uikit-design-reference`；本文只管 `libs/` 与横切机制。进度日志见 `docs/STATUS.md`。

## 顶层布局

```
uni_modules/easemob-uikit-uni/
├── components/          # 页面级 pages/ + 原子级（结构纪律见 em-component-structure）
└── libs/
    ├── index.ts         # EmKit 门面（对外唯一入口）
    ├── client/          # SDK 客户端：init/login/连接态 + 就绪门 + sdk.ts（websdk 导入唯一收口）
    ├── chat/            # 业务域：index（门面）/ message / conversation / contact / user-info
    ├── store/           # reactive 裸 store：connection/conversation/message/draft/user/contact/config/theme/locale
    ├── platform.ts      # 存储/网络/媒体选择/录音/播放/文件导出 平台适配层
    ├── use/             # useNamespace / usePopup / useSafeArea / useKeyboardHeight / useTheme / useLocale
    ├── locale/          # zh-CN / en 文案 + mergeMessages 支撑
    ├── style/           # variables.css（--em-* 明暗两套）/ bubble.css / textStyles.ts
    ├── constants/       # 全部枚举与魔法数（MESSAGE_TYPE/RECALL_TIME_LIMIT/PANEL_MIN_HEIGHT...）
    ├── types/           # 对外类型（联合类型从 constants 派生）
    └── utils/           # logger / quote / time / pinyin
```

## EmKit 门面（libs/index.ts → client + chat）

- 所有 SDK 依赖的异步方法内部前置 `await whenReady()`（就绪门：MP 分包异步加载 SDK → ChatClient.init → login，各阶段 Promise 缓存、失败清缓存可重试）。宿主加载态用 `EmKit.whenReady()`。
- `EmKit.init(config)` 挂 bind 续体，时序先于业务调用。配置项见「配置体系」。
- `onMessage` 返回取消函数（**页面 onUnmounted 必须反注册**，泄漏 P0 修复见坑集 #4）。

## 消息生命周期（libs/chat/message.ts）

- **`toMessageItem` 统一收口**：发送/接收/历史三路径都经它转 `EmMessageItem`（含 quote 解析还原、ext/rawType 填充、4.x `img`/`audio` wire 兼容映射——SDK wire 字面量只许出现在这个边界）。
- cmd 信号消息（typing，`CMD_ACTION = 'TypingBegin'`）在 onMessage/loadHistory 边界拦截，**不落消息列表**。
- 撤回走 onMessageRecalled 落 recalled 态；失败消息原位保留，`EmKit.resendMessage` 重建投递；已读回执 `sendMessageReadReceipts`（≤50 条 serverId 批量）+ `onMessageReadReceipts` 落 `peerReadTimeByConversationId`。
- 引用：`EmMessageItem.quote`（EmQuoteInfo 快照）随消息 ext `emQuote` 发送；输入栏引用条 + 气泡引用卡的展示映射纯函数收口 `libs/utils/quote.ts`。

## 联系人数据层（libs/chat/contact.ts）

- bind 模式 + `readyContactManager` cast 套路；`getContacts()` 内存快照整量回写，roster 六事件驱动刷新。
- **`enableSyncData` 必须显式含 `'contact'`**：SDK 默认仅 `['conversation']`，不传则好友同步不启动、快照永远空（H5 靠 localStorage 缓存假象、小程序必空）。已配于 `libs/client/index.ts`（不含 group：GroupManager 未注册会抛错）。
- ChatClient 级 `onSyncDataFinished`（dataType=contact 且 success 才回填）做同步后自愈。
- 好友申请 invite 内存 + `uni.setStorage` 持久化（key `emkit.contact.invites`）。
- 拼音分组：`libs/utils/pinyin.ts` 的 `setPinyinAdapter` 可选注入，未注入时非 A-Z 落 `#` 组、搜索仅原文匹配（与 vue 版默认降级一致）。

## store 层约定

- 裸 reactive、字段命名 `By<Key>` / `items`（纪律见 `em-coding-discipline`）。
- `store/user.ts`：`infoByUserId` 缓存 + `loadingByUserId`/`failedByUserId` 防重拉；`mergeUserInfo` 合并写必须落 reactive 代理；展示回落链 `displayNameOf`：nickname > conversation.name > userId（联系人页叠加 remark 于最前）。
- `store/config.ts`：reactive `uiConfig`（默认值来自 constants），导出 `useConfig`/`setConfig`/`applyKitConfig`/`primaryColorStyle`。

## 配置体系（三层混合）

**全局 `EmKitConfig` 行为开关** + **页面组件呈现 props** + **少量具名插槽**（不做 provider/inject、不做 ChatConfig 单对象透传）。13 项全局开关：enableDraft/enableTyping/showTime/recallTimeLimit/typingThrottle/typingTimeout/timeDividerInterval/inputFeatures{voice,emoji,image,camera,video,file}/messageMenuKeys/conversationMenuKeys/emojiList/primaryColor。组件透出契约见 `em-component-structure`。自定义消息出口：`#custom-message` 插槽按 `EmMessageItem.rawType` 判别渲染，`ext` 为业务载荷唯一通道。

## 横切机制

- **弹层**：`usePopup` —— z-index 运行时递增分配器（基准 2000）+ `holdTabBar`/`releaseTabBar` 计数器（小程序/App 原生 tabBar 盖不住，弹层开时 `uni.hideTabBar`、全关恢复；H5 条件编译跳过）。基座 `em-popup`（自研 overlay + view，不用 page-container）→ `em-action-sheet`。
- **安全区**：`useSafeArea`（`getSafeAreaBottom/Top` 读取快照）。输入栏无面板时根节点承担底部安全区；键盘弹起时键盘区已覆盖安全区不再叠加（见坑集 #3）。
- **软键盘**：`useKeyboardHeight` 统一高度源（扣安全区/可写/按 id 反注册），消费点 = chat-page 弹起滚底 + inputbar 手动避让 + 面板高度对齐 `max(kb, PANEL_MIN_HEIGHT=280)`。
- **日志**：`libs/utils/logger.ts` —— `createLogger(ns)` 统一 `[emkit:<ns>]` 前缀（debug 走 console.log 求全端稳定）；2000 行内存环形缓冲与 console 级别解耦；`EmKit.exportLogs()` 分端导出（H5 Blob 下载 / 小程序·App 写 USER_DATA_PATH 兜底剪贴板），配套 `getLogText/clearLogs`。
- **i18n**：`useLocale` 的 messages 为 reactive store，`mergeMessages(locale, table)` 从门面透出（zh-CN/en 内置）。

## platform.ts 平台差异现状

chooseVideo 全端；chooseFile 仅小程序+H5（App 空实现待补）；录音仅小程序+App（H5 抛错降级，输入栏已捕获 toast）；播放 `createInnerAudioContext` 全局互斥；视频点击预览仅 H5 window.open、其它端 toast；文件点击 toast 暂不下载；`exportTextFile`/`copyText` 支撑日志导出。

## 改某能力前的入口速查

| 要改 | 先读 |
|---|---|
| 登录/连接/就绪门/SDK 加载 | `libs/client/index.ts`、`libs/client/sdk.ts` |
| 收发/撤回/重发/已读/typing | `libs/chat/message.ts` |
| 会话列表数据/置顶/免打扰/清记录 | `libs/chat/conversation.ts`、`libs/store/conversation.ts` |
| 好友/申请/字母分组 | `libs/chat/contact.ts`、`libs/store/contact.ts`、`libs/utils/pinyin.ts` |
| 昵称头像展示 | `libs/store/user.ts`、`libs/chat/user-info.ts` |
| 主题/文案/配置默认值 | `libs/store/theme.ts`、`libs/locale/`、`libs/store/config.ts` + `libs/constants/` |
| 新增 store | 先看命名约定（em-coding-discipline）与现有 store 的 reactive 回写范式 |
