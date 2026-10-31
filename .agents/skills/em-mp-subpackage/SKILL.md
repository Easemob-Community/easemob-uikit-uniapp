---
name: em-mp-subpackage
description: Use when working on easemob-uikit-uni WeChat Mini Program packaging（SDK/页面分包、主包体积、prepare/check/mp-weixin 脚本、sub-sdk/im-sdk.js、project.private.config.json、跨分包 require、dev watch、mp 构建报错）。环信 uni UIKit 小程序分包机制全解。
---

# em-mp-subpackage — 微信小程序双分包与宿主接入

> 宿主公开指引：`docs/GUIDE-WEAPP-SDK-SUBPACKAGE.md`；宿主 Skill：`skills/em-host-mp-subpackage/SKILL.md`。公开 Skills 文档由 `scripts/sync-skills-docs.mjs` 生成，不手改。

## 目标与现状

websdk 5.1.3 IIFE 873KB 完全移出主包，经 esbuild 降级为 sub-sdk 约 1234KB。chat-only 同时包含 `sub-im` 页面分包与 `sub-sdk` SDK 分包，可作为新宿主的最小双分包工程。主包红线 ≤1.5MB。

## 机制

1. **根仓库脚本单源**：
   - `scripts/prepare-sdk-subpackage.mjs`：IIFE 全局名校验、追加 CJS 导出、ES2017 降级、必需导出真实 require、写 `sub-sdk/im-sdk.js`、patch 公共/私有项目配置。
   - `scripts/check-mp-size.mjs`：app.json 前置诊断、分包声明/preload、SDK 文件与导出、公共/私有 ignore、主包体积、主包 SDK 特征串、跨分包 require、JS 语法。
   - `scripts/mp-weixin.mjs`：宿主 `dev/build/check/watch` 编排。
   - `scripts/sync-mp-subpackage.mjs`：同步到 `skills/em-host-mp-subpackage/scripts/` 与 `templates/chat-only/scripts/`；`--check` 纳入模板门禁，三处字节一致。
2. **配置硬约束**：`project.config.json` 与已存在的 `project.private.config.json` 中 `ignoreDevUnusedFiles/ignoreUploadUnusedFiles` 必须为 false。私有配置覆盖公共配置；异步 require 文件不在静态依赖图，开启任一忽略项都可能报 `module 'sub-sdk/im-sdk.js' is not defined`。
3. **watch**：同时跟踪 app.json、SDK 文件与两层配置，dev 重发删文件或开发者工具改配置都会触发自愈；不是只看 app.json mtime。
4. **加载器**：`libs/client/sdk.ts` 仍是全库唯一 websdk 运行时导入收口；MP 使用 `../../../../sub-sdk/im-sdk.js` 回调式跨分包 require，Promise 缓存/失败重置/导出校验与 `sdkLoader/sdkModule` 注入口不变。

## 宿主命令

模板 `package.json`：

- `npm run dev:mp`：prepare watch + HBX CLI dev，退出回收 watch。
- `npm run build:mp`：HBX build → prepare → check。
- `npm run check:mp`：检查 build 产物。
- `npm run watch:mp`：仅 watch dev 产物，配合 HBuilderX GUI。

HBX 非默认路径用 `HBUILDERX_PATH`；单独指定 esbuild 用 `ESBUILD_BIN`。prepare 同时兼容仓库位置参数与宿主 `--project/--out/--sdk/--esbuild`。

## 模板与页面分包

- `templates/chat-only/sub-im/pages/chat/chat.uvue`：聊天页；登录跳 `/sub-im/pages/chat/chat`。
- `sub-im` 与 `sub-sdk` 均 `independent:false`；SDK 加载页保留在 `sub-sdk/pages/placeholder`。
- `scripts/check-template.mjs` 检查源码路径、脚本同步、web/mp 构建、编译后 app.json 双分包和实际聊天页产物。
- 既有宿主不自动改写 `pages.json`/tabBar/路由；文档给声明示例与统一脚本。

## 排错与验证

- `node --test scripts/test-mp-subpackage.mjs`：配置覆盖、私有文件缺省、app.json 缺失、旧位置参数、npm 命令、同步负例、双分包结构。
- app.json 缺失 = 上游 HBX 编译失败，检查器应只给这一可操作诊断，不能手补空文件。
- watch 验证：删除 dev SDK、把私有 ignore 改回 true，应自动恢复。
- 完整门禁：demo `build web + build mp-weixin`、模板检查、docs/skills/release/config/audit。主包与实测阻塞记 `docs/STATUS.md`，未实测的真实账号链路不得宣称通过。
