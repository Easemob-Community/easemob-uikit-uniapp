import { reactive } from 'vue'
import type { EmConversationItem } from '../types'

// 会话列表全局唯一 store（裸 reactive，零依赖）：
// atMeByConversationId 为「群里有人@我」未读标记（ext em_at_list 驱动，进入会话清除）
export const conversationStore = reactive({
  items: [] as EmConversationItem[],
  syncing: false,
  atMeByConversationId: {} as Record<string, boolean>
})
