# 聊天与消息组件

这页覆盖聊天页里的 9 个原子组件：输入栏 `em-chat-inputbar`、五类消息气泡（`em-text-message`、`em-image-message`、`em-audio-message`、`em-video-message`、`em-file-message`）、视频全屏播放器 `em-video-preview`、快捷回复条 `em-quick-reply-bar` 与 @ 提及选人弹层 `em-mention-picker`。它们只负责渲染与手势，消息收发、重发、引用状态都由宿主或 `em-chat-page` 管理。

本页组件均符合 easycom 目录约定，可直接写标签；引入方式见 [组件总览与选型](./COMPONENTS.md)。所有组件都支持 `custom-class` / `custom-style` 根节点样式透出，用法见 [样式定制](./GUIDE-STYLING.md)。整页实现见 [聊天页](./PAGES-CHAT.md)。

## em-chat-inputbar

输入栏：文本输入、语音按住说话、emoji 面板、"+" 媒体面板、纸飞机发送键、引用条、快捷回复条与禁用态。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `modelValue` | `string` | 必填 | 草稿内容，配合 `v-model` 使用 |
| `quote` | `EmQuoteInfo \| null` | 必填 | 当前引用消息；`null` 时引用条不渲染 |
| `editing` | `{ preview: string } \| null` | `null` | 编辑态（消息编辑）：非空时输入栏上方展示编辑条（铅笔图标 + "编辑消息" + 原文单行截断），优先于引用条 |
| `features` | `EmInputFeatures` | 工具项全开、`sendOnReturn=true` | 功能集：`voice` / `emoji` / `image` / `camera` / `video` / `file` / `sendOnReturn` |
| `emojis` | `string[]` | 内置 96 个 | emoji 面板字符集 |
| `disabled` | `boolean` | `false` | 禁用态（如全员禁言）：输入、发送、语音、面板全部拦截 |
| `submitting` | `boolean` | `false` | 文本或直发快捷回复提交中：拦截重复 `send` 与快捷回复点选，不影响草稿编辑 |
| `placeholder` | `string` | `''` | 输入框提示文案；空串使用内置"输入消息"文案 |
| `quickReplies` | `EmQuickReply[]` | `[]` | 快捷回复常用语；空数组不渲染，禁用态自动隐藏 |
| `collapseSignal` | `number` | `0` | 外部收起信号：数值变化即收起 emoji/媒体面板并收起键盘 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `update:modelValue` | `value: string` | 草稿变化（输入、点 emoji） |
| `send` | — | 点击纸飞机发送键或键盘回车；草稿全为空白或 `submitting=true` 时不派发 |
| `quote-close` | — | 点击引用条右侧关闭 |
| `edit-close` | — | 点击编辑条右侧关闭（取消消息编辑） |
| `media-select` | `key: string` | 媒体面板点选，key 见 `MEDIA_PANEL_KEY`：`album` / `camera` / `video` / `file` |
| `voice-send` | `path: string, duration: number` | 录音完成；`duration` 单位为秒 |
| `mention-trigger` | — | 草稿变长且以 `@` 结尾时派发，是否进入 @ 选人由宿主门控 |
| `disabled-tap` | — | 禁用态下的任何操作尝试，宿主据此提示 |
| `quick-reply` | `item: EmQuickReply` | 点选快捷回复；填草稿还是直接发送由宿主决定；`submitting=true` 时不派发 |

无插槽。

`EmInputFeatures` 的字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `voice` | `boolean` | 左侧麦克风与按住说话 |
| `emoji` | `boolean` | 表情入口与 emoji 面板 |
| `image` | `boolean` | 媒体面板的"相册"项 |
| `camera` | `boolean` | 媒体面板的"拍摄"项 |
| `video` | `boolean` | 媒体面板的"视频"项 |
| `file` | `boolean` | 媒体面板的"文件"项 |
| `sendOnReturn` | `boolean` | 默认 `true`：回车发送；`false`：生长 textarea、回车换行，封顶 5 行 |

