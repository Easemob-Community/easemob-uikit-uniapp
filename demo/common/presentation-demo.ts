import { CONVERSATION_TYPE, EmKit } from '@/uni_modules/easemob-uikit-uni/libs'
import type { ConversationTypeValue } from '@/uni_modules/easemob-uikit-uni/libs'

// 场景实验室「资料注入」演示：宿主业务资料经 EmKit.set*Presentation 注入后优先于 SDK 资料，
// SDK 资料回推/会话快照刷新冲不掉（覆盖层与 SDK 数据分离）；传 null 清除即还原默认回落链。
// 注入的 ext.demoTag 同时供聊天页 #title 与会话列表 #title-extra 插槽 scope 消费。

const DEMO_TAG_KEY = 'demoTag'

export function tagOf(ext: Record<string, unknown> | undefined): string {
  const tag = ext?.[DEMO_TAG_KEY]
  return typeof tag === 'string' ? tag : ''
}

export function applyScenePresentation(conversationId: string, chatType: ConversationTypeValue, tag: string, peerNickname: string): void {
  EmKit.setConversationPresentation(conversationId, { ext: { [DEMO_TAG_KEY]: tag } })
  if (chatType === CONVERSATION_TYPE.GROUP_CHAT) {
    // 群聊：群名旁的业务标签走群注入（群详情 #name-extra 与聊天页 #title 同样能消费）
    EmKit.setGroupPresentation(conversationId, { ext: { [DEMO_TAG_KEY]: tag } })
  } else {
    // 单聊：对端显示名换成业务昵称（客服工号/买家备注等），SDK 昵称回推不覆盖
    EmKit.setUserPresentation(conversationId, { nickname: peerNickname })
  }
}

export function clearScenePresentation(conversationId: string, chatType: ConversationTypeValue): void {
  EmKit.setConversationPresentation(conversationId, null)
  if (chatType === CONVERSATION_TYPE.GROUP_CHAT) {
    EmKit.setGroupPresentation(conversationId, null)
  } else {
    EmKit.setUserPresentation(conversationId, null)
  }
}
