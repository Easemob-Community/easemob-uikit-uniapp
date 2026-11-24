# 聊天页（em-chat-page）

`em-chat-page` 同时承载单聊与群聊会话：进入会话、拉历史、发送各类消息、引用/撤回/重发、已读回执与输入状态、@ 提及、群公告、流式消息跟随滚动都由组件自身完成。宿主只需要把 `conversationId` 与 `chatType` 传进来，再按业务需要接管右上角详情入口、消息长按的业务动作和几个固定插槽。

页面组件位于 `uni_modules/easemob-uikit-uni/components/pages/em-chat-page/em-chat-page.vue`，在宿主工程中由聊天页面壳承载（例如 `sub-im/pages/chat/chat.uvue`）。它不持有路由，也不感知宿主页面栈。

## 界面预览

五类气泡混排（Android 真机）：

<DocsImage src="assets/shots/android/l1-android-chat-bubbles.webp" alt="聊天气泡" :width="750" :height="1625" eager />

长按菜单（HarmonyOS 真机）：

<DocsImage src="assets/shots/harmony/l1-harmony-chat-menu.webp" alt="长按菜单" :width="750" :height="1669" />

更多端与更多状态见[界面截图](./SCREENSHOTS.md)。

## 页面位置与接入方式

- 页面组件在 `components/pages/` 下，需要 `pages.json` 的 custom easycom 规则才能以标签形式使用（见 [快速开始](./QUICKSTART.md) 3.1 节）。
- 组件自带 `em-nav-bar`（含状态栏与小程序胶囊避让），路由必须设 `navigationStyle: "custom"`，App 端同时设 `app-plus.titleNView: false`。
- 页面壳根节点 `height: 100%` 且 flex 链完整；组件内消息区是 `flex: 1` + `height: 0` 的 `scroll-view`，根节点没高度时输入栏会被挤出视口。
- 页面壳根节点绑定 `themeClass`；页面壳用 `v-if="conversationId !== ''"` 保护，避免用空会话 ID 初始化组件。

## 能力

### 消息收发与历史

- 进入即并行执行 `EmKit.enterConversation` 与首次 `EmKit.loadHistory`；已有缓存时先渲染缓存并直接贴底，不等历史回包。
- 内置文本、图片、语音、视频、文件、自定义消息的发送与渲染；接收到的 `multi_body` 复合消息在单个气泡内按顺序展示文本、图片、语音、视频、文件、位置和自定义分段，不支持从 uni 输入栏创建或发送复合消息；未识别的消息类型显示默认提示气泡，可交给 `#custom-message` 接管。
- 首次历史未回包时展示气泡对话骨架（左右交替消息行 + 时间分隔占位）；首屏失败显示「点击重试」，已有缓存消息时改为顶部重试行，不遮挡消息。首屏与加载更多互斥，各自只拥有自己的错误态。
- 点击消息区顶部的「加载更早消息」加载更早历史，加载前记录首条消息锚点，加载后回位，避免视口跳动；没有更多时显示「没有更多历史消息」。分页失败保留顶部重试行，重试仍走分页锚点路径。
- 相邻消息间隔超过 `uiConfig.timeDividerInterval`（默认 5 分钟）插入时间分隔条，首条消息必显。
- 消息发送成功后以 `send` 事件透出；文本与直发快捷回复共享提交锁，提交中输入栏 `submitting=true`、快捷回复条 `disabled=true`，但不影响草稿编辑。失败消息显示红色状态图标，点击弹出失败面板（展示失败原因 + 「重新发送 / 删除」），选择重发后调用 `EmKit.resendMessage` 原地重发；同一 `localId` 重发完成前不可重复点击，失败后仍可重试。失败原因按 SDK 错误码归因（审核未通过 / 违规内容 / 被对方拒收 / 被禁言 / 网络异常等），并随消息保存在 `EmMessageItem.failCode` 中。
- 断网或重连期间，输入栏上方显示「消息待发」提示（网络已断开 / 正在重连），连接恢复后自动消失；发送仍有离线预检测兜底。
- 图片/视频消息发送中在气泡内显示压暗蒙层与居中 loading，发送完成或失败后自动消失；SDK 回传附件上传进度时，蒙层内同时显示百分比，文件气泡在大小下方显示上传百分比。进度只属于发送中状态，发送结束即清空。
- 输入草稿按会话保存（`uiConfig.enableDraft` 默认开启）；离开页面时清空当前会话的服务端未读。