`EmQuoteInfo` 的字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `msgId` | `string` | 被引用消息 id |
| `from` | `string` | 被引用消息发送人 userId |
| `fromName` | `string` | 发送人展示名快照；缺省时引用条回落到 `from` |
| `text` | `string` | 引用时刻的摘要快照 |
| `type` | `EmMessageType` | 被引用消息类型，用于引用条左侧图标 |
| `thumbUrl` | `string` | 被引用图片/视频的缩略图 |

```vue
<template>
  <view class="page" :class="themeClass">
    <scroll-view class="message-list" scroll-y @click="collapseInput">
      <!-- 消息气泡 -->
    </scroll-view>
    <em-chat-inputbar
      v-model="draft"
      :quote="quote"
      :features="inputFeatures"
      :quick-replies="quickReplies"
      :disabled="muted"
      :collapse-signal="collapseSignal"
      @send="onSend"
      @quote-close="quote = null"
      @media-select="onPickMedia"
      @voice-send="onVoiceSend"
      @mention-trigger="openMentionPicker"
      @disabled-tap="toastMuted"
      @quick-reply="onQuickReply"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'
import type { ConversationTypeValue, EmInputFeatures, EmQuoteInfo, EmQuickReply } from '@/uni_modules/easemob-uikit-uni/libs'

const draft = ref('')
const quote = ref<EmQuoteInfo | null>(null)
const muted = ref(false)
const collapseSignal = ref(0)
const quickReplies = ref<EmQuickReply[]>([])
const chatType = 'singleChat' as ConversationTypeValue
const inputFeatures = ref<EmInputFeatures>({
  voice: true,
  emoji: true,
  image: true,
  camera: true,
  video: true,
  file: true,
  sendOnReturn: true
})

function onSend(): void {
  if (draft.value.trim() === '') return
  EmKit.sendText('user-b', chatType, draft.value, quote.value ?? undefined).catch(() => {
    uni.showToast({ title: '发送失败', icon: 'none' })
  })
  draft.value = ''
  quote.value = null
}

function collapseInput(): void {
  collapseSignal.value = collapseSignal.value + 1
}

function onPickMedia(key: string): void {
  console.log('media:', key)
}

function onVoiceSend(path: string, duration: number): void {
  console.log('voice:', path, duration)
}

function openMentionPicker(): void {
  // 群聊中打开 em-mention-picker
}

function toastMuted(): void {
  uni.showToast({ title: '当前会话已禁言', icon: 'none' })
}

function onQuickReply(item: EmQuickReply): void {
  draft.value = item.text ?? item.label
}
</script>
```

**发送键布局**：右侧的发送位与"+"同槽互斥——草稿为空时显示"+"媒体入口，草稿有内容时在同一位换成品牌色纸飞机发送键（对应 `send` 事件）。因此输入栏不再常驻文字发送按钮，省出的宽度给输入框；空草稿也不会出现点了没反应的发送键。草稿只剩空白字符时仍视作空，不显示纸飞机。

**行为与平台**：H5 不渲染语音入口——浏览器端没有录音能力，显示麦克风只会得到"按住 → 不支持 → 退出语音模式"的体验；App 与小程序仍按 `features.voice` 生效。小程序与 H5 使用内置文件选择；App 注册附件能力后显示"文件"项，未注册时隐藏。四项媒体功能全关或当前端均不可用时"+"入口整体隐藏。设备软键盘与面板互斥：打开 emoji 或媒体面板前会先收起键盘，点击输入框聚焦时收起面板；面板高度取 `max(最近一次键盘高度, 280px)`，开过键盘后面板与键盘等高，来回切换不跳变。输入栏用下外边距顶到键盘上方，没有面板时自己承担底部安全区，面板打开时安全区改由面板承担，避免双重间距。emoji 与 @ 都只能追加在草稿末尾（uni 的 `input` 没有光标位置 API）；`@` 的判定是"草稿变长且新值以 `@` 结尾"，删除到 `@` 结尾不会触发。录音手势上滑超过 60px 切为取消文案，松手取消；不足 1 秒按过短提示，不派发 `voice-send`。`disabled` 翻转时组件会主动收起面板、退出语音模式与焦点，避免禁言后还停留在半开状态。`submitting` 只拦截发送与快捷回复，不会清空草稿或禁用编辑。

