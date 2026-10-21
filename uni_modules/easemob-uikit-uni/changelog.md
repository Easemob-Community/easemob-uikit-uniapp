# changelog

## 1.0.0-rc.1（2026-10-21）

首个 1.0 候选版本。功能范围冻结为「单聊 + 群聊 + 联系人 + 多场景扩展 + AI 流式消息」，五端为 uni-app x（Android / iOS / 鸿蒙）、H5、微信小程序。

### 新增与修复

- **鸿蒙软键盘遮挡输入栏**：修复鸿蒙上输入栏顶起后底部仍被键盘压住一截（实测少顶 28vp / 84px）。`useKeyboardHeight` 拆分「面板口径」（`keyboardHeight`）与「上推口径」（`keyboardLift`），输入栏 `margin-bottom` 改用后者、面板高度仍用前者，新增 `resetKeyboardHeight()` 统一清零；iOS 口径未动（待真机验证）。
- **平台能力显隐**：新增 `PLATFORM_CAPABILITIES`（`videoPreview` / `filePick` / `fileOpen`）。视频播放仅 H5 可用，小程序/App 隐藏播放按钮；文件发送在 App 隐藏入口；文件打开/下载全端暂未接入，文件气泡改为纯展示，不再弹「暂不支持」。
- **未读清零**：进会话、当前会话收消息、离开聊天页三处清理服务端未读（按会话 2s 合批）；修复「读完回列表/冷启动后未读复活」。新增 `EmKit.clearConversationUnread(conversationId, chatType)` 供宿主自建入口兜底。
- **Token / 连接生命周期**：`EmKitConfig` 新增 `onTokenWillExpire`（返回新 token 自动续期）与 `onTokenExpired`；新增 `EmKit.renewToken(token)`；`EmKit.state` 新增 `reason` / `errorCode` / `reconnecting` / `reconnectAttempt`，`CONNECTION_STATUS` 新增 `reconnecting`。
- **连接状态条**：`em-conversation-page` / `em-chat-page` 顶部内置 `em-connection-banner`，按 `status/reason` 显示连接中、重连中、网络异常、设备超限、Token 过期；新增 `showConnectionBanner` prop 可关闭。
- **录音兜底**：录音改为单例监听，新增 `onError` 回调（麦克风权限失败 toast）；达到 60s 上限自动停止后按正常语音发送，不再静默丢弃。`startRecord()` 新增可选 `EmRecordOptions`。
- **日志隐私**：新增 `EmKitConfig.logPayload`（默认 false），好友/群同步原始 payload 仅在 `logLevel='debug'` 且显式开启时序列化入日志；生产默认不再包含 userId/昵称等原始数据。
- **语言持久化**：新增 `initLocale` / `setLocale` / `getLocale` 与 `EmKit.setLocale`，偏好存 `emkit.locale`；未设置时跟随系统语言（英文环境用 en）。`EmKitConfig.locale` 支持初始化时指定。
- **列表自同步**：`em-conversation-page` 新增 `autoSync`（默认 true）首次挂载拉会话快照，宿主漏调 `syncConversations` 不再空列表。
- **引用协议跨 UIKit 互通**：发送同时写入 `ext.msgQuote`（与 vue 版同 key、同结构）与 `ext.emQuote`（0.x uni 兼容）；接收优先解析 `msgQuote`，旧消息回落 `emQuote`。`EmQuoteInfo` 新增可选 `thumbUrl`。
- **聊天页交互**：输入栏 emoji/媒体面板或软键盘展开时，点消息区即收起（`em-chat-inputbar` 新增 `collapseSignal` 信号 props，聊天页点击消息区递增；开面板前自动收键盘，面板与键盘不再叠加占位）。
- **首屏骨架与历史重试**：聊天页首次历史请求结束前显示气泡骨架，不再先闪「暂无消息」；500ms 兜底只解透明度；历史加载失败 toast + 「点击重试」（已有缓存消息时顶部重试行，不遮消息）。
- **消息内存上限**：非当前会话只保留最近 100 条（`CONVERSATION_MESSAGE_RETAIN_LIMIT`），离开当前会话时同样裁剪；被裁剪会话下次进入重拉最新页，避免游标指向已丢弃消息。当前会话单次会话内不设限。
- **配置清理**：移除只存不用的 `EmKitConfig.showTime`（1.0 前无正式用户）；逐条时间仍由聊天页时间分隔条承担。
- **返回事件契约**：`em-chat-page` 新增 `back` emit 与 `autoBack` prop（默认 `true`，保持原行为；`false` 时只发事件，由宿主接管退场）。
- **发布物料**：插件版本 `1.0.0-rc.1`；平台矩阵按 HBuilderX 4.71+ 新规范更新；补充暗黑模式/多语言/宽屏声明、相机/相册/麦克风权限与数据声明；根目录补 MIT `LICENSE`；demo 清除签名路径与密码。

### 升级说明（0.x → 1.0）

