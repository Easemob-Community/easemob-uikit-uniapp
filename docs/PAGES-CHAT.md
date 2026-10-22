# 聊天页（em-chat-page）

`em-chat-page` 同时承载单聊与群聊会话：进入会话、拉历史、发送各类消息、引用/撤回/重发、已读回执与输入状态、@ 提及、群公告、流式消息跟随滚动都由组件自身完成。宿主只需要把 `conversationId` 与 `chatType` 传进来，再按业务需要接管右上角详情入口、消息长按的业务动作和几个固定插槽。

页面组件位于 `uni_modules/easemob-uikit-uni/components/pages/em-chat-page/em-chat-page.vue`，在宿主工程中由聊天页面壳承载（例如 `sub-im/pages/chat/chat.uvue`）。它不持有路由，也不感知宿主页面栈。

## 页面位置与接入方式

- 页面组件在 `components/pages/` 下，需要 `pages.json` 的 custom easycom 规则才能以标签形式使用（见 [快速开始](./QUICKSTART.md) 3.1 节）。
- 组件自带 `em-nav-bar`（含状态栏与小程序胶囊避让），路由必须设 `navigationStyle: "custom"`，App 端同时设 `app-plus.titleNView: false`。
- 页面壳根节点 `height: 100%` 且 flex 链完整；组件内消息区是 `flex: 1` + `height: 0` 的 `scroll-view`，根节点没高度时输入栏会被挤出视口。
- 页面壳根节点绑定 `themeClass`；页面壳用 `v-if="conversationId !== ''"` 保护，避免用空会话 ID 初始化组件。

## 能力

### 消息收发与历史

- 进入即并行执行 `EmKit.enterConversation` 与首次 `EmKit.loadHistory`；已有缓存时先渲染缓存并直接贴底，不等历史回包。
- 内置文本、图片、语音、视频、文件、自定义消息的发送与渲染；未识别的消息类型显示默认提示气泡，可交给 `#custom-message` 接管。
- 首次历史未回包时展示骨架；历史失败时显示「点击重试」空态，已有缓存消息时改为顶部重试行，不遮挡消息。
- 点击消息区顶部的「加载更早消息」加载更早历史，加载前记录首条消息锚点，加载后回位，避免视口跳动；没有更多时显示「没有更多历史消息」。
- 相邻消息间隔超过 `uiConfig.timeDividerInterval`（默认 5 分钟）插入时间分隔条，首条消息必显。
- 消息发送成功后以 `send` 事件透出；文本与直发快捷回复提交中会拦截重复发送。失败消息显示红色状态图标，点击即调用 `EmKit.resendMessage` 原地重发，同一 `localId` 重发完成前不可重复点击，失败后仍可重试。
- 输入草稿按会话保存（`uiConfig.enableDraft` 默认开启）；离开页面时清空当前会话的服务端未读。

### 引用、撤回与长按菜单

- 长按消息打开菜单：复制（仅文本）、引用、撤回、删除。菜单项与顺序由 `uiConfig.messageMenuKeys` 决定。
- 引用后输入栏上方出现引用条，发送的文本消息同时写入 `ext.msgQuote` 与兼容字段 `ext.emQuote`；气泡下方生成引用卡，点击定位原消息并闪烁高亮，原消息未加载或已删除时 toast 提示。
- 撤回仅对「自己发送、状态为已发送、且在撤回窗口内」的消息出现；窗口由 `uiConfig.recallTimeLimit` 控制，默认 2 分钟。执行撤回时会再次检查时间窗，并拦截重复提交；成功后以 `recall` 事件透出，不额外弹确认框。
- 复制等待系统剪贴板返回结果，成功与失败分别提示；空文本按失败处理。
- 删除先弹确认框。有服务端 ID 的消息先删漫游再删本地，本地消息仅本地删除；失败保留气泡并提示，成功后才以 `delete` 事件透出。删除后会话摘要与时间同步校正。
- 业务动作可经 `extraMessageMenus` 追加在内置项之后（删除项保持末位），命中时以 `message-menu` 把 key 与消息项交给宿主。

### 已读回执与输入状态

