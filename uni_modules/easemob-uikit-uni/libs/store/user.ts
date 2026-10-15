import { reactive } from 'vue'
import type { EmUserInfo } from '../types'

// 用户属性缓存（裸 reactive，零依赖）：infoByUserId 按 userId 缓存昵称/头像；
// loadingByUserId/failedByUserId 为请求态标记——失败（含空结果占位已写 infoByUserId）不再自动重拉，防无限重试
export const userStore = reactive({
  infoByUserId: {} as Record<string, EmUserInfo>,
  loadingByUserId: {} as Record<string, boolean>,
  failedByUserId: {} as Record<string, boolean>
})

// 合并写：部分字段推送不丢已有值；回写落在 reactive 代理上（AGENTS.md §4 响应式纪律）
export function mergeUserInfo(info: EmUserInfo): void {
  if (info.userId === '') return
  const prev = userStore.infoByUserId[info.userId]
  if (prev != null) {
    if (info.nickname !== '') prev.nickname = info.nickname
    if (info.avatarUrl !== '') prev.avatarUrl = info.avatarUrl
  } else {
    userStore.infoByUserId[info.userId] = { userId: info.userId, nickname: info.nickname, avatarUrl: info.avatarUrl }
  }
}

// 展示名回落链（对齐 vue 版 useUserInfo）：nickname > fallback（conversation.name 等）> userId
// 联系人备注不参与本回落链（避免 store 交叉依赖），联系人场景见 libs/store/contact.ts 的 contactDisplayNameOf（remark > nickname > userId）
export function displayNameOf(userId: string, fallback = ''): string {
  if (userId === '') return ''
  const nick = userStore.infoByUserId[userId]?.nickname ?? ''
  if (nick !== '') return nick
  if (fallback !== '' && fallback !== userId) return fallback
  return userId
}

export function avatarOf(userId: string): string {
  if (userId === '') return ''
  return userStore.infoByUserId[userId]?.avatarUrl ?? ''
}
