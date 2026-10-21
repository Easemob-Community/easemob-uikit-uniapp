# 组件总览与选型

这页解决两个问题：仓库里到底有哪些 `em-*` 组件，以及面对一个具体需求时该用整页组件还是自己拿原子组件拼。每个组件的完整契约（props / events / slots / 行为）都在对应的家族页，本页只给分类、用途和入口。

组件分两层：**页面组件**负责一整屏的列表、聊天、通讯录、群资料；**原子组件**是页面里的一块积木，可单独嵌进宿主自己的界面。两层共用同一套设计变量（见 [设计变量](./DESIGN-TOKENS.md)）与主题（见 [主题与国际化](./THEME-I18N.md)）。

## 引入方式

### 原子组件：easycom 自动引入

原子组件放在 `uni_modules/easemob-uikit-uni/components/<name>/<name>.vue`，符合 easycom 的目录约定，`pages.json` 打开 `autoscan` 后即可在模板里直接写标签，不需要 `import` 与 `components` 注册：

```json
{
  "easycom": {
    "autoscan": true
  }
}
```

```vue
<template>
  <view class="page" :class="themeClass">
    <em-avatar :src="avatar" name="张三" :size="48" />
    <em-text :text="summary" :lines="1" text-class="row-summary" text-style="color: var(--em-text-secondary);" />
  </view>
</template>
```

也可以显式 `import` 后局部注册，适合需要 tree-shaking 或与自有组件同名的场景：

```vue
<script setup lang="ts">
import EmAvatar from '@/uni_modules/easemob-uikit-uni/components/em-avatar/em-avatar.vue'
</script>
```

### 页面组件：需要一条 custom easycom 规则

页面组件在 `components/pages/<name>/<name>.vue`，目录多了一层 `pages`，不在 autoscan 的匹配范围内，必须在 `pages.json` 里补一条自定义规则：

```json
{
  "easycom": {
    "autoscan": true,
    "custom": {
      "^em-([a-z-]+)-page$": "@/uni_modules/easemob-uikit-uni/components/pages/em-$1-page/em-$1-page.vue"
    }
  }
}
```

配好之后，模板里可以直接写 `<em-conversation-page />`、`<em-chat-page />`；同时别忘了在 `pages.json` 的 `pages` 数组里注册承载它们的宿主页面路径。

### 不在 easycom 范围内的组合件

`em-group-info-blocks`、`em-group-field-dialog`、`em-group-members-view` 与 `em-chat-info-page` 同目录，属于页面内的组合件，需要显式 `import`：

```vue
<script setup lang="ts">
import EmGroupInfoBlocks from '@/uni_modules/easemob-uikit-uni/components/pages/em-chat-info-page/em-group-info-blocks.vue'
</script>
```

## 页面组件一览

| 组件 | 用途 | 指南 |
|---|---|---|
| `em-conversation-page` | 会话列表整页：搜索、筛选 tab、置顶/免打扰/未读、长按菜单、连接状态条 | [会话列表页](./PAGES-CONVERSATION.md) |
| `em-chat-page` | 聊天整页：消息列表、五种气泡、输入栏、引用/撤回/重发、@ 提及、业务插槽 | [聊天页](./PAGES-CHAT.md) |
| `em-chat-info-page` | 聊天信息与群资料整页：会话设置、群成员、群名称与群公告、退群/解散 | [聊天信息与群资料](./PAGES-CHAT-INFO.md) |
| `em-contact-page` | 通讯录入口整页：好友列表 / 群组 / 新请求三个入口 | [通讯录与好友](./PAGES-CONTACTS.md) |
| `em-contact-list-page` | 好友列表整页：字母分组、索引条、搜索、删除好友 | [通讯录与好友](./PAGES-CONTACTS.md) |
| `em-contact-requests-page` | 好友申请整页：待处理申请、同意/拒绝、历史申请 | [通讯录与好友](./PAGES-CONTACTS.md) |
| `em-group-page` | 群组列表整页：已加入群列表、建群面板、跳转群聊 | [群组列表与建群](./PAGES-GROUPS.md) |

