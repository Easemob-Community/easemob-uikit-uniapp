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
- `-page` 组件**不碰路由**：返回/跳转一律 emit（如 `back`/`open-info`/`select`），宿主 demo 页面接线。原子组件不连 store，数据 props 进、事件 emits 出。
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
| `em-chat-page` | `conversationId`/`chatType`（均必填，M2.9 起）、`avatarShape`；群形态三独立开关 `showMemberCount`/`senderNameMode('always'\|'hidden')`/`showAnnouncement` + @提及开关 `enableMention`（均默认开，仅群聊生效，伪装模式预留）；emits `open-info`/`send`/`recall`/`delete`/`mention-click(userId)`（业务事件仅通知，行为内部走 EmKit）；插槽 `#custom-message`（按 `EmMessageItem.rawType` 判别渲染自定义消息，`ext` 为业务载荷唯一通道）、`#empty`（默认 em-empty 可整体覆盖） |
| `em-conversation-page` | `showSearch`/`emptyText`；emits `select(conversationId, chatType)`/`menu(key)`（`new-chat` 内置 em-select-contact 选人闭环，`create-group` 直接 emit 宿主占位）；插槽 `#empty` |
| `em-contact-page` | 通讯录入口页（M2.9 Phase 4b 起，对齐 vue address-book home）：em-contact-nav 三入口（notice 新请求 count+hot / group 群组 / contact 好友列表），搜索只过滤入口项；emits `entry-click(key)`（宿主按 key 接线路由）/`add`（添加好友弹窗宿主实现）；好友字母列表已迁至 em-contact-list-page |
| `em-contact-list-page` | 好友完整列表页（M2.9 Phase 4b，自 em-contact-page 平移）：`menuKeys`；emits `select(userId)`/`back`；字母分组 + 索引条 + 搜索 + 长按删除 + 骨架/空态 |
| `em-contact-nav` | 入口项列表原子组件（对齐 vue ContactNav）：props `entries: EmContactNavEntry[]`（key/label/count?/hot?/icon）；emits `entry-click(key)`；不连 store、不碰路由 |
| `em-group-page` | 群列表页（M2.9 Phase 4a）：emits `click-group(groupId)`/`back`；标题栏「+」内置建群弹层（em-select-contact multiple + #panel-top 群名/开关表单，群名必填 → EmKit.createGroup + addConversation）；列表底部 em-load-more 契约预留（SDK 本地全量，hasMore 恒 false） |
| `em-select-contact` | `items`（EmSelectContactItem[]）/`show`/`selectMode('single'\|'multiple')`/`disabledIds`/`title`；emits `select(userId)`（single）/`confirm(userIds)`（multiple，不自动关窗）/`update:show`；multiple 带字母分组+索引条+自绘 checkbox+已选头像条+通栏确认，插槽 `#panel-top`（已选条与列表之间注入表单，建群用） |
| `em-load-more` | 触底加载 footer 三态：props `state('loading'\|'noMore'\|'button')`；emits `load`（button 态点击） |
| `em-chat-inputbar` | `modelValue`（草稿）、`quote`、`features`（inputFeatures 逐项开关）、`emojis`；emits `send`/`quote-close`/`media-select`/`voice-send`/`mention-trigger`（草稿尾部新增 `@` 触发，尾部追加是物理上限）；**手动键盘避让内置**（adjust-position=false + margin-bottom 顶起，见 em-crossend-pitfalls #3） |
| `em-mention-picker` | @ 提及选人弹层（M2.9 Phase 3，对齐 vue mention-picker h5 分支）：props `show`/`contacts(MentionContact[])`/`keyword`（@ 后尾部字符，watch 同步进搜索框）/`title`；emits `select(contact)`/`update:show`（选择即关）；不连 store |
| `em-text-message` | props `message`/`mentionContacts`（@名字→userId 解析表，缺省回落原始名字）；emits `long-press`/`mention-click(userId)`；`ext.em_at_list` 非空时 parseMentions 分片高亮（`--em-mention-color`） |
| `em-conversation-item` | `item`/`name`/`avatar`/`timeText`/`draft` 五 props 收装配数据；emits `click` + `long-press` |
| `em-nav-bar` | `title`/`subtitle`/`showBack`/`actionIcon`；emits `back`/`action`；插槽 `#title`/`#action`；小程序胶囊避让内置 |
| `em-video-message`/`em-file-message` | 点击行为上移 chat-page，组件发 `preview`/`download` emit（与 em-image-message 同模式） |
| `em-avatar` | `placeholderColors` 五色板 prop；徽标壳 `__badge` 保留、本体收口 em-badge |

## 现成原子组件清单（勿重造）

- `em-empty`：props `icon`(EmIconName)/`title`/`description`/`size('small'|'normal'|'large')` + `#default`；token `--em-empty-icon-color`/`--em-empty-text-color`。三页空态与聊天页 `#empty` 默认态均用它。
- `em-skeleton`：props `variant('avatar'|'text'|'paragraph')`/`shape`/`rows`/`width`/`height`；token `--em-skeleton-line-radius: 4px`；**静态灰块**（shimmer 动画因 ucss 禁伪元素留二期）；无 `card` variant。列表加载骨架参考会话/联系人页 SKELETON_COUNT/SKELETON_LINE_WIDTHS 组合。
