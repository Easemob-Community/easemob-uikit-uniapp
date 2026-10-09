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

- **vite 预构建缓存钉死旧版 SDK**：升级 SDK 大版本后 dev server 仍用旧包（报 `ChatClient undefined`/`reading 'init'`）。删 `unpackage/dist/cache/.vite` 与 `node_modules/.vite` 后重启
- **login resolve ≠ 立即可发**：login 返回后立刻 sendMessage 可能赶上 socket 未就绪（`WebSocket is not connected`），稍后重发即成功。封装层应做发送队列/连接就绪等待
- 5.x（5.1.2）已无 4.x 的 eval 告警

## 文档

初始化/集成以官方 5.x 文档为准：https://doc.easemob.com/document/web/integration.html 、initialization.html
