# 微信小程序分包低操作接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让新宿主通过自包含模板和统一命令完成页面/SDK 分包，让既有宿主通过一条检查命令获得明确诊断。

**Architecture:** 复用 `templates/chat-only`，将聊天页迁入 `sub-im`，保留 `sub-sdk`。根仓库维护 prepare、check、命令编排脚本的权威实现，同步到宿主 Skill 与模板；模板命令串联 HBuilderX CLI、后处理和验收，不自动改写任意宿主路由。

**Tech Stack:** uni-app x vapor、Vue 3、TypeScript、Node.js 18+ 内置模块、HBuilderX CLI/esbuild、Markdown。

**Spec:** `docs/superpowers/specs/2026-10-31-weapp-subpackage-onboarding-design.md`

## Global Constraints

- 不新增运行时依赖，不改变 UIKit SDK 异步加载协议或公开 API。
- `sub-im` 与 `sub-sdk` 均为 `independent: false`；模板复制到仓库外后脚本仍可使用。
- 不自动修改任意宿主 `pages.json`，不手改 `unpackage/` 作为实现手段。
- 根仓库、宿主 Skill、模板的脚本必须字节一致，由同步检查守护。
- 公开文档不出现内部里程碑、优先级、验证状态或本机路径；Skills 公开文档由生成脚本产出。
- 保留工作区已有改动，不自动 commit；只记录实际执行过的验证。

## Review Focus

- 公共配置为 false 但私有配置为 true：后处理和检查器都必须识别，由 Task 1 的配置单测覆盖。
- `app.json` 缺失：检查器应指出上游编译失败而非继续报分包错误，由 Task 1 的负例覆盖。
- dev 重发删除 SDK 或开发者工具改回私有配置：watch 必须恢复，由 Task 2 的 dev 集成检查覆盖。
- 页面路径迁移后登录仍跳旧路径：模板结构和构建必须同时断言，由 Task 3 覆盖。
- 模板复制到仓库外找不到根仓库脚本：Task 2 通过自包含脚本与同步一致性检查覆盖。

---

### Task 1: 强化分包后处理与检查器

**Files:**
- Modify: `PLAN.md`
- Modify: `scripts/prepare-sdk-subpackage.mjs`
- Modify: `scripts/check-mp-size.mjs`
- Create: `scripts/test-mp-subpackage.mjs`

**Interfaces:**
- Produces: `patchProjectConfigs(outDir: string): string[]`，强制两层 ignore 配置并返回实际修改的文件名。
- Produces: `validateUnusedFileSettings(outDir: string): string[]`，返回公共/私有配置错误列表。
- Produces: 位置参数与 `--project/--out/--sdk/--esbuild` 均兼容的 prepare CLI，以及可诊断 `app.json` 缺失的 check CLI。

- [ ] **Step 1: 先登记范围**
  在 `PLAN.md` 增加本次接入体验范围：自包含双分包模板、统一命令、配置覆盖修复和诊断门禁；明确不做自动路由改写。

- [ ] **Step 2: 写失败测试**
  用 `node:test` + 临时目录覆盖：公共 false/私有 true 被修正且其他设置保留；缺私有文件不创建；`app.json` 缺失时 check 返回“先修复 HBuilderX 编译”类错误；`validateUnusedFileSettings` 能发现私有 true。

- [ ] **Step 3: 运行测试确认 RED**
  Run: `node --test scripts/test-mp-subpackage.mjs`
  Expected: 因导出不存在或旧逻辑未覆盖私有配置而失败。

- [ ] **Step 4: 实现最小修复**
  prepare 在写 SDK 前验证 `app.json/project.config.json`，实现 `patchProjectConfigs`；watch 状态同时包含 `app.json`、SDK 文件和两层配置。check 实现 `validateUnusedFileSettings`，将 `app.json` 缺失转为单一可执行诊断，并保留原有体积、导出、require、语法检查。两个脚本仅在直接执行时运行 CLI，便于测试导入。

- [ ] **Step 5: 运行测试确认 GREEN**
  Run: `node --test scripts/test-mp-subpackage.mjs`
  Expected: 全部 PASS。

- [ ] **Step 6: 对真实 demo 产物做回归**
  Run: `node scripts/prepare-sdk-subpackage.mjs demo/unpackage/dist/build/mp-weixin demo && node scripts/check-mp-size.mjs demo/unpackage/dist/build/mp-weixin demo`
  Expected: SDK 导出与全部分包检查通过，主包 ≤1.5MB。

### Task 2: 自包含统一命令与脚本单源同步

**Files:**
- Create: `scripts/mp-weixin.mjs`
- Create: `scripts/sync-mp-subpackage.mjs`
- Modify: `templates/chat-only/package.json`
- Create: `templates/chat-only/scripts/{mp-weixin,prepare-sdk-subpackage,check-mp-size}.mjs`（由同步脚本生成）
- Modify: `skills/em-host-mp-subpackage/scripts/{mp-weixin,prepare-sdk-subpackage,check-mp-size}.mjs`（由同步脚本生成）
- Modify: `scripts/test-mp-subpackage.mjs`

**Interfaces:**
- Consumes: Task 1 的 prepare/check CLI。
- Produces: `node scripts/mp-weixin.mjs <dev|build|check|watch> [--project <dir>]`；模板 npm 命令 `dev:mp/build:mp/check:mp/watch:mp`。
- Produces: `node scripts/sync-mp-subpackage.mjs [--check]`，同步或校验三处脚本字节一致。

