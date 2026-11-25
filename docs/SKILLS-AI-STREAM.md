<!-- Generated from skills/em-host-ai-stream/SKILL.md by scripts/sync-skills-docs.mjs. Do not edit directly. -->

# AI 流式消息（Stream Message）

> 基线：UIKit `1.0.5`。数据链路与纯文本渲染**内置，零配置可用**；markdown 等富格式由宿主插槽接管。
> 前置：已完成 `em-host-integration` 的初始化与登录。

## 1. 数据流（先理解职责）

```text
业务服务端 → 调模型 → 环信 RESTful 流式消息接口 → SDK onStreamMessage 分片
                                                        │
                                      UIKit 按 msgServerId 合并进同一条 TEXT 气泡
                                                        │
                                      store 响应式更新 → em-chat-page 自动滚动/渲染
```

- **客户端只收不发**：没有「客户端发送流式消息」的 API，也不要在前端调模型。
- 模型 API Key 只能放服务端；前端拿到的只是环信消息。
- 流式消息在 UIKit 里就是一条 TEXT 消息，`message.stream` 携带过程元信息，`message.text` 恒为当前累计全文。

## 2. 开箱即用的行为

| 能力 | 表现 |
|---|---|
| 分片合并 | 同一 `msgServerId` 的分片幂等合并进同一条气泡，不产生多条 |
| 丢片补偿 | 离线/断连错过分片，随后到达的完整消息覆盖未完成副本并收敛终态 |
| 纯文本状态 | 传输中尾部打字机光标 `▍` → 终态变普通文本；`STREAM_ERROR` 尾部追加「内容生成异常」 |
| 性能 | 分片按 `streamThrottle` 合批写 store（默认 50ms，≤20 次重绘/秒）；终态立即落盘 |
| 滚动 | 聊天页跟随滚动独立节流（120ms），用户上翻时暂停 |
| 历史 | 历史中的流式终态消息同样带 `stream`，按终态渲染 |

这些都不需要宿主写代码。

## 3. 配置

```ts
EmKit.init({
  appkey: 'YOUR_APPKEY',
  enableStreamMessage: true,   // 默认 true；false = 忽略分片，等完整消息一次性上屏
  streamThrottle: 50           // 合批间隔 ms；0 = 逐片立即写（调试/高刷演示）
})
```

运行时切换：

```ts
import { setConfig } from '@/uni_modules/easemob-uikit-uni/libs'

setConfig({ enableStreamMessage: false })
```

- 弱网/低端机可适当加大 `streamThrottle`（如 80–120）。
- 关闭流式后，服务端仍可下发流式消息，但客户端只在完整消息到达时上屏。

## 4. 纯文本：不用写渲染代码

服务端下发的流式消息 `customType` 缺省或为 `'text'` 时，UIKit 内置气泡直接渲染：

- 传输中显示光标；
- 完成/单分片完成收敛为普通文本；
- 错误状态追加异常提示。

宿主不需要监听、拼接或手动滚动。

## 5. 富格式（markdown 等）：用 `#stream-message`

`customType` 不是 `'text'`（如 `'markdown'`）时，`em-chat-page` 会走 `#stream-message` 插槽；**不提供插槽时纯文本兜底**（内容仍随分片增长，只是不渲染格式）。

```vue
<em-chat-page :conversation-id="id" chat-type="singleChat">
  <template #stream-message="{ message }">
    <my-markdown-bubble :message="message" />
  </template>
</em-chat-page>
```

宿主组件里：

```ts
import { computed } from 'vue'
import type { EmMessageItem } from '@/uni_modules/easemob-uikit-uni/libs'
import { STREAM_MESSAGE_STATUS, isStreamActive } from '@/uni_modules/easemob-uikit-uni/libs'

const props = defineProps<{ message: EmMessageItem }>()

const text = computed(() => props.message.stream?.fullText ?? props.message.text)
const streaming = computed(() => isStreamActive(props.message.stream?.status))
const failed = computed(() => props.message.stream?.status === STREAM_MESSAGE_STATUS.ERROR)
```

渲染建议：

