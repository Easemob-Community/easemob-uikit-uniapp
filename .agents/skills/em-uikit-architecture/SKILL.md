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
    ├── use/             # useNamespace / usePopup / useSafeArea / useKeyboardHeight / useChatComposer / useTheme / useLocale
    ├── locale/          # zh-CN / en 文案 + mergeMessages 支撑
    ├── style/           # variables.css（--em-* 明暗两套）/ bubble.css / textStyles.ts
    ├── constants/       # 全部枚举与魔法数（MESSAGE_TYPE/RECALL_TIME_LIMIT/PANEL_MIN_HEIGHT...）
    ├── types/           # 对外类型（联合类型从 constants 派生）
    └── utils/           # logger / quote / time / pinyin
```

## EmKit 门面（libs/index.ts → client + chat）

- 所有 SDK 依赖的异步方法内部前置 `await whenReady()`（就绪门：MP 分包异步加载 SDK → ChatClient.init → login，各阶段 Promise 缓存、失败清缓存可重试）。宿主加载态用 `EmKit.whenReady()`，原生 `ChatClient` 逃生舱用 `EmKit.getSDKClient()`；两者均返回 `Promise<ChatClient>`，初始化完成不代表登录或在线。
- `EmKit.init(config)` 挂 bind 续体，时序先于业务调用。配置项见「配置体系」。
- `onMessage` 返回取消函数（**页面 onUnmounted 必须反注册**，泄漏 P0 修复见坑集 #4）。

## 账号代次与同步状态（libs/chat/account.ts）

- 公共门面在 `whenReady()` 前捕获 `getAccountEpoch()`，domain 在 readiness 后及每次 store 写/pending 复用前校验；`EmKit.logout()` 先失效代次并 `unbind()` 注销旧 handler 再断开 SDK，reset 同时清空在途 map，下一次 `login()` 重新 bind。同步回调另带 bind-time epoch，已出队旧回调也不能写新账号；新账号回调正常生效。会话快照另有 requestId，同账号只允许最新响应落盘。
- 会话/联系人/群 store 用 `loaded / syncing / syncFailed` 区分未加载、加载中、失败与权威空列表；`onSyncDataStart/Finished` 与主动刷新都写同一状态，失败保留缓存。
- 会话重试只走真实 `refreshSessionList`，联系人走 SDK `refreshContactSnapshot`；群无全量手动重启 API，`getJoinedGroups` 在后台失败后 reject，不能把内存重读当权威成功。
- chat-info 的删除会话/删除好友/退群/解散共享 exitPending/exitCompleted；chat-page 按发起 conversationId/chatType + pageGeneration 保护发送/选择完成与 finally，只有原输入未编辑时才清草稿/引用/@，未发送临时附件按 release 清理。

## 消息生命周期（libs/chat/message.ts）

- **`toMessageItem` 统一收口**：发送/接收/历史三路径都经它转 `EmMessageItem`（含 quote 解析还原、ext/rawType 填充、`custom` wire → `MESSAGE_TYPE.CUSTOM` + `customEvent`/`customParams`、4.x `img`/`audio` wire 兼容映射——SDK wire 字面量只许出现在这个边界）。
- cmd 信号消息（typing，`CMD_ACTION = 'TypingBegin'`）在 onMessage/loadHistory 边界拦截，**不落消息列表**。
- 撤回走 onMessageRecalled 落 recalled 态；失败消息原位保留，`EmKit.resendMessage` 重建投递；domain 按 conversationId+localId 在 readiness 前共享在途 Promise，所有调用方得到同一结果，finally 只清自身 map 项，reset 失效旧写。已读回执 `sendMessageReadReceipts`（≤50 条 serverId 批量）+ `onMessageReadReceipts` 落 `peerReadTimeByConversationId`。
- 删除：`EmKit.deleteMessage(message)` 在消息域按 `message.id` 决定是否先 `removeHistoryMessages` 再本地移除（空 id 不等待 SDK），漫游失败不碰列表；chat 门面组合会话域 `syncMessageSummary` 校正摘要/时间，剩余最新为 recalled 时用 `message.recalledPreview`。`deleteLocalMessage` 保留显式本地删除语义；消息域返回是否实际命中，只有真实删除才校正摘要，未加载列表或陈旧 localId 的 no-op 不改摘要，已加载空列表才清零。
- 引用：`EmMessageItem.quote`（EmQuoteInfo 快照）发送时双写 ext `msgQuote` 与兼容字段 `emQuote`，接收优先 `msgQuote`；输入栏引用条 + 气泡引用卡的展示映射纯函数收口 `libs/utils/quote.ts`。
- **流式消息（M2.13）**：`onStreamMessage` 分片按 `msgServerId` 幂等合并进同条 TEXT 气泡（`EmMessageItem.stream`，`STREAM_MESSAGE_STATUS` 常量，`libs/utils/stream.ts` 判定纯文本/富格式）；`streamItemByKey` O(1) 索引 + `uiConfig.streamThrottle`（默认 50ms）合批写 store，终态立即落盘；`onMessage` 走 `ingestIncoming` 做丢片补偿。高频增量只走 `EmKit.onStreamMessage`，不塞 `onMessage`；聊天页 `em-text-message` 渲染光标/异常，markdown 走 `#stream-message` 插槽。

