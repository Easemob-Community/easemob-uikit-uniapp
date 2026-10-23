# 群组列表与建群（em-group-page）

`em-group-page` 是群组功能的主入口：列出当前用户已加入的群，并提供「+」建群面板。群列表数据来自 SDK 的已加入群快照，建群由组件自身完成选人、群名生成、建群请求、会话构造与系统通知，宿主只需要在 `created` 后跳聊天页。

页面组件位于 `uni_modules/easemob-uikit-uni/components/pages/em-group-page/em-group-page.vue`，通常由群组页面壳承载（例如 `sub-im/pages/group/group.uvue`），也常被通讯录入口页的「群组」入口直接路由到。

## 页面位置与接入方式

- 页面组件在 `components/pages/` 下，需要 `pages.json` 的 custom easycom 规则（见 [快速开始](./QUICKSTART.md) 3.1 节）。
- 组件自带 `em-nav-bar`（返回 + 右侧「+」），路由设 `navigationStyle: "custom"`，App 端同时设 `app-plus.titleNView: false`。
- 页面壳根节点 `height: 100%` + flex 链，并绑定 `themeClass`。
- 建群候选来自联系人快照，进入本页面前应已登录并完成联系人同步。

## 能力

- **群列表**：进入页面自动刷新已加入群；48px 方形群头像、群名、成员数（成员数大于 0 才显示）；头像缺失时用群名首字文字头像。
- **名称回落链**：群数据层的群名 > 群快照 `name` > groupId；群详情拉到后自动回填。
- **搜索**：本地按群名与 groupId 过滤，大小写不敏感；无结果显示「未找到相关群组」空态。
- **首次加载与失败恢复**：`loaded / syncing / syncFailed` 区分未加载、加载中、失败与权威空列表。同步中且列表为空时展示 8 条骨架；无缓存失败显示错误与重试，有缓存或搜索无结果时保留原列表/空态，只有同步成功后的空列表才显示普通空态。
- **触底加载**：列表底部固定为「没有更多了」；已加入群是 SDK 本地全量数据，没有服务端分页。
- **建群面板**：右上角「+」打开多选联系人面板，可选中多名好友后确认建群，不增加二次确认。
- **可选建群表单**：`showNameInput=true` 显示群名称输入框；`showSettings=true` 显示「公开群」「允许成员邀请」两个开关。两者默认都关闭。
- **自动群名**：未填写群名时，取前 3 名成员的展示名用「、」拼接；超过 3 人追加「...」。未选人时确认按钮禁用，不会提交空成员建群。
- **建群闭环**：`EmKit.createGroup` → `EmKit.addConversation` 构造群会话 → 插入「群聊已创建」本地系统通知 → toast → 以 `created` 透出 groupId。
- **提交与重置**：创建中禁止更改选择、重复确认、关闭键与遮罩关闭；每次重新打开建群面板都会重置群名与两个开关，不保留上一次的输入。

## 最小用法

```vue
<template>
  <view class="page" :class="themeClass">
    <em-group-page @click-group="onOpenGroup" @created="onOpenGroup" @back="onBack" />
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

// 点击已有群与新建群成功后走同一入口：预热会话/历史后进入群聊
function onOpenGroup(groupId: string) {
  EmKit.enterConversation(groupId, CONVERSATION_TYPE.GROUP_CHAT).catch(() => {})
  EmKit.loadHistory(groupId, CONVERSATION_TYPE.GROUP_CHAT).catch(() => {})
  uni.navigateTo({ url: `/pages/chat/chat?conversationId=${groupId}&chatType=${CONVERSATION_TYPE.GROUP_CHAT}` })
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

需要显式群名与群设置时：

```vue
<em-group-page
  :show-name-input="true"
  :show-settings="true"
  @click-group="onOpenGroup"
  @created="onOpenGroup"
  @back="onBack"
/>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `showNameInput` | `boolean` | `false` | 建群面板显示群名称输入框；关闭时始终使用自动群名。输入上限 255 字符 |
| `showSettings` | `boolean` | `false` | 建群面板显示「公开群」「允许成员邀请」两个开关；关闭时不展示，按 `false` 创建 |

