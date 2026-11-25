<!-- Generated from skills/em-host-business-extension/SKILL.md by scripts/sync-skills-docs.mjs. Do not edit directly. -->

# 业务直进会话与自定义卡片

> 基线：UIKit `1.0.5`。适用「业务页面放入口 → 直进 1v1/群聊」的宿主，**可以不要会话列表**。
> 前置：已完成 `em-host-integration` 的初始化与登录，并能打开 `em-chat-page`。

## 1. 接入模型

```ts
// 1) 启动时初始化一次
EmKit.init({ appkey: 'YOUR_APPKEY' })

// 2) 业务登录后拿到服务端签发的 userId + token
await EmKit.login({ userId, token })

// 3) 业务入口直进聊天页（对端 = 客服/医生/HR/卖家的 userId）
uni.navigateTo({ url: `/sub-im/pages/chat/chat?conversationId=${peerUserId}&chatType=singleChat` })
```

- 单聊 `conversationId` 就是对端 userId；群聊是 groupId。
- 需要该会话出现在会话列表时，先 `EmKit.addConversation(peerUserId, 'singleChat')`；不需要就不调。
- 直进页仍然用 `em-chat-page`，历史、发送、未读、键盘等全部复用。

## 2. 能力速查

| 能力 | 用法 | 关键约束 |
|---|---|---|
| 业务上下文 | `sendText(to, chatType, text, quote?, mentions?, ext?)` | `ext` 必须 JSON 可序列化；不能占用内部 key |
| 卡片消息 | `sendCustom(to, chatType, event, params?, ext?)` + `#custom-message` | UIKit 只给通道和插槽，**整卡由宿主渲染** |
| 顶部业务条 | `#banner` 插槽 | 固定位，不随消息滚动；高度宿主自管 |
| 导航标题/详情 | `title` / `showAction` | 客服可隐藏详情入口 |
| 输入栏业务入口 | `#input-toolbar` 插槽 | 在消息区与输入栏之间，随键盘上移 |
| 快捷回复 | `quickReplies` + `quickReplyMode` | `fill` 填草稿 / `send` 直发 |
| 业务长按 | `extraMessageMenus` + `@message-menu` | 追加在内置项后、删除项前 |
| 本地系统提示 | `EmKit.insertLocalNotice(...)` | 只本地、不发服务端、进程重启不保留 |
| 对端资料注入 | `EmKit.setUserPresentation(userId, { nickname, avatarUrl })` | 业务覆盖层优先于 SDK 资料，后续同步不会冲掉 |
| 单会话未读 | `useConversationUnreadCount(conversationId)` | 业务入口角标 |

## 3. 发送业务上下文（ext）

```ts
await EmKit.sendText(
  peerUserId,
  'singleChat',
  '你好，我想咨询这个订单',
  undefined,   // 引用（可选）
  undefined,   // @ 提及 userId 列表（群聊可选）
  { orderId: 'SO-20261020-001', source: 'order-detail', sku: 'A-100' }
)
```

接收侧：

```ts
import { onUnmounted } from 'vue'

const off = EmKit.onMessage((message) => {
  const orderId = String(message.ext['orderId'] ?? '')
  // ...
})

// 页面卸载时取消订阅，避免回调泄漏
onUnmounted(() => off())
```

约束：

- `ext` 必须可 JSON 序列化；空对象等价于不挂。
- **保留 key 不能覆盖**：`msgQuote`（引用主协议）、`emQuote`（0.x 兼容）、`em_at_list`（@ 提及）。同 key 同时存在时 UIKit 内部值优先。
- 跨语言场景 ext 存业务 code（如 `status: 'pending'`），展示时再翻译，不要直接存中文句子。

## 4. 自定义卡片消息

### 4.1 发送

```ts
await EmKit.sendCustom(
  peerUserId,
  'singleChat',
  'productCard',                 // 宿主自定义事件名（跨端约定后不要随意改）
  { productId: 'P-9527' },       // wire params：只能是字符串
  {                              // ext：结构化业务载荷
    title: '九成新公路车',
    price: '¥1,280',
    image: 'https://cdn.example.com/p.jpg',
    orderId: 'SO-20261020-001'
  }
)
```

