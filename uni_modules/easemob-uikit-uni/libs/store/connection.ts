import { reactive } from 'vue'
import { CONNECTION_STATUS } from '../constants'
import type { EmConnectionStatus } from '../types'

// 连接状态全局唯一 store（裸 reactive，零依赖）
export const connectionStore = reactive({
  status: CONNECTION_STATUS.IDLE as EmConnectionStatus,
  appkey: '',
  userId: ''
})
