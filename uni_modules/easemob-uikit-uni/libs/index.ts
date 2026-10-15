import { EmClient } from './client'
import { EmChat } from './chat'
import { EmContact } from './chat/contact'
import { ensureUserInfos } from './chat/user-info'
import { connectionStore } from './store/connection'
import { contactStore } from './store/contact'
import { conversationStore } from './store/conversation'
import { messageStore } from './store/message'
import { userStore } from './store/user'
import { copyText, exportTextFile } from './platform'
import { clearLogBuffer, getLogText } from './utils/logger'
import type {
  EmContactInvite,
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
  readonly contacts = contactStore

  private client = new EmClient()
  private chat = new EmChat()
  private contact = new EmContact()

  init(config: EmKitConfig): void {
    const client = this.client.init(config)
    this.chat.bind(client, () => this.client.waitOnline(), config)
    this.contact.bind(client, () => this.client.waitOnline())
  }

  async login(options: EmLoginOptions): Promise<void> {
    await this.client.login(options)
    // 登录成功即拉取自己的昵称/头像（会话页、聊天页己方气泡、demo mine 页回显）
    ensureUserInfos([options.userId])
    // 好友快照读内存（SDK 后台同步），失败不阻塞登录链路
    this.contact.syncContacts().catch(() => {})
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

  clearConversationMessages(conversationId: string): Promise<void> {
    return this.chat.clearConversationMessages(conversationId)
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

  onMessage(handler: EmMessageHandler): () => void {
    return this.chat.onMessage(handler)
  }

  // 按需确保一批用户的昵称/头像已缓存（微任务合批，单次请求）
  ensureUserInfos(userIds: string[]): void {
    ensureUserInfos(userIds)
  }

  syncContacts(): Promise<void> {
    return this.contact.syncContacts()
  }

  addContact(userId: string, message = ''): Promise<void> {
    return this.contact.addContact(userId, message)
  }

  deleteContact(userId: string): Promise<void> {
    return this.contact.deleteContact(userId)
  }

  setContactRemark(userId: string, remark: string): Promise<void> {
    return this.contact.setContactRemark(userId, remark)
  }

  acceptContactInvite(invite: EmContactInvite): Promise<void> {
    return this.contact.acceptContactInvite(invite)
  }

  declineContactInvite(invite: EmContactInvite): Promise<void> {
    return this.contact.declineContactInvite(invite)
  }

  // 导出调试日志全文（环形缓冲，含被 level 过滤掉的 debug 行）：
  // H5 触发浏览器下载返回 'download'；小程序/App 写用户数据目录返回文件路径
  // （并 best-effort 复制全文到剪贴板）；写文件失败兜底剪贴板返回 'clipboard'
  async exportLogs(): Promise<string> {
    const text = getLogText()
    try {
      const path = await exportTextFile(`emkit-logs-${Date.now()}.txt`, text)
      if (path === '') {
        return 'download'
      }
      copyText(text)
      return path
    } catch (e) {
      copyText(text)
      return 'clipboard'
    }
  }

  getLogText(): string {
    return getLogText()
  }

  clearLogs(): void {
    clearLogBuffer()
  }
}

export const EmKit = new EmKitImpl()

export * from './types'
export * from './constants'
export { setStorage, getStorage, chooseImage, previewImage, chooseVideo, chooseFile, startRecord, stopRecord, isRecording, playAudio, stopAudio } from './platform'
export type { EmPickedVideo, EmPickedFile, EmPickedImage, EmRecordResult } from './platform'
export { useNamespace } from './use/useNamespace'
export { useTheme } from './use/useTheme'
export { useLocale } from './use/useLocale'
export { useSafeArea, getSafeAreaBottom, getSafeAreaTop } from './use/useSafeArea'
export { nextZIndex } from './use/usePopup'
export { themeStore } from './store/theme'
export { userStore, displayNameOf, avatarOf, mergeUserInfo } from './store/user'
export { contactStore, contactDisplayNameOf, pendingInviteCount } from './store/contact'
export { ensureUserInfos } from './chat/user-info'
export { setPinyinAdapter, groupContacts, matchContact, resolveAlphabetKeyByOffsetY } from './utils/pinyin'
export type { EmPinyinResult, EmContactGroup } from './utils/pinyin'
export { createLogger, setLogLevel, getLogLevel, getLogText, clearLogBuffer, getLogBufferSize } from './utils/logger'
export type { EmLogger } from './utils/logger'