### 引用、撤回、编辑、置顶与长按菜单

- 长按消息打开菜单：复制（文本或含文本的复合消息）、引用、编辑（自己发送且已发送的文本消息）、置顶、下载（已发送的图片/视频/文件）、撤回、重发（仅失败消息）、删除。复合消息复制按顺序拼接所有文本分段；引用、置顶、撤回和删除作用于父消息，分段媒体点击不影响父菜单。菜单项与顺序由 `uiConfig.messageMenuKeys` 决定，删除 key 即禁用对应能力。失败消息的菜单只保留复制 / 重发 / 删除，避免对没有服务端 ID 的消息执行引用/编辑/置顶/撤回。
- 内容被服务端审核替换时（`isContentReplaced`），气泡下方展示「内容已被审核修改」标识，发送方不再被静默覆盖；该标识与撤回/编辑事件同源更新。
- 引用后输入栏上方出现引用条，发送的文本消息同时写入 `ext.msgQuote` 与兼容字段 `ext.emQuote`；气泡下方生成引用卡，点击定位原消息并闪烁高亮，原消息未加载或已删除时 toast 提示。
- 撤回仅对「自己发送、状态为已发送、且在撤回窗口内」的消息出现；窗口由 `uiConfig.recallTimeLimit` 控制，默认 2 分钟。执行撤回时会再次检查时间窗，并拦截重复提交；成功后以 `recall` 事件透出，不额外弹确认框。
- 撤回后的占位条显示原消息发送者的昵称（群聊取成员名片，单聊取好友备注 > 昵称）；自己撤回的文本消息在占位条上提供「重新编辑」，点击把原文回显到输入框，语音模式下会先恢复文本输入框，作为新消息发送。`uiConfig.enableReEdit` 可关闭该按钮。
- 编辑仅支持自己发送的文本消息：点击「编辑」后输入栏上方出现编辑条（显示原文截断预览），语音模式下会先恢复文本输入框；修改后发送复用原消息 id，文本气泡尾部出现「已编辑」标记；单条消息最多编辑 10 次，达到上限后菜单项置灰，编辑失败保留编辑态供重试。
- 置顶对未撤回的消息全类型可用：置顶后消息列表上方出现置顶条（最新置顶在前），多条置顶点击计数下拉展开完整列表（上限 20 条），点击任意置顶行定位并高亮原消息，行尾可取消置顶；`uiConfig.messageMenuKeys` 不含 `pin` 时置顶条不渲染。
- 复制等待系统剪贴板返回结果，成功与失败分别提示；空文本按失败处理。
- 删除先弹确认框，取消不发请求。有服务端 ID 的消息先删当前账号的漫游历史再删本地，本地消息仅本地删除；失败保留气泡并提示，成功后才以 `delete` 事件透出。删除后会话摘要与时间同步校正；该操作不删除接收方消息。
- 业务动作可经 `extraMessageMenus` 追加在内置项之后（删除项保持末位），命中时以 `message-menu` 把 key 与消息项交给宿主。

### 附件下载

- 已发送的图片、视频、文件消息长按菜单出现「下载」（`MESSAGE_MENU_KEY.DOWNLOAD`，默认 `messageMenuKeys` 包含）；发送中、失败、已撤回的消息没有可下载的远端附件，不出现该项。复合消息不提供父级整包下载，点击其中的文件分段会直接下载该附件。
- App 与微信小程序：图片/视频先下载再写入系统相册（「已保存到相册」）；文件下载到本地后调用系统文档预览尝试打开。App 会对 doc/docx/xls/xlsx/ppt/pptx/pdf 显式指定类型，其他类型也交给系统尝试；微信小程序仅支持这七类，其他类型提示「文件已下载，但当前类型无法打开」。
- H5：交给浏览器下载（`a[download]`），不写相册；跨域直链的 `download` 属性可能被浏览器忽略，此时会在新标签页打开文件。
- 下载中显示 loading 与百分比（App/小程序由 `uni.downloadFile` 提供进度）；相册权限被拒绝时提示「请允许访问相册后重试」，其余失败提示「下载失败，请稍后重试」。
- 微信小程序需要在微信公众平台配置 `downloadFile` 合法域名，否则下载会被平台拦截。
- 宿主也可以在自定义界面中调用 `EmKit.downloadAttachment(message)`（或门面导出的 `downloadAttachment`）自行触发同一套下载逻辑。

