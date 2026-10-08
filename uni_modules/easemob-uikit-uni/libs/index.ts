import { EmClient } from './client'
import { EmChat } from './chat'
import { connectionStore } from './store/connection'
import type {
  EmKitConfig,
  EmLoginOptions,
  EmTextMessageHandler
} from './types'

// EmKit 门面：对外唯一入口，内部按功能拆分（client / chat / store / platform）
class EmKitImpl {
  readonly state = connectionStore

  private client = new EmClient()
  private chat = new EmChat()

  init(config: EmKitConfig): void {
    const client = this.client.init(config)
    this.chat.bind(client)
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

  onTextMessage(handler: EmTextMessageHandler): void {
    this.chat.onTextMessage(handler)
  }
}

export const EmKit = new EmKitImpl()

export * from './types'
