import { reactive } from 'vue'
import { CONTACT_INVITE_STATUS } from '../constants'
import { getStorage, setStorage } from '../platform'
import type { EmContactItem, EmContactInvite } from '../types'
import { displayNameOf } from './user'

// 联系人 store（裸 reactive，零依赖）：list 为好友快照（事件驱动刷新），
// invites 为好友申请/通知（内存 + storage 持久化，对齐 draft 存储套路）
const INVITES_STORAGE_KEY = 'emkit.contact.invites'

function loadInvites(): EmContactInvite[] {
  try {
    const raw = getStorage(INVITES_STORAGE_KEY)
    if (raw === '') return []
    return JSON.parse(raw) as EmContactInvite[]
  } catch (e) {
    return []
  }
}

export const contactStore = reactive({
  list: [] as EmContactItem[],
  invites: loadInvites() as EmContactInvite[],
  loaded: false,
  syncing: false
})

function persistInvites(): void {
  setStorage(INVITES_STORAGE_KEY, JSON.stringify(contactStore.invites))
}

export function remarkOf(userId: string): string {
  const c = contactStore.list.find((item) => item.userId === userId)
  return c != null ? c.remark : ''
}

// 联系人展示名回落链（对齐 vue 版 contact-display）：remark > userStore nickname > userId
export function contactDisplayNameOf(userId: string): string {
  const remark = remarkOf(userId)
  if (remark !== '') return remark
  return displayNameOf(userId)
}

// 待处理申请数（新请求入口红点）
export function pendingInviteCount(): number {
  return contactStore.invites.filter((i) => !i.outgoing && i.status === CONTACT_INVITE_STATUS.PENDING).length
}

// 新增/合并申请：同 id 覆盖（防事件重放重复），否则置顶插入；回写落 reactive 代理
export function addInvite(invite: EmContactInvite): void {
  const index = contactStore.invites.findIndex((i) => i.id === invite.id)
  if (index >= 0) {
    const target = contactStore.invites[index]
    target.message = invite.message
    target.status = invite.status
    target.outgoing = invite.outgoing
    target.ts = invite.ts
  } else {
    contactStore.invites.unshift(invite)
  }
  persistInvites()
}

export function updateInviteStatus(id: string, status: EmContactInvite['status']): void {
  const target = contactStore.invites.find((i) => i.id === id)
  if (target != null && target.status !== status) {
    target.status = status
    persistInvites()
  }
}

export function removeInviteByFrom(from: string): void {
  const next = contactStore.invites.filter((i) => i.from !== from)
  if (next.length !== contactStore.invites.length) {
    contactStore.invites = next
    persistInvites()
  }
}

export function clearContacts(): void {
  contactStore.list = []
  contactStore.invites = []
  contactStore.loaded = false
  contactStore.syncing = false
  persistInvites()
}