### 已读回执与输入状态

- 单聊已读态图标：只对「最新一条自己发送的已发送消息」显示空心圆（未读）/对勾（已读），其余自己消息不显示。**默认关闭**，`EmKit.init({ showReadStatus: true })` 或 `setConfig({ showReadStatus: true })` 打开；该开关只控制已读展示，不影响发送中/失败状态。功能层面的已读回执由 `enableReadReceipt`（默认开启）单独控制。
- 群聊已读人数：`enableGroupReadReceipt`（默认关闭）开启后，群聊发送的消息携带已读回执标记、进会话时自动回执群内消息，己方已发送消息下方显示「N 人已读」。人数来自群回执事件（服务端下发累计值）或进会话时的批量查询，只增不减；关闭该开关时群聊不产生任何回执请求，也不显示人数。
- 发送状态呈现可配置：`messageStatus.position` 可把状态列（发送中 loading / 失败红叹号 / 未读已读图标）镜像到气泡右侧，`icons` 按状态替换图标名，`texts` 追加「发送中 / 失败」等短文案。配置只改变呈现形式，发送中与失败仍然恒显。
- 发送中/发送失败是独立关键状态：发送中显示 loading，失败显示红色感叹号并可点开失败面板，始终展示，不随 `showReadStatus` 或 `enableReadReceipt` 关闭。
- 单聊输入状态：草稿非空时按 `uiConfig.typingThrottle`（默认 5 秒）向对方发送 typing 信号；收到对方信号时导航栏副标题显示「对方正在输入…」，展示超时由 `uiConfig.typingTimeout` 控制（默认 5 秒）。
- 群聊不复用单聊的已读图标（已读信息以「N 人已读」人数行呈现，见上），也不发送/接收 typing 信号；群聊导航栏副标题用于成员数。

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

- 输入栏支持语音、Emoji、相册、拍照、视频、文件；单项可经 `uiConfig.inputFeatures` 关闭，Emoji 字符集可经 `uiConfig.emojiList` 替换。运行中关闭语音、Emoji 或全部媒体能力时，对应的语音输入态或已打开面板会同步退出。
- 右侧是「+」与发送键的同槽互斥：草稿为空显示「+」媒体入口，草稿有内容时换成品牌色纸飞机发送键，不再常驻文字发送按钮，输入框因此更宽。
- `inputFeatures.inputMode` 显式选择输入形态：`'single'` 为全端单行 input、回车发送；`'multiline'` 为全端生长 textarea、回车换行、纸飞机发送，1 行起步、最多 5 行，超出内部滚动。多行文本使用固定 19px 行高，输入区按行数显式计算高度，清空立即回到单行。
- 未设置 `inputMode` 时保留旧 `sendOnReturn` 行为：`false` 走多行；`true`（默认）时 iOS 走多行回车发送，其余端走单行。显式 `inputMode` 优先，不与 `sendOnReturn` 组合。Android 系统限制 textarea 键盘右下角恒为换行。
- `quickReplies` 在输入栏上方渲染常用语胶囊：`quickReplyMode='fill'`（默认）整句替换草稿，语音模式下会先恢复文本输入框；`'send'` 直接发送（不带引用与 @），不改变语音模式。
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

## 宿主接线

| 可见控件或状态 | 事件或默认行为 | 宿主必须做什么 | 不接的后果 |
|---|---|---|---|
| 右上「…」 | `open-info(conversationId)` | 跳聊天信息页；不做详情页时设 `showAction=false` | 点击后停留在聊天页 |
| 返回箭头 | `autoBack=true` 自动 `navigateBack`，同时发 `back` | 根页设 `showBack=false`；自定义退场设 `autoBack=false` 并处理 `back` | 根页箭头无可用上一页 |
| 未登录空态 | `unauthorized` | 跳登录页或提供登录入口；登录后当前页自动恢复 | 页面只显示「请先登录」 |
| 业务长按动作 | `message-menu(key, message)` | 执行 `extraMessageMenus` 对应的业务动作 | 自定义菜单项只有选择事件 |
| @ 片段 | `mention-click(userId)` | 按需跳成员资料 | 点击无页面动作 |

## Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `conversationId` | `string` | 必填 | 单聊为对方 userId，群聊为 groupId |
| `chatType` | `ConversationTypeValue` | 必填 | `CONVERSATION_TYPE.SINGLE_CHAT` 或 `CONVERSATION_TYPE.GROUP_CHAT`，决定已读回执、typing、@ 提及、公告等链路 |
| `avatarShape` | `EmAvatarShape` | 跟随全局配置 | 消息头像形状局部覆盖；未传时读取 `uiConfig.avatarShape`（全局默认 `'circle'`） |
| `showMemberCount` | `boolean` | `true` | 群聊导航栏副标题显示成员数；单聊该位置留给 typing 状态，两者互斥 |
| `senderNameMode` | `EmSenderNameMode` | `'always'` | 群聊气泡上方是否显示发送者昵称；`'hidden'` 不显示 |
| `showAnnouncement` | `boolean` | `true` | 群公告条显隐（仅群聊且群公告非空时生效） |
| `enableMention` | `boolean` | `true` | 群聊 @ 提及链路开关；关闭后输入 `@` 不弹成员面板 |
| `peerName` | `string` | `''` | 单聊对端业务昵称，写入展示覆盖层；空串不注入，页面卸载只清理自己写入且仍匹配的值 |
| `peerAvatar` | `string` | `''` | 单聊对端业务头像，语义同 `peerName`；宿主后调用 `setUserPresentation` 的值不会被页面卸载误删 |
| `title` | `string` | `''` | 导航栏标题覆盖，如「在线客服」；空串时单聊用昵称 > userId，群聊用群名 > groupId |
| `showNavBar` | `boolean` | `true` | 顶部自绘导航栏显隐；关闭后连接条、消息区和输入栏占满原区域，适用于宿主自绘头部 |
| `showBack` | `boolean` | `true` | 导航栏返回箭头显隐；聊天页作为根页时设为 `false`，避免不可用的返回入口 |
| `showAction` | `boolean` | `true` | 右上角详情入口显隐；关闭后不再触发 `open-info`，详情页完全由宿主接管 |
| `autoBack` | `boolean` | `true` | 点导航栏返回时是否由组件执行 `uni.navigateBack({ delta: 1 })`；`false` 时只发 `back` |
| `showConnectionBanner` | `boolean` | `true` | 顶部连接状态条显隐 |
| `inputFeatures` | `Partial<EmInputFeatures>` | 未设置 | 按字段覆盖当前页面的全局输入配置，默认输入栏和 `#input-bar` scope 共用同一解析结果 |
| `messageMenuKeys` | `MessageMenuKeyValue[]` | 未设置 | 当前页面菜单数组整体替换全局配置，不影响其他页面；置顶条显隐也使用该结果 |
| `quickReplies` | `EmQuickReply[]` | `[]` | 输入栏上方常用语，空数组不渲染；条目为 `{ label, text? }` |
| `quickReplyMode` | `EmQuickReplyMode` | `'fill'` | `'fill'` 替换草稿（用户可编辑后再发）；`'send'` 直接发送 |
| `extraMessageMenus` | `EmMessageMenuExtra[]` | `[]` | 长按菜单追加的业务动作，可带 `types` 限定消息类型；内置 key（copy/quote/edit/pin/download/recall/delete）不可覆盖 |
| `watermark` | `string \| EmWatermarkOptions` | 未设置 | 组件级水印：字符串=文案、对象=可调样式，空串不显示；覆盖导航栏/连接条/横幅/公告/置顶/消息列表，**不含输入栏、面板与弹层**。不传则不渲染（零开销） |

## Events

