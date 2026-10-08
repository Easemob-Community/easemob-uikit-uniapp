import type { ChatClient, Message, TextMessageBody } from 'easemob-websdk'
import { connectionStore } from '../store/connection'
import type { EmTextMessageHandler, EmTextMessageItem } from '../types'

// 消息收发：5.x ChatManager 封装
export class EmChat {
  private client: ChatClient | null = null
  private textHandler: EmTextMessageHandler | null = null

  bind(client: ChatClient): void {
    if (this.client != null) {
      return
    }
    this.client = client
    client.addEventHandler('emkit-message', {
      onMessage: (message: Message) => {
        if (message.type !== 'text' || this.textHandler == null) {
          return
        }
        this.textHandler({
          id: message.msgServerId !== '' ? message.msgServerId : message.msgLocalId,
          from: message.from,
          to: message.to,
          text: (message.body as TextMessageBody).content,
          time: message.timestamp,
          self: message.from === connectionStore.userId
        })
      }
    })
  }

  onTextMessage(handler: EmTextMessageHandler): void {
    this.textHandler = handler
  }

  async sendText(to: string, text: string): Promise<void> {
    const chatManager = this.client?.chatManager
    if (chatManager == null) {
      throw new Error('call EmKit.init() first')
    }
    const message = chatManager.createTextMessage({
      conversationId: to,
      conversationType: 'singleChat',
      content: text
    })
    const sent = await chatManager.sendMessage(message)
    if (this.textHandler != null) {
      this.textHandler({
        id: sent.msgServerId !== '' ? sent.msgServerId : sent.msgLocalId,
        from: connectionStore.userId,
        to,
        text,
        time: sent.timestamp,
        self: true
      })
    }
  }
}