**行为核心复用**：上述键盘避让、键盘↔面板互斥、录音手势与禁用守卫的单一实现是 `useChatComposer` composable（从 `libs` 导出），本组件与 `em-chat-page` 的 `#input-bar` 整栏自绘插槽消费同一份逻辑。想在 `em-chat-page` 里整栏替换输入栏时优先用 `#input-bar` 插槽（见 [聊天页](./PAGES-CHAT.md)「整栏自绘输入栏」）；完全自研聊天页、只想要这套键盘/面板/录音行为时，可直接 `import { useChatComposer } from '@/uni_modules/easemob-uikit-uni/libs'`。

## em-text-message

文本气泡：@ 片段高亮、流式打字机光标与生成异常提示、消息编辑后的「已编辑」标记。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `message` | `EmMessageItem` | 必填 | 消息项，取 `text`、`self`、`ext` 与 `stream` |
| `mentionContacts` | `MentionContact[]` | `[]` | @ 名字到 userId 的解析表，由宿主按群成员装配 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `long-press` | `message: EmMessageItem` | 长按气泡，宿主据此弹消息菜单 |
| `mention-click` | `userId: string` | 点击 @ 片段；解析表未命中时回落为 `@` 后的原始名字 |

无插槽。

```vue
<em-text-message
  :message="message"
  :mention-contacts="groupMembers"
  @long-press="openMessageMenu"
  @mention-click="openMemberProfile"
/>
```

**行为与平台**：气泡左右由 `message.self` 决定，圆角与配色走 `em-bubble` 类与主题 token。消息 `ext` 里的 @ 列表为空时按纯文本整段渲染；非空时按 @ 名字把文本切成片段，@ 片段套高亮色并可点击，点击时用解析表换成 userId，未命中就把名字原样抛出，与发送端存的名字保持一致。流式纯文本消息（`stream` 且 `customType` 缺省或为 `text`）在传输中显示尾部打字机光标，异常结束时保留已生成内容并在尾部追加"内容生成异常"。光标与异常提示用**常驻子节点 + 切换文本内容**实现，不在模板里增删节点——鸿蒙蒸汽端移除 `text` 的子节点后，父 `text` 的字形会整块不再绘制（气泡保留高度但内容全白）。富格式流式消息由 `em-chat-page` 的 `#stream-message` 插槽接管，回落到本组件时按普通文本展示。

## em-image-message

图片气泡：优先缩略图，按原始宽高比约束展示尺寸。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `message` | `EmMessageItem` | 必填 | 消息项，取 `thumbUrl`、`url`、`width`、`height` |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `preview` | `message: EmMessageItem` | 点击图片预览 |
| `long-press` | `message: EmMessageItem` | 长按气泡，宿主据此弹消息菜单 |

无插槽。

```vue
<em-image-message :message="message" @preview="previewImage" @long-press="openMessageMenu" />
```

**行为与平台**：有 `thumbUrl` 用缩略图，没有才用原图；尺寸按消息里的宽高比等比缩放到 200×200 的框内，缺宽高时按 120×160 显示。`aspectFill` 裁切保证不变形。H5 上长按后浏览器补发的 `click` 会被吞掉，长按弹菜单不会顺带触发预览。预览本身由宿主实现（默认聊天页用系统图片预览），组件只派发事件。

## em-audio-message

语音气泡：宽度随时长阶梯增长，点击播放/停止，播放中显示跳动波形。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `message` | `EmMessageItem` | 必填 | 消息项，取 `url`、`duration`、`self` |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `long-press` | `message: EmMessageItem` | 长按气泡，宿主据此弹消息菜单 |

