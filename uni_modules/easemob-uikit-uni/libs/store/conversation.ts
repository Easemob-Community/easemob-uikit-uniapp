import { reactive } from 'vue'
import type { EmConversationItem } from '../types'

// 会话列表全局唯一 store（裸 reactive，零依赖）
export const conversationStore = reactive({
  list: [] as EmConversationItem[],
  syncing: false
})
