# AGENTS.md — easemob-uikit-uniapp

> 本文件面向 AI 编码代理，假定读者对本项目一无所知。

## 1. 项目现状（重要，先读）

**本项目处于 M0/M1 之间：最小连通性用例已落地，UI 组件尚未开始。** 已有内容：`PLAN.md`（立项计划书 v0.1，唯一执行依据）、`README.md`、`uni_modules/easemob-uikit-uni/`（仅 `libs/` 最小逻辑层：EmKit 门面 + `platform.ts` 存储收口，无组件）、`demo/`（uni-app x 蒸汽工程，含 `pages/spike/spike.vue` 连通性用例页，`uni_modules` 为指向仓库根的符号链接）、`scripts/uni.sh`（HBuilderX 内置编译器的 CLI 封装，支持 web/mp-weixin）、`docs/SPIKE-SDK-CONNECTIVITY.md`（五端验证记录，H5/小程序已编译通过，收发待测试账号实测）。`tests/` 尚未创建。

**`PLAN.md` 是一期开发的唯一执行依据**（其原文：「任何范围/选型变更先改本文档再动手」）。做任何实现工作前先通读 `PLAN.md`；范围或技术选型需要调整时，必须先修改 `PLAN.md` 再动代码，而不是相反。第 4 节描述的 `components/`、`pages_init.json` 等仍是**目标结构**，尚未创建。

## 2. 项目概述

环信 IM 的 **uni-app 版 UIKit**，定位为环信 SDK 在 uni 生态的获客漏斗，面向 DCloud 插件市场社区分发。MIT 免费开源，GitHub 主仓 + DCloud 插件市场免费发布。

- 仓库名：`easemob-uikit-uniapp`
- 插件 id / uni_modules 目录名：`easemob-uikit-uni`
- 组件前缀：`em-`；CSS 变量前缀：`--em-*`

## 3. 已确认的决策（来自 PLAN.md 第 0 节，D1–D8）

| 决策点 | 结论 |
|---|---|
| 目标框架 | **uni-app x 蒸汽模式（vapor-only）**，代码守纯 ts 纪律；老 uni-app Vue3「能用算白捡，不做官方承诺」 |
| 目标平台 | Android / iOS / 鸿蒙（蒸汽原生渲染）+ H5 + 微信小程序（后两者走 VDOM 管线编译），共五端 |
| Vue 版本 | 仅 Vue3 组合式 API；不支持 Vue2 |
| 一期范围 | 最小闭环：登录接入 + 会话列表页 + 聊天页（文本/图片/语音/视频/文件 5 种气泡 + 长按四菜单）+ demo 工程 |
| 二期候选 | 通讯录、群基础（建群/群信息/成员列表）、单条转发 |
| 系统地板 | HBuilderX / HBuilder V 5.21+；Android 6+ / iOS 15+ / 鸿蒙 API20+ / 现代浏览器 / 微信小程序基础库 |
| SDK | 环信 websdk（npm `easemob-websdk`，纯 js），作为 **peer 依赖**；小程序端验证既有小程序 SDK 线 |

D1/D4/D5 如需调整，必须先改 PLAN.md 第 0 节的决策表。

## 4. 技术选型与编码纪律（来自 PLAN.md 第 3 节）

