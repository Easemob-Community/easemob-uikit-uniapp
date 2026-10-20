# GUIDE-MULTI-SCENARIO.md — 多场景接入指引（客服 / 医疗 / 招聘 / 二手交易）

> 适用对象：用 `easemob-uikit-uni` 做「业务页面放入口 → 直进 1v1 聊天页」的宿主（H5 移动端 / 微信小程序 / App）。
> 评估依据：`docs/EVAL-MULTI-SCENARIO.md`；P0/P1 能力清单与范围见 `PLAN.md` M2.11 / M2.12，卡片插槽演示见 M2.14。
> 阅读顺序：§1 接入模型 → §2 聊天页封装 → §3 P0/P1 能力速查 → §4 场景配方 → §5 平台边界 → §6 Demo 演示。

## 1. 接入模型（三步）

四场景共享同一模型：宿主服务端为终端用户签发环信 token，客户端完成 SDK 初始化/登录后，在业务页直接 `navigateTo` 到含 `em-chat-page` 的自建页面。**不需要会话列表页**。

```ts
// 1) 应用启动时初始化（appkey 只在 init 传一次；小程序分包场景 SDK 异步加载）
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'

EmKit.init({ appkey: 'your-appkey', primaryColor: '#009EFF' })

// 2) 拿到服务端签发的 userId + token 后登录
await EmKit.login({ userId: 'user-123', token: 'server-signed-token' })

// 3) 业务入口直进聊天页（对端 = 客服/医生/HR/卖家 userId）
uni.navigateTo({ url: `/sub-im/pages/chat/chat?conversationId=${peerUserId}&chatType=singleChat` })
```

`EmKit.init` 后 SDK 模块可能仍在异步加载（微信小程序分包）：渲染任何聊天 UI 前用 `EmKit.whenReady()` 出加载态，或直接依赖 `em-chat-page` 内部的就绪门（历史/发送方法会等待就绪）。

页面级组件需要宿主 `pages.json` 配 easycom 规则（原子组件零配置）：

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

## 2. 聊天页封装（推荐模板）

自建页面只做路由参数解包与事件接线，聊天能力全部由 `em-chat-page` 提供：

```html
<!-- pages/chat/chat.uvue -->
<template>
  <view class="page">
    <em-chat-page
      v-if="conversationId !== ''"
      :conversation-id="conversationId"
      chat-type="singleChat"
      title="在线客服"
      :show-action="false"
      @send="onSend"
    >
      <!-- 固定业务条：不随消息滚动（医疗病情摘要 / 招聘职位 / 交易商品） -->
      <template #banner>
        <view class="biz-banner">
          <text class="biz-banner__title">{{ bannerTitle }}</text>
          <text class="biz-banner__desc">{{ bannerDesc }}</text>
        </view>
      </template>

      <!-- 自定义卡片消息：按 customEvent 分发，message 为 EmMessageItem -->
      <template #custom-message="{ message }">
        <view v-if="message.customEvent === 'orderCard'" class="order-card">
          <text class="order-card__title">{{ String(message.ext.title ?? '') }}</text>
          <text class="order-card__price">{{ String(message.ext.price ?? '') }}</text>
        </view>
        <view v-else class="em-chat-page__bubble em-bubble">
          <text class="em-chat-page__text">{{ message.customEvent || '自定义消息' }}</text>
        </view>
      </template>
    </em-chat-page>
  </view>
</template>
```

要点：

- `conversationId` / `chatType` 必填；单聊 `chatType="singleChat"`，群聊 `groupChat`。
- `title` 覆盖导航标题（空串回落默认昵称链）；`showAction` 默认 `true`，为 `false` 时隐藏右上角详情入口，业务信息页由宿主接管。
- `#banner` 位于 nav-bar 与群公告条之间，宿主自管高度与样式（建议 44–56px，别超过窗口高度 1/4）。
- `#custom-message` 同时作用于接收消息与**己方发送的**自定义消息（所见即所发）；不提供插槽时默认渲染「[自定义消息]」占位。

