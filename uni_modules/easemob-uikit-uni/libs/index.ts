import { EmClient } from './client'
import { EmChat } from './chat'
import { connectionStore } from './store/connection'
import { conversationStore } from './store/conversation'
import { messageStore } from './store/message'
import type {
  EmKitConfig,
  EmLoginOptions,
  EmMessageHandler,
  EmMessageItem,
  EmQuoteInfo
} from './types'
import type { EmPickedFile } from './platform'

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

  sendText(to: string, text: string, quote?: EmQuoteInfo): Promise<void> {
    return this.chat.sendText(to, text, quote)
  }

  makeQuote(item: EmMessageItem): EmQuoteInfo {
    return this.chat.makeQuote(item)
  }

  sendImage(to: string, filePath: string): Promise<void> {
    return this.chat.sendImage(to, filePath)
  }

  sendAudio(to: string, filePath: string, duration: number): Promise<void> {
    return this.chat.sendAudio(to, filePath, duration)
  }

  sendVideo(to: string, filePath: string, duration: number, width: number, height: number): Promise<void> {
    return this.chat.sendVideo(to, filePath, duration, width, height)
  }

  sendFile(to: string, file: EmPickedFile): Promise<void> {
    return this.chat.sendFile(to, file)
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

  pinConversation(conversationId: string, pinned: boolean): Promise<void> {
    return this.chat.pinConversation(conversationId, pinned)
  }

  deleteConversation(conversationId: string): Promise<void> {
    return this.chat.deleteConversation(conversationId)
  }

  setConversationMuted(conversationId: string, muted: boolean): Promise<void> {
    return this.chat.setConversationMuted(conversationId, muted)
  }

  recallMessage(conversationId: string, messageId: string): Promise<void> {
    return this.chat.recallMessage(conversationId, messageId)
  }

  deleteLocalMessage(conversationId: string, localId: string): void {
    this.chat.deleteLocalMessage(conversationId, localId)
  }

  resendMessage(conversationId: string, localId: string): Promise<void> {
    return this.chat.resendMessage(conversationId, localId)
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
export * from './constants'
export { setStorage, getStorage, removeStorage, chooseImage, previewImage, chooseVideo, chooseFile, startRecord, stopRecord, isRecording, playAudio, stopAudio } from './platform'
export type { EmPickedVideo, EmPickedFile, EmRecordResult } from './platform'
export { useNamespace } from './use/useNamespace'
export { useTheme } from './use/useTheme'
export { useLocale } from './use/useLocale'
export { usePopup, nextZIndex, getSafeAreaBottom } from './use/usePopup'
export { themeStore } from './store/theme'