## Events

| 事件 | 载荷 | 说明 |
|---|---|---|
| `click-group` | `groupId: string` | 点击已有群，宿主跳群聊 |
| `created` | `groupId: string` | 建群成功（会话、系统通知已由组件写入）；宿主跳群聊 |
| `back` | 无 | 点击导航栏返回，路由由宿主执行 |

## Slots

本页不对外提供插槽。建群面板顶部的群名/开关表单是组件自身实现，不需要宿主注入。

## 建群流程

1. 点击右上角「+」，组件清空上一次的群名与开关状态并打开多选面板。
2. 面板列出联系人快照，可多选；已选人数实时显示在确认按钮上。
3. 确认时计算最终群名：输入框非空用输入值，否则用自动群名；建群不增加二次确认。
4. 调用 `EmKit.createGroup({ name, members, public, allowInvites })`，创建中禁止更改选择、重复确认与关闭面板。
5. 成功后在本地构造群会话，插入「群聊已创建」灰条通知，关闭面板并 toast。
6. 以 `created` 透出 groupId；宿主预热并跳群聊，或留在列表（列表已由群 store 自动刷新）。
7. 失败时 toast「创建群组失败，请稍后重试」，面板保持打开，已选成员与表单内容不丢失，解除提交态后可重试。

## 宿主接线

1. **路由**：群组页可作为通讯录入口页 `entry-click` 中 `group` 的分发目标，也可从会话页「+ → 创建群组」的 `menu` 事件进入。
2. **进入群聊**：`click-group` 与 `created` 建议共用同一处理函数，统一 `chatType=groupChat`，避免新建群后落到单聊。
3. **返回**：`back` 里 `navigateBack({ delta: 1 })`；页面壳不拦截。
4. **群资料**：群聊右上角详情入口进入 [聊天信息与群资料](./PAGES-CHAT-INFO.md)，群名称、公告、成员管理都在那里完成。
5. **联系人同步**：建群候选来自联系人快照，若候选为空，先确认已登录并调用过 `EmKit.syncContacts()`。
6. **导航样式**：`navigationStyle: "custom"`，否则双标题栏。

## 行为与边界

- 当前版本支持 Android、iOS、鸿蒙、H5 与微信小程序；列表、搜索与建群面板使用同一套跨端实现。
- 群列表只包含「已加入的群」，不包含公开群搜索与加入申请入口；加入群的主要路径是接受群邀请（见 [通讯录与好友](./PAGES-CONTACTS.md)）或被邀请入群。
- 已加入群为 SDK 本地全量，当前版本没有服务端分页；列表底部恒为「没有更多了」。后台同步失败会保留缓存并显示失败状态；SDK 没有群全量手动重启同步 API，因此重试不会把内存重读当作成功，需恢复连接或重新登录让 SDK 重新执行后台同步。
- 群名称上限 255 字符（`GROUP_NAME_MAX_LENGTH`）；自动群名只取前 3 名成员，超过 3 人用「...」表示。
- 公开群与允许成员邀请由建群面板在创建时设置；群资料页不提供这两个开关的修改入口，`EmKit.updateGroupInfo` 支持修改群名称、描述与头像。
- 建群成功后创建者即群主；成员邀请、移除、管理员设置、转让群主等操作在群资料页完成。
- 建群请求失败时不会关闭面板，也不会清空已选成员，便于直接重试。
- 群成员数来自群快照；为 0 时不显示人数，避免列表出现「0 人」的误导信息。
- 群头像缺失时用文字头像，不加载默认图片资源。

## 相关文档

- [聊天页](./PAGES-CHAT.md)
- [聊天信息与群资料](./PAGES-CHAT-INFO.md)
- [通讯录与好友](./PAGES-CONTACTS.md)
- [会话列表页](./PAGES-CONVERSATION.md)
- [联系人与群组组件](./COMPONENTS-CONTACT.md)
- [EmKit API](./API-KIT.md)
- [类型与常量](./API-TYPES.md)
