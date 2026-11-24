# EmKit 群组

## `EmKit.getJoinedGroups()`

读取 SDK 已加入群快照并回写 store，返回 `Promise<EmGroup[]>`。`loaded` 只在后台群同步成功或已有权威状态时成立，内存重读本身不会制造权威空列表。当前 SDK 没有已加入群全量手动重启同步 API；后台同步失败后调用会明确 reject，需恢复连接或重新登录让 SDK 重新执行后台同步，已有缓存不会因此清空。

## `EmKit.enterGroup(groupId)`

进群预热：拉群详情 + 成员首屏，失败静默。返回 `Promise<void>`。

## `EmKit.getGroupInfo(groupId, force?)`

返回 `Promise<EmGroup>`。`force` 默认 `false`，普通调用复用在途请求；`force=true` 强制发起新读取。群详情按 groupId 只接收最新响应，旧请求不会覆盖新资料或清理新请求的 pending；移除成员后的权威刷新使用强制读取。

## `EmKit.getGroupMemberList(groupId, cursor?, pageSize?)`

游标分页拉群成员。返回 `Promise<EmGroupMemberListResult>`，默认每页 20（`GROUP_MEMBER_PAGE_SIZE`）。当前请求成功且已写入 store 时 resolve `applied=true`；陈旧成功 resolve `applied=false`；陈旧失败 reject 结构化 `EmGroupMemberListResult`（`applied=false`）；当前真实失败 reject 原始错误。调用方在 resolve 和 catch 中都不得消费 `applied=false` 的分页载荷，尤其不得把空载荷当作成功空页。

## `EmKit.getGroupAnnouncement(groupId)`

返回 `Promise<string>`。

## `EmKit.createGroup(params)`

创建群组，返回 `Promise<string>`（新群 groupId）。`params` 见[联系人与群组类型](./API-TYPES-CONTACTS-GROUPS.md#creategroupparams)。创建成功本身不会生成空会话；产生真实消息后由 SDK 同步进入会话列表。

```ts
const groupId = await EmKit.createGroup({
  name: '项目讨论',
  members: ['user-b', 'user-c'],
  public: false,
  allowInvites: true
})
```

## `EmKit.inviteUsersToGroup(groupId, userIds)`

邀请用户入群。返回 `Promise<void>`。

## `EmKit.acceptGroupInvite(invite)` / `EmKit.declineGroupInvite(invite)`

接受/拒绝群邀请，参数为 `EmContactInvite`（`kind='group'`）。返回 `Promise<void>`。接受成功并更新申请状态后，群快照刷新为独立 best-effort 操作；后续群同步不可用或失败不会把已接受的申请翻成失败。

## `EmKit.leaveGroup(groupId)` / `EmKit.destroyGroup(groupId)`

退群/解散群（仅群主）。返回 `Promise<void>`。

## `EmKit.changeGroupOwner(groupId, userId)`

转让群主。返回 `Promise<void>`。

## `EmKit.updateGroupInfo(groupId, partial)`

更新群名称/描述/头像：

```ts
await EmKit.updateGroupInfo(groupId, { name: '新群名' })
```

返回 `Promise<void>`。

## `EmKit.updateGroupAnnouncement(groupId, content)`

更新群公告，最大 512 字（`GROUP_ANNOUNCEMENT_MAX_LENGTH`）。返回 `Promise<void>`。

## `EmKit.removeGroupMembers(groupId, userIds)`

批量移除群成员（群主/管理员）。返回 `Promise<void>`。

## `EmKit.addGroupAdmin(groupId, userId)` / `EmKit.removeGroupAdmin(groupId, userId)`

设置/撤销管理员（群主）。返回 `Promise<void>`。

## `EmKit.muteAllGroupMembers(groupId)` / `EmKit.unmuteAllGroupMembers(groupId)`

开启/关闭全员禁言。返回 `Promise<void>`。群主/管理员不受禁言限制。
