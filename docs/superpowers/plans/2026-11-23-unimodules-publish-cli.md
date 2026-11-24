# uni_modules 通用发布 CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 提供默认安全、显式发布的 HBuilderX 官方 uni_modules CLI 封装，并沉淀到 UIKit 发布技能。

**Architecture:** 单个零依赖 Node.js 脚本解析参数、读取本地插件版本并顺序调用官方 CLI。测试通过临时假 CLI 记录参数和模拟结果，真实验收只执行 validate 与 dry-run。

**Tech Stack:** Node.js 内置 `fs/path/child_process/url`、`node:test`、HBuilderX CLI。

**Spec:** `docs/superpowers/specs/2026-11-23-unimodules-publish-cli-design.md`

## Global Constraints

- 不调用网页发布接口，不制作网页上传 ZIP，不新增 npm 依赖。
- 默认不得正式发布；只有 `--publish` 才能上线，且必须先通过 validate 与 dry-run。
- 不执行真实正式发布，不修改版本号，不创建标签或提交。

## Review Focus

- 缺少更新日志、工程或插件清单时应在调用 CLI 前失败；由参数测试覆盖。
- 官方进程退出码为 0 但 JSON 失败时必须中断；由结果测试覆盖。
- 更新日志中的空格和特殊字符必须作为单个参数传递；由参数记录测试覆盖。
- dry-run 失败时不得继续正式发布；由顺序测试覆盖。
- CLI 路径应允许参数和环境变量覆盖；由自定义路径测试覆盖。

---

### Task 1: 安全发布 CLI 与回归测试

**Files:**
- Create: `scripts/publish-uni-modules.mjs`
- Create: `scripts/test-publish-uni-modules.mjs`

**Interfaces:**
- CLI: `node scripts/publish-uni-modules.mjs [--project <dir>] [--plugin <id>] [--cli <path>] [--change-log <text> | --change-log-file <path>] [--publish]`
- Environment: `HBUILDERX_CLI` 覆盖默认 HBuilderX CLI。
- Output: 官方 JSON 原样输出；失败时非零退出并停止后续调用。

- [x] **Step 1: 编写失败测试**

用 `node:test` 创建临时宿主、`uni_modules/<id>/package.json` 和假 CLI。断言默认调用 validate 与带 `--dryRun` 的 publish；`--publish` 依次调用 validate、dry-run、正式发布；模拟失败时不继续；缺少参数、非法 JSON 结果和冲突日志参数均失败。

- [x] **Step 2: 运行测试确认失败**

Run: `node --test scripts/test-publish-uni-modules.mjs`
Expected: FAIL，原因是 `scripts/publish-uni-modules.mjs` 尚不存在。

- [x] **Step 3: 实现最小脚本**

使用 `spawnSync` 参数数组调用官方 CLI，不使用 shell 字符串拼接。解析每个命令最后一行非空 JSON，检查 `success:true` 和预期 `outcome`；默认项目为仓库 `demo`，插件为 `easemob-uikit-uni`。

- [x] **Step 4: 运行测试确认通过**

Run: `node --test scripts/test-publish-uni-modules.mjs`
Expected: 全部测试 PASS，且测试只访问临时假 CLI。

### Task 2: 发布技能与真实官方通道验收

**Files:**
- Modify: `.agents/skills/em-plugin-publishing/SKILL.md`
- Modify: `docs/RELEASE-1.0.md`
- Modify: `docs/STATUS.md`

**Interfaces:**
- Consumes: Task 1 的 CLI 参数与安全模式。
- Produces: 后续发布统一使用 `publish-uni-modules.mjs` 的文档流程。

- [x] **Step 1: 更新发布文档**

将封装命令设为推荐入口，保留原始官方命令作为排错参考；明确默认 dry-run、`--publish` 正式上线、版本门禁和上线验收不变，并记录本次实现与验证。

- [x] **Step 2: 运行仓库门禁**

Run: `node --test scripts/test-*.mjs && node scripts/check-release.mjs && node scripts/check-docs.mjs`
Expected: 测试零失败、发布自检 WARN 0、文档检查通过。

- [x] **Step 3: 真实 validate 与 dry-run**

使用仓库 `demo` 和本地 `1.0.3` 执行新脚本的默认模式。Expected: validate 返回 `validated`，dry-run 返回 `validated`；不执行 `--publish`，DCloud 线上版本不变。

- [x] **Step 4: 检查最终差异**

Run: `git diff --check && git status --short`
Expected: 只有本计划相关脚本、测试、技能与文档变化，无临时工程、ZIP 或构建产物。