- [ ] **Step 1: 增加失败测试**
  断言三个 npm script 名称和映射存在；同步目标列表包含宿主 Skill 与模板；`--check` 在目标缺失时失败。

- [ ] **Step 2: 运行测试确认 RED**
  Run: `node --test scripts/test-mp-subpackage.mjs`
  Expected: 因编排/同步脚本或 npm 命令缺失而失败。

- [ ] **Step 3: 实现命令编排与同步**
  `dev` 启动 watch 和 HBX dev 并回收子进程；`build` 顺序执行 HBX build、prepare、check；`check` 检查 build 产物；`watch` 后处理 dev 产物。使用 `spawnSync/spawn` 和 Node 内置模块，HBX 路径可由 `HBUILDERX_PATH` 覆盖。同步脚本复制权威脚本并支持只读检查。

- [ ] **Step 4: 运行同步与测试**
  Run: `node scripts/sync-mp-subpackage.mjs && node --test scripts/test-mp-subpackage.mjs && node scripts/sync-mp-subpackage.mjs --check`
  Expected: 全部 PASS，三处脚本一致。

- [ ] **Step 5: 验证模板 build 命令**
  Run: `npm --prefix templates/chat-only run build:mp`
  Expected: 不依赖仓库根脚本，HBX build、prepare、check 全部成功。

### Task 3: 将聊天页纳入 sub-im 并升级模板门禁

**Files:**
- Modify: `templates/chat-only/pages.json`
- Move: `templates/chat-only/pages/chat/chat.uvue` → `templates/chat-only/sub-im/pages/chat/chat.uvue`
- Modify: `templates/chat-only/pages/login/login.uvue`
- Modify: `scripts/check-template.mjs`
- Modify: `scripts/test-mp-subpackage.mjs`

**Interfaces:**
- Produces: 登录成功路由 `/sub-im/pages/chat/chat`。
- Produces: 模板结构及构建产物同时包含普通分包 `sub-im` 与 `sub-sdk` 的断言。

- [ ] **Step 1: 增加失败测试**
  断言源码不再存在主包聊天页、`pages.json` 的 `sub-im` 包含聊天页且 `independent:false`、登录跳转使用新路径；旧结构下测试失败。

- [ ] **Step 2: 运行测试确认 RED**
  Run: `node --test scripts/test-mp-subpackage.mjs`
  Expected: 页面分包断言失败。

- [ ] **Step 3: 迁移页面并扩展检查**
  只移动聊天页及更新登录路由；`check-template.mjs` 增加源码路径检查，并在 mp 构建后解析 `app.json`，断言两类分包、占位页和实际聊天页产物存在。

- [ ] **Step 4: 运行模板完整门禁**
  Run: `node scripts/check-template.mjs`
  Expected: web/mp build、双分包、SDK 和主包体积检查全部通过。

- [ ] **Step 5: 验证 watch 自愈**
  启动模板 `watch:mp`，在 dev 产物存在后分别删除 `sub-sdk/im-sdk.js`、把私有 `ignoreDevUnusedFiles` 改回 true；Expected: watch 自动恢复文件与 false 配置，随后停止本次验证进程。

### Task 4: 收敛宿主文档并完成仓库门禁

**Files:**
- Modify: `templates/chat-only/README.md`
- Modify: `docs/QUICKSTART.md`
- Modify: `docs/GUIDE-WEAPP-SDK-SUBPACKAGE.md`
- Modify: `docs/FAQ.md`
- Modify: `skills/em-host-mp-subpackage/SKILL.md`
- Modify: `skills/em-host-troubleshooting/SKILL.md`
- Modify: `uni_modules/easemob-uikit-uni/readme.md`
- Modify: `.agents/skills/em-mp-subpackage/SKILL.md`
- Modify: `docs/STATUS.md`
- Generate: `docs/SKILLS-MP-SUBPACKAGE.md`、`docs/SKILLS-TROUBLESHOOTING.md`

**Interfaces:**
- Produces: 新工程“复制模板 → 配置 → 一条命令”、既有工程“声明 → 后处理 → 检查”的一致公开路径。

- [ ] **Step 1: 更新主路径与诊断文档**
  文档优先展示模板命令；GUI 仅保留 watch 配合路径。补公共/私有配置覆盖、dev/build 目录、app.json 缺失与 HBX 编译错误的因果；既有项目给复制脚本和检查命令，不承诺自动改写路由。

- [ ] **Step 2: 同步 Skills 公开文档**
  Run: `node scripts/sync-skills-docs.mjs`
  Expected: 生成文档与回源 Skill 一致。

- [ ] **Step 3: 执行仓库门禁**
  Run: `scripts/uni.sh build web && scripts/uni.sh build mp-weixin`
  Run: `node scripts/check-template.mjs`
  Run: `node scripts/check-docs.mjs && node scripts/check-skills.mjs && node scripts/check-release.mjs && node scripts/check-config-docs.mjs && node scripts/audit-usage.mjs demo --check`
  Expected: 全部退出码 0；记录主包与分包体积。

- [ ] **Step 4: 检查最终差异并记录事实**
  确认没有生成物、临时文件或无关改动混入；`STATUS.md` 只记录实际通过的构建、负例、watch 和既有 demo 登录验证，不把未做的模板真实收发写成已验证。
