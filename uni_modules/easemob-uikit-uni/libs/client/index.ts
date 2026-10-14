import { ChatClient, ChatManager, ContactManager, PushManager, UserInfoManager, setConsoleLogEnabled, setLogLevel as setSdkLogLevel } from 'easemob-websdk'
import type { LogEntry } from 'easemob-websdk'
import { CONNECTION_STATUS, LOG_LEVEL } from '../constants'
import { connectionStore } from '../store/connection'
import { createLogger, setLogLevel } from '../utils/logger'
import type { EmKitConfig, EmLoginOptions } from '../types'

const logger = createLogger('client')
// SDK onLog 转发出口（ns 独立，方便单独过滤 SDK 侧日志）
const sdkLogger = createLogger('sdk')

// 客户端生命周期：初始化 / 登录 / 登出 / 连接事件
export class EmClient {
  private client: ChatClient | null = null

  init(config: EmKitConfig): ChatClient {
    if (this.client != null) {
      return this.client
    }
    // uikit logger 级别 + SDK 日志管理（SDK 导出的是模块级函数，非 client 方法）
    setLogLevel(config.logLevel ?? LOG_LEVEL.INFO)
    setSdkLogLevel(config.sdkLogLevel ?? 'WARN')
    setConsoleLogEnabled(config.sdkConsoleLog !== false)
    const client = ChatClient.init({
      appKey: config.appkey,
      // 登录后自动同步会话 + 联系人（SDK 默认只同步 conversation，contact 需显式选择——
      // 未选时 getContacts() 只能读到本地缓存残留，小程序端即「永远空」的根因；
      // 对齐 vue 版 uikit-im 场景默认 ['conversation','contact','group']）。
      // 不含 'group'：SDK 校验 group 同步依赖 GroupManager，未注册会直接抛错，二期开群时再补
      enableSyncData: ['conversation', 'contact'],
      managers: [ChatManager, PushManager, UserInfoManager, ContactManager]
    })
    // SDK 结构化日志（已脱敏）统一转发进 uikit logger：sdkConsoleLog 关闭后此通道仍在，
    // 业务侧只需盯 `emkit:` 前缀一条日志 funnel
    client.addEventHandler('emkit-log', {
      onLog: (entry: LogEntry) => {
        if (entry.level === 'DEBUG') {
          sdkLogger.debug(entry.message, ...entry.args)
        } else if (entry.level === 'WARN') {
          sdkLogger.warn(entry.message, ...entry.args)
        } else {
          sdkLogger.error(entry.message, ...entry.args)
        }
      }
    })
    client.addEventHandler('emkit-connection', {
      onConnected: () => {
        connectionStore.status = CONNECTION_STATUS.ONLINE
        logger.info('connected')
      },
      onDisconnected: () => {
        connectionStore.status = CONNECTION_STATUS.CLOSED
        logger.warn('disconnected')
      }
    })
    connectionStore.appkey = config.appkey
    this.client = client
    logger.info('init ok, appkey:', config.appkey)
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
      logger.info('login success:', options.userId)
    } catch (e) {
      connectionStore.status = CONNECTION_STATUS.CLOSED
      logger.error('login failed:', options.userId, e)
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
