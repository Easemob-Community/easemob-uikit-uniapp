# EmKit API

`EmKit` 是 UIKit 对宿主的唯一命令入口，从 `@/uni_modules/easemob-uikit-uni/libs` 导入：

```ts
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'
```

除 `init`、`whenReady`、同步 getter 与本地方法外，所有异步方法都会先等待 SDK 就绪（`await whenReady()`），宿主不需要自己判断 SDK 是否加载完成。

## 1. 状态与只读 store

### `EmKit.state`

连接与登录状态，响应式对象：

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | `'idle' \| 'connecting' \| 'reconnecting' \| 'online' \| 'closed'` | 当前连接状态；`reconnecting` 表示已登录后的自动重连中 |
| `appkey` | `string` | 初始化时的 appkey |
| `userId` | `string` | 当前登录用户；空串表示未登录 |
| `reason` | `string` | 最近一次连接事件原因（SDK 原值，如 `login` / `reconnect` / `offline` / `token-expired` / `limit`） |
| `errorCode` | `number` | 最近一次断开/重连失败错误码，0 表示无 |
| `reconnecting` | `boolean` | 是否处于自动重连 |
| `reconnectAttempt` | `number` | 当前重连尝试次数 |

判断是否登录请用 `EmKit.state.userId === ''`，不要用 `status !== 'online'`：断网重连时 `status` 会短暂离开 `online`，但用户并没有退出登录。

### 只读数据 store

| 属性 | 类型 | 说明 |
|---|---|---|
| `EmKit.conversations` | `EmConversationStore` | 会话列表、同步状态、按会话缓存的未读等 |
| `EmKit.messages` | `EmMessageStore` | 按会话分组的消息、历史游标、加载状态 |
| `EmKit.users` | `EmUserStore` | 用户昵称/头像缓存 |
| `EmKit.contacts` | `EmContactStore` | 好友、好友申请/群邀请、同步状态 |
| `EmKit.groups` | `EmGroupStore` | 已加入群、群资料、成员、公告缓存 |

这些 store 是 `reactive` 模块级单例，组件 computed 会随 SDK 事件自动更新。宿主可以做只读渲染，写操作请走 `EmKit` 方法，避免绕过业务域。

### 未读 getter

| API | 返回 | 说明 |
|---|---|---|
| `EmKit.conversationUnreadCount` | `number` | 所有会话未读之和（含免打扰），非响应式快照 |
| `EmKit.contactRequestUnreadCount` | `number` | 收到的、仍 pending 的好友申请/群邀请数，非响应式快照 |
| `EmKit.conversationUnreadCountOf(conversationId)` | `number` | 单会话未读快照 |

需要响应式数值时使用 `useUnreadCounts()` / `useConversationUnreadCount(id)` / `useTabBarBadge()`，见 [主题与国际化](./THEME-I18N.md) 之外的未读章节与 [页面指南](./PAGES-CONVERSATION.md)。

## 2. 初始化与生命周期

### `EmKit.init(config)`

初始化 SDK、应用全局配置。每个应用进程只生效一次。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `config.appkey` | `string` | 是 | 环信 AppKey |
| `config.onTokenWillExpire` | `() => string \| Promise<string>` | 否 | Token 约 80% 生命周期时触发，返回新 token 后 UIKit 自动续期 |
| `config.onTokenExpired` | `() => void` | 否 | Token 已过期、SDK 已断开时触发；UIKit 同时把状态置为 `closed` |
| 其他字段 | — | 否 | 见 [配置参考](./CONFIG.md) |

返回 `void`。初始化是幂等的：重复调用不会重复创建客户端。

### `EmKit.whenReady()`

等待 SDK 模块加载与 `ChatClient.init` 完成。

```ts
await EmKit.whenReady()
```

返回 `Promise<unknown>`。未 `init()` 时 reject；小程序分包场景下可用于渲染“加载消息服务…”占位态。

### `EmKit.renewToken(token)`

手动续期。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `token` | `string` | 是 | 宿主服务端签发的新 token |

返回 `Promise<EmTokenRenewalResult>`：`{ token, expireAt }`。

