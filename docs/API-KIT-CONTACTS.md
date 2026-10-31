# EmKit 联系人

## `EmKit.syncContacts()`

调用当前 SDK 提供的 `refreshContactSnapshot` 受控刷新，再读取好友快照并回写 store，返回 `Promise<void>`。后台 `onSyncDataFinished(status='failed')` 会保留 `syncFailed`；重试真实发起受控刷新，若当前 SDK 不提供该能力则明确 reject，不以内存快照伪装成功。好友快照加载后，已是好友的历史 received pending 申请会收敛为 accepted 并同步未读角标。

## `EmKit.addContact(userId, message?)`

发起好友申请。返回 `Promise<void>`。

## `EmKit.deleteContact(userId)`

删除好友。返回 `Promise<void>`。

## `EmKit.setContactRemark(userId, remark)`

设置好友备注。返回 `Promise<void>`。

## `EmKit.acceptContactInvite(invite)` / `EmKit.declineContactInvite(invite)`

接受/拒绝好友申请，参数为 `EmContactInvite`（`kind='contact'`）。返回 `Promise<void>`。

## `EmKit.ensureUserInfos(userIds)`

批量确保用户昵称/头像已缓存（微任务合批）。返回 `void`。宿主渲染陌生用户前可调用。