- 用 `stream.fullText`（与 `message.text` 同值）作为唯一展示源，不要自己累加 `deltaText`。
- markdown 解析放在宿主侧；分片已合批，不需要再做节流。
- 流式过程中避免每次分片都重新挂载大组件（会闪烁）；只更新文本节点。
- 保持与纯文本气泡一致的宽度/圆角/内边距，避免流式结束瞬间跳变。

## 6. 外部面板订阅（可选）

需要在聊天页之外同步展示生成过程（如侧边 AI 面板、埋点）时：

```ts
import { onUnmounted } from 'vue'

const off = EmKit.onStreamMessage((message) => {
  console.log(message.conversationId, message.stream?.status, message.stream?.fullText)
})

// 页面卸载必须取消订阅，否则回调泄漏
onUnmounted(() => off())
```

- 回调是**合批后**的，不是每个原始分片一次。
- `message.stream` 为最新快照；展示以 `fullText` 为准。
- `off()` 是必需的清理；重复订阅会收到多份回调。

## 7. `message.stream` 字段

| 字段 | 说明 |
|---|---|
| `fullText` | 截至当前分片的累计全文（与 `message.text` 同值） |
| `deltaText` | 当前分片增量（动画/统计用；展示以 `fullText` 为准） |
| `status` | `STREAM_START` / `STREAM_IN_PROGRESS` / `STREAM_COMPLETED` / `STREAM_START_COMPLETED` / `STREAM_ERROR` |
| `customType` | 业务自定义流类型，如 `'text'` / `'markdown'` |
| `seq` | 分片序号（服务端排序后） |
| `errorType` | 错误码，0 = 无 |
| `finishReason` | 服务端结束原因（SDK 提供时透传） |

状态常量从 `STREAM_MESSAGE_STATUS` 取，不要硬编码字符串：

```ts
import { STREAM_MESSAGE_STATUS, isStreamActive, isStreamTerminal, isPlainTextStream, isRichStream } from '@/uni_modules/easemob-uikit-uni/libs'
```

## 8. 服务端侧要点（交接给后端）

- 通过环信 RESTful 流式消息接口下发（接口路径/字段以环信官方文档为准），不要自己用普通消息模拟分片。
- 同一轮生成使用稳定的消息标识，客户端靠它合并；变更标识会产生多条气泡。
- `customType` 决定客户端走内置纯文本还是宿主富文本插槽。
- 结束时必须发终态分片（完成/异常），否则气泡会停在光标状态。
- 服务端要能处理超时、限流、模型错误，并下发终态错误。

## 9. Demo 参考

- 聊天页「AI 演示」悬浮入口：向当前会话注入 mock 流式回复（完成/异常/停止）；
- 「我的」→ AI 流式消息：运行时开关 `enableStreamMessage`；
- 样式实验室 → AI 流式消息：不登录也能看的流式气泡演示。

这些是 demo 侧 mock，生产必须走服务端。

## 10. 验收清单

- [ ] 服务端下发分片时，聊天页只有一条气泡，内容持续增长
- [ ] 传输中有光标，结束后光标消失、内容保持
- [ ] 断网/切后台再回来，内容不重复、不残留半截
- [ ] `STREAM_ERROR` 有异常提示
- [ ] markdown 插槽生效；不提供插槽时有纯文本兜底
- [ ] 长回复滚动跟随，用户上翻时不被强制拉回
- [ ] 页面卸载后 `onStreamMessage` 回调不再触发

## 11. 常见坑

| 现象 | 根因 | 修复 |
|---|---|---|
| 每条分片一条气泡 | 服务端每片用了不同消息标识 | 同一轮生成复用标识 |
| 内容不增长 | 关了 `enableStreamMessage` 且完整消息未到 | 打开开关或检查服务端终态 |
| 一直显示光标 | 服务端没发终态分片 | 补完成/异常分片 |
| markdown 显示成源码 | `customType` 是 `text`/缺省 | 服务端改为 `markdown` 并提供插槽 |
| 插槽不生效 | `customType` 仍是 `text` | 内置纯文本不进入富格式插槽 |
| 页面卡顿 | `streamThrottle: 0` 或宿主每片重渲染整页 | 恢复 50ms，宿主只更新文本节点 |
| 退出页面仍回调 | 没调 `off()` | `onUnmounted` 取消订阅 |
| 前端出现模型 Key | 直接在客户端调模型 | 全部移到业务服务端 |