- 0.x 未正式发布，按 1.0 文档直接接入即可。
- 若从仓库旧提交升级：引用消息会双写 `msgQuote` + `emQuote`，新旧客户端可互读；业务 ext 不要占用这两个 key。
- `em-chat-page` 默认返回行为不变；如需拦截返回（未保存表单等），传 `:auto-back="false"` 并监听 `@back`。
- `demo/manifest.json` 不再包含鸿蒙签名配置，本地真机运行需在 HBuilderX 中重新配置（见 `docs/HARMONY-REALDEVICE-RUN.md`），签名材料禁止提交。

### 已知限制（1.0）

- 视频播放仅 H5；App/小程序隐藏播放入口，仅展示封面与时长。
- 文件打开/下载全端未接入，文件气泡为纯展示。
- App 端暂不支持发送文件（无通用文件选择器），入口已隐藏。
- 语音发送仅 App/小程序；H5 入口隐藏。
- H5 为移动端布局，未做桌面宽屏适配。

## 0.0.1（未发布）

- 仓库立项，见 PLAN.md
- M0 spike：EmKit 门面（init/login/logout/sendText/连接状态）+ demo 最小连通性用例页
- 新增 `em-icon` 原子组件：iconfont 字体图标方案（本地 ttf 组件同级目录 + `@font-face`），占位字体为 uni-icons `uniicons.ttf`（DCloud，Apache-2.0，161 图标），正式版替换为设计师 iconfont.cn 导出（只改 ttf + `em-icons.ts` 映射）；会话页/聊天页临时 "+" 字符已切换为 `em-icon`
- M2.9 群基础：群数据层（GroupManager 注册 + 群事件「更新 store + 系统通知」双写）与 chatType 全链路贯通（**breaking**：消息/会话域方法增必传 `chatType`，`em-chat-page`/`em-chat-info-page` 增必传 `chatType` prop）；群会话列表（@我 徽标全链路）；聊天页群形态（群名+人数副标题/成员昵称行/公告条）；@ 提及全链路（`em-mention-picker` 半屏选人 + ext `em_at_list`，与 vue 同 key，追加式插入为平台上限）；群列表页 `em-group-page` + 建群弹层；统一选人组件 `em-select-contact`（single/multiple，发起会话/建群/邀请三处复用）；发起会话（选人 → 本地 addConversation）；联系人页重构为入口页（**breaking**，好友列表平移 `em-contact-list-page`，新增 `em-contact-nav`）；群详情管理（成员宫格/公告编辑/改名/管理员/转让/退群解散/全员禁言禁输入/成员管理视图 `em-group-members-view`/邀请入群库内闭环）；群系统通知（`MESSAGE_TYPE.NOTICE` 本地灰条：建群/成员进出/改名/公告/转让）；新原子组件 `em-load-more`（触底三态）
- M2.11 多场景扩展能力 P0：`sendText` 增业务 `ext` 参数（与引用/@提及内部 key 合并，内部 key 优先）；新增 `EmKit.sendCustom(event, params?, ext?)` 与 `MESSAGE_TYPE.CUSTOM` 一等类型（`EmMessageItem.customEvent/customParams`，失败可重发）；`em-chat-page` 新增 `#banner` 固定位插槽与 `title`/`showAction` props；新增通用系统提示消息 API `EmKit.insertLocalNotice(conversationId, chatType, text)`（`insertGroupNotice` 保留为群聊别名）；配套接入指引 `docs/GUIDE-MULTI-SCENARIO.md`
- M2.12 多场景扩展能力 P1：新增单会话未读 API（`useConversationUnreadCount` / `conversationUnreadCountOf` / `EmKit.conversationUnreadCountOf`）；新原子组件 `em-quick-reply-bar` 与 `em-chat-page.quickReplies`/`quickReplyMode`（fill 填草稿 / send 直发）；`em-chat-page` 增 `extraMessageMenus` + `message-menu(key, message)` 支持业务长按动作（`types` 过滤、内置 key 保留）
- M2.13 AI 流式消息：`onStreamMessage` 分片按 `msgServerId` 幂等合并到同条 TEXT 气泡（`EmMessageItem.stream`，`onMessage` 完整消息丢片补偿）；分片索引 + `streamThrottle` 合批（默认 50ms）+ 终态立即落盘；`EmKitConfig.enableStreamMessage`（默认开）/`streamThrottle` 与运行时 `setConfig`；`EmKit.onStreamMessage` 专用订阅；`em-text-message` 纯文本流光标/终态/异常提示；`em-chat-page` 新增 `#stream-message` 富格式插槽 + 流式跟随滚动节流与上翻暂停；demo 聊天页「AI 演示」、我的页开关、样式实验室演示
- M2.14 自定义卡片宿主插槽化：**不内置卡片组件/注册表/schema**，内核只保留 `EmKit.sendCustom` + `#custom-message` 插槽（作用域 `message`，外层承接原生 longpress，默认占位「[自定义消息]」）；Demo 提供宿主侧 `demo-card` 参考实现与免登录预览页
- M2.15 输入栏业务入口：`em-chat-page` 新增 `#input-toolbar` 具名插槽（消息列表与输入栏之间、无作用域、随键盘上移、不注入不占位），宿主可注入「发订单/发病例/换手机号」等场景胶囊并自行 `sendCustom`；无新增 props/emits/组件
