# SPIKE：SDK 五端连通性（M0）

> 目标：验证环信 SDK 在五端的登录 + WebSocket 长连接 + 收发文本 + 断线重连 + 存储差异。
> 用例：`demo/pages/spike/spike.uvue`（手填凭据 → 登录 → 发文本 → 收文本）。

## 结论先行

**SDK 选型定稿：`easemob-websdk@5.x`（实测 5.1.2），根入口导入 + `ChatClient.init` + Manager 注册制。** 5.x 官方自带跨平台运行时适配（uni-app/uni-app x/小程序的请求、WebSocket、存储由 SDK 自行适配），不需要 4.x 的 `uniApp/` 子路径构建。PLAN.md 第 3 节 SDK 行按此执行。

**工程结构对齐已验证的跑通配方**（参照同事示例 github.com/myZhangDong/uniappX-demo）：入口 `main.uts` + `App.uvue`，页面 `.uvue`（`<script setup lang="ts">` 纯 ts 纪律不变），manifest 加 `"vapor-render-target": "bytecode"`。

## 验证环境

| 项 | 值 |
|---|---|
| HBuilderX | 5.26.2026091802（≥5.21 ✓） |
| HBuilder V | 1.129.0-alpha（已安装） |
| Node.js | v22.22.0 |
| easemob-websdk | 5.1.3（demo 依赖精确锁定 5.1.3，uni_modules peer 声明 5.1.3；spike 实测时点为 5.1.2） |
| 微信开发者工具 / DevEco Studio / Android Studio / Xcode | 已安装 |
| CLI 编译路径 | HBuilderX 内置 `plugins/uniapp-cli-vite`，封装为 `scripts/uni.sh <dev\|build> <web\|mp-weixin>` |

## 各端结论

| 端 | 编译 | 登录 | 发文本 | 收文本 | 断线重连 | 备注 |
|---|---|---|---|---|---|---|
| H5(web) | ✅ build 通过 | ✅ | ✅ | ✅ | ✅（登出→再登录循环验证） | 双标签 hfp/pfh 双向实时收发实测通过；**dev server 模式当前不可用**（见踩坑 8），用 `build web` + 静态伺服验证 |
| 微信小程序 | ✅ build 通过 | ✅ | ✅ | ✅ | ✅ | 2026-10 实测登录/收发/断线重连通过；产物 `demo/unpackage/dist/build/mp-weixin`，导入微信开发者工具实测；注意配置合法域名（见下） |
| Android（蒸汽） | ✅ 真机启动正常 | ✅ | ✅ | ✅ | 待验证 | 2026-10 真机实测登录与收发通过；首轮黑屏（pagesMap 报错），按同事跑通配方改结构（main.uts/App.uvue/.uvue 页面/bytecode）后正常 |
| iOS | 待验证 | | | | | |
| 鸿蒙 | ✅ 真机签名运行已通 | ✅ | ✅ | ✅ | ✅ | 2026-10 真机实测登录/收发/断线重连通过；包名 `uni.app.UNI08EF252`（需在 manifest 鸿蒙配置显式设置，勿用模板默认 `io.dcloud.uniappx`）；签名/真机流程见 `docs/HARMONY-REALDEVICE-RUN.md` |

## 联系人（ContactManager）验证（M2.5）

> 用例：demo 联系人 tab（`pages/contact/contact`）+ 新请求页（`pages/contact-requests/contact-requests`）。
> 接入方式：`ChatClient.init({ enableSyncData: ['conversation','contact'], managers: [..., ContactManager] })`（contact 同步必须显式选择，见踩坑 11），登录后 `contactManager.getContacts()` 读内存快照（好友同步由 SDK 后台自动做），UI 刷新走 `contactManager.addEventHandler` 的 roster 事件驱动。

| 端 | 编译 | getContacts 快照 | addContact 发申请 | 收申请/接受/拒绝 | 删除好友 | 备注 |
|---|---|---|---|---|---|---|
| H5(web) | ✅ build 通过 | ✅（登录后快照读取正常，空列表渲染空态） | ✅（pfh → hfp 申请发送 resolve；重复发送幂等 resolve；自添加被 demo 守卫拦截） | 待双账号实测（对端需在线操作） | 待实测（需先有好友关系） | 2026-10-14 实测；搜索过滤/空态/新请求页渲染/添加 modal 均通过 |
| 微信小程序 | ✅ build 通过（组件 wxss 正常产出） | 待真机/工具实测 | | | | |
| Android / iOS / 鸿蒙 | 待验证 | | | | | |

