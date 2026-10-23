# 配置参考

UIKit 的配置分三层：

1. **全局行为配置**：`EmKit.init(config)` 传入 `EmKitConfig`，控制草稿、typing、撤回窗口、流式消息、输入栏功能、菜单、emoji、品牌色、日志等。
2. **运行时 UI 配置**：`setConfig()` / `useConfig()` 修改已解析的 `uiConfig`，适合在设置页即时切换。
3. **页面级呈现配置**：各页面组件的 props 与具名插槽，控制单个页面的标题、搜索、tab、插槽等。

## 1. `EmKitConfig`

```ts
EmKit.init({
  appkey: 'your-appkey',
  enableReadReceipt: true,
  logLevel: 'info',
  enableDraft: true,
  enableTyping: true,
  recallTimeLimit: 120000,
  inputFeatures: { voice: true, emoji: true, image: true, camera: true, video: true, file: true, sendOnReturn: true },
  primaryColor: '#009EFF'
})
```

### 基础与安全

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `appkey` | `string` | 必填 | 环信 AppKey |
| `enableReadReceipt` | `boolean` | `true` | 单聊已读回执开关 |
| `locale` | `'zh-CN' \| 'en'` | 跟随系统/上次选择 | 初始化界面语言，写入本地偏好 |
| `onTokenWillExpire` | `() => string \| Promise<string>` | 无 | Token 约 80% 生命周期时触发，返回新 token 后自动续期 |
| `onTokenExpired` | `() => void` | 无 | Token 已过期、SDK 断开时触发；通常跳登录页 |

### 日志

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `logLevel` | `'debug' \| 'info' \| 'warn' \| 'error' \| 'silent'` | `info` | UIKit 内置日志级别；`silent` 全关 |
| `logPayload` | `boolean` | `false` | 是否把 SDK 原始 payload 写入日志；仅在 `logLevel='debug'` 时采集，生产环境慎用 |
| `sdkConsoleLog` | `boolean` | `true` | SDK 自身 console 输出开关；关闭后 SDK 日志仍会转发进 UIKit logger |
| `sdkLogLevel` | `'DEBUG' \| 'WARN' \| 'ERROR'` | `WARN` | SDK 侧日志级别 |

### 聊天行为

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `enableDraft` | `boolean` | `true` | 输入栏草稿 |
| `enableTyping` | `boolean` | `true` | “正在输入”信令（发送节流 + 接收展示） |
| `enableReEdit` | `boolean` | `true` | 撤回消息的「重新编辑」按钮：自己撤回的文本消息可在撤回条上回显输入框重新发送 |
| `enableGroupNameEdit` | `boolean` | `true` | 群信息页群名修改入口（仅群主可见笔图标） |
| `recallTimeLimit` | `number` | `120000` | 撤回时间窗口（毫秒） |
| `typingThrottle` | `number` | `5000` | typing 发送节流（毫秒） |
| `typingTimeout` | `number` | `5000` | typing 展示超时（毫秒） |
| `timeDividerInterval` | `number` | `300000` | 消息时间分隔条间隔（毫秒） |
| `enableStreamMessage` | `boolean` | `true` | 是否合并 AI 流式分片；`false` 时等完整消息一次上屏 |
| `streamThrottle` | `number` | `50` | 流式分片合批间隔（毫秒）；`0` 表示逐片写入 |

### 输入栏与菜单

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `inputFeatures` | `Partial<EmInputFeatures>` | 全部开启 | 输入栏功能集：`voice` / `emoji` / `image` / `camera` / `video` / `file` / `sendOnReturn`（回车发送，关闭则换行输入）；缺项保持默认开 |
| `messageMenuKeys` | `MessageMenuKeyValue[]` | `copy` / `quote` / `edit` / `pin` / `recall` / `delete` | 消息长按菜单项与顺序；`edit` 编辑消息、`pin` 置顶消息，删除 key 即禁用对应能力（置顶消息条随之不渲染） |
| `conversationMenuKeys` | `ConversationMenuKeyValue[]` | `pin` / `mute` / `delete` | 会话长按菜单项与顺序 |
| `contactMenuKeys` | `ContactMenuKeyValue[]` | `remark` / `delete` | 联系人条目长按菜单项与顺序；`remark` 修改好友备注 |
| `emojiList` | `string[]` | 内置 96 个 | emoji 面板字符集 |

### 品牌与 SDK 加载

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `primaryColor` | `string` | 空串（用 token 默认） | 品牌色，写到 `--em-primary-color` |
| `sdkLoader` | `() => Promise<unknown>` | 无 | 小程序端自定义 SDK 异步加载器；仅 MP-WEIXIN 生效 |
| `sdkModule` | `unknown` | 无 | 宿主已加载好的 SDK 模块；与 `sdkLoader` 二选一，模块优先 |

## 2. 运行时 `setConfig` / `useConfig`

```ts
import { setConfig, useConfig } from '@/uni_modules/easemob-uikit-uni/libs'

// 设置页即时切换
setConfig({ enableStreamMessage: false })
setConfig({ primaryColor: '#FF6B00' })
setConfig({ inputFeatures: { voice: false } })

// 组件内读取 resolved 配置
const { config } = useConfig()
console.log(config.recallTimeLimit)
```

`setConfig` 接受 `Partial<EmUiConfig>`，一层深合并：`inputFeatures` 按字段合并，其他顶层键整体替换。`uiConfig` 是响应式对象，改动会立即影响已挂载的页面组件。

### `EmUiConfig` 字段

`EmUiConfig` 是 `EmKitConfig` 的 UI 维度解析后的全量形态，包含：

