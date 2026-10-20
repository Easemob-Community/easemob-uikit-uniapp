# easemob-uikit-uniapp 立项计划

> 版本：v0.1（立项稿）
> 定位：环信 IM 的 uni-app 版 UIKit，面向 DCloud 插件市场社区分发，作为环信 SDK 在 uni 生态的获客漏斗。
> 本文档是一期开发的唯一执行依据；任何范围/选型变更先改本文档再动手。

---

## 0. 已确认的决策（Default Decisions）

| # | 决策点 | 结论 | 依据 |
|---|---|---|---|
| D1 | 目标框架 | **uni-app x 蒸汽模式（vapor-only）**；代码守纯 ts 纪律，老 uni-app Vue3「能用算白捡，不做官方承诺」 | 老 uni-app App 端 2027 年初停维护；蒸汽模式是 DCloud 明示的未来；双兼容正式版成本 +30~50%，一期不背 |
| D2 | 目标平台 | Android / iOS / 鸿蒙（蒸汽原生渲染）+ H5 + 微信小程序（后两者当前走 VDOM 管线编译，属正常） | 一期五端，对齐 RiceUI 已验证矩阵 |
| D3 | Vue 版本 | 仅 Vue3 组合式 API；**不支持 Vue2**（uni-app x 无 Vue2，Vue2 已 EOL） | 蒸汽模式强制组合式 |
| D4 | 一期范围 | **最小闭环**：登录接入 + 会话列表页 + 聊天页（文本/图片/语音/视频/文件 5 种气泡、长按四菜单）+ demo 工程 | 社区路径是「扫码体验 → 导入 → 5 分钟跑通」，demo 闭环先于一切抽象 |
| D5 | 二期候选 | 单条转发、联系人详情页/黑名单 | 一期发版后按社区反馈排期（通讯录核心链路已提前至 M2.5、群基础已提前至 M2.9，见里程碑节） |
| D6 | 分发策略 | **MIT 免费开源**：GitHub 主仓 + DCloud 插件市场免费发布 | 定位是获客漏斗，非收入项 |
| D7 | 命名 | 仓库 `easemob-uikit-uniapp`；插件 id / uni_modules 目录 `easemob-uikit-uni`；组件前缀 **`em-`**；CSS 变量前缀 `--em-*` | 延续 Web 版 Em 心智 |
| D8 | 系统地板 | HBuilderX / HBuilder V 5.21+；Android 6+ / iOS 15+ / 鸿蒙 API20+ / 现代浏览器 / 微信小程序基础库（随 uni-app x 要求） | 蒸汽模式硬性要求 |

> D1/D4/D5 如需调整，先改此表。

---

## 1. 一期功能清单（In Scope）

### 1.1 页面级组件（社区硬通货，pages_init.json 自动注册）

| 页面 | 组件名 | 内容 |
|---|---|---|
| 会话列表页 | `em-conversation-page` | 头像+未读徽标、昵称、最后消息摘要、时间、草稿、`@我` 提示、置顶/免打扰标记、会话搜索（本地过滤名称/摘要）、筛选 tab（全部/未读/@我/单聊/群组，对齐 vue conversation-tabs，纯 UI+本地过滤、数据零新增）、滑动删除、点击进入聊天 |
| 聊天页 | `em-chat-page` | 消息列表（list-view 复用）、5 种气泡、输入栏、长按菜单（支持业务动作追加）、群公告条位、业务横幅位（`#banner`）、下拉加载历史、自定义消息收发（`#custom-message` + `EmKit.sendCustom`）、快捷回复条 |
| 登录接入 | demo 内置 `pages/login` | appkey + userId + token 登录；demo 提供「测试 token 获取」入口（仅开发用） |

### 1.2 消息气泡（5 种 + 出口）

- 文本（`em-text-message`）：链接识别、`@` 高亮；流式文本（AI 流式输出：打字机光标 / 终态收敛 / 异常提示，M2.13）
- 图片（`em-image-message`）：缩略气泡 + `uni.previewImage` 原生预览（**不做自研预览手势层**）
- 语音（`em-voice-message`）：时长刻度、播放态动画、未读红点
- 视频（`em-video-message`）：封面 + 原生 `video` 组件播放
- 文件（`em-file-message`）：图标 + 文件名 + 大小 + 下载进度
- 自定义消息出口（`em-custom-message`）：插槽接管，给社区用户扩展
- 不支持类型（位置/名片等）统一渲染「暂不支持的消息」占位

### 1.3 聊天页交互

- 长按菜单：**复制 / 引用 / 撤回 / 删除** 四项（action-sheet 形态，不做 Web 版定位浮层）
- 引用消息：气泡内引用条 + 点击定位
- 撤回：2 分钟窗口、撤回提示条、（编辑入口**不做**）
- 失败重发：气泡红色感叹号 + 点击重发
- 单聊已读状态（`enableReadReceipt` 开关控制，群已读详情**不做**）
- 输入栏：文本/语音切换（按住说话）、表情入口（一期仅 emoji 字符面板，**不做表情包**）、相册/拍摄/文件 三个扩展动作
- typing 提示：默认开，不配开关
- 草稿：默认开，不配开关
- 流式消息：默认开（`EmKitConfig.enableStreamMessage` 可关），分片合批、底部跟随、`#stream-message` 富格式插槽（M2.13）

### 1.4 基座能力

