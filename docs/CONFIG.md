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
  showReadStatus: false,
  enableGroupReadReceipt: false,
  messageStatus: { position: 'left', texts: { failed: '发送失败' } },
  logLevel: 'info',
  enableDraft: true,
  enableTyping: true,
  recallTimeLimit: 120000,
  inputFeatures: { voice: true, emoji: true, image: true, camera: true, video: true, file: true, inputMode: 'single', sendOnReturn: true },
  primaryColor: '#009EFF'
})
```

### 基础与安全

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `appkey` | `string` | 必填 | 环信 AppKey |
| `enableReadReceipt` | `boolean` | `true` | 单聊已读回执功能开关（是否发送/接收已读回执） |
| `showReadStatus` | `boolean` | `false` |
| `enableGroupReadReceipt` | `boolean` | `false` |
| `messageStatus` | `Required<EmMessageStatusPresentation>` | `{ position: 'left', icons: {}, texts: {} }` | 单聊已读态图标（未读空心圆/已读对勾）显隐；纯展示开关，与 `enableReadReceipt` 解耦，不影响发送中/失败状态 |
| `enableGroupReadReceipt` | `boolean` | `false` | 群聊已读回执：开启后群消息携带 `needReadReceipt`、自动回执群消息，并在己方群消息下方展示已读人数；关闭时群聊不产生任何回执请求 |
| `locale` | `'zh-CN' \| 'en'` | 跟随系统/上次选择 | 初始化界面语言，写入本地偏好 |
| `onTokenWillExpire` | `() => string \| Promise<string>` | 无 | Token 约 80% 生命周期时触发，返回新 token 后自动续期 |
| `onTokenExpired` | `() => void` | 无 | Token 已过期、SDK 断开时触发；通常跳登录页 |

### 设备信息

UIKit 在初始化 SDK 时默认注入固定设备标识，让服务端的多端登录查询与互踢能按设备与平台维度区分。总开关 `enableDeviceInfo` 默认开启，传 `false` 则完全不注入，SDK 退回默认设备行为。

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `enableDeviceInfo` | `boolean` | `true` | 设备信息注入总开关；`false` 时 `deviceId` / `devicePlatform` 均不生效 |
| `deviceId` | `string` | 自动派生 | 显式指定设备标识（透传 SDK `deviceId`），**原样使用、不加任何段**。不传时按以下优先级自动派生：① 此前持久化的设备标识；② `uni.getDeviceInfo()` 框架设备标识；③ 自生成 UUID。后两者一经得出即拼上平台/版本段并写入本地存储，跨启动保持稳定。**格式**：App 端（android / ios / harmonyos）且 `uni.getDeviceInfo()` 取到非空设备品牌、型号、系统版本时，为六段式 `Platform_uikitVersion_brand_model_system_uuid`（例 `android_1.0.0-rc.2_Xiaomi_23127PN0CC_Android15_b3fdc46-...`），机型/系统段已剔除空白字符；机型信息任一缺失，以及 H5 / 微信小程序（无可靠机型信息），退回三段式 `Platform_uikitVersion_uuid`（例 `web_1.0.0-rc.2_b3fdc46-...`）。注意：**UIKit 升级后版本段变化，服务端会视为新设备**（旧格式持久化值会自动按新格式重新派生，无需手动清理） |
| `devicePlatform` | `number` | 不注入 | 显式指定自定义平台编号（透传 SDK `customOSPlatform`）。SDK 要求 1–100 的整数，且是向环信申请注册过的编号；不传时不注入，平台维度由 `deviceId` 前缀承担 |

注入 `deviceId` 时，UIKit 会同步关闭 SDK 的 `useFixedDeviceId`：该开关默认开启且 SDK 本地历史设备值（浏览器 localStorage）优先，不关闭会导致老用户设备上注入值被历史值覆盖、不生效。该行为不影响 UIKit 自身的设备标识持久化。

```ts
EmKit.init({
  appkey: 'your-appkey',
  deviceId: 'pos-terminal-01', // 宿主显式值：原样使用，不加前缀
  devicePlatform: 42 // 向环信申请注册后的自定义平台编号
})
```

注意：SDK 客户端是单例，初始化配置会参与一致性比对，重复初始化时传入的 `deviceId` / `devicePlatform` 必须与首次一致，否则 SDK 会抛配置冲突错误。

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

### 发送状态呈现

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `messageStatus` | `EmMessageStatusPresentation` | `{ position: 'left', icons: {}, texts: {} }` | 发送状态（发送中/失败/未读/已读）的图标、文案与位置；`position: 'right'` 把状态列镜像到气泡右侧，`icons` 按状态覆盖图标名，`texts` 追加短文案 |

```ts
EmKit.init({
  appkey: 'your-appkey',
  messageStatus: {
    position: 'right',
    icons: { failed: 'circle-bang' },
    texts: { sending: '发送中', failed: '失败' }
  }
})
```

发送中与失败是独立关键状态，始终展示；`showReadStatus` 只控制单聊未读/已读图标，`messageStatus` 只改变呈现形式，不改变状态判定。

### 输入栏与菜单

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `inputFeatures` | `Partial<EmInputFeatures>` | 工具全开、`inputMode` 未设置、`sendOnReturn=true` | 输入栏工具、单/多行模式与旧回车配置；缺项保持默认值 |
| `messageMenuKeys` | `MessageMenuKeyValue[]` | `copy` / `quote` / `edit` / `pin` / `recall` / `resend` / `delete` | 消息长按菜单项与顺序；`edit` 编辑消息、`pin` 置顶消息、`resend` 重发失败消息，删除 key 即禁用对应能力（置顶消息条随之不渲染） |
| `conversationMenuKeys` | `ConversationMenuKeyValue[]` | `pin` / `mute` / `delete` | 会话长按菜单项与顺序 |
| `contactMenuKeys` | `ContactMenuKeyValue[]` | `remark` / `delete` | 联系人条目长按菜单项与顺序；`remark` 修改好友备注 |
| `emojiList` | `string[]` | 内置 96 个 | emoji 面板字符集 |

`inputFeatures.inputMode='single'` 为全端单行 input、回车发送；`'multiline'` 为全端生长 textarea、回车换行、纸飞机发送，1 行起步、最多 5 行，超出内部滚动。未设置 `inputMode` 时保留旧 `sendOnReturn` 行为：`false` 走多行；`true` 时 iOS 走多行回车发送，其余端走单行。显式 `inputMode` 优先，不与 `sendOnReturn` 组合。

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

`setConfig` 接受 `Partial<EmUiConfig>`（`messageStatus` 允许只传部分字段），一层深合并：`inputFeatures` 按字段合并，`messageStatus` 的 `position` 整体替换、`icons`/`texts` 逐项覆盖，其他顶层键整体替换。`uiConfig` 是响应式对象，改动会立即影响已挂载的页面组件。

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
| `showReadStatus` | `boolean` | `false` |
| `enableGroupReadReceipt` | `boolean` | `false` |
| `messageStatus` | `Required<EmMessageStatusPresentation>` | `{ position: 'left', icons: {}, texts: {} }` |
| `inputFeatures` | `EmInputFeatures` | 工具全开、`inputMode` 未设置、`sendOnReturn=true` |
| `messageMenuKeys` | `MessageMenuKeyValue[]` | 七项 |
| `conversationMenuKeys` | `ConversationMenuKeyValue[]` | 三项 |
| `contactMenuKeys` | `ContactMenuKeyValue[]` | 两项 |
| `emojiList` | `string[]` | 96 个 |
| `primaryColor` | `string` | `''` |
| `logPayload` | `boolean` | `false` |

`EmInputFeatures` 包含布尔工具字段 `voice` / `emoji` / `image` / `camera` / `video` / `file`，以及可选 `inputMode` 与旧 `sendOnReturn` 配置。

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
