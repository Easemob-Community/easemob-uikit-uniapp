# 组件公共类型

## `EmActionSheetAction`

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | `string` | 动作 key |
| `text` | `string` | 展示文案 |
| `icon` | `string` | 图标名（可选） |
| `danger` | `boolean` | 危险态（红字） |
| `disabled` | `boolean` | 禁用 |

## `EmMessageMenuExtra`

继承 `EmActionSheetAction`，新增 `types?: EmMessageType[]`：只在指定消息类型上显示；`NOTICE` 恒不显示。

## `EmQuickReply`

| 字段 | 类型 | 说明 |
|---|---|---|
| `label` | `string` | 芯片文案 |
| `text` | `string` | 填入/发送的文本，缺省用 `label` |

`EmQuickReplyMode = 'fill' | 'send'`。

## `EmWatermarkOptions`

页面级组件 `watermark` prop 的对象形态（传字符串等价于 `{ text }`）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `text` | `string` | 水印文案；空串不显示 |
| `fontSize` | `number` | 字号 px，默认 12 |
| `opacity` | `number` | 不透明度，默认 0.08 |
| `rotate` | `number` | 旋转角度，默认 -20 |
| `color` | `string` | 文字颜色，默认 `var(--em-text-primary)` |

## `EmChatInputBarScope`

`em-chat-page` `#input-bar` 整栏自绘插槽的作用域契约，用法见[聊天页](./PAGES-CHAT.md)。

| 字段 | 类型 | 说明 |
|---|---|---|
| `draft` / `setDraft(v)` | `string` / 函数 | 草稿值与写入 |
| `quote` / `closeQuote()` | `EmQuoteInfo \| null` / 函数 | 引用条数据与关闭 |
| `disabled` / `notifyDisabledTap()` | `boolean` / 函数 | 禁用态与操作上报 |
| `placeholder` | `string` | 建议提示文案 |
| `features` | `EmInputFeatures` | 功能集开关 |
| `emojis` | `string[]` | emoji 字符集 |
| `quickReplies` | `EmQuickReply[]` | 快捷回复常用语 |
| `keyboardLift` | `number` | 上推口径键盘高度 |
| `panel` / `togglePanel(kind)` / `collapsePanel()` | `EmChatComposerPanel` / 函数 | 底部面板状态与开关 |
| `panelStyle` | `string` | 自绘面板根节点内联样式 |
| `inputFocus` / `closeKeyboard()` / `notifyInputFocus()` / `notifyInputBlur()` | `boolean` / 函数 | 焦点与键盘事件 |
| `voiceMode` / `recording` / `willCancel` / `toggleVoiceMode()` | `boolean` / 函数 | 语音状态与切换 |
| `onVoiceTouchStart(e)` / `onVoiceTouchMove(e)` / `onVoiceTouchEnd()` / `onVoiceTouchCancel()` | 函数 | 录音手势事件 |
| `send()` | 函数 | 发送当前草稿 |
| `selectMedia(key)` | 函数 | 媒体动作 |
| `selectQuickReply(item)` | 函数 | 快捷回复点选 |

相关类型：`EmChatComposerPanel = 'none' | 'emoji' | 'media'`、`EmChatComposerPanelKind = 'emoji' | 'media'`、`EmChatComposerTouchEvent = { touches: Array<{ clientY: number }> }`。行为核心 [`useChatComposer(options)`](./API-COMPOSABLES.md#聊天输入行为) 供完全自研聊天页复用同一套逻辑。

## 其他组件类型

- `EmSelectContactItem`：`userId` / `name` / `avatar`，供 `em-select-contact` 使用。
- `MentionContact`：`userId` / `name` / `avatar?`，供 `em-mention-picker` 与 @ 高亮解析使用。
- `EmContactGroup`：拼音分组结果 `key`（A-Z/#）、`contacts`。
- `EmPinyinResult`：拼音、首字母与首字符分组信息；适配器注册见[工具函数](./API-UTILS.md#只读数据与展示)。
