# Android Attachment Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 Android 文件上传/下载，并让成功发送的文件优先本地即时打开。

**Architecture:** Android 使用内置 `uni.chooseFile` 的原始路径或 content URI；下载域负责 HTTPS 归一、本地路径判定与本地打开；消息域只调整文件临时副本的释放时机，聊天页在显示 loading 前先尝试本地打开，且每次远端下载只创建一个 loading。

**Tech Stack:** uni-app x、TypeScript、UTS provider、easemob-websdk 5.2.0、Node test + HBuilderX esbuild。

**Spec:** `docs/superpowers/specs/2026-11-24-android-attachment-repair-design.md`

## Global Constraints

- 零新增运行时依赖，不修改公开 `EmMessageItem` 字段，不实现转发或通用下载管理器。
- 先写失败测试并确认失败原因，再写最小实现；不得用静态推断替代最终真机结果。
- 保留工作区其他未提交改动，不执行 git commit/reset/rebase/push。

## Review Focus

- `uni.chooseFile` 的原始 path/content URI 不得再做 `prepareFile`、`file://` 或外部缓存目录转换。
- HTTPS 转换必须保留 `em-redirect` 与 `share-secret`，本地路径不得被当远端地址。
- 文件发送成功不得立即 release，但删除消息、其他端删除与 reset 仍必须释放。
- 只有 `self + FILE + SENT + 非远端 URL` 才能本地直开；H5 blob/data 与其他消息类型不得误判。
- 本地打开成功后不得出现下载 loading，失败必须继续原远端下载链路。

---

### Task 1: Android 内置选择器原始路径直传

**Files:**
- Modify: `demo/common/attachment-provider.uts`
- Test: `scripts/test-attachment.mjs`

**Interfaces:**
- Produces: provider 使用内置 `uni.chooseFile`，将 `tempFiles[].path` 原样交给 SDK；不调用 `prepareFile`，不拼接 `file://`，也不依赖外部缓存目录。

- [ ] **Step 1: 写原始路径直传失败测试**
  断言 provider 调用 `uni.chooseFile` 且不做额外路径转换。
- [ ] **Step 2: 运行 `node --test scripts/test-attachment.mjs`，确认旧 provider 不符合直传契约**
- [ ] **Step 3: 实现 uni.chooseFile provider 并恢复原生插件的既有实现**
- [ ] **Step 4: 重跑专项，真机确认 content URI 可计算 MD5 并上传**

### Task 2: 文件下载 HTTPS 归一

**Files:**
- Modify: `uni_modules/easemob-uikit-uni/libs/platform.ts`
- Modify: `uni_modules/easemob-uikit-uni/libs/utils/download.ts`
- Test: `scripts/test-attachment.mjs`

**Interfaces:**
- Produces: `normalizeAttachmentUrl(url: string): string`；`normalizeVideoUrl` 保持原调用兼容；`downloadRequestUrlOf` 在追加参数前归一远端 URL。

- [ ] **Step 1: 新增 HTTP、协议相对地址、HTTPS 与 secret 保留测试**
  重点断言 `http://ngi-a1.easemob.com/.../chatfiles/id` 最终为 `https://...?em-redirect=true&share-secret=s`。
- [ ] **Step 2: 运行专项，确认 HTTP 仍原样返回而失败**
- [ ] **Step 3: 实现统一归一并接入下载请求**
- [ ] **Step 4: 重跑专项与既有 `test-multi-body-message.mjs`**

### Task 3: 自发文件本地即时预览

**Files:**
- Modify: `uni_modules/easemob-uikit-uni/libs/chat/message.ts`
- Modify: `uni_modules/easemob-uikit-uni/libs/utils/download.ts`
- Modify: `uni_modules/easemob-uikit-uni/libs/platform.ts`
- Modify: `uni_modules/easemob-uikit-uni/components/pages/em-chat-page/em-chat-page.vue`
- Test: `scripts/test-attachment.mjs`

**Interfaces:**
- Produces: `localFilePathOf(message: EmMessageItem): string`、`openLocalFileAttachment(message: EmMessageItem): Promise<boolean>`；聊天页在 `uni.showLoading` 前调用本地打开。

- [ ] **Step 1: 写本地路径判定与真实 domain 生命周期测试**
  覆盖 self/FILE/SENT/file URI 命中，received、failed、HTTP(S)、blob/data、非 FILE 不命中；fake SDK 发送成功后 release 计数为 0，reset 后为 1。
- [ ] **Step 2: 写本地打开测试**
  mock `uni.openDocument` 成功，断言本地文件直接打开且没有 `uni.downloadFile`；远端消息返回 false。
- [ ] **Step 3: 运行专项，确认旧实现立即 release 且没有本地打开能力**
- [ ] **Step 4: 实现文件成功保留、localFilePathOf/openLocalFileAttachment 与聊天页本地优先**
  `fileOpen` 改为 true；`onFileDownload` 复用 `downloadMessage`；本地成功只提示打开结果，不进入 loading，失败继续原下载。
- [ ] **Step 5: 重跑专项及全量 Node 测试**

### Task 4: 文档、构建与真机闭环

**Files:**
- Modify: `PLAN.md`、`docs/PAGES-CHAT.md`、`docs/PLATFORM.md`、`docs/MESSAGING.md`、`docs/API-TYPES-PLATFORM.md`、`docs/API-UTILS.md`
- Modify: `docs/STATUS.md`、`reports/realdevice-issues.md`、`.agents/skills/em-crossend-pitfalls/SKILL.md`
- Modify: `skills/em-host-conversation-chat/SKILL.md` 及生成页（经同步脚本）

- [ ] **Step 1: 更新单击行为、uni.chooseFile 原始路径与临时副本生命周期文档，同步 Skills**
- [ ] **Step 2: 运行全量 Node 测试、`check-docs`、`check-skills`、App 模块图与 `git diff --check`；补充下载进度不得重复 showLoading 的回归**
- [ ] **Step 3: Node 22 下运行 `build web`、`build mp-weixin`，确认分包检查与 H5 HTTP 200**
- [ ] **Step 4: Android 标准基座复测**
  发送 PDF 成功；自发单击直接打开且无远端 loading；接收 PDF 下载并预览；删除/登出清理有日志或行为证据。若原始 content URI 仍不被 `uploadFile` 接受，记录真实堆栈并回到 Task 1，不改称已修复。
- [ ] **Step 5: 将 RD-16/RD-17 按真实结果更新为已修或保持未修，记录未验证端**