无插槽。

```vue
<em-audio-message :message="message" @long-press="openMessageMenu" />
```

**行为与平台**：气泡宽度 = 时长（秒）× 6px，夹在 72–240px 之间，时长四舍五入后显示在气泡右侧。未播放时显示播放三角，播放中换成三根波柱；波柱高度由 JS 定时器逐帧驱动（4 帧循环、180ms/帧），因为蒸汽端不跑 CSS 关键帧，这样五端动作一致。再次点击停止播放；播放互斥在平台层的 `playAudio` 内处理——播新消息会先停旧消息，旧消息通过回调复位波形。组件卸载时停掉定时器，播放中还会主动停止音频，离开聊天页不会留后台声音。

## em-video-message

视频气泡：封面 + 时长，点击打开全屏播放器。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `message` | `EmMessageItem` | 必填 | 消息项，取 `thumbUrl`、`url`、`duration`、`width`、`height` |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `preview` | `message: EmMessageItem` | 点击播放区；视频 URL 为空时不派发 |
| `long-press` | `message: EmMessageItem` | 长按气泡，宿主据此弹消息菜单 |

无插槽。

```vue
<em-video-message :message="message" @preview="playVideo" @long-press="openMessageMenu" />
```

**行为与平台**：播放入口在 App、H5、微信小程序一致显示；点击派发 `preview`，默认聊天页用内置的 `em-video-preview` 全屏播放，宿主也可以接自己的播放器或业务路由。尺寸按消息宽高比等比缩放到 240×240 内，没有宽高元数据时按 16:9 显示，避免加载后撑高列表。时长格式为 `分:秒`。H5 上长按补发的 `click` 会被吞掉，不会同时打开播放器与长按菜单。

## em-video-preview

全屏视频播放器：原生 `video` 组件 + 关闭键 + 加载失败提示。聊天页点击视频消息时默认打开它，宿主也可以单独复用。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `visible` | `boolean` | 必填 | 是否展示（`v-model:visible` 形态） |
| `src` | `string` | 必填 | 视频 URL |
| `poster` | `string` | `''` | 封面图 URL，空串时不显示封面 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `update:visible` | `boolean` | 关闭时派发 `false` |

无插槽。

```vue
<em-video-preview v-model:visible="videoVisible" :src="videoUrl" :poster="videoPoster" />
```

**行为与平台**：容器固定铺满窗口并使用黑底，顶部工具条里的关闭键按安全区顶部下移，避免被状态栏/刘海遮挡；视频区在工具条下方吃满剩余高度，`video` 走各端原生播放控件（播放/暂停、进度拖动、全屏）。App 端会先把视频下载到本地再播放并显示下载进度（大文件需等待整包下载）——EaseMob 的 chatfiles 直链不支持 Range，iOS AVPlayer 直接远程播放会一直转圈；H5 与微信小程序直接播放远程 URL。App 端不使用原生 `autoplay`，而是在组件挂载后显式起播并等待 `play` 事件，避免 iOS 上「进度条在走、画面停在首帧」。聊天页打开前会停掉正在播放的语音；关闭或组件卸载时中止未完成的下载、移除 `video` 节点并释放原生播放器。加载失败（地址失效、编码不支持、网络异常）显示「视频加载失败」提示并保留关闭键。

## em-file-message

文件气泡：按扩展名取图标与底色，显示文件名与大小。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `message` | `EmMessageItem` | 必填 | 消息项，取 `fileName`、`fileSize`、`self` |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `download` | `message: EmMessageItem` | 点击文件卡；仅在当前平台支持文件打开/下载时派发 |
| `long-press` | `message: EmMessageItem` | 长按气泡，宿主据此弹消息菜单 |

无插槽。

```vue
<em-file-message :message="message" @download="downloadFile" @long-press="openMessageMenu" />
```

