# 会话列表页（em-conversation-page）

`em-conversation-page` 是登录后进入 IM 的第一个页面：它把 SDK 的会话快照渲染成列表，并由组件自身完成筛选、搜索、置顶、免打扰、删除与发起单聊。宿主只需要提供登录守卫、路由和跳转目标，不需要自己维护会话顺序与未读状态。

页面组件位于 `uni_modules/easemob-uikit-uni/components/pages/em-conversation-page/em-conversation-page.vue`，在宿主工程中通常由一个薄页面壳承载（例如 `pages/conversation/conversation.uvue`），页面壳负责 tabBar、登录校验与路由，列表本身由组件负责。

## 界面预览

会话列表（Android 真机）：

<DocsImage src="assets/shots/android/l1-android-conversation-list.webp" alt="会话列表" :width="750" :height="1625" eager />

新账号空态（Android 真机）：

<DocsImage src="assets/shots/android/l1-android-conversation-empty.webp" alt="会话空态" :width="750" :height="1625" />

更多端与更多状态见[界面截图](./SCREENSHOTS.md)。

## 页面位置与接入方式

- 页面组件在 `components/pages/` 下，easycom 默认扫描不到，需要在 `pages.json` 增加 custom 规则（见 [快速开始](./QUICKSTART.md) 3.1 节）。
- 组件自带 `em-nav-bar`（本页不显示返回，右侧为「+」），路由注册时设 `navigationStyle: "custom"`，App 端同时设 `app-plus.titleNView: false`，避免双标题栏。
- 页面壳根节点必须是 `display: flex; flex-direction: column; height: 100%`，否则页面内的 `scroll-view` 会被压成 0 高度，表现为白屏。
- 页面壳根节点绑定 `themeClass`，宿主自绘的弹层、悬浮按钮才能与组件同一主题。

## 能力

- **会话列表**：头像、展示名、最后一条消息摘要、时间、未读数、免打扰状态；草稿存在时优先展示草稿摘要，时间取「草稿时间」与「最后消息时间」的较大者。
- **名称回落链**：单聊优先用户昵称/头像，其次 SDK 会话的 `name`/`avatar`，最后回落 `conversationId`；群聊优先群数据层里的群名/群头像，其次 SDK 会话字段，最后回落 `groupId`。
- **排序**：置顶会话整体在前，置顶区间内按置顶时间倒序；非置顶会话按最后消息时间倒序。排序在本地做稳定排序，不会因为资料刷新或进入会话而打乱置顶顺序。
- **筛选 tab**：默认「全部 / 未读 / @我 / 单聊 / 群组」，传空数组隐藏整条 tab 栏；每个 tab 有独立空态文案。
- **搜索**：顶部搜索条默认显示，按展示名、会话 ID、最后一条消息摘要做本地过滤，大小写不敏感；搜索无结果与列表为空使用不同空态文案。
- **长按菜单**：置顶/取消置顶、免打扰/取消免打扰、删除会话。菜单项与顺序由 `uiConfig.conversationMenuKeys` 决定；删除先二次确认，三类操作按会话与动作防重，失败时 toast 提示。
- **右上角「+」**：「发起单聊」由组件自身闭环（弹出选人面板 → 排除自己 → `EmKit.addConversation` → 以 `select` 事件透出对方 userId）；「创建群组」以 `menu` 事件交给宿主跳群组页。
- **首次同步与失败恢复**：`loaded / syncing / syncFailed` 区分未加载、加载中、失败与权威空列表。首次同步且列表为空时展示 6 条骨架；后台同步或主动刷新失败且无缓存时显示错误与重试，已有缓存继续显示。重试调用真实 `refreshSessionList`，失败不会用内存快照伪装成功；只有同步成功后的空列表才显示普通空态。
- **连接状态条**：顶部展示重连中/断开/被踢状态，可经 `showConnectionBanner=false` 关闭。
- **空态插槽**：`#empty` 可整体替换默认空态，搜索无结果与空列表都生效。

## 最小用法

```vue
<template>
  <view class="page" :class="themeClass">
    <em-conversation-page @select="onSelect" @menu="onMenu" />
  </view>
</template>

<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { EmKit, CONVERSATION_MENU_KEY, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'
import type { ConversationTypeValue } from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass } = useTheme()

function ensureLogin(): boolean {
  if (EmKit.state.userId === '') {
    uni.reLaunch({ url: '/pages/login/login' })
    return false
  }
  return true
}

onLoad(() => {
  // 组件默认 autoSync=true，挂载后会自行拉一次快照；这里只做登录守卫。
  ensureLogin()
})

onShow(() => {
  // 组件拿不到页面级 onShow，从聊天页返回后的补同步由宿主负责。
  if (ensureLogin()) EmKit.syncConversations().catch(() => {})
})

function onSelect(conversationId: string, chatType: ConversationTypeValue) {
  uni.navigateTo({ url: `/pages/chat/chat?conversationId=${conversationId}&chatType=${chatType}` })
}

function onMenu(key: string) {
  if (key === CONVERSATION_MENU_KEY.CREATE_GROUP) {
    uni.navigateTo({ url: '/pages/group/group' })
  }
}
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';

.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: var(--em-conversation-list-bg);
}
</style>
```

## 宿主接线

| 可见控件 | 事件或默认行为 | 宿主必须做什么 | 不接的后果 |
|---|---|---|---|
| 会话条目 | `select(conversationId, chatType)` | 跳聊天页并传两个参数 | 点击后停留在当前页 |
| 右上「+」→ 发起单聊、选人完成 | `select(...)`；组件已创建本地会话 | 同上，跳聊天页 | 选人后不进入会话 |
| 右上「+」→ 创建群组 | `menu('create-group')` | 跳群组页 | 菜单项没有页面动作 |
| 长按会话的置顶/免打扰/删除 | 组件内部完成 | 无需接路由；按需做业务埋点 | 不适用 |

## Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `title` | `string` | `''` | 导航标题覆盖；空串使用内置会话标题 |
| `showSearch` | `boolean` | `true` | 顶部搜索条显隐 |
| `tabs` | `ConversationTabKeyValue[]` | `['all','unread','atMe','single','group']` | 筛选 tab 及顺序，取值来自 `CONVERSATION_TAB_KEY`；传 `[]` 隐藏 tab 栏 |
| `showTabs` | `boolean` | `true` | 筛选 tab 栏显隐；`false` 时无论 `tabs` 传什么都不渲染 |
| `emptyText` | `string` | `''` | 空列表文案；空串使用分 tab 的 i18n 默认文案。搜索无结果时不使用该值 |
| `autoSync` | `boolean` | `true` | 首次挂载自动拉取会话快照（要求 `EmKit.state.userId` 非空）；关闭后由宿主自行控制同步时机 |
| `showConnectionBanner` | `boolean` | `true` | 顶部连接状态条显隐 |
| `avatarShape` | `EmAvatarShape` | 跟随全局配置 | 会话头像形状局部覆盖；未传时读取 `uiConfig.avatarShape`，真实头像与首次同步骨架屏保持一致 |
| `watermark` | `string \| EmWatermarkOptions` | 未设置 | 组件级水印：字符串=文案、对象=可调样式，空串不显示；覆盖导航栏/连接条/横幅/公告/置顶/消息列表，**不含输入栏、面板与弹层**。不传则不渲染（零开销） |

## Events

| 事件 | 载荷 | 说明 |
|---|---|---|
| `select` | `conversationId: string`, `chatType: ConversationTypeValue` | 点击会话，或「发起单聊」选人完成。单聊时 `conversationId` 即对方 userId，群聊时为 groupId |
| `menu` | `key: string` | 右上角面板中的业务菜单项。`new-chat` 由组件自身处理，当前版本中实际透出的是 `create-group`；用 `CONVERSATION_MENU_KEY` 分发 |

## Slots

| 插槽 | 作用域 | 说明 |
|---|---|---|
| `empty` | 无 | 列表为空（含搜索无结果）时整体替换默认空态 |
| `title-extra` | `{ item: EmConversationItem, name: string, ext?: Record<string, unknown> }` | 条目标题旁的扩展位（标签/业务徽标）。`ext` 为 `EmKit.setConversationPresentation` 注入的业务载荷；缺省不渲染不占位 |
| `watermark` | `{ keyword: string }` | 水印覆盖层，铺满导航栏/连接条/筛选 tab/搜索/列表，`pointer-events: none` 不响应交互；缺省渲染 `em-watermark` |

## 宿主接线

1. **路由与导航**：页面壳设 `navigationStyle: "custom"`；`select` 拿到 `conversationId` 与 `chatType` 后跳聊天页，参数名保持一致。
2. **跳转前预热（可选）**：在 `select` 里先 `EmKit.enterConversation(id, chatType)` 与 `EmKit.loadHistory(id, chatType)`（fire-and-forget），聊天页打开时就能直接渲染缓存，减少进入停顿。
3. **`menu` 分发**：`create-group` 跳群组列表页（群组页本身就是建群入口），其他 key 按业务需要扩展。
4. **返回刷新**：在页面 `onShow` 调 `EmKit.syncConversations()`；`autoSync` 只覆盖首次挂载。
5. **tabBar 角标**：如需会话/联系人红点，用 `useTabBarBadge({ conversationIndex: 0, contactIndex: 1 })`，在 `onShow` 调 `sync()`。
6. **登录守卫**：用 `EmKit.state.userId === ''` 判断未登录，不要用 `status !== 'online'`，否则断网重连会被误判为未登录。

## 行为与边界

- 当前版本支持 Android、iOS、鸿蒙、H5 与微信小程序；列表滚动统一由 `scroll-view` 承载，不依赖平台原生列表。
- 搜索只覆盖本地会话快照（展示名、会话 ID、最后一条消息摘要），当前版本不提供服务端消息搜索。
- 「@我」筛选与列表中的 @ 标记来自收到消息 `ext.em_at_list` 的命中记录；进入对应会话后清除，不会跨会话累计。
- 长按菜单的可用项受 `uiConfig.conversationMenuKeys` 约束；删除会话先二次确认，取消不执行请求，确认后删除 SDK 会话、本地消息缓存与持久化草稿。置顶与免打扰按会话分别串行，旧响应不覆盖最新意图，失败回滚最近已确认状态。
- 群会话的名称与头像依赖群数据层：群资料尚未拉取时显示 SDK 会话字段或 groupId，拉取成功后自动回填，无需宿主刷新。
- 发起单聊时选择自己会被拦截并 toast；选人面板的候选来自当前联系人快照，联系人未同步时列表可能为空。
- 组件不执行任何页面跳转，返回、进入聊天页、进入群组页都由宿主事件接线决定。

## 相关文档

- [聊天页](./PAGES-CHAT.md)
- [聊天信息与群资料](./PAGES-CHAT-INFO.md)
- [通讯录与好友](./PAGES-CONTACTS.md)
- [会话与导航组件](./COMPONENTS-CONVERSATION.md)
- [EmKit 会话 API](./API-KIT-CONVERSATIONS.md)
- [配置参考](./CONFIG.md)
- [快速开始](./QUICKSTART.md)