- `event` 是接收端的唯一分发依据，建议用稳定的英文事件名。
- `params` 只能放字符串（SDK 协议字段）；数字/布尔/嵌套结构放 `ext`。
- 双方都装 UIKit 时，接收侧从 `message.customEvent` / `message.customParams` / `message.ext` 读取。

### 4.2 渲染

```vue
<em-chat-page :conversation-id="id" chat-type="singleChat">
  <template #custom-message="{ message }">
    <my-card :message="message" @action="onCardAction" />
  </template>
</em-chat-page>
```

宿主卡片组件的最小形态（宿主项目内的普通组件）：

```vue
<template>
  <view v-if="message.customEvent === 'productCard'" class="card">
    <image v-if="cover !== ''" :src="cover" class="card__cover" mode="aspectFill" />
    <view class="card__body">
      <text class="card__title">{{ title }}</text>
      <text class="card__price">{{ price }}</text>
      <view class="card__btn" @click="emit('action', 'open', message)">查看商品</view>
    </view>
  </view>
  <view v-else class="card card--fallback">
    <text>{{ message.customEvent || '[自定义消息]' }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { EmMessageItem } from '@/uni_modules/easemob-uikit-uni/libs'

const props = defineProps<{ message: EmMessageItem }>()
const emit = defineEmits<{ (e: 'action', key: string, message: EmMessageItem): void }>()

const title = computed(() => String(props.message.ext['title'] ?? ''))
const price = computed(() => String(props.message.ext['price'] ?? ''))
const cover = computed(() => String(props.message.ext['image'] ?? ''))
</script>

<style>
.card { width: 480rpx; border-radius: 12px; overflow: hidden; background-color: var(--em-bg-elevated); }
.card__cover { width: 100%; height: 240rpx; }
.card__body { padding: 10px 12px; }
.card__title { font-size: 14px; color: var(--em-text-primary); }
.card__price { margin-top: 4px; font-size: 16px; color: var(--em-primary-color); }
.card__btn { margin-top: 10px; padding: 8px; text-align: center; border-radius: 8px; background-color: var(--em-primary-color); color: #fff; }
.card--fallback { padding: 10px 12px; color: var(--em-text-secondary); }
</style>
```

`message` 上可直接取：

| 字段 | 说明 |
|---|---|
| `type` | `MESSAGE_TYPE.CUSTOM`（`'custom'`） |
| `customEvent` | 业务事件名（wire `body.event`），按它分发卡片 |
| `customParams` | 字符串参数表（wire `body.params`） |
| `ext` | 结构化业务载荷（与 vue 版 UIKit / 服务端下发的 custom 消息互通） |
| `rawType` | 未识别 wire 类型时为其原文；CUSTOM 恒为 `'custom'` |
| `self` | 是否己方发送，可做左右不同样式 |

要点：

- 插槽同时作用于**接收和己方发送**的自定义消息（所见即所发）。
- 不提供插槽时默认渲染「[自定义消息]」占位。
- 未知事件/解析失败由宿主兜底；也可以按 `rawType` 再分支。
- 卡片按钮直接走宿主自己的事件/路由，不经过 UIKit。
- 卡片外层的长按会冒泡给消息菜单，卡片内容长按也能唤起复制/引用/删除/业务动作。
- 想让卡片跟随 UIKit 主题：宿主页面根节点绑 `themeClass`，卡片内用 `--em-bg-elevated` / `--em-text-primary` / `--em-border-color` 等 token，不要写死黑白色。
- 宽度：单卡建议外层统一控制（如 480rpx），五端最稳。

**UIKit 不提供卡片组件、schema、样式**——这是刻意设计：卡片随业务差异极大，宿主自绘最灵活。demo 的 `demo-card` 是参考实现（14 种卡片、双动作、脱敏、未知回落），可复制到宿主后改样式。

## 5. 顶部业务条（`#banner`）

```vue
<em-chat-page :conversation-id="id" chat-type="singleChat" title="在线客服" :show-action="false">
  <template #banner>
    <view class="biz-banner">
      <text class="biz-banner__title">订单 SO-20261020-001</text>
      <text class="biz-banner__desc">待发货 · 九成新公路车</text>
    </view>
  </template>
</em-chat-page>
```

