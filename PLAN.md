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
| D5 | 二期候选 | 通讯录（字母索引/好友申请）、群基础（建群/群信息/成员列表）、单条转发 | 一期发版后按社区反馈排期 |
| D6 | 分发策略 | **MIT 免费开源**：GitHub 主仓 + DCloud 插件市场免费发布 | 定位是获客漏斗，非收入项 |
| D7 | 命名 | 仓库 `easemob-uikit-uniapp`；插件 id / uni_modules 目录 `easemob-uikit-uni`；组件前缀 **`em-`**；CSS 变量前缀 `--em-*` | 延续 Web 版 Em 心智 |
| D8 | 系统地板 | HBuilderX / HBuilder V 5.21+；Android 6+ / iOS 15+ / 鸿蒙 API20+ / 现代浏览器 / 微信小程序基础库（随 uni-app x 要求） | 蒸汽模式硬性要求 |

> D1/D4/D5 如需调整，先改此表。

---

## 1. 一期功能清单（In Scope）

### 1.1 页面级组件（社区硬通货，pages_init.json 自动注册）

| 页面 | 组件名 | 内容 |
|---|---|---|
| 会话列表页 | `em-conversation-page` | 头像+未读徽标、昵称、最后消息摘要、时间、草稿、`@我` 提示、置顶/免打扰标记、滑动删除、点击进入聊天 |
| 聊天页 | `em-chat-page` | 消息列表（list-view 复用）、5 种气泡、输入栏、长按菜单、群公告条位、下拉加载历史 |
| 登录接入 | demo 内置 `pages/login` | appkey + userId + token 登录；demo 提供「测试 token 获取」入口（仅开发用） |

### 1.2 消息气泡（5 种 + 出口）

- 文本（`em-text-message`）：链接识别、`@` 高亮
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

### 1.4 基座能力

- 主题：`--em-*` CSS 变量双层 class（`.em-theme-light` / `.em-theme-dark`），App 端主题类挂组件根节点（RiceUI trick）；`useTheme().setTheme('dark'|'light')`
- i18n：中/英，文案无硬编码
- Avatar：内置徽标（未读数/红点），形状走主题（`avatarShape`）
- 状态管理：裸 `reactive` store，**零运行时依赖**（不装 pinia/dayjs/lodash）
- 平台适配层：`libs/platform.ts` 收口存储（`uni.setStorage`）、网络状态、媒体选择/录制，差异不落组件
- 图标：unicode 直显字体图标（App 端无伪元素约束）或 view+transform 绘制（uni-ui x 方案），不打包图片图标

## 2. 明确不做（Out of Scope，一期）

tiptap 富文本输入、消息编辑、消息翻译、合并转发、多选模式、消息搜索、语音转文字、位置消息、群已读回执详情、会话分栏、H5 适配层（Web 版那套）、浏览器通知系统、Electron/SQLite 持久化、双 SDK adapter 抽象、名片转发、群管理全套（公告编辑/禁言/转让）、Presence 在线状态（保留接口默认关闭）、表情包商店、自研图片预览手势层。

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

## 4. 仓库结构

```
easemob-uikit-uniapp/
├── PLAN.md                        # 本文档
├── README.md                      # 插件市场门面（截图/兼容矩阵/demo 二维码/快速开始）
├── uni_modules/
│   └── easemob-uikit-uni/
│       ├── components/
│       │   ├── em-conversation-page/   # 页面级
│       │   ├── em-chat-page/           # 页面级
│       │   ├── em-avatar/ em-badge/ em-cell/ em-bubble/ ...  # 原子级（二期解耦沉淀）
│       │   └── em-*-message/           # 气泡族
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

### M1：demo 最小闭环（先于抽象）

- 登录页（appkey/userId/token + 测试 token 入口）
- 会话列表页 + 聊天页骨架，文本/图片两种气泡先通
- 目标：内部扫码可体验「登录 → 看到会话 → 收发消息」

### M2：聊天页完整化

- 语音/视频/文件气泡补齐；长按四菜单；引用/撤回/重发/已读
- 输入栏完整（语音录制、相册、拍摄、文件）
- 主题明暗切换、i18n 中英

### M3：组件沉淀与发布

- 从 demo 解耦出页面级组件 + 原子组件；pages_init.json
- `variables.css` token 体系定稿（值平移自 Web 版 DESIGN-TOKEN-MAPPING）
- README（含分包接入模板：聊天页进 subpackage 的 pages.json 示例）、changelog、license
- uni-automator 核心链路用例（登录/收发/撤回/重发）
- 插件市场首发 0.1.0 + GitHub 开源 + uni-im 交流群

### M4（二期，另行立项）：通讯录、群基础、单条转发、文档站

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
| 会话列表（未读/草稿/@我/置顶/免打扰/删除） | 保留（一期核心） |
| 文本/图片/语音/视频/文件气泡 | 保留 |
| 引用/撤回/重发/单聊已读/typing | 保留（不配开关，默认开） |
| 自定义消息出口 | 保留（插槽） |
| 主题 token/i18n/Avatar 徽标体系 | 保留并平移设计资产 |
| 长按菜单 | 降级为四项 action-sheet |
| 图片预览 | 降级为 uni.previewImage |
| features 15 开关 | 砍到 ≤5 个 |
| 插件机制/插槽体系 | 砍到 3 个插槽 |
| 通讯录/群基础 | 二期 |
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

