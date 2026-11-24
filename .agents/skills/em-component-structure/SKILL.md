---
name: em-component-structure
description: Use when creating/organizing em-* components in easemob-uikit-uni（新建组件、拆分组件、目录归类、样式写进 .vue 导致文件过长、页面组件不自动导入/easycom 失效、想给组件加 scoped 或把样式写回 SFC 时）。环信 uni UIKit 组件目录分层与样式独立文件规范（2026-10-14 结构治理定稿）。
---

# em-* 组件目录与样式结构规范（定稿）

## Overview

组件按**粒度分层**：页面级（`-page` 后缀）住 `components/pages/`，原子组件（avatar/badge/bubble 族等）住 `components/` 扁平层。**每个组件的样式独立为同目录同名 `.css`**，`.vue` 的 style 块只留一行 `@import`。写任何 em-* 组件、或动组件目录前必读本文。

## 目录分层与 easycom

| 层 | 位置 | 导入方式 |
|---|---|---|
| 页面级 `em-xxx-page` | `components/pages/em-xxx-page/` | 宿主 `pages.json` 配 easycom custom 规则（见下），**否则不自动导入** |
| 原子组件 `em-xxx` | `components/em-xxx/` | 内置 uni_modules easycom 规则，零配置 |

```json
"easycom": {
  "autoscan": true,
  "custom": {
    "^em-([a-z-]+)-page$": "@/uni_modules/easemob-uikit-uni/components/pages/em-$1-page/em-$1-page.vue"
  }
}
```

custom 优先级高于内置，原子组件无 `-page` 后缀不受影响。**新建页面级组件后必须检查宿主 pages.json 是否已有此规则**（demo 已配；插件使用者需照 readme 自行配置）。pages.json 变更不热更，改后重启编译再验证。

## 样式独立文件（强制）

每个组件目录 = `em-xxx.vue` + `em-xxx.css`，.vue 尾部固定：

```html
<style>
@import './em-xxx.css';
</style>
```

- css 文件第一行 `@import '../../libs/style/variables.css';`（`components/pages/` 下的组件多一层：`../../../libs/`）。
- **禁止**把样式写回 .vue 的 style 块、禁止 scoped（统一 `defineOptions({ styleIsolation: 'app-and-page' })`）。
- 样式超 ~80 行或页面/组件混合就该拆分组件，参考已有页面级组件的拆分粒度（列表项、搜索条、徽标均已独立成 atom）。

## 共享样式资产（复用优先，勿复制粘贴）

| 资产 | 用途 |
|---|---|
| `libs/style/bubble.css` | 气泡壳基类 `.em-bubble` / `.em-bubble--self`（底色/圆角），5 个 `em-*-message` 与聊天页占位气泡已接入；新气泡组件必须叠加基类，只写个性样式 |
| `libs/style/textStyles.ts` | `TEXT_STYLE_NAME` / `TEXT_STYLE_SUBTITLE` 共享内联文本档（小程序样式隔离双通道的 text-style 值），消费点直接 import，勿再手写拷贝 |
| `libs/utils/quote.ts` | 引用卡/引用条的类型映射与文案纯函数（参数注入 t/displayNameOf） |
| `libs/utils/time.ts` | 时间格式化全集（会话五档/分隔条四档/视频时长 formatVideoDuration） |

## 类名与契约

- BEM 由 `useNamespace` 生成；**修饰类一律块级形态 `ns.m('xxx-self')`**，对应 css `.em-block--xxx-self`。元素级 `__x--y` 是治理前遗留（alphabet-nav、气泡内部尚有），新代码禁用。
- `-page` 组件**不碰路由**：返回/跳转一律 emit（如 `back`/`open-info`/`select`），宿主 demo 页面接线。原子组件不连业务 store，数据 props 进、事件 emits 出；`em-avatar` 仅通过 `useConfig` 读取全局头像形状，属于配置读取例外。
- 枚举/魔法数字进 `libs/constants/`（`RECALL_TIME_LIMIT`、`TYPING_THROTTLE`、`TIME_DIVIDER_INTERVAL` 等已有先例）；颜色/间距/遮罩进 `--em-*` token（`--em-mask-color`、`--em-chat-panel-height` 等），禁硬编码。
- 图标走 em-icon（见 em-icon-strategy skill），视觉对齐 vue 版（见 vue-uikit-design-reference skill），构造/入口约定见 uniapp-x-vapor-structure skill。

## 新组件自查清单

1. 纯 ts（禁 uts 方言）、`.vue` 文件
2. ucss 子集：flex-only、class 选择器、文字样式只在 `<text>`
3. 样式独立同名 .css、style 块仅 @import、`styleIsolation: 'app-and-page'` 无 scoped
4. 位置放对层：页面级进 `pages/`（并确认宿主 easycom 规则），原子组件扁平层
5. 引用同包组件用相对路径显式 import（`../../em-xxx/em-xxx.vue`，页面组件在 pages/ 下多一层 `../`）
6. props/emits 契约：不连 store、不碰路由、自定义长按事件名用 `long-press`（禁与原生同名）

