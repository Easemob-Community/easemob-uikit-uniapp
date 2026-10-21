# AI 流式消息（Stream Message）

AI 客服、IM 内 AI 对话、分段生成内容这类场景，模型输出是一段一段到达的。这页说明 UIKit 如何把服务端下发的流式分片合并进**同一条文本气泡**、如何逐字上屏、宿主可以用哪些开关和插槽接管渲染与副作用。

流式内容由**业务服务端**调用模型后经环信 RESTful 下发，客户端只收不发；UIKit 负责接收、合并、节流刷新与默认渲染。

> 相关页面：[配置参考](./CONFIG.md) · [消息与扩展协议](./MESSAGING.md) · [聊天页](./PAGES-CHAT.md) · [EmKit API](./API-KIT.md) · [类型与常量](./API-TYPES.md) · [平台能力与差异](./PLATFORM.md) · [示例工程](./DEMO.md)

## 能力

- **单气泡合并**：同一 `msgServerId` 的分片合并进一条 `TEXT` 消息气泡，合并后 `message.text` 即为累计全文（`stream.fullText`），不会出现多条气泡。
- **低首字延迟**：首个分片立即建气泡并渲染，后续分片按 `streamThrottle` 合批写入。
- **终态立即落盘**：`STREAM_COMPLETED` / `STREAM_START_COMPLETED` / `STREAM_ERROR` 不受节流窗口约束，最后一段内容不等待。
- **乱序与重复分片防护**：非终态旧分片（`seq` 小于当前已落盘/待落盘序号）直接丢弃；全文以服务端 `fullText` 为准，不信任增量拼接顺序。
- **丢片收敛**：离线或断连期间错过终态分片时，随后到达的完整消息（`onMessage`）会覆盖未完成的流式副本并收敛为终态，不残留半截内容。
- **默认纯文本渲染**：传输中气泡尾部显示静态打字机光标，终态收敛为普通文本，异常结束保留已生成内容并追加「内容生成异常」。
- **富格式由宿主接管**：`customType` 为 `markdown` 等非纯文本类型时，聊天页走 `#stream-message` 插槽，宿主自行渲染。
- **可关闭**：`enableStreamMessage: false` 时整条流式链路关闭，等 SDK 完整消息一次性上屏。

## 开启方式

流式链路默认开启，无需额外代码即可接收。需要调整时在 `EmKit.init` 传入两个配置项：

```ts
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'

EmKit.init({
  appkey: 'your-appkey',
  // 默认 true。false = 忽略 onStreamMessage 分片，等完整消息（onMessage）到达后一次性上屏
  enableStreamMessage: true,
  // 分片合批间隔（毫秒），默认 50，即最多约 20 次/秒写入
  // 0 = 每个分片立即写入（少量内容或调试时更跟手，但重绘最频繁）
  streamThrottle: 50
})
```

| 配置项 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `enableStreamMessage` | `boolean` | `true` | 流式消息开关。`false` 时 `onStreamMessage` 分片被忽略，等完整消息一次上屏 |
| `streamThrottle` | `number` | `50` | 分片合批间隔（毫秒）。`0` 表示逐片立即写入；终态分片不受此值影响 |

运行时切换（例如设置页开关、按会话切换）：

```ts
import { setConfig } from '@/uni_modules/easemob-uikit-uni/libs'

setConfig({ enableStreamMessage: false })
```

要点：

- 节流是**合批**而非防抖：窗口从首个待写分片起算，持续到达的分片不会把首字刷新一直往后推。
- 运行期关闭开关时，已缓冲但未写入的分片会被丢弃；随后到达的完整消息仍按普通消息上屏。
- 完整配置面见[配置参考](./CONFIG.md)。

## 数据模型：`EmStreamInfo`

流式元信息挂在消息对象的可选字段 `EmMessageItem.stream` 上；普通消息该字段为 `undefined`。

| 字段 | 类型 | 说明 |
|---|---|---|
| `customType` | `string` | 业务自定义流类型。`''` 或 `'text'` 走内核纯文本渲染；其余值（如 `'markdown'`）交宿主插槽 |
| `seq` | `number` | 服务端排序后的分片序号；用于丢弃乱序旧片 |
| `status` | `StreamMessageStatusValue` | 流式状态，取值见下表 |
| `deltaText` | `string` | 当前分片的新增文本；展示以 `fullText` 为准，此字段供宿主做动画/统计 |
| `fullText` | `string` | 截至当前分片的累计全文，与 `message.text` 同值 |
| `errorType` | `number` | 流式处理错误码，`0` 表示无错误 |
| `finishReason` | `number`（可选） | 服务端返回的结束原因，SDK 提供时透传 |

