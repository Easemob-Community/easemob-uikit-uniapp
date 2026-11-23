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
  primaryColor: '#009EFF',
  avatarShape: 'circle'
})
```

### 基础与安全

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `appkey` | `string` | 必填 | 环信 AppKey |
| `enableReadReceipt` | `boolean` | `true` | 单聊已读回执功能开关（是否发送/接收已读回执） |
| `showReadStatus` | `boolean` | `false` | 单聊已读态图标（未读空心圆/已读对勾）显隐；纯展示开关，与 `enableReadReceipt` 解耦，不影响发送中/失败状态 |
| `enableGroupReadReceipt` | `boolean` | `false` | 群聊已读回执：开启后群消息携带 `needReadReceipt`、自动回执群消息，并在己方群消息下方展示已读人数；关闭时群聊不产生任何回执请求 |
| `locale` | `EmLocaleName` | 跟随系统/上次选择 | 初始化界面语言，写入本地偏好；扩展语言需先用 `mergeMessages` 注册文案表 |
| `onTokenWillExpire` | `() => string \| Promise<string>` | 无 | Token 约 80% 生命周期时触发，返回新 token 后自动续期 |
| `onTokenExpired` | `() => void` | 无 | Token 已过期、SDK 断开时触发；通常跳登录页 |

### SDK 初始化配置

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `sdkInitOptions` | `EmSdkInitOptions` | 见下方规则 | WebSDK 全部非身份类原生初始化选项的统一入口，不需要等待 UIKit 逐字段增加配置。应用身份仍由 `appkey` 管理，不在此对象传 `appKey` / `appId` |

```ts
EmKit.init({
  appkey: 'your-appkey',
  sdkInitOptions: {
    loginExtensionInfo: JSON.stringify({ deviceName: '我的设备', source: 'uniapp' }),
    enableDeliveryReceipt: true,
    serviceConfig: {
      serverUrls: {
        restApiUrl: 'https://im.example.com',
        wsUrl: 'wss://im.example.com/websocket'
      }
    }
  }
})
```

普通字段按 WebSDK 原生语义透传，并优先于 UIKit 自动派生值。特殊字段按以下规则合并：

- `enableSyncData`：缺省为 `['conversation', 'contact', 'group']`；显式传入时完整替换默认值，缩减同步类型会影响对应 UIKit 数据能力。
- `managers`：始终保留 UIKit 必需的 `ChatManager`、`PushManager`、`UserInfoManager`、`ContactManager`、`GroupManager`，再追加并按引用去重宿主 Manager。
- `platformAdapterOptions`：`prefer`、`runtimeInput`、`transportAdapter` 等字段原样透传；`overrides` 与 UIKit 的网络监听、附件 MD5 兼容修复组合，宿主同名适配器优先。

### 设备信息

UIKit 在初始化 SDK 时默认注入固定设备标识和登录设备扩展名，让服务端的多端登录查询、互踢与设备识别可以按设备和平台维度区分。总开关 `enableDeviceInfo` 默认开启，传 `false` 则关闭这些自动派生值；`sdkInitOptions` 中显式传入的字段不受影响。

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `enableDeviceInfo` | `boolean` | `true` | 自动设备信息注入总开关；`false` 时自动 `deviceId` / `devicePlatform` / `loginExtensionInfo` 均不生效 |
| `deviceId` | `string` | 自动派生 | 显式指定设备标识（透传 SDK `deviceId`），**原样使用、不加任何段**。不传时按以下优先级自动派生：① 当前格式的持久化设备标识；② `uni.getDeviceInfo()` 框架设备标识；③ 自生成 UUID。后两者一经得出即拼上平台/版本段并写入本地存储，跨启动保持稳定。**格式**固定为三段式 `Platform_uikitVersion_uuid`（例 `android_1.0.3_b3fdc46-...`；Platform 取归一平台名 `android` / `ios` / `harmonyos` / `web` / `mp-weixin`）。为避免设备型号合规风险，不加入品牌、型号或系统版本；旧六段式持久化值不会复用，会自动按三段式重新派生。注意：**UIKit 升级后版本段变化，服务端会视为新设备** |
| `devicePlatform` | `number` | 不注入 | 显式指定自定义平台编号（透传 SDK `customOSPlatform`）。SDK 要求 1–100 的整数，且是向环信申请注册过的编号；不传时不注入，平台维度由 `deviceId` 前缀承担 |

`sdkInitOptions.loginExtensionInfo` 未显式传入时，UIKit 生成仅含归一平台名的 JSON 字符串，例如 `{ "deviceName": "android" }`；平台缺失时回退系统名，完全不可用时为 `unknown`。设备 API 不可用时不会阻断初始化。UIKit 只请求 `uni.getDeviceInfo({ filter: ['deviceId', 'platform', 'osName'] })` 的必要字段，不读取或上报品牌、型号和系统版本。该字段也可以覆盖为包含业务自定义字段的 JSON 字符串，WebSDK 限制最大 1024 个字符。

注入 `deviceId` 时，UIKit 会同步关闭 SDK 的 `useFixedDeviceId`：该开关默认开启且 SDK 本地历史设备值（浏览器 localStorage）优先，不关闭会导致老用户设备上注入值被历史值覆盖、不生效。该行为不影响 UIKit 自身的设备标识持久化。

```ts
EmKit.init({
  appkey: 'your-appkey',
  deviceId: 'pos-terminal-01', // 兼容入口；也可使用 sdkInitOptions.deviceId
  devicePlatform: 42 // 兼容入口；也可使用 sdkInitOptions.customOSPlatform
})
```

注意：SDK 客户端是单例，初始化配置会参与一致性比对，重复初始化时传入的 `deviceId` / `devicePlatform` / `sdkInitOptions` 必须与首次一致，否则 SDK 会抛配置冲突错误。

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
| `messageMenuKeys` | `MessageMenuKeyValue[]` | `copy` / `quote` / `edit` / `pin` / `download` / `recall` / `resend` / `delete` | 消息长按菜单项与顺序；`edit` 编辑消息、`pin` 置顶消息、`download` 下载附件（仅图片/视频/文件出现）、`resend` 重发失败消息，删除 key 即禁用对应能力（置顶消息条随之不渲染） |
| `conversationMenuKeys` | `ConversationMenuKeyValue[]` | `pin` / `mute` / `delete` | 会话长按菜单项与顺序 |
| `contactMenuKeys` | `ContactMenuKeyValue[]` | `remark` / `delete` | 联系人条目长按菜单项与顺序；`remark` 修改好友备注 |
| `emojiList` | `string[]` | 内置 96 个 | emoji 面板字符集 |

`inputFeatures.inputMode='single'` 为全端单行 input、回车发送；`'multiline'` 为全端生长 textarea、回车换行、纸飞机发送，1 行起步、最多 5 行，超出内部滚动。未设置 `inputMode` 时保留旧 `sendOnReturn` 行为：`false` 走多行；`true` 时 iOS 走多行回车发送，其余端走单行。显式 `inputMode` 优先，不与 `sendOnReturn` 组合。

### 品牌、头像与 SDK 加载

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `primaryColor` | `string` | 空串（用 token 默认） | 品牌色，写到 `--em-primary-color` |
| `avatarShape` | `EmAvatarShape` | `'circle'` | 全局头像形状；`em-avatar`、会话、聊天、联系人、群与资料等未显式指定形状的头像统一跟随，局部 `shape` / `avatarShape` 优先 |
| `sdkLoader` | `() => Promise<unknown>` | 无 | 小程序端自定义 SDK 异步加载器；仅 MP-WEIXIN 生效 |
| `sdkModule` | `unknown` | 无 | 宿主已加载好的 SDK 模块；与 `sdkLoader` 二选一，模块优先 |

## 2. 运行时 `setConfig` / `useConfig`

```ts
import { setConfig, useConfig } from '@/uni_modules/easemob-uikit-uni/libs'