- 主题：`--em-*` CSS 变量双层 class（`.em-theme-light` / `.em-theme-dark`），App 端主题类挂组件根节点（RiceUI trick）；`useTheme().setTheme('auto'|'light'|'dark')`，默认 auto 跟随系统（App osTheme / Web prefers-color-scheme / 小程序 hostTheme），偏好持久化 + 系统变化动态解析
- i18n：中/英，文案无硬编码
- Avatar：内置徽标（未读数/红点），形状走主题（`avatarShape`）
- 状态管理：裸 `reactive` store，**零运行时依赖**（不装 pinia/dayjs/lodash）
- 平台适配层：`libs/platform.ts` 收口存储（`uni.setStorage`）、网络状态、媒体选择/录制，差异不落组件
- 图标：iconfont 字体图标，本地 ttf 放组件同级目录 + `@font-face` 相对路径引入（RiceUI `rice-icon` / uni-ui x `uni-icons-x` 同款方案，vapor 五端零条件编译），由 `em-icon` 原子组件收口「图标名 → unicode 码点」映射、`<text>` 渲染；复杂图形才允许 view+transform 绘制。**不打包图片图标（svg/png）**——svg 在小程序/App 端不可行（无内联 svg、image 组件 svg 渲染有平台差异）。字体来源：一期用 uni-icons 的 `uniicons.ttf`（DCloud，Apache-2.0）占位，正式版替换为设计师维护的 iconfont.cn 项目导出 ttf；替换只需改 ttf + 映射表两个文件，组件零改动

## 2. 明确不做（Out of Scope，一期）

tiptap 富文本输入、消息编辑、消息翻译、合并转发、多选模式、消息搜索（服务端漫游消息搜索；会话列表的本地过滤搜索保留）、语音转文字、位置消息、群已读回执详情、会话分栏、H5 适配层（Web 版那套）、浏览器通知系统、Electron/SQLite 持久化、双 SDK adapter 抽象、名片转发、群管理全套（公告编辑/禁言/转让）、Presence 在线状态（保留接口默认关闭）、表情包商店、自研图片预览手势层。

> 完整裁剪对照见本文件附录 A。砍掉的每一项在 README「路线图」里写明状态，防止社区 issue 重复提。

## 3. 技术选型

| 层 | 选型 | 约束 |
|---|---|---|
| 语言 | `<script setup lang="ts">` 纯 TS | 禁 uts 方言：`UTSJSONObject`、`UniElement`、`.uts` 文件不进组件公共面（`UniElement` 相关隔离在 `#ifdef APP` 与 platform.ts 内） |
| 组件文件 | 一律 `.vue`（老 uni-app 期权）；`.uvue` 仅作双文件逃生舱 | 消息列表若需 list-view 独占红利，允许 `.uvue` 双实现 |
| 样式 | ucss 子集：flex-only、class 选择器、无继承、无 scoped、无伪元素、文字样式只在 `<text>` 上 | SCSS 编译期能力（@each/@mixin）可用，产物必须落在子集内；BEM 命名（`em-button--primary__text`），`useNamespace` composable 生成 |
| 样式隔离 | 策略 2.0：`defineOptions({ styleIsolation: 'app-and-page' })` | 不写 `scoped` |
| 条件编译 | 二维矩阵：模式（`UNI-APP-X`）× 平台（`APP`/`MP-WEIXIN`/`WEB`） | 微信小程序开放能力用 `#ifdef MP-WEIXIN` 叠原生 `<button>` |
| 内置组件纪律 | 只用两边共有的内置组件；x 独占（page-container/list-view/rich-text 新特性）必须包进内部适配组件 | 适配组件清单：`EmMessageList`（list-view/scroll-view）、`EmPopup`（自研 overlay+view，**不用** page-container） |
| SDK | 环信 websdk（npm 纯 js），作为 peer 依赖；小程序端验证既有小程序 SDK 线 | 连通性是 P0 spike |
| 测试 | uni 官方自动化测试框架（一套 test.js 驱动全端）+ jest 快照（参照 uni-ui x 的 jest.config.js） | 每个 issue 修复配测试例 |
| IDE/CI | HBuilder V 开发；CLI（`@dcloudio/uni-cli`）出包用于 CI | 锁 IDE 版本到 readme |
| 配置体系（2026-10-15 定稿） | 三层混合：**全局 `EmKitConfig` 行为开关**（→ reactive config store，`useConfig()` 读取，`libs/store/config.ts`）+ **页面级组件呈现 props**（局部覆盖全局）+ **少量具名插槽**（自定义消息出口/empty/nav title/action） | 不做 vue 版 provider/inject 响应式重构、不做 ChatConfig 单对象大 prop 透传；原子组件不连 store（输入栏功能集走 props 传入）；`-page` 组件仍不碰路由；默认值一律与现状一致（零行为变更，纯增配置面）；formatter/@我/presence 留二期 |

## 4. 仓库结构

