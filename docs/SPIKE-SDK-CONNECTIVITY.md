# SPIKE：SDK 五端连通性（M0）

> 目标：验证环信 SDK 在五端的登录 + WebSocket 长连接 + 收发文本 + 断线重连 + 存储差异。
> 用例：`demo/pages/spike/spike.vue`（手填凭据 → 登录 → 发文本 → 收文本）。

## 结论先行

**SDK 选型定稿：`easemob-websdk@5.x`（实测 5.1.2），根入口导入 + `ChatClient.init` + Manager 注册制。** 5.x 官方自带跨平台运行时适配（uni-app/uni-app x/小程序的请求、WebSocket、存储由 SDK 自行适配），不需要 4.x 的 `uniApp/` 子路径构建。PLAN.md 第 3 节 SDK 行按此执行。

## 验证环境

| 项 | 值 |
|---|---|
| HBuilderX | 5.26.2026091802（≥5.21 ✓） |
| HBuilder V | 1.129.0-alpha（已安装） |
| Node.js | v22.22.0 |
| easemob-websdk | 5.1.2（demo 依赖，uni_modules peer 声明 ^5.1.2） |
| 微信开发者工具 / DevEco Studio / Android Studio / Xcode | 已安装 |
| CLI 编译路径 | HBuilderX 内置 `plugins/uniapp-cli-vite`，封装为 `scripts/uni.sh <dev\|build> <web\|mp-weixin>` |

## 各端结论

| 端 | 编译 | 登录 | 发文本 | 收文本 | 断线重连 | 备注 |
|---|---|---|---|---|---|---|
| H5(web) | ✅ | ✅ | ✅ | ✅ | ✅（登出→再登录循环验证） | 双标签 hfp/pfh 双向实时收发实测通过；网络闪断的自动重连未单独测（SDK 5.x 内置重连机制） |
| 微信小程序 | ✅ build 通过 | 明天验证 | 明天验证 | 明天验证 | 明天验证 | 产物 `demo/unpackage/dist/build/mp-weixin`，导入微信开发者工具实测；注意配置合法域名（见下） |
| Android（蒸汽 release） | 明天验证 | | | | | 需 HBuilderX 运行/发行流程 |
| iOS | 明天验证 | | | | | |
| 鸿蒙 | 明天验证 | | | | | API20+，需 DevEco 流程 |

## 踩坑记录（重要，全是实测）

1. **4.x 根构建在 uni-app 运行时不可用**：`easemob-websdk@4.24.3` 默认入口在 uni-app web 运行时报 `a2.onOpen is not a function`（环境嗅探走错分支）。4.x 必须用 `easemob-websdk/uniApp/Easemob-chat` 子路径构建（实测可登录可收发）；**5.x 根入口直接可用，优先 5.x**。
2. **5.x 与 4.x API 不兼容**：4.x 是 `new websdk.connection()` + `conn.open()` + `onTextMessage`；5.x 是 `ChatClient.init({appKey, managers:[ChatManager]})` + `client.login({userId, token})` + `onMessage`。消息类型枚举 4.x 用 `'txt'`，**5.x 用 `'text'`**（我们被这个坑过一次：按 'txt' 过滤导致收消息全丢）。消息 id 字段：5.x 是 `msgServerId`/`msgLocalId`（4.x 是 `id`）。
3. **vite 预构建缓存会钉死旧版 SDK**：4.x 升 5.x 后 dev server 仍用缓存的 4.x 包（报 `ChatClient undefined`）。删 `demo/unpackage/dist/cache/.vite` 并重启 dev server 解决。
4. **web 端编译要求项目根有 `index.html`**，缺失报「根目录缺少 index.html」。
5. **App.vue 不能是空 SFC**：至少要有含实际内容的 `<script setup>` 或 `<template>`。
6. **uni-app x 蒸汽工程编到 web/小程序自动走 VDOM 管线**（编译器输出明确标注「VDOM模式」），官方预期行为。
7. 4.x 的 websdk 内含 `eval`（构建告警）；5.x（5.1.2）已无 eval 告警，仅剩一条无害的 Rollup 注释位置告警。

## 存储差异清单

| 端 | localStorage | uni.setStorage | 结论 |
|---|---|---|---|
| H5 | 可用（SDK 5.x 内部自适配） | 可用 | ✅ |
| 微信小程序 | 明天验证 | 明天验证 | 小程序发布需配置合法域名：`https://rs.chat.rtnsvc.com`、`https://rs.easemob.com`（request）、`wss://ngi-fusion.easemob.com`（socket） |
| App（uni-app x js 引擎） | 明天验证 | 明天验证 | |

> 纪律：`libs/platform.ts` 收口存储 API，组件一律走该层，不直接碰 `localStorage`。

## libs 代码结构（按功能拆分，参照 Web 版 uikit-im）

```
libs/
├── index.ts        # EmKit 门面（对外唯一入口）
├── client/         # 客户端生命周期：init/login/logout/连接事件（ChatClient 封装）
├── chat/           # 消息收发（ChatManager 封装）
├── store/          # 裸 reactive store（connection 状态）
├── platform.ts     # 平台适配层（存储收口）
└── types/          # 中立类型定义
```

## 风险触发线（PLAN.md M0）

- 蒸汽 App 端 SDK 5.x WebSocket/存储不兼容 → 暂停 UI 开发，评估 uts 插件封装兜底。
- 微信小程序端 5.x 不通 → 回退验证 4.x uniApp 构建（已在 H5 实测可用），并先改 PLAN.md 第 3 节 SDK 选型行。
