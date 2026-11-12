# EmKit 初始化与生命周期

```ts
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'
```

除 `init`、`whenReady`、同步 getter 与本地方法外，所有异步方法都会先等待 SDK 就绪（`await whenReady()`），宿主不需要自己判断 SDK 是否加载完成。

## `EmKit.init(config)`

初始化 SDK、应用全局配置。每个应用进程只生效一次。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `config.appkey` | `string` | 是 | 环信 AppKey |
| `config.sdkInitOptions` | `EmSdkInitOptions` | 否 | WebSDK 全部非身份类原生初始化选项；普通字段优先于 UIKit 默认值，Manager、同步类型和平台适配器按配置参考中的规则合并 |
| `config.onTokenWillExpire` | `() => string \| Promise<string>` | 否 | Token 约 80% 生命周期时触发，返回新 token 后 UIKit 自动续期 |
| `config.onTokenExpired` | `() => void` | 否 | Token 已过期、SDK 已断开时触发；UIKit 同时把状态置为 `closed` |
| `config.enableDeviceInfo` | `boolean` | 否 | 设备信息注入总开关，默认 `true` |
| `config.deviceId` | `string` | 否 | 显式指定设备标识；不传则自动派生并持久化 |
| `config.devicePlatform` | `number` | 否 | 自定义平台编号，需为已申请的 1–100 整数 |
| 其他字段 | — | 否 | 见[配置参考](./CONFIG.md) |

返回 `void`。初始化是幂等的：重复调用不会重复创建客户端。

## `EmKit.whenReady()`

等待 SDK 模块加载与 `ChatClient.init` 完成：

```ts
await EmKit.whenReady()
```

返回 `Promise<ChatClient>`。未 `init()` 时 reject；小程序分包场景下可用于渲染“加载消息服务…”占位态。它只表示 SDK 初始化完成，不代表已登录或连接在线。

## `EmKit.getSDKClient()`

获取 UIKit 内部复用的原生 `ChatClient`，返回 `Promise<ChatClient>`。未 `init()` 时 reject，不要再次调用 `ChatClient.init()` 创建第二个实例。

```ts
import { onUnmounted } from 'vue'

const client = await EmKit.getSDKClient()
client.chatManager.addEventHandler('host-message', {
  onMessage(message) {
    console.log('收到消息', message)
  }
})

onUnmounted(() => {
  client.chatManager.removeEventHandler('host-message')
})
```

普通消息发送、接收与状态管理优先使用 `EmKit.sendText()` / `EmKit.onMessage()`；直接调用底层发送会绕过 UIKit 的本地消息列表、发送状态和失败重试链路。

## `EmKit.renewToken(token)`

手动续期。`token` 为宿主服务端签发的新 token，返回 `Promise<EmTokenRenewalResult>`：`{ token, expireAt }`。

## `EmKit.login(options)`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `options.userId` | `string` | 是 | 环信用户 ID，请勿使用大写英文字母 `A-Z`；包含大写英文字母时，UIKit 会打印警告并强制转为小写 |
| `options.token` | `string` | 是 | 服务端签发的用户 token |

返回 `Promise<void>`。登录成功后 UIKit 会拉取自己的资料、好友快照与群快照。发生大写转换时，SDK 登录、连接状态与本人资料拉取统一使用转换后的用户 ID；纯小写及其他不含大写英文字母的输入保持原值。

## `EmKit.logout()`

退出登录并清空账号私有状态（会话、消息、联系人、群、草稿、邀请、用户资料缓存）。返回 `Promise<void>`。`logout()` 后直接重新 `login()`，不要再次 `init()`。

## `EmKit.setLocale(locale)` / `EmKit.getLocale()`

切换/读取界面语言。内置 `zh-CN` / `en`，也可先通过 `mergeMessages` 注册其他 `EmLocaleName`。`setLocale` 会持久化并立即生效，详见[主题与国际化](./THEME-I18N.md)。

## 完整调用示例

```ts
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'

async function start(userId: string, token: string) {
  await EmKit.login({ userId, token })
  await EmKit.syncConversations()

  const off = EmKit.onMessage((message) => {
    console.log('new message', message.localId)
  })

  const groupId = await EmKit.createGroup({ name: '客服群', members: [] })
  await EmKit.sendText(groupId, 'groupChat', '欢迎咨询')
  EmKit.insertLocalNotice(groupId, 'groupChat', '客服已接入')

  off()
}
```