```
easemob-uikit-uniapp/
├── PLAN.md                        # 本文档
├── README.md                      # 插件市场门面（截图/兼容矩阵/demo 二维码/快速开始）
├── uni_modules/
│   └── easemob-uikit-uni/
│       ├── components/
│       │   ├── pages/                  # 页面级（em-conversation-page/em-chat-page/em-chat-info-page/em-contact-page/em-contact-requests-page，宿主 pages.json 配 easycom custom 规则）
│       │   ├── em-avatar/ em-badge/ em-cell/ em-bubble/ ...  # 原子级（内置 easycom 零配置；二期解耦沉淀）
│       │   └── em-*-message/           # 气泡族
│       │   # 每个组件目录 = 组件 .vue + 同名 .css（样式独立文件，.vue style 块仅 @import）
│       ├── libs/
│       │   ├── platform.ts             # 存储/网络/媒体适配层
│       │   ├── use/                    # useNamespace/usePopup/useSafeArea...
│       │   ├── store/                  # reactive 裸 store（会话/消息/主题/i18n）
│       │   ├── style/                  # variables.css（--em-* token 明暗两套）+ mixins
│       │   └── types/
│       ├── pages_init.json             # 页面模板自动注册
│       ├── package.json                # uni_modules 清单（platforms 兼容矩阵全勾）
│       ├── changelog.md
│       ├── readme.md
│       └── license.md                  # MIT
├── demo/                          # uni-app x 演示工程（蒸汽模式，HBuilder V 可开）
│   ├── manifest.json              # vapor: true
│   └── pages/                     # 登录页 + 组件示例页
├── tests/                         # uni-automator 全端测试
├── scripts/                       # 发布/校验脚本
└── docs/                          # 文档（后补文档站，一期 readme 先行）
```

要点：

- demo 工程通过相对路径引用 `../uni_modules`，开箱即跑
- npm 包为一期可选项：组件本体以 uni_modules 为主，npm 只发纯 js 逻辑层（如需要）
- 发布动作 = git tag + 插件市场更新（HBuilder V 右键发布）+ changelog 同步

## 5. 实施路线（里程碑）

### M0：Spike——SDK 五端连通性（唯一的未知风险，先行）

验收标准（全部真机/工具实测）：

1. Android（蒸汽 release 包）、iOS、鸿蒙：websdk 登录 + WebSocket 长连接 + 收发文本消息 + 断线重连
2. 微信小程序：环信小程序 SDK 线登录收发
3. H5：websdk 登录收发
4. 存储差异清单：`localStorage` 不可用点的 `uni.setStorage` 替换验证
5. 产出：`docs/SPIKE-SDK-CONNECTIVITY.md`，记录各端可用 API 清单与坑

**M0 不过则暂停 UI 开发，回头评估 SDK 方案（含必要时封装 uts 插件）。**

> 进度（2026-10-09）：H5 全通；微信小程序、鸿蒙真机登录/收发/重连实测通过；Android 真机登录/收发已通（重连待验）；iOS 未验，挂账并行补验。四端已过，SDK 方案风险解除，M1 启动。

### M1：demo 最小闭环（先于抽象）

- 开工前先落地基架子：`libs/style/variables.css`（`--em-*` token 明暗两套，值平移自 Web 版 theme/index.css）+ `useNamespace/useTheme/useLocale` + 一期 locale 文案 + em-avatar 试金石组件 + demo style-lab 验证页（先验证 CSS 变量/class 主题在 App 端可行，再大规模用）
- 登录页（appkey/userId/token + 测试 token 入口）
- 会话列表页 + 聊天页骨架，文本/图片两种气泡先通（页面级组件直接沉淀在 `uni_modules/easemob-uikit-uni/components/pages/`，demo 页面仅做路由包装，避免 M3 二次搬移）
- 目标：内部扫码可体验「登录 → 看到会话 → 收发消息」

> 进度（2026-10-09）：基架子（token/use\*/locale/em-avatar/style-lab）与 demo 闭环已落地。libs 扩展了会话/消息 store、图片收发、历史消息、连接就绪门；demo 新增 login（含密码换 token 开发入口）/conversation/chat 三页。H5 端到端实测通过（登录 → 会话列表未读/摘要 → 历史加载 → 发送文本 → 返回列表摘要刷新）；web/mp-weixin 双端编译通过。图片发送、微信小程序与 App 端真机链路待实测。

### M2：聊天页完整化

- 语音/视频/文件气泡补齐；长按四菜单；引用/撤回/重发/已读
- 输入栏完整（语音录制、相册、拍摄、文件）
- 主题明暗切换、i18n 中英

### M2.5：联系人页面（通讯录核心链路，自 M4 提前）

- 页面级组件 `em-contact-page`：字母分组列表（A-Z + `#`、组头 28px、条目 64px/48px 头像）、右侧字母索引条（原子组件 `em-alphabet-nav`，点击 + 按住滑动占比映射定位）、本地搜索（展示名/userId）、「新请求」入口卡（待处理红点）、长按删除好友；点击条目 emit `select` 由宿主接线进聊天
- 页面级组件 `em-contact-requests-page`：好友申请列表（接受/拒绝，幂等防重），未处理申请走 `uni.setStorage` 本地持久化
- 数据层：websdk `ContactManager` 注册制接入（`libs/chat/contact.ts` + `libs/store/contact.ts`），好友事件驱动刷新；展示名回落链 `remark > nickname > userId`
- 拼音决策：**零运行时依赖不动摇**——`libs/utils/pinyin.ts` 提供 `setPinyinAdapter` 可选注入口（对齐 vue 版 use-pinyin 设计），未注入时非 A-Z 首字符全部落 `#` 组、搜索仅原文匹配（与 vue 版默认降级行为一致）；不打包拼音库
- 明确不做（留二期）：黑名单全套、群组入口/群列表、联系人详情页（备注编辑 UI/拉黑）、选人穿梭框、presence 在线点、PC 专属交互（键盘导航/右键/ScrollToTop）、触底分页（SDK 本地全量无分页）、添加好友完整 UI（demo 级 modal 即可）
- 已知降级：组头 sticky 在蒸汽 App 端若不生效则随列表滚动；索引条高亮以索引条交互驱动为主，滚动反向驱动视 SelectorQuery 实测再补
- M2.9 补注（2026-10-15）：本里程碑「群组入口/群列表」由 M2.9 承接落地；`em-contact-page` 好友主页形态在 M2.9 重构为「入口页 + 次级列表页」（breaking，见 M2.9 节）

