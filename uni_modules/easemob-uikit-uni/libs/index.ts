import { EmClient } from './client'
import { EmChat } from './chat'
import { EmContact } from './chat/contact'
import { EmGroupDomain } from './chat/group'
import { ensureUserInfos } from './chat/user-info'
import { connectionStore } from './store/connection'
import { contactRequestUnreadCount, contactStore } from './store/contact'
import { clearConversations, conversationStore, conversationUnreadCountOf as unreadCountOfConversation, totalConversationUnread } from './store/conversation'
import { clearAllDrafts } from './store/draft'
import { groupStore } from './store/group'
import { clearMessages, messageStore } from './store/message'
import { clearUsers, userStore } from './store/user'
import { copyText, exportTextFile } from './platform'
import { clearLogBuffer, createLogger, getLogText } from './utils/logger'
import type { ConversationTypeValue } from './constants'
import type {
  CreateGroupParams,
  EmContactInvite,
  EmGroup,
  EmGroupMember,
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
  readonly groups = groupStore

  // 未读数便捷入口（非响应式快照；响应式请用 useUnreadCounts()/useTabBarBadge()）
  get conversationUnreadCount(): number {
    return totalConversationUnread.value
  }

  get contactRequestUnreadCount(): number {
    return contactRequestUnreadCount.value
  }

  // 单会话未读快照（入口角标）；响应式用 useConversationUnreadCount(id)
  conversationUnreadCountOf(conversationId: string): number {
    return unreadCountOfConversation(conversationId)
  }

  private client = new EmClient()
  private chat = new EmChat()
  private contact = new EmContact()
  private group = new EmGroupDomain()

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
        this.group.bind(client, () => this.client.waitOnline(), {
          removeConversationLocal: (conversationId) => this.chat.removeConversationLocal(conversationId),
          updateConversationName: (conversationId, name) => this.chat.updateConversationName(conversationId, name),
          insertGroupNotice: (groupId, text) => this.chat.insertGroupNotice(groupId, text)
        })
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
    // 群快照读内存（SDK 后台同步），失败不阻塞登录链路
    this.group.getJoinedGroups().catch(() => {})
  }

  // 登出：先退出当前会话，再断开 SDK，最后清空所有账号私有状态。
  // 不清的话，同一设备换账号会看到上一个账号的会话/消息/联系人/草稿/邀请（联调双账号时必踩）。
  async logout(): Promise<void> {
    try {
      this.chat.leaveConversation()
    } catch (e) {}
    try {
      await this.client.logout()
    } finally {
      this.chat.reset()
      this.contact.reset()
      this.group.reset()
      clearConversations()
      clearMessages()
      clearUsers()
      clearAllDrafts()
    }
  }

  // ext：业务上下文载荷（多场景直进会话时携带订单/商品/来源页等），与引用/提及内部 key 合并
  async sendText(to: string, chatType: ConversationTypeValue, text: string, quote?: EmQuoteInfo, mentions?: string[], ext?: Record<string, unknown>): Promise<EmMessageItem> {
    await this.client.whenReady()
    return this.chat.sendText(to, chatType, text, quote, mentions, ext)
  }

  // 自定义消息（卡片消息主通道）：接收侧经 #custom-message 插槽按 customEvent 渲染
  async sendCustom(to: string, chatType: ConversationTypeValue, event: string, params?: Record<string, string>, ext?: Record<string, unknown>): Promise<EmMessageItem> {
    await this.client.whenReady()
    return this.chat.sendCustom(to, chatType, event, params, ext)
  }

  makeQuote(item: EmMessageItem): EmQuoteInfo {
    return this.chat.makeQuote(item)
  }

  async sendImage(to: string, chatType: ConversationTypeValue, image: EmPickedImage): Promise<EmMessageItem> {
    await this.client.whenReady()
    return this.chat.sendImage(to, chatType, image)
  }

  async sendAudio(to: string, chatType: ConversationTypeValue, filePath: string, duration: number): Promise<EmMessageItem> {
    await this.client.whenReady()
    return this.chat.sendAudio(to, chatType, filePath, duration)
  }

  async sendVideo(to: string, chatType: ConversationTypeValue, video: EmPickedVideo): Promise<EmMessageItem> {
    await this.client.whenReady()
    return this.chat.sendVideo(to, chatType, video)
  }

  async sendFile(to: string, chatType: ConversationTypeValue, file: EmPickedFile): Promise<EmMessageItem> {
    await this.client.whenReady()
    return this.chat.sendFile(to, chatType, file)
  }

  async loadHistory(conversationId: string, chatType: ConversationTypeValue, pageSize?: number): Promise<void> {
    await this.client.whenReady()
    return this.chat.loadHistory(conversationId, chatType, pageSize)
  }

  async syncConversations(): Promise<void> {
    await this.client.whenReady()
    return this.chat.syncConversations()
  }

  async enterConversation(conversationId: string, chatType: ConversationTypeValue): Promise<void> {
    await this.client.whenReady()
    return this.chat.enterConversation(conversationId, chatType)
  }

  async pinConversation(conversationId: string, chatType: ConversationTypeValue, pinned: boolean): Promise<void> {
    await this.client.whenReady()
    return this.chat.pinConversation(conversationId, chatType, pinned)
  }

  async deleteConversation(conversationId: string, chatType: ConversationTypeValue): Promise<void> {
    await this.client.whenReady()
    return this.chat.deleteConversation(conversationId, chatType)
  }

  async clearConversationMessages(conversationId: string, chatType: ConversationTypeValue): Promise<void> {
    await this.client.whenReady()
    return this.chat.clearConversationMessages(conversationId, chatType)
  }

  async setConversationMuted(conversationId: string, chatType: ConversationTypeValue, muted: boolean): Promise<void> {
    await this.client.whenReady()
    return this.chat.setConversationMuted(conversationId, chatType, muted)
  }

  // 本地构造会话插列表（发起会话用，不调 SDK 建会话 API，对齐 vue 版 new-chat-modal 语义）
  addConversation(conversationId: string, chatType: ConversationTypeValue): void {
    this.chat.addConversation(conversationId, chatType)
  }

  async recallMessage(conversationId: string, chatType: ConversationTypeValue, messageId: string): Promise<void> {
    await this.client.whenReady()
    return this.chat.recallMessage(conversationId, chatType, messageId)
  }

  deleteLocalMessage(conversationId: string, localId: string): void {
    this.chat.deleteLocalMessage(conversationId, localId)
  }

  async resendMessage(conversationId: string, chatType: ConversationTypeValue, localId: string): Promise<void> {
    await this.client.whenReady()
    return this.chat.resendMessage(conversationId, chatType, localId)
  }

  async sendTyping(conversationId: string, chatType: ConversationTypeValue): Promise<void> {
    await this.client.whenReady()
    return this.chat.sendTyping(conversationId, chatType)
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

  /** 订阅流式消息更新（M2.13，AI 流式输出）：分片合批后回调，msg.stream 携带最新全文/状态；
   *  返回取消函数（页面 onUnmounted 必须调用）。渲染由 store 响应式驱动，此订阅供外部副作用使用 */
  onStreamMessage(handler: EmMessageHandler): () => void {
    return this.chat.onStreamMessage(handler)
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

  // ===== 群数据层（M2.9 Phase 1） =====

  // 已加入群快照整量回写（SDK 后台同步，读本地快照）
  async getJoinedGroups(): Promise<EmGroup[]> {
    await this.client.whenReady()
    return this.group.getJoinedGroups()
  }

  // 进群预热（对齐 enterConversation 的 fire-and-forget 用法）：拉群详情 + 成员首屏，失败静默
  async enterGroup(groupId: string): Promise<void> {
    await this.client.whenReady()
    this.group.getGroupInfo(groupId).catch(() => {})
    this.group.getGroupMemberList(groupId).catch(() => {})
  }

  async getGroupInfo(groupId: string): Promise<EmGroup> {
    await this.client.whenReady()
    return this.group.getGroupInfo(groupId)
  }

  async getGroupMemberList(groupId: string, cursor?: string, pageSize?: number): Promise<{ items: EmGroupMember[], cursor: string, hasMore: boolean }> {
    await this.client.whenReady()
    return this.group.getGroupMemberList(groupId, cursor, pageSize)
  }

  async getGroupAnnouncement(groupId: string): Promise<string> {
    await this.client.whenReady()
    return this.group.getGroupAnnouncement(groupId)
  }

  async createGroup(params: CreateGroupParams): Promise<string> {
    await this.client.whenReady()
    return this.group.createGroup(params)
  }

  async inviteUsersToGroup(groupId: string, userIds: string[]): Promise<void> {
    await this.client.whenReady()
    return this.group.inviteUsersToGroup(groupId, userIds)
  }

  // 接受/拒绝群邀请（group kind 申请；接受成功内部刷新群快照）
  async acceptGroupInvite(invite: EmContactInvite): Promise<void> {
    await this.client.whenReady()
    return this.group.acceptGroupInvite(invite)
  }

  async declineGroupInvite(invite: EmContactInvite): Promise<void> {
    await this.client.whenReady()
    return this.group.declineGroupInvite(invite)
  }

  async leaveGroup(groupId: string): Promise<void> {
    await this.client.whenReady()
    return this.group.leaveGroup(groupId)
  }

  async destroyGroup(groupId: string): Promise<void> {
    await this.client.whenReady()
    return this.group.destroyGroup(groupId)
  }

  async changeGroupOwner(groupId: string, userId: string): Promise<void> {
    await this.client.whenReady()
    return this.group.changeGroupOwner(groupId, userId)
  }

  async updateGroupInfo(groupId: string, partial: { name?: string, description?: string, avatar?: string }): Promise<void> {
    await this.client.whenReady()
    return this.group.updateGroupInfo(groupId, partial)
  }

  async updateGroupAnnouncement(groupId: string, content: string): Promise<void> {
    await this.client.whenReady()
    return this.group.updateGroupAnnouncement(groupId, content)
  }

  async removeGroupMembers(groupId: string, userIds: string[]): Promise<void> {
    await this.client.whenReady()
    return this.group.removeGroupMembers(groupId, userIds)
  }

  async addGroupAdmin(groupId: string, userId: string): Promise<void> {
    await this.client.whenReady()
    return this.group.addGroupAdmin(groupId, userId)
  }

  async removeGroupAdmin(groupId: string, userId: string): Promise<void> {
    await this.client.whenReady()
    return this.group.removeGroupAdmin(groupId, userId)
  }

  async muteAllGroupMembers(groupId: string): Promise<void> {
    await this.client.whenReady()
    return this.group.muteAllGroupMembers(groupId)
  }

  async unmuteAllGroupMembers(groupId: string): Promise<void> {
    await this.client.whenReady()
    return this.group.unmuteAllGroupMembers(groupId)
  }

  // 系统提示消息（本地灰条，不发服务端）：交易状态/医疗提示/客服转接等场景通用
  insertLocalNotice(conversationId: string, chatType: ConversationTypeValue, text: string): void {
    this.chat.insertLocalNotice(conversationId, chatType, text)
  }

  // 群系统通知（本地灰条，不发服务端）：建群成功等本地链路插通知的入口
  insertGroupNotice(groupId: string, text: string): void {
    this.chat.insertGroupNotice(groupId, text)
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
export {
  useTheme,
  initTheme,
  setTheme,
  getTheme,
  syncNativeThemeUI,
  THEME_STORAGE_KEY
} from './use/useTheme'
export type { EmThemeInitOptions, EmThemeSyncOptions } from './use/useTheme'
export { useLocale, mergeMessages } from './use/useLocale'
export { useSafeArea, getSafeAreaBottom, getSafeAreaTop } from './use/useSafeArea'
export { nextZIndex } from './use/usePopup'
export { useConfig, setConfig } from './store/config'
export { themeStore } from './store/theme'
export { userStore, displayNameOf, avatarOf, mergeUserInfo } from './store/user'
export { contactStore, contactDisplayNameOf, pendingInviteCount, contactRequestUnreadCount } from './store/contact'
export { conversationStore, totalConversationUnread, conversationUnreadCountOf } from './store/conversation'
export { useUnreadCounts, getUnreadCounts, useConversationUnreadCount } from './use/useUnreadCounts'
export type { EmUnreadCounts } from './use/useUnreadCounts'
export { useTabBarBadge, syncTabBarBadges } from './use/useTabBarBadge'
export type { EmTabBarBadgeOptions, EmTabBarBadgeController } from './use/useTabBarBadge'
export { groupStore, groupDisplayNameOf, groupMemberDisplayNameOf, sortGroupMembers } from './store/group'
export { ensureUserInfos } from './chat/user-info'
export { setPinyinAdapter, groupContacts, matchContact, resolveAlphabetKeyByOffsetY } from './utils/pinyin'
export type { EmPinyinResult, EmContactGroup } from './utils/pinyin'
export { filterActiveMentions, parseMentions } from './utils/mention'
export type { EmMentionSegment } from './utils/mention'
export { isStreamActive, isStreamTerminal, isPlainTextStream, isRichStream } from './utils/stream'
export { ensureSdkModule, setSdkLoader, setSdkModule } from './client/sdk'
export type { EmSdkModule } from './client/sdk'
export { createLogger, setLogLevel, getLogLevel, getLogText, clearLogBuffer, getLogBufferSize } from './utils/logger'
export type { EmLogger } from './utils/logger'