- 位置：导航栏下、群公告上，固定不随消息滚动。
- 高度建议 44–56px，不超过窗口高度 1/4；样式全部宿主自管。
- 适合：医疗病情摘要、招聘职位、交易商品、客服来源渠道/工单号。

## 6. 输入栏业务入口（`#input-toolbar`）

```vue
<em-chat-page :conversation-id="id" chat-type="singleChat">
  <template #input-toolbar>
    <scroll-view scroll-x class="tools">
      <view v-for="item in tools" :key="item.key" class="tools__item" @click="onTool(item.key)">
        <text>{{ item.label }}</text>
      </view>
    </scroll-view>
  </template>
</em-chat-page>
```

```ts
const tools = [
  { key: 'orderCard', label: '发订单' },
  { key: 'serviceTicket', label: '发工单' }
]

function onTool(key: string): void {
  EmKit.sendCustom(peerUserId, 'singleChat', key, {}, { /* 业务载荷 */ }).catch(() => {
    uni.showToast({ title: '发送失败', icon: 'none' })
  })
}
```

- 位置：消息列表与输入栏之间（快捷回复条之上），随软键盘上移，不参与消息滚动。
- 不注入就不占高度；入口显隐由宿主 `v-if` 控制。
- 移动端建议 2–4 个高频入口，其余收进「更多」；数量多时宿主自备横向 `scroll-view`。
- UIKit 不提供胶囊样式、排序、图标语义、点击后的发送逻辑。

## 7. 快捷回复（`quickReplies`）

```ts
import type { EmQuickReply } from '@/uni_modules/easemob-uikit-uni/libs'

const QUICK_REPLIES: EmQuickReply[] = [
  { label: '期望薪资', text: '我的期望薪资是 15-20K' },
  { label: '到岗时间', text: '我可以在两周内到岗' }
]
```

```vue
<em-chat-page
  :conversation-id="id"
  chat-type="singleChat"
  :quick-replies="QUICK_REPLIES"
  quick-reply-mode="fill"
/>
```

- `fill`（默认）：点击替换当前草稿，用户可编辑后发送。
- `send`：点击直接发送（不挂引用/@提及）。
- 空数组不渲染；全员禁言的群自动隐藏；文案由宿主提供，不进 UIKit i18n 表。

## 8. 业务长按动作（`extraMessageMenus`）

```ts
import { MESSAGE_TYPE } from '@/uni_modules/easemob-uikit-uni/libs'
import type { EmMessageMenuExtra, EmMessageItem } from '@/uni_modules/easemob-uikit-uni/libs'

const EXTRA_MENUS: EmMessageMenuExtra[] = [
  { key: 'view-order', text: '查看订单', icon: 'doc', types: [MESSAGE_TYPE.CUSTOM] },
  { key: 'view-prescription', text: '查看处方', icon: 'doc' }
]

function onMessageMenu(key: string, message: EmMessageItem): void {
  if (key === 'view-order') {
    uni.navigateTo({ url: `/pages/order/detail?id=${String(message.ext['orderId'] ?? '')}` })
  }
}
```

```vue
<em-chat-page
  :conversation-id="id"
  chat-type="singleChat"
  :extra-message-menus="EXTRA_MENUS"
  @message-menu="onMessageMenu"
/>
```

- 业务项追加在内置项（复制/引用/撤回/删除）之后、删除项之前；删除保持末位。
- 内置 key `copy/quote/recall/delete` 保留，同名业务项会被忽略。
- `types` 缺省表示全部消息类型；NOTICE（系统灰条）不显示长按菜单。
- `icon` 取 `em-icon` 的字形名。

## 9. 本地系统提示（`insertLocalNotice`）

```ts
EmKit.insertLocalNotice(peerUserId, 'singleChat', '对方已拍下，等待付款')
// 群聊别名（等价）
EmKit.insertGroupNotice(groupId, '客服小环已接入')
```

- 居中小灰条，无头像无气泡，长按菜单禁用。
- **只插本地、不发服务端、对方看不到**；进程重启不保留。
- 进会话拉历史时本地条目会保留；清空聊天记录/登出时随消息缓存清除。
- 需要跨端留痕的状态，走服务端自定义消息或系统通知。