| 层 | 选型 / 约束 |
|---|---|
| 语言 | `<script setup lang="ts">` 纯 TS。**禁 uts 方言**：`UTSJSONObject`、`UniElement`、`.uts` 文件不进组件公共面（`UniElement` 相关隔离在 `#ifdef APP` 与 `platform.ts` 内） |
| 组件文件 | 一律 `.vue`；`.uvue` 仅作双文件逃生舱（如消息列表需要 list-view 独占红利时允许 `.uvue` 双实现） |
| 样式 | **ucss 子集**：flex-only、class 选择器、无继承、无 scoped、无伪元素、文字样式只在 `<text>` 上。SCSS 编译期能力（@each/@mixin）可用，产物必须落在子集内。BEM 命名（如 `em-button--primary__text`），由 `useNamespace` composable 生成 |
| 样式隔离 | 策略 2.0：`defineOptions({ styleIsolation: 'app-and-page' })`，**不写 `scoped`** |
| 条件编译 | 二维矩阵：模式（`UNI-APP-X`）× 平台（`APP`/`MP-WEIXIN`/`WEB`）；微信小程序开放能力用 `#ifdef MP-WEIXIN` 叠原生 `<button>` |
| 内置组件 | 只用两边共有的内置组件；x 独占组件（page-container/list-view/rich-text 新特性）必须包进内部适配组件：`EmMessageList`（list-view/scroll-view）、`EmPopup`（自研 overlay+view，**不用** page-container） |
| 状态管理 | 裸 `reactive` store，**零运行时依赖**（不装 pinia/dayjs/lodash） |
| 主题 | `--em-*` CSS 变量双层 class（`.em-theme-light` / `.em-theme-dark`），App 端主题类挂组件根节点（RiceUI trick）；`useTheme().setTheme('dark'\|'light')` |
| i18n | 中/英，文案无硬编码 |
| 平台适配层 | `libs/platform.ts` 收口存储（`uni.setStorage`）、网络状态、媒体选择/录制，平台差异不落组件 |
| 图标 | unicode 直显字体图标或 view+transform 绘制（uni-ui x 方案），不打包图片图标 |

## 5. 一期功能范围（PLAN.md 第 1–2 节）

**In scope**：页面级组件 `em-conversation-page`（会话列表）、`em-chat-page`（聊天页）、demo 内置登录页；5 种消息气泡 + 自定义消息出口（插槽）；长按菜单仅「复制 / 引用 / 撤回 / 删除」四项（action-sheet 形态）；引用、撤回（2 分钟窗口）、失败重发、单聊已读（`enableReadReceipt` 开关）、输入栏（语音/emoji 字符面板/相册/拍摄/文件）；typing 与草稿默认开、不配开关。

**明确不做（一期）**：tiptap 富文本、消息编辑/翻译/合并转发/多选/消息搜索/语音转文字/位置消息/群已读详情/会话分栏/H5 适配层/浏览器通知/Electron 持久化/双 SDK adapter/名片转发/群管理全套/Presence（保留接口默认关闭）/表情包商店/自研图片预览手势层。完整裁剪对照见 PLAN.md 附录 A——**写代码前先核对，不要实现清单外的功能**。

## 6. 规划的仓库结构（PLAN.md 第 4 节）

```
easemob-uikit-uniapp/
├── PLAN.md
├── README.md                      # 插件市场门面
├── uni_modules/
│   └── easemob-uikit-uni/
│       ├── components/            # 页面级（em-conversation-page/em-chat-page）+ 原子级 + em-*-message 气泡族
│       ├── libs/
│       │   ├── platform.ts        # 存储/网络/媒体适配层
│       │   ├── use/               # useNamespace/usePopup/useSafeArea...
│       │   ├── store/             # reactive 裸 store（会话/消息/主题/i18n）
│       │   ├── style/             # variables.css（--em-* token 明暗两套）+ mixins
│       │   └── types/
│       ├── pages_init.json        # 页面模板自动注册
│       ├── package.json           # uni_modules 清单（platforms 兼容矩阵全勾）
│       ├── changelog.md / readme.md / license.md（MIT）
├── demo/                          # uni-app x 演示工程（manifest.json: vapor: true），相对路径引用 ../uni_modules
├── tests/                         # uni-automator 全端测试
├── scripts/                       # 发布/校验脚本
└── docs/                          # 文档（一期 readme 先行）
```

npm 包为一期可选项：组件本体以 uni_modules 为主，npm 只发纯 js 逻辑层（如需要）。

## 7. 构建与测试