## 会话域（libs/chat/conversation.ts）

- 会话列表同步协议**不携带免打扰字段**：`ConversationItem.remindType` 在快照中恒为 `DEFAULT`（群 joined-group 同步可能带入）。`toConversationItem` 对已有会话必须**保留本地 `isMuted`**，不能按快照重置；冷启动/跨端校正走 `syncConversationMuteStates()`（`PushManager.getConversationSilentModes`，单次 ≤20，`DURATION` 按 `expireTimestamp` 判定）。批量查询与会话 refresh 同时按 requestId 和 settlementRevision 判定新鲜度：读取后发生新意图或本地成功/失败结算，旧响应均不得覆盖；结算前到达的新鲜权威值仍更新回滚基线但不改在途乐观 UI，结算后新发起的读取正常生效。
- 本端 `pinConversation` / `setConversationMuted` 按「会话 + 设置项」独立串行，调用时乐观回写最新意图；旧成功/失败不回写 UI。成功以本地意图为最终确认值，失败回滚到失败时的最新已确认值（可能是在途收到的权威远端状态），每次成功/失败结算均递增 settlementRevision；pin 在途时会话快照保留本地 pin/pinnedTime，其他端 mute 改动由 ChatClient 级 `onMultiDeviceConversation` 的 `CONVERSATION_MUTE_INFO_CHANGED` 回写。
- 设置队列带会话代次与账号代次：`removeConversationLocal` 提升会话代次并失效 pin/mute 队列，`reset()` 提升账号代次；删除/重建同 ID 或换账号后，旧成功/失败闭包均不得回写新状态。`removeConversationLocal` 同时调用 `clearDraft(conversationId)`，不得恢复旧持久化草稿。
- **列表顺序必须显式排序**，不直接用 SDK 快照顺序：置顶优先、置顶区间按 `pinnedTime` 倒序（无置顶时间回落 `lastMessageTime`），非置顶按 `lastMessageTime` 倒序（对齐 vue `sortedConversationList`）。SDK 快照会因 `lastAccess`/资料刷新/未读清零等非消息因素重排置顶区间，表现为「进会话再回来置顶顺序变了」。

## 联系人数据层（libs/chat/contact.ts）