## 常见错误

| 症状 | 原因与修法 |
|---|---|
| 页面组件标签不解析/报组件未注册 | 宿主 pages.json 缺 easycom custom 规则，或改了 pages.json 没重启编译 |
| mp-weixin 样式丢失/默认值 | 样式写进了 .vue 或忘了独立 .css 的 variables.css import；父组件 wxss 够不到子组件内部时给用户内容文本补 text-style 内联（em-text 双通道） |
| 新气泡颜色与其他的不一致 | 没叠 `.em-bubble` 基类，自己重写壳 |
| 徽标/引用/时间逻辑写第二份 | 先看共享资产表，有就 import |

## 组件透出契约（配置体系三层之「呈现层」）

全局行为开关走 `EmKitConfig`（见 em-uikit-architecture），**组件呈现一律 props + 具名插槽**，不做 provider/inject、不做 ChatConfig 单对象透传。现有透出范式（新组件照抄）：

| 组件 | props / emits / 插槽 |
|---|---|
| `em-chat-page` | `conversationId`/`chatType`（均必填，M2.9 起）、`avatarShape`（缺省跟随 `uiConfig.avatarShape`，显式值局部覆盖）；群形态三独立开关 `showMemberCount`/`senderNameMode('always'\|'hidden')`/`showAnnouncement` + @提及开关 `enableMention`（均默认开，仅群聊生效，伪装模式预留）；M2.11 新增 `title`（覆盖导航标题，空串回落昵称链）与 `showAction`（默认 true，false 隐藏右上角详情入口、`open-info` 由宿主接管）；M2.12 增 `quickReplies`（EmQuickReply[]）+ `quickReplyMode('fill'|'send')`（快捷回复条，fill 替换草稿/send 直发）、`extraMessageMenus`（EmMessageMenuExtra[]，业务长按动作，`types` 过滤，排在内置项之后、删除项之前）；emits `open-info`/`send`/`recall`/`delete`/`mention-click(userId)`/`message-menu(key, message)`（业务事件仅通知，行为内部走 EmKit）；**全员禁言禁输入内置**（群聊 + `infoByGroupId.mute` + 非 owner/admin → inputbar 禁用态 + 操作 toast `group.muteAllToast`）；**点击消息区收起输入栏**（emoji/媒体面板或软键盘展开时，消息区 `@click` 递增 inputbar 的 `collapseSignal`，对齐 vue 版 `chat__content` 点击 blur）；**系统提示消息渲染内置**（`MESSAGE_TYPE.NOTICE` 本地灰条居中 chip，无头像无气泡、长按菜单禁用；插入走 `EmKit.insertLocalNotice(conversationId, chatType, text)`，群聊别名 `insertGroupNotice(groupId, text)`，不落服务端）；插槽 `#banner`（M2.11，nav-bar 与群公告条之间固定位、不随消息滚动、无作用域）、`#input-toolbar`（M2.15，消息列表与输入栏之间、无作用域、随键盘上移、不注入不占位；宿主自绘「发订单/发病例/换手机号」等胶囊并自行 `sendCustom`，UIKit 不含入口组件/图标语义）、`#custom-message`（作用域 `message`；`MESSAGE_TYPE.CUSTOM` 按 `message.customEvent` **整卡自绘**，`customParams`/`ext` 为业务载荷；UIKit 不内置卡片组件，默认占位「[自定义消息]」；卡片内容的原生 longpress 冒泡到消息行，可打开长按菜单。Demo 的 `demo/components/demo-card` 是宿主侧参考实现，不进 uni_modules）、`#input-bar`（M2.16，作用域 `EmChatInputBarScope`；**受约束整栏替换**：提供插槽即不渲染 em-chat-inputbar，结构全自绘，但键盘避让（页面壳承担）/面板互斥/录音状态机/禁言/@/草稿链由页面侧 `useChatComposer` 实例经 scope 透出保持；插槽有无静态确定（setup 实例化 composer），同实例不可运行时切换；自绘路径 @ 触发检测上移页面 watch draft、消息区点击直调 composer.collapse；Demo 的 `demo/components/demo-custom-inputbar` 是宿主侧参考实现）、`#empty`（默认 em-empty 可整体覆盖） |
| `em-chat-info-page` | `conversationId`/`chatType`（均必填）；群分支三独立开关 `showMemberGrid`/`showGroupName`/`showAnnouncement`（默认开，仅群聊生效，伪装预留）；单聊分支含 profile 与删除好友（仅已是好友，成功 emit `contact-deleted(userId)`，不连带删会话）；群分支内聚拆分为同目录 `em-group-info-blocks` + `em-group-field-dialog`（群名/公告保存中禁取消与遮罩关闭）+ `em-group-members-view`（成员操作共享 pending 链，首屏/分页失败可重试，`applied=false` 陈旧结果不改错误态）；邀请/批量移除使用 em-select-contact.submitting，单条/批量移除后强制重读详情与成员首屏并等待两个尝试；muted/pinned 直接 computed 读 conversationStore（请求中 disable，页面不保存第二份开关态）；删除会话/删除好友/退群/解散共享 exitPending + exitCompleted，确认后、SDK 写操作前占锁且三按钮同时 disabled，跨动作也只 emit 一次成功事件；emits `deleted`/`leaved`/`contact-deleted`/`invite`/`remove-members`/`open-members`（群管理库内闭环，仅通知）/`chat-member(userId)`（宿主接线发起单聊） |
| `em-conversation-page` | `showSearch`/`emptyText`/`avatarShape`（缺省跟随 `uiConfig.avatarShape`，真实条目与首次同步骨架屏一致）/`tabs`（筛选 tab 及顺序，默认全部五项 all/unread/atMe/single/group，传空数组隐藏，对齐 vue conversation-tabs；tab 为页面内部状态不透出）；删除会话先原生确认，pin/mute/delete 按会话与动作加锁；`new-chat` 内置 em-select-contact 选人闭环，`create-group` 内置 em-create-group-modal 当前页建群；emits `select(conversationId, chatType)`（单聊选人、建群成功与点击会话统一透出）；插槽 `#empty` |
| `em-contact-page` | 通讯录入口页（M2.9 Phase 4b 起，对齐 vue address-book home）：em-contact-nav 三入口（contact 好友列表 / group 群组 / notice 新请求 count+hot，顺序对齐 vue entryOrder，黑名单二期），搜索只过滤入口项；emits `entry-click(key)`（宿主按 key 接线路由）/`add`（添加好友弹窗宿主实现）；好友字母列表已迁至 em-contact-list-page |
| `em-contact-list-page` | 好友完整列表页（M2.9 Phase 4b，自 em-contact-page 平移）：`menuKeys`；emits `select(userId)`/`back`；字母分组 + 索引条 + 搜索 + 长按删除（按 userId 提交锁）+ 骨架/空态 + 底部 em-load-more「没有更多了」footer |
| `em-contact-nav` | 入口项列表原子组件（对齐 vue ContactNav）：props `entries: EmContactNavEntry[]`（key/label/count?/hot?/icon?——icon 可选，缺省不渲染左图标，对齐 vue entry.icon 默认 undefined）；emits `entry-click(key)`；不连 store、不碰路由 |
| `em-conversation-tabs` | 会话筛选 tab 原子组件（对齐 vue conversation-tabs）：props `tabs`（默认 DEFAULT_CONVERSATION_TABS 五项）/`active`；emits `change(tab)`；胶囊横排可横滑，无计数徽标；不连 store |
| `em-group-page` | 群列表页：`showNameInput`/`showSettings`（默认均 false，群名空值自动取前 3 名成员）；emits `click-group(groupId)`/`created(groupId)`/`back`；标题栏「+」复用 em-create-group-modal（em-select-contact multiple + #panel-top，creating 接 submitting，成功才关窗）；无缓存同步失败显示重试，有缓存保留列表；列表底部 em-load-more 契约预留（SDK 本地全量，hasMore 恒 false） |
| `em-select-contact` | `items`（EmSelectContactItem[]）/`show`/`selectMode('single'\|'multiple')`/`disabledIds`/`title`/`submitting`（默认 false，提交中禁选择、确认、关闭键与遮罩关闭，确认按钮 loading）；emits `select(userId)`（single）/`confirm(userIds)`（multiple，不自动关窗）/`update:show`；multiple 带字母分组+索引条+自绘 checkbox+已选头像条+通栏确认，插槽 `#panel-top`（已选条与列表之间注入表单，建群用）；disabled 项只拦新增选中，已选后变 disabled 仍允许从已选区移除 |
| `em-load-more` | 触底加载 footer 四态：props `state('loading'\|'noMore'\|'button'\|'error')`，常量 `LOAD_MORE_STATE`；emits `load`（button/error 态点击）；loading 的 spinner 由 `useSpinRotation` JS 驱动 |
| `em-button` | `text`/`type`/`size`/`pill`/`block`/`disabled`/`loading`（后两项默认 false，均拦截 click）；loading 显示 `loading-arc-normal` 并由 `useSpinRotation` JS 驱动旋转 |
| `em-switch` | `modelValue`/`size('medium'|'small')`/`disabled`/`loading`；emits `update:modelValue(value)`/`change(value)`；disabled/loading 均拦截切换，loading 圆钮内 spinner 由 `useSpinRotation` 驱动 |
| `em-chat-inputbar` | `modelValue`（草稿）、`quote`、`features`（inputFeatures 逐项开关）、`emojis`、`disabled`（禁用态：输入/发送/语音/面板全断，M2.9 全员禁言用）、`submitting`（默认 false，提交中拦截重复 send 与快捷回复点选，不影响草稿编辑）、`placeholder`（空串回落内置文案）、`quickReplies`（EmQuickReply[]，M2.12 输入栏顶部胶囊条，禁用态/空列表隐藏）、`collapseSignal`（递增信号 = 收起 emoji/媒体面板 + 软键盘；聊天区点击由 chat-page 递增，原子组件仍自持面板状态，不用 $refs 调实例方法）；emits `send`/`quote-close`/`media-select`/`voice-send`/`mention-trigger`（草稿尾部新增 `@` 触发，尾部追加是物理上限）/`disabled-tap`（禁用态操作尝试，父组件据此 toast）/`quick-reply(item)`；disabled 翻转瞬间内置复位面板/语音模式/焦点；**手动键盘避让内置**（adjust-position=false + margin-bottom 顶起，见 em-crossend-pitfalls #3）；**开面板前先收键盘**（`uni.hideKeyboard`，与键盘位互斥不叠加）；`features.inputMode('single'|'multiline')` 显式选择输入形态，缺省回退 `sendOnReturn` 旧三态；输入区拆为同目录内部 `em-chat-single-input`（单行 input）与 `em-chat-multiline-input`（固定 19px 行高、显式高度、5 行封顶 textarea），父组件不持有原生高度状态 |
- **通用局部渲染注入（M2.31）**：默认输入栏 `#emoji-panel`（scope 类型 `EmChatEmojiPanelScope`）替换 emoji 内容区，面板外壳/键盘互斥不变；chat-page 只在宿主实际提供时转发，避免空插槽遮蔽内置网格。chat-page `#image-message`（scope 类型 `EmChatImageMessageScope`）接管图片气泡，缺省回落 `em-image-message`。二者用于宿主自绘，不在 UIKit 内置 GIF/sticker 实现。