## 基础原子组件

通用 UI 积木，与 IM 业务无关，适合在任何页面复用。完整契约见 [基础组件](./COMPONENTS-BASIC.md)。

| 组件 | 用途 |
|---|---|
| `em-action-sheet` | 底部动作菜单：标题 + 动作列表 + 取消，支持图标、警示色、禁用项 |
| `em-avatar` | 头像：图片加载失败自动回落文字头像，可内置未读角标 |
| `em-badge` | 未读徽标：数字档（99+ 截断）与红点档 |
| `em-button` | 按钮：四档类型、两档尺寸、胶囊/通栏/禁用 |
| `em-empty` | 空状态：图标 + 标题 + 描述 + 自定义区 |
| `em-icon` | 字体图标：统一字形来源、按名取字、可调尺寸与颜色 |
| `em-load-more` | 触底加载 footer：加载中 / 点击加载更多 / 没有更多 |
| `em-nav-bar` | 自绘导航栏：安全区、返回、副标题、右侧动作、小程序胶囊避让 |
| `em-popup` | 弹层容器：底部/居中、遮罩、安全区、全屏、层级与 tabBar 处理 |
| `em-search-bar` | 搜索输入条：圆角条 + 前置搜索图标，`v-model` 双向绑定 |
| `em-skeleton` | 骨架屏：头像块 / 单行 / 多行段落 |
| `em-text` | 文本收口：单行或两行省略、长文断词、跨端文字样式双通道 |

## 会话与导航组件

会话列表的条目、筛选与连接状态。完整契约见 [会话与导航组件](./COMPONENTS-CONVERSATION.md)。

| 组件 | 用途 |
|---|---|
| `em-conversation-item` | 会话列表行：头像、名称、置顶/免打扰标记、摘要、草稿、时间、未读 |
| `em-conversation-tabs` | 会话筛选 tab：全部/未读/@我/单聊/群聊，横向滑动 |
| `em-connection-banner` | 连接状态条：连接中/重连中/断开/被踢/Token 过期 |

## 聊天与消息组件

输入栏、五类消息气泡与两个辅助弹层。完整契约见 [聊天与消息组件](./COMPONENTS-CHAT.md)。

| 组件 | 用途 |
|---|---|
| `em-chat-inputbar` | 输入栏：文本、语音、emoji、媒体面板、引用条、快捷回复、禁用态 |
| `em-text-message` | 文本气泡：@ 片段高亮、流式光标与异常提示 |
| `em-image-message` | 图片气泡：缩略图优先、按宽高比约束尺寸 |
| `em-audio-message` | 语音气泡：时长阶梯宽度、点击播放/停止、播放波形 |
| `em-video-message` | 视频气泡：封面 + 时长，播放入口按平台显隐 |
| `em-file-message` | 文件气泡：按扩展名取图标、文件名与大小 |
| `em-quick-reply-bar` | 快捷回复条：常用语胶囊，横向滚动 |
| `em-mention-picker` | @ 提及选人弹层：搜索、成员列表、选中即回填 |

## 联系人与群组组件

通讯录入口、字母索引、选人弹层，以及群资料页内的三个组合件。完整契约见 [联系人与群组组件](./COMPONENTS-CONTACT.md)。

| 组件 | 用途 |
|---|---|
| `em-contact-nav` | 通讯录入口项列表：左图标 + 标题（内联计数）+ 红点 + 右箭头 |
| `em-alphabet-nav` | 字母索引条：A–Z + #，点按与滑动定位 |
| `em-select-contact` | 选人弹层：单选取一人直接抛出，多选全屏带已选条与确认按钮 |
| `em-group-info-blocks` | 群资料区块：成员宫格 + 群名称行 + 群公告行 |
| `em-group-field-dialog` | 群名称编辑与群公告查看/编辑弹层 |
| `em-group-members-view` | 群成员管理视图：全量成员、角色角标、游标翻页、成员操作菜单 |

