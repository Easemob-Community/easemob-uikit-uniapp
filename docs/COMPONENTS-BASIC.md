# 基础组件

这页是 12 个通用原子组件的契约参考：`em-action-sheet`、`em-avatar`、`em-badge`、`em-button`、`em-empty`、`em-icon`、`em-load-more`、`em-nav-bar`、`em-popup`、`em-search-bar`、`em-skeleton`、`em-text`。它们不连 store、不碰路由，props 进、events 出，可以直接嵌进宿主自己的界面。

本页所有组件都符合 easycom 目录约定，`pages.json` 打开 `autoscan` 后可直接写标签；也可以显式 `import` 后局部注册。引入方式与选型见 [组件总览与选型](./COMPONENTS.md)。

## em-action-sheet

底部动作菜单：一行标题 + 若干动作 + 取消项。适合会话行长按菜单、群成员操作菜单这类"选一个动作"的场景。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `visible` | `boolean` | 必填 | 显示状态，配合 `v-model:visible` 双向绑定 |
| `actions` | `EmActionSheetAction[]` | 必填 | 动作列表，按数组顺序渲染 |
| `title` | `string` | `''` | 头部标题；空串时不渲染头部 |
| `showCancel` | `boolean` | `true` | 是否显示底部取消项 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `select` | `action: EmActionSheetAction` | 点击可用动作项；派发后组件自动请求关闭 |
| `cancel` | — | 点击取消项或点击遮罩 |
| `update:visible` | `value: boolean` | 关闭时派发 `false`，用于 `v-model:visible` |

`EmActionSheetAction` 的字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | `string` | 动作唯一标识，宿主据此分发 |
| `text` | `string` | 展示文案 |
| `icon` | `string` | 可选，`em-icon` 图标名；空串不渲染图标位 |
| `danger` | `boolean` | 警示色（图标与文字同时变色） |
| `disabled` | `boolean` | 置灰且点击无响应 |

```vue
<template>
  <em-action-sheet
    v-model:visible="menuVisible"
    :actions="actions"
    title="会话操作"
    @select="onSelect"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { EmActionSheetAction } from '@/uni_modules/easemob-uikit-uni/libs'

const menuVisible = ref(false)
const actions = ref<EmActionSheetAction[]>([
  { key: 'pin', text: '置顶会话', icon: 'pin' },
  { key: 'mute', text: '消息免打扰', icon: 'bell-slash' },
  { key: 'delete', text: '删除会话', icon: 'trash', danger: true }
])

function onSelect(action: EmActionSheetAction): void {
  console.log('action:', action.key)
}
</script>
```

**行为与平台**：菜单本体由 `em-popup` 以 `position="bottom"` 承载，遮罩关闭路径统一收口在本组件（`maskClosable` 固定为 `false`），因此点击遮罩会先派发 `cancel`、再派发 `update:visible(false)`，宿主只需要监听一条关闭链路。`disabled` 项保持 40% 透明度且不派发任何事件；`danger` 项图标与文字都用 `--em-danger-color`；动作行高 56px，取消项与列表之间留 8px 灰色间隔。没有插槽，需要自定义内容请直接用 `em-popup`。

## em-avatar

头像：有图显示图，加载失败或没传图时回落成文字头像，支持内置未读角标。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `src` | `string` | `''` | 头像地址；空串直接走文字头像 |
| `name` | `string` | `''` | 展示名，文字头像取前 2 个字符，并作为底色取色依据 |
| `size` | `number` | `40` | 头像直径 / 边长，单位 px |
| `shape` | `'circle' \| 'square'` | `'circle'` | 圆形或方形 |
| `badge` | `number` | `0` | 角标数字，`> 0` 时显示 |
| `badgeDot` | `boolean` | `false` | 红点模式，优先于 `badge` |
| `badgeMax` | `number` | `99` | 角标截断阈值，超过显示 `max+` |
| `placeholderColors` | `string[]` | `undefined` | 文字头像底色板；不传或传空数组时使用内置五色板 |

