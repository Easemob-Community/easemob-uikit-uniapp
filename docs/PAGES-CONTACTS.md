# 通讯录与好友（em-contact-page / em-contact-list-page / em-contact-requests-page）

通讯录由三个页面组件组成：入口页负责「好友 / 群组 / 新请求」三个入口与计数，好友列表页负责字母分组、索引条与好友管理，新请求页负责好友申请与群邀请的处理。三者都只读取 UIKit 的联系人数据层，不互相依赖，宿主按自己的路由结构组合即可。

| 页面组件 | 源码 | 职责 | 典型路由 |
|---|---|---|---|
| `em-contact-page` | `components/pages/em-contact-page/em-contact-page.vue` | 通讯录入口：三入口、计数、红点、添加入口 | tabBar 页或通讯录首页 |
| `em-contact-list-page` | `components/pages/em-contact-list-page/em-contact-list-page.vue` | 好友全量列表：字母分组、索引条、搜索、长按删除 | `contact-list` |
| `em-contact-requests-page` | `components/pages/em-contact-requests-page/em-contact-requests-page.vue` | 好友申请与群邀请：接受/拒绝、状态展示 | `contact-requests` |

三个页面组件都在 `components/pages/` 下，需要 `pages.json` 的 custom easycom 规则（见 [快速开始](./QUICKSTART.md) 3.1 节）；都自带 `em-nav-bar`，路由设 `navigationStyle: "custom"`，App 端同时设 `app-plus.titleNView: false`。

## 通讯录入口页（em-contact-page）

入口页位于通讯录 tab 或通讯录首页，负责把用户带到好友列表、群组列表和新请求页。它不渲染好友本体，也不处理申请逻辑。

### 能力

- 三个固定入口，顺序为「好友 / 群组 / 新请求」；入口无左侧图标，右侧展示计数。
- 计数来源：好友数取联系人快照长度，群组数取已加入群快照长度，新请求取未处理的申请/邀请数。
- 新请求数大于 0 时入口右侧带红点（hot 标记），处理后随数据层自动消失。
- 顶部搜索条只过滤入口本身（按入口文案或 key 子串匹配），不过滤好友；无命中时显示「未找到相关联系人」空态。
- 导航栏右侧「添加好友」入口，点击只发 `add` 事件；添加弹窗由宿主实现。

### 最小用法

