# EmKit 状态与只读 Store

`EmKit` 同时暴露连接状态和按业务域划分的响应式只读数据。宿主可渲染这些数据，写操作应走 EmKit 方法。

## `EmKit.state`

连接与登录状态，响应式对象：

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | `'idle' \| 'connecting' \| 'reconnecting' \| 'online' \| 'closed'` | 当前连接状态；`reconnecting` 表示已登录后的自动重连中 |
| `appkey` | `string` | 初始化时的 appkey |
| `userId` | `string` | 当前登录用户；空串表示未登录 |
| `reason` | `string` | 最近一次连接事件原因（SDK 原值，如 `login` / `reconnect` / `offline` / `token-expired` / `limit`） |
| `errorCode` | `number` | 最近一次断开/重连失败错误码，0 表示无 |
| `kicked` | `boolean` | 是否处于被踢/账号失效终态 |
| `kickCode` | `number` | 被踢错误码，0 表示无 |
| `reconnecting` | `boolean` | 是否处于自动重连 |
| `reconnectAttempt` | `number` | 当前重连尝试次数 |
| `networkOnline` | `boolean \| null` | 系统网络是否可用：`true` 在线 / `false` 离线 / `null` 未知 |

判断是否登录请用 `EmKit.state.userId !== ''`，不要用 `status === 'online'`：断网重连时 `status` 会短暂离开 `online`，但用户并没有退出登录。被踢错误码 206/207/214/216/217 用于区分他处登录、注销、设备超限、改密和其他被迫下线。

## 只读数据 store

| 属性 | 类型 | 说明 |
|---|---|---|
| `EmKit.conversations` | `EmConversationStore` | 会话列表、同步状态、按会话缓存的未读等 |
| `EmKit.messages` | `EmMessageStore` | 按会话分组的消息、历史游标、加载状态 |
| `EmKit.users` | `EmUserStore` | 用户昵称/头像缓存 |
| `EmKit.contacts` | `EmContactStore` | 好友、好友申请/群邀请、同步状态 |
| `EmKit.groups` | `EmGroupStore` | 已加入群、群资料、成员、公告缓存 |

这些 store 是 `reactive` 模块级单例，组件 computed 会随 SDK 事件自动更新。宿主可以做只读渲染，写操作请走 `EmKit` 方法，避免绕过业务域。

## 未读 getter

| API | 返回 | 说明 |
|---|---|---|
| `EmKit.conversationUnreadCount` | `number` | 所有会话未读之和（含免打扰），非响应式快照 |
| `EmKit.contactRequestUnreadCount` | `number` | 收到的、仍 pending 的好友申请/群邀请数，非响应式快照 |
| `EmKit.conversationUnreadCountOf(conversationId)` | `number` | 单会话未读快照 |

需要响应式数值时使用 [`useUnreadCounts()` / `useConversationUnreadCount(id)` / `useTabBarBadge()`](./API-COMPOSABLES.md#未读与-tabbar)。