状态取值来自 `STREAM_MESSAGE_STATUS`，与 SDK 公开值一一对应：

| 常量 | 值 | 含义 | 内核表现 |
|---|---|---|---|
| `STREAM_MESSAGE_STATUS.START` | `'STREAM_START'` | 流开始，全文通常为空 | 立即建气泡，显示打字机光标 |
| `STREAM_MESSAGE_STATUS.IN_PROGRESS` | `'STREAM_IN_PROGRESS'` | 传输中，全文增长 | 合批刷新全文并保留光标 |
| `STREAM_MESSAGE_STATUS.START_COMPLETED` | `'STREAM_START_COMPLETED'` | 单分片即完成 | 终态，光标消失 |
| `STREAM_MESSAGE_STATUS.COMPLETED` | `'STREAM_COMPLETED'` | 正常结束 | 终态，收敛为普通文本 |
| `STREAM_MESSAGE_STATUS.ERROR` | `'STREAM_ERROR'` | 服务端生成异常 | 终态，保留已生成内容并追加异常提示 |

配套常量与纯函数（均从 `@/uni_modules/easemob-uikit-uni/libs` 导出）：

| 名称 | 类型 | 说明 |
|---|---|---|
| `STREAM_CUSTOM_TYPE.TEXT` | `'text'` | 内核纯文本流类型 |
| `STREAM_CUSTOM_TYPE.MARKDOWN` | `'markdown'` | 富格式流类型约定值，渲染由宿主实现 |
| `STREAM_CURSOR_CHAR` | `'▍'` | 打字机光标字符 |
| `STREAM_FLUSH_INTERVAL` | `50` | 分片合批默认间隔（毫秒），即 `streamThrottle` 的默认值来源 |
| `isStreamActive(status)` | `(status?) => boolean` | 传输中（`START` / `IN_PROGRESS`） |
| `isStreamTerminal(status)` | `(status?) => boolean` | 终态（`COMPLETED` / `START_COMPLETED` / `ERROR`） |
| `isPlainTextStream(stream)` | `(stream?) => boolean` | 内核内置纯文本流（`customType` 缺省或 `'text'`） |
| `isRichStream(stream)` | `(stream?) => boolean` | 需要宿主接管的富格式流 |

## 事件订阅：`EmKit.onStreamMessage`

### `EmKit.onStreamMessage(handler)`

订阅流式消息更新。分片已经合批，回调频率与 `streamThrottle` 对齐；每次回调携带该消息的最新全文与最新状态。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `handler` | `(msg: EmMessageItem) => void` | 是 | 消息更新回调；`msg.stream` 携带最新流式元信息 |

返回：`() => void` 取消订阅函数，页面卸载时必须调用。

```ts
import { onUnmounted } from 'vue'
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'

// 外部 AI 面板、埋点、语音播报等副作用订阅此事件；
// 聊天页渲染由 store 响应式驱动，不需要在这里改 UI 数据
const off = EmKit.onStreamMessage((msg) => {
  if (msg.stream == null) return
  console.log(msg.conversationId, msg.stream.status, msg.stream.fullText)
})

onUnmounted(() => {
  off()
})
```

订阅语义：

- 首个分片建气泡后回调一次；此后每个合批窗口最多一次；终态分片立即回调一次。
- 终态若由完整消息先到（终态分片丢失），订阅方也会补收到一次终态回调。
- 该订阅**不替代** `EmKit.onMessage`：`onMessage` 仍只承载「完整新消息」语义，流式增量不会走 `onMessage`。
- 未调用取消函数会让回调在页面销毁后继续执行，反复进出聊天页会叠加触发，请始终在 `onUnmounted` 中释放。

## 渲染行为

### 单条气泡

同一 `msgServerId` 的分片始终落在一条消息上，`message.text` 随分片增长。列表 `:key` 使用 `localId`，首片缺少服务端 id 时后续会迁移索引但保持 `localId` 稳定，滚动锚点不会跳。

### 纯文本流（默认）

`em-text-message` 对纯文本流负责三件事：

