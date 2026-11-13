# 会话与导航组件

这页覆盖会话列表用到的三个原子组件：列表行 `em-conversation-item`、筛选 tab `em-conversation-tabs`、连接状态条 `em-connection-banner`。三者都是纯展示组件——不连 store、不碰路由，数据由宿主装配，交互以事件抛出。整页实现见 [会话列表页](./PAGES-CONVERSATION.md)。

本页组件均符合 easycom 目录约定，可直接写标签；引入方式见 [组件总览与选型](./COMPONENTS.md)。所有组件都支持 `custom-class` / `custom-style` 根节点样式透出，用法见 [样式定制](./GUIDE-STYLING.md)。

## em-conversation-item

会话列表行：头像、名称、置顶与免打扰标记、@我标记、最后一条消息摘要（或草稿）、格式化时间、未读徽标。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `item` | `EmConversationItem` | 必填 | 会话数据：置顶、免打扰、未读数、最后消息摘要等 |
| `name` | `string` | 必填 | 展示名，由页面侧完成"昵称 > 会话名 > id"的回落 |
| `avatar` | `string` | 必填 | 头像地址，由页面侧合并用户资料与会话头像 |
| `avatarShape` | `EmAvatarShape` | 跟随全局配置 | 头像形状局部覆盖；未传时由内置 `em-avatar` 读取 `uiConfig.avatarShape` |
| `timeText` | `string` | 必填 | 已格式化的时间文本（今天显示时刻、更早显示日期），草稿时间也由页面侧并入 |
| `draft` | `{ text: string, time: number } \| null` | 必填 | 草稿；`null` 时展示 `item.lastMessageText` |
| `hasAtMe` | `boolean` | `false` | 群聊"有人@我"未读标记：名称主色高亮，摘要前加"有人@我"前缀 |
| `ext` | `Record<string, unknown>` | — | 宿主业务载荷（`EmKit.setConversationPresentation` 注入），随 `#title` / `#title-extra` / `#avatar` 插槽作用域透出 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `click` | `conversationId: string` | 点击整行 |
| `long-press` | `conversationId: string` | 长按整行，宿主据此弹动作菜单 |

| 插槽 | 作用域 | 说明 |
|---|---|---|
| `title` | `{ item, name, ext? }` | 整标题自绘（替换默认名称文本与@我高亮）；缺省回落内置标题 |
| `title-extra` | `{ item, name, ext? }` | 标题旁的扩展位（标签/业务徽标），缺省不渲染不占位 |
| `avatar` | `{ item, avatar, ext? }` | 整头像自绘；缺省回落内置 `em-avatar` |

`EmConversationItem` 的字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `conversationId` | `string` | 会话 id（单聊为对方 userId，群聊为 groupId） |
| `chatType` | `EmChatType` | `singleChat` / `groupChat` |
| `name` | `string` | 会话名 |
| `avatar` | `string` | 会话头像 |
| `unreadCount` | `number` | 未读数 |
| `lastMessageText` | `string` | 最后一条消息的展示摘要 |
| `lastMessageTime` | `number` | 最后消息时间戳（毫秒） |
| `isPinned` | `boolean` | 是否置顶 |
| `pinnedTime` | `number` | 置顶时间戳，列表排序用 |
| `isMuted` | `boolean` | 是否免打扰 |

```vue
<template>
  <em-conversation-item
    :item="row.item"
    :name="row.name"
    :avatar="row.avatar"
    :time-text="row.timeText"
    :draft="row.draft"
    :has-at-me="row.hasAtMe"
    @click="openChat"
    @long-press="openMenu"
  />
</template>
```

（`row` 的五个字段与跳转函数由宿主装配，`row.item` 为 `EmConversationItem`。）

```vue
<script setup lang="ts">
function openChat(conversationId: string): void {
  uni.navigateTo({ url: `/pages/chat/chat?id=${conversationId}` })
}

function openMenu(conversationId: string): void {
  // 宿主弹 em-action-sheet
}
</script>
```

**行为与平台**：置顶与免打扰各有一个 12px 的弱化图标，紧跟名称之后；免打扰会话的未读降级为 8px 红点，非免打扰才显示数字徽标（截断由 `em-badge` 负责）。`hasAtMe` 为真时，名称与摘要前缀都切到主色，且摘要前缀优先于草稿态。H5 上长按后浏览器仍会补发一次 `click`，组件内部会吞掉长按抬手那一次点击，因此长按弹菜单时不会同时进入会话；该处理在其他端无副作用。行组件自身不做按下反馈与滑动操作，需要的话在宿主侧包一层。

## em-conversation-tabs