- 单聊已读回执：只对「最新一条自己发送的已发送消息」显示空心圆（未读）/对勾（已读），其余自己消息不显示已读态。已读回执默认开启，可经 `EmKit.init({ enableReadReceipt: false })` 关闭。
- 单聊输入状态：草稿非空时按 `uiConfig.typingThrottle`（默认 5 秒）向对方发送 typing 信号；收到对方信号时导航栏副标题显示「对方正在输入…」，展示超时由 `uiConfig.typingTimeout` 控制（默认 5 秒）。
- 群聊不显示已读回执，也不发送/接收 typing 信号；群聊导航栏副标题用于成员数。

### @ 提及与群公告

- 群聊 + `enableMention=true` 时，在草稿尾部输入 `@` 会打开成员选择面板；选中后把 `@名字` 追加到草稿并记录成员。
- 发送前会过滤掉文本中已不存在的 @ 提及，只把仍然有效的成员 userId 写入 `ext.em_at_list`；单聊不挂该字段。
- 气泡中的 @ 片段可点击，组件以 `mention-click` 原样透出 userId，默认不做跳转。
- 群聊 + `showAnnouncement=true` 且群公告非空时，消息区上方显示公告条（标题 + 单行摘要）；估算超出一行或包含换行时显示展开按钮，点开为居中弹层展示全文。

### 流式消息与滚动

- SDK 流式消息按 `uiConfig.streamThrottle` 合批写入，避免高频分片逐条重绘。
- 纯文本流式消息（`customType` 为空或 `text`）由内置气泡渲染打字机光标与终态；富格式流（如 `customType='markdown'`）走 `#stream-message` 插槽，未提供插槽时回落为纯文本气泡，内容仍随分片增长。
- 用户上翻阅读时暂停跟随滚动，回到底部或主动发送时恢复；分片增长只在用户贴近底部时跟随。
- 软键盘弹起时自动滚到底部；点击消息区任意位置收起输入栏的 emoji/媒体面板与键盘；发送、进入会话、普通新消息都会贴底。

### 输入栏

- 输入栏支持语音、Emoji、相册、拍照、视频、文件；单项可经 `uiConfig.inputFeatures` 关闭，Emoji 字符集可经 `uiConfig.emojiList` 替换。
- 右侧是「+」与发送键的同槽互斥：草稿为空显示「+」媒体入口，草稿有内容时换成品牌色纸飞机发送键，不再常驻文字发送按钮，输入框因此更宽。
- `inputFeatures.sendOnReturn`（默认 `true`）对齐微信「回车键发送消息」：`true` = 回车发送（iOS 上输入框可随粘贴内容生长）；`false` = 换行输入模式，输入框随打字生长（封顶 5 行，超出内部滚动），回车换行、发送走输入栏右侧的纸飞机发送键。Android 系统限制其 textarea 键盘右下角恒为换行，故回车发送档在 Android 保持单行输入。
- `quickReplies` 在输入栏上方渲染常用语胶囊：`quickReplyMode='fill'`（默认）整句替换草稿，`'send'` 直接发送（不带引用与 @）。
- 全员禁言且当前用户不是群主/管理员时，输入栏进入禁用态，输入框提示为「全员禁言中」；尝试发送/工具/语音时 toast「全员禁言中，仅群主和管理员可发言」。
- 引用条、@ 选择面板、媒体面板与键盘之间的切换由组件自身处理；切换 `conversationId` 时清空引用与 @ 状态。
- 对整个输入栏的结构/样式不满意时，可用 `#input-bar` 插槽整栏自绘：键盘避让、面板互斥、录音手势、禁言、@ 提及、草稿持久化等行为由库内经插槽作用域（scope）契约保持运作，见下文「整栏自绘输入栏」。

## 最小用法

