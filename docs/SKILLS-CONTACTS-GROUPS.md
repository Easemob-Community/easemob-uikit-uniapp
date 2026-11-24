<!-- Generated from skills/em-host-contacts-groups/SKILL.md by scripts/sync-skills-docs.mjs. Do not edit directly. -->

# 通讯录 / 好友申请 / 群组

> 基线：UIKit `1.0.3` · websdk `5.2.0`。所有页面组件自带导航栏，宿主只做根容器、路由与事件接线。
> 前置：已完成 `em-host-integration` 的安装、初始化与登录。

## 1. 页面与路由总览

```text
通讯录 tab（em-contact-page）
├── 好友列表   entry key = contact  → em-contact-list-page → 聊天页
├── 群组       entry key = group    → em-group-page → 聊天页（groupChat）
└── 新请求     entry key = notice   → em-contact-requests-page（接受/拒绝内置）
```

| 组件 | Props | 事件 | 宿主必须做 |
|---|---|---|---|
| `em-contact-page` | 无 | `entry-click(key)` / `add` | 按 key 路由三入口；`add` 打开自己的加好友 UI |
| `em-contact-list-page` | `menuKeys` / `autoSync` | `select(userId)` / `back` | 跳聊天页或资料页；返回退场 |
| `em-contact-requests-page` | 无 | `back` | 返回退场；接受/拒绝已内置 |
| `em-group-page` | `showNameInput` / `showSettings` | `click-group(groupId)` / `created(groupId)` / `back` | 跳群聊；建群成功跳群聊 |
| `em-chat-info-page` | 见 `em-host-conversation-chat` | `chat-member` / `deleted` / `leaved` / `back` 等 | 退场与成员私聊 |

## 2. 通讯录入口页

```vue
<template>
  <view class="page" :class="themeClass">
    <em-contact-page @entry-click="onEntryClick" @add="showAdd = true" />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { CONTACT_ENTRY_KEY, EmKit, useTabBarBadge, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass } = useTheme()
const badge = useTabBarBadge({ conversationIndex: 0, contactIndex: 1 })
const showAdd = ref(false)

onShow(() => {
  badge.sync()
  if (EmKit.state.userId === '') {
    uni.reLaunch({ url: '/pages/login/login' })
    return
  }
  EmKit.syncContacts().catch(() => {})
})

function onEntryClick(key: string): void {
  if (key === CONTACT_ENTRY_KEY.NOTICE) {
    uni.navigateTo({ url: '/sub-im/pages/contact-requests/contact-requests' })
  } else if (key === CONTACT_ENTRY_KEY.GROUP) {
    uni.navigateTo({ url: '/sub-im/pages/group/group' })
  } else if (key === CONTACT_ENTRY_KEY.CONTACT) {
    uni.navigateTo({ url: '/sub-im/pages/contact-list/contact-list' })
  }
}
</script>

<style>
@import '@/uni_modules/easemob-uikit-uni/libs/style/variables.css';
.page { display: flex; flex-direction: column; height: 100%; background-color: var(--em-conversation-list-bg); }
</style>
```

入口页内置：

- 三个入口及计数：好友数、群组数、待处理申请数；
- 新请求入口的 pending 计数与 hot 红点；
- 顶部「+」触发 `add`。

**没有**内置加好友表单：这是宿主业务 UI，提交时调：

```ts
await EmKit.addContact(userId, '我是某某')   // 第二参为验证消息，可空
```

## 3. 好友列表

```vue
<template>
  <view class="page" :class="themeClass">
    <em-contact-list-page @select="onSelect" @back="onBack" />
  </view>
</template>

<script setup lang="ts">
import { CONVERSATION_TYPE, EmKit, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass } = useTheme()

function onSelect(userId: string): void {
  EmKit.enterConversation(userId, CONVERSATION_TYPE.SINGLE_CHAT).catch(() => {})
  EmKit.loadHistory(userId, CONVERSATION_TYPE.SINGLE_CHAT).catch(() => {})
  uni.navigateTo({ url: `/sub-im/pages/chat/chat?conversationId=${userId}&chatType=${CONVERSATION_TYPE.SINGLE_CHAT}` })
}

function onBack(): void {
  uni.navigateBack({ delta: 1 })
}
</script>
```

| Props | 类型 | 默认 | 说明 |
|---|---|---|---|
| `menuKeys` | `ContactMenuKeyValue[]` | `['delete']` | 条目长按菜单；当前版本提供删除好友 |
| `autoSync` | `boolean` | `true` | 首次挂载读好友快照 |

