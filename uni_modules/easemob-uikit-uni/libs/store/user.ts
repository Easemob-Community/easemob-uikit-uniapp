import { reactive } from 'vue'
import type { EmUserInfo } from '../types'

// 用户属性缓存（裸 reactive，零依赖）：按 userId 缓存昵称/头像；
// loading/failed 为请求态标记——失败（含空结果占位已写 map）不再自动重拉，防无限重试
export const userStore = reactive({
  map: {} as Record<string, EmUserInfo>,
  loading: {} as Record<string, boolean>,
  failed: {} as Record<string, boolean>
})

// 合并写：部分字段推送不丢已有值；回写落在 reactive 代理上（AGENTS.md §4 响应式纪律）
export function mergeUserInfo(info: EmUserInfo): void {
  if (info.userId === '') return
  const prev = userStore.map[info.userId]
  if (prev != null) {
    if (info.nickname !== '') prev.nickname = info.nickname
    if (info.avatarUrl !== '') prev.avatarUrl = info.avatarUrl
  } else {
    userStore.map[info.userId] = { userId: info.userId, nickname: info.nickname, avatarUrl: info.avatarUrl }
  }
}

// 展示名回落链（对齐 vue 版 useUserInfo，一期无联系人备注）：nickname > fallback（conversation.name 等）> userId
export function displayNameOf(userId: string, fallback = ''): string {
  if (userId === '') return ''
  const nick = userStore.map[userId]?.nickname ?? ''
  if (nick !== '') return nick
  if (fallback !== '' && fallback !== userId) return fallback
  return userId
}

export function avatarOf(userId: string): string {
  if (userId === '') return ''
  return userStore.map[userId]?.avatarUrl ?? ''
}
