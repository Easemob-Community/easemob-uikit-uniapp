export type EmConnectionStatus = 'idle' | 'connecting' | 'online' | 'closed'

export interface EmKitConfig {
  appkey: string
}

export interface EmLoginOptions {
  userId: string
  token: string
}

export interface EmTextMessageItem {
  id: string
  from: string
  to: string
  text: string
  time: number
  self: boolean
}

export type EmTextMessageHandler = (msg: EmTextMessageItem) => void
