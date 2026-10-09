import { reactive } from 'vue'
import type { EmMessageItem } from '../types'

// 消息按会话分组的全局唯一 store（裸 reactive，零依赖）
export const messageStore = reactive({
  byConversation: {} as Record<string, EmMessageItem[]>,
  cursors: {} as Record<string, string>,
  hasMore: {} as Record<string, boolean>
})

export function getMessages(conversationId: string): EmMessageItem[] {
  if (messageStore.byConversation[conversationId] == null) {
    messageStore.byConversation[conversationId] = []
  }
  return messageStore.byConversation[conversationId]
}