### `EmKit.login(options)`

登录环信。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `options.userId` | `string` | 是 | 环信用户 ID |
| `options.token` | `string` | 是 | 服务端签发的用户 token |

返回 `Promise<void>`。登录成功后 UIKit 会拉取自己的资料、好友快照与群快照。

### `EmKit.logout()`

退出登录并清空账号私有状态（会话、消息、联系人、群、草稿、邀请、用户资料缓存）。

返回 `Promise<void>`。`logout()` 后直接重新 `login()`，不要再次 `init()`。

### `EmKit.setLocale(locale)` / `EmKit.getLocale()`

切换/读取界面语言，`locale` 为 `'zh-CN' | 'en'`。`setLocale` 会持久化并立即生效，详见 [主题与国际化](./THEME-I18N.md)。

## 3. 发送消息

### `EmKit.sendText(to, chatType, text, quote?, mentions?, ext?)`

发送文本消息。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `to` | `string` | 是 | 单聊为对方 userId，群聊为 groupId |
| `chatType` | `'singleChat' \| 'groupChat'` | 是 | 会话类型 |
| `text` | `string` | 是 | 文本内容 |
| `quote` | `EmQuoteInfo` | 否 | 引用信息，通常由 `makeQuote` 生成 |
| `mentions` | `string[]` | 否 | 被 @ 的 userId 列表；仅群聊有意义 |
| `ext` | `Record<string, unknown>` | 否 | 业务上下文载荷，与 UIKit 内部 key 合并 |

返回 `Promise<EmMessageItem>`。UIKit 内部 key（引用、@ 提及）优先，业务 ext 不要占用 `msgQuote` / `emQuote` / `em_at_list`。

### `EmKit.makeQuote(item)`

从一条消息生成引用快照，返回 `EmQuoteInfo`。

```ts
const quote = EmKit.makeQuote(message)
await EmKit.sendText('user-b', 'singleChat', '收到', quote)
```

### `EmKit.sendCustom(to, chatType, event, params?, ext?)`

发送自定义消息，是业务卡片/结构化消息的统一通道。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `to` | `string` | 是 | 单聊 userId / 群聊 groupId |
| `chatType` | `'singleChat' \| 'groupChat'` | 是 | 会话类型 |
| `event` | `string` | 是 | 业务事件名，接收侧用 `message.customEvent` 分发 |
| `params` | `Record<string, string>` | 否 | 字符串参数 |
| `ext` | `Record<string, unknown>` | 否 | 结构化业务载荷 |

返回 `Promise<EmMessageItem>`。接收侧在 `#custom-message` 插槽中按 `customEvent` 渲染，UIKit 不内置卡片样式。详见 [消息与扩展协议](./MESSAGING.md)。

### `EmKit.sendImage(to, chatType, image)` / `sendAudio(to, chatType, filePath, duration)` / `sendVideo(to, chatType, video)` / `sendFile(to, chatType, file)`

发送媒体消息。媒体对象一般来自 `chooseImage` / `chooseVideo` / `chooseFile` 或 `em-chat-inputbar` 的媒体选择事件。

```ts
import { chooseImage, EmKit } from '@/uni_modules/easemob-uikit-uni/libs'

const images = await chooseImage(1, 'album')
await EmKit.sendImage('user-b', 'singleChat', images[0])
```

返回 `Promise<EmMessageItem>`。平台能力不同：语音录制仅 App/小程序，内置文件选择仅小程序/H5；App 端可注入宿主文件选择能力（见下节），详见 [平台能力与差异](./PLATFORM.md)。

### `EmKit.setAttachmentProvider(provider)` / `pickAttachments(options)` / `resolveAttachment(uri, options?)`

App 端没有跨端通用的系统文件选择器。UIKit 不静态依赖任何 UTS 插件，而是由宿主注册一个附件 provider：用户点输入栏「文件」时，UIKit 用 `pick()` 通知宿主选择文件，宿主返回已复制到本地的附件路径；发送、失败重发和临时文件清理仍由 UIKit 统一处理。

