# 聊天信息与群资料（em-chat-info-page）

`em-chat-info-page` 是聊天页右上角详情入口指向的页面：单聊时展示对方资料与会话设置，群聊时在会话设置之外提供成员宫格、群名称、群公告、邀请/移除成员、成员管理视图，以及退出群聊/解散群聊。群资料的读取与写操作、权限判断都由组件自身完成，宿主只负责路由与退场。

页面组件位于 `uni_modules/easemob-uikit-uni/components/pages/em-chat-info-page/em-chat-info-page.vue`，同目录下的 `em-group-info-blocks.vue`、`em-group-field-dialog.vue`、`em-group-members-view.vue` 是页面内聚拆分，不单独对外暴露页面级契约。

## 页面位置与接入方式

- 页面组件在 `components/pages/` 下，需要 `pages.json` 的 custom easycom 规则（见 [快速开始](./QUICKSTART.md) 3.1 节）。
- 组件自带 `em-nav-bar`，路由设 `navigationStyle: "custom"`，App 端同时设 `app-plus.titleNView: false`。
- 页面壳根节点 `height: 100%` + flex 链，并绑定 `themeClass`。
- 必传 `conversationId` 与 `chatType`，参数来源与聊天页保持一致（单聊为对方 userId，群聊为 groupId）。

## 能力

### 单聊分支

- 顶部展示对方信息条：48px 头像、展示名（昵称回落 userId）、userId。
- 会话设置：免打扰、置顶两个开关，初值取会话快照，切换为乐观更新，失败回滚并 toast。
- 底部操作：清空聊天记录、删除会话（均带二次确认）；对方已是好友时额外显示「删除好友」（红色字档，二次确认，成功后发 `contact-deleted`）。

### 群聊分支

- **成员宫格**：按「群主 > 管理员 > 入群时间」排序展示前 8 名成员，另加「添加」「移除」操作格；成员总数超过首屏时显示「查看全部」。
- **成员搜索入口**：宫格上方的只读搜索框，点击进入成员管理视图。
- **群名称**：字段行展示当前群名；群主点击可打开编辑弹层（笔图标仅群主可见）。
- **群公告**：字段行展示公告摘要或空态提示；点击打开公告弹层，群主/管理员可在弹层内切换到编辑态。
- **邀请入群**：群主/管理员始终可见添加入口；普通成员仅在群允许成员邀请（`allowInvites=true`）时可见。弹层为多选联系人，已在群成员置灰不可选。
- **移除成员**：仅群主/管理员可见移除入口；候选为群成员，排除自己与群主。
- **成员管理视图**：页内全屏覆盖层，不改变路由；导航栏标题为「群成员 (N)」，支持按展示名/userId 搜索、角色角标（群主/管理员）、游标分页（每页 20）与成员操作菜单；首屏成员加载中展示条目骨架占位。
- **会话设置**：免打扰、置顶开关（与会话列表同一份状态）。
- **底部操作**：清空聊天记录、删除会话；群主额外看到「解散群聊」，其他成员看到「退出群聊」，均带二次确认。

## 最小用法

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

function onBack() {
  uni.navigateBack({ delta: 1 })
}

function onExit() {
  // 删除会话/退群/解散/删除好友成功后回到会话列表（聊天详情 ← 聊天页 ← 会话列表）
  uni.navigateBack({ delta: 2 })
}