```vue
<template>
  <view class="page" :class="themeClass">
    <em-chat-page
      v-if="conversationId !== ''"
      :conversation-id="conversationId"
      :chat-type="chatType"
      @open-info="onOpenInfo"
    />
  </view>
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { EmKit, CONVERSATION_TYPE, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'
import type { ConversationTypeValue } from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass } = useTheme()
const conversationId = ref('')
const chatType = ref<ConversationTypeValue>(CONVERSATION_TYPE.SINGLE_CHAT)

onLoad((query) => {
  if (EmKit.state.userId === '') {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  conversationId.value = (query?.['conversationId'] ?? '') as string
  chatType.value = query?.['chatType'] === CONVERSATION_TYPE.GROUP_CHAT
    ? CONVERSATION_TYPE.GROUP_CHAT
    : CONVERSATION_TYPE.SINGLE_CHAT
})

function onOpenInfo(id: string) {
  uni.navigateTo({ url: `/pages/chat-info/chat-info?conversationId=${id}&chatType=${chatType.value}` })
}
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';

.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--em-chat-bg);
}
</style>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `conversationId` | `string` | 必填 | 单聊为对方 userId，群聊为 groupId |
| `chatType` | `ConversationTypeValue` | 必填 | `CONVERSATION_TYPE.SINGLE_CHAT` 或 `CONVERSATION_TYPE.GROUP_CHAT`，决定已读回执、typing、@ 提及、公告等链路 |
| `avatarShape` | `EmAvatarShape` | `'circle'` | 消息头像形状，`'circle'` / `'square'` |
| `showMemberCount` | `boolean` | `true` | 群聊导航栏副标题显示成员数；单聊该位置留给 typing 状态，两者互斥 |
| `senderNameMode` | `EmSenderNameMode` | `'always'` | 群聊气泡上方是否显示发送者昵称；`'hidden'` 不显示 |
| `showAnnouncement` | `boolean` | `true` | 群公告条显隐（仅群聊且群公告非空时生效） |
| `enableMention` | `boolean` | `true` | 群聊 @ 提及链路开关；关闭后输入 `@` 不弹成员面板 |
| `title` | `string` | `''` | 导航栏标题覆盖，如「在线客服」；空串时单聊用昵称 > userId，群聊用群名 > groupId |
| `showAction` | `boolean` | `true` | 右上角详情入口显隐；关闭后不再触发 `open-info`，详情页完全由宿主接管 |
| `autoBack` | `boolean` | `true` | 点导航栏返回时是否由组件执行 `uni.navigateBack({ delta: 1 })`；`false` 时只发 `back` |
| `showConnectionBanner` | `boolean` | `true` | 顶部连接状态条显隐 |
| `quickReplies` | `EmQuickReply[]` | `[]` | 输入栏上方常用语，空数组不渲染；条目为 `{ label, text? }` |
| `quickReplyMode` | `EmQuickReplyMode` | `'fill'` | `'fill'` 替换草稿（用户可编辑后再发）；`'send'` 直接发送 |
| `extraMessageMenus` | `EmMessageMenuExtra[]` | `[]` | 长按菜单追加的业务动作，可带 `types` 限定消息类型；内置 key（copy/quote/recall/delete）不可覆盖 |

## Events

| 事件 | 载荷 | 说明 |
|---|---|---|
| `back` | 无 | 点击导航栏返回。`autoBack=true` 时组件随后自行 `navigateBack`；`false` 时由宿主决定退场或拦截 |
| `open-info` | `conversationId: string` | 点击右上角详情入口，宿主跳聊天信息页 |
| `send` | `message: EmMessageItem` | 文本、图片、语音、视频、文件、快捷回复发送成功后透出 |
| `recall` | `message: EmMessageItem` | 撤回成功后透出 |
| `delete` | `message: EmMessageItem` | 本地删除后透出 |
| `mention-click` | `userId: string` | 点击气泡中的 @ 片段，默认无行为，可用于跳成员资料 |
| `message-menu` | `key: string`, `message: EmMessageItem` | `extraMessageMenus` 中的业务动作被选中；业务动作由宿主执行 |

## Slots

| 插槽 | 作用域 | 说明 |
|---|---|---|
| `banner` | 无 | 导航栏与群公告条之间的固定区，不随消息滚动。用于订单条、病例摘要条、商品条等业务横幅，样式由宿主自管 |
| `empty` | 无 | 消息空态。仅在首次历史请求成功、列表为空且无历史错误时展示，默认是「暂无消息」 |
| `stream-message` | `message: EmMessageItem` | 富格式流式消息（`stream.customType` 非空且不是 `text`）。未提供时回落为纯文本气泡 |
| `custom-message` | `message: EmMessageItem` | 自定义消息（`type='custom'`，按 `customEvent` 区分）与未识别消息类型。默认文案为「[自定义消息]」/「[暂不支持的消息]」 |
| `input-toolbar` | 无 | 输入栏上方固定区，随键盘一起上移、不参与消息滚动。用于「发订单」「发病例」等业务快捷入口 |
| `input-bar` | `EmChatInputBarScope` | 整栏替换默认输入栏，结构/样式全自绘；键盘避让、面板互斥、录音、禁言、@、草稿等行为经作用域契约由库内保持，详见「整栏自绘输入栏」 |

### 插槽示例

```vue
<template>
  <view class="page" :class="themeClass">
    <em-chat-page
      v-if="conversationId !== ''"
      :conversation-id="conversationId"
      :chat-type="chatType"
      :title="sceneTitle"
      :quick-replies="quickReplies"
      quick-reply-mode="fill"
      :extra-message-menus="extraMenus"
      @open-info="onOpenInfo"
      @message-menu="onMessageMenu"
    >
      <template #banner>
        <view class="biz-banner">
          <text class="biz-banner__title">订单 #20261021</text>
          <text class="biz-banner__desc">待发货 · 点击查看详情</text>
        </view>
      </template>

      <template #custom-message="{ message }">
        <!-- 业务字段从 message.ext 解析；未识别的 customEvent 在这里走宿主自己的渲染分支 -->
        <view class="biz-card">
          <text class="biz-card__title">{{ message.customEvent }}</text>
          <text class="biz-card__text">{{ message.text }}</text>
        </view>
      </template>

      <template #stream-message="{ message }">
        <view class="md">
          <text>{{ streamTextOf(message) }}</text>
        </view>
      </template>

      <template #input-toolbar>
        <view class="biz-bar">
          <text class="biz-bar__item" @click="sendOrderCard">发送订单卡</text>
        </view>
      </template>
    </em-chat-page>
  </view>