- bind 模式 + `readyContactManager` cast 套路；`getContacts()` 内存快照整量回写，roster 六事件驱动刷新；主动重试先 await SDK `refreshContactSnapshot`，失败不以内存快照伪装成功。
- **`enableSyncData` 必须显式含 `'contact'`**：SDK 默认仅 `['conversation']`，不传则好友同步不启动、快照永远空（H5 靠 localStorage 缓存假象、小程序必空）。已配于 `libs/client/index.ts`（不含 group：GroupManager 未注册会抛错）。
- ChatClient 级 `onSyncDataStart/Finished` 驱动 loaded/syncing/syncFailed；success 才回填权威状态，failed 保留缓存并显示重试。
- 好友申请 invite 内存 + `uni.setStorage` 持久化（key `emkit.contact.invites`）；`onContactAdded` 或好友快照加载会把已是好友的历史 received contact pending 全部置 accepted，申请页 isActionable/processInvite 与未读角标使用同一好友关系守卫。
- 拼音分组：`libs/utils/pinyin.ts` 的 `setPinyinAdapter` 可选注入，未注入时非 A-Z 落 `#` 组、搜索仅原文匹配（与 vue 版默认降级一致）。

## 群详情与成员读取归属

- `getGroupInfo(groupId, force=false)` 普通调用复用在途 Promise；`force=true` 必须发起新读取。详情/成员/admin 按 groupId requestId 仅允许最新响应写 store，且每次 pending 复用与回写都校验账号代次；reset 清空 info/member/admin/announcement pending 与 requestId，旧 finally 不得清理新 pending；移除后的权威重读使用 force。
- `getGroupMemberList` 返回 `EmGroupMemberListResult`（既有 `items/cursor/hasMore` + `applied`）。当前成功且实际写入 store 时 resolve `applied=true`；陈旧成功 resolve `applied=false`；陈旧失败 reject 同类型结构化结果（`applied=false`），当前真实失败保留原始 error/rejection。调用方在 resolve 和 catch 中都不得消费 `applied=false` 的分页载荷，不得把空载荷当作成功空页。
- domain 的 groupId requestId、强制详情读取、admin resync 与普通 dedupe 不变。成员视图保留本地代次协调首屏/分页/移除刷新，同时只按 `applied` 处理外部 enterGroup/邀请/父页刷新造成的陈旧结果；陈旧首屏结果后仍无缓存时必须显示可重试态。

## store 层约定

- 裸 reactive、字段命名 `By<Key>` / `items`（纪律见 `em-coding-discipline`）。
- `store/user.ts`：`infoByUserId` 缓存 + `loadingByUserId`/`failedByUserId` 防重拉；`mergeUserInfo` 合并写必须落 reactive 代理；展示回落链 `displayNameOf`：nickname > conversation.name > userId（联系人页叠加 remark 于最前）。
- `store/config.ts`：reactive `uiConfig`（默认值来自 constants），导出 `useConfig`/`setConfig`/`applyKitConfig`/`primaryColorStyle`。

## 配置体系（三层混合）

**全局 `EmKitConfig` 行为开关** + **页面组件呈现 props** + **少量具名插槽**（不做 provider/inject、不做 ChatConfig 单对象透传）。行为配置：enableDraft/enableTyping/recallTimeLimit/typingThrottle/typingTimeout/timeDividerInterval/enableStreamMessage/streamThrottle/inputFeatures{voice,emoji,image,camera,video,file,sendOnReturn}/messageMenuKeys/conversationMenuKeys/contactMenuKeys/emojiList/primaryColor/avatarShape（showTime 已移除）。组件透出契约见 `em-component-structure`。自定义消息：`EmKit.sendCustom(to, chatType, event, params?, ext?)` 发送；`#custom-message` 插槽按 `message.customEvent` 整卡自绘（`customParams`/`ext` 为载荷，`rawType='custom'` 兼容旧判别）。UIKit 不内置卡片组件/schema。

未读：总未读 `totalConversationUnread` + `useUnreadCounts()`；单会话 `conversationUnreadCountOf(id)`（快照）+ `useConversationUnreadCount(id)`（响应式）。多场景扩展（M2.11/M2.12/M2.14/M2.15）：`#banner`/`#input-toolbar`/`title`/`showAction`/`insertLocalNotice`/`quickReplies`/`extraMessageMenus`/`#custom-message` 卡片插槽，用法见 `docs/GUIDE-MULTI-SCENARIO.md`。