### M2.6：组件配置体系整改（易用性专项，2026-10-15 定稿）

- **配置基建**：`libs/store/config.ts` reactive `uiConfig`（默认值收口自 constants，`RECALL_TIME_LIMIT`/`TYPING_THROTTLE`/`TYPING_TIMEOUT`/`TIME_DIVIDER_INTERVAL` 降级为默认值来源）+ `useConfig()`（getter + `setConfig(partial)` 运行时合并）；`EmKitConfig` 扩展 UI 行为维度，`EmKit.init` 接线写入 config store
- **EmKitConfig 新增可选项（默认值 = 现状，零行为变更）**：`enableDraft`/`enableTyping`/`showTime`（默认 true/true/false）、`recallTimeLimit`/`typingThrottle`/`typingTimeout`/`timeDividerInterval`（数值常量可覆盖）、`inputFeatures{voice,emoji,image,camera,video,file}`（输入栏功能集，默认全开）、`messageMenuKeys`/`conversationMenuKeys`（长按菜单项与顺序）、`emojiList`（emoji 字符集注入，默认内置 96）、`primaryColor`（品牌色，init 落 `--em-primary-color`）
- **组件透出**：`em-chat-page` 增 `avatarShape` prop + `send`/`recall`/`delete` emits + `#custom-message`（PLAN 承诺的自定义消息出口，未识别 type 时渲染）/`#empty` 插槽；`em-conversation-page` 增 `showSearch`/`emptyText` + `#empty`；`em-contact-page` 增 `menuKeys`（长按菜单）；`em-video-message` 补 `preview` emit（与 em-image-message 对齐，默认行为不变）、`em-file-message` 补 `download` 事件；`em-nav-bar` 补 `#title`/`#action` 插槽；`em-avatar` 占位五色板提为 `placeholderColors` prop
- **i18n 注入口**：`useLocale` 增 `mergeMessages(locale, table)`（业务方运行时注入新语言/覆盖文案；messages 表从模块私有常量改为可变 store，zh-CN/en 为初始值）
- 消费点接线：`libs/chat/message.ts`（撤回窗口/typing/cmd 拦截）、`em-chat-page`（分隔条间隔/菜单构建）、`em-chat-inputbar`（features → 面板项增删/emoji 集/voice 显隐）
- 明确不做（留二期）：formatter/filterFn 函数注入、`readIconDisplay` 档位、bubbleShape 全局开关、群相关配置

### M2.7：空状态与骨架屏组件（2026-10-15）

- **新原子组件 `em-empty`**（对齐 vue 版 `EmEmpty`）：props `icon`（em-icon 字体名）/`title`/`description`/`size('small'|'normal'|'large')` + `#default` 插槽；图标 32/48/64，复用现有 `--em-empty-icon-color`/`--em-empty-text-color` token。不译 vue 的 SVG 插画档（禁打包 svg/png 纪律）
- **新原子组件 `em-skeleton`**（对齐 vue 版 `EmSkeleton`）：props `variant('avatar'|'text'|'paragraph')`/`shape('circle'|'square'|'rounded')`/`rows`/`width`/`height`；底色 `--em-bg-hover`、圆角 `--em-radius`（行圆角补 `--em-skeleton-line-radius`）
- **应用点**：会话页/联系人页「同步中」文案态 → 骨架列表（6/8 条，对齐 vue 宿主组合：avatar rounded + 两行 text 40%/70%、35%/65%）；三页手写 `__tip` 空态统一收编为 `em-empty`（会话页 icon 随搜索态切换 search/list）；聊天页 `#empty` 插槽补默认 `em-empty`
- 明确不做（留二期）：shimmer 动画（ucss 禁伪元素，`::after`+keyframes 不可用，二期 mp/H5 条件编译补）、`card` variant（无消费点）、聊天页消息区骨架（vue 版消息区亦不用，进入会话已有预热优化）

### M2.8：微信小程序 SDK 分包异步化（主包体积专项，2026-10-15 立项）