</template>

<script setup lang="ts">
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'
import type { ConversationTypeValue, EmMessageItem, EmMessageMenuExtra, EmQuickReply } from '@/uni_modules/easemob-uikit-uni/libs'

const conversationId = 'user-b'
const chatType: ConversationTypeValue = 'singleChat'
const sceneTitle = '在线客服'
const quickReplies: EmQuickReply[] = [
  { label: '在的', text: '您好，我在的，请问有什么可以帮您？' }
]
const extraMenus: EmMessageMenuExtra[] = [
  { key: 'view-order', text: '查看订单', icon: 'doc' }
]

// 富格式流式内容：宿主自行渲染 markdown，UIKit 只负责分片合批与滚动跟随
function streamTextOf(message: EmMessageItem): string {
  return message.stream != null ? message.stream.fullText : message.text
}

async function sendOrderCard() {
  await EmKit.sendCustom(conversationId, chatType, 'orderCard', { orderId: '20261021' }, { title: '订单 #20261021' })
}

function onOpenInfo(id: string) {
  uni.navigateTo({ url: `/pages/chat-info/chat-info?conversationId=${id}&chatType=${chatType}` })
}

function onMessageMenu(key: string, message: EmMessageItem) {
  if (key === 'view-order') {
    // 宿主跳业务订单详情
  }
}
</script>
```

## 整栏自绘输入栏（#input-bar）

提供 `#input-bar` 插槽即整栏替换默认输入栏（`em-chat-inputbar` 不再渲染）。这是「受约束的重写」：栏的结构与样式完全由宿主自绘，但容易踩坑的行为逻辑由库内保持运作——插槽作用域（`EmChatInputBarScope`）既是数据源也是动作集，自绘栏绑定它即可。

**无需重实现、由库内保持的行为**：

