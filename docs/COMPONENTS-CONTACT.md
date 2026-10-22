# 联系人与群组组件

这页覆盖通讯录与群组相关的组件：入口项列表 `em-contact-nav`、字母索引条 `em-alphabet-nav`、选人弹层 `em-select-contact`，以及群资料页内的三个组合件 `em-group-info-blocks`、`em-group-field-dialog`、`em-group-members-view`。前三者是通用原子组件；后三者与 `em-chat-info-page` 同目录，属于页面内的组合件，用于替换或重排聊天信息页的群分支内容。

原子组件符合 easycom 目录约定；三个组合件需要显式 `import`，方式见 [组件总览与选型](./COMPONENTS.md)。本页组件都支持 `custom-class` / `custom-style` 根节点样式透出，用法见 [样式定制](./GUIDE-STYLING.md)。

## em-contact-nav

通讯录入口项列表：可选左图标 + 标题（内联计数）+ 红点 + 右箭头。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `entries` | `EmContactNavEntry[]` | 必填 | 入口配置，按数组顺序展示 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `entry-click` | `key: string` | 点击某个入口，原样抛出 `key` |

无插槽。

`EmContactNavEntry` 的字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | `string` | 入口唯一标识，宿主据此接线路由 |
| `label` | `string` | 入口标题 |
| `count` | `number` | 计数，`> 0` 时以"标题 (n)"的形式内联进标题 |
| `hot` | `boolean` | 红点；仅 `count > 0` 时生效 |
| `icon` | `string` | 可选，`em-icon` 图标名；不传则不渲染左图标 |

```vue
<template>
  <view class="page" :class="themeClass">
    <em-contact-nav :entries="entries" @entry-click="onEntryClick" />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EmContactNavEntry } from '@/uni_modules/easemob-uikit-uni/libs'

const entries = computed<EmContactNavEntry[]>(() => [
  { key: 'contact', label: '好友列表', count: 12 },
  { key: 'group', label: '群组', count: 3 },
  { key: 'notice', label: '新请求', count: 2, hot: true }
])

function onEntryClick(key: string): void {
  console.log('entry:', key)
}
</script>
```

**行为与平台**：计数不走右侧数字徽标，而是拼进标题——`count > 0` 时显示"好友列表 (12)"，与右侧箭头之间用弹性空隙撑开。`hot` 只在有计数时显示 8px 红点（`em-badge` 的红点档），没有计数就只有一个空红点是没有意义的。组件不连 store、不碰路由，入口的路由与计数都由宿主提供；图标与红点外层包了一层 `view`，避免小程序样式隔离下父组件样式够不到子组件宿主节点。

## em-alphabet-nav

字母索引条：A–Z 加 `#`，支持点按精确定位与按住滑动定位。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `keys` | `string[]` | 完整 A–Z + `#` | 渲染序列 |
| `activeKey` | `string` | `''` | 当前高亮字母；空串时无高亮 |
| `dimKeys` | `string[]` | `[]` | 没有对应分组的字母：淡化且不响应交互 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `jump` | `key: string, sliding: boolean` | 定位到某个字母；`sliding` 为 `false` 表示点按（可用平滑滚动），为 `true` 表示滑动中（建议瞬时滚动避免动画排队） |

无插槽。

```vue
<em-alphabet-nav :active-key="activeKey" :dim-keys="dimKeys" @jump="onJump" />
```

**行为与平台**：容器撑满列表区高度，字母格按 `flex: 1` 等比分配，单项封顶 20px、字号 9px。点按走单元格的 `touchstart` 精确命中，不需要几何测量；按住上下滑动时，按触点相对容器的纵向占比映射到字母，因此拖动过程中会连续切换分组。容器几何在首次点按时惰性查询一次并缓存，查询不可用的端只影响滑动定位，点按仍然可用。`dimKeys` 里的字母视觉淡化且点按、滑动都不派发 `jump`。与 `em-contact-list-page`、`em-select-contact` 的多选形态搭配使用。

## em-select-contact

