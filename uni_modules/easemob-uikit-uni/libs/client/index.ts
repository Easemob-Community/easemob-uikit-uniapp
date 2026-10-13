import { ChatClient, ChatManager, PushManager } from 'easemob-websdk'
import { CONNECTION_STATUS } from '../constants'
import { connectionStore } from '../store/connection'
import type { EmKitConfig, EmLoginOptions } from '../types'

// 客户端生命周期：初始化 / 登录 / 登出 / 连接事件
export class EmClient {
  private client: ChatClient | null = null

  init(config: EmKitConfig): ChatClient {
    if (this.client != null) {
      return this.client
    }
    const client = ChatClient.init({
      appKey: config.appkey,
      managers: [ChatManager, PushManager]
    })
    client.addEventHandler('emkit-connection', {
      onConnected: () => {
        connectionStore.status = CONNECTION_STATUS.ONLINE
      },
      onDisconnected: () => {
        connectionStore.status = CONNECTION_STATUS.CLOSED
      }
    })
    connectionStore.appkey = config.appkey
    this.client = client
    return client
  }

  get raw(): ChatClient | null {
    return this.client
  }

  async login(options: EmLoginOptions): Promise<void> {
    if (this.client == null) {
      throw new Error('call EmKit.init() first')
    }
    connectionStore.status = CONNECTION_STATUS.CONNECTING
    try {
      await this.client.login({ userId: options.userId, token: options.token })
      connectionStore.userId = options.userId
      connectionStore.status = CONNECTION_STATUS.ONLINE
    } catch (e) {
      connectionStore.status = CONNECTION_STATUS.CLOSED
      throw e
    }
  }

  async logout(): Promise<void> {
    if (this.client == null) {
      return
    }
    await this.client.logout()
    connectionStore.status = CONNECTION_STATUS.CLOSED
    connectionStore.userId = ''
  }

  // login resolve ≠ socket 就绪：发送/拉历史前统一等 onConnected
  waitOnline(timeout = 8000): Promise<void> {
    if (connectionStore.status === CONNECTION_STATUS.ONLINE) {
      return Promise.resolve()
    }
    return new Promise<void>((resolve, reject) => {
      const start = Date.now()
      const timer = setInterval(() => {
        if (connectionStore.status === CONNECTION_STATUS.ONLINE) {
          clearInterval(timer)
          resolve()
        } else if (Date.now() - start > timeout) {
          clearInterval(timer)
          reject(new Error('waitOnline timeout'))
        }
      }, 100)
    })
  }
}