```vue
<template>
  <view class="page" :class="themeClass">
    <em-contact-page @entry-click="onEntryClick" @add="onAdd" />
  </view>
</template>

<script setup lang="ts">
import { onLoad, onShow } from '@dcloudio/uni-app'
import { EmKit, CONTACT_ENTRY_KEY, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass } = useTheme()

onLoad(() => {
  if (EmKit.state.userId === '') {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  EmKit.syncContacts().catch(() => {})
})

onShow(() => {
  if (EmKit.state.userId !== '') EmKit.syncContacts().catch(() => {})
})

function onEntryClick(key: string) {
  if (key === CONTACT_ENTRY_KEY.NOTICE) {
    uni.navigateTo({ url: '/pages/contact-requests/contact-requests' })
  } else if (key === CONTACT_ENTRY_KEY.GROUP) {
    uni.navigateTo({ url: '/pages/group/group' })
  } else if (key === CONTACT_ENTRY_KEY.CONTACT) {
    uni.navigateTo({ url: '/pages/contact-list/contact-list' })
  }
}

function onAdd() {
  // 打开宿主自己的「添加好友」弹窗，提交时调用 EmKit.addContact(userId, message)
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

### Props

本页不接收 props。

### Events

| 事件 | 载荷 | 说明 |
|---|---|---|
| `entry-click` | `key: string` | 点击入口，取值见 `CONTACT_ENTRY_KEY`：`contact` / `group` / `notice` |
| `add` | 无 | 点击导航栏「添加好友」；弹窗与提交逻辑由宿主实现 |

### Slots

本页不对外提供插槽。

### 宿主接线

1. **路由分发**：按 `entry-click` 的 key 跳好友列表、群组列表或新请求页；三个 key 与路由一一对应。
2. **添加好友**：宿主自建弹窗，输入用户 ID 与验证信息，提交时调用 `EmKit.addContact(userId, message)`；建议先拦截「添加自己」。
3. **数据同步**：入口页的计数来自联系人/群组快照，`onLoad` 与 `onShow` 各同步一次，保证从二级页返回后计数是最新的。
4. **tabBar 角标**：联系人 tab 的红点可用 `useTabBarBadge({ conversationIndex: 0, contactIndex: 1 })`，在 `onShow` 调 `sync()`；非 tab 页调用会被平台拒绝，属预期。
5. **登录守卫**：用 `EmKit.state.userId === ''` 判断未登录。

## 好友列表页（em-contact-list-page）

好友列表页展示当前用户的全部好友，按展示名首字母分组，右侧提供字母索引条。

### 能力

- 展示名回落链：好友备注 > 用户昵称 > userId；头像优先用户资料头像，缺失回落好友快照头像。
- 字母分组：A-Z 加 `#`，空组自动剔除，组内按展示名排序；没有拼音结果的中文名会进入 `#` 组。
- 右侧字母索引条：点击或滑动跳转到对应分组并高亮；没有好友的字母置灰；首次加载完成后默认高亮第一组。
- 搜索：匹配展示名、userId；注入拼音适配器后同时匹配全拼与首字母（见下节）。
- `loaded / syncing / syncFailed` 区分未加载、加载中、失败与权威空列表。首次同步且无数据时展示 8 条骨架；后台或受控刷新失败且无缓存时显示错误与重试，有缓存或搜索无结果时保留原列表/空态，只有同步成功后的空列表才显示普通空态。重试调用 SDK `refreshContactSnapshot` 受控刷新。
- 长按好友打开操作菜单：当前版本只提供「删除好友」，二次确认后调用 `EmKit.deleteContact`，按 userId 防重复提交；成功 toast 并刷新列表，失败保留当前状态。
- 列表底部固定展示「没有更多了」：好友数据是 SDK 本地全量，没有分页。

### 最小用法

```vue
<template>
  <view class="page" :class="themeClass">
    <em-contact-list-page @select="onSelect" @back="onBack" />
  </view>
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { EmKit, CONVERSATION_TYPE, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass } = useTheme()

onLoad(() => {
  if (EmKit.state.userId === '') {
    uni.reLaunch({ url: '/pages/login/login' })
  }
})

function onSelect(userId: string) {
  // 可选：跳转前预热会话与历史
  EmKit.enterConversation(userId, CONVERSATION_TYPE.SINGLE_CHAT).catch(() => {})
  EmKit.loadHistory(userId, CONVERSATION_TYPE.SINGLE_CHAT).catch(() => {})
  uni.navigateTo({ url: `/pages/chat/chat?conversationId=${userId}&chatType=${CONVERSATION_TYPE.SINGLE_CHAT}` })
}

function onBack() {
  uni.navigateBack({ delta: 1 })
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

### Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `menuKeys` | `ContactMenuKeyValue[]` | `['delete']` | 长按菜单项与顺序，取值来自 `CONTACT_MENU_KEY`；当前版本仅 `delete` 可用 |
| `autoSync` | `boolean` | `true` | 首次挂载自动读好友快照（要求已登录）；关闭后由宿主控制同步时机 |

### Events

| 事件 | 载荷 | 说明 |
|---|---|---|
| `select` | `userId: string` | 点击好友，宿主跳聊天页 |
| `back` | 无 | 点击导航栏返回，路由由宿主执行 |

### Slots

本页不对外提供插槽。

### 拼音与字母索引

零运行时依赖，UIKit 不内置拼音库。默认情况下：

- 展示名首字符是 A-Z 的名字按首字母分组；
- 中文等非 A-Z 首字符全部落入 `#` 组；
- 搜索只匹配展示名与 userId 原文。

需要「张三 → Z」和全拼/首字母搜索时，宿主自行引入拼音库并在业务代码里注册适配器。UIKit 不打包任何拼音依赖，下面的示例用 `pinyin-pro` 说明适配器需要返回的数据形状（拼音库按目标端能力自行选择）：