## 10. 对端资料注入（服务账号场景）

```ts
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'

EmKit.setUserPresentation(peerUserId, { nickname: '在线客服', avatarUrl: 'https://cdn.example.com/kf.png' })
```

- 进会话前调用，避免先显示 userId 再跳昵称。
- 写入独立的业务覆盖层，优先于 SDK 资料且不会被后续资料同步冲掉；不修改服务端资料。
- 登出/换账号会清空覆盖层，重新登录后需再次注入；退出业务态可传 `null` 清除。

## 11. 入口未读角标

```ts
import { useConversationUnreadCount } from '@/uni_modules/easemob-uikit-uni/libs'

const unread = useConversationUnreadCount(peerUserId)   // 支持 ref
```

```vue
<em-badge :count="unread" />
```

非 setup 场景用 `EmKit.conversationUnreadCountOf(conversationId)` 取快照。

## 12. 伪装群 / 客服形态配置

多人服务但希望看起来像 1v1 时，用真群 + 隐藏群特征：

```vue
<em-chat-page
  :conversation-id="groupId"
  chat-type="groupChat"
  title="在线客服"
  :show-action="false"
  :show-member-count="false"
  :show-announcement="false"
  sender-name-mode="hidden"
  :enable-mention="false"
/>
```

- 单聊形态的共享客服账号：直接用 `chatType="singleChat"` + `title` + `showAction=false`。
- 需要保留主治/助手区分时，用真群但保留昵称行（`senderNameMode="always"`）。
- 群公告/成员管理仍可由宿主自己的「服务信息」页提供。

## 13. 四场景配方

| 场景 | 组合 |
|---|---|
| 在线客服 | `title="在线客服"` + `showAction=false` + `sendText` ext 带来源/订单 + `sendCustom('serviceTicket'/'refundReview')` + `quickReplies` + `insertLocalNotice` 转接 + AI 流式 |
| 医患 | `#banner` 病情摘要 + 报告图片/文件（H5） + `sendCustom('medicalCase'/'prescription')` + 已读回执 + `extraMessageMenus`「查看处方」 |
| 招聘 | `#banner` 职位条 + 简历文件 + `sendCustom('interviewInvite'/'phoneExchange')` + `quickReplies` |
| 二手交易 | `#banner` 商品条 + `sendCustom('productCard'/'priceOffer')` + `insertLocalNotice` 交易状态 + `extraMessageMenus`「查看订单」 |

各场景高频入口建议直接放 `#input-toolbar`。

## 14. 验收清单

- [ ] 业务页直进聊天页，标题/横幅正确，无需会话列表
- [ ] 带 ext 的文本发送后，对端能读到 ext
- [ ] 自定义卡片收发都能渲染，未知事件有兜底
- [ ] 输入栏入口点击即发对应卡片，失败有提示
- [ ] 快捷回复 fill/send 行为符合预期
- [ ] 业务长按项出现且回调拿到 key + message
- [ ] 本地灰条只在本机出现，重启后消失
- [ ] 伪装群不显示成员数/公告/昵称行/@
- [ ] 入口角标随未读变化

## 15. 常见坑

| 现象 | 根因 | 修复 |
|---|---|---|
| 对端卡片显示「[自定义消息]」 | 没提供 `#custom-message` 插槽 | 注入宿主卡片组件 |
| 卡片字段全空 | 结构化数据放进了 `params` | 放 `ext`，`params` 只放字符串 |
| 引用卡不显示 | 业务 ext 占用了 `msgQuote` | 换 key，内部 key 不可覆盖 |
| 本地灰条对方也能看到 | 误用了服务端消息 | 用 `insertLocalNotice` 才只本地 |
| 快捷回复点了没反应 | `quickReplies` 为空或全员禁言 | 检查数组与群禁言状态 |
| 业务菜单没出现 | `types` 与消息类型不匹配 | 去掉 `types` 或对齐 `MESSAGE_TYPE` |
| 卡片颜色在深色下刺眼 | 写死了白底黑字 | 用 `--em-*` token |