无事件、无插槽。

```vue
<em-avatar :src="contact.avatarUrl" :name="contact.nickname" :size="48" :badge="unread" />
```

**行为与平台**：`<image>` 的 `@error` 会把内部状态切到文字头像，不会出现破图；文字字号按 `size * 0.4` 换算，底色由 `name` 首字符的字符码对色板长度取模决定，同一名字颜色稳定。角标直径与偏移按 `size` 等比换算（基准 48px），药丸形态与数字截断由 `em-badge` 负责，不需要宿主再定位。组件是 `virtualHost`，外部 class 直接落在根节点上参与父级 flex 布局。

## em-badge

未读徽标：数字档显示数量（超过 `max` 截断），红点档只显示一个圆点。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `count` | `number` | `0` | 徽标数字；`0` 与负数不渲染（`dot` 模式除外） |
| `max` | `number` | `99` | 截断阈值，`count > max` 时显示 `max+` |
| `dot` | `boolean` | `false` | 红点模式：8px 圆点，不显示数字 |

无事件、无插槽。

```vue
<em-badge :count="item.unreadCount" :max="99" />
<em-badge dot />
```

**行为与平台**：数字档是 18px 高胶囊、左右各 5px 内边距；红点档是 8px 正圆。外边距由宿主节点承担，因为列表行尾、入口卡、头像角标的定位各不相同。徽标底色与文字色走主题 token，明暗模式自动切换。

## em-button

按钮：四档类型、两档尺寸，支持胶囊、通栏与禁用。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `text` | `string` | `''` | 按钮文案；也可用默认插槽追加内容 |
| `type` | `'default' \| 'primary' \| 'danger' \| 'outline'` | `'default'` | 视觉类型 |
| `size` | `'large' \| 'medium'` | `'large'` | 尺寸档 |
| `pill` | `boolean` | `false` | 全圆角胶囊形态 |
| `block` | `boolean` | `false` | 通栏占满父容器宽度 |
| `disabled` | `boolean` | `false` | 禁用：置灰且不派发 `click` |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `click` | — | 点击，`disabled` 为 `true` 时不派发 |

| 插槽 | 作用域 | 说明 |
|---|---|---|
| 默认 | — | 追加在 `text` 之后的内容，可用于放图标或自定义节点 |

```vue
<em-button type="primary" pill block text="确定" @click="onConfirm" />
<em-button type="outline" size="medium" text="取消" :disabled="saving" @click="onCancel" />
```

**行为与平台**：文字颜色与字号通过独立的元素修饰类下发，不依赖后代选择器（uni-app x 的 ucss 只保证类选择器行为）。禁用态在点击处理里直接返回，宿主不会收到事件；如果需要"点了给个提示"，用 `em-chat-inputbar` 的 `disabled-tap` 那种显式事件模式，或在宿主侧包一层。

## em-empty

空状态：图标 + 标题 + 描述 + 自定义区，垂直居中。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `icon` | `EmIconName \| ''` | `''` | 图标名；空串不渲染图标 |
| `title` | `string` | `''` | 标题行；空串不渲染 |
| `description` | `string` | `''` | 描述文案；空串不渲染 |
| `size` | `'small' \| 'normal' \| 'large'` | `'normal'` | 图标尺寸：32 / 48 / 64px，内边距同步收窄 |

无事件。

| 插槽 | 作用域 | 说明 |
|---|---|---|
| 默认 | — | 追加在文案下方，可放按钮或自定义插画 |

```vue
<em-empty icon="bubble-empty" description="还没有会话" />
<em-empty icon="person-single" size="small" description="未找到相关联系人" />
```

**行为与平台**：图标走 `em-icon` 字体方案，颜色用 `--em-empty-icon-color`；`small` 档同时缩小图标、标题与描述并收窄内边距，适合放在弹层或半屏面板里。组件本身不做滚动，放进 `scroll-view` 时由父级决定是否居中撑满。