会话筛选 tab：胶囊横排，溢出时横向滑动，没有计数徽标。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `tabs` | `ConversationTabKeyValue[]` | 全部五项：`all` / `unread` / `atMe` / `single` / `group` | 展示哪些 tab 及顺序；传空数组时不渲染内容 |
| `active` | `ConversationTabKeyValue` | 必填 | 当前激活 tab |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `change` | `tab: ConversationTabKeyValue` | 点击某个 tab |

无插槽。

```vue
<template>
  <view class="page" :class="themeClass">
    <em-conversation-tabs :active="activeTab" @change="onTabChange" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ConversationTabKeyValue } from '@/uni_modules/easemob-uikit-uni/libs'

const activeTab = ref<ConversationTabKeyValue>('all' as ConversationTabKeyValue)

function onTabChange(tab: ConversationTabKeyValue): void {
  activeTab.value = tab
}
</script>
```

只展示"未读"与"群聊"两个 tab 时传 `tabs`：

```vue
<em-conversation-tabs
  :tabs="['unread', 'group']"
  :active="activeTab"
  @change="onTabChange"
/>
```

**行为与平台**：tab 文案走 i18n（`conversation.tabAll`、`conversation.tabUnread`、`conversation.tabAtMe`、`conversation.tabSingle`、`conversation.tabGroup`），随语言切换。激活态通过胶囊底色与文字颜色切换表达，组件不自己维护激活值，`active` 完全受控，所以点同一个 tab 也会照常派发 `change`，需要幂等的话由宿主判断。横向滚动用 `scroll-view scroll-x`，隐藏滚动条。

## em-connection-banner

连接状态条：在页面顶部用一条轻量提示表达"连接中 / 重连中 / 已断开 / 被踢 / Token 过期"。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `show` | `boolean` | `true` | 是否允许展示；页面级开关透传，`false` 时始终不渲染 |

无事件、无插槽。

```vue
<em-connection-banner :show="showConnectionBanner" />
```

**行为与平台**：组件只读连接状态（`connectionStore`），不参与业务。`online` 与 `idle` 状态下不渲染任何内容；`connecting` 与 `reconnecting` 用警示色 + 环形箭头图标 + 对应文案；`closed` 时被踢/账号失效终态（`kicked=true`，错误码 206/207/214/216/217）按 `kickCode` 分流——206 显示"当前账号已在其他设备登录"、216 显示"账号密码已修改，请重新登录"、214 显示"登录设备数超过限制，当前设备已下线"、其余显示"当前账号已被迫下线，请重新登录"；其余断开再按原因分流——`token-expired` 显示 Token 过期、`limit` 显示设备数超限被踢、其余显示网络异常，全部用错误色 + 感叹号图标。状态条是浅色底的轻量条，不遮挡内容，暗色模式随 token 切换。整页场景下由 `em-conversation-page` / `em-chat-page` 的 `showConnectionBanner` 控制显隐，单独使用时自行传 `show`。

## 页面组件：em-conversation-page

会话列表整页：搜索、筛选 tab、置顶/免打扰/未读、长按菜单、连接状态条、空状态，数据订阅与列表刷新都在页面内部完成。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `showSearch` | `boolean` | `true` | 顶部搜索条显隐 |
| `tabs` | `ConversationTabKeyValue[]` | 全部五项 | 筛选 tab 及顺序；传空数组隐藏 tab 栏 |
| `showTabs` | `boolean` | `true` | 筛选 tab 栏显隐；`false` 时无论 `tabs` 传什么都不渲染 |
| `emptyText` | `string` | `''` | 空列表文案；空串走 i18n 默认 |
| `autoSync` | `boolean` | `true` | 首次挂载是否自动拉会话快照 |
| `showConnectionBanner` | `boolean` | `true` | 顶部连接状态条显隐 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `select` | `conversationId: string, chatType: ConversationTypeValue` | 选中会话，宿主跳聊天页 |
| `menu` | `key: string` | 右上角「+」动作面板中的业务菜单项，当前为 `create-group`；会话长按菜单由组件内部处理 |

| 插槽 | 作用域 | 说明 |
|---|---|---|
| `empty` | — | 覆盖默认空状态 |

完整契约、宿主接线与行为边界见 [会话列表页](./PAGES-CONVERSATION.md)，本页不重复。

## 相关文档

- 上一页：[基础组件](./COMPONENTS-BASIC.md)
- 下一页：[聊天与消息组件](./COMPONENTS-CHAT.md)
- 类型与常量：[类型与常量](./API-TYPES.md)
- 平台差异：[平台能力与差异](./PLATFORM.md)
