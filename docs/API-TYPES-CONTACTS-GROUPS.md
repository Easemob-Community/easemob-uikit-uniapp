# 用户、联系人与群组类型

## `EmUserInfo`

| 字段 | 类型 | 说明 |
|---|---|---|
| `userId` | `string` | 用户 ID |
| `nickname` | `string` | 昵称 |
| `avatarUrl` | `string` | 头像 URL |

## `EmUserPresentation` / `EmConversationPresentation` / `EmGroupPresentation`

宿主业务展示资料注入的 patch 类型，注入值优先于 SDK 资料参与回落链。

| 类型 | 字段 | 说明 |
|---|---|---|
| `EmUserPresentation` | `nickname?: string`、`avatarUrl?: string` | 用户昵称/头像注入 |
| `EmConversationPresentation` | `name?: string`、`avatar?: string`、`ext?: Record<string, unknown>` | 会话名/头像与业务载荷注入 |
| `EmGroupPresentation` | `name?: string`、`avatar?: string`、`ext?: Record<string, unknown>` | 群名/群头像与业务载荷注入 |

三个 API 的 `patch` 均支持传 `null` 表示清除该对象全部注入。

## `EmContactItem`

| 字段 | 类型 | 说明 |
|---|---|---|
| `userId` | `string` | 好友 userId |
| `remark` | `string` | 备注，空串表示未设置 |
| `nickname` | `string` | 昵称快照 |
| `avatarUrl` | `string` | 头像 |
| `addTs` | `number` | 好友关系建立时间 |

## `EmContactInvite`

好友申请与群邀请共用：

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | 本地生成 ID，幂等合并用 |
| `kind` | `'contact' \| 'group'` | 申请类型 |
| `from` | `string` | 申请发起方 userId |
| `message` | `string` | 附言 |
| `status` | `'pending' \| 'accepted' \| 'declined'` | 处理状态 |
| `outgoing` | `boolean` | 是否我方发出后被处理的通知 |
| `ts` | `number` | 时间戳 |
| `groupId` | `string` | 群邀请的群 ID |
| `groupName` | `string` | 群名快照 |

## `EmContactNavEntry`

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | `string` | 入口 key，见 `CONTACT_ENTRY_KEY` |
| `label` | `string` | 展示标题 |
| `count` | `number` | 计数，>0 才展示 |
| `hot` | `boolean` | 红点（仅 count>0 生效） |
| `icon` | `string` | 可选图标名 |

## `EmGroup`

| 字段 | 类型 | 说明 |
|---|---|---|
| `groupId` | `string` | 群 ID |
| `name` | `string` | 群名称 |
| `description` | `string` | 群描述 |
| `owner` | `string` | 群主 userId |
| `memberCount` | `number` | 成员数 |
| `maxUsers` | `number` | 人数上限 |
| `avatar` | `string` | 群头像（可选） |
| `public` | `boolean` | 是否公开群 |
| `approval` | `boolean` | 入群是否需要审批 |
| `allowInvites` | `boolean` | 是否允许成员邀请 |
| `inviteNeedConfirm` | `boolean` | 邀请是否需要确认 |
| `mute` | `boolean` | 是否全员禁言 |
| `disabled` | `boolean` | 群是否被禁用 |

## `EmGroupMember`

| 字段 | 类型 | 说明 |
|---|---|---|
| `userId` | `string` | 成员 userId |
| `role` | `'owner' \| 'admin' \| 'member'` | 角色 |
| `joinedAt` | `number` | 入群时间戳，缺失为 0 |
| `nick` | `string` | 群昵称（可选） |
| `avatar` | `string` | 头像（可选） |

## `EmGroupMemberListResult`

| 字段 | 类型 | 说明 |
|---|---|---|
| `items` | `EmGroupMember[]` | 本页成员；`applied=false` 时不得消费 |
| `cursor` | `string` | 下一页游标；`applied=false` 时不得消费 |
| `hasMore` | `boolean` | 是否还有更多；`applied=false` 时不得消费 |
| `applied` | `boolean` | 当前成功且已写入 store 时为 `true`，陈旧结果为 `false` |

调用方必须同时处理 resolve 与 catch：陈旧成功和陈旧失败都不得消费 `items/cursor/hasMore`；当前真实失败 reject 原始错误。

## `CreateGroupParams`

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | `string` | 是 | 群名称 |
| `description` | `string` | 否 | 群描述 |
| `members` | `string[]` | 否 | 初始成员（不含创建者） |
| `public` | `boolean` | 否 | 是否公开群 |
| `approval` | `boolean` | 否 | 入群是否需要审批 |
| `allowInvites` | `boolean` | 否 | 是否允许成员邀请 |
| `inviteNeedConfirm` | `boolean` | 否 | 邀请是否需要确认 |
| `maxMembers` | `number` | 否 | 人数上限 |

## 群组、联系人与列表常量

- `GROUP_MEMBER_ROLE`：`OWNER='owner'`、`ADMIN='admin'`、`MEMBER='member'`。
- `GROUP_MEMBER_ACTION`：`CHAT`、`SET_ADMIN`、`REMOVE_ADMIN`、`TRANSFER_OWNER`、`REMOVE`。
- `GROUP_NOTICE_EVENT`：建群、成员进出、改名、公告、转让、被移出、解散、管理员变更、全员禁言。
- `GROUP_MEMBER_PAGE_SIZE=20`、`GROUP_MEMBER_GRID_COUNT=8`、`GROUP_ANNOUNCEMENT_MAX_LENGTH=512`、`GROUP_NAME_MAX_LENGTH=255`。
- `CONTACT_ENTRY_KEY`：`NOTICE='notice'`、`GROUP='group'`、`CONTACT='contact'`。
- `CONTACT_INVITE_STATUS`：`PENDING` / `ACCEPTED` / `DECLINED`。
- `CONTACT_INVITE_KIND`：`CONTACT='contact'`、`GROUP='group'`。
- `CONTACT_MENU_KEY`：`REMARK='remark'`、`DELETE='delete'`。
- `ALPHABET_KEYS`：`A`–`Z` + `#`。
- `LOAD_MORE_STATE`：`LOADING='loading'`、`BUTTON='button'`、`NO_MORE='noMore'`、`ERROR='error'`；`LoadMoreStateValue` 由该常量派生。
