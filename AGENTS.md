# AGENTS.md — easemob-uikit-uniapp（路由版）

> 面向 AI 编码代理。本文只放**每次会话必需的最小上下文**；按主题拆到 `.agents/skills/`（按需加载），进度日志在 `docs/STATUS.md`。
> **维护纪律：进度/事实变更记 `docs/STATUS.md`；规则/坑/契约变更改对应 skill；不要往本文堆细节。**

## 1. 项目一句话

环信 IM 的 **uni-app 版 UIKit**（**仅支持** uni-app x 蒸汽模式，不兼容经典 uni-app / vdom 模式；Android/iOS/鸿蒙 + H5 + 微信小程序共五端），MIT 开源，DCloud 插件市场分发。组件前缀 `em-`，CSS 变量前缀 `--em-*`，插件 id `easemob-uikit-uni`。当前版本 `1.0.0`；进度与各端验证状态见 `docs/STATUS.md`，接入步骤见 `docs/QUICKSTART.md`。

## 2. 硬约束（每次必守，违反即返工）

1. **`PLAN.md` 是一期开发的唯一执行依据**（范围/选型变更先改 PLAN 再动代码，不写清单外功能）。
2. **视觉/交互权威 = 本机 vue 版源码**（只读）：`/Users/neohuang/Desktop/WorkCommonUse/UIKIT/easemob-uikit-vue`——动手做 UI 前先读对应模块（skill: `vue-uikit-design-reference`）。
3. 编码纪律（纯 ts / ucss 子集 / 零运行时依赖 / 枚举走 constants / 中英 i18n / store 命名约定）：skill `em-coding-discipline`。
4. **验证门禁**（每次提交前）：`scripts/uni.sh build web` + `build mp-weixin` 全绿（含分包防回归 11 项）+ H5 产物静态伺服 200；小程序主包 ≤1.5MB。命令用法见 skill `hbuilderx-cli-compile`。
5. **对外文档门禁**：改 `docs/` 公开页或 `changelog.md` 后跑 `node scripts/check-docs.mjs`；新页面必须登记 `docs/docs.manifest.mjs`。写作规范见 skill `em-public-docs`（无 P0/P1/里程碑/待验/规划等内部口径）。

## 3. 技能索引（按任务选读）

| 场景 | skill |
|---|---|
| 写/审任何代码（新组件、样式、store、事件、枚举、平台分支） | `.agents/skills/em-coding-discipline` |
| 组件目录/样式文件组织、easycom、props/插槽透出契约、找现成原子组件 | `.agents/skills/em-component-structure` |
| 视觉对齐 vue 版、token 翻译 | `.agents/skills/vue-uikit-design-reference` |
| 蒸汽端真机 bug（文本裁切/动画不跑/键盘顶飞/事件泄漏）、跨端症状排查 | `.agents/skills/em-crossend-pitfalls` |
| 改 libs/ 内部（EmKit、chat 域、store、platform、日志、弹层、配置体系） | `.agents/skills/em-uikit-architecture` |
| 小程序 SDK 分包、主包体积、mp 构建报错 | `.agents/skills/em-mp-subpackage` |
| 图标增换 | `.agents/skills/em-icon-strategy` |
| 蒸汽工程结构/入口约定/App 端黑屏 | `.agents/skills/uniapp-x-vapor-structure` |
| CLI 编译/伺服/缓存排错 | `.agents/skills/hbuilderx-cli-compile` |
| SDK 集成（websdk 5.x 陷阱） | `.agents/skills/easemob-websdk-v5` |
| 写/更新对外文档、页面/组件/API 参考、manifest 登记、公开边界审计 | `.agents/skills/em-public-docs` |

## 4. 文档索引

- `docs/STATUS.md` — 进度日志（按时间线）、待验项汇总、已验证基线（**接活前先扫一眼**）
- `PLAN.md` — 立项计划书（决策表/范围/路线/门禁的唯一权威）
- `skills/` — **宿主接入向** Agent Skills（对外分发，入口 `em-host-integration`；与 `.agents/skills/` 内部开发技能分开维护，改动后跑 `node scripts/sync-skills-docs.mjs` 与 `node scripts/check-skills.mjs`）
- `docs/docs.manifest.mjs` — 独立文档门户公开清单、页面映射、nav/sidebar 与回源编辑链接；站壳在同级仓库 `../easemob-community-docs`，内部规划/验证材料不得加入 entries
- `scripts/check-docs.mjs` — 对外文档门禁（内部术语/链接/组件/API/配置覆盖/manifest 一致性）
- **对外页面**（全部登记在 manifest，禁止直接改 `.content`）：
  - 入门：`docs/QUICKSTART.md`、`docs/CONCEPTS.md`、`docs/HOME.md`
  - AI 接入：`docs/GUIDE-AGENT-SKILLS.md`、`docs/SKILLS-*.md`（由 `scripts/sync-skills-docs.mjs` 从 `skills/` 生成，禁止手改生成页）
  - 页面：`docs/PAGES-CONVERSATION.md`、`PAGES-CHAT.md`、`PAGES-CHAT-INFO.md`、`PAGES-CONTACTS.md`、`PAGES-GROUPS.md`
  - 组件：`docs/COMPONENTS.md`、`COMPONENTS-BASIC.md`、`COMPONENTS-CONVERSATION.md`、`COMPONENTS-CHAT.md`、`COMPONENTS-CONTACT.md`
  - API/配置：`docs/API.md` 总览；`API-KIT.md`、`API-TYPES.md` 兼容索引；`API-KIT-*.md` 按业务域拆分的 EmKit 参考；`API-TYPES-*.md` 按领域拆分的类型参考；`API-COMPONENTS.md`、`API-COMPOSABLES.md`、`API-UTILS.md`；`CONFIG.md`、`MESSAGING.md`。新页面同时登记 `group` 与 `apiGroup`，由同一 `pages` 元数据派生 guide/API 两套 sidebar
  - 设计与运行：`docs/THEME-I18N.md`、`DESIGN-TOKENS.md`、`GUIDE-STYLING.md`、`PLATFORM.md`、`FAQ.md`
  - 进阶：`docs/GUIDE-MULTI-SCENARIO.md`、`AI-STREAM.md`、`GUIDE-WEAPP-SDK-SUBPACKAGE.md`、`HARMONY-REALDEVICE-RUN.md`、`DEMO.md`
- **内部材料（禁止进入公开 entries）**：`docs/RELEASE-1.0.md`、`docs/SPIKE-SDK-CONNECTIVITY.md`、`docs/SPIKE-SDK-SUBPACKAGE.md`、`docs/EVAL-MULTI-SCENARIO.md`、`docs/REVIEW-1.0-READINESS.md`、`docs/DX-REVIEW.md`、`docs/DX-REMEDIATION.md`

## 5. 安全

- 环信登录用 appkey + userId + token；demo「测试 token 获取」入口**仅限开发**，不进正式分发。
- 仓库 MIT 开源：任何真实 appkey/token/凭据不得写入代码与文档。
- websdk 为 peer 依赖；新运行时依赖须先对照「零运行时依赖」纪律并先改 PLAN.md。