| 字段 | 类型 | 默认值 |
|---|---|---|
| `enableDraft` | `boolean` | `true` |
| `enableTyping` | `boolean` | `true` |
| `enableReEdit` | `boolean` | `true` |
| `enableGroupNameEdit` | `boolean` | `true` |
| `recallTimeLimit` | `number` | `120000` |
| `typingThrottle` | `number` | `5000` |
| `typingTimeout` | `number` | `5000` |
| `timeDividerInterval` | `number` | `300000` |
| `enableStreamMessage` | `boolean` | `true` |
| `streamThrottle` | `number` | `50` |
| `inputFeatures` | `EmInputFeatures` | 全部 `true` |
| `messageMenuKeys` | `MessageMenuKeyValue[]` | 六项 |
| `conversationMenuKeys` | `ConversationMenuKeyValue[]` | 三项 |
| `contactMenuKeys` | `ContactMenuKeyValue[]` | 两项 |
| `emojiList` | `string[]` | 96 个 |
| `primaryColor` | `string` | `''` |
| `logPayload` | `boolean` | `false` |

`EmInputFeatures` 为 `{ voice, emoji, image, camera, video, file }`，每项 `boolean`。

## 3. 页面级配置

### `em-conversation-page`

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `showSearch` | `boolean` | `true` | 顶部搜索条 |
| `tabs` | `ConversationTabKeyValue[]` | 全部五项 | 筛选 tab 与顺序；空数组隐藏 |
| `showTabs` | `boolean` | `true` | 筛选 tab 栏显隐；`false` 时无论 `tabs` 传什么都不渲染 |
| `emptyText` | `string` | `''` | 空列表文案；空串用 i18n 默认 |
| `autoSync` | `boolean` | `true` | 首次挂载自动拉会话快照 |
| `showConnectionBanner` | `boolean` | `true` | 顶部连接状态条 |

### `em-chat-page`

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `conversationId` | `string` | 必填 | 会话 ID |
| `chatType` | `'singleChat' \| 'groupChat'` | 必填 | 会话类型 |
| `avatarShape` | `'circle' \| 'square'` | `circle` | 头像形状 |
| `showMemberCount` | `boolean` | `true` | 群聊标题成员数副标题 |
| `senderNameMode` | `'always' \| 'hidden'` | `always` | 群聊气泡上方昵称行 |
| `showAnnouncement` | `boolean` | `true` | 群公告条 |
| `enableMention` | `boolean` | `true` | @ 提及链路 |
| `title` | `string` | `''` | 导航标题覆盖；空串回落昵称链 |
| `showAction` | `boolean` | `true` | 右上角详情入口 |
| `autoBack` | `boolean` | `true` | 返回时是否由组件 `navigateBack` |
| `showConnectionBanner` | `boolean` | `true` | 顶部连接状态条 |
| `quickReplies` | `EmQuickReply[]` | `[]` | 输入栏上方快捷回复 |
| `quickReplyMode` | `'fill' \| 'send'` | `fill` | 快捷回复点击行为 |
| `extraMessageMenus` | `EmMessageMenuExtra[]` | `[]` | 追加的业务长按动作 |

### `em-chat-info-page`

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `conversationId` | `string` | 必填 | 会话 ID |
| `chatType` | `'singleChat' \| 'groupChat'` | 必填 | 会话类型 |
| `showMemberGrid` | `boolean` | `true` | 群成员宫格 |
| `showGroupName` | `boolean` | `true` | 群名称字段行 |
| `showAnnouncement` | `boolean` | `true` | 群公告字段行 |

### `em-contact-list-page`

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `menuKeys` | `ContactMenuKeyValue[]` | `['delete']` | 好友长按菜单项 |
| `autoSync` | `boolean` | `true` | 首次挂载读好友快照 |

### `em-group-page`

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `showNameInput` | `boolean` | `false` | 建群面板显示群名称输入框 |
| `showSettings` | `boolean` | `false` | 建群面板显示公开群/允许邀请开关 |

## 4. 配置优先级

1. `EmKit.init` 的 `EmKitConfig` 写入 `uiConfig`。
2. 之后调用 `setConfig` 覆盖已解析值。
3. 页面级 props 只影响该页面实例，不写回全局配置。
4. `primaryColor` 同时写入页面根节点的 `--em-primary-color`；H5 还会写到 `document.documentElement`。

## 5. 与平台相关的能力

输入栏功能集会受平台能力二次裁剪：

- H5 不显示语音入口（录音未接入浏览器）。
- App 的文件入口由宿主附件能力决定：注册附件 provider 且当前可用时显示；未注册或不可用时隐藏。

因此 `inputFeatures.file=true` 只是开启文件功能，App 仍需满足附件能力条件。宿主自己的入口也应使用 `EmKit.canPickAttachment`（或响应式 `canPickAttachment()`）判断，不要只看 `PLATFORM_CAPABILITIES.filePick`。完整矩阵见 [平台能力与差异](./PLATFORM.md)。

## 6. 示例：按业务场景关闭不需要的能力

```ts
// 客服场景：只要文本、图片、快捷回复；关闭 typing 与语音
EmKit.init({
  appkey: 'your-appkey',
  enableTyping: false,
  inputFeatures: { voice: false, emoji: true, image: true, camera: true, video: false, file: false },
  messageMenuKeys: ['copy', 'quote', 'delete']
})
```

```ts
// 业务设置页：即时开关流式消息
import { setConfig } from '@/uni_modules/easemob-uikit-uni/libs'
setConfig({ enableStreamMessage: false })
```