- 内置：A–Z + `#` 字母分组、右侧索引条、搜索、长按删除好友、空态；`loaded / syncing / syncFailed` 区分未加载、加载中、失败与权威空列表，无缓存失败显示重试，有缓存时保留列表。重试调用 SDK `refreshContactSnapshot` 受控刷新。
- 删除好友先二次确认并按 userId 防重，取消不发请求，失败保留状态；只解除好友关系，不删除会话与消息。
- 条目展示名回落：备注 > 昵称 > userId。
- 拼音分组默认按昵称首字符；需要多音字/自定义拼音时用 `setPinyinAdapter` 注入，零依赖降级。
- 当前版本未提供联系人详情页，点击条目默认不跳资料页；宿主可改为跳自己的业务资料页，再提供「发消息」按钮。

## 4. 好友申请 / 群邀请

```vue
<template>
  <view class="page" :class="themeClass">
    <em-contact-requests-page @back="onBack" />
  </view>
</template>
```

- 好友申请与群邀请**同表展示**，按 `invite.kind`（`contact` / `group`）区分。
- pending 态显示「接受/拒绝」，点击后组件内部调 `acceptContactInvite` / `declineContactInvite` / `acceptGroupInvite` / `declineGroupInvite`，并做幂等防重复点击；若好友快照证明对方已是好友，旧 pending 会直接收敛 accepted，不再显示按钮，未读角标同步减少。
- 已处理态只显示状态文字；我方发出后被处理的通知也在此展示。
- 邀请持久化在本地（`emkit.contact.invites`），重进不丢。
- 宿主只接 `back`；**不需要**自己调接受/拒绝 API。

需要自定义申请列表时，读 `EmKit.contacts.invites`（`EmContactInvite[]`），处理仍走上述 API。

## 5. 群组列表与建群

```vue
<template>
  <view class="page" :class="themeClass">
    <em-group-page
      :show-name-input="true"
      :show-settings="true"
      @click-group="onOpenGroup"
      @created="onOpenGroup"
      @back="onBack"
    />
  </view>
</template>

<script setup lang="ts">
import { CONVERSATION_TYPE, EmKit, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'

const { themeClass } = useTheme()

function onOpenGroup(groupId: string): void {
  EmKit.enterConversation(groupId, CONVERSATION_TYPE.GROUP_CHAT).catch(() => {})
  EmKit.loadHistory(groupId, CONVERSATION_TYPE.GROUP_CHAT).catch(() => {})
  uni.navigateTo({ url: `/sub-im/pages/chat/chat?conversationId=${groupId}&chatType=${CONVERSATION_TYPE.GROUP_CHAT}` })
}

function onBack(): void {
  uni.navigateBack({ delta: 1 })
}
</script>
```

| Props | 类型 | 默认 | 说明 |
|---|---|---|---|
| `showNameInput` | `boolean` | `false` | 建群面板是否显示群名称；false 时自动取前 3 名成员昵称 |
| `showSettings` | `boolean` | `false` | 是否显示公开群/允许邀请开关 |

- 内置：已加入群列表、建群面板（选人、名称、设置）、空态；无缓存同步失败显示重试，有缓存时保留列表。SDK 无群全量手动重启同步 API，失败后需恢复连接或重新登录，内存重读不会被当作成功。
- 建群不增加二次确认；创建中禁止更改选择、重复确认与关闭，失败保留选择和表单，成功才关闭。
- 建群成功后组件**已经**：`createGroup` → upsert 群 store → `addConversation` → 插入建群系统灰条 → toast → emit `created`。
- 宿主在 `created` 里只需跳聊天页；**不要再调一次 `addConversation` / `insertGroupNotice`**。
- 群条目点击与 `created` 可以共用同一个 handler。

自定义群列表/建群 UI 时用 API：

```ts
const groups = await EmKit.getJoinedGroups()
const groupId = await EmKit.createGroup({
  name: '项目群',
  description: '',
  members: ['user-a', 'user-b'],
  public: false,
  approval: false,
  allowInvites: true
})
EmKit.addConversation(groupId, CONVERSATION_TYPE.GROUP_CHAT)
```

## 6. 群详情与群管理

群详情复用 `em-chat-info-page`，`chatType="groupChat"`。它内置：

- 群成员宫格（首屏 8 个 + 添加/移除格 + 查看全部）；
- 群名称、群公告查看/编辑（含长度上限）；
- 成员管理视图：设/撤管理员、转让群主、移除成员、成员私聊入口；
- 邀请入群（选人弹层）、全员禁言、退群/解散；
- 群聊的免打扰/置顶/清空记录/删除会话。

宿主接线（完整代码见 `em-host-conversation-chat` 第 5 节）：

```vue
<em-chat-info-page
  :conversation-id="conversationId"
  :chat-type="chatType"
  @back="onBack"
  @deleted="onExit"
  @leaved="onExit"
  @chat-member="onChatMember"
/>
```

