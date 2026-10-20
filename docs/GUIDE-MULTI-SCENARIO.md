# GUIDE-MULTI-SCENARIO.md — 多场景接入指引（客服 / 医疗 / 招聘 / 二手交易）

> 适用对象：用 `easemob-uikit-uni` 做「业务页面放入口 → 直进 1v1 聊天页」的宿主（H5 移动端 / 微信小程序 / App）。
> 评估依据：`docs/EVAL-MULTI-SCENARIO.md`；P0/P1 能力清单与范围见 `PLAN.md` M2.11 / M2.12。
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

### 3.2 卡片消息（`sendCustom` + `#custom-message`）

商品卡、处方单、面试邀约、砍价出价等结构化消息走自定义消息：

```ts
await EmKit.sendCustom(
  peerUserId,
  'singleChat',
  'productCard',                 // event：业务事件名，宿主自有命名空间
  { productId: 'P-9527' },       // params：SDK 字符串参数表（跨 UIKit / 服务端互通）
  { title: '九成新公路车', price: '¥1,280', image: 'https://...' } // ext：结构化载荷
)
```

接收侧（含发送侧回显）在 `#custom-message` 里按 `message.customEvent` 分发：

| 字段 | 说明 |
|---|---|
| `message.type` | `MESSAGE_TYPE.CUSTOM`（`'custom'`） |
| `message.customEvent` | 业务事件名（wire `body.event`） |
| `message.customParams` | 字符串参数表（wire `body.params`） |
| `message.ext` | 结构化业务载荷（与 vue 版 uikit 及服务端下发的 custom 消息互通） |
| `message.rawType` | 恒为 `'custom'`；旧宿主用 `rawType` 非空判别自定义消息仍然成立 |

`params` 只能放字符串值，复杂结构（数组/对象）放 `ext`。自定义消息发送失败后可正常重发（`customEvent/customParams/ext` 会重建）。

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

## 4. 四场景配方

| 场景 | 推荐组合 | 多人服务 |
|---|---|---|
| 客服 | `title="在线客服"` + `showAction=false` + `sendText` ext 带来源/订单 + `quickReplies` 话术 + `insertLocalNotice` 转接提示 + AI 流式回复（`onStreamMessage` / `#stream-message`） | 路线 A（共享客服账号单聊）今天可用；人格化转接再上路线 B |
| 医疗 | `#banner` 病情摘要 + 图片/文件（H5）报告 + `sendCustom('prescription')` 处方卡 + 已读回执 + `extraMessageMenus`「查看处方」 | 路线 B（真群，保留昵称行区分主治/助手） |
| 招聘 | `#banner` 职位条 + 简历文件 + `sendCustom('interviewInvite')` 邀约卡 + `quickReplies` 常用语 | 路线 A 足够 |
| 二手交易 | `#banner` 商品条 + `sendCustom('productCard'/'bargainOffer')` + `insertLocalNotice` 交易状态 + `extraMessageMenus`「查看订单」 | 买卖单聊路线 A；平台仲裁三人群走路线 B（二期） |

路线 A/B 的完整对比见 `docs/EVAL-MULTI-SCENARIO.md` §5。

## 5. 平台边界（如实告知接入方）

| 能力 | H5 移动端 | 小程序 | App |
|---|---|---|---|
| 图片/拍照、文件（PDF/简历） | ✅ / ✅ | ✅ / ✅ | ✅ / ❌（chooseFile 待补） |
| 录音/语音消息 | ❌ 仅接收播放（入口已隐藏） | ✅ | ✅ |
| 视频消息 | ⚠️ 选择受限，预览仅 H5 | ✅ | ✅ |
| 软键盘避让 | 浏览器自管 | ✅ | ✅（手动顶起） |

P2 边界（H5 录音、位置消息）尚未落地，接入方需自行兜底或等后续里程碑；快捷回复/自定义菜单动作已随 P1 落地（§3.7/§3.8）。

## 6. Demo 演示（本仓库）

demo 工程内置了可交互的能力演示，用于验收 P0/P1 能力：

1. 「我的」→「多场景能力演示」→ 选择最近单聊会话或手动输入对端 userId；
2. 进入演示会话（聊天页 URL 带 `scene=1`），点右侧「场景开关」浮钮打开面板；
3. 六项开关**实时生效**：顶部业务横幅 / 客服标题 / 隐藏详情入口 / 快捷回复条 / 常用语直接发送 / 业务长按动作；
4. 面板内三个动作：发送商品卡片（`sendCustom`）、发送带 ext 文本（`sendText`）、插入交易提示（`insertLocalNotice`）；长按商品卡片或文本气泡可触发「查看订单 / 查看处方」；
5. 面板顶部实时显示「本会话未读 / 总未读」（P1-1 API）。

源码：`demo/sub-im/pages/scenario/scenario.uvue`（入口页）、`demo/sub-im/pages/chat/chat.uvue`（`?scene=1` 分支与开关面板）。

---

*本指引随 P0/P1 能力落地；新增扩展点时同步更新本文与 `docs/EVAL-MULTI-SCENARIO.md`。*