## em-icon

字体图标：字形来自随包分发的 `em-icons.ttf`，按图标名取对应码点，尺寸与颜色可调。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `name` | `EmIconName` | 必填 | 图标名，取值由 `EmIconName` 类型提示，下方列出常用名 |
| `size` | `number` | `24` | 字号与盒子边长，单位 px |
| `color` | `string` | `''` | 图标颜色；空串时使用 `--em-icon-muted` |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `click` | — | 点击图标 |

无插槽。

```vue
<em-icon name="chevron-right" :size="22" />
<em-icon name="triangle" :size="20" color="#ffffff" @click="onPlay" />
```

**行为与平台**：`name` 的类型是 `EmIconName`，由 `components/em-icon/em-icons.ts` 里的"图标名 → 私用区码点"映射推导而来，写错名字在编译期就会报错。字体文件已被内联进 `em-icon.css`，不需要宿主额外拷贝资源；`size` 同时写入 `font-size`、`width`、`height`，因此图标的盒子是正方形，可安全参与 flex 布局。常用名如 `chevron-left`、`chevron-right`、`search`、`plus`、`circle-xmark`、`person-plus`、`loading-arc-normal`；线型与面型是两个独立名字（如 `bubble-rect` 与 `bubble-rect-filled`），旧版 `uni-icons` 命名也保留为别名。唯一不走字体的图标是 `pages.json` 中 tabBar 的图标，那是平台要求的原生 PNG，不在本组件范围内。

## em-load-more

触底加载 footer：加载中 / 点击加载更多 / 没有更多三种状态。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `state` | `LoadMoreStateValue` | 必填 | `loading` / `button` / `noMore`，常量见 `LOAD_MORE_STATE` |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `load` | — | 仅 `button` 态点击时派发 |

无插槽。

```vue
<template>
  <scroll-view scroll-y @scrolltolower="onScrollToLower">
    <view v-for="row in rows" :key="row.id" class="row">{{ row.title }}</view>
    <em-load-more :state="loadState" @load="loadMore" />
  </scroll-view>
</template>
```

**行为与平台**：`loading` 态显示静态 spinner 图标与"加载中"，不做关键帧动画（uni-app x 蒸汽端不跑 `@keyframes`，静态图标在各端表现一致）。`button` 态是可点的"加载更多"文字，点击派发 `load`；`noMore` 态只显示"没有更多"。组件不自带 `hasMore` 与 loading 锁，消费方需要在 `scroll-view` 的 `@scrolltolower` 与 `load` 事件里自行判断，否则会重复请求。

## em-nav-bar

自绘导航栏：安全区、返回箭头、标题、副标题、右侧动作，微信小程序自动避让右上角胶囊。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `title` | `string` | `''` | 标题文本，被 `#title` 插槽覆盖 |
| `subtitle` | `string` | `''` | 副标题（如"正在输入"），空串不渲染 |
| `showBack` | `boolean` | `true` | 是否显示左侧返回箭头 |
| `actionIcon` | `EmIconName \| ''` | `''` | 右侧动作图标；空串且无 `#action` 插槽时不渲染动作区 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `back` | — | 点击返回箭头 |
| `action` | — | 点击右侧动作区 |

| 插槽 | 作用域 | 说明 |
|---|---|---|
| `title` | — | 覆盖默认标题文本，可放自定义标题组件 |
| `action` | — | 覆盖右侧图标，放自定义按钮 |

```vue
<em-nav-bar title="聊天信息" action-icon="circle-ellipsis" @back="goBack" @action="openMenu" />
<em-nav-bar title="群成员" subtitle="共 12 人" @back="backToInfo" />
```

