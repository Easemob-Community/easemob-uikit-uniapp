import { reactive } from 'vue'
import type { EmConnectionStatus } from '../types'

// 连接状态全局唯一 store（裸 reactive，零依赖）
export const connectionStore = reactive({
  status: 'idle' as EmConnectionStatus,
  appkey: '',
  userId: ''
})