选人弹层：单选模式平铺列表点一个人，多选模式全屏带已选条、字母分组与确认按钮。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `items` | `EmSelectContactItem[]` | 必填 | 候选联系人，`userId` / `name` / `avatar` 由宿主装配 |
| `show` | `boolean` | 必填 | 弹层显隐，配合 `v-model:show` 使用 |
| `selectMode` | `'single' \| 'multiple'` | `'single'` | 选择模式，常量见 `SELECT_CONTACT_MODE` |
| `disabledIds` | `string[]` | `[]` | 置灰不可新增选中的用户 id（如邀请入群时已在群里的成员） |
| `title` | `string` | `''` | 标题；空串按模式回落 i18n 文案（单选"发起单聊"，多选"选择成员"） |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `select` | `userId: string` | 单选模式点击某一行；组件不自动关闭 |
| `confirm` | `userIds: string[]` | 多选模式点击确认；组件不自动关闭 |
| `update:show` | `value: boolean` | 点击关闭键或遮罩时派发 `false` |

| 插槽 | 作用域 | 说明 |
|---|---|---|
| `panel-top` | — | 仅多选模式：插在已选头像条与搜索框之间，用于放建群名称、开关等表单 |

`EmSelectContactItem` 的字段：`userId`、`name`、`avatar`。

单选（默认，`newChatVisible`、`contacts`、`startSingleChat` 由宿主提供）：

```vue
<em-select-contact
  v-model:show="newChatVisible"
  :items="contacts"
  title="发起单聊"
  @select="startSingleChat"
/>
```

多选（建群 / 邀请入群）：

```vue
<template>
  <em-select-contact
    v-model:show="pickerVisible"
    select-mode="multiple"
    :items="contacts"
    :disabled-ids="existingMemberIds"
    @confirm="onConfirm"
  >
    <template #panel-top>
      <view class="group-name-row">
        <input v-model="groupName" placeholder="群名称" />
      </view>
    </template>
  </em-select-contact>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { EmSelectContactItem } from '@/uni_modules/easemob-uikit-uni/libs'

const pickerVisible = ref(false)
const groupName = ref('')
const existingMemberIds = ref<string[]>([])
const contacts = ref<EmSelectContactItem[]>([])

function onConfirm(userIds: string[]): void {
  // 提交建群/邀请；成功后再把 pickerVisible 置 false
}
</script>
```

**行为与平台**：单选模式是半屏面板（窗口高 60%），顶部标题 + 关闭键，下面是搜索框与平铺列表，没有字母导航——点一行就派发 `select`，是否关闭由宿主决定（比如先校验"不能和自己建会话"再关）。多选模式走全屏形态：面板高度 = 窗口高 − 顶部安全区（全屏弹层会注入顶部内边距，不扣掉会把底部确认键顶出屏），内容自上而下是标题行、已选头像条（点头像移除）、`#panel-top`、搜索框、字母分组列表 + 右侧索引条、底部通栏确认按钮。确认按钮文案是"确认 (n)"，未选中时禁用；`confirm` 只透出 id 列表，不自动关窗，异步提交成败由宿主决定关窗时机。`disabledIds` 只能阻止新增选中，已选项即使随后变成禁用仍可取消。搜索同时匹配展示名与 `userId`，字母索引条在没有分组时隐藏。

关闭路径（关闭键、点遮罩、宿主成功关窗）统一在 `show` 变 `false` 时重置：搜索词、已选列表、高亮字母都清空，重开是干净状态。微信小程序的全屏形态下，右上角关闭键会按胶囊按钮矩形右移避让，不会压在胶囊下面。弹层的层级与 tabBar 处理由 `em-popup` 统一负责。

## em-group-info-blocks

