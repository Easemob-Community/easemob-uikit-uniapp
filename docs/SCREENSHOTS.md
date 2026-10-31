# 界面截图

这页用真实设备上的截图说明 UIKit 长什么样：通过下方的平台开关，分别查看同一套 `em-*` 组件在 Android 与 HarmonyOS 上的实际渲染结果和页面主流程状态。

选型阶段可以用它判断「这套 UI 是否够用」，接入之后可以用它做视觉回归对照。

> 相关页面：[核心概念与架构](./CONCEPTS.md) · [页面指南](./PAGES-CONVERSATION.md) · [平台能力与差异](./PLATFORM.md) · [主题与国际化](./THEME-I18N.md) · [多场景接入](./GUIDE-MULTI-SCENARIO.md)

## 阅读约定

- 所有截图为**真机运行截图**，未做视觉修改、未加标注，桌面端可点开放大。
- 默认浅色主题、简体中文；深色模式与英文仅出现在对应小节。
- 两端屏幕尺寸不同（Android 1080 × 2340、HarmonyOS 1084 × 2412），同一页面在两端的分辨率与状态栏样式差异属于系统层面，不属于组件差异。
- 截图中的人物姓名、群名、订单号等均为演示数据。

<UniAppPlatformTabs>
<template #android>

## 核心界面

以下六屏覆盖列表与徽标、气泡与富媒体、表单控件、字母索引条、卡片样式和深色主题变量。

**会话列表**：列表 + 头像 + 未读徽标 + 时间格式。

<DocsImage src="assets/shots/android/l3-android-conversation-light.webp" alt="Android 会话列表" :width="750" :height="1625" />

**聊天**：文本、emoji、图片、视频、文件五类气泡混排。

<DocsImage src="assets/shots/android/l3-android-chat-bubbles.webp" alt="Android 聊天气泡" :width="750" :height="1625" />

**聊天信息**：开关表单使用同一套 `em-switch` 与单元格布局。

<DocsImage src="assets/shots/android/l3-android-chat-info.webp" alt="Android 聊天信息" :width="750" :height="1625" />

**通讯录**：字母分组 + 右侧索引条。

<DocsImage src="assets/shots/android/l3-android-addressbook.webp" alt="Android 通讯录" :width="750" :height="1625" />

**群组列表**：卡片流的阴影、圆角与边框。

<DocsImage src="assets/shots/android/l3-android-groups.webp" alt="Android 群组列表" :width="750" :height="1625" />

**深色模式会话列表**：通过主题变量切换深色界面。

<DocsImage src="assets/shots/android/l3-android-conversation-dark.webp" alt="Android 深色会话列表" :width="750" :height="1625" />

## 页面主流程

### 登录

登录页由宿主提供，UIKit 只依赖登录后的 `EmKit.login` 结果；下图为 Demo 工程的登录表单。

<DocsImage src="assets/shots/android/l1-android-login.webp" alt="Android 登录页" :width="750" :height="1625" />

### 会话列表：空态与失败降级

新账号没有会话时展示空态；会话同步失败且本地无缓存时，在同一处展示空态并给出「重试」入口，不会把整页锁成错误页。

**会话列表空态**：

<DocsImage src="assets/shots/android/l1-android-conversation-empty.webp" alt="Android 会话列表空态" :width="750" :height="1625" />

**同步失败降级**（同一处空态 + 「重试」按钮）：

<DocsImage src="assets/shots/android/l2-android-empty-with-retry.webp" alt="Android 同步失败降级" :width="750" :height="1625" />

### 会话列表：搜索与筛选

搜索聚焦态按会话名与消息内容过滤；筛选 tab 可切换「全部 / 未读 / @我 / 单聊 / 群组」，tab 由 `filterTabs` 配置。

**搜索过滤**：

<DocsImage src="assets/shots/android/l1-android-conversation-search.webp" alt="Android 搜索过滤" :width="750" :height="1625" />

**单聊筛选**：

<DocsImage src="assets/shots/android/l1-android-conversation-tab-single.webp" alt="Android 单聊筛选" :width="750" :height="1625" />

### 聊天：输入栏面板

表情面板与媒体面板都是输入栏的一部分，展开时会顶起消息列表而不是覆盖输入框。

**表情面板**：

<DocsImage src="assets/shots/android/l1-android-chat-emoji.webp" alt="Android 表情面板" :width="750" :height="1625" />

**媒体面板**：

<DocsImage src="assets/shots/android/l1-android-chat-media-panel.webp" alt="Android 媒体面板" :width="750" :height="1625" />

### 通讯录与群组入口

通讯录入口聚合「好友列表 / 群组列表 / 新请求」；好友列表带字母分组与右侧索引条，群组列表是卡片流并带建群入口。

**好友列表**：

<DocsImage src="assets/shots/android/l1-android-contact-list.webp" alt="Android 好友列表" :width="750" :height="1625" />

**群组入口**：

<DocsImage src="assets/shots/android/l1-android-group-list.webp" alt="Android 群组入口" :width="750" :height="1625" />

</template>
<template #harmony>

## 核心界面

以下六屏覆盖列表与徽标、气泡与富媒体、表单控件、字母索引条、卡片样式和深色主题变量。

**会话列表**：列表 + 头像 + 未读徽标 + 时间格式。