```ts
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'
import { chooseFile, prepareFile, removeTempFile } from '@/uni_modules/easemob-file-picker'

EmKit.setAttachmentProvider({
  pick: async (ctx) => {
    const res = await new Promise((resolve, reject) => {
      chooseFile({
        multiple: ctx.multiple ?? true,
        mimeTypes: ctx.mimeTypes,
        success: resolve,
        fail: reject
      })
    })
    if (res.cancelled) return []            // 用户取消：返回空数组，不弹错误
    const attachments = []
    for (const file of res.files) {
      const prepared = await new Promise((resolve, reject) => {
        prepareFile({ uri: file.uri, success: resolve, fail: reject })
      })
      if (prepared.path == null) continue
      attachments.push({
        path: prepared.path,
        name: prepared.name,
        size: prepared.size,
        mimeType: prepared.mimeType,
        temporary: true,
        release: (path) => removeTempFile({ path })
      })
    }
    return attachments
  }
})
```

- 注册后输入栏「文件」格自动出现；`setAttachmentProvider(null)` 注销。H5/小程序不需要注册，继续使用内置选择器。
- `pick` 的 `ctx` 带 `conversationId` / `chatType` / `mimeTypes` / `multiple`，宿主可据此做业务 UI。
- `temporary: true` + `release(path)`：UIKit 在发送成功、重发成功、删除消息或登出时调用，失败消息保留文件供重发。同一路径最多调用一次。
- `resolve(uri, ctx)`（可选）：把分享进入/open-with 等外部 URI 转换为可发送附件；也可直接调用 `EmKit.resolveAttachment(uri)`。
- App 端附件发送不依赖 SDK 的 md5 预检：宿主返回的路径即使位于系统缓存目录（不在 uni 文件系统可读范围内），UIKit 也会自动降级为「不携带 md5」继续上传，不会阻断发送。建议仍把临时副本放在 `uni.env.CACHE_PATH` 等 uni 目录内，便于后续读写。
- `pickAttachments(options)` 与 `resolveAttachment(uri, options?)` 是低层入口，供宿主自定义附件面板或分享前置流程使用；聊天页内置流程不需要手动调用。
- `EmKit.attachments` 返回 `{ available, providerName }` 快照；`EmKit.canPickAttachment` 返回当前是否可选择文件。`provider.isAvailable()` 依赖登录态时，变化后调用 `EmKit.refreshAttachmentAvailability()` 刷新入口显隐。
- 完整宿主适配示例见 demo 的 `demo/common/attachment-provider.uts`。

## 4. 消息操作

### `EmKit.onMessage(handler)`

订阅新消息。

```ts
const off = EmKit.onMessage((message) => {
  console.log(message.conversationId, message.text)
})
onUnmounted(off)
```

返回取消函数。**必须在页面卸载时调用**，否则会重复回调/内存泄漏。

### `EmKit.onStreamMessage(handler)`

订阅 AI 流式消息的分片更新。分片已按会话合批写入 store，`message.stream` 携带最新全文与状态。返回取消函数。

### `EmKit.recallMessage(conversationId, chatType, messageId)`

撤回消息。默认窗口 2 分钟，超出后长按菜单不显示撤回项；窗口可通过 `recallTimeLimit` 配置。返回 `Promise<void>`。

### `EmKit.resendMessage(conversationId, chatType, localId)`

重发失败消息。按原消息类型重建（文本/图片/语音/视频/文件/自定义）；本地临时文件缺失时会抛错。返回 `Promise<void>`。

### `EmKit.deleteMessage(message)`

删除单条消息。`message.id` 非空时先删除服务端漫游消息，成功后再删除本地消息；`message.id` 为空时仅删除本地消息，不调用 SDK。漫游删除失败会保留本地消息并抛错。删除成功后按剩余消息校正会话摘要与时间，返回 `Promise<void>`。

### `EmKit.deleteLocalMessage(conversationId, localId)`

仅删除本地消息，不影响服务端，也不等待 SDK 就绪；删除后同样校正会话摘要与时间。返回 `void`。

### `EmKit.sendTyping(conversationId, chatType)`