- **背景**：demo mp-weixin 主包 1.7MB（上限 2MB），其中 websdk 5.1.3 IIFE 873KB 经 `libs/client/index.ts` 静态导入全部落主包 `common/vendor.js`；消息列表是 tabBar 页无法进分包，与社区宿主场景同构。参照《环信 IM SDK 接入微信小程序分包异步化实施指南》落地，机制按 uni-app x 等价翻译。
- **机制（等价替换定稿）**：SDK IIFE 自包含产物经构建后处理脚本（`scripts/prepare-sdk-subpackage.mjs`，追加 `module.exports = IMSDK` + esbuild 语法降级）拷入普通分包；主包经 uni-app 官方跨分包 JS 引用原生 `require(path, cb, fail)` 回调写法异步加载（DCloud 分包异步化文档，uni-app/uni-app x 均支持）；不使用 webpack copy 插件/app.js 注入方案（本仓编译器为 HBuilderX 内置 uniapp-cli-vite）。
- **库侧注入口（关键）**：`libs/client/sdk.ts` 条件编译双实现——`#ifndef MP-WEIXIN` 静态直通 `easemob-websdk`（现状等价，H5/App/鸿蒙零行为变更）；`#ifdef MP-WEIXIN` 模块级 SDK 持有 + `ensureSdkModule()`（Promise 缓存/失败重置/导出校验）+ `EmKitConfig.sdkLoader` 宿主注入；`EmKit.init` 的 `ChatClient.init` 改首次 ensure 时懒初始化（load→init→login 三阶段 Promise 缓存）。全库运行时（非 `import type`）SDK 导入收口 `sdk.ts` 单文件。
- **宿主接入契约**：pages.json `subPackages`（普通分包，independent:false）+ `preloadRule` 预下载；UIKit 不负责宿主的分包配置与 SDK 文件拷贝，只在 readme 给接入指南。
- **demo 接线**：非 tabBar 页（chat/chat-info/contact-requests/spike/style-lab）进分包；会话页 SDK 未就绪占位态（加载/失败重试，i18n key）；`scripts/check-mp-size.mjs` 体积与防回归断言（主包阈值/SDK 版本/IIFE 全局名/require 存活/语法检查）。
- 明确不做：UIKit 组件代码本身拆分包（一期只解决 SDK 体积）；独立分包；动态 `import()`（uni-app x 不支持，用官方 require 回调写法）。
- 产出：`docs/SPIKE-SDK-SUBPACKAGE.md`（编译器行为验证记录）。

### M2.9：群基础（自 M4 提前，2026-10-15 立项）

- **范围**：群数据层（GroupManager 注册 + `enableSyncData` 增 `'group'` + `libs/chat/group.ts` + `libs/store/group.ts` + 群事件「更新 store + 系统通知」双写）；chatType 全链路贯通（消息/会话域方法显式 `chatType` 参数，`EmMessageItem`/`EmConversationItem` 增字段，breaking）；群会话列表（含 `@我` 徽标）；聊天页群形态（群名+人数/成员昵称行/群公告条）；@ 提及全链路（`em-mention-picker` 半屏组件 + ext `em_at_list` 与 vue 版同 key，追加式插入为上限）；群列表页 `em-group-page`；统一选人组件 `em-select-contact`（发起会话/建群/邀请三处复用）；发起会话（选人 → 本地 addConversation，对齐 vue 语义）；联系人页重构为「入口页 + 次级列表页」（新 `em-contact-nav` + `em-contact-list-page`，好友主页形态 breaking）；群详情/管理（`em-chat-info-page` 群分支：成员宫格/公告编辑/管理员/转让/退群解散/全员禁言读字段禁输入）；触底加载统一组件 `em-load-more`（群成员列表游标翻页为实际消费点，按钮式翻页优先）。
- **明确不做**：黑名单/白名单管理页（联系人页入口预留）、群共享文件、公开群入群申请审批、群名片、群已读回执详情、@ 光标处插入（uni `<input>` 无 selectionStart，物理上限）、群聊消息搜索、群公告富文本、presence。
- **门禁**：先补 GroupManager 五端 spike（重点小程序端群同步时序，追加 `docs/SPIKE-SDK-CONNECTIVITY.md`），不过则暂停 UI 开发。
- **伪装模式预留**（承 `docs/EVAL-MULTI-SCENARIO.md` §6-3）：群形态 UI（人数/公告条/昵称行档位/成员事件渲染策略）设计时预留隐藏开关位；伪装形态下 `open-info` 由宿主接管。开关本体二期随伪装场景落地，M2.9 只保证不留硬编码分支。
- **补注（2026-10-16 终审消歧）**：会话页「+」菜单落地为两项（发起会话/创建群组），添加好友入口在联系人页 nav action（范围表「三项」为早期表述，以落地形态为准）。
- **补注（2026-10-16 终审消歧）**：全员禁言管理 UI（Switch）不在 M2.9——`muteAllGroupMembers`/`unmuteAllGroupMembers` API 已透出供宿主接线，M2.9 只落地「读 group.mute 禁输入」。

> 进度（2026-10-16）：Phase 0-5 全部落地——群数据层与 chatType 贯通（Phase 1）、会话/聊天页群化与发起会话（Phase 2）、@ 提及全链路（Phase 3）、群列表页/建群/选人 multiple（Phase 4a）、联系人页入口化 + 群邀请 kind 分化（Phase 4b）、chat-info 群分支与全员禁言（Phase 5a）、成员管理/邀请接真/群系统通知（Phase 5b）；Phase 6 评审 minor 扫尾与文档收口完成。双门禁全绿（build web + build mp-weixin 11 项防回归，主包 642KB ≤ 1.5MB）、H5 产物伺服 200；真机/真实账号端到端冒烟待验（见 STATUS.md 待验项汇总）。

### M2.10：深色模式跟随系统 + Demo 全量接线（2026-10-20 立项）

