# EmKit 消息操作

## `EmKit.onMessage(handler)`

订阅新消息：

```ts
const off = EmKit.onMessage((message) => {
  console.log(message.conversationId, message.text)
})
onUnmounted(off)
```

返回取消函数。**必须在页面卸载时调用**，否则会重复回调/内存泄漏。

## `EmKit.onStreamMessage(handler)`

订阅 AI 流式消息的分片更新。分片已按会话合批写入 store，`message.stream` 携带最新全文与状态。返回取消函数。

## `EmKit.recallMessage(conversationId, chatType, messageId)`

撤回消息。默认窗口 2 分钟，超出后长按菜单不显示撤回项；窗口可通过 `recallTimeLimit` 配置。返回 `Promise<void>`。

## `EmKit.modifyTextMessage(conversationId, chatType, messageId, text)`

编辑已发送的文本消息，复用原消息 id，对方与其他设备经服务端事件同步更新。单条消息最多编辑 10 次，超限后再次调用会失败。仅文本消息可编辑，引用等扩展字段随编辑保留。返回 `Promise<void>`。

## `EmKit.pinMessage(...)` / `EmKit.unpinMessage(...)`

```ts
EmKit.pinMessage(conversationId, chatType, messageId)
EmKit.unpinMessage(conversationId, chatType, messageId)
```

置顶/取消置顶一条消息。成功后本地立即打标并重新拉取该会话置顶列表；远端成员的变更经服务端事件自动同步。返回 `Promise<void>`。

## `EmKit.getPinnedMessageList(conversationId, chatType)`

拉取会话置顶消息列表（服务端上限 20 条，按置顶时间倒序），写入 `messageStore.pinnedByConversationId`。进会话时自动拉取，宿主也可手动刷新。返回 `Promise<void>`。

## `EmKit.resendMessage(conversationId, chatType, localId)`

重发失败消息。按原消息类型重建；本地临时文件缺失时会抛错。返回 `Promise<void>`。domain 按 `conversationId + localId` 共享在途 Promise，重复调用得到同一实际结果，失败后可重新发起。

## `EmKit.deleteMessage(message)`

删除当前账号的单条消息。`message.id` 非空时先删除当前账号的服务端漫游历史，成功后再删除本地消息；为空时仅删除本地消息。漫游删除失败会保留本地消息并抛错。成功后按剩余消息校正会话摘要与时间，返回 `Promise<void>`。该操作不是撤回，不会删除接收方已经收到的消息。

## `EmKit.deleteLocalMessage(conversationId, localId)`

仅删除本地消息，不影响服务端，也不等待 SDK 就绪；只有实际命中并删除时才校正会话摘要与时间。返回 `void`。

## `EmKit.downloadAttachment(message, options?)`

下载一条图片/视频/文件消息的附件。App 与微信小程序：图片/视频写入系统相册，文件下载到本地后尝试调用系统文档预览打开；H5 交给浏览器下载。`options.onProgress` 仅在 App/小程序由 `uni.downloadFile` 提供（0–100），H5 不会回调。

返回 `Promise<EmMessageDownloadResult>`：`kind`、`fileName`、`filePath`、`savedToAlbum`、`opened`。相册权限被拒绝时抛 `DOWNLOAD_AUTH_DENIED`，消息没有可下载附件时抛 `DOWNLOAD_UNSUPPORTED`；文件打开失败不抛错，以 `opened=false` 返回。

## `EmKit.sendTyping(conversationId, chatType)`

发送“正在输入”信令（单聊）。UIKit 内部按 `typingThrottle` 节流；聊天页已自动接入。返回 `Promise<void>`。

## `EmKit.isReadReceiptEnabled()` / `EmKit.isGroupReadReceiptEnabled()`

分别返回单聊和群聊已读回执是否启用。单聊已读图标的显隐由独立的 `showReadStatus` 展示开关控制，默认关闭；发送中/失败状态不受影响。

## `EmKit.refreshGroupReadCounts(conversationId)`

批量补齐群消息已读人数：内部取该群最近 20 条己方已发送消息，调用 SDK 群回执批量查询并回填 `EmMessageItem.groupReadCount`。群已读回执未开启时直接返回；失败不抛出。返回 `Promise<void>`。

## `EmKit.clearConversationUnread(conversationId, chatType, force?)`

清空会话未读：本地立即归零，服务端异步清零。`force=true` 时忽略节流立即执行。返回 `void`。

## `EmKit.insertLocalNotice(...)` / `insertGroupNotice(...)`

```ts
EmKit.insertLocalNotice(conversationId, chatType, text)
EmKit.insertGroupNotice(groupId, text)
```

插入本地系统提示灰条，只落本地消息列表，不发送到服务端。`insertGroupNotice` 是群聊别名。返回 `void`。