发送“正在输入”信令（单聊）。UIKit 内部按 `typingThrottle` 节流；聊天页已自动接入。返回 `Promise<void>`。

### `EmKit.isReadReceiptEnabled()`

返回当前是否启用单聊已读回执（由 `enableReadReceipt` 配置决定）。

### `EmKit.clearConversationUnread(conversationId, chatType, force?)`

清空会话未读：本地立即归零，服务端异步清零。`force=true` 时忽略节流立即执行。返回 `void`。宿主自建消息入口时可用它兜底。

### `EmKit.insertLocalNotice(conversationId, chatType, text)` / `insertGroupNotice(groupId, text)`

插入本地系统提示灰条，只落本地消息列表，不发送到服务端。`insertGroupNotice` 是群聊别名。返回 `void`。

## 5. 会话

### `EmKit.syncConversations()`

拉取会话快照并回写 store。返回 `Promise<void>`。

### `EmKit.enterConversation(conversationId, chatType)`

进入会话：拉取会话信息、清未读等。返回 `Promise<void>`。宿主在 `navigateTo` 前可 fire-and-forget 预热。

### `EmKit.loadHistory(conversationId, chatType, pageSize?)`

加载更早历史。返回 `Promise<void>`。聊天页进入时会自动调用；宿主自绘消息列表时使用。

### `EmKit.pinConversation(conversationId, chatType, pinned)`

置顶/取消置顶。返回 `Promise<void>`。

### `EmKit.setConversationMuted(conversationId, chatType, muted)`

会话免打扰开关，乐观更新、失败回滚。返回 `Promise<void>`。

### `EmKit.deleteConversation(conversationId, chatType)`

删除会话。返回 `Promise<void>`。

### `EmKit.clearConversationMessages(conversationId, chatType)`

清空会话消息（本地缓存、历史游标、会话摘要一并复位）。返回 `Promise<void>`。

### `EmKit.addConversation(conversationId, chatType)`

在本地会话列表构造一条会话，用于“发起会话”入口，不调用服务端建会话 API。返回 `void`。

### `EmKit.leaveConversation()`

离开当前会话（清 typing 计时器等）。返回 `void`。聊天页卸载时内部调用。

## 6. 联系人

### `EmKit.syncContacts()`

拉取好友快照。返回 `Promise<void>`。

### `EmKit.addContact(userId, message?)`

发起好友申请。返回 `Promise<void>`。

### `EmKit.deleteContact(userId)`

删除好友。返回 `Promise<void>`。

### `EmKit.setContactRemark(userId, remark)`

设置好友备注。返回 `Promise<void>`。

### `EmKit.acceptContactInvite(invite)` / `EmKit.declineContactInvite(invite)`

接受/拒绝好友申请，参数为 `EmContactInvite`（`kind='contact'`）。返回 `Promise<void>`。

### `EmKit.ensureUserInfos(userIds)`

批量确保用户昵称/头像已缓存（微任务合批）。返回 `void`。宿主渲染陌生用户前可调用。

## 7. 群组

### `EmKit.getJoinedGroups()`

拉取已加入群快照。返回 `Promise<EmGroup[]>`。

### `EmKit.enterGroup(groupId)`

进群预热：拉群详情 + 成员首屏，失败静默。返回 `Promise<void>`。

### `EmKit.getGroupInfo(groupId)`

返回 `Promise<EmGroup>`。

### `EmKit.getGroupMemberList(groupId, cursor?, pageSize?)`

游标分页拉群成员。返回 `Promise<{ items: EmGroupMember[], cursor: string, hasMore: boolean }>`。默认每页 20（`GROUP_MEMBER_PAGE_SIZE`）。

### `EmKit.getGroupAnnouncement(groupId)`

返回 `Promise<string>`。

### `EmKit.createGroup(params)`

创建群组，返回 `Promise<string>`（新群 groupId）。`params` 见 [类型与常量](./API-TYPES.md) 的 `CreateGroupParams`。

```ts
const groupId = await EmKit.createGroup({
  name: '项目讨论',
  members: ['user-b', 'user-c'],
  public: false,
  allowInvites: true
})
EmKit.addConversation(groupId, 'groupChat')
```