- 软键盘避让：页面在插槽外保留了键盘顶起壳（`adjust-position=false` + 按键盘实际遮挡高度顶起，含 iOS/鸿蒙安全区口径），自绘栏不需要处理键盘高度
- 键盘 ↔ 面板互斥：开面板前自动收键盘，面板高度跟随最近一次键盘高度（`panelStyle` 直接绑到自绘面板根节点），切换不跳变
- 点击消息区收起面板与键盘、全员禁言禁用态、@ 提及整条链路（草稿尾部输入 `@` 自动打开成员面板）、草稿持久化与 typing、引用与发送链路

**自绘栏必须接的契约**（不接则对应行为失效）：

| 自绘元素 | 必须绑定 |
|---|---|
| 文本输入框 | `:value="scope.draft"` + `@input` 里调 `scope.setDraft(v)`（直接改草稿会丢草稿持久化/typing/@ 检测）；`@focus/@blur` 调 `scope.notifyInputFocus()/notifyInputBlur()`；`:focus="scope.inputFocus"`；`confirm-type="send"` 的 `@confirm` 调 `scope.send()` |
| 发送按钮 | `scope.send()`（空草稿拦截、引用/@ext、清草稿、滚底内置） |
| 禁用态 | 输入框 `:disabled="scope.disabled"`；禁用下的操作尝试调 `scope.notifyDisabledTap()`（页面 toast） |
| emoji / 媒体面板开关 | `scope.togglePanel('emoji' | 'media')`；面板根节点绑 `:style="scope.panelStyle"`；emoji 点选用 `scope.setDraft(scope.draft + emoji)` 追加 |
| 媒体动作 | `scope.selectMedia(key)`，`key` 取 `MEDIA_PANEL_KEY.ALBUM/CAMERA/VIDEO/FILE`（选择器与发送内置） |
| 语音按钮 | `scope.toggleVoiceMode()` 切换；「按住说话」条的四个手势事件绑 `scope.onVoiceTouchStart/Move/End/Cancel`，用 `scope.recording/willCancel` 渲染状态（60 秒自动发送、过短拦截、上滑取消内置） |
| 引用条 | 按 `scope.quote` 自绘，关闭调 `scope.closeQuote()` |
| 快捷回复 | 按 `scope.quickReplies` 自绘，点击调 `scope.selectQuickReply(item)` |

注意：插槽的有无在页面实例创建时确定（库据此实例化行为核心），不能用运行时开关在同一个页面实例里动态切换默认输入栏与自绘输入栏；需要切换时用不同页面实例（如查询参数 + 重新进入）。

**最小示例**（完整可运行版见 demo 工程 `demo/components/demo-custom-inputbar`，场景开关面板里可一键体验）：

```vue
<template>
  <em-chat-page :conversation-id="conversationId" :chat-type="chatType" @open-info="onOpenInfo">
    <template #input-bar="scope">
      <view class="my-inputbar">
        <input
          class="my-inputbar__input"
          :value="scope.draft"
          :focus="scope.inputFocus"
          :disabled="scope.disabled"
          :placeholder="scope.placeholder"
          confirm-type="send"
          :adjust-position="false"
          @input="(e) => scope.setDraft(e.detail.value)"
          @confirm="scope.send"
          @focus="scope.notifyInputFocus"
          @blur="scope.notifyInputBlur"
        />
        <view class="my-inputbar__send" @click="scope.send">
          <text>发送</text>
        </view>
      </view>
    </template>
  </em-chat-page>
</template>
```

作用域完整字段与类型见 [EmChatInputBarScope](./API-TYPES.md)；行为核心也以 `useChatComposer` composable 导出，供完全自研聊天页的宿主复用同一套键盘/面板/录音逻辑。

## 消息能力与配置

| 能力 | 默认行为 | 相关配置 |
|---|---|---|
| 草稿 | 按会话保存，输入即存、清空/发送即清 | `uiConfig.enableDraft` |
| 时间分隔条 | 相邻消息超过 5 分钟插入 | `uiConfig.timeDividerInterval` |
| 撤回 | 自己发送且在 2 分钟内可撤回 | `uiConfig.recallTimeLimit` |
| 长按菜单 | 复制（文本）/ 引用 / 撤回 / 删除 | `uiConfig.messageMenuKeys` |
| 已读回执 | 单聊最新一条自己消息显示已读/未读 | `EmKit.init({ enableReadReceipt })` |
| 输入状态 | 单聊发送 typing，节流 5 秒、展示 5 秒 | `uiConfig.enableTyping`、`typingThrottle`、`typingTimeout` |
| 输入栏工具 | 语音 / Emoji / 相册 / 拍照 / 视频 / 文件全开 | `uiConfig.inputFeatures` |
| Emoji 面板 | 内置 96 个字符 | `uiConfig.emojiList` |
| 流式消息 | 分片合批 50ms，上翻暂停跟随 | `uiConfig.enableStreamMessage`、`streamThrottle` |

