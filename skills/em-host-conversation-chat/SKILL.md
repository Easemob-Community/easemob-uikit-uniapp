---
name: em-host-conversation-chat
description: Use when 接入或定制 easemob-uikit-uni 的会话列表页、聊天页、聊天详情页（em-conversation-page、em-chat-page、em-chat-info-page），包括路由参数 chatType/conversationId、页面高度白屏、未读清零、自动同步、返回拦截、插槽与事件接线。
---

# 会话列表 / 聊天页 / 聊天详情

> 基线：UIKit `1.0.3` · websdk `5.2.0`。三个页面组件都是**自带导航栏**的完整页面块，宿主只提供根容器、路由参数与事件接线。
> 依赖前置：已完成 `em-host-integration` 的安装、`pages.json` easycom、`EmKit.init` 与登录。

## 1. 三个组件各管什么

| 组件 | 职责 | 宿主必须做 |
|---|---|---|
| `em-conversation-page` | 会话列表、搜索、筛选 tab、置顶/免打扰/删除（长按）、发起单聊（「+」内置选人）、连接状态条 | 根容器高度、`@select` 跳聊天页、`@menu` 接建群 |
| `em-chat-page` | 进会话、拉历史、滚底、发消息（文本/图片/语音/视频/文件）、引用/撤回/重发/已读、草稿、键盘避让、未读清零 | 路由参数、根容器高度、`@open-info` 跳详情 |
| `em-chat-info-page` | 聊天详情：免打扰/置顶/清空/删除会话/删除好友；群分支的成员宫格、公告、群管理 | 根容器高度、`@back`/`@deleted`/`@leaved`/`@contact-deleted` 退场、群成员私聊接线 |

**不要**在宿主里重复实现这些页面的标题栏、消息列表、输入栏；需要视觉差异先看 props/插槽（见第 6 节）。

## 2. 页面高度与导航（最高频事故）

```css
/* 会话/聊天/详情页共用 */
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
```

```json
// 聊天页 / 详情页
{
  "path": "pages/chat/chat",
  "style": {
    "navigationStyle": "custom",
    "app-plus": { "titleNView": false }
  }
}
```

- 根节点没有确定高度 → 列表/输入栏 0 高 → **白屏或输入栏消失**。
- 没关原生导航 → **双标题栏**（组件自带 `em-nav-bar`）。
- 不要给 `.page` 加 `overflow: hidden`、固定 `height: 750rpx` 之类的值；用 `height: 100%` + flex。
- 页面根节点建议绑 `themeClass`（`useTheme()` 返回），否则页面背景 token 不生效：

```vue
<view class="page" :class="themeClass">
```

## 3. 会话列表页

### 3.1 最小接线

```vue
<template>
  <view class="page" :class="themeClass">
    <em-conversation-page @select="onSelect" @menu="onMenu" />
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { CONVERSATION_MENU_KEY, EmKit, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'
import type { ConversationTypeValue } from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass } = useTheme()

onShow(() => {
  // 未登录只看 userId：断网重连时 status 会短暂离开 online
  if (EmKit.state.userId === '') {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  // 组件默认 autoSync=true，首次挂载自拉；从聊天页返回的补同步由页面 onShow 负责
  EmKit.syncConversations().catch(() => {})
})

function onSelect(conversationId: string, chatType: ConversationTypeValue): void {
  // 可选预热：跳转动画期间数据已在路上
  EmKit.enterConversation(conversationId, chatType).catch(() => {})
  EmKit.loadHistory(conversationId, chatType).catch(() => {})
  uni.navigateTo({ url: `/sub-im/pages/chat/chat?conversationId=${conversationId}&chatType=${chatType}` })
}

function onMenu(key: string): void {
  if (key === CONVERSATION_MENU_KEY.CREATE_GROUP) {
    uni.navigateTo({ url: '/sub-im/pages/group/group' })
  }
}
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';
.page { display: flex; flex-direction: column; height: 100%; background-color: var(--em-conversation-list-bg); }
</style>
```

### 3.2 Props / 事件 / 插槽

