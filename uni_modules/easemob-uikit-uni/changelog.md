# changelog

## 0.0.1（未发布）

- 仓库立项，见 PLAN.md
- M0 spike：EmKit 门面（init/login/logout/sendText/连接状态）+ demo 最小连通性用例页
- 新增 `em-icon` 原子组件：iconfont 字体图标方案（本地 ttf 组件同级目录 + `@font-face`），占位字体为 uni-icons `uniicons.ttf`（DCloud，Apache-2.0，161 图标），正式版替换为设计师 iconfont.cn 导出（只改 ttf + `em-icons.ts` 映射）；会话页/聊天页临时 "+" 字符已切换为 `em-icon`
- M2.9 群基础：群数据层（GroupManager 注册 + 群事件「更新 store + 系统通知」双写）与 chatType 全链路贯通（**breaking**：消息/会话域方法增必传 `chatType`，`em-chat-page`/`em-chat-info-page` 增必传 `chatType` prop）；群会话列表（@我 徽标全链路）；聊天页群形态（群名+人数副标题/成员昵称行/公告条）；@ 提及全链路（`em-mention-picker` 半屏选人 + ext `em_at_list`，与 vue 同 key，追加式插入为平台上限）；群列表页 `em-group-page` + 建群弹层；统一选人组件 `em-select-contact`（single/multiple，发起会话/建群/邀请三处复用）；发起会话（选人 → 本地 addConversation）；联系人页重构为入口页（**breaking**，好友列表平移 `em-contact-list-page`，新增 `em-contact-nav`）；群详情管理（成员宫格/公告编辑/改名/管理员/转让/退群解散/全员禁言禁输入/成员管理视图 `em-group-members-view`/邀请入群库内闭环）；群系统通知（`MESSAGE_TYPE.NOTICE` 本地灰条：建群/成员进出/改名/公告/转让）；新原子组件 `em-load-more`（触底三态）