## 3. P0/P1 能力速查

### 3.1 发送侧业务上下文（`sendText` 的 ext）

直进会话时把订单/商品/来源页带给对端，随文本消息一起发送：

```ts
await EmKit.sendText(
  peerUserId,
  'singleChat',
  '你好，我想咨询这个订单',
  undefined,                 // 引用（可选）
  undefined,                 // @提及 userId 列表（可选，群聊用）
  { orderId: 'SO-20261020-001', source: 'order-detail', sku: 'A-100' }
)
```

接收侧从 `message.ext` 读取。约束：

- `ext` 必须 JSON 可序列化；空对象等价于不挂 ext。
- `emQuote`（引用）与 `em_at_list`（@提及）是 UIKit 内部保留 key，**业务 ext 不能覆盖**（同时存在时内部 key 优先）。

### 3.2 卡片消息（`sendCustom` + `#custom-message` 插槽）

商品卡、病例、处方、面试邀约、手机号交换、砍价等结构化消息走自定义消息。**UIKit 只负责「发得出、收得到、有插槽」，卡片长什么样、字段怎么排、文案用什么语言，全部由宿主决定**。

**发送**：`sendCustom(event, params?, ext?)`，`params` 只放字符串（SDK 协议字段），结构化内容放 `ext`：

```ts
await EmKit.sendCustom(
  peerUserId,
  'singleChat',
  'productCard',                    // 宿主自定义事件名
  { productId: 'P-9527' },          // wire params：跨端/服务端互通
  {                               // ext：结构化业务载荷（JSON 可序列化）
    title: '九成新公路车',
    price: '¥1,280',
    orderId: 'SO-20261020-001'
  }
)
```

**渲染**：聊天页 `#custom-message` 插槽（作用域 `message`），宿主注入自己的卡片组件：

```html
<em-chat-page :conversation-id="id" chat-type="singleChat">
  <template #custom-message="{ message }">
    <my-card
      :message="message"
      fallback-text="[自定义消息]"
      @action="onCardAction"
    />
  </template>
</em-chat-page>
```

宿主卡片组件的最小形态：

```html
<!-- my-card.vue：完全属于宿主项目，可任意布局/动画/图片/多语言 -->
<template>
  <view v-if="card != null" class="my-card">
    <image v-if="card.image" :src="card.image" class="my-card__cover" />
    <text class="my-card__title">{{ card.title }}</text>
    <view class="my-card__actions">
      <view class="my-card__btn" @click="emit('action', 'open', message)">{{ t('card.open') }}</view>
    </view>
  </view>
  <view v-else class="my-card my-card--fallback">{{ fallbackText }}</view>
</template>
```

`message` 上可直接取：

| 字段 | 说明 |
|---|---|
| `message.type` | `MESSAGE_TYPE.CUSTOM`（`'custom'`） |
| `message.customEvent` | 业务事件名（wire `body.event`），宿主据此分发卡片 |
| `message.customParams` | 字符串参数表（wire `body.params`） |
| `message.ext` | 结构化业务载荷（与 vue 版 UIKit / 服务端下发的 custom 消息互通） |
| `message.rawType` | 恒为 `'custom'`；未识别 wire 类型时为其原文 |
| `message.self` | 是否己方发送（宿主可做左右不同样式） |

样式、多语言与交互：