群资料区块：成员宫格（含添加格、移除格、"查看全部"）+ 群名称字段行 + 群公告字段行。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `groupId` | `string` | 必填 | 群 id |
| `isOwner` | `boolean` | 必填 | 当前用户是否群主 |
| `isAdmin` | `boolean` | 必填 | 当前用户是否管理员 |
| `showMemberGrid` | `boolean` | `true` | 成员宫格显隐 |
| `showGroupName` | `boolean` | `true` | 群名称字段行显隐 |
| `showAnnouncement` | `boolean` | `true` | 群公告字段行显隐 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `invite` | `groupId: string` | 点击"添加"格，意图为邀请入群 |
| `remove` | `groupId: string` | 点击"移除"格，意图为移出成员 |
| `open-members` | `groupId: string` | 点击假搜索框或"查看全部"，进入成员管理视图 |
| `edit-name` | `groupId: string` | 点击群名称行；仅群主会触发 |
| `show-announcement` | `groupId: string` | 点击群公告行，查看全文 |

无插槽。

```vue
<template>
  <view class="page" :class="themeClass">
    <em-group-info-blocks
      :group-id="groupId"
      :is-owner="isOwner"
      :is-admin="isAdmin"
      :show-member-grid="true"
      @invite="openInvitePicker"
      @remove="openRemovePicker"
      @open-members="showMembersView"
      @edit-name="openNameDialog"
      @show-announcement="openAnnouncementDialog"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import EmGroupInfoBlocks from '@/uni_modules/easemob-uikit-uni/components/pages/em-chat-info-page/em-group-info-blocks.vue'

const groupId = ref('group-1')
const isOwner = ref(false)
const isAdmin = ref(false)
</script>
```

**行为与平台**：组件直读群数据缓存（与 `em-chat-info-page` 同源），成员宫格按"群主 > 管理员 > 入群时间"排序取前 8 位，成员总数超过首屏数量时在宫格下方显示"查看全部"。添加格对群主与管理员恒可见，普通成员需要群开启"允许成员邀请"；移除格仅群主与管理员可见。群名称行只有群主可点（行尾带编辑笔图标），其他角色只读；群公告为空时显示"未设置"。组件只发意图事件，邀请/移除/编辑/查看的弹层由页面根级渲染——这也是它与 `em-chat-info-page` 的集成方式：页面负责弹层与写操作，组件负责展示与收集意图。单独使用时，宿主需要自己接住这五类事件并完成后续流程。

## em-group-field-dialog

群字段编辑弹层：群名称编辑 + 群公告查看/编辑两个居中弹窗。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `groupId` | `string` | 必填 | 群 id |
| `isOwner` | `boolean` | 必填 | 是否群主 |
| `isAdmin` | `boolean` | 必填 | 是否管理员 |
| `nameEditShow` | `boolean` | 必填 | 群名称编辑弹层显隐，配合 `v-model:nameEditShow` 使用 |
| `announcementShow` | `boolean` | 必填 | 群公告弹层显隐，配合 `v-model:announcementShow` 使用 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `update:nameEditShow` | `value: boolean` | 关闭/打开群名称弹层 |
| `update:announcementShow` | `value: boolean` | 关闭/打开群公告弹层 |

无插槽。

```vue
<template>
  <em-group-field-dialog
    v-model:name-edit-show="nameEditVisible"
    v-model:announcement-show="announcementVisible"
    :group-id="groupId"
    :is-owner="isOwner"
    :is-admin="isAdmin"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import EmGroupFieldDialog from '@/uni_modules/easemob-uikit-uni/components/pages/em-chat-info-page/em-group-field-dialog.vue'

const nameEditVisible = ref(false)
const announcementVisible = ref(false)
</script>
```

**行为与平台**：两个弹层都是居中形态，必须渲染在页面根级、`scroll-view` 之外。群名称输入上限 255 个字符，保存时先写本地缓存再请求服务端，请求失败回滚到旧名称并提示，成功则关窗；空名称会被拦下并提示。群公告上限 512 个字符，打开时是查看态（可滚动），群主与管理员可切到编辑态（多行输入 + 字数计数），保存成功回写缓存并回到查看态，失败保留编辑态避免内容丢失。关闭公告弹层会复位编辑态，下次打开恒为查看态。写操作全部走 `EmKit` 的群域方法，与 `em-chat-info-page` 的集成方式是"页面持有显隐、组件持有编辑与提交"。

