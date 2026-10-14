import { reactive } from 'vue'
import type { EmMessageItem } from '../types'

// 消息按会话分组的全局唯一 store（裸 reactive，零依赖）
export const messageStore = reactive({
  byConversation: {} as Record<string, EmMessageItem[]>,
  cursors: {} as Record<string, string>,
  hasMore: {} as Record<string, boolean>,
  // 对端已读时间戳（会话级，单聊已读回执驱动）
  peerReadTime: {} as Record<string, number>,
  // 对端 typing 状态（超时由 chat 层定时器清除）
  peerTyping: {} as Record<string, boolean>
})

export function getMessages(conversationId: string): EmMessageItem[] {
  if (messageStore.byConversation[conversationId] == null) {
    messageStore.byConversation[conversationId] = []
  }
  return messageStore.byConversation[conversationId]
}
