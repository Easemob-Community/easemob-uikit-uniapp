# EmKit 会话

## `EmKit.syncConversations()`

调用 SDK `refreshSessionList` 拉取权威会话快照并回写 store，返回 `Promise<void>`。失败会 reject 并保留 `syncFailed`，不会用内存快照伪装成功；同账号只让最新请求写快照，登出后的旧响应不会落盘。`loaded / syncing / syncFailed` 分别用于判断已权威加载、同步中与同步失败。

## `EmKit.enterConversation(conversationId, chatType)`

进入会话：拉取会话信息、清未读等。返回 `Promise<void>`。宿主在 `navigateTo` 前可 fire-and-forget 预热。

## `EmKit.loadHistory(conversationId, chatType, pageSize?)`

加载更早历史。返回 `Promise<void>`。聊天页进入时会自动调用；宿主自绘消息列表时使用。

## `EmKit.pinConversation(conversationId, chatType, pinned)`

置顶/取消置顶。返回 `Promise<void>`。同一会话的置顶请求按调用顺序串行，与免打扰队列互不影响；调用时乐观展示最新意图，旧响应不覆盖新意图，最新请求失败回滚到最新已确认状态。

## `EmKit.setConversationMuted(conversationId, chatType, muted)`

会话免打扰开关，乐观更新、失败回滚。返回 `Promise<void>`。同一会话的免打扰请求独立串行，遵循与置顶相同的最新意图保护；多设备或批量校正带来的新权威状态会更新回滚基线，但不会覆盖在途乐观状态。

## `EmKit.deleteConversation(conversationId, chatType)`

删除会话。返回 `Promise<void>`。

## `EmKit.clearConversationMessages(conversationId, chatType)`

清空会话消息（本地缓存、历史游标、会话摘要一并复位）。返回 `Promise<void>`。

## `EmKit.addConversation(conversationId, chatType)`

在本地会话列表构造一条会话，用于“发起会话”入口，不调用服务端建会话 API。返回 `void`。

## `EmKit.leaveConversation()`

离开当前会话（清 typing 计时器等）。返回 `void`。聊天页卸载时内部调用。

## `EmKit.setUserPresentation(...)` / `setConversationPresentation(...)` / `setGroupPresentation(...)`

```ts
EmKit.setUserPresentation(userId, patch)
EmKit.setConversationPresentation(conversationId, patch)
EmKit.setGroupPresentation(groupId, patch)
```

注入宿主业务展示资料，注入值**优先于 SDK 资料**参与全库回落链，且 SDK 资料回推、会话快照刷新不会冲掉注入值。写入即响应式更新：会话列表、聊天页标题、通讯录、群成员名等展示位同步生效。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `userId` / `conversationId` / `groupId` | `string` | 是 | 目标对象 id；单聊会话 id 即对端 userId |
| `patch` | `EmUserPresentation` / `EmConversationPresentation` / `EmGroupPresentation` \| `null` | 是 | 按字段合并；传 `null` 清除该对象全部注入 |

- `EmUserPresentation`：`{ nickname?, avatarUrl? }`，联系人备注仍最优先。
- `EmConversationPresentation` / `EmGroupPresentation`：`{ name?, avatar?, ext? }`；`ext` 为业务载荷，随相关插槽作用域透出。
- 登出/换账号时注入随账号清空，宿主在 `login` 成功后重新注入。

```ts
EmKit.setUserPresentation(peerId, { nickname: '金牌客服 · 小美' })
EmKit.setConversationPresentation(peerId, { ext: { tag: '售前咨询' } })
EmKit.setGroupPresentation(groupId, { ext: { tag: 'VIP 专属群' } })
EmKit.setUserPresentation(peerId, null)
```

返回 `void`。用法与配方见[多场景接入](./GUIDE-MULTI-SCENARIO.md)。