// 设置页即时切换
setConfig({ enableStreamMessage: false })
setConfig({ primaryColor: '#FF6B00' })
setConfig({ avatarShape: 'square' })
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
| `messageMenuKeys` | `MessageMenuKeyValue[]` | 八项 |
| `conversationMenuKeys` | `ConversationMenuKeyValue[]` | 三项 |
| `contactMenuKeys` | `ContactMenuKeyValue[]` | 两项 |
| `emojiList` | `string[]` | 96 个 |
| `primaryColor` | `string` | `''` |
| `avatarShape` | `EmAvatarShape` | `'circle'` |
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
| `avatarShape` | `EmAvatarShape` | 跟随全局配置 | 当前会话页头像形状局部覆盖，真实头像与首次同步骨架屏一致 |

### `em-chat-page`

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `conversationId` | `string` | 必填 | 会话 ID |
| `chatType` | `'singleChat' \| 'groupChat'` | 必填 | 会话类型 |
| `avatarShape` | `'circle' \| 'square'` | 跟随全局配置 | 当前聊天页消息头像形状局部覆盖 |
| `showMemberCount` | `boolean` | `true` | 群聊标题成员数副标题 |
| `senderNameMode` | `'always' \| 'hidden'` | `always` | 群聊气泡上方昵称行 |
| `showAnnouncement` | `boolean` | `true` | 群公告条 |
| `enableMention` | `boolean` | `true` | @ 提及链路 |
| `peerName` / `peerAvatar` | `string` | `''` | 单聊对端业务昵称/头像，空串不注入 |
| `title` | `string` | `''` | 导航标题覆盖；空串回落昵称链 |
| `showNavBar` / `showBack` | `boolean` | `true` / `true` | 自绘导航栏与返回箭头显隐 |
| `showAction` | `boolean` | `true` | 右上角详情入口 |
| `inputFeatures` | `Partial<EmInputFeatures>` | 未设置 | 按字段覆盖当前页面的全局输入配置，不影响其他页面 |
| `messageMenuKeys` | `MessageMenuKeyValue[]` | 未设置 | 当前页面菜单数组整体替换全局配置；置顶条也使用该结果 |
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

`inputFeatures` 的页面 props 与全局配置按字段合并，未传字段继续响应 `setConfig`；`messageMenuKeys` 传入后则整体替换当前页面的全局菜单数组：

```vue
<!-- 社交聊天：使用全局全部工具 -->
<em-chat-page conversation-id="user-a" chat-type="singleChat" />

<!-- 客服聊天：只关闭语音、拍摄和视频，其他字段继续跟随全局配置 -->
<em-chat-page
  conversation-id="customer-service"
  chat-type="singleChat"
  :input-features="{ voice: false, camera: false, video: false }"
  :message-menu-keys="['copy', 'quote', 'delete']"
/>
```

两个页面实例互不回写配置。身份 props 写入的是账号级展示覆盖层；若两个页面同时为同一 userId 注入不同身份，最后写入者生效，业务上应避免这种冲突。

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