## 宿主接线

1. **路由参数**：按 `conversationId` + `chatType` 解析查询参数，`chatType` 只接受 `singleChat`/`groupChat`，其他值回落单聊；组件用 `v-if` 保护空 ID。
2. **详情入口**：`open-info` 里跳聊天信息页并透传同样的两个参数；纯客服/工单场景可设 `:show-action="false"`，由宿主自己的入口跳业务页。
3. **返回**：默认 `autoBack=true`，组件自行 `navigateBack`；需要表单拦截或自定义退场时设 `:auto-back="false"`，只在 `@back` 里处理。
4. **业务埋点**：`send` / `recall` / `delete` 都是「行为已完成」的通知，适合做统计，不要在这些回调里重复发送消息。
5. **业务长按动作**：`extraMessageMenus` 定义 key/文案/图标，`message-menu` 里按 key 分支执行（查看订单、查看处方等），UIkit 不实现业务跳转。
6. **@ 点击**：`mention-click` 拿到 userId，可跳成员资料；不接则点击无行为。
7. **tabBar 未读数**：聊天页离开时会清当前会话未读，会话页/联系人页的角标刷新仍由宿主在 `onShow` 调 `useTabBarBadge().sync()`。

## 行为与边界

- 当前版本支持 Android、iOS、鸿蒙、H5 与微信小程序；消息列表、输入栏、弹层均为跨端同一套实现。
- 已读回执与 typing 仅单聊；群聊不展示已读状态，也不发 typing 信号，导航栏副标题固定用于成员数。
- 群详情尚未返回时导航栏不显示成员数副标题；成员数为 0 时同样不显示，不会出现「0 名成员」。
- 撤回窗口默认 2 分钟，超时后长按菜单不再出现撤回项；撤回失败会 toast 提示。
- 引用卡展示发送人与摘要，不展示被引用图片/视频的缩略图。
- @ 提及只支持在草稿尾部输入 `@` 触发：uni 的 input 没有光标 API，无法在文本中间定位插入点；发送前会过滤失效的 @ 提及。
- 群公告条只显示单行摘要，展开按钮按屏宽与字号估算是否需要，不依赖 DOM 测量。
- 富格式流式消息必须由宿主提供 `#stream-message` 才会按业务格式渲染；未提供时回落为纯文本气泡，内容仍会随分片增长。
- 视频消息点击后打开内置全屏播放器（原生 `video`），App、H5、微信小程序一致；播放器内可暂停、拖动进度与全屏。
- 文件消息：App 端没有通用文件选择器，输入栏隐藏「文件」入口；小程序与 H5 可发送。文件打开/下载当前版本未接入，气泡不发出下载动作。
- H5 端输入栏不显示语音入口（录音能力未接入）；App 与小程序可录音发送。
- 长按菜单的「复制」只对文本消息出现；「删除」只删本地，不影响对端。
- 群系统通知灰条（本地插入的群事件提示）没有长按菜单，也不参与撤回、引用与复制。
- 切换 `conversationId` 会清空引用条与 @ 选择状态；离开页面会反注册消息监听并清当前会话未读。

## 相关文档

- [会话列表页](./PAGES-CONVERSATION.md)
- [聊天信息与群资料](./PAGES-CHAT-INFO.md)
- [消息与扩展协议](./MESSAGING.md)
- [AI 流式消息](./AI-STREAM.md)
- [聊天与消息组件](./COMPONENTS-CHAT.md)
- [多场景接入](./GUIDE-MULTI-SCENARIO.md)
- [EmKit API](./API-KIT.md)
- [配置参考](./CONFIG.md)