## 群 API 实测（M2.9 Phase 0）

> 用例：`demo/sub-im/pages/spike/spike.uvue`「群 API 实测」面板（每项独立按钮 + 页面结果区，同步输出 `[emkit:spike]` 日志，真机可经 `EmKit.exportLogs()` 导出）。
> 接入方式：`ChatClient.init({ enableSyncData: ['conversation','contact','group'], managers: [..., GroupManager] })`（M2.9 Phase 1 已注册 GroupManager，踩坑 11 中「不能含 `'group'`」的限制自此解除——enableSyncData 与 managers 成对即可）。

代码层可验证结论（本阶段已完成）：

- **API 存在性**：EmKit 门面透出 `getJoinedGroups / getGroupInfo / getGroupMemberList / getGroupAnnouncement / updateGroupAnnouncement / createGroup / destroyGroup` 等群方法（`libs/index.ts`），群域实现在 `libs/chat/group.ts`；`web` 与 `mp-weixin` 双端编译全绿（含分包防回归 11 项）。
- **事件注册形态**：EmKit 不透出群事件订阅，spike 页经 `EmKit.whenReady()` 拿原始 client，以 `client.groupManager.addEventHandler('spike-group-probe', {...})` 注册 14 个群事件（onMembersJoined/onMembersExited/onGroupInfoChanged/onAnnouncementChanged/onUserRemoved/onGroupDestroyed/onInvitationReceived/onInvitationAccepted/onInvitationDeclined/onAutoAcceptInvitationFromGroup/onOwnerChanged/onAdminAdded/onAdminRemoved/onAllMemberMuteStateChanged），输出事件名序列 + payload 字段名。该形态编译通过，实际触发与 payload 字段待真机回填。
- **同步时序专项**：spike 页登录链路自动执行——登录前以 `client.addEventHandler` 挂 `onSyncDataFinished` 探针，登录后立即 `getJoinedGroups()` 记 t0，group 同步完成回调里复测记 t1，两次对比输出（复刻 contact 缓存慢排查套路，重点验证小程序端）。
- **公告读写往返**：`updateGroupAnnouncement` 后读回校验走 SDK 原始 `groupManager.getGroupAnnouncement`（domain 有公告缓存，EmKit 读回只能证缓存一致）。

真机/工具实测结果（待回填）：

| 端 | 编译 | 群列表/详情 | 成员游标翻页 | 公告读写往返 | 建群→全链路→解散 | 群事件序列 | 同步时序对比 | 备注 |
|---|---|---|---|---|---|---|---|---|
| H5(web) | ✅ build 通过 | 待真机回填 | 待真机回填 | 待真机回填 | 待真机回填 | 待真机回填 | 待真机回填 | |
| 微信小程序 | ✅ build 通过（11 项断言全绿） | 待真机回填 | 待真机回填 | 待真机回填 | 待真机回填 | 待真机回填 | 待真机回填 | |
| Android（蒸汽） | 待验证 | 待真机回填 | 待真机回填 | 待真机回填 | 待真机回填 | 待真机回填 | 待真机回填 | |
| iOS | 待验证 | 待真机回填 | 待真机回填 | 待真机回填 | 待真机回填 | 待真机回填 | 待真机回填 | |
| 鸿蒙 | 待验证 | 待真机回填 | 待真机回填 | 待真机回填 | 待真机回填 | 待真机回填 | 待真机回填 | |

## 踩坑记录（全是实测）