function onChatMember(userId: string) {
  EmKit.addConversation(userId, CONVERSATION_TYPE.SINGLE_CHAT)
  uni.navigateTo({ url: `/pages/chat/chat?conversationId=${userId}&chatType=${CONVERSATION_TYPE.SINGLE_CHAT}` })
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
| 返回箭头 | `back` | `navigateBack` 或自定义退场 | 点击后停留当前页 |
| 群成员「发消息」 | `chat-member(userId)` | 创建/复用单聊会话并跳聊天页 | 点击后不进入私聊 |
| 删除会话 | `deleted(conversationId)` | 操作成功后退场 | 已删除但仍停留当前页 |
| 退群/解散 | `leaved(conversationId)` | 操作成功后退场 | 已退出但仍停留当前页 |
| 删除好友 | `contact-deleted(userId)` | 操作成功后退场 | 已删除但仍停留当前页 |
| 邀请/移除成员、打开成员视图 | `invite` / `remove-members` / `open-members` | 组件内部已完成，无需接路由 | 不适用，仅作通知 |

## Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `conversationId` | `string` | 必填 | 单聊为对方 userId，群聊为 groupId |
| `chatType` | `ConversationTypeValue` | 必填 | `CONVERSATION_TYPE.SINGLE_CHAT` 或 `GROUP_CHAT`，决定单聊/群聊分支 |
| `title` | `string` | `''` | 导航标题覆盖；空串使用内置聊天信息标题 |
| `showMemberGrid` | `boolean` | `true` | 群聊成员宫格显隐（仅群聊生效） |
| `showGroupName` | `boolean` | `true` | 群名称字段行显隐（仅群聊生效） |
| `showAnnouncement` | `boolean` | `true` | 群公告字段行显隐（仅群聊生效） |

## Events

| 事件 | 载荷 | 说明 |
|---|---|---|
| `back` | 无 | 点击导航栏返回；路由由宿主执行 |
| `deleted` | `conversationId: string` | 删除会话成功；宿主负责退场 |
| `leaved` | `conversationId: string` | 退出群聊/解散群聊成功（组件已删会话与本地消息）；宿主负责退场 |
| `contact-deleted` | `userId: string` | 删除好友成功（不删会话与本地消息）；宿主负责退场 |
| `invite` | `groupId: string` | 打开了邀请入群弹层。选人与写操作已在组件内闭环，事件仅通知宿主 |
| `remove-members` | `groupId: string` | 打开了移除成员弹层。同样已在组件内闭环 |
| `open-members` | `groupId: string` | 打开了页内成员管理视图，事件仅通知宿主 |
| `chat-member` | `userId: string` | 在成员管理视图选择「发消息」；宿主负责 `addConversation` 并跳聊天页 |

## Slots

| 插槽 | 作用域 | 说明 |
|---|---|---|
| `group-name-extra` | `{ groupId: string, name: string, ext?: Record<string, unknown> }` | 群名称旁的扩展位（标签/业务徽标，仅群聊分支渲染）。`ext` 为 `EmKit.setGroupPresentation` 注入的业务载荷；缺省不渲染不占位 |

## 群管理权限矩阵

| 操作 | 群主 | 管理员 | 普通成员 |
|---|---|---|---|
| 查看成员宫格与成员管理视图 | 是 | 是 | 是 |
| 邀请成员入群 | 是 | 是 | 仅当群 `allowInvites=true` |
| 移除成员 | 是（可移除管理员与成员） | 是（仅可移除普通成员） | 否 |
| 编辑群名称 | 是 | 否 | 否 |
| 查看群公告 | 是 | 是 | 是 |
| 编辑群公告 | 是 | 是 | 否 |
| 设为/撤销管理员 | 是 | 否 | 否 |
| 转让群主 | 是 | 否 | 否 |
| 退出群聊 | 否（显示「解散群聊」） | 是 | 是 |
| 解散群聊 | 是 | 否 | 否 |
| 全员禁言下的发言 | 不受限（可正常发言） | 不受限（可正常发言） | 输入栏禁用，操作时 toast 提示 |

成员管理视图的操作菜单按上表动态生成：任意角色都可对非自己的成员发起私聊；群主可设/撤管理员、转让群主、移出群聊；管理员仅可移出普通成员。设/撤管理员、转让群主与移出群聊都会先二次确认，确认时按最新角色与成员状态重验；取消不发请求。成员写操作共用提交链，在途时不能重复打开或确认其他成员操作。

## 群管理细节

### 成员宫格

- 首屏上限 8 人（`GROUP_MEMBER_GRID_COUNT`），按「群主 > 管理员 > 入群时间」排序；加号/减号操作格另计。
- 宫格标题的成员数取群详情 `memberCount`，群详情未就位时回落到已拉取的成员数。
- 「查看全部」在成员总数大于首屏展示数时出现，与只读搜索框一样进入成员管理视图。

### 群名称

- 仅群主可进入编辑弹层，输入框上限 255 字符（`GROUP_NAME_MAX_LENGTH`）；`uiConfig.enableGroupNameEdit` 可整体隐藏编辑入口（默认开启）。
- 保存为乐观更新：先写本地群数据，失败回滚并 toast；成功后关闭弹层。保存中禁止重复保存，也禁止通过取消键或遮罩关闭。

### 群公告

- 查看态展示全文（空公告显示「未设置」）；群主/管理员可切换到编辑态。
- 编辑态为多行输入，上限 512 字符（`GROUP_ANNOUNCEMENT_MAX_LENGTH`），带 `x/512` 字数计数。
- 保存失败保留编辑态与已输入内容，成功后关闭编辑态并 toast；保存中禁止取消编辑、关闭弹层或重复保存。

### 邀请与移除

- 邀请弹层复用选人组件（多选），候选来自当前联系人快照，已在群成员置灰；确认后调用 `EmKit.inviteUsersToGroup`，成功关闭弹层、toast，并重拉成员首屏。邀请不增加二次确认。
- 移除弹层与单成员菜单共用权限判断：群主可移除管理员与普通成员，管理员只能移除普通成员；提交时去重并按最新角色/成员状态重验，全部失效时不发请求并提示。批量移除不增加二次确认。
- 两个弹层提交中都禁止更改选择、重复确认、关闭键与遮罩关闭；只有写操作成功才关，失败保留已选内容。移除成功后强制重读群详情与成员首屏，并等待两个刷新尝试结束；刷新失败不回滚已成功的移除，也不把它改报为移除失败。

### 成员操作菜单

| 菜单项 | 出现条件 | 点击行为 |
|---|---|---|
| 发消息 | 除自己外的任意成员 | 以 `chat-member` 透出 userId，宿主 `addConversation` 后跳单聊 |
| 设为管理员 | 群主对普通成员 | 二次确认后 `EmKit.addGroupAdmin`，成功 toast 并刷新角色角标 |
| 撤销管理员 | 群主对管理员 | 二次确认后 `EmKit.removeGroupAdmin`，成功 toast |
| 转让群主 | 群主对除自己外的任意成员 | 二次确认说明自己将成为普通成员，再调 `EmKit.changeGroupOwner` |
| 移出群聊 | 群主对除自己外的成员；管理员对普通成员 | 二次确认后 `EmKit.removeGroupMembers` |

菜单按当前用户角色与目标成员角色动态生成，自己的条目没有操作菜单。写操作成功会回写群成员 store，列表与角标自动刷新；各动作使用独立的成功/失败提示。

### 退出与解散

- 群主点击「解散群聊」，其他成员点击「退出群聊」，均先二次确认。
- 成功后清群缓存、删会话与本地消息，再以 `leaved` 通知宿主；会话删除失败不阻断退场，会话快照会在下次同步时收敛。

### 全员禁言

- 当前版本中，聊天信息页不提供「全员禁言」开关；群被设为全员禁言后，非群主/管理员的聊天页输入栏会自动禁用并提示。
- 需要在业务侧控制时，调用 `EmKit.muteAllGroupMembers(groupId)` / `EmKit.unmuteAllGroupMembers(groupId)`；群数据更新后聊天页的禁用态会随响应式数据自动生效（详见 [EmKit API](./API-KIT.md)）。

## 宿主接线

1. **路由参数**：与聊天页同源，解析 `conversationId` 与 `chatType`；空 ID 用 `v-if` 保护。
2. **返回**：`back` 里 `uni.navigateBack({ delta: 1 })`；本页没有 `autoBack` 开关，退场完全由宿主决定。
3. **删会话/退群/解散/删除好友**：`deleted`、`leaved` 与 `contact-deleted` 用同一处理函数；从聊天详情直接退回会话列表时用 `delta: 2`，若宿主页面栈不同按实际层级调整。删除好友只解除好友关系，不删会话与本地消息。
4. **成员私聊**：`chat-member` 里先 `EmKit.addConversation(userId, SINGLE_CHAT)` 再跳聊天页，保证会话列表出现该会话。
5. **通知类事件**：`invite`、`remove-members`、`open-members` 的 UI 与写操作已经完成，宿主可只做埋点或业务联动，不需要再弹窗。
6. **导航样式**：`navigationStyle: "custom"`，否则会出现原生导航栏与 `em-nav-bar` 双标题。

## 行为与边界

- 当前版本支持 Android、iOS、鸿蒙、H5 与微信小程序；成员宫格与成员管理视图使用同一套跨端布局。
- 单聊分支只展示对方头像、昵称与 userId，不渲染成员宫格、群名称、群公告与退群/解散按钮。
- 群名称编辑仅群主可用；管理员可以编辑群公告但不能改群名，这是当前版本的角色边界。
- 成员操作菜单不包含单人禁言与黑名单；管理员只能移除普通成员，群主可移除管理员与普通成员，群主自身不可被移除。
- 成员管理视图是页内覆盖层，通过导航栏返回回到主视图，不改变路由栈；它不拦截系统返回键。
- 群成员列表使用游标分页（每页 20），进入视图时若无缓存会拉第一页；搜索只过滤已加载的成员。首屏失败可重试，分页失败显示 `LOAD_MORE_STATE.ERROR`；`applied=false` 的陈旧 resolve/reject 不会覆盖新缓存或制造错误态。
- 群公告为空时不显示聊天页公告条；群名称/群头像缺失时回落 groupId 与文字头像。
- 免打扰与置顶是「当前用户对该会话」的设置，不会改变群的全员禁言状态；两者按会话独立串行，请求中开关禁用，旧响应不覆盖最新意图。
- 清空聊天记录与删除会话都有二次确认；删除会话成功后才发 `deleted`，失败 toast 并停留当前页。删除会话、删除好友、退群/解散共用 `exitPending / exitCompleted`：确认后、SDK 写操作前即占锁，三类按钮同时禁用，每个页面实例只发出一次成功事件，避免交叉操作造成重复退场。
- 删除好友仅在对方已是好友时显示（好友快照未同步完成前可能短暂不显示）；二次确认后调 `EmKit.deleteContact`，与其他退出操作共享提交锁，成功 toast 并发一次 `contact-deleted`，失败 toast 并停留当前页。

## 相关文档

- [聊天页](./PAGES-CHAT.md)
- [会话列表页](./PAGES-CONVERSATION.md)
- [群组列表与建群](./PAGES-GROUPS.md)
- [联系人与群组组件](./COMPONENTS-CONTACT.md)
- [EmKit API](./API-KIT.md)
- [类型与常量](./API-TYPES.md)
- [快速开始](./QUICKSTART.md)
