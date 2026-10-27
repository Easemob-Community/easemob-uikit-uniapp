import { getStorage, setStorage } from '@/uni_modules/easemob-uikit-uni/libs'

const SESSION_KEY = 'chat-only.session'

export interface ChatSession {
  userId: string
  token: string
}

export function loadSession(): ChatSession | null {
  try {
    const raw = getStorage(SESSION_KEY)
    if (raw === '') return null
    const value = JSON.parse(raw) as ChatSession
    return value.userId !== '' && value.token !== '' ? value : null
  } catch (e) {
    return null
  }
}

export function saveSession(session: ChatSession): void {
  setStorage(SESSION_KEY, JSON.stringify(session))
}

export function clearSession(): void {
  setStorage(SESSION_KEY, '')
}
