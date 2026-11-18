---
name: easemob-websdk-v5
description: Use when integrating easemob-websdk（环信 IM SDK）into any uni-app/uni-app x/web project, or debugging errors like "a2.onOpen is not a function"、收到消息不触发回调、登录后发送报 "WebSocket is not connected"、"Cannot read properties of undefined (reading 'init')".
---

# easemob-websdk 5.x 集成要点

## Overview

环信 websdk 5.x（ChatClient + Manager 注册制）与 4.x（websdk.connection）API 完全不兼容。uni-app 生态一律用 5.x 根入口：官方自带跨平台运行时适配（请求/WebSocket/存储），不要再分流子路径构建。

## 5.x 最小用法

```ts
import { ChatClient, ChatManager } from 'easemob-websdk'

const client = ChatClient.init({ appKey, managers: [ChatManager] })
client.addEventHandler('conn', { onConnected: ..., onDisconnected: ... })
client.addEventHandler('msg', { onMessage: (message) => ... })
await client.login({ userId, token })           // 注意是 { userId, token }
const msg = client.chatManager.createTextMessage({
  conversationId: peerId, conversationType: 'singleChat', content: text
})
await client.chatManager.sendMessage(msg)
```

## 4.x → 5.x 陷阱对照（都实测踩过）

| 4.x 习惯 | 5.x 现实 | 症状 |
|---|---|---|
| `type === 'txt'` | `type === 'text'` | 收消息回调全被过滤丢光 |
| `message.id` | `msgServerId` / `msgLocalId` | 消息 id undefined |
| 默认入口直接跑 uni-app | 4.x 根构建环境嗅探走错分支；须 `easemob-websdk/uniApp/Easemob-chat` | `a2.onOpen is not a function` |
| `conn.open({user, accessToken})` | `client.login({userId, token})` | — |
| `conn.close()` 无 Promise | `client.logout()` 返回 Promise | 4.x close().then 报 undefined.then |

## 工程陷阱

- **媒体消息 `data` 不收字符串路径**：`createImageMessage`/`createVoiceMessage`/`createVideoMessage`/`createFileMessage` 的 `data` 类型是 `CompatibleFile = File | MiniAppFile | ReactNativeFile`——H5 传 `File` 对象（`uni.chooseImage` H5 端的 `res.tempFiles` 就是 File[]），小程序/App 传 `MiniAppFile`（`{ path, name?, size? }`）。直接传路径字符串会被 zod 校验拒绝：`Validation failed: data: Invalid input`（code 110）。发送/重发所有媒体类型都要过这层转换
- **vite 预构建缓存钉死旧版 SDK**：升级 SDK 大版本后 dev server 仍用旧包（报 `ChatClient undefined`/`reading 'init'`）。删 `unpackage/dist/cache/.vite` 与 `node_modules/.vite` 后重启
- **HBuilderX 5.34 报 `Identifier "h" has already been declared`**：这是 HBuilderX 编译链与 SDK 压缩 chunk 的已知兼容问题。宿主工程根目录新增 `vite.config.ts`，在 `uni()` 插件中设置 `autoImportOptions: { ignore: ['h'] }`；已有配置时合并该选项，不要覆盖其他插件，也不要重打包或改写 `node_modules`。DCloud 已确认并回复将由 HBuilderX 后续修复，上下文见 https://issues.dcloud.net.cn/pages/issues/detail?id=34492
- **login resolve ≠ 立即可发**：login 返回后立刻 sendMessage 可能赶上 socket 未就绪（`WebSocket is not connected`），稍后重发即成功。封装层应做发送队列/连接就绪等待
- **默认 runtime 适配器会调 `uni.getNetworkType`**（5.1.3 实测）：`login → core 构造` 时 `registerNetworkListeners()` 走 `runtime.onNetworkChange`，里面同步调 `uni.onNetworkStatusChange` + `uni.getNetworkType`。uni-app x 的 iOS/Android **自定义基座**若没编入 `uni-getNetworkType` UTS 模块，这里会抛 `undefined class: UTSSDKModulesDCloudUniGetNetworkTypeIndexSwift` 并让 login reject（表现就是「登录失败」）。解法：`ChatClient.init({ platformAdapterOptions: { overrides } })` 覆盖 runtime，不提供可选的 `getNetworkType`、自管 `onNetworkChange`（见 skill `em-crossend-pitfalls` §5e）
- 5.x（5.1.2）已无 4.x 的 eval 告警

## 文档

初始化/集成以官方 5.x 文档为准：https://doc.easemob.com/document/web/integration.html 、initialization.html