**行为与平台**：组件只画导航栏本身，宿主页面必须在 `pages.json` 配 `navigationStyle: "custom"`（App 端同时关掉原生标题栏 `titleNView`），否则会出现双层标题。顶部内边距按安全区换算，内容行固定 44px 高；右内边距在微信小程序里按胶囊按钮矩形计算（窗口宽 − 胶囊右边距 + 胶囊宽 + 8px），保证动作区落在胶囊左侧，其他端为 12px。`#title` / `#action` 有内容时优先于 `title` / `actionIcon`。

## em-popup

弹层容器：底部或居中弹出，带遮罩、安全区、全屏形态，并统一处理层级与原生 tabBar。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `visible` | `boolean` | 必填 | 显示状态，配合 `v-model:visible` 双向绑定 |
| `position` | `'bottom' \| 'center'` | `'bottom'` | 弹出位置：底部抽屉或居中弹窗 |
| `maskClosable` | `boolean` | `true` | 点击遮罩是否派发 `update:visible(false)` |
| `safeArea` | `boolean` | `true` | 底部形态是否注入底部安全区内边距 |
| `fullscreen` | `boolean` | `false` | 全屏形态（仅 `bottom` 生效）：去掉顶部圆角，面板贴屏顶，内容方自行配 `100%` 高 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `update:visible` | `value: boolean` | 遮罩点击且 `maskClosable` 为 `true` 时派发 `false` |
| `mask-click` | — | 遮罩点击，无论 `maskClosable` 取值都会派发 |

| 插槽 | 作用域 | 说明 |
|---|---|---|
| 默认 | — | 面板内容，宽高由内容决定；全屏形态下需要自己撑满 |

```vue
<template>
  <em-popup v-model:visible="visible" position="bottom" :mask-closable="true">
    <view class="sheet">
      <text class="sheet-title">选择操作</text>
    </view>
  </em-popup>
</template>
```

**行为与平台**：层级从 2000 起按打开顺序递增分配，后打开的弹层总在上层，嵌套弹层（如动作菜单里再开选人面板）无需宿主干预。App 与微信小程序的 tabBar 是原生控件、渲染在页面之上，因此弹层打开时组件会收起 tabBar、全部关闭后恢复；H5 的 tabBar 是页面内元素，可以被弹层直接覆盖，不做处理。关闭时先播 250ms 退场过渡，再延迟 260ms 卸载节点；如果某个端不生效过渡，退化为无动画显隐，交互不受影响。`bottom` 形态在 iPhone 等有 Home 指示条的设备上自动注入底部安全区；`fullscreen` 形态还会注入顶部安全区，避免内容顶到状态栏下。`center` 形态固定圆角、无位移动画，宽度由内容决定。

## em-search-bar

搜索输入条：36px 圆角条 + 前置搜索图标，`v-model` 双向绑定。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `modelValue` | `string` | 必填 | 输入内容，配合 `v-model` 使用 |
| `placeholder` | `string` | `''` | 输入框提示文案，由宿主传 i18n 文案 |

| 事件 | 载荷 | 说明 |
|---|---|---|
| `update:modelValue` | `value: string` | 输入变化 |

无插槽。

```vue
<em-search-bar v-model="keyword" placeholder="搜索联系人" />
```

**行为与平台**：组件只负责输入与视觉，不内置防抖、不做过滤，也不带清除按钮——过滤逻辑留在宿主，避免把业务查询条件塞进原子组件。不同页面的 `placeholder` 文案不同，所以文案一律由宿主传入，组件不自行读取 i18n。

## em-skeleton

骨架屏：头像块、单行、多行段落三种形态，用底色块表达"内容即将出现"。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `variant` | `'avatar' \| 'text' \| 'paragraph'` | `'text'` | 形态 |
| `shape` | `'circle' \| 'square' \| 'rounded'` | `'circle'` | 仅 `avatar` 生效 |
| `rows` | `number` | `3` | 仅 `paragraph` 生效，行数向下取整且至少 1 |
| `width` | `string` | `''` | 覆盖默认宽度，传 CSS 长度（如 `'40%'`、`'120px'`） |
| `height` | `string` | `''` | 覆盖默认高度，传 CSS 长度（如 `'48px'`） |