| 事件 | 载荷 | 说明 |
|---|---|---|
| `back` | 无 | 点击导航栏返回。`autoBack=true` 时组件随后自行 `navigateBack`；`false` 时由宿主决定退场或拦截 |
| `open-info` | `conversationId: string` | 点击右上角详情入口，宿主跳聊天信息页 |
| `unauthorized` | 无 | 当前未登录，页面已显示「请先登录」；宿主可跳登录页。登录后当前页自动重新加载历史 |
| `send` | `message: EmMessageItem` | 文本、图片、语音、视频、文件、快捷回复发送成功后透出 |
| `recall` | `message: EmMessageItem` | 撤回成功后透出 |
| `delete` | `message: EmMessageItem` | 漫游删除（如有服务端 ID）与本地删除均完成后透出；仅本地消息在本地删除后透出 |
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
| `title` | `{ name: string, ext?: Record<string, unknown>, conversationId: string }` | 整标题自绘（导航栏标题位）。缺省回落内置标题（`title` prop > 会话/群/用户昵称回落链）；`ext` 为 `setConversationPresentation` / `setGroupPresentation` 注入的业务载荷 |
| `input-bar` | `EmChatInputBarScope` | 整栏替换默认输入栏，结构/样式全自绘；键盘避让、面板互斥、录音、禁言、@、草稿等行为经作用域契约由库内保持，详见「整栏自绘输入栏」 |
| `emoji-panel` | `EmChatEmojiPanelScope` | 替换默认输入栏的 emoji 内容区；外壳仍负责面板高度、键盘互斥与禁用态。scope 提供 `emojis`、`selectEmoji`、`closePanel`、`disabled`、`notifyDisabledTap`，未提供时显示内置字符网格 |
| `image-message` | `EmChatImageMessageScope` | 接管单条图片消息渲染；scope 提供 `message`、`preview`、`longPress`，未提供时显示内置图片气泡。宿主自绘时可继续调用预览与长按，保留消息菜单 |
| `watermark` | `{ conversationId: string }` | 水印覆盖层，铺满消息内容区（导航栏 → 消息列表），`pointer-events: none` 不响应交互；缺省渲染 `em-watermark` 平铺，可整层自绘（图片/业务 logo） |

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
| 媒体动作 | `scope.selectMedia(key)`，`key` 取 `MEDIA_PANEL_KEY.ALBUM/CAMERA/VIDEO/FILE`（选择器与发送内置，调用前自动收起媒体面板） |
| 语音按钮 | `scope.toggleVoiceMode()` 切换；「按住说话」条的四个手势事件绑 `scope.onVoiceTouchStart/Move/End/Cancel`，用 `scope.recording/willCancel` 渲染状态（60 秒自动发送、过短拦截、上滑取消内置） |
| 引用条 | 按 `scope.quote` 自绘，关闭调 `scope.closeQuote()` |
| 快捷回复 | 按 `scope.quickReplies` 自绘，点击调 `scope.selectQuickReply(item)` |

> [!WARNING]
> 注意：插槽的有无在页面实例创建时确定（库据此实例化行为核心），不能用运行时开关在同一个页面实例里动态切换默认输入栏与自绘输入栏；需要切换时用不同页面实例（如查询参数 + 重新进入）。

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

