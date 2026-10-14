import { EmClient } from './client'
import { EmChat } from './chat'
import { ensureUserInfos } from './chat/user-info'
import { connectionStore } from './store/connection'
import { conversationStore } from './store/conversation'
import { messageStore } from './store/message'
import { userStore } from './store/user'
import type {
  EmKitConfig,
  EmLoginOptions,
  EmMessageHandler,
  EmMessageItem,
  EmQuoteInfo
} from './types'
import type { EmPickedFile, EmPickedImage, EmPickedVideo } from './platform'

// EmKit 门面：对外唯一入口，内部按功能拆分（client / chat / store / platform）
class EmKitImpl {
  readonly state = connectionStore
  readonly conversations = conversationStore
  readonly messages = messageStore
  readonly users = userStore

  private client = new EmClient()
  private chat = new EmChat()

  init(config: EmKitConfig): void {
    const client = this.client.init(config)
    this.chat.bind(client, () => this.client.waitOnline(), config)
  }

  async login(options: EmLoginOptions): Promise<void> {
    await this.client.login(options)
    // 登录成功即拉取自己的昵称/头像（会话页、聊天页己方气泡、demo mine 页回显）
    ensureUserInfos([options.userId])
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

  sendImage(to: string, image: EmPickedImage): Promise<void> {
    return this.chat.sendImage(to, image)
  }

  sendAudio(to: string, filePath: string, duration: number): Promise<void> {
    return this.chat.sendAudio(to, filePath, duration)
  }

  sendVideo(to: string, video: EmPickedVideo): Promise<void> {
    return this.chat.sendVideo(to, video)
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

  sendTyping(conversationId: string): Promise<void> {
    return this.chat.sendTyping(conversationId)
  }

  isReadReceiptEnabled(): boolean {
    return this.chat.readReceiptEnabled
  }

  leaveConversation(): void {
    this.chat.leaveConversation()
  }

  onMessage(handler: EmMessageHandler): void {
    this.chat.onMessage(handler)
  }

  // 按需确保一批用户的昵称/头像已缓存（微任务合批，单次请求）
  ensureUserInfos(userIds: string[]): void {
    ensureUserInfos(userIds)
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
export type { EmPickedVideo, EmPickedFile, EmPickedImage, EmRecordResult } from './platform'
export { useNamespace } from './use/useNamespace'
export { useTheme } from './use/useTheme'
export { useLocale } from './use/useLocale'
export { useSafeArea, getSafeAreaBottom, getSafeAreaTop } from './use/useSafeArea'
export { usePopup, nextZIndex } from './use/usePopup'
export { themeStore } from './store/theme'
export { userStore, displayNameOf, avatarOf, mergeUserInfo } from './store/user'
export { ensureUserInfos } from './chat/user-info'