1. **4.x 根构建在 uni-app 运行时不可用**：`easemob-websdk@4.24.3` 默认入口在 uni-app web 运行时报 `a2.onOpen is not a function`（环境嗅探走错分支）。4.x 必须用 `easemob-websdk/uniApp/Easemob-chat` 子路径构建（实测可登录可收发）；**5.x 根入口直接可用，优先 5.x**。
2. **5.x 与 4.x API 不兼容**：4.x 是 `new websdk.connection()` + `conn.open()` + `onTextMessage`；5.x 是 `ChatClient.init({appKey, managers:[ChatManager]})` + `client.login({userId, token})` + `onMessage`。消息类型枚举 4.x 用 `'txt'`，**5.x 用 `'text'`**（我们被这个坑过一次：按 'txt' 过滤导致收消息全丢）。消息 id 字段：5.x 是 `msgServerId`/`msgLocalId`（4.x 是 `id`）。
3. **vite 预构建缓存会钉死旧版 SDK**：4.x 升 5.x 后 dev server 仍用缓存的 4.x 包（报 `ChatClient undefined`）。删 `demo/unpackage/dist/cache/.vite` 并重启 dev server 解决。
4. **web 端编译要求项目根有 `index.html`**，且 `<script src>` 要指向实际入口（改成 main.uts 后要同步改）。
5. **App.vue 不能是空 SFC**：至少要有含实际内容的 `<script setup>` 或 `<template>`。
6. **App 端生命周期是全局函数**：`import { onLaunch } from '@dcloudio/uni-app'` 在 App 端编译目标下无此导出（web 构建有告警），直接全局调用 `onLaunch()`（uni-app x 编译器注入）。`App.vue` 里这次错误的 import 是 Android 黑屏（`pagesMap.get(...) is not a function`）的头号嫌疑——App 入口初始化抛错，页面注册表未能建立。
7. **Android 黑屏对齐项**（参照 github.com/myZhangDong/uniappX-demo 已跑通配方）：入口 `main.uts`+`App.uvue`、页面 `.uvue`、manifest `"vapor-render-target": "bytecode"`、`uni.scss` 占位文件。
8. **CLI dev server 不转换 .uts 入口**：`scripts/uni.sh dev web` 对 main.uts 原样输出导致白页；`build web` 正常。H5 验证一律用 `build web` + 静态伺服（如 `python3 -m http.server`）。dev 模式待排查（可能只有 HBuilderX GUI 的 dev 管线支持 .uts 入口）。
9. **登录 resolve ≠ 立即可发**：5.x login resolve 后立刻 sendMessage 遇到过一次 `WebSocket is not connected`，隔一会儿重发即成功。M1 设计发消息排队/连接就绪等待机制。
10. 4.x 的 websdk 内含 `eval`（构建告警）；5.x（5.1.2）已无 eval 告警，仅剩一条无害的 Rollup 注释位置告警。
11. **联系人自动同步需显式选择（enableSyncData，小程序空白根因）**：`ChatClient.init` 的 `enableSyncData` **SDK 默认仅 `['conversation']`**（源码 `normalizeSyncDataTypes(n.enableSyncData ?? ['conversation'])`），不显式传 `'contact'` 则登录后好友同步根本不启动、`onSyncDataFinished(dataType:'contact')` 永远不会触发，`getContacts()` 只能读到本地缓存残留——H5「有时能显示」是 localStorage 缓存的假象，小程序端即「永远空」。修复：`libs/client/index.ts` 显式传 `enableSyncData: ['conversation','contact']`（**不能含 `'group'`**：SDK 校验 group 同步依赖 GroupManager，未注册直接抛错，二期开群时再补；contact 同步依赖 UserInfoManager 的 userInfo:read 能力，已注册）。配套：消费 `payload.status`，`failed` 时不用不完整快照回填、只告警等下轮同步（对齐 vue 版 D124）。 roster 事件驱动 + 同步完成后重读快照的自愈机制（`emkit-contact-sync` handler）保留，作为快照兜底仍必要。

## 存储差异清单

| 端 | localStorage | uni.setStorage | 结论 |
|---|---|---|---|
| H5 | 可用（SDK 5.x 内部自适配） | 可用 | ✅ |
| 微信小程序 | 待验证 | 待验证 | 小程序发布需配置合法域名：`https://rs.chat.rtnsvc.com`、`https://rs.easemob.com`（request）、`wss://ngi-fusion.easemob.com`（socket） |
| App（uni-app x js 引擎） | 待验证 | 待验证 | |

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