| Props | 类型 | 默认 | 说明 |
|---|---|---|---|
| `showSearch` | `boolean` | `true` | 顶部搜索条 |
| `tabs` | `ConversationTabKeyValue[]` | 全部五项 | 传 `[]` 隐藏筛选栏；项：`all/unread/atMe/single/group` |
| `showTabs` | `boolean` | `true` | 筛选栏显隐；`false` 时无论 `tabs` 为何都不渲染 |
| `emptyText` | `string` | `''` | 空列表文案；空串走 i18n |
| `autoSync` | `boolean` | `true` | 首次挂载自动 `syncConversations` |
| `showConnectionBanner` | `boolean` | `true` | 顶部连接状态条 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `select` | `(conversationId, chatType)` | 点击会话；**必须用第二参 chatType**，不要自己猜 |
| `menu` | `(key)` | 仅「+」里的 `create-group` 需要宿主处理；`new-chat`、置顶/免打扰/删除均由组件内置 |

| 插槽 | 作用 |
|---|---|
| `#empty` | 整体替换空态（搜索无结果与空列表共用一个插槽） |

组件内置：搜索、五类筛选、6 条骨架、置顶/免打扰/删除（长按）、「+」发起单聊（内置选人并 emit `select`）、连接状态条。删除会话先二次确认；pin/mute/delete 按会话与动作防重，pin/mute 各自串行并以最新意图为准。`loaded / syncing / syncFailed` 区分未加载、加载中、失败与权威空列表；无缓存失败显示重试，有缓存时保留列表。重试真实调用 `refreshSessionList`，不会用内存快照伪装成功。

## 4. 聊天页