权限模型（组件内按角色显隐，宿主无需判断）：

| 角色 | 典型能力 |
|---|---|
| owner | 改名/公告/管理员/转让/移除管理员与普通成员/解散 |
| admin | 公告/移除普通成员 |
| member | 查看、邀请（若群允许）、退群 |

设撤管理员、转让与单成员移除先确认并在确认时重验角色；邀请与批量移除不额外确认。群名/公告保存中不能取消或关闭，选人提交中不能改选或关闭；移除后强制刷新群详情与成员首屏。全员禁言的开关走 API，页面只负责按群状态禁输入。

群管理 API（自定义 UI 时用）：

```ts
await EmKit.updateGroupInfo(groupId, { name: '新群名' })
await EmKit.updateGroupAnnouncement(groupId, '公告内容')
await EmKit.inviteUsersToGroup(groupId, ['user-c'])
await EmKit.removeGroupMembers(groupId, ['user-d'])
await EmKit.addGroupAdmin(groupId, 'user-e')
await EmKit.removeGroupAdmin(groupId, 'user-e')
await EmKit.changeGroupOwner(groupId, 'user-f')
await EmKit.muteAllGroupMembers(groupId)
await EmKit.unmuteAllGroupMembers(groupId)
await EmKit.leaveGroup(groupId)
await EmKit.destroyGroup(groupId)   // 仅群主
```

> 这些写操作成功后，UIKit 内部会同步群 store、会话名与系统灰条；宿主不要重复写。

自定义详情/成员列表时：`getGroupInfo(groupId, force?)` 默认复用在途请求，`force=true` 强制新读且只有最新响应写 store。`getGroupMemberList` 返回 `EmGroupMemberListResult`：当前成功写入为 `applied=true`；陈旧成功 resolve `applied=false`，陈旧失败 reject 同类型结构化结果，当前真实失败保留原始 error。resolve 与 catch 中都不能消费 `applied=false` 的 `items/cursor/hasMore`。

## 7. 数据层与响应式

```ts
import {
  contactStore, groupStore, contactDisplayNameOf, groupDisplayNameOf,
  pendingInviteCount, contactRequestUnreadCount
} from '@/uni_modules/easemob-uikit-uni/libs'
```

| 数据 | 读取 |
|---|---|
| 好友列表 | `contactStore.items`（`EmContactItem[]`） |
| 好友申请/群邀请 | `contactStore.invites`（`EmContactInvite[]`） |
| 已加入群 | `groupStore.items`（`EmGroup[]`） |
| 群详情缓存 | `groupStore.infoByGroupId[groupId]` |
| 待处理申请数 | `pendingInviteCount()` / `contactRequestUnreadCount` |
| 展示名 | `contactDisplayNameOf(userId)` / `groupDisplayNameOf(groupId)` |

展示名统一走工具函数（备注 > 昵称 > userId；群名 > groupId），不要自己拼回落链。

## 8. 同步时机与「列表为空」

- 登录后 UIKit 会异步 `syncContacts()` + `getJoinedGroups()`，失败不阻塞登录。
- 好友/群数据来自 **SDK 后台同步**；刚登录的几秒内为空是正常的。`loaded / syncing / syncFailed` 区分未加载、加载中、失败与权威空列表。
- 页面 `onShow` 再调一次 `EmKit.syncContacts()` 会真实调用受控刷新；群列表组件自身只读快照，群后台失败后需恢复连接或重新登录。
- SDK 的 `enableSyncData` 必须包含 `'contact'`，否则好友同步不启动（UIKit 已默认开启，宿主不要覆盖）。
- H5 清缓存/换浏览器后首次登录，等同步完成或手动重试。
- 如果登录很久仍为空：查 `EmKit.state` 是否 online、token 是否有效、AppKey 是否正确。

## 9. 验收清单

- [ ] 通讯录三入口计数正确，点击各自到达正确页面
- [ ] 好友列表有数据、字母索引可跳转、搜索可用
- [ ] 新请求页接受好友申请后，好友列表出现该用户
- [ ] 群邀请接受后，群列表出现该群，点进去是群聊（群公告可见）
- [ ] 建群成功直接进群聊，会话列表出现该群，群内有建群灰条
- [ ] 群详情：改名/公告/邀请/移除按角色显隐，操作后列表与聊天页同步
- [ ] 退群/解散后退场正确，会话列表不再出现

## 10. 当前版本不提供

黑名单/白名单管理页、联系人详情页、群共享文件、公开群入群审批、群名片、群已读回执详情、presence 在线状态。需要这些能力时由宿主基于环信 SDK 与业务页面自行实现。
