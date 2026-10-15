// EmChat 门面：对外类名与方法签名保持不变（libs/index.ts 的 EmKitImpl 纯透传）。
// 内部按域拆分——消息生命周期域（含 typing 信令）在 ./message（EmMessageDomain），
// 会话域（列表同步/置顶/免打扰/删除/清空 + wire 映射）在 ./conversation（EmConversationDomain）；
// 本文件只做两件事：组合两个域模块、bind() 里接线 SDK ChatManager 事件并按域分发。
// SDK wire 协议字段的兼容映射保留在各域文件的边界处（规范允许的例外）。
import type { ChatClient, Message } from 'easemob-websdk'
import { CONVERSATION_TYPE } from '../constants'
import { conversationStore } from '../store/conversation'
import { createLogger } from '../utils/logger'
import type { EmKitConfig, EmMessageHandler, EmMessageItem, EmQuoteInfo } from '../types'
import type { EmPickedFile, EmPickedImage, EmPickedVideo } from '../platform'
import { bindUserInfo, ensureUserInfos } from './user-info'
import { EmConversationDomain } from './conversation'
import { EmMessageDomain } from './message'
import type { EmChatContext } from './message'

const logger = createLogger('chat')

export class EmChat {
  private ctx: EmChatContext = { client: null, waitOnline: null }
  private messages = new EmMessageDomain(this.ctx)
  private conversations = new EmConversationDomain(this.ctx, this.messages)
  private bound = false

  bind(client: ChatClient, waitOnline: () => Promise<void>, config?: EmKitConfig): void {
    if (this.bound) {
      return
    }
    this.bound = true
    this.ctx.client = client
    this.ctx.waitOnline = waitOnline
    this.messages.readReceiptOn = config?.enableReadReceipt !== false
    bindUserInfo(client)
    client.chatManager.addEventHandler('emkit-message', {
      onMessage: (message: Message) => {
        // SDK wire 边界：cmd 信号消息（typing 等）不落消息列表，在此拦截
        if ((message.type as string) === 'cmd') {
          this.messages.onCmdMessage(message)
          return
        }
        const item = this.messages.toMessageItem(message)
        this.messages.appendMessage(item)
        this.messages.notify(item)
        ensureUserInfos([item.from])
        // 在当前会话收到对方消息：即时回已读回执
        if (!item.self && item.conversationId === this.conversations.currentConversationId) {
          this.messages.sendReadReceipts(item.conversationId).catch(() => {})
        }
      },
      onConversationListUpdate: (payload) => {
        logger.debug('onConversationListUpdate raw payload:', JSON.parse(JSON.stringify(payload)))
        conversationStore.items = payload.items
          .filter((c) => c.conversationType === CONVERSATION_TYPE.SINGLE_CHAT)
          .map((c) => this.conversations.toConversationItem(c))
        ensureUserInfos(conversationStore.items.map((c) => c.conversationId))
      },
      onMessageRecalled: (payload) => {
        this.messages.markRecalled(payload.conversationId, payload.messageId)
      },
      onMessageReadReceipts: (receipts) => {
        receipts.forEach((r) => {
          this.messages.applyPeerReadTime(r.conversationType, r.conversationId, r.timestamp)
        })
      }
    })
  }

  get readReceiptEnabled(): boolean {
    return this.messages.readReceiptOn
  }

  // 返回取消函数（unsubscriber）：宿主页面卸载时调用，防 handlers 泄漏叠加触发
  onMessage(handler: EmMessageHandler): () => void {
    return this.messages.onMessage(handler)
  }

  async sendText(to: string, text: string, quote?: EmQuoteInfo): Promise<EmMessageItem> {
    return this.messages.sendText(to, text, quote)
  }

  makeQuote(item: EmMessageItem): EmQuoteInfo {
    return this.messages.makeQuote(item)
  }

  async sendImage(to: string, image: EmPickedImage): Promise<EmMessageItem> {
    return this.messages.sendImage(to, image)
  }

  async sendAudio(to: string, filePath: string, duration: number): Promise<EmMessageItem> {
    return this.messages.sendAudio(to, filePath, duration)
  }

  async sendVideo(to: string, video: EmPickedVideo): Promise<EmMessageItem> {
    return this.messages.sendVideo(to, video)
  }

  async sendFile(to: string, file: EmPickedFile): Promise<EmMessageItem> {
    return this.messages.sendFile(to, file)
  }

  async loadHistory(conversationId: string, pageSize = 20): Promise<void> {
    return this.messages.loadHistory(conversationId, pageSize)
  }

  async syncConversations(): Promise<void> {
    return this.conversations.syncConversations()
  }

  async enterConversation(conversationId: string): Promise<void> {
    return this.conversations.enterConversation(conversationId)
  }

  leaveConversation(): void {
    this.conversations.leaveConversation()
  }

  async pinConversation(conversationId: string, pinned: boolean): Promise<void> {
    return this.conversations.pinConversation(conversationId, pinned)
  }

  async deleteConversation(conversationId: string): Promise<void> {
    return this.conversations.deleteConversation(conversationId)
  }

  async clearConversationMessages(conversationId: string): Promise<void> {
    return this.conversations.clearConversationMessages(conversationId)
  }

  async setConversationMuted(conversationId: string, muted: boolean): Promise<void> {
    return this.conversations.setConversationMuted(conversationId, muted)
  }

  async recallMessage(conversationId: string, messageId: string): Promise<void> {
    return this.messages.recallMessage(conversationId, messageId)
  }

  deleteLocalMessage(conversationId: string, localId: string): void {
    this.messages.deleteLocalMessage(conversationId, localId)
  }

  async resendMessage(conversationId: string, localId: string): Promise<void> {
    return this.messages.resendMessage(conversationId, localId)
  }

  async sendTyping(conversationId: string): Promise<void> {
    return this.messages.sendTyping(conversationId)
  }
}