| 状态 | 表现 |
|---|---|
| `STREAM_START` / `STREAM_IN_PROGRESS` | 气泡尾部追加 `STREAM_CURSOR_CHAR`（`▍`）常亮光标 |
| `STREAM_COMPLETED` / `STREAM_START_COMPLETED` | 光标消失，内容按普通文本渲染 |
| `STREAM_ERROR` | 光标消失，已生成内容保留，尾部追加本地化文案「（内容生成异常）」 |

光标是**静态字符**而非 CSS 动画：App 端渲染层不执行 CSS 动画，静态光标在各端表现一致，也不会带来额外重绘。

长按菜单（复制、引用、删除等）对流式气泡同样可用；流式气泡只是内容会在传输中增长。

### 富格式流与 `#stream-message` 插槽

`em-chat-page` 只对「文本类型 + 富格式流」开放 `#stream-message` 插槽：

| 插槽 | 作用域 | 说明 |
|---|---|---|
| `#stream-message` | `{ message: EmMessageItem }` | `customType` 非 `''` / `'text'` 的文本流；未提供插槽时回落内核纯文本气泡，内容仍随分片增长 |

```vue
<template>
  <view class="page" :class="themeClass">
    <em-chat-page :conversation-id="conversationId" :chat-type="chatType">
      <template #stream-message="{ message }">
        <my-markdown-bubble :message="message" />
      </template>
    </em-chat-page>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CONVERSATION_TYPE, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'
import type { ConversationTypeValue } from '@/uni_modules/easemob-uikit-uni/libs'
import MyMarkdownBubble from '@/components/my-markdown-bubble/my-markdown-bubble.vue'

const { themeClass } = useTheme()
const conversationId = ref('user-b')
const chatType = ref<ConversationTypeValue>(CONVERSATION_TYPE.SINGLE_CHAT)
</script>

<style>
/* 页面根节点撑满 + flex 链：聊天页内部消息区才能正确计算高度 */
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
</style>
```

`#stream-message` 只替换气泡内容，外层头像、昵称行、气泡行与状态图标仍由聊天页渲染。宿主组件内部的长按菜单需要自己接（插槽内容不再触发 `em-text-message` 的 `long-press`）。

## Markdown 接管示例

服务端下发 `customType: 'markdown'` 时，宿主把 `fullText` 交给自己的 markdown 渲染组件。下面是一个最小宿主气泡：先用纯文本渲染，换成任意 markdown 组件即可。

```vue
<!-- components/my-markdown-bubble/my-markdown-bubble.vue -->
<template>
  <view class="markdown-bubble">
    <text class="markdown-bubble__text">{{ rendered }}<text class="markdown-bubble__cursor">{{ cursor }}</text></text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { STREAM_CURSOR_CHAR, isStreamActive } from '@/uni_modules/easemob-uikit-uni/libs'
import type { EmMessageItem } from '@/uni_modules/easemob-uikit-uni/libs'

interface Props {
  message: EmMessageItem
}

const props = defineProps<Props>()

// 展示以 fullText 为准（与 message.text 同值）；deltaText 只用于动画或统计
const rendered = computed(() => props.message.stream?.fullText ?? props.message.text)
// 富格式气泡的光标要宿主自己补：内核只在纯文本流里渲染光标
const cursor = computed(() => (isStreamActive(props.message.stream?.status) ? STREAM_CURSOR_CHAR : ''))
</script>

<style>
.markdown-bubble {
  display: flex;
  flex-direction: column;
  max-width: 480rpx;
  padding: var(--em-spacing-3);
  border-radius: var(--em-bubble-radius);
  background-color: var(--em-bubble-bg-other);
}

.markdown-bubble__text {
  font-size: var(--em-font-size-16);
  line-height: 23px;
  color: var(--em-text-primary);
}
</style>
```

接入真实 markdown 组件时：

- 渲染前做**净化和转义**，见文末安全说明。
- 传输中的样式差异（如代码块未闭合）由渲染组件自行处理，UIKit 不介入。
- 需要长按菜单时，在宿主气泡上自行绑定手势并调用业务逻辑，或自行弹出 `em-action-sheet`。

## 跟随滚动

流式分片只改最后一条消息的内容、不改条数，聊天页对此单独处理：