## em-group-members-view

群成员管理视图：全量成员列表、角色角标、搜索、游标翻页与成员操作菜单。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `groupId` | `string` | 必填 | 群 id |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `back` | — | 返回主视图（页内视图切换，不新增路由） |
| `chat-member` | `userId: string` | 点"私聊"，宿主发起单聊并跳聊天页 |

无插槽。

```vue
<template>
  <em-group-members-view :group-id="groupId" @back="backToInfo" @chat-member="startChat" />
</template>

<script setup lang="ts">
import EmGroupMembersView from '@/uni_modules/easemob-uikit-uni/components/pages/em-chat-info-page/em-group-members-view.vue'
</script>
```

**行为与平台**：这是一个页内全屏覆盖层，通过页内视图切换展示，z-index 低于弹层基准 2000，因此成员操作菜单仍能盖在它上面；它复用 `em-nav-bar` 画标题栏，标题为"群成员 (n)"，返回时只派发 `back`，路由由宿主或 `em-chat-info-page` 决定。列表按"群主 > 管理员 > 入群时间"排序，非本人行右侧有更多按钮；搜索同时匹配展示名与 `userId`，空结果显示"暂无成员"或"未找到相关成员"。翻页同时支持底部的"加载更多"按钮与滚动触底，搜索态隐藏加载区，游标与是否还有下一页由群数据层回写，组件只维护加载锁。操作菜单按当前用户角色动态生成：任何人可对非自己发私聊；群主可对管理员/成员设撤管理员、转让群主、移出群聊；管理员只能移出普通成员。转让群主与移出群聊都会先弹二次确认，写操作成功后会提示并刷新列表。与 `em-chat-info-page` 的集成方式是"页面切视图、组件管列表与操作"。

## 页面组件

以下页面组件在本家族内以整页形态出现，完整契约与宿主接线见各自的页面指南，本页只给定位。

| 组件 | 定位 | 指南 |
|---|---|---|
| `em-contact-page` | 通讯录入口页：搜索过滤入口项、好友列表 / 群组 / 新请求三个入口、右上角添加好友；事件 `entry-click`、`add` | [通讯录与好友](./PAGES-CONTACTS.md) |
| `em-contact-list-page` | 好友列表页：字母分组、索引条、搜索、长按删除好友；事件 `select`、`back`；props `menuKeys`（默认 `['delete']`）、`autoSync`（默认 `true`） | [通讯录与好友](./PAGES-CONTACTS.md) |
| `em-contact-requests-page` | 好友申请页：待处理申请与历史申请、同意/拒绝；事件 `back` | [通讯录与好友](./PAGES-CONTACTS.md) |
| `em-group-page` | 群组列表页：已加入群列表、建群面板、跳转群聊；事件 `click-group`、`created`、`back`；props `showNameInput`（默认 `false`）、`showSettings`（默认 `false`） | [群组列表与建群](./PAGES-GROUPS.md) |
| `em-chat-info-page` | 聊天信息与群资料页：会话设置、群成员区、群名称与群公告、退群/解散；props `conversationId`、`chatType`、三个显隐开关；事件 `back`、`deleted`、`leaved`、`invite`、`remove-members`、`open-members`、`chat-member` | [聊天信息与群资料](./PAGES-CHAT-INFO.md) |

`em-chat-info-page` 是 `em-group-info-blocks`、`em-group-field-dialog`、`em-group-members-view` 的宿主页面：页面持有弹层与视图状态，三个组合件负责各自的展示与意图事件，三者组合起来就是群资料页的完整群分支。

## 相关文档

- 上一页：[聊天与消息组件](./COMPONENTS-CHAT.md)
- 组件总览：[组件总览与选型](./COMPONENTS.md)
- 通讯录与好友：[通讯录与好友](./PAGES-CONTACTS.md)
- 群组列表与建群：[群组列表与建群](./PAGES-GROUPS.md)
- 聊天信息与群资料：[聊天信息与群资料](./PAGES-CHAT-INFO.md)
- 类型与常量：[类型与常量](./API-TYPES.md)