## 横切机制

- **弹层**：`usePopup` —— z-index 运行时递增分配器（基准 2000）+ `holdTabBar`/`releaseTabBar` 计数器（小程序/App 原生 tabBar 盖不住，弹层开时 `uni.hideTabBar`、全关恢复；H5 条件编译跳过）。基座 `em-popup`（自研 overlay + view，不用 page-container）→ `em-action-sheet`。
- **安全区**：`useSafeArea`（`getSafeAreaBottom/Top` 读取快照）。输入栏无面板时根节点承担底部安全区；键盘弹起时键盘区已覆盖安全区不再叠加（见坑集 #3）。
- **软键盘**：`useKeyboardHeight` 统一高度源（App/小程序；H5 运行时无 `onKeyboardHeightChange`，条件编译跳过注册，否则聊天页 setup 白屏），消费点 = chat-page 弹起滚底 + `useChatComposer` 手动避让 + 面板高度对齐 `max(kb, PANEL_MIN_HEIGHT=280)`。
- **输入栏行为核心**：`useChatComposer`（M2.16 自 em-chat-inputbar 抽取）——键盘避让 rootStyle/panelStyle、面板三态互斥、录音手势状态机、禁用守卫的单一实现；消费点 = em-chat-inputbar + chat-page 的 `#input-bar` 整栏自绘插槽（页面实例化后经 scope 透出，scope 类型 `EmChatInputBarScope` 在 libs/types；插槽有无静态确定，同实例不可切换）。
- **通用局部注入与图片扩展（M2.31）**：默认输入栏 `#emoji-panel`、chat-page `#image-message` 提供缺省回落的宿主自绘点；`sendImage(..., ext?)` 支持远程 `originalUrl` 与 GIF 识别，`EmMessageItem.originalUrl/isGif` 经 toMessageItem、applyMediaBody 与图片重发保留。UIKit 不识别 `ext.isSticker`，宿主 Demo 自管该业务协议与展示。
- **日志**：`libs/utils/logger.ts` —— `createLogger(ns)` 统一 `[emkit:<ns>]` 前缀（debug 走 console.log 求全端稳定）；2000 行内存环形缓冲与 console 级别解耦；`EmKit.exportLogs()` 分端导出（H5 Blob 下载 / 小程序·App 写 USER_DATA_PATH 兜底剪贴板），配套 `getLogText/clearLogs`。
- **主题 chrome**：`useThemeChrome({ tabBarPages, colors? })` 封装 `initTheme`、页面 `onShow` 与 `themeStore.mode` watch；App/mp 走 `syncNativeThemeUI`，H5 同步 `.uni-page-head/.uni-tabbar`，demo 通过 `demo/common/theme.ts` 消费。
- **i18n**：`useLocale` 的 messages 为 reactive store，`mergeMessages(locale, table)` 从门面透出（zh-CN/en 内置，支持扩展 locale）；持久化偏好只在对应文案表存在时恢复，缺失 key 回退 zh-CN。

## platform.ts 平台差异现状

chooseVideo 全端；内置 chooseFile 仅小程序+H5，App 由 `libs/attachment.ts` 的宿主 provider 注入选择能力；图片/视频/内置文件选择统一识别用户取消（图片 `[]`、视频/文件 `null`），其他选择/读取/元数据处理失败 reject 并由聊天页 toast，H5 文件 input 通过 `oncancel` 静默结束；录音仅小程序+App（H5 抛错降级，输入栏已捕获 toast）；播放 `createInnerAudioContext` 全局互斥；视频由 chat-page 打开内置 em-video-preview，App 先下载本地再播，H5/小程序直接播远程 URL；文件点击不下载；`exportTextFile`/`copyText` 支撑日志导出。`copyText` 返回 Promise、空文本/原生失败 reject，并传 `showToast:false` 关闭原生提示，消息复制与日志导出调用方均需 await/catch。

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