| 行为 | 说明 |
|---|---|
| 合批跟随 | 分片更新不直接滚底，统一走约 120ms 的合批滚动，避免高频锚点重定位抖动 |
| 上翻暂停 | 用户向上滚动（`scrollTop` 明显变小）即暂停跟随，阅读历史时不会被拽回底部 |
| 恢复跟随 | 回到底部（触底）、主动发送消息、键盘弹起、进入会话时恢复跟随 |
| 首气泡 | 流式首气泡到达时若用户正在上翻，不强行吸底；普通新消息仍保持原有吸底行为 |

这套策略由 `em-chat-page` 内置，宿主无需配置；自定义消息列表实现时可参照「内容增长单独监听 + 用户位置门控」。聊天页完整交互见[聊天页](./PAGES-CHAT.md)。

## Demo 路径

示例工程内置三个不依赖真实模型服务的演示入口：

| 入口 | 位置 | 演示内容 |
|---|---|---|
| AI 演示浮钮 | 聊天页右侧、输入栏上方悬浮的「AI 演示」 | 向当前会话注入模拟流式回复：正常完成 / 异常中断 / 停止当前演示 |
| 流式开关 | 「我的」→「AI 流式消息」分组 | 运行时切换 `enableStreamMessage`，立即观察「逐字上屏」与「一次上屏」的差别 |
| 样式实验室 | 「我的」→「样式实验室」→「AI 流式消息」 | 独立气泡演示，不依赖登录与会话，显示分片数、状态与当前合批间隔 |

模拟器复用真实的 store 与渲染链路，只是数据来源换成了本地定时器；换成服务端下发时，宿主代码不需要改动。示例工程结构见[示例工程](./DEMO.md)。

## 限制

- **只处理文本消息**：只有 `TEXT` 类型且带流式元信息的消息进入本链路；图片、语音、视频、文件、自定义消息的分片不会合并。
- **只收不发**：UIKit 不提供客户端发起流式发送的 API。流式内容由业务服务端经环信 RESTful 下发。
- **内核只渲染纯文本**：`markdown` 等富格式必须由 `#stream-message` 接管；未提供插槽时按纯文本显示，内容仍会增长，但不会解析语法。
- **关闭开关后没有逐字效果**：`enableStreamMessage: false` 时等待完整消息一次上屏，首字延迟等于整段生成时间。
- **历史消息以服务端为准**：流式过程只在内存消息列表中演进；重新拉取历史时按服务端返回的消息与状态渲染，不保证还原每一片的中间态。
- **不属于消息编辑**：流式更新只发生在传输期；终态之后的消息按普通文本消息处理，不支持二次改写内容。

## 安全说明

- **流式内容属于服务端生成内容，按不可信数据处理**。默认纯文本渲染只做文本节点输出，不存在 HTML 注入风险；一旦交给 markdown 渲染器，风险转移给宿主。
- **markdown 渲染必须净化**：禁止渲染原始 HTML / `<script>` / 事件属性；链接只放行 `http` / `https`，并对 `javascript:`、`data:` 等协议做拦截；图片地址走可信域名白名单。
- **不要把模型 API Key 放在客户端**：正确链路是客户端 → 宿主业务服务端 → 模型服务 → 环信 RESTful 下发流式消息 → 客户端 `onStreamMessage` 接收。AppKey 可以放前端，AppSecret 与模型密钥只能放服务端。
- **token 由服务端签发**，客户端只持有当前会话所需 token，不写入代码与仓库。
- **生产环境关闭 payload 日志**：`logPayload: true` 会把消息内容写入日志缓冲，流式全文同样在内；排查完立即关闭。

## 排错

| 现象 | 排查方向 |
|---|---|
| 完全没有逐字效果 | 确认 `enableStreamMessage` 未被设为 `false`；确认服务端确实按流式协议下发，而不是发一条完整文本 |
| 气泡出现多条 | 服务端每个分片的 `msgServerId` 是否稳定一致；同一逻辑消息的分片必须共享同一服务端 id |
| 内容偶尔回退 | 检查服务端 `seq` 是否正确递增、`fullText` 是否为累计全文；内核会丢弃 `seq` 更小的非终态分片 |
| markdown 不生效 | `customType` 是否为 `'markdown'` 等非纯文本值；`#stream-message` 是否挂在 `em-chat-page` 上 |
| 光标不消失 | 服务端是否发送了终态分片（`STREAM_COMPLETED` / `STREAM_START_COMPLETED` / `STREAM_ERROR`）；漏发终态时可依赖完整消息收敛 |

更多跨端现象见[常见问题](./FAQ.md)与[平台能力与差异](./PLATFORM.md)。
