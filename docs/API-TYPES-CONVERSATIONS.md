# 会话类型与常量

## `EmConversationItem`

| 字段 | 类型 | 说明 |
|---|---|---|
| `conversationId` | `string` | 会话 ID |
| `chatType` | `EmChatType` | 单聊/群聊 |
| `name` | `string` | 会话名称快照 |
| `avatar` | `string` | 会话头像快照 |
| `unreadCount` | `number` | 未读数 |
| `lastMessageText` | `string` | 最后一条消息摘要 |
| `lastMessageTime` | `number` | 最后消息时间戳 |
| `isPinned` | `boolean` | 是否置顶 |
| `pinnedTime` | `number` | 置顶时间戳，未置顶为 0 |
| `isMuted` | `boolean` | 是否免打扰 |

## 会话与输入常量

- `CONVERSATION_TYPE`：`SINGLE_CHAT='singleChat'`、`GROUP_CHAT='groupChat'`；类型别名 `ConversationTypeValue` / `EmChatType`。
- `CHAT_INPUT_MODE`：`SINGLE='single'`、`MULTILINE='multiline'`；类型别名 `ChatInputModeValue` / `EmChatInputMode`。
- `CONVERSATION_TAB_KEY`：`ALL`、`UNREAD`、`AT_ME`、`SINGLE`、`GROUP`；默认顺序见 `DEFAULT_CONVERSATION_TABS`。
- `CONVERSATION_MENU_KEY`：`NEW_CHAT`、`CREATE_GROUP`、`PIN`、`MUTE`、`DELETE`。
- `MESSAGE_MENU_KEY`：`COPY`、`QUOTE`、`EDIT`、`PIN`、`DOWNLOAD`、`RECALL`、`RESEND`、`DELETE`；删除 key 即禁用对应能力，`RESEND` 仅发送失败时出现。
