// UIKit 能力清单：审计脚本（audit-usage.mjs）与后续按需接入工具的唯一事实源。
//
// 维护纪律：
//   1. 新增组件/页面组件后，必须在这里归到某个 feature，否则 audit-usage --check 会报 manifest 漂移。
//   2. features[].components 只写「该能力独有」的组件——共用原子组件（em-icon/em-text/em-avatar…）不归属任何能力，
//      否则一项能力的使用会连带把其它能力标成「在用」。
//   3. features[].apis 写 EmKit 门面方法名（libs/index.ts 的 class EmKitImpl 成员），用于「宿主只调了哪些能力」的判定。

export const KIT_REL = 'uni_modules/easemob-uikit-uni'

// 能力 → 独有组件 + EmKit API。命中任意一项即视为该能力在用（直接使用）。
export const FEATURES = [
  {
    id: 'conversation',
    label: '会话列表',
    components: ['em-conversation-page', 'em-conversation-item', 'em-conversation-tabs'],
    apis: [
      'syncConversations', 'enterConversation', 'clearConversationUnread', 'pinConversation',
      'deleteConversation', 'clearConversationMessages', 'setConversationMuted', 'addConversation',
      'conversationUnreadCountOf', 'leaveConversation', 'setConversationPresentation'
    ]
  },
  {
    id: 'chat',
    label: '聊天页',
    components: ['em-chat-page', 'em-chat-inputbar', 'em-text-message', 'em-multi-body-message'],
    apis: [
      'loadHistory', 'sendText', 'sendCustom', 'makeQuote', 'recallMessage', 'deleteMessage',
      'modifyTextMessage', 'resendMessage', 'sendTyping', 'onMessage', 'insertLocalNotice'
    ]
  },
  {
    id: 'chat-info',
    label: '聊天信息页',
    components: ['em-chat-info-page'],
    apis: []
  },
  {
    id: 'contact',
    label: '通讯录',
    components: ['em-contact-page'],
    apis: [
      'syncContacts', 'addContact', 'deleteContact', 'setContactRemark', 'acceptContactInvite',
      'declineContactInvite', 'ensureUserInfos', 'setUserPresentation'
    ]
  },
  {
    id: 'contact-list',
    label: '好友列表页',
    components: ['em-contact-list-page'],
    apis: []
  },
  {
    id: 'contact-requests',
    label: '新请求页',
    components: ['em-contact-requests-page'],
    apis: []
  },
  {
    id: 'group',
    label: '群组',
    components: ['em-group-page', 'em-create-group-modal'],
    apis: [
      'getJoinedGroups', 'enterGroup', 'getGroupInfo', 'getGroupMemberList', 'getGroupAnnouncement',
      'createGroup', 'inviteUsersToGroup', 'acceptGroupInvite', 'declineGroupInvite', 'leaveGroup',
      'destroyGroup', 'changeGroupOwner', 'updateGroupInfo', 'updateGroupAnnouncement',
      'removeGroupMembers', 'addGroupAdmin', 'removeGroupAdmin', 'muteAllGroupMembers',
      'unmuteAllGroupMembers', 'insertGroupNotice', 'setGroupPresentation'
    ]
  },
  {
    id: 'image',
    label: '图片消息',
    components: ['em-image-message'],
    apis: ['sendImage']
  },
  {
    id: 'voice',
    label: '语音消息',
    components: ['em-audio-message'],
    apis: ['sendAudio']
  },
  {
    id: 'video',
    label: '视频消息',
    components: ['em-video-message', 'em-video-preview'],
    apis: ['sendVideo']
  },
  {
    id: 'file',
    label: '文件消息 / 附件',
    components: ['em-file-message'],
    apis: [
      'sendFile', 'downloadAttachment', 'setAttachmentProvider', 'refreshAttachmentAvailability',
      'pickAttachments', 'resolveAttachment'
    ]
  },
  {
    id: 'mention',
    label: '@ 提醒',
    components: ['em-mention-picker'],
    apis: []
  },
  {
    id: 'pinned',
    label: '置顶消息',
    components: ['em-pinned-bar'],
    apis: ['pinMessage', 'unpinMessage', 'getPinnedMessageList']
  },
  {
    id: 'quick-reply',
    label: '快捷回复',
    components: ['em-quick-reply-bar'],
    apis: []
  },
  {
    id: 'read-receipt',
    label: '已读回执',
    components: [],
    apis: ['isReadReceiptEnabled', 'isGroupReadReceiptEnabled', 'refreshGroupReadCounts']
  },
  {
    id: 'stream',
    label: 'AI 流式消息',
    components: [],
    apis: ['onStreamMessage']
  },
  {
    id: 'log',
    label: '日志导出',
    components: [],
    apis: ['exportLogs', 'getLogText', 'clearLogs']
  }
]

// 共用原子组件：不属于任何单一能力，审计报告里单独列「原子层」，不参与能力判定。
export const ATOMIC_COMPONENTS = [
  'em-icon', 'em-text', 'em-avatar', 'em-badge', 'em-button', 'em-empty', 'em-popup',
  'em-action-sheet', 'em-load-more', 'em-nav-bar', 'em-search-bar', 'em-skeleton', 'em-switch',
  'em-connection-banner', 'em-select-contact', 'em-contact-nav', 'em-alphabet-nav', 'em-watermark'
]