- **样式**：卡片组件用宿主自己的 CSS/设计系统；想跟随 UIKit 明暗主题时消费 `--em-*` token（`--em-bg-base`、`--em-text-primary`、`--em-border-color` 等），主题类在页面根节点即可生效。单卡宽度/间距建议在宿主页面用外层 `view` 包裹控制，五端最稳。
- **多语言**：UIKit 不产生卡片文案，`useLocale()` 在宿主组件里照常可用；跨语言收发时建议 `ext` 存业务 code（如 `status: 'pending'`），由接收端翻译成当前语言，而不是直接存中文句子。
- **动作**：卡片内部按钮直接走宿主自己的事件/路由；无需 UIKit 参与。
- **长按**：`#custom-message` 外层容器会把原生 longpress 冒泡给消息菜单，卡片内容长按也能唤起「复制/引用/删除/业务动作」。`MESSAGE_TYPE.CUSTOM` 的复制/引用摘要回落为 i18n `message.custom`。
- **兜底**：未知 event、解析失败、无标题由宿主决定（Demo 回落 `[自定义消息]` 灰色气泡）；`#custom-message` 也会收到未识别的 wire 类型，可按 `message.rawType` 再做分支。
- **为什么内核对卡片只留插槽**：卡片布局/字段/多语言随业务差异极大，内置 schema 必然不够；且 uni-app x 五端无法动态实例化宿主组件，「注册表 + 固定模板」的灵活性不如整卡自绘。内核保证通道稳定，呈现完全下沉。

Demo 参考实现：`demo/components/demo-card`（宿主侧组件，14 种卡片、双动作、手机号脱敏、未知回落）与免登录预览页 `sub-im/pages/scenario/cards`。可直接复制到业务项目后改样式。

### 3.3 顶部业务条（`#banner`）

固定位、不随消息滚动，适合长期展示的会话上下文：

| 场景 | banner 内容 |
|---|---|
| 医疗 | 诊断/过敏史摘要、问诊单号 |
| 招聘 | 职位名 + 薪资，点击跳职位详情（宿主自接路由） |
| 二手交易 | 正在咨询的商品（图 + 标题 + 价格） |
| 客服 | 来源渠道 / 服务单号 |

### 3.4 导航标题与详情入口（`title` / `showAction`）

- 客服：`title="在线客服"`、`:show-action="false"`（不暴露对端资料与免打扰/删除会话等 C 端操作）。
- 伪装群（多客服/问诊团队）：`showMemberCount=false`、`showAnnouncement=false`、`senderNameMode="hidden"`、`enableMention=false`，配合 `showAction=false` 由宿主提供「服务信息」页。

### 3.5 系统提示消息（`insertLocalNotice`）

居中小灰条，**只插本地、不发服务端、不进对方会话**，用于交易状态/转接/排队提示：

```ts
EmKit.insertLocalNotice(peerUserId, 'singleChat', '对方已拍下，等待付款')
// 群聊别名（等价）：EmKit.insertGroupNotice(groupId, '客服小环已接入')
```

- 渲染形态复用 `MESSAGE_TYPE.NOTICE`：居中 chip、无头像无气泡、长按菜单禁用。
- 本地条目在 `loadHistory` 合并时保留（进会话拉历史不会丢），清空聊天记录/登出时随消息缓存清除；进程重启后不保留（纯内存态）。
- 只对当前设备当前账号可见；需要跨端留痕的状态请走服务端自定义消息或系统通知。

### 3.6 对端资料注入与入口未读角标

```ts
import { mergeUserInfo } from '@/uni_modules/easemob-uikit-uni/libs'
// 不等 SDK 同步，进会话前直接灌客服/医生/HR 的昵称头像
mergeUserInfo({ userId: peerUserId, nickname: '在线客服', avatarUrl: 'https://...' })
```

```ts
import { useUnreadCounts, useTabBarBadge, useConversationUnreadCount } from '@/uni_modules/easemob-uikit-uni/libs'
const { conversationUnread } = useUnreadCounts()      // 响应式总未读
useTabBarBadge({ conversationIndex: 0 })               // 原生 tabBar 角标
const peerUnread = useConversationUnreadCount(peerUserId) // 单会话未读（业务入口角标）
```

非 tabBar 入口（业务页按钮）直接用 `conversationUnread.value` / `peerUnread.value` 渲染 `em-badge` 即可；`useConversationUnreadCount` 也接受 ref（动态会话）；非 setup 场景用 `EmKit.conversationUnreadCountOf(conversationId)` 取快照。

### 3.7 快捷回复条（`quickReplies`）