**行为与平台**：扩展名归类决定图标与图标底色，覆盖 PDF、Excel、Word、PPT、Markdown、图片、视频、音频，其余归为通用文件；文件名缺失时显示"文件"文案。大小按 B / KB / MB 三档格式化，`fileSize` 为 0 时不显示大小行。当前版本文件打开/下载尚未在任一端接入，点击不会派发 `download`，文件卡表现为纯展示；宿主如需接管，在自己的气泡实现里处理点击即可。H5 长按补发的 `click` 同样被吞掉。

## em-quick-reply-bar

快捷回复条：常用语胶囊横向滚动，点选后把选择交给宿主。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `items` | `EmQuickReply[]` | 必填 | 常用语列表，`label` 用于展示 |
| `disabled` | `boolean` | `false` | 禁用点选，提交中等场景可拦截重复 `select` |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `select` | `item: EmQuickReply` | 点选某条常用语 |

无插槽。

```vue
<em-quick-reply-bar :items="quickReplies" @select="onSelect" />
```

**行为与平台**：胶囊文案取 `label`，点击后派发整条数据；`text` 字段由宿主取用（`label` 短、`text` 长时分开配），组件不决定是"填入草稿"还是"直接发送"。横向滚动隐藏滚动条，空数组时不渲染内容。`em-chat-inputbar` 已内置本组件，并会在禁用态自动隐藏；只有在自己搭输入区时才需要单独使用。

## em-mention-picker

@ 提及选人弹层：搜索框 + 成员列表，选中后抛出结果并关闭。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `show` | `boolean` | 必填 | 弹层显隐，配合 `v-model:show` 使用 |
| `contacts` | `MentionContact[]` | 必填 | 候选成员，`userId` / `name` / `avatar` 由宿主装配 |
| `keyword` | `string` | `''` | `@` 之后已输入的字符，同步进搜索框；外部变化会覆盖框内文本 |
| `title` | `string` | `''` | 自定义标题；空串使用 i18n 的"选择联系人" |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `update:show` | `value: boolean` | 关闭时派发 `false` |
| `select` | `contact: MentionContact` | 选中某个成员，随后自动请求关闭 |

无插槽。

```vue
<template>
  <em-mention-picker
    v-model:show="pickerVisible"
    :contacts="groupMembers"
    :keyword="mentionKeyword"
    @select="onMentionSelect"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { MentionContact } from '@/uni_modules/easemob-uikit-uni/libs'

const pickerVisible = ref(false)
const mentionKeyword = ref('')

function onMentionSelect(contact: MentionContact): void {
  // 把 @展示名 + 空格追加到草稿，并记录 userId 进 em_at_list
}
</script>
```

**行为与平台**：弹层是底部形态，高度取窗口高的 60%（打开时刻的快照，弹层存续期间不跟随旋转）。搜索同时匹配展示名与 `userId`，空结果用 `em-empty` 显示"未找到联系人"。选中会先派发 `select` 再派发 `update:show(false)`，宿主只需处理选择结果；清除、点关闭、点遮罩三条关闭路径都只是改 `show`，组件在 `show` 变 `false` 时统一清空搜索框，重开不会残留上次关键字。成员行在展示名与原 `userId` 不同时会多显示一行 userId（群名片与账号不同的场景）。

## em-pinned-bar

置顶消息条：折叠态显示最新一条置顶预览，多条时点击计数下拉展开完整列表（最大高度 240px 内滚动）。纯展示组件，数据与动作全部交回 `em-chat-page`。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `rows` | `EmPinnedRow[]` | 必填 | 置顶行（`em-chat-page` 预计算预览文本，按置顶时间倒序，`rows[0]` 为最新置顶） |
| `expanded` | `boolean` | `false` | 展开态（多条下拉列表） |
| `customClass` / `customStyle` | `string` | `''` | 宿主自定义类 / 内联样式 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `toggle-expand` | `expanded: boolean` | 折叠/展开切换 |
| `locate` | `messageId: string` | 点击置顶行定位到原消息 |
| `unpin` | `row: EmPinnedRow` | 点击行尾取消置顶 |