### `EmKit.inviteUsersToGroup(groupId, userIds)`

邀请用户入群。返回 `Promise<void>`。

### `EmKit.acceptGroupInvite(invite)` / `EmKit.declineGroupInvite(invite)`

接受/拒绝群邀请，参数为 `EmContactInvite`（`kind='group'`）。返回 `Promise<void>`。

### `EmKit.leaveGroup(groupId)` / `EmKit.destroyGroup(groupId)`

退群 / 解散群（仅群主）。返回 `Promise<void>`。

### `EmKit.changeGroupOwner(groupId, userId)`

转让群主。返回 `Promise<void>`。

### `EmKit.updateGroupInfo(groupId, partial)`

更新群名称/描述/头像：

```ts
await EmKit.updateGroupInfo(groupId, { name: '新群名' })
```

返回 `Promise<void>`。

### `EmKit.updateGroupAnnouncement(groupId, content)`

更新群公告，最大 512 字（`GROUP_ANNOUNCEMENT_MAX_LENGTH`）。返回 `Promise<void>`。

### `EmKit.removeGroupMembers(groupId, userIds)`

批量移除群成员（群主/管理员）。返回 `Promise<void>`。

### `EmKit.addGroupAdmin(groupId, userId)` / `EmKit.removeGroupAdmin(groupId, userId)`

设置/撤销管理员（群主）。返回 `Promise<void>`。

### `EmKit.muteAllGroupMembers(groupId)` / `EmKit.unmuteAllGroupMembers(groupId)`

开启/关闭全员禁言。返回 `Promise<void>`。群主/管理员不受禁言限制。

## 8. 日志与调试

### `EmKit.exportLogs()`

导出内存环形缓冲中的日志全文。

- H5：触发浏览器下载，返回 `'download'`。
- 小程序/App：写入应用沙盒的用户数据目录（`uni.env.USER_DATA_PATH`）并返回文件路径，同时尽力复制全文到剪贴板；写文件失败时返回 `'clipboard'`。

小程序与 App 的沙盒目录不对用户可见，文件管理器里找不到，返回的路径用于分享或上传，不是系统「下载目录」。要在真机上取出日志，直接用剪贴板粘贴，或宿主自行把该文件分享/上传出去。App 端写文件依赖 `uni.getFileSystemManager`；走自定义基座且该模块未编入时会写失败并回退剪贴板。

返回 `Promise<string>`。

### `EmKit.getLogText()` / `EmKit.clearLogs()`

读取/清空日志缓冲。返回 `string` / `void`。日志包含 `[emkit:<ns>]` 前缀，可按命名空间过滤。

日志级别通过 `EmKitConfig.logLevel` 或 `setLogLevel()` 控制；`logPayload` 默认关闭，打开后会记录 SDK 原始 payload，生产环境慎用。详见 [配置参考](./CONFIG.md)。

## 9. 其他公开导出

除 `EmKit` 外，门面还导出组合式能力、只读 store、平台函数与纯工具函数。宿主可以按需导入，不需要直接访问 `libs/` 内部模块。

### 主题、语言与配置

| 导出 | 说明 |
|---|---|
| `useTheme()` | 返回 `{ themeClass, isDark, themeStore, setTheme, getTheme }` |
| `initTheme({ mode?, tabBarPages? })` / `setTheme(mode)` / `getTheme()` / `syncNativeThemeUI(options?)` | 主题初始化、切换与原生 chrome 同步 |
| `useLocale()` / `initLocale()` / `setLocale(locale, persist?)` / `getLocale()` / `mergeMessages(locale, table)` | 文案读取、语言切换与文案注入 |
| `useConfig()` / `setConfig(partial)` | 读取/运行时修改 `uiConfig` |
| `themeStore` / `useNamespace()` | 主题响应式状态与 BEM 命名工具 |

### 未读与 tabBar