常用语胶囊渲染在输入栏上方，横向滚动；点击行为由 `quickReplyMode` 决定：

```ts
import type { EmQuickReply } from '@/uni_modules/easemob-uikit-uni/libs'

const QUICK_REPLIES: EmQuickReply[] = [
  { label: '期望薪资', text: '我的期望薪资是 15-20K' },
  { label: '到岗时间', text: '我可以在两周内到岗' },
  { label: '方便沟通', text: '您好，请问现在方便沟通吗？' }
]
```

```html
<em-chat-page
  :conversation-id="conversationId"
  chat-type="singleChat"
  :quick-replies="QUICK_REPLIES"
  quick-reply-mode="fill"
/>
```

- `fill`（默认）：点击**替换当前草稿**，用户可编辑后发送；`send`：点击直接发送（不挂引用/@提及）。
- 空数组不渲染；全员禁言的群聊自动隐藏；文案由宿主提供，不占用 i18n 表。

### 3.8 自定义长按菜单动作（`extraMessageMenus`）

在内置菜单（复制/引用/撤回/删除）之后追加业务动作，命中时 emit `message-menu(key, message)`：

```ts
import { MESSAGE_TYPE } from '@/uni_modules/easemob-uikit-uni/libs'
import type { EmMessageMenuExtra, EmMessageItem } from '@/uni_modules/easemob-uikit-uni/libs'

const EXTRA_MENUS: EmMessageMenuExtra[] = [
  { key: 'view-order', text: '查看订单', icon: 'doc', types: [MESSAGE_TYPE.CUSTOM] },
  { key: 'view-prescription', text: '查看处方', icon: 'doc' }
]

function onMessageMenu(key: string, message: EmMessageItem): void {
  if (key === 'view-order') {
    uni.navigateTo({ url: `/pages/order/detail?id=${String(message.ext.orderId ?? '')}` })
  }
}
```

```html
<em-chat-page
  :conversation-id="conversationId"
  chat-type="singleChat"
  :extra-message-menus="EXTRA_MENUS"
  @message-menu="onMessageMenu"
/>
```

约束：业务项追加在内置项之后、删除项之前（删除保持末位）；内置 key（`copy`/`quote`/`recall`/`delete`）保留，同名业务项会被忽略；`types` 缺省表示全部消息类型；系统提示灰条（NOTICE）不显示长按菜单；`icon` 取 `em-icon` 字形名。

自定义消息卡片（`#custom-message` 里的宿主内容）同样支持长按：卡片内的原生 `longpress` 会冒泡到消息行，无需额外接线。

### 3.9 AI 流式回复（`onStreamMessage` / `#stream-message`）

AI 客服的常见形态：业务服务端调用模型 → 经环信 RESTful 下发流式消息 → 客户端 SDK `onStreamMessage` 接收。UIKit 已内置分片合并、合批重绘、丢片补偿与纯文本光标，**接入方无需写渲染代码**：

```ts
EmKit.init({
  appkey: 'your-appkey',
  enableStreamMessage: true,  // 默认 true；关闭后等完整消息一次上屏
  streamThrottle: 50          // 合批间隔 ms；0 = 逐片即写
})
```

markdown 等富格式气泡由 `#stream-message` 插槽接管（未接管时纯文本兜底）：

```html
<em-chat-page :conversation-id="id" chat-type="singleChat">
  <template #stream-message="{ message }">
    <my-markdown-bubble :message="message" />
  </template>
</em-chat-page>
```

外部 AI 面板需要同步展示生成过程时，订阅 `EmKit.onStreamMessage(handler)`（分片已合批，`msg.stream.fullText/status` 为最新值；页面卸载必须取消订阅）。生产环境不要把模型 API Key 放前端。完整能力说明见仓库 README「AI 流式消息」章节。

### 3.10 输入栏业务入口（`#input-toolbar`）