## 如何选择：页面组件还是原子组件

| 场景 | 建议 | 原因 |
|---|---|---|
| 从零接入一套完整 IM 界面 | 页面组件 | 页面已处理数据订阅、分页、安全区、键盘、长按菜单与错误提示 |
| 只替换其中一屏的视觉 | 页面组件 + 页面级 props / 插槽 | 先看页面指南里的开关，能覆盖再考虑换掉整页 |
| 已有自己的会话列表，只想复用行样式 | `em-conversation-item` + `em-badge` + `em-avatar` | 行组件是纯展示，数据由宿主装配 |
| 已有自己的聊天页，只想复用一个输入栏 | `em-chat-inputbar` + `em-text` | 输入栏只负责编辑与面板，发送由 `send` / `voice-send` / `media-select` 事件驱动 |
| 需要弹一个"选择成员"面板 | `em-select-contact` | 单选取一人、多选取一批，两种形态都已封装 |
| 需要底部动作菜单 | `em-action-sheet`（或 `em-popup` 自绘） | 动作菜单已含取消项、禁用项与警示色 |
| 需要自定义业务卡片气泡 | 页面组件 `#custom-message` 插槽 | 整卡由宿主渲染，避免自己接消息生命周期 |
| 只是要一段可省略的文本 | `em-text` | 跨端文字样式差异已收口，见 [基础组件](./COMPONENTS-BASIC.md) 的 `em-text` 一节 |

判断顺序建议是：**先看页面组件的 props 能不能满足 → 再看页面插槽能不能接管 → 最后才拆到原子组件**。反过来先拆原子组件，等于自己重新实现分页、未读、引用、重发这些状态机。

用原子组件搭一屏会话列表的最小骨架（`rows`、`openChat`、`openMenu` 由宿主按自己的数据源与路由补全）：

```vue
<template>
  <view class="page" :class="themeClass">
    <em-conversation-tabs :active="activeTab" @change="onTabChange" />
    <scroll-view class="list" scroll-y>
      <em-conversation-item
        v-for="row in rows"
        :key="row.item.conversationId"
        :item="row.item"
        :name="row.name"
        :avatar="row.avatar"
        :time-text="row.timeText"
        :draft="null"
        @click="openChat"
        @long-press="openMenu"
      />
    </scroll-view>
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

## 三条组合约定

1. **弹层一律挂页面根，不进 `scroll-view`。** `em-popup` 及其上层（`em-action-sheet`、`em-select-contact`、`em-mention-picker`）都用 `position: fixed` 铺满屏幕，嵌进滚动容器会被裁剪；它们的 z-index 从 2000 起递增分配，打开期间在 App 与微信小程序上自动收起原生 tabBar。
2. **所有可能溢出的用户内容走 `em-text`。** 组件内文字样式必须同时给 `textClass` 与 `textStyle`，原因见 [基础组件](./COMPONENTS-BASIC.md) 的 `em-text` 一节。
3. **图标一律走 `em-icon`。** 字形来自随包分发的字体文件，颜色跟随主题 token；`pages.json` 里的 tabBar 图标是平台原生 PNG，属于平台要求，不在字体方案内。

## 相关文档

- 组件契约：[基础组件](./COMPONENTS-BASIC.md) · [会话与导航组件](./COMPONENTS-CONVERSATION.md) · [聊天与消息组件](./COMPONENTS-CHAT.md) · [联系人与群组组件](./COMPONENTS-CONTACT.md)
- 页面指南：[会话列表页](./PAGES-CONVERSATION.md) · [聊天页](./PAGES-CHAT.md) · [聊天信息与群资料](./PAGES-CHAT-INFO.md) · [通讯录与好友](./PAGES-CONTACTS.md) · [群组列表与建群](./PAGES-GROUPS.md)
- 类型与常量：[类型与常量](./API-TYPES.md)
- 配置项：[配置参考](./CONFIG.md)
- 平台差异：[平台能力与差异](./PLATFORM.md)
