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
import { clearLogBuffer, createLogger, getLogText } from './utils/logger'
import type {
  EmContactInvite,
  EmKitConfig,
  EmLoginOptions,
  EmMessageHandler,
  EmMessageItem,
  EmQuoteInfo
} from './types'
import type { EmPickedFile, EmPickedImage, EmPickedVideo } from './platform'

const kitLogger = createLogger('kit')

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
    this.client.init(config)
    // bind 推迟到 client 就绪后（小程序分包场景 SDK 模块异步到达）；
    // 就绪门在 init 内已挂上，先于业务后续调用的续体，bind 时序稳定。
    // 初始化失败只记录：业务入口（login 等）经 whenReady 拿到原始错误
    this.client
      .whenReady()
      .then((client) => {
        this.chat.bind(client, () => this.client.waitOnline(), config)
        this.contact.bind(client, () => this.client.waitOnline())
      })
      .catch((e) => kitLogger.warn('kit bind skipped:', e))
  }

  /** SDK 就绪门（宿主渲染「加载消息服务」占位态用）：resolve 于 SDK 模块加载 + ChatClient.init 完成；未 init 即 reject */
  whenReady(): Promise<unknown> {
    return this.client.whenReady()
  }

  async login(options: EmLoginOptions): Promise<void> {
    await this.client.whenReady()
    await this.client.login(options)
    // 登录成功即拉取自己的昵称/头像（会话页、聊天页己方气泡、demo mine 页回显）
    ensureUserInfos([options.userId])
    // 好友快照读内存（SDK 后台同步），失败不阻塞登录链路
    this.contact.syncContacts().catch(() => {})
  }

  logout(): Promise<void> {
    return this.client.logout()
  }

  async sendText(to: string, text: string, quote?: EmQuoteInfo): Promise<EmMessageItem> {
    await this.client.whenReady()
    return this.chat.sendText(to, text, quote)
  }

  makeQuote(item: EmMessageItem): EmQuoteInfo {
    return this.chat.makeQuote(item)
  }

  async sendImage(to: string, image: EmPickedImage): Promise<EmMessageItem> {
    await this.client.whenReady()
    return this.chat.sendImage(to, image)
  }

  async sendAudio(to: string, filePath: string, duration: number): Promise<EmMessageItem> {
    await this.client.whenReady()
    return this.chat.sendAudio(to, filePath, duration)
  }

  async sendVideo(to: string, video: EmPickedVideo): Promise<EmMessageItem> {
    await this.client.whenReady()
    return this.chat.sendVideo(to, video)
  }

  async sendFile(to: string, file: EmPickedFile): Promise<EmMessageItem> {
    await this.client.whenReady()
    return this.chat.sendFile(to, file)
  }

  async loadHistory(conversationId: string, pageSize?: number): Promise<void> {
    await this.client.whenReady()
    return this.chat.loadHistory(conversationId, pageSize)
  }

  async syncConversations(): Promise<void> {
    await this.client.whenReady()
    return this.chat.syncConversations()
  }

  async enterConversation(conversationId: string): Promise<void> {
    await this.client.whenReady()
    return this.chat.enterConversation(conversationId)
  }

  async pinConversation(conversationId: string, pinned: boolean): Promise<void> {
    await this.client.whenReady()
    return this.chat.pinConversation(conversationId, pinned)
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.client.whenReady()
    return this.chat.deleteConversation(conversationId)
  }

  async clearConversationMessages(conversationId: string): Promise<void> {
    await this.client.whenReady()
    return this.chat.clearConversationMessages(conversationId)
  }

  async setConversationMuted(conversationId: string, muted: boolean): Promise<void> {
    await this.client.whenReady()
    return this.chat.setConversationMuted(conversationId, muted)
  }

  async recallMessage(conversationId: string, messageId: string): Promise<void> {
    await this.client.whenReady()
    return this.chat.recallMessage(conversationId, messageId)
  }

  deleteLocalMessage(conversationId: string, localId: string): void {
    this.chat.deleteLocalMessage(conversationId, localId)
  }

  async resendMessage(conversationId: string, localId: string): Promise<void> {
    await this.client.whenReady()
    return this.chat.resendMessage(conversationId, localId)
  }

  async sendTyping(conversationId: string): Promise<void> {
    await this.client.whenReady()
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

  async syncContacts(): Promise<void> {
    await this.client.whenReady()
    return this.contact.syncContacts()
  }

  async addContact(userId: string, message = ''): Promise<void> {
    await this.client.whenReady()
    return this.contact.addContact(userId, message)
  }

  async deleteContact(userId: string): Promise<void> {
    await this.client.whenReady()
    return this.contact.deleteContact(userId)
  }

  async setContactRemark(userId: string, remark: string): Promise<void> {
    await this.client.whenReady()
    return this.contact.setContactRemark(userId, remark)
  }

  async acceptContactInvite(invite: EmContactInvite): Promise<void> {
    await this.client.whenReady()
    return this.contact.acceptContactInvite(invite)
  }

  async declineContactInvite(invite: EmContactInvite): Promise<void> {
    await this.client.whenReady()
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
export { useLocale, mergeMessages } from './use/useLocale'
export { useSafeArea, getSafeAreaBottom, getSafeAreaTop } from './use/useSafeArea'
export { nextZIndex } from './use/usePopup'
export { useConfig, setConfig } from './store/config'
export { themeStore } from './store/theme'
export { userStore, displayNameOf, avatarOf, mergeUserInfo } from './store/user'
export { contactStore, contactDisplayNameOf, pendingInviteCount } from './store/contact'
export { ensureUserInfos } from './chat/user-info'
export { setPinyinAdapter, groupContacts, matchContact, resolveAlphabetKeyByOffsetY } from './utils/pinyin'
export type { EmPinyinResult, EmContactGroup } from './utils/pinyin'
export { ensureSdkModule, setSdkLoader, setSdkModule } from './client/sdk'
export type { EmSdkModule } from './client/sdk'
export { createLogger, setLogLevel, getLogLevel, getLogText, clearLogBuffer, getLogBufferSize } from './utils/logger'
export type { EmLogger } from './utils/logger'