<DocsImage src="assets/shots/harmony/l3-harmony-conversation-light.webp" alt="HarmonyOS 会话列表" :width="750" :height="1669" />

**聊天**：文本、emoji、图片、视频、文件五类气泡混排。

<DocsImage src="assets/shots/harmony/l3-harmony-chat-bubbles.webp" alt="HarmonyOS 聊天气泡" :width="750" :height="1669" />

**聊天信息**：开关表单使用同一套 `em-switch` 与单元格布局。

<DocsImage src="assets/shots/harmony/l3-harmony-chat-info.webp" alt="HarmonyOS 聊天信息" :width="750" :height="1669" />

**通讯录**：字母分组 + 右侧索引条。

<DocsImage src="assets/shots/harmony/l3-harmony-addressbook.webp" alt="HarmonyOS 通讯录" :width="750" :height="1669" />

**群组列表**：卡片流的阴影、圆角与边框。

<DocsImage src="assets/shots/harmony/l3-harmony-groups.webp" alt="HarmonyOS 群组列表" :width="750" :height="1669" />

**深色模式会话列表**：通过主题变量切换深色界面。

<DocsImage src="assets/shots/harmony/l3-harmony-conversation-dark.webp" alt="HarmonyOS 深色会话列表" :width="750" :height="1669" />

## 页面主流程

### 登录

登录页由宿主提供，UIKit 只依赖登录后的 `EmKit.login` 结果；下图为 Demo 工程的登录表单。

<DocsImage src="assets/shots/harmony/l1-harmony-login.webp" alt="HarmonyOS 登录页" :width="750" :height="1669" />

### 会话列表：空态与失败降级

新账号没有会话时展示空态；会话同步失败且本地无缓存时，在同一处展示空态并给出「重试」入口，不会把整页锁成错误页。

**会话列表空态**：

<DocsImage src="assets/shots/harmony/l1-harmony-conversation-empty.webp" alt="HarmonyOS 会话列表空态" :width="750" :height="1669" />

**同步失败降级**（同一处空态 + 「重试」按钮）：

<DocsImage src="assets/shots/harmony/l2-harmony-empty-with-retry.webp" alt="HarmonyOS 同步失败降级" :width="750" :height="1669" />

### 会话列表：首帧与条目状态

首次进入会话列表会先铺骨架屏（6 行：圆头像 + 双行骨架 + 时间占位 + 未读圆点）。

<DocsImage src="assets/shots/harmony/l1-harmony-conversation-skeleton.webp" alt="HarmonyOS 首次同步骨架屏" :width="750" :height="1669" />

会话条目的置顶、免打扰、草稿、@我、未读徽标共用同一套 `em-conversation-item` 渲染：

<DocsImage src="assets/shots/harmony/l1-harmony-conversation-pinned-muted.webp" alt="HarmonyOS 置顶与免打扰" :width="750" :height="1669" />

### 聊天：长按菜单

长按气泡弹出操作菜单（复制 / 引用 / 转发 / 撤回 / 删除），可追加宿主的业务项。

<DocsImage src="assets/shots/harmony/l1-harmony-chat-menu.webp" alt="HarmonyOS 长按菜单" :width="750" :height="1669" />

### 聊天：语音与文件

语音走全局互斥播放（播新停旧）；文件气泡展示文件名、大小与类型图标，点击按宿主注册的附件能力预览。

**语音气泡**：

<DocsImage src="assets/shots/harmony/l1-harmony-chat-voice.webp" alt="HarmonyOS 语音气泡" :width="750" :height="1669" />

**文件气泡**：

<DocsImage src="assets/shots/harmony/l1-harmony-chat-file.webp" alt="HarmonyOS 文件气泡" :width="750" :height="1669" />

</template>
</UniAppPlatformTabs>

## 特性专题去哪看

主题、多语言、自定义卡片、水印、流式消息这些「配置 → 视觉」的图，跟着对应的能力页走，避免同一张图散落多处：

| 想看的图 | 位置 |
|---|---|
| 主色定制对比、中英双语对照 | [主题与国际化](./THEME-I18N.md) |
| 原子组件陈列、边缘状态（按钮 loading / 触底失败 / 选人弹层） | [基础组件](./COMPONENTS-BASIC.md) |
| 输入栏业务入口和快捷回复、组件级水印 | [聊天与消息组件](./COMPONENTS-CHAT.md) |
| AI 流式消息三态 | [AI 流式消息](./AI-STREAM.md) |
| 自定义卡片（单卡近景 + 14 种长图）、多场景业务页 | [多场景接入](./GUIDE-MULTI-SCENARIO.md) |

## 拍摄口径

| 项 | 口径 |
|---|---|
| 设备 | Android：1080 × 2340；HarmonyOS：1084 × 2412。均为真机，不使用模拟器 |
| 主题 | 默认浅色；深色仅用于「深色模式会话列表」 |
| 语言 | 默认简体中文；英文仅用于「中英双语」对照 |
| 状态栏 | 保留系统状态栏，不做裁剪或涂改 |
| 标注 | 不在图上加箭头、红框或说明文字；需要说明时写在正文 |
| 命名 | 单图 `{层级}-{平台}-{页面}-{状态}.webp` |
| 存放 | `docs/assets/shots/<platform>/` |

新增截图：把原图放进内部素材目录并按上述命名引用即可；站点构建时由 `scripts/sync-shots.mjs` 统一压缩并发布。