**当前可用的构建命令**：`scripts/uni.sh <dev|build> <web|mp-weixin>`（封装 HBuilderX 5.26 内置 `uniapp-cli-vite` 编译器；需先 `cd demo && npm install` 安装 easemob-websdk）。App 端（Android/iOS/鸿蒙）编译仍依赖 HBuilderX/HBuilder V 图形界面流程。测试框架尚未搭建。规划中的工具链：

- 开发 IDE：**HBuilder V 5.21+**（版本已锁进 README；本机 HBuilderX 5.26 验证可用）
- CI 出包：`@dcloudio/uni-cli`（规划）/ 本机暂用 `scripts/uni.sh`
- 测试：uni 官方自动化测试框架（uni-automator，一套 test.js 驱动全端）+ jest 快照（参照 uni-ui x 的 `jest.config.js`）；**每个 issue 修复配测试例**
- 发布动作 = git tag + 插件市场更新（HBuilder V 右键发布）+ changelog 同步

## 8. 验证门禁（PLAN.md 第 6 节，每次提交前）

1. demo 工程五端编译通过（Android / iOS / 鸿蒙 / H5 / 微信小程序）
2. `uni-automator` 核心用例全绿
3. 新增组件自查清单：纯 ts？ucss 子集？无 scoped？文字在 text 上？easycom 路径规范？条件编译显式？
4. 包体积基线：微信小程序主包（demo）≤ 1.5MB（UIKit+SDK 进分包），每次发版记录数字

## 9. 实施路线（PLAN.md 第 5 节）

- **M0（先行，唯一未知风险）**：SDK 五端连通性 spike——websdk 在 Android（蒸汽 release 包）/iOS/鸿蒙登录 + WebSocket 长连接 + 收发文本 + 断线重连；微信小程序 SDK 线；H5；存储差异清单（`localStorage` 不可用点换 `uni.setStorage`）。产出 `docs/SPIKE-SDK-CONNECTIVITY.md`。**M0 不过则暂停 UI 开发，回头评估 SDK 方案（必要时封装 uts 插件）。**
- **M1**：demo 最小闭环（登录页 + 会话列表 + 聊天骨架，文本/图片气泡先通）——先于一切抽象。
- **M2**：聊天页完整化（语音/视频/文件气泡、长按四菜单、引用/撤回/重发/已读、输入栏、主题、i18n）。
- **M3**：组件沉淀与发布（解耦出页面级+原子组件、pages_init.json、token 体系定稿、README/changelog/license、uni-automator 核心链路用例、插件市场首发 0.1.0 + GitHub 开源）。
- **M4**（二期，另行立项）：通讯录、群基础、单条转发、文档站。

## 10. 参考资产与样本（PLAN.md 附录 B）

- 设计 token 平移来源：`easemob-uikit-vue/docs/DESIGN-TOKEN-MAPPING.md`（本仓库外）
- 组件 API 契约参照：`easemob-uikit-vue/packages/uikit-im/src`（props/emits 命名、i18n key、Avatar 徽标规范；实现不可复用，全部重写）
- 开源参照：uni-ui x（gitcode.com/dcloud/uni-ui-x，**alpha 分支**）、RiceUI（gitee.com/riceui/rice-ui，**release_vapor 分支**）、hello-uni-app-x（官方示例 + 自动化测试例）、unibestX（工程模板）
- 反面教材：FirstUI-uvue（选项式 + uts 强类型的历史包袱，避免回退）
- DCloud 官方文档为规范与约束的唯一权威来源（ucss 子集规范、蒸汽模式专题、uni_modules 包管理规范等链接见 PLAN.md 附录 B.1）

## 11. 安全注意事项

- 环信登录使用 appkey + userId + token；demo 的「测试 token 获取」入口**仅限开发用**，不得带入正式分发。
- 仓库 MIT 开源，提交前注意不要把任何真实 appkey、token、账号凭据写进代码或文档。
- websdk 为 peer 依赖；引入任何新的运行时依赖前须对照「零运行时依赖」纪律（PLAN.md 1.4 节），确有必要先改 PLAN.md。