- **范围（自 M2.6「明确不做」提前）**：主题偏好三档 `auto|light|dark`（默认 auto）；`auto` 动态跟随系统（App `onOsThemeChange` + `deviceInfo.osTheme`、Web `matchMedia('(prefers-color-scheme: dark)')`、微信小程序 `onHostThemeChange` + `hostTheme`）；偏好持久化 `emkit.themeMode`；App 端同步 `uni.setAppTheme` 让原生弹窗等系统 UI 跟随；新增 `syncNativeThemeUI()` 动态同步原生导航栏/tabBar（页面 onShow 与主题变化时调用）；demo `pages.json` + `theme.json` + `manifest.darkmode/defaultAppTheme` 首帧原生 chrome 适配。
- **Demo 全量接线**：13 个页面（登录/会话/通讯录/我的/聊天/聊天详情/好友列表/新请求/群组/样式实验室/Spike/Text Probe/占位）根节点绑定 themeClass；登录页为固定深色品牌页（渐变设计，不消费明暗 token），其余页面 token 化；「我的」页改为「跟随系统 / 浅色 / 深色」三档选择（选择即持久化、即时生效）。
- **库内修复**：好友申请「对方已拒绝」白底圆形图标在暗色改固定深灰（原 `--em-text-primary` 在暗色白圆上不可见）。
- **门禁**：`build web` + `build mp-weixin` 11 项防回归全绿 + H5 伺服 200；真机/小程序模拟器深浅色切换与系统跟随待验（见 STATUS.md）。

### M2.11：多场景扩展能力 P0 批次（2026-10-20 立项，承 `docs/EVAL-MULTI-SCENARIO.md` §4.2/§6）

- **背景**：多场景评估（客服/医疗/招聘/二手交易）结论为「直进 1v1 聊天页」底座可用，P0 四项缺口阻断四场景「可上线」。本里程碑只做 P0，P1（快捷回复条/自定义菜单动作）另行立项。
- **范围**：
  - **P0-1 发送侧业务载荷**：`sendText` 增可选业务 `ext`（与引用/提及内部 key 合并，`emQuote`/`em_at_list` 优先不被覆盖）；新增 `EmKit.sendCustom(to, chatType, event, params?, ext?)`；`MESSAGE_TYPE.CUSTOM` 升为一等类型 + `EmMessageItem.customEvent`/`customParams`（接收侧 `#custom-message` 按 customEvent 判别，`ext` 仍是业务载荷通道）；失败重发支持 custom。
  - **P0-2 `#banner` 插槽**：`em-chat-page` 在 nav-bar 与群公告条之间提供固定位具名插槽（不随消息滚动），承载医疗病情条/招聘职位条/交易商品条。
  - **P0-3 `title` / `showAction` props**：`title` 覆盖导航标题（空串回落现有昵称链）；`showAction` 默认 true，false 时隐藏右上角详情入口（业务信息页由宿主接管，同时服务伪装模式）。
  - **P0-4 系统提示消息通用化**：`EmKit.insertLocalNotice(conversationId, chatType, text)` 对外透出（原 `insertGroupNotice(groupId, text)` 保留为群聊别名）；复用既有 `MESSAGE_TYPE.NOTICE` 居中灰条渲染与长按菜单禁用。
- **明确不做**：P1 批次；per-conversation 未读 API（`useUnreadCounts` 已覆盖入口角标）；伪装模式群形态隐藏开关全套（M2.9 已预留 props 位，开关本体随伪装场景另立项）。
- **门禁**：`build web` + `build mp-weixin` 11 项防回归全绿 + H5 产物伺服 200。
- **产出**：`docs/GUIDE-MULTI-SCENARIO.md`（四场景接入指引：init→login→navigateTo、P0 四项能力代码示例、平台边界）。

### M2.12：多场景 P1 批次（2026-10-20 立项，承 `docs/EVAL-MULTI-SCENARIO.md` §4.2/§6）

- **背景**：P0 已落地（M2.11），四场景「可上线」；P1 提升「好用度」，补齐入口未读、常用语、业务动作三个高频缺口。
- **范围**：
  - **P1-1 per-conversation 未读**：`conversationUnreadCountOf(conversationId)` 同步快照 + `useConversationUnreadCount(conversationId)` 响应式 computed + `EmKit.conversationUnreadCountOf(id)`；数据源仍为 `conversationStore.items`，不新增轮询。
  - **P1-2 快捷回复条**：新原子组件 `em-quick-reply-bar`（`items: EmQuickReply[]`（label/text）、`select` emit、横向滚动胶囊）；`em-chat-page` 增 `quickReplies` 与 `quickReplyMode('fill'|'send')`（默认 fill = 替换草稿），由输入栏上方内置渲染（禁用态/空列表自动隐藏）。
  - **P1-3 自定义长按菜单动作**：`EmMessageMenuExtra`（继承 `EmActionSheetAction` + `types` 过滤）；`em-chat-page` 增 `extraMessageMenus` prop 与 `message-menu(key, message)` emit；自定义项追加在内置项之后、删除项之前（删除保持末位），内置 key 保留不可覆盖，NOTICE 灰条不显示。
  - **demo 演示（用户验收要求）**：我的页入口「多场景能力演示」→ 选择对端 → 聊天页 `?scene=1` 显示「场景开关」面板；六项开关实时控制 `#banner`/`title`/`showAction`/`quickReplies`/`quickReplyMode`/`extraMessageMenus`，面板内演示 `sendCustom` 商品卡、`sendText` 业务 ext、`insertLocalNotice` 交易提示与单会话未读。
- **明确不做**：P2 边界（H5 录音、位置消息）；伪装模式批次（`senderNameMode='on-change'`/群指示一键隐藏，另立项）；自定义菜单整菜单接管（vue 的 `#message-action-menu` 全接管，一期只做追加动作）。
- **门禁**：`build web` + `build mp-weixin` 11 项防回归全绿 + H5 产物伺服 200。
- **产出**：`docs/GUIDE-MULTI-SCENARIO.md` 增 P1 用法；EVAL §7 状态更新；契约 skill 同步。

