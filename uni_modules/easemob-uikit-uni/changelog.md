# changelog

## 0.0.1（未发布）

- 仓库立项，见 PLAN.md
- M0 spike：EmKit 门面（init/login/logout/sendText/连接状态）+ demo 最小连通性用例页
- 新增 `em-icon` 原子组件：iconfont 字体图标方案（本地 ttf 组件同级目录 + `@font-face`），占位字体为 uni-icons `uniicons.ttf`（DCloud，Apache-2.0，161 图标），正式版替换为设计师 iconfont.cn 导出（只改 ttf + `em-icons.ts` 映射）；会话页/聊天页临时 "+" 字符已切换为 `em-icon`
- M2.9 群基础：群数据层（GroupManager 注册 + 群事件「更新 store + 系统通知」双写）与 chatType 全链路贯通（**breaking**：消息/会话域方法增必传 `chatType`，`em-chat-page`/`em-chat-info-page` 增必传 `chatType` prop）；群会话列表（@我 徽标全链路）；聊天页群形态（群名+人数副标题/成员昵称行/公告条）；@ 提及全链路（`em-mention-picker` 半屏选人 + ext `em_at_list`，与 vue 同 key，追加式插入为平台上限）；群列表页 `em-group-page` + 建群弹层；统一选人组件 `em-select-contact`（single/multiple，发起会话/建群/邀请三处复用）；发起会话（选人 → 本地 addConversation）；联系人页重构为入口页（**breaking**，好友列表平移 `em-contact-list-page`，新增 `em-contact-nav`）；群详情管理（成员宫格/公告编辑/改名/管理员/转让/退群解散/全员禁言禁输入/成员管理视图 `em-group-members-view`/邀请入群库内闭环）；群系统通知（`MESSAGE_TYPE.NOTICE` 本地灰条：建群/成员进出/改名/公告/转让）；新原子组件 `em-load-more`（触底三态）
- M2.11 多场景扩展能力 P0：`sendText` 增业务 `ext` 参数（与引用/@提及内部 key 合并，内部 key 优先）；新增 `EmKit.sendCustom(event, params?, ext?)` 与 `MESSAGE_TYPE.CUSTOM` 一等类型（`EmMessageItem.customEvent/customParams`，失败可重发）；`em-chat-page` 新增 `#banner` 固定位插槽与 `title`/`showAction` props；新增通用系统提示消息 API `EmKit.insertLocalNotice(conversationId, chatType, text)`（`insertGroupNotice` 保留为群聊别名）；配套接入指引 `docs/GUIDE-MULTI-SCENARIO.md`
- M2.12 多场景扩展能力 P1：新增单会话未读 API（`useConversationUnreadCount` / `conversationUnreadCountOf` / `EmKit.conversationUnreadCountOf`）；新原子组件 `em-quick-reply-bar` 与 `em-chat-page.quickReplies`/`quickReplyMode`（fill 填草稿 / send 直发）；`em-chat-page` 增 `extraMessageMenus` + `message-menu(key, message)` 支持业务长按动作（`types` 过滤、内置 key 保留）
- M2.13 AI 流式消息：`onStreamMessage` 分片按 `msgServerId` 幂等合并到同条 TEXT 气泡（`EmMessageItem.stream`，`onMessage` 完整消息丢片补偿）；分片索引 + `streamThrottle` 合批（默认 50ms）+ 终态立即落盘；`EmKitConfig.enableStreamMessage`（默认开）/`streamThrottle` 与运行时 `setConfig`；`EmKit.onStreamMessage` 专用订阅；`em-text-message` 纯文本流光标/终态/异常提示；`em-chat-page` 新增 `#stream-message` 富格式插槽 + 流式跟随滚动节流与上翻暂停；demo 聊天页「AI 演示」、我的页开关、样式实验室演示