```ts
import { setPinyinAdapter } from '@/uni_modules/easemob-uikit-uni/libs'
import { pinyin } from 'pinyin-pro'

setPinyinAdapter((text: string) => {
  const full = pinyin(text, { toneType: 'none', type: 'array' }).join('')
  const initials = pinyin(text, { pattern: 'first', toneType: 'none', type: 'array' }).join('')
  return {
    pinyin: full,
    initials,
    firstLetter: full.charAt(0).toUpperCase()
  }
})
```

适配器只在应用启动时注册一次即可；注入后分组、组内排序与搜索会同时使用拼音结果，适配器抛错时自动回落到原文匹配。

## 新请求页（em-contact-requests-page）

新请求页把好友申请与群邀请放在同一列表：收到的待处理项显示「接受 / 拒绝」，已处理或自己发出的项显示状态文案。

### 能力

- 列表按数据层顺序渲染，新申请插入顶部。
- 待处理且是收到的申请：展示主色「接受」与描边「拒绝」两个胶囊按钮；处理中按钮置灰，防重复提交。
- 已处理项：显示「已接受」/「已拒绝」状态文字；自己发出且被对方拒绝的申请，头像位替换为「人 + 双 X」图标。
- 好友申请接受/拒绝走 `EmKit.acceptContactInvite` / `EmKit.declineContactInvite`；群邀请走 `EmKit.acceptGroupInvite` / `EmKit.declineGroupInvite`，接受群邀请后群快照会自动刷新。
- 群邀请条目的标题优先用邀请快照里的群名，其次群数据层群名，最后回落 groupId；收到的群邀请副标题会拼接邀请人与附言。
- 无申请时展示「暂无新通知」空态。

### 最小用法

```vue
<template>
  <view class="page" :class="themeClass">
    <em-contact-requests-page @back="onBack" />
  </view>
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'
import { EmKit, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass } = useTheme()

onLoad(() => {
  if (EmKit.state.userId === '') {
    uni.reLaunch({ url: '/pages/login/login' })
  }
})

function onBack() {
  uni.navigateBack({ delta: 1 })
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

### Props

本页不接收 props。

### Events

| 事件 | 载荷 | 说明 |
|---|---|---|
| `back` | 无 | 点击导航栏返回，路由由宿主执行 |

### Slots

本页不对外提供插槽。

## 行为与边界

- 三个页面当前版本均支持 Android、iOS、鸿蒙、H5 与微信小程序；列表统一用 `scroll-view`，索引条为自绘组件。
- 好友申请与群邀请由 SDK 事件驱动写入数据层，页面不需要轮询；收到 `onContactAdded` 或好友快照加载时，已经是好友的历史 received pending 申请都会收敛为已接受并持久化，申请操作区与未读角标同步更新。即使旧数据仍是 pending，也不会再提供接受/拒绝按钮，直接调用处理逻辑同样先做好友关系守卫。
- 好友列表是 SDK 本地全量快照，没有服务端分页；搜索是本地过滤。好友未同步完成时列表可能为空或只显示骨架。
- 长按删除仅删除好友关系，不删除历史会话与消息；删除后会话仍可能出现在会话列表，按业务需要自行清理。取消确认不执行请求，失败 toast 后仍可重试。
- 新请求页的接受/拒绝操作幂等：同一申请处理中重复点击会被忽略，失败 toast 提示且保留原状态。
- H5 端长按后仍可能补发一次 click，好友列表已吞掉长按抬手那次点击，避免「长按删除菜单与进入聊天同时触发」。
- 拼音分组依赖宿主注入适配器；未注入时中文好友集中在 `#` 组，属于预期行为而不是数据丢失。
- 入口页的群组计数取自已加入群快照；群列表尚未拉取时计数可能为 0，进入群组页刷新后会回填。

## 相关文档

- [聊天页](./PAGES-CHAT.md)
- [群组列表与建群](./PAGES-GROUPS.md)
- [聊天信息与群资料](./PAGES-CHAT-INFO.md)
- [联系人与群组组件](./COMPONENTS-CONTACT.md)
- [EmKit API](./API-KIT.md)
- [类型与常量](./API-TYPES.md)
- [快速开始](./QUICKSTART.md)