### M2.13：AI 流式消息（Stream Message，2026-10-20 立项，对齐 vue 版「内核薄、插件厚」）

- **背景**：AI 客服 / IM 内 AI 对话是社区高频诉求；vue 版已内置 `onStreamMessage` 分片合并与纯文本流式渲染（参照其 `docs/STREAMING-MESSAGE-PLAN.md` 与 `apps/docs/guide/ai-stream-message.md`）。uni 版补齐同等能力，并针对蒸汽端/小程序做高频分片合批，避免逐片重绘与滚动抖动。
- **范围**：
  - **数据链路**：`EmKit` 接线 SDK `onStreamMessage`，按 `msgServerId` 把分片幂等合并到同一条 TEXT 气泡（`body.content = stream.fullText`，不产生新气泡）；`onMessage` 完整消息到达时覆盖未完成流式副本（丢片补偿）并收敛终态；`EmMessageItem` 增可选 `stream: EmStreamInfo`。
  - **高性能**：分片索引 O(1) 定位（`conversationId|msgServerId` → store 代理）；按 `streamThrottle`（默认 50ms）合批写 store + 通知，终态立即落盘；`EmKit.onStreamMessage` 专用订阅（不把高频增量塞进 `onMessage` 新消息语义）；聊天页流式跟随滚动节流 120ms 且用户上翻时暂停。
  - **渲染**：`em-text-message` 内核纯文本流展示——传输中气泡尾部打字机光标、终态收敛普通文本、ERROR 尾部「内容生成异常」；`customType='markdown'` 等富格式由 `em-chat-page` 新增 `#stream-message` 插槽接管（未接管时纯文本兜底）。
  - **配置**：`EmKitConfig.enableStreamMessage`（默认 true；关闭后忽略分片、等完整消息一次上屏）+ `streamThrottle`（默认 50ms，0 = 逐片即写）；`useConfig()/setConfig()` 支持运行时切换。
  - **Demo/文档**：聊天页「AI 演示」悬浮入口（mock 分片注入，完成/异常/停止）；「我的」页流式开关；样式实验室流式气泡演示；README 增接入章节。
- **明确不做**：markdown 渲染器内置（重依赖不进内核，留插槽）；客户端发送流式消息（SDK 语义只收不发）；AI 模型直连/API Key 管理（生产走业务服务端代理）。
- **门禁**：`build web` + `build mp-weixin` 11 项防回归全绿 + H5 产物伺服 200；真机/真实账号 `onStreamMessage` 端到端待验（见 STATUS.md）。

### M3：组件沉淀与发布

- 原子组件沉淀（em-*-message 气泡族、输入栏等从页面级组件解耦）；pages_init.json 页面模板注册
- `variables.css` token 体系定稿（值平移自 Web 版 DESIGN-TOKEN-MAPPING）
- README（含分包接入模板：聊天页进 subpackage 的 pages.json 示例）、changelog、license
- uni-automator 核心链路用例（登录/收发/撤回/重发）
- 插件市场首发 0.1.0 + GitHub 开源 + uni-im 交流群

### M4（二期，另行立项）：单条转发、联系人详情页/黑名单、文档站（群基础已提前至 M2.9）

## 6. 验证门禁（每次提交前）

1. demo 工程五端编译通过（Android/iOS/鸿蒙/H5/微信小程序）
2. `uni-automator` 核心用例全绿
3. 新增组件自查清单：纯 ts？ucss 子集？无 scoped？文字在 text 上？easycom 路径规范？条件编译显式？
4. 包体积基线：微信小程序主包（demo）≤ 1.5MB（UIKit+SDK 进分包），每次发版记录数字

## 7. 社区运营清单（随 M3 执行）

- README 顶部：H5 在线预览链接 + Android apk 二维码 + 兼容矩阵表
- 「不做什么」路线图章节（冻结功能逐条列明，防重复 issue）
- changelog 人话版（参照 RiceUI changelog 格式）
- uni-im 交流群开通并写入 readme
- issue 模板：端/IDE 版本/蒸汽 or VDOM/最小复现

## 8. 风险登记

| 风险 | 等级 | 缓解 |
|---|---|---|
| websdk 在蒸汽 App 端 WebSocket/存储不兼容 | 高 | M0 spike 先行；兜底方案为 uts 插件封装 |
| 蒸汽 Web 端未上线，H5 走 VDOM 管线的行为差异 | 中 | H5 纳入五端回归；不利用 Web 端全量 CSS 自由度 |
| list-view 复用纪律（v-for :key / list-item 不拆组件）与组件封装的冲突 | 中 | EmMessageList 适配组件内聚该纪律；必要时 .uvue 逃生舱 |
| HBuilderX alpha 线滚动快、API 漂移 | 中 | 锁版本写 readme；changelog 跟踪官方发版说明 |
| 社区 issue 多端排列组合淹没 | 中 | 自动化测试 + issue 模板 + 首发范围克制 |

## 附录 A：Web 版 UIKit → 本期裁剪对照