无事件、无插槽。

```vue
<view class="row">
  <em-skeleton variant="avatar" shape="circle" />
  <view class="row-main">
    <em-skeleton variant="text" width="40%" />
    <em-skeleton variant="paragraph" :rows="2" />
  </view>
</view>
```

**行为与平台**：底色用 `--em-bg-hover`，块圆角用 `--em-skeleton-line-radius`，明暗模式自动跟随；`avatar` 默认 40×40，`text` 与 `paragraph` 的单行高度为 `1em`（跟随父级字号）。`paragraph` 行间距 8px、末行宽 60%，`rows` 会做 `Math.max(1, Math.floor(rows))` 收敛，传 0 或负数也至少渲染一行。骨架块是静态的，不播放扫光动画，各端渲染一致。

## em-text

文本收口组件：单行或两行省略、长文断词，并用 `textClass` + `textStyle` 双通道解决跨端文字样式。所有可能溢出的用户内容文本都建议走这里。

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `text` | `string` | `''` | 文本内容；也可用默认插槽补充节点（如引用条的发送人 + 摘要） |
| `lines` | `number` | `1` | `0` 不限行、只做长文断词；`1` 单行省略；`2` 两行省略 |
| `textClass` | `string` | `''` | 文字样式类名，追加在内部 `text` 节点上 |
| `textStyle` | `string` | `''` | 文字内联样式，追加在内部 `text` 节点上；可引用 `var(--em-*)` token |

无事件。

| 插槽 | 作用域 | 说明 |
|---|---|---|
| 默认 | — | 追加在 `text` 之后，用于拼多段文本（发送人名 + 摘要等） |

```vue
<em-text
  :text="conversation.lastMessageText"
  :lines="1"
  text-class="conversation-row__summary"
  text-style="font-size: var(--em-font-size-13); color: var(--em-text-secondary); white-space: nowrap;"
/>
```

**行为与平台**：`lines` 的取值决定折叠档——`0` 走 `--wrap`（只断词、不限行）、`1` 走单行省略、`2` 走两行省略，其余数值当前按单行处理，所以请只使用 0 / 1 / 2。两行档在 App 端用 `lines: 2` 原生折叠，H5 与小程序不认该属性，改用 `2 × 18px` 的 `max-height` 封顶；单行档必须带 `white-space: nowrap`，否则小程序里文字自由换行会被固定行高拦腰裁切。

**为什么需要双通道**：组件的样式隔离级别是 `app-and-page`（编译为 `apply-shared`），父组件的 wxss 只能影响页面级节点，碰不到本组件内部那个 `text` 节点。因此在微信小程序上，只写 `textClass` 会出现"字体、颜色全部失效"的现象；`textStyle` 走内联样式，不受样式隔离限制，是跨端必须补齐的那一半。约定是**两边同时给**：`textClass` 供 H5 / App 的样式表命中，`textStyle` 供小程序命中，值保持一致。组件是 `virtualHost`，宿主写在标签上的 class（常用于 flex、`min-width`、`margin`）会合并到根 `view` 上，宽度与溢出约束在根节点这一层生效。

## 平台范围速查

| 能力 | App（Android / iOS / 鸿蒙） | H5 | 微信小程序 |
|---|---|---|---|
| `em-nav-bar` 胶囊避让 | 按安全区处理 | 按安全区处理 | 按胶囊矩形计算右内边距 |
| `em-popup` 收起原生 tabBar | 是 | 否（tabBar 是页面内元素） | 是 |
| `em-skeleton` 动画 | 静态块 | 静态块 | 静态块 |
| `em-icon` 字体图标 | 支持 | 支持 | 支持 |

更多平台差异见 [平台能力与差异](./PLATFORM.md)，样式变量见 [设计变量](./DESIGN-TOKENS.md)。
