import { EmClient } from './client'
import { EmChat } from './chat'
import { connectionStore } from './store/connection'
import { conversationStore } from './store/conversation'
import { messageStore } from './store/message'
import type {
  EmKitConfig,
  EmLoginOptions,
  EmMessageHandler
} from './types'

// EmKit 门面：对外唯一入口，内部按功能拆分（client / chat / store / platform）
class EmKitImpl {
  readonly state = connectionStore
  readonly conversations = conversationStore
  readonly messages = messageStore

  private client = new EmClient()
  private chat = new EmChat()

  init(config: EmKitConfig): void {
    const client = this.client.init(config)
    this.chat.bind(client, () => this.client.waitOnline())
  }

  login(options: EmLoginOptions): Promise<void> {
    return this.client.login(options)
  }

  logout(): Promise<void> {
    return this.client.logout()
  }

  sendText(to: string, text: string): Promise<void> {
    return this.chat.sendText(to, text)
  }

  sendImage(to: string, filePath: string): Promise<void> {
    return this.chat.sendImage(to, filePath)
  }

  loadHistory(conversationId: string, pageSize?: number): Promise<void> {
    return this.chat.loadHistory(conversationId, pageSize)
  }

  syncConversations(): Promise<void> {
    return this.chat.syncConversations()
  }

  enterConversation(conversationId: string): Promise<void> {
    return this.chat.enterConversation(conversationId)
  }

  leaveConversation(): void {
    this.chat.leaveConversation()
  }

  onMessage(handler: EmMessageHandler): void {
    this.chat.onMessage(handler)
  }

  /** @deprecated 兼容 M0 spike 页 */
  onTextMessage(handler: EmMessageHandler): void {
    this.chat.onTextMessage(handler)
  }
}

export const EmKit = new EmKitImpl()

export * from './types'
export { setStorage, getStorage, removeStorage, chooseImage, previewImage } from './platform'
export { useNamespace } from './use/useNamespace'
export { useTheme } from './use/useTheme'
export { useLocale } from './use/useLocale'
export { themeStore } from './store/theme'