发送侧的入口不一定要藏在面板里。更贴近业务的做法是在**输入栏上方放一条场景胶囊条**：客服「发订单/发工单」、医生「发病例/发处方」、HR「发简历/发邀约/换手机号」，点一下就把对应自定义消息发出去。UIKit 只给固定位，胶囊长什么样、有哪些、点了发什么，全是宿主代码：

```html
<em-chat-page :conversation-id="id" chat-type="singleChat">
  <template #input-toolbar>
    <my-composer-bar :items="composerItems" @select="onComposerSelect" />
  </template>
</em-chat-page>
```

```ts
const composerItems = [
  { key: 'orderCard', label: '发订单', icon: 'cart-filled' },
  { key: 'serviceTicket', label: '发工单', icon: 'board' }
]

function onComposerSelect(key: string): void {
  const card = MY_CARDS.find((item) => item.event === key)
  if (card == null) return
  EmKit.sendCustom(peerUserId, 'singleChat', card.event, card.params, card.ext)
}
```

要点：

- **位置**：插槽在消息列表与输入栏之间（快捷回复条之上），随软键盘一起上移，不参与消息滚动；不注入就不占高度。
- **开关**：入口显隐由宿主 `v-if` 控制（如仅坐席端可见、仅特定工单状态出现），`em-chat-page` 不感知入口存在。
- **边界**：UIKit 不提供胶囊样式、图标语义、入口排序与点击后的发送逻辑；入口文案走宿主自己的 i18n。
- **发送即卡片**：点一下 = 一次 `sendCustom`，对端仍由 `#custom-message` 渲染（§3.2），两个插槽互不依赖。
- **数量**：入口多时宿主自备横向 `scroll-view`；移动端建议 2–4 个高频入口，其余收进「更多」。

Demo 参考：`demo/components/demo-composer-bar`（横向胶囊条，独立样式）+ `demo/sub-im/pages/chat/chat.uvue` 的 `#input-toolbar` 接线；入口清单直接来自场景目录每条卡片的 `entryLabel/entryIcon`，新增一种卡片就自动多一个入口。

