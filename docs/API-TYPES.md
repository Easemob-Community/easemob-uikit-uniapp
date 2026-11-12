# 类型与常量

所有公开类型和常量都从 `@/uni_modules/easemob-uikit-uni/libs` 导出：

```ts
import {
  MESSAGE_TYPE,
  MESSAGE_STATUS,
  CONVERSATION_TYPE,
  type EmMessageItem,
  type EmConversationItem
} from '@/uni_modules/easemob-uikit-uni/libs'
```

类型定义在 `libs/types/index.ts`，枚举/常量在 `libs/constants/index.ts`。业务代码应使用常量而不是硬编码字符串。

## SDK 初始化类型

`EmSdkInitOptions` 从 WebSDK `InitConfig` 派生，包含除 `appKey` / `appId` 身份字段外的全部原生初始化选项，用于 `EmKitConfig.sdkInitOptions`。UIKit 升级 WebSDK peer 依赖后，新增原生选项可随该类型和统一透传入口使用，不需要等待逐字段封装。字段细节以当前 WebSDK 版本类型为准，合并规则见[配置参考](./CONFIG.md)。

## 按领域查找

- [消息类型与常量](./API-TYPES-MESSAGES.md)：`EmMessageItem`、附件下载、引用、置顶、编辑、流式消息和消息常量。
- [会话类型与常量](./API-TYPES-CONVERSATIONS.md)：`EmConversationItem`、会话类型、分栏、输入模式和菜单 key。
- [用户、联系人与群组](./API-TYPES-CONTACTS-GROUPS.md)：用户资料、展示注入、申请、群、成员和创建群参数。
- [组件公共类型](./API-TYPES-COMPONENTS.md)：动作菜单、快捷回复、水印、输入栏作用域和选人/提及类型。
- [主题、语言与状态常量](./API-TYPES-THEME.md)：主题、语言、日志、连接、错误码和其他公共类型。
- [平台与媒体类型](./API-TYPES-PLATFORM.md)：媒体选择、附件 provider、录音和平台能力。

完整字段以 `libs/types/index.ts` 与 `libs/constants/index.ts` 为准。