| 导出 | 说明 |
|---|---|
| `useUnreadCounts()` / `getUnreadCounts()` | 会话总未读 + 联系人请求未读（响应式/快照） |
| `useConversationUnreadCount(conversationId)` | 单会话未读（响应式） |
| `useTabBarBadge(options)` / `syncTabBarBadges(options)` | 原生 tabBar 角标（组合式/一次性） |

### 只读数据与展示工具

| 导出 | 说明 |
|---|---|
| `userStore` / `displayNameOf()` / `avatarOf()` / `mergeUserInfo()` | 用户资料缓存与展示回落链 |
| `contactStore` / `contactDisplayNameOf()` / `pendingInviteCount()` / `contactRequestUnreadCount` | 好友与申请数据 |
| `conversationStore` / `totalConversationUnread` / `conversationUnreadCountOf()` | 会话数据 |
| `groupStore` / `groupDisplayNameOf()` / `groupMemberDisplayNameOf()` / `sortGroupMembers()` | 群与成员数据 |
| `ensureUserInfos(userIds)` | 批量预取用户资料 |
| `setPinyinAdapter()` / `groupContacts()` / `matchContact()` / `resolveAlphabetKeyByOffsetY()` | 字母分组与拼音适配 |
| `filterActiveMentions()` / `parseMentions()` | @ 提及过滤与解析 |
| `isStreamActive()` / `isStreamTerminal()` / `isPlainTextStream()` / `isRichStream()` | 流式状态判定 |

### 平台能力

| 导出 | 说明 |
|---|---|
| `PLATFORM_CAPABILITIES` / `isPageVisible()` | 平台能力快照与页面可见性 |
| `chooseImage()` / `previewImage()` / `chooseVideo()` / `chooseFile()` | 媒体选择与预览（`chooseFile` 为内置实现，App 端走 provider） |
| `getCameraAuthorizeState()` / `openAppAuthorizeSetting()` | iOS 相机系统授权状态（其它端返回 `unknown`）与跳转系统授权设置页，用于拍摄前预检，见 [平台与权限](./PLATFORM.md#权限) |
| `setAttachmentProvider()` / `refreshAttachmentAvailability()` / `hasAttachmentProvider()` / `canPickAttachment()` / `attachmentCapability()` / `pickAttachments()` / `resolveAttachment()` | App 端附件能力注入与低层选择入口 |
| `startRecord()` / `stopRecord()` / `isRecording()` / `playAudio()` / `stopAudio()` | 录音与音频播放 |
| `setStorage()` / `getStorage()` | 本地存储封装（App 端不走 localStorage） |
| `copyText(text)` | 写入系统剪贴板，返回 `Promise<void>`；空文本与原生失败会 reject，原生提示已关闭，由调用方统一反馈 |

### 日志与 SDK 加载

| 导出 | 说明 |
|---|---|
| `createLogger(ns)` / `setLogLevel(level)` / `getLogLevel()` / `getLogText()` / `clearLogBuffer()` / `getLogBufferSize()` / `logPayload()` | 内置日志服务 |
| `ensureSdkModule()` / `setSdkLoader()` / `setSdkModule()` | 小程序 SDK 加载注入口（一般由 `EmKitConfig` 使用） |
| `useSafeArea()` / `getSafeAreaTop()` / `getSafeAreaBottom()` / `nextZIndex()` | 安全区与弹层层级工具 |

类型统一从 `@/uni_modules/easemob-uikit-uni/libs` 导入，完整清单见 [类型与常量](./API-TYPES.md)。

## 10. 完整调用示例

```ts
import { EmKit } from '@/uni_modules/easemob-uikit-uni/libs'

async function start(userId: string, token: string) {
  await EmKit.login({ userId, token })
  await EmKit.syncConversations()

  const off = EmKit.onMessage((message) => {
    // 只做业务副作用；列表渲染由 store 响应式完成
    console.log('new message', message.localId)
  })

  const groupId = await EmKit.createGroup({ name: '客服群', members: [] })
  await EmKit.sendText(groupId, 'groupChat', '欢迎咨询')
  EmKit.insertLocalNotice(groupId, 'groupChat', '客服已接入')

  // 页面卸载时
  off()
}
```
