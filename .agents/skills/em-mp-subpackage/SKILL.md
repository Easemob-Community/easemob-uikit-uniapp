---
name: em-mp-subpackage
description: Use when working on easemob-uikit-uni WeChat Mini Program packaging（SDK 分包异步化、主包体积、prepare/check 脚本、sub-sdk/im-sdk.js、跨分包 require、EmKit.whenReady 加载态、升级 websdk 版本、mp-weixin 构建报错如 "module 'sub-sdk/im-sdk.js' is not defined"）。环信 uni UIKit 小程序 SDK 分包机制全解。
---

# em-mp-subpackage — 微信小程序 SDK 分包异步化（M2.8 定案）

> 宿主接入指引另见 `docs/GUIDE-WEAPP-SDK-SUBPACKAGE.md`（实施指引/验证方法/报错排查表/升级回滚）；编译器行为实测事实见 `docs/SPIKE-SDK-SUBPACKAGE.md`。本文面向库仓开发。

## 目标与现状

websdk 5.1.3 IIFE 873KB 完全移出主包：demo mp-weixin 主包 1768KB→**493KB**（vendor.js 942KB→169KB）；sub-sdk 分包内 `im-sdk.js` 1234KB（esbuild 降级 es2017 后）。主包红线 ≤1.5MB，`scripts/check-mp-size.mjs` 构建后自动断言。

## 机制三件套

1. **`scripts/prepare-sdk-subpackage.mjs`**（`uni.sh build mp-weixin` 构建后自动执行）：
   - 校验 IIFE 全局名 `IMSDK` → 追加 `module.exports`（CommonJS 跨分包 require 前提）
   - HBuilderX 内置 esbuild 降 es2017（IIFE 含 `?.`/`??`，旧基础库真机 SyntaxError）
   - 拷入产物 `sub-sdk/im-sdk.js`
   - **patch `project.config.json` 关 `ignoreDevUnusedFiles/ignoreUploadUnusedFiles`**——异步 require 文件不在静态依赖图，不关会被依赖分析剔除，报 `module 'sub-sdk/im-sdk.js' is not defined`（本仓实测坑）
2. **`scripts/check-mp-size.mjs`** 防回归 11 项：锁版断言 / module.exports / 无 `?.` 残留 / 忽略项关闭 / 主包 ≤1.5MB / vendor 无 `msync` 特征串 / 跨分包 require 存活 / `node --check` 语法。
3. **`libs/client/sdk.ts` —— 全库唯一 websdk 运行时导入收口**：
   - `#ifndef MP-WEIXIN`：静态直通（零行为变更）
   - `#ifdef MP-WEIXIN`：模块级持有 + `ensureSdkModule()`（Promise 缓存 / 失败重置 / `REQUIRED_EXPORTS` 导出校验）
   - 默认走微信原生跨分包 `require(path, cb, fail)` 回调式加载；**裸 require 可存活于 .uvue/.ts，路径相对编译产物中的调用文件**（sdk.ts 编译后在 `uni_modules/.../libs/client/` 下 → `../../../../sub-sdk/im-sdk.js`；分包内页面 → `../../../`；TS 侧 `@ts-ignore`）
   - `EmKitConfig.sdkLoader` / `sdkModule` 注入口：宿主自管理加载（MP 专属）

## 就绪门（EmClient 三阶段）

`init()` 同步部分（applyKitConfig/logger 级别）保持同步；`ChatClient.init` 推迟到 `whenReady()`（load → init → login 各缓存 Promise，失败清缓存可重试）。门面 `EmKit.init` 内挂 bind 续体（时序先于业务调用）；所有依赖 SDK 的异步方法前置 `await whenReady()`；宿主加载态占位用 `EmKit.whenReady()`。

## demo 接线

pages.json 两个普通分包：`sub-im`（chat/chat-info/contact-requests/spike/style-lab 五页；tabBar 三页 + login 留主包）与 `sub-sdk`（占位页 + SDK 文件）；`preloadRule` 在登录页预下载 sub-sdk；spike 页有「加载 SDK 分包探针」按钮。

## 维护要点

- **升级 websdk**：改 demo/package.json 精确版本 + 库 peer 声明 + login 页头 `SDK_VERSION` 常量，三处同步；跑 `build mp-weixin` 看防回归全绿。
- **踩坑二（已自动化）**：`dist/dev` 的 dev watch 全量重发会抹掉 `sub-sdk/im-sdk.js`——CLI 走 `uni.sh dev mp-weixin` 会自动伴随 `prepare-sdk-subpackage.mjs --watch`（轮询 app.json，重发后自动重拷）；HBuilderX GUI 起的 dev 需手动 `node scripts/prepare-sdk-subpackage.mjs demo/unpackage/dist/dev/mp-weixin --watch`，否则报 `module 'sub-sdk/im-sdk.js' is not defined`。
- **待验**：iOS/Android 真机语法兼容与收发回归、双端登录互发实测。