![输入栏业务入口（宿主注入 #input-toolbar）](assets/scene-lab-composer.png)

## 4. 四场景配方

| 场景 | 推荐组合 | 多人服务 |
|---|---|---|
| 客服 | `title="在线客服"` + `showAction=false` + `sendText` ext 带来源/订单 + `sendCustom('serviceTicket'/'refundReview')` 工单/退款卡 + `quickReplies` 话术 + `insertLocalNotice` 转接提示 + AI 流式回复 | 路线 A（共享客服账号单聊）今天可用；人格化转接再上路线 B |
| 医疗 | `#banner` 病情摘要 + 图片/文件（H5）报告 + `sendCustom('medicalCase'/'prescription')` 病例/处方卡 + 已读回执 + `extraMessageMenus`「查看处方」 | 路线 B（真群，保留昵称行区分主治/助手） |
| 招聘 | `#banner` 职位条 + 简历文件 + `sendCustom('interviewInvite'/'phoneExchange')` 邀约/手机号交换卡 + `quickReplies` 常用语 | 路线 A 足够 |
| 二手交易 | `#banner` 商品条 + `sendCustom('productCard'/'priceOffer')` + `insertLocalNotice` 交易状态 + `extraMessageMenus`「查看订单」 | 买卖单聊路线 A；平台仲裁三人群走路线 B（二期） |

各场景的高频发卡入口建议直接放 `#input-toolbar`：客服（发订单/发工单/退款审核）、医疗（发病例/发处方）、招聘（发简历/发邀约/换手机号）、交易（发商品/发报价）、家校（发作业/请假审批）、社群（发活动/装备清单）。

路线 A/B 的完整对比见 `docs/EVAL-MULTI-SCENARIO.md` §5。

## 5. 平台边界（如实告知接入方）

| 能力 | H5 移动端 | 小程序 | App |
|---|---|---|---|
| 图片/拍照、文件（PDF/简历） | ✅ / ✅ | ✅ / ✅ | ✅ / ❌（chooseFile 待补） |
| 录音/语音消息 | ❌ 仅接收播放（入口已隐藏） | ✅ | ✅ |
| 视频消息 | ⚠️ 选择受限，预览仅 H5 | ✅ | ✅ |
| 软键盘避让 | 浏览器自管 | ✅ | ✅（手动顶起） |

P2 边界（H5 录音、位置消息）尚未落地，接入方需自行兜底或等后续里程碑；快捷回复/自定义菜单动作已随 P1 落地（§3.7/§3.8）。

## 6. Demo 演示（本仓库 · IM 场景实验室）

demo 工程内置「IM 场景实验室」，用同一套 `em-chat-page` 组合出 6 种业务页面，验证 UIKit 的改造空间：

| 场景 | 会话形态 | 主要演示 |
|---|---|---|
| 在线客服 | 单聊 | 业务页直进、来源/工单横幅、工单/退款卡、快捷话术、转接灰条 |
| 医患沟通 | 单聊 | 病情摘要 `#banner`、报告图片/文件、病例/处方卡片（仅医生可见角标） |
| 二手交易 | 单聊 | 商品条、商品/砍价卡片、双动作按钮、交易状态灰条 |
| 招聘沟通 | 单聊 | 职位条、常用语、简历文件、面试邀约 + 手机号交换（宿主组件脱敏） |
| 家校沟通 | 群聊 | 班级公告、@老师、成员昵称行、作业卡、请假审批卡 |
| 兴趣社群 | 群聊 | 群公告、@群主、活动卡、装备清单卡 |

![IM 场景实验室 · 场景列表](assets/scene-lab-gallery.png)

![二手交易 · 业务详情页（同一条 catalog 配置驱动）](assets/scene-lab-detail-trade.png)

体验路径：

1. 「我的」→「IM 场景实验室」→ 选一个场景卡片（业务详情页展示业务上下文、能力点、演示对象）；
2. 单聊场景填对端 userId（或点最近会话），群聊场景选一个已有群组；点底部主按钮进入会话；
3. 会话页点右侧「场景开关」浮钮，七项能力**实时生效**：业务横幅 / 场景标题 / 隐藏详情入口 / 快捷回复条 / 常用语直接发送 / 业务长按动作 / 输入栏业务入口；
4. 输入栏上方的场景胶囊（`#input-toolbar`）一点即发对应卡片；也可在面板内发送本场景的 2–3 种卡片（`sendCustom`，聊天页 `#custom-message` 注入宿主 `demo-card`）、带业务 ext 的文本（`sendText`）、系统提示（`insertLocalNotice`）；点卡片按钮由宿主弹窗展示回传动作；「未知事件」演示宿主兜底；长按卡片/气泡触发业务菜单；顶部实时显示本会话/总未读。

免登录看卡片：列表页顶部「自定义卡片预览」→ `sub-im/pages/scenario/cards`，用宿主 `demo-card` 直接渲染 14 种卡片 + 未知事件回落：

![自定义卡片预览（宿主自绘，免登录）](assets/scene-lab-cards.png)

14 种卡片与「未知事件 → [自定义消息]」的完整长图见 [scene-lab-cards-all.png](assets/scene-lab-cards-all.png)（含 5 种视觉族、字段/角标/主次按钮与手机号脱敏）。

架构：场景数据集中在 `demo/common/scenario-catalog.ts`（业务字段、能力点、横幅、话术、入口胶囊文案、每场景 2–3 条卡片 event/params/ext、菜单），卡片解析在 `demo/common/demo-card-data.ts`、呈现组件在 `demo/components/demo-card`（均为宿主侧代码，不进 UIKit），列表页 `scenario.uvue` → 详情页 `detail.uvue` → 共享聊天页 `chat.uvue?scenario=<key>`。**新增场景只需加一条 catalog 配置 + 一条宿主卡片分支，不复制聊天页**——这本身就是「UIKIT 可组合」的演示。

---

*本指引随 P0/P1 能力落地；新增扩展点时同步更新本文与 `docs/EVAL-MULTI-SCENARIO.md`。*
