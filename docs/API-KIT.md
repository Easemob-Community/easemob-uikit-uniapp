# EmKit API

`EmKit` 是 UIKit 对宿主的统一命令入口：

```ts
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'
```

除 `init`、`whenReady`、同步 getter 与本地方法外，所有异步方法都会先等待 SDK 就绪（`await whenReady()`），宿主不需要自己判断 SDK 是否加载完成。

## 按业务域查找

- [状态与只读 store](./API-KIT-STATE.md)：连接状态、会话/消息/用户/联系人/群数据和未读快照。
- [初始化与生命周期](./API-KIT-LIFECYCLE.md)：`init`、`whenReady`、登录、登出、Token 和语言。
- [发送消息](./API-KIT-MESSAGES.md)：文本、自定义、媒体和附件 provider。
- [消息操作](./API-KIT-MESSAGE-OPERATIONS.md)：订阅、撤回、编辑、置顶、重发、删除、下载和回执。
- [会话](./API-KIT-CONVERSATIONS.md)：同步、历史、置顶、免打扰、删除和展示资料注入。
- [联系人](./API-KIT-CONTACTS.md)：好友快照、申请、备注和用户资料预取。
- [群组](./API-KIT-GROUPS.md)：群快照、成员、公告、邀请、角色和禁言。
- [日志与调试](./API-KIT-LOGS.md)：日志导出、读取、清理和级别控制。

## 其他公开能力

- [Composables](./API-COMPOSABLES.md)：主题、语言、未读、tabBar 和聊天输入行为。
- [Utils](./API-UTILS.md)：只读数据、展示工具、平台能力、媒体、存储和日志工具。
- [类型与常量](./API-TYPES.md)：公开 TypeScript 类型、枚举和常量。
