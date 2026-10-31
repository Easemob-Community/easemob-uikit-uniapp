# 示例工程（Demo）

`demo/` 是一个完整的 uni-app x 蒸汽模式工程，把 UIKit 的页面、组件、扩展插槽在五个端上跑起来。这页说明工程结构、如何运行、每个演示页面看什么、场景实验室怎么玩，以及哪些代码是「宿主侧参考实现」——可以照抄、可以整份替换，但不属于 UIKit 本身。

> 相关页面：[快速开始](./QUICKSTART.md) · [多场景接入](./GUIDE-MULTI-SCENARIO.md) · [会话列表页](./PAGES-CONVERSATION.md) · [聊天页](./PAGES-CHAT.md) · [组件总览](./COMPONENTS.md) · [主题与国际化](./THEME-I18N.md) · [AI 流式消息](./AI-STREAM.md) · [平台能力与差异](./PLATFORM.md)

## Demo 与单聊模板怎么选

| 起点 | 适用目标 | 包含内容 |
|---|---|---|
| `demo/`（本页） | 查看完整 IM、组件能力与业务扩展示例 | 会话、聊天、通讯录、群组、场景实验室与样式实验室 |
| [`templates/chat-only`](https://github.com/Easemob-Community/easemob-uikit-uniapp/tree/main/templates/chat-only) | 只需一个单聊页面，或先跑通最小业务链路再扩展 | 登录恢复、单聊根页与微信小程序 SDK 分包，不含完整 IM 页面 |

两者都是宿主侧工程示例，不属于 UIKit 插件本体。只需单聊时不必从 Demo 手工删减；需要完整页面或扩展能力时，直接使用 Demo 对照接线。

## 工程结构

```text
demo/
├── pages/                  # 主包页面：登录、会话、通讯录、我的（tabBar）
├── sub-im/pages/           # IM 分包页面：聊天、聊天信息、好友、群组、场景实验室、样式实验室（hub + 专项页）
├── sub-sdk/pages/          # SDK 分包声明页（微信小程序异步加载 SDK 需要）
├── components/             # 宿主侧参考组件：demo-card、demo-composer-bar、demo-custom-inputbar
├── common/                 # 场景目录、卡片数据、主题封装、AI 流式模拟器
├── static/                 # tabBar 图标等静态资源
├── uni_modules/            # 指向仓库根 uni_modules 的软链（UIKit 插件本体）
├── pages.json              # 页面、分包、easycom、tabBar、主题变量
├── manifest.json           # uni-app x（vapor）、各端打包配置
├── theme.json              # pages.json 的明暗变量来源
├── index.html              # H5 入口（含首帧主题 CSS）
├── App.uvue / main.uts     # 应用入口
└── package.json            # 仅一个依赖：easemob-websdk 5.1.3
```

| 目录 | 作用 | 是否属于 UIKit |
|---|---|---|
| `pages/` `sub-im/pages/` | 演示页面，接线 UIKit 页面组件与插槽 | 否，宿主侧示例 |
| `components/demo-card` | 宿主自绘卡片组件（按 `customEvent` 渲染） | 否，可整份替换 |
| `components/demo-composer-bar` | 输入栏业务入口条（注入 `#input-toolbar`） | 否，可整份替换 |
| `components/demo-custom-inputbar` | 输入栏整栏自绘（注入 `#input-bar`，行为全走 scope 契约） | 否，可整份替换 |
| `common/scenario-catalog.ts` | 6 个场景的业务上下文与卡片数据 | 否，演示数据 |
| `common/demo-card-data.ts` | event → 卡片视觉族的映射与字段解析 | 否，宿主逻辑 |
| `common/ai-stream-demo.ts` | 本地模拟 AI 流式分片 | 否，演示工具 |
| `common/theme.ts` | 主题初始化与 H5 导航栏/tabBar 同步 | 否，宿主接线示例 |
| `uni_modules/easemob-uikit-uni` | 插件本体（软链到仓库根目录） | 是 |

## 运行

### 前置

```bash
# peer 依赖：只装 demo 自己的依赖
cd demo && npm install && cd ..
```

- HBuilderX 5.21+（建议 5.26+），打开仓库根目录下的 `demo/` 即可运行。
- 需要真实收发消息时，准备环信 AppKey，并能从业务服务端拿到 userId 与 token。

### HBuilderX

| 目标端 | 操作 |
|---|---|
| H5 | 运行 → 运行到浏览器 |
| 微信小程序 | 运行 → 运行到小程序模拟器 → 微信开发者工具（需先在 HBuilderX 设置中配置开发者工具路径） |
| Android / iOS | 运行 → 运行到手机或模拟器 |
| 鸿蒙 | 运行 → 运行到手机或模拟器 → 鸿蒙（需 DevEco Studio 与签名配置，见[鸿蒙真机运行与签名](./HARMONY-REALDEVICE-RUN.md)） |

### 命令行（HBuilderX 内置编译器）

```bash
# H5：构建 + 静态伺服（dev web 不转换 .uts 入口，浏览器会白屏）
bash scripts/uni.sh build web
bash scripts/uni.sh serve 5180

# 微信小程序：构建 + 注入 SDK 分包 + 主包体积校验
bash scripts/uni.sh build mp-weixin
# 然后用微信开发者工具导入 demo/unpackage/dist/build/mp-weixin

# 小程序 dev（改代码后自动重编译，附带分包伴随 watch）
bash scripts/uni.sh dev mp-weixin
```

- 产物目录：H5 在 `demo/unpackage/dist/build/web`，小程序在 `demo/unpackage/dist/build/mp-weixin`。
- HBuilderX 不在默认路径时，用 `HBUILDERX_PATH` 指定安装目录。
- 小程序构建会自动跑 `scripts/prepare-sdk-subpackage.mjs` 与 `scripts/check-mp-size.mjs`；用 HBuilderX 图形界面起 dev 时，需要手动挂一次 `prepare-sdk-subpackage.mjs --watch`，否则热更新会抹掉 `sub-sdk/im-sdk.js`。
- 分包的完整机制见[微信小程序 SDK 分包](./GUIDE-WEAPP-SDK-SUBPACKAGE.md)。

## 演示页面

### 主包页面（tabBar）

| 页面 | 路由 | 看什么 |
|---|---|---|
| 登录 | `pages/login/login` | 手填 appkey / userId / token 登录；右上角开发者模式可用密码换取测试 token（仅开发用） |
| 会话 | `pages/conversation/conversation` | `em-conversation-page`：筛选 tab、搜索、置顶、免打扰、未读角标、连接状态条；点击预热进入会话与历史 |
| 通讯录 | `pages/contact/contact` | `em-contact-page`：入口列表、好友申请红点、群组入口、添加好友弹层 |
| 我的 | `pages/mine/mine` | 深浅色三档、AI 流式开关、场景实验室/样式实验室/AI 流式演示/连通性自检入口、导出调试日志、退出登录 |

会话页与通讯录页都接了 `useTabBarBadge`：会话总未读与好友申请未读实时同步到原生 tabBar 角标。

### IM 分包页面

| 页面 | 路由 | 看什么 |
|---|---|---|
| 聊天 | `sub-im/pages/chat/chat` | `em-chat-page` 的完整封装：`#banner`、`#custom-message`、`#input-toolbar` 三个插槽，`#input-bar` 整栏自绘分支（`?inputbar=custom`），AI 演示浮钮，场景开关面板 |
| 聊天信息 | `sub-im/pages/chat-info/chat-info` | `em-chat-info-page`：单聊信息、群资料、成员宫格与成员管理 |
| 好友列表 | `sub-im/pages/contact-list/contact-list` | 字母索引、搜索、好友资料与删除 |
| 新请求 | `sub-im/pages/contact-requests/contact-requests` | 好友申请与群邀请的接受/拒绝 |
| 群组 | `sub-im/pages/group/group` | 群列表、建群、群公告与成员操作入口 |
| 场景实验室 | `sub-im/pages/scenario/scenario` | 6 个业务场景卡片与卡片预览入口 |
| 场景详情 | `sub-im/pages/scenario/detail` | 业务上下文、对端/群组选择、输入栏入口预览、进入会话 |
| 卡片预览 | `sub-im/pages/scenario/cards` | 14 种宿主自绘卡片 + 未知事件回落，**无需登录** |
| 样式实验室 | `sub-im/pages/style-lab/style-lab` | 目录页：明暗三档与中英切换（对子页全局生效），入口卡片进各专项页 |
| └ 设计变量 | `sub-im/pages/style-lab/tokens` | 文字 / 背景 / 气泡徽标 / 间距 / 字号五组 token 阶梯 |
| └ 原子组件 | `sub-im/pages/style-lab/components` | em-avatar / em-icon / em-empty / em-skeleton 走查 |
| └ 主题定制 | `sub-im/pages/style-lab/theming` | 运行时主题色（色相条拖拽换全页主色）+ 子树气泡变量定制 |
| └ 覆盖机制 | `sub-im/pages/style-lab/overrides` | custom-style / custom-class / 变量覆盖三组对照 + 覆盖机制探针 |
| └ AI 流式演示 | `sub-im/pages/style-lab/stream` | 流式气泡：光标 / 终态收敛 / 异常提示，分片数与状态实时可见，**无需登录** |
| └ 通用提交态与错误态 | `sub-im/pages/style-lab/states` | 按钮 loading 旋转 / 触底加载错误重试流转 / 选人提交态，**无需登录** |

另有两个诊断页（`sub-im/pages/spike/spike` 五端连通性自检、`sub-im/pages/text-probe/text-probe` 文本测量），不属于演示主流程，可忽略。

## 场景实验室

场景实验室演示同一套 `em-chat-page` 如何套进 6 种业务页面：业务上下文、卡片消息、快捷话术、长按动作、群公告与 @ 提及全部由宿主组合，UIKit 只提供页面、插槽与消息通道。

### 6 个场景

| key | 场景 | 会话类型 | 对端 | 演示卡片（event） |
|---|---|---|---|---|
| `service` | 在线客服 | 单聊 | 客服 | `orderCard` / `serviceTicket` / `refundReview` |
| `medical` | 医患沟通 | 单聊 | 主治医生 | `medicalCase` / `prescription` |
| `trade` | 二手交易 | 单聊 | 卖家 | `productCard` / `priceOffer` |
| `recruit` | 招聘沟通 | 单聊 | HR | `resumeCard` / `interviewInvite` / `phoneExchange` |
| `education` | 家校沟通 | 群聊 | 班级群 | `homeworkCard` / `leaveApproval` |
| `community` | 兴趣社群 | 群聊 | 骑行社群 | `activityCard` / `gearList` |

合计 14 种卡片，对应 5 类视觉族（订单、资料、单据、动作、通用）。

### 列表页流程

1. 「我的」→「IM 场景实验室」。
2. 顶部可填**单聊演示对象 userId**，也可从最近会话里点一个；单聊场景用它作为 `conversationId`。
3. 群聊场景（家校/社群）在详情页选择自己已加入的群组。
4. 点场景卡片进入详情页；「自定义卡片预览」不用登录也能看全部卡片。

### 详情页

- 顶部 hero：场景名、一句话定位、关键指标（响应时效 / 复诊时间 / 价格 / 到岗时间等）、能力标签。
- 业务上下文：服务单号、商品、候选人、学生等字段（纯 demo 数据）。
- 选对端：单聊填 userId 或点最近会话；群聊从已加入群组里选，没有群组时给出去群组页的入口。
- 输入栏入口预览：点击胶囊只弹说明，真实发送在聊天页。
- 底部主按钮：进入会话，路由带 `?conversationId=...&chatType=...&scenario=<key>&scene=1`。
- 主按钮下方是描边次按钮「用自绘输入栏进入」：同样的会话，额外带 `&inputbar=custom`，聊天页把默认输入栏整栏换成 `demo-custom-inputbar`（`#input-bar` 插槽演示，见下节）。

### 进入会话后的场景开关

聊天页右侧「场景开关」浮钮打开底部面板，实时切换 7 项宿主能力，不需要改代码：

| 开关 | 对应能力 |
|---|---|
| 顶部业务横幅 | `#banner` 插槽（固定位，不随消息滚动） |
| 场景标题 | `title` 覆盖默认会话标题 |
| 隐藏详情入口 | `showAction=false`，右上角更多按钮消失 |
| 快捷回复条 | `quickReplies` 常用语胶囊 |
| 常用语直接发送 | `quickReplyMode="send"`（默认 `fill` 填入草稿） |
| 业务长按动作 | `extraMessageMenus` 注入业务菜单项，回调 `@message-menu` |
| 输入栏业务入口 | `#input-toolbar` 插槽，一点即发本场景卡片 |

面板还提供：发送本场景卡片（卡片列表）、发送带业务 `ext` 的文本、插入本地系统提示（`insertLocalNotice`）、发送未注册事件（验证宿主回落），以及「整栏自绘输入栏」切换按钮（`redirectTo` 带/去 `inputbar=custom` 重进页面，与详情页次按钮殊途同归）。面板顶部还显示当前会话未读与总未读，进会话清零后数字实时变化。

### 整栏自绘输入栏（`#input-bar`）

- 入口一：场景详情页主按钮下方的「用自绘输入栏进入」；入口二：聊天内「场景开关」面板的「整栏自绘输入栏」按钮（重进页面生效）。
- 演示组件是 `demo/components/demo-custom-inputbar`：快捷回复、引用条、语音按住说话、emoji 与媒体面板全部自绘，但行为全部经插槽 scope（`EmChatInputBarScope`）驱动——键盘避让由页面壳承担，面板互斥/录音状态机/禁言/@/草稿链路由库内保持。
- 插槽的有无在页面实例创建时确定（UIKit 据此实例化行为核心），所以 demo 用查询参数 + 重进页面切换，而不是场景面板里的实时开关。
- 契约字段与「必须接什么」清单见 [聊天页](./PAGES-CHAT.md)「整栏自绘输入栏」；组件可直接复制到自己工程改样式。

### 卡片发送与输入栏入口

- 输入栏上方是 `demo-composer-bar`：横向滚动胶囊，文案与图标来自场景目录；末尾「更多」重新打开场景开关面板。
- 点胶囊 = `EmKit.sendCustom(conversationId, chatType, event, params, ext)`，对端与己方都通过 `#custom-message` 插槽渲染成卡片。
- 卡片按钮点击由宿主组件回传 `action(key, message)`，业务动作（如「查看工单」）由宿主处理，UIKit 不参与。
- 未注册的 event 走宿主回落样式（示例为 `[自定义消息]`）。

## 宿主侧参考组件

以下两个组件在 `demo/components/` 下，**不随 UIKit 分发**。它们演示「插槽 + 宿主数据」的正确用法，可以直接复制到你的工程再改。

### demo-card

```vue
<template>
  <demo-card :message="message" fallback-text="[自定义消息]" @action="onCardAction" />
</template>
```

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `message` | `EmMessageItem` | — | 自定义消息，读取 `customEvent` 与 `ext` / `customParams` |
| `fallbackText` | `string` | — | 未知事件或缺少标题时的回落文案，由宿主决定语言 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `action` | `(key: string, message: EmMessageItem)` | 主/次按钮点击，`key` 来自卡片数据 |

卡片数据约定（`ext` 中的宿主自定义字段，UIKit 原样透传）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | `string` | 卡片标题（缺失时走回落） |
| `subtitle` | `string` | 副标题 |
| `badge` | `string` | 角标文案 |
| `icon` | `string` | `em-icon` 图标名 |
| `fields` | `{ label, value }[]` | 键值行 |
| `footer` | `string` | 底部说明 |
| `actionText` / `actionKey` | `string` | 主按钮文案与动作 key |
| `secondaryText` / `secondaryKey` | `string` | 次按钮文案与动作 key |

实现要点：组件用独立 `.css` + `styleIsolation: 'app-and-page'`，BEM 前缀是 `demo-`（不套用 UIKit 的 `em-`）；`event` 到视觉族的映射写在 `common/demo-card-data.ts`，新增一种卡片只需加一行映射与一条数据。演示里还包含手机号脱敏：明文在 `customParams.phone`，渲染前由宿主自行打码。

### demo-composer-bar

```vue
<template>
  <demo-composer-bar :items="composerItems" :accent="accent" more-text="更多" @select="onSendCard" @more="openPanel" />
</template>
```

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `items` | `{ key, label, icon }[]` | — | 胶囊列表；`key` 是业务动作 id，`label` 是文案，`icon` 是 `em-icon` 名 |
| `accent` | `string` | `''` | 场景主色，只染图标，不写入 UIKit 主题变量 |
| `moreText` | `string` | `''` | 末尾「更多」胶囊文案，空串不渲染 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `select` | `(key: string)` | 点击某个胶囊 |
| `more` | — | 点击「更多」 |

它被注入 `em-chat-page` 的 `#input-toolbar`，位于消息列表与输入栏之间，随键盘一起上移。

## 改造成自己的工程

| 步骤 | 做法 |
|---|---|
| 1. 复制组件 | 把 `demo-card`、`demo-composer-bar` 复制到自己的 `components/`，改目录名、BEM 前缀与文案 |
| 2. 换事件表 | 用你的 `customEvent` → 视觉组件/字段解析替换 `common/demo-card-data.ts` 的映射 |
| 3. 接插槽 | 聊天页用 `#custom-message` 按 `message.customEvent` 分发；未知事件给回落样式 |
| 4. 注入入口 | 业务入口条放 `#input-toolbar`，点击后调 `EmKit.sendCustom` 发送你的卡片 |
| 5. 换数据 | `common/scenario-catalog.ts` 是演示数据，可整份替换为你的业务上下文（或直接删掉） |
| 6. 保留 UIKit | 不修改 `uni_modules/easemob-uikit-uni`，升级插件时不产生冲突 |

最小接线示例：

```vue
<template>
  <view class="page" :class="themeClass">
    <em-chat-page :conversation-id="conversationId" chat-type="singleChat">
      <template #custom-message="{ message }">
        <demo-card :message="message" fallback-text="[自定义消息]" @action="onCardAction" />
      </template>
      <template #input-toolbar>
        <demo-composer-bar :items="composerItems" @select="onSendCard" />
      </template>
    </em-chat-page>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { CONVERSATION_TYPE, EmKit, useTheme } from '@/uni_modules/easemob-uikit-uni/libs'
import type { EmMessageItem } from '@/uni_modules/easemob-uikit-uni/libs'
import type { EmIconName } from '@/uni_modules/easemob-uikit-uni/components/em-icon/em-icons'
import DemoCard from '@/components/demo-card/demo-card.vue'
import DemoComposerBar from '@/components/demo-composer-bar/demo-composer-bar.vue'

const { themeClass } = useTheme()
const conversationId = ref('user-b')

interface ComposerItem {
  key: string
  label: string
  icon: EmIconName
}

const composerItems: ComposerItem[] = [
  { key: 'orderCard', label: '发订单', icon: 'cart-filled' }
]

async function onSendCard(key: string): Promise<void> {
  await EmKit.sendCustom(conversationId.value, CONVERSATION_TYPE.SINGLE_CHAT, key, { orderId: 'SO-20261020-001' }, {
    title: '订单 · 待发货',
    subtitle: '示例商品 · ¥1,280',
    actionText: '查看订单'
  })
}

function onCardAction(key: string, message: EmMessageItem): void {
  uni.showToast({ title: `动作 ${key}`, icon: 'none' })
}
</script>

<style>
.page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
</style>
```

更完整的业务页封装、四个场景配方与平台边界见[多场景接入](./GUIDE-MULTI-SCENARIO.md)。

## 凭据与安全

- 登录页手填 **appkey / userId / token**，只存在当前设备的本地存储里，不写入代码与仓库。仓库不包含任何真实 appkey、token 或用户数据。
- 开发者模式里的「获取测试 token」入口通过环信 REST 用密码换 token，**仅限开发调试**，不要带进正式分发版本。
- 生产环境 token 必须由你的业务服务端签发，客户端只持有当前会话所需 token。
- 鸿蒙签名材料（`.p12` / `.cer` / `.p7b`）与设备 UDID 属于敏感信息，已在 `.gitignore` 中忽略，不要提交。
- 调试日志会包含消息内容：排查完把 `logPayload` 关掉再发布。

## 演示页与文档对照

| 想了解 | 看示例 | 读文档 |
|---|---|---|
| 从零接入 | 登录页 + `App.uvue` | [快速开始](./QUICKSTART.md) |
| 会话列表 | 会话 tab | [会话列表页](./PAGES-CONVERSATION.md) |
| 聊天交互 | 聊天页 | [聊天页](./PAGES-CHAT.md) |
| 业务卡片与插槽 | 场景实验室 + 卡片预览 | [多场景接入](./GUIDE-MULTI-SCENARIO.md) |
| AI 流式 | 聊天页「AI 演示」+ 样式实验室「AI 流式演示」 | [AI 流式消息](./AI-STREAM.md) |
| 主题与设计变量 | 我的页深色模式 + 样式实验室「设计变量」「主题定制」 | [主题与国际化](./THEME-I18N.md) · [设计变量](./DESIGN-TOKENS.md) |
| 各端差异 | 五个端各跑一遍 | [平台能力与差异](./PLATFORM.md) |
| 小程序分包 | `scripts/uni.sh build mp-weixin` | [微信小程序 SDK 分包](./GUIDE-WEAPP-SDK-SUBPACKAGE.md) |
| 鸿蒙真机 | 运行到鸿蒙 | [鸿蒙真机运行与签名](./HARMONY-REALDEVICE-RUN.md) |

遇到运行问题先看[常见问题](./FAQ.md)。