无插槽。在 `em-chat-page` 中默认渲染于群公告条与消息列表之间；宿主提供 `#pinned-bar` 插槽即可整栏接管（作用域：`rows` / `expanded` / `toggle-expand` / `locate` / `unpin`）。

```vue
<em-pinned-bar
  :rows="pinnedRows"
  :expanded="expanded"
  @toggle-expand="expanded = $event"
  @locate="locateMessage"
  @unpin="unpinMessage"
/>
```

## 页面组件：em-chat-page

聊天整页：消息列表（含时间分隔、失败重发、已读回执、正在输入）、五种气泡与自定义消息、输入栏、引用/撤回/编辑/置顶、@ 提及、历史加载与键盘避让。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `conversationId` | `string` | 必填 | 会话 id（单聊对方 userId，群聊 groupId） |
| `chatType` | `ConversationTypeValue` | 必填 | 会话类型，决定单聊/群聊分支 |
| `avatarShape` | `EmAvatarShape` | `'circle'` | 头像形状，透传给 `em-avatar` |
| `showMemberCount` | `boolean` | `true` | 群聊标题区成员数副标题显隐 |
| `senderNameMode` | `EmSenderNameMode` | `'always'` | 群聊气泡上方发送者昵称行模式 |
| `showAnnouncement` | `boolean` | `true` | 群公告条显隐 |
| `enableMention` | `boolean` | `true` | @ 提及链路开关 |
| `title` | `string` | `''` | 导航栏标题覆盖；空串走昵称链 |
| `showAction` | `boolean` | `true` | 右上角详情入口显隐 |
| `autoBack` | `boolean` | `true` | 点击返回是否由组件执行 `uni.navigateBack` |
| `showConnectionBanner` | `boolean` | `true` | 顶部连接状态条显隐 |
| `quickReplies` | `EmQuickReply[]` | `[]` | 快捷回复常用语 |
| `quickReplyMode` | `EmQuickReplyMode` | `'fill'` | 快捷回复行为：填草稿或直接发送 |
| `extraMessageMenus` | `EmMessageMenuExtra[]` | `[]` | 长按菜单追加的业务动作 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `back` | — | 返回上一页 |
| `open-info` | `conversationId: string` | 点击右上角详情入口 |
| `send` | `message: EmMessageItem` | 消息发送成功后通知宿主 |
| `recall` | `message: EmMessageItem` | 撤回成功 |
| `delete` | `message: EmMessageItem` | 删除消息 |
| `mention-click` | `userId: string` | 气泡内 @ 片段点击 |
| `message-menu` | `key: string, message: EmMessageItem` | 命中 `extraMessageMenus` 里的业务动作 |

| 插槽 | 作用域 | 说明 |
|---|---|---|
| `banner` | — | 导航栏与群公告条之间的固定业务区（订单条、病例摘要条等），不随消息滚动 |
| `pinned-bar` | `rows: EmPinnedRow[]`、`expanded: boolean`、`toggle-expand(expanded)`、`locate(messageId)`、`unpin(row)` | 置顶消息条整体接管（默认渲染 `em-pinned-bar`） |
| `empty` | — | 首次历史请求成功且消息为空时显示的内容 |
| `stream-message` | `message: EmMessageItem` | 富格式流式消息整条接管 |
| `custom-message` | `message: EmMessageItem` | 自定义消息整卡渲染 |
| `input-toolbar` | — | 输入栏上方的业务入口区 |

完整契约、宿主接线与行为边界见 [聊天页](./PAGES-CHAT.md)，本页不重复。

## 相关文档

- 上一页：[会话与导航组件](./COMPONENTS-CONVERSATION.md)
- 下一页：[联系人与群组组件](./COMPONENTS-CONTACT.md)
- 消息模型与扩展协议：[消息与扩展协议](./MESSAGING.md)
- 流式消息：[AI 流式消息](./AI-STREAM.md)
- 类型与常量：[类型与常量](./API-TYPES.md)