作用域完整字段与类型见 [EmChatInputBarScope](./API-TYPES-COMPONENTS.md#emchatinputbarscope)；行为核心也以 `useChatComposer` composable 导出，供完全自研聊天页的宿主复用同一套键盘/面板/录音逻辑。

> [!WARNING]
> App 端自绘注意：`textarea` 是原生组件，`flex` 尺寸与背景样式渲染不可靠——高度/灰底/圆角由包裹层 `view` 承担，textarea 自身 `width/height: 100%`、不设背景（iOS 加 `disable-default-padding`），否则多行生长态下输入区会整体不可见。详见 [常见问题](./FAQ.md)。

## 消息能力与配置

| 能力 | 默认行为 | 相关配置 |
|---|---|---|
| 草稿 | 按会话保存，输入即存、清空/发送即清 | `uiConfig.enableDraft` |
| 时间分隔条 | 相邻消息超过 5 分钟插入 | `uiConfig.timeDividerInterval` |
| 撤回 | 自己发送且在 2 分钟内可撤回 | `uiConfig.recallTimeLimit` |
| 撤回重编辑 | 自己撤回的文本消息可在占位条回显输入框 | `uiConfig.enableReEdit` |
| 消息编辑 | 自己发送的文本消息可编辑（单条上限 10 次） | `uiConfig.messageMenuKeys` 含 `edit` |
| 失败重发 | 点失败气泡的红叹号弹出原因面板，选择重发或删除 | `uiConfig.messageMenuKeys` 含 `resend` |
| 审核替换 | 内容被审核修改时气泡下方展示标识 | — |
| 置顶消息 | 未撤回消息可置顶，多条下拉展开（上限 20 条） | `uiConfig.messageMenuKeys` 含 `pin` |
| 长按菜单 | 复制（文本）/ 引用 / 编辑 / 置顶 / 撤回 / 重发 / 删除 | `uiConfig.messageMenuKeys` |
| 已读态图标 | 默认关闭；开启后单聊最新一条自己消息显示已读/未读 | `EmKit.init({ showReadStatus })`，功能开关 `enableReadReceipt` |
| 群已读人数 | 默认关闭；开启后己方群消息下方显示「N 人已读」 | `EmKit.init({ enableGroupReadReceipt })` |
| 发送状态呈现 | 默认气泡左侧、内置图标、无文案 | `EmKit.init({ messageStatus })` |
| 附件上传进度 | 图片/视频/文件发送中显示百分比（SDK 回传时） | — |
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
- typing 仅单聊；群聊不发 typing 信号，导航栏副标题固定用于成员数。单聊已读态图标由 `showReadStatus` 控制（默认关闭），群聊已读人数由 `enableGroupReadReceipt` 控制（默认关闭）。
- 群详情尚未返回时导航栏不显示成员数副标题；成员数为 0 时同样不显示，不会出现「0 名成员」。
- 撤回窗口默认 2 分钟，超时后长按菜单不再出现撤回项；撤回失败会 toast 提示。
- 引用卡展示发送人与摘要，不展示被引用图片/视频的缩略图。
- @ 提及只支持在草稿尾部输入 `@` 触发：uni 的 input 没有光标 API，无法在文本中间定位插入点；发送前会过滤失效的 @ 提及。
- 群公告条只显示单行摘要，展开按钮按屏宽与字号估算是否需要，不依赖 DOM 测量。
- 富格式流式消息必须由宿主提供 `#stream-message` 才会按业务格式渲染；未提供时回落为纯文本气泡，内容仍会随分片增长。
- 视频消息点击后打开内置全屏播放器（原生 `video`），App、H5、微信小程序一致；播放器内可暂停、拖动进度与全屏。
- 文件消息：小程序与 H5 使用内置文件选择；App 注册附件能力后可发送，未注册时输入栏隐藏「文件」入口。文件下载走长按菜单「下载」：App/小程序下载后尝试系统文档预览打开，H5 走浏览器下载；单击文件气泡仍然不触发动作。
- 图片、视频与内置文件选择的用户取消保持静默；选择、读取或元数据处理失败分别提示，不与消息发送失败混用。
- 发送与选择器都按发起时的 `conversationId / chatType` 和页面代次执行：切会话后，旧选择结果不会发到新会话，未开始发送的宿主临时附件会调用 `release`；旧文本完成不会清新会话的草稿、引用或 @选择，也不会解除新请求的提交锁。同一会话在发送期间产生的新编辑同样不会被旧成功回调清除。
- H5 端输入栏不显示语音入口（录音能力未接入）；App 与小程序可录音发送。
- 长按菜单的「复制」只对文本消息出现；「删除」对有服务端 ID 的消息删除当前账号漫游历史与本地消息，对本地消息仅删本地，不删除接收方消息。
- 群系统通知灰条（本地插入的群事件提示）没有长按菜单，也不参与撤回、引用与复制。
- 切换 `conversationId` 会清空引用条与 @ 选择状态；离开页面会反注册消息监听并清当前会话未读。

## 相关文档

- [会话列表页](./PAGES-CONVERSATION.md)
- [聊天信息与群资料](./PAGES-CHAT-INFO.md)
- [消息与扩展协议](./MESSAGING.md)
- [AI 流式消息](./AI-STREAM.md)
- [聊天与消息组件](./COMPONENTS-CHAT.md)
- [多场景接入](./GUIDE-MULTI-SCENARIO.md)
- [EmKit 消息操作 API](./API-KIT-MESSAGE-OPERATIONS.md)
- [配置参考](./CONFIG.md)