| `em-mention-picker` | @ 提及选人弹层（M2.9 Phase 3，对齐 vue mention-picker h5 分支）：props `show`/`contacts(MentionContact[])`/`keyword`（@ 后尾部字符，watch 同步进搜索框）/`title`；emits `select(contact)`/`update:show`（选择即关）；不连 store |
| `em-text-message` | props `message`/`mentionContacts`（@名字→userId 解析表，缺省回落原始名字）；emits `long-press`/`mention-click(userId)`；`ext.em_at_list` 非空时 parseMentions 分片高亮（`--em-mention-color`） |
| `em-conversation-item` | `item`/`name`/`avatar`/`avatarShape`（缺省由内置 em-avatar 跟随全局配置）/`timeText`/`draft`/`hasAtMe`（群聊「有人@我」未读标记，名字与摘要前缀主色高亮）收装配数据；emits `click` + `long-press` |
| `em-nav-bar` | `title`/`subtitle`/`showBack`/`actionIcon`；emits `back`/`action`；插槽 `#title`/`#action`；小程序胶囊避让内置 |
| `em-video-message`/`em-file-message` | 点击行为上移 chat-page，组件发 `preview`/`download` emit（与 em-image-message 同模式） |
| `em-avatar` | `shape`（缺省跟随 `uiConfig.avatarShape`，显式值优先）/`placeholderColors` 五色板 prop；仅经 `useConfig` 读取全局形状，不连业务 store；徽标壳 `__badge` 保留、本体收口 em-badge |

## 现成原子组件清单（勿重造）

- `em-empty`：props `icon`(EmIconName)/`title`/`description`/`size('small'|'normal'|'large')` + `#default`；token `--em-empty-icon-color`/`--em-empty-text-color`。三页空态与聊天页 `#empty` 默认态均用它。
- `em-quick-reply-bar`：props `items: EmQuickReply[]`（label 展示 / text 由宿主取用）、`disabled`（默认 false，禁用点选）；emits `select(item)`；横向滚动胶囊（输入栏顶部，禁言态由父组件隐藏，提交中由 inputbar 传 disabled）。
- `em-skeleton`：props `variant('avatar'|'text'|'paragraph')`/`shape`/`rows`/`width`/`height`；token `--em-skeleton-line-radius: 4px`；**静态灰块**（shimmer 动画因 ucss 禁伪元素留二期）；无 `card` variant。列表加载骨架参考会话/联系人页 SKELETON_COUNT/SKELETON_LINE_WIDTHS 组合。