| Web 版能力 | 本期处置 |
|---|---|
| 会话列表（未读/草稿/@我/置顶/免打扰/删除/本地搜索过滤） | 保留（一期核心） |
| 文本/图片/语音/视频/文件气泡 | 保留 |
| 引用/撤回/重发/单聊已读/typing | 保留（不配开关，默认开） |
| 自定义消息出口 | 保留（插槽） |
| 主题 token/i18n/Avatar 徽标体系 | 保留并平移设计资产 |
| 长按菜单 | 降级为四项 action-sheet |
| 图片预览 | 降级为 uni.previewImage |
| features 15 开关 | 砍到 ≤5 个 |
| 插件机制/插槽体系 | 砍到 3 个插槽 |
| 通讯录核心链路（字母索引列表/好友申请） | 保留（M2.5 提前落地）；联系人详情页/黑名单/选人穿梭框仍二期 |
| 群基础 | M2.9 落地 |
| 群管理 | 核心子集 M2.9 落地（公告/改名/成员/管理员/转让/退群解散/全员禁言）；黑名单/白名单/共享文件/入群申请审批/群名片/群已读回执详情仍砍 |
| tiptap 富文本/编辑/翻译/合并转发/多选/消息搜索/语音转文字/位置消息/群已读详情/会话分栏/H5 适配层/浏览器通知/Electron 持久化/双 adapter/名片转发/群管理全套/Presence 默认开 | 砍掉（一期不做） |

## 附录 B：参考资料

### B.1 DCloud 官方文档（规范与约束的唯一权威来源）

| 资料 | 链接 | 用途 |
|---|---|---|
| uni-app x 官网首页（蒸汽模式介绍/性能对比/FAQ/路线图） | https://doc.dcloud.net.cn/uni-app-x/ | 立项依据：蒸汽模式定位、老 uni-app 停维护时间线 |
| 蒸汽模式专题（Vapor 渲染引擎/开发注意/升级指南） | https://doc.dcloud.net.cn/uni-app-x/app-vapor.html | 组合式强制、样式隔离 2.0、list-view 复用纪律、flatten、条件编译 `VUE3-VAPOR` |
| 组件概述（组件分类/easycom/双兼容写法/uvue·vue 后缀优先级） | https://doc.dcloud.net.cn/uni-app-x/component/ | 「纯 ts + ucss 子集即可双兼容」的官方原话出处；`.vue`/`.uvue` 逃生舱机制 |
| CSS 子集（ucss）规范 | https://doc.dcloud.net.cn/uni-app-x/css/ | 组件样式军规：flex-only、class-only、样式不继承、CSS reset 对照表、支持属性清单 |
| uvue 概述（Vue 兼容实现差异） | https://doc.dcloud.net.cn/uni-app-x/vue/ | script/template 写法与标准 Vue3 的差异点 |
| HBuilder V 官网 | https://doc.dcloud.net.cn/hbuilderv/ | 开发 IDE（内置 uni-agent） |
| uni-app 官网（老版） | https://uniapp.dcloud.net.cn/ | 老 uni-app Vue3 侧能力基线（二期兼容评估用） |
| uni_modules 包管理规范 | https://uniapp.dcloud.net.cn/plugin/uni_modules.html | 目录结构、package.json 兼容矩阵、pages_init.json、插件市场发布 |
| uni-app(x) 自动化测试教程 | https://uniapp.dcloud.net.cn/worktile/auto/quick-start.html | M3 测试门禁的实施依据 |
| uni-ui x 组件总览（官方扩展库） | https://doc.dcloud.net.cn/uni-app-x/component/uni-ui-x/ | 官方组件设计哲学：样式全走 class/externalClasses、中性无写死颜色、AI 友好 |
| DCloud 插件市场 | https://ext.dcloud.net.cn/ | 分发渠道；竞品观察入口 |

### B.2 开源参照实现（直接读源码的样本）

| 参照 | 仓库 | 学什么 |
|---|---|---|
| **uni-ui x**（官方） | https://gitcode.com/dcloud/uni-ui-x （**alpha 分支**，默认分支为空） | 纯 ts 双兼容写法纪律、`@uniPlatform` JSDoc 标注、jest 快照测试配置、每组件独立 uni_module 的发布形态 |
| **RiceUI**（MIT） | https://gitee.com/riceui/rice-ui （**release_vapor 分支**） | 工程结构（组件 4 文件：uvue/type/utils/style.scss）、`useNamespace` BEM 方案、CSS 变量双层主题 + App 端主题类挂根节点的 trick、`usePopup`/手势弹层实现、package.json 兼容矩阵写法 |
| hello uni-app x（官方示例） | https://github.com/dcloudio/hello-uni-app-x | 官方页面/组件写法、自动化测试例（`.test.js`）、性能测试模板（日历/长列表/左滑删除） |
| unibestX（工程模板） | https://github.com/cq112233/unibestX | Vapor/VDOM 双模式工程配置、manifest 组织 |
| FirstUI-uvue（VDOM 时代） | https://github.com/FirstUI/FirstUI-uvue | 反面教材：选项式 + uts 强类型的历史包袱长什么样，避免回退 |
| LimeUI X（闭源付费，仅作产品对标） | https://ext.dcloud.net.cn/plugin?id=28915 | 双兼容（uni-app Vue2/Vue3 + x 蒸汽）的商业化形态与卖点包装 |

### B.3 本仓库关联资产（复用来源）

| 资产 | 位置 | 复用方式 |
|---|---|---|
| Web 版 UIKit 设计 token | `easemob-uikit-vue/docs/DESIGN-TOKEN-MAPPING.md` | `--em-*` token 值与明暗色体系的平移来源 |
| Web 版组件 API 契约 | `easemob-uikit-vue/packages/uikit-im/src` | props/emits 命名、i18n key、Avatar 徽标规范的参照（实现不可复用，全部重写） |
| 环信 websdk | npm `easemob-websdk` | M0 spike 对象；作为 peer 依赖 |