### 4.1 最小接线

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
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { CONVERSATION_TYPE, EmKit, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'
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

function onOpenInfo(id: string): void {
  uni.navigateTo({ url: `/sub-im/pages/chat-info/chat-info?conversationId=${id}&chatType=${chatType.value}` })
}
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';
.page { display: flex; flex-direction: column; height: 100%; background-color: var(--em-chat-bg); }
</style>
```

`v-if="conversationId !== ''"` 很重要：`em-chat-page` 的 `conversationId`/`chatType` 是必传，空串会触发无效会话查询。

### 4.2 参数语义

| 参数 | 单聊 | 群聊 |
|---|---|---|
| `conversationId` | 对端 **userId** | **groupId** |
| `chatType` | `'singleChat'` | `'groupChat'` |

- 二者都来自路由 query；不要只传 `chatType` 或只传 id。
- 群聊传成 `singleChat` 会导致群能力（公告/@/成员昵称）不生效；单聊传成 `groupChat` 会按群查历史而空列表。
- `chatType` 是 1.0 的 **breaking 必传项**，旧示例若省略要补。

### 4.3 Props

| Props | 类型 | 默认 | 说明 |
|---|---|---|---|
| `conversationId` | `string` | 必传 | 对端 userId / groupId |
| `chatType` | `'singleChat' \| 'groupChat'` | 必传 | 决定单聊/群聊分支 |
| `avatarShape` | `'circle' \| 'square'` | 跟随全局配置 | 头像形状局部覆盖；未传时读取 `uiConfig.avatarShape`（全局默认 `'circle'`） |
| `showMemberCount` | `boolean` | `true` | 群聊标题副标题成员数（单聊不生效） |
| `senderNameMode` | `'always' \| 'hidden'` | `'always'` | 群聊气泡上方昵称行 |
| `showAnnouncement` | `boolean` | `true` | 群公告条（群聊） |
| `enableMention` | `boolean` | `true` | @ 提及链路（群聊） |
| `title` | `string` | `''` | 覆盖导航标题，如「在线客服」；空串走昵称链 |
| `showAction` | `boolean` | `true` | 右上角详情入口；客服等场景可关 |
| `autoBack` | `boolean` | `true` | 点返回是否由组件 `navigateBack`；`false` 时只 emit `back` |
| `showConnectionBanner` | `boolean` | `true` | 连接状态条 |
| `quickReplies` | `EmQuickReply[]` | `[]` | 输入栏上方快捷话术 |
| `quickReplyMode` | `'fill' \| 'send'` | `'fill'` | 点击填入草稿 / 直接发送 |
| `extraMessageMenus` | `EmMessageMenuExtra[]` | `[]` | 长按菜单追加业务动作 |

### 4.4 事件

| 事件 | 载荷 | 说明 |
|---|---|---|
| `back` | — | 返回；`autoBack=false` 时由宿主退场 |
| `open-info` | `conversationId` | 右上角详情入口 |
| `send` | `EmMessageItem` | 任一种消息发送成功后通知（用于埋点/回执，不要在这里再发一次） |
| `recall` | `EmMessageItem` | 撤回成功 |
| `delete` | `EmMessageItem` | 删除成功（有服务端 ID 时先删漫游再删本地；失败不派发） |
| `mention-click` | `userId` | 气泡内 @ 片段点击，宿主可跳成员资料 |
| `message-menu` | `(key, message)` | `extraMessageMenus` 命中 |

### 4.5 插槽

| 插槽 | 作用域 | 位置/说明 |
|---|---|---|
| `#banner` | — | 导航栏下、群公告上；固定不随消息滚动，宿主自管高度与样式 |
| `#empty` | — | 空会话（无历史消息）时替换默认空态 |
| `#stream-message` | `{ message }` | 仅富格式流式消息（如 `customType='markdown'`）；纯文本流式走内置渲染 |
| `#custom-message` | `{ message }` | 自定义消息整卡渲染；接收与**己方发送**都走这里 |
| `#input-toolbar` | — | 消息区与输入栏之间，随键盘上移；不注入不占高 |
| `#input-bar` | `EmChatInputBarScope` | 输入栏整栏自绘：结构全自绘，键盘避让/面板互斥/录音/禁言/@/草稿行为经 scope 契约由库内保持；插槽有无在页面创建时确定，不能运行时切换。契约字段见文档站「聊天页 · 整栏自绘输入栏」 |

详细用法见 `em-host-business-extension` 与 `em-host-ai-stream`。

### 4.6 组件已经替你做的事（不要重复）

- `enterConversation` / 拉历史 / 首屏滚底 / 加载更多；首屏与分页互斥，各自失败可重试且保留缓存；
- 未读清零（进会话、收消息、离页兜底，含服务端异步清零）；
- 草稿保存与恢复、typing 发送/展示、单聊已读回执（可配置关闭）；
- 键盘避让、面板互斥、引用条、撤回/失败重发、时间分隔条；文本与直发快捷回复共享提交锁，重发/撤回/删除按 `localId` 防重，domain 重发 Promise 跨页面实例共享；
- 消息删除确认与复制结果提示：`deleteMessage` 有服务端 ID 时先删当前账号漫游历史再删本地，本地消息仅本地删除；`copyText` 返回 Promise，空文本/原生失败会 reject；
- 图片、视频与文件选择的取消静默、真实失败提示；发送/选择按发起会话与页面代次完成，旧回调不会误清新会话编辑或解锁新请求，未发送临时附件会 release；
- 附件打开与下载：文件单击与长按「下载」共用链路，App/小程序优先本地打开自己已发送的文件，失败再远端下载；图片/视频保存到相册，其他文件下载后打开文档，H5 走浏览器下载；宿主自绘卡片可调 `EmKit.downloadAttachment(message)` 复用；
- 复合消息：接收 SDK 5.2.0 的 `multi_body` 后在单气泡内有序展示七类分段；`EmMessageItem.segments` 透出展示模型，支持首段摘要与文本分段复制。UIKit 不提供复合消息创建或发送 API；
- 连接状态条、首屏骨架、历史失败重试、空态。

宿主只需路由与事件；额外调 `loadHistory` 只用于**预加载**，不是必须。

## 5. 聊天详情页

```vue
<template>
  <view class="page" :class="themeClass">
    <em-chat-info-page
      v-if="conversationId !== ''"
      :conversation-id="conversationId"
      :chat-type="chatType"
      @back="onBack"
      @deleted="onExit"
      @leaved="onExit"
      @contact-deleted="onExit"
      @chat-member="onChatMember"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { CONVERSATION_TYPE, EmKit, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'
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

// 删除会话/退群/解散/删除好友：聊天详情 ← 聊天页 ← 会话列表，退两层
function onExit(): void {
  uni.navigateBack({ delta: 2 })
}

function onChatMember(userId: string): void {
  EmKit.addConversation(userId, CONVERSATION_TYPE.SINGLE_CHAT)
  uni.navigateTo({ url: `/sub-im/pages/chat/chat?conversationId=${userId}&chatType=${CONVERSATION_TYPE.SINGLE_CHAT}` })
}

function onBack(): void {
  uni.navigateBack({ delta: 1 })
}
</script>
```

| Props | 类型 | 默认 | 说明 |
|---|---|---|---|
| `conversationId` | `string` | 必传 | 会话 id |
| `chatType` | `'singleChat' \| 'groupChat'` | 必传 | 单聊/群聊分支 |
| `showMemberGrid` | `boolean` | `true` | 群成员宫格（群聊） |
| `showGroupName` | `boolean` | `true` | 群名称字段行（群聊） |
| `showAnnouncement` | `boolean` | `true` | 群公告字段行（群聊） |

| 事件 | 何时触发 | 宿主处理 |
|---|---|---|
| `back` | 点返回 | `navigateBack`（组件不自退） |
| `deleted` | 删除会话成功 | 退场 |
| `leaved` | 退群/解散成功 | 退场 |
| `contact-deleted` | 删除好友成功（不删会话，单聊分支且对方已是好友时有该按钮） | 退场 |
| `invite` / `remove-members` / `open-members` | 群管理内部已闭环，仅通知 | 一般无需处理 |
| `chat-member` | 成员宫格点私聊 | `addConversation` + 跳聊天页 |

详情页开关直接读会话 store，pin/mute 请求中禁用并按各自队列保护最新意图。删除会话/删除好友/退群/解散共享 exitPending/exitCompleted，确认后、SDK 写操作前占锁且按钮同时禁用，只发出一次成功事件，避免交叉操作重复退场。群名/公告保存中不能取消或关闭；邀请与批量移除不额外确认，选人提交中不能改选或关闭。设撤管理员、转让、移除会在确认时重验角色，移除后强制刷新群详情与成员首屏。

## 6. 定制顺序（从轻到重）

1. **props**：标题、隐藏详情入口、成员数、公告、昵称行、快捷回复、菜单裁剪；
2. **事件**：返回拦截（`:auto-back="false"`）、埋点、业务菜单；
3. **插槽**：banner、空态、自定义卡片、输入栏入口、富文本流式；
4. **CSS token**：`--em-*` 变量（主题、品牌色）；
5. 仍不满足时，才考虑不用页面组件、自己组合原子组件（成本高，且要自己接数据层）。

不要修改 `uni_modules/easemob-uikit-uni/` 内部源码——升级会被覆盖。

## 7. 未读与角标

```ts
import { useTabBarBadge, useUnreadCounts, useConversationUnreadCount } from '@/uni_modules/easemob-uikit-uni/libs'

// 原生 tabBar：在任一 tab 页 setup 调用一次；onShow 补同步（平台要求当前页是 tabBar 页）
const badge = useTabBarBadge({ conversationIndex: 0, contactIndex: 1 })
onShow(() => badge.sync())

// 自定义入口角标
const { conversationUnread } = useUnreadCounts()
const peerUnread = useConversationUnreadCount(peerUserId) // 业务入口用
```

- 聊天页内会自动清未读（本地立即 + 服务端异步）。
- 宿主自建入口读完消息后兜底：`EmKit.clearConversationUnread(conversationId, chatType)`。
- 非 setup 场景用快照：`EmKit.conversationUnreadCount` / `EmKit.conversationUnreadCountOf(id)`。
- 总未读口径**包含免打扰会话**（免打扰只抑制提醒，不抹未读）。

## 8. 验收清单

- [ ] 会话页首屏有历史会话，骨架不卡死
- [ ] 点击会话进入聊天页，历史、滚底、未读清零正常
- [ ] 单聊/群聊 `chatType` 正确（群公告/@/昵称行生效）
- [ ] 返回列表后未读为 0，杀进程重进仍为 0
- [ ] 聊天详情返回/删除/退群退场正确（不白屏、不残留页面）
- [ ] 深色模式下页面背景与组件一致
- [ ] 键盘弹起时输入栏不被顶飞、消息列表自动滚底

## 9. 常见坑

| 现象 | 根因 | 修复 |
|---|---|---|
| 聊天页白屏/输入栏不见 | 根节点无高度或 flex 链断 | `.page { height:100%; display:flex; flex-direction:column }` |
| 双导航栏 | 没设 `navigationStyle: custom` | 页面 style 补上 |
| 点会话进群聊却像单聊 | 用了固定 `chatType` 或没接 `select` 第二参 | 用事件给的 `chatType` |
| 从聊天页返回列表不刷新 | 只在 onLoad 同步 | `onShow` 调 `EmKit.syncConversations()` |
| 登录后被弹回 | 用 `status !== online` 做守卫 | 改 `EmKit.state.userId === ''` |
| 返回时页面退两次 | `autoBack` 仍为 true 且宿主又 `navigateBack` | 拦截时传 `:auto-back="false"` |
| 详情页删除后退回聊天页 | `deleted` 只退一层 | 退两层或按页面栈处理 |
| 未读又冒出来 | 宿主自建入口没清服务端未读 | 调 `clearConversationUnread` 兜底 |
