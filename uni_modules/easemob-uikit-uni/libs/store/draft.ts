import { reactive } from 'vue'
import { getStorage, setStorage } from '../platform'

// 草稿 store：内存 + storage 持久化（一期默认开，不配开关）
interface DraftEntry {
  text: string
  time: number
}

const STORAGE_KEY = 'emkit.drafts'

function loadDrafts(): Record<string, DraftEntry> {
  try {
    const raw = getStorage(STORAGE_KEY)
    if (raw === '') return {}
    return JSON.parse(raw) as Record<string, DraftEntry>
  } catch (e) {
    return {}
  }
}

export const draftStore = reactive({
  map: loadDrafts() as Record<string, DraftEntry>
})

function persist(): void {
  setStorage(STORAGE_KEY, JSON.stringify(draftStore.map))
}

export function setDraft(conversationId: string, text: string): void {
  if (text === '') {
    clearDraft(conversationId)
    return
  }
  draftStore.map[conversationId] = { text, time: Date.now() }
  persist()
}

export function clearDraft(conversationId: string): void {
  if (draftStore.map[conversationId] != null) {
    delete draftStore.map[conversationId]
    persist()
  }
}

export function getDraft(conversationId: string): DraftEntry | null {
  return draftStore.map[conversationId] ?? null
}
