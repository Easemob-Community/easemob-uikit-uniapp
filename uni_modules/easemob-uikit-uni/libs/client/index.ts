import type { ChatClient, LogEntry } from 'easemob-websdk'
import { CONNECTION_STATUS, LOG_LEVEL } from '../constants'
import { connectionStore } from '../store/connection'
import { applyKitConfig } from '../store/config'
import { createLogger, setLogLevel } from '../utils/logger'
import type { EmKitConfig, EmLoginOptions } from '../types'
import { ensureSdkModule, setSdkLoader, setSdkModule } from './sdk'

const logger = createLogger('client')
// SDK onLog 转发出口（ns 独立，方便单独过滤 SDK 侧日志）
const sdkLogger = createLogger('sdk')

// 客户端生命周期：初始化 / 登录 / 登出 / 连接事件
// 初始化三阶段（PLAN.md M2.8，对齐分包异步化指南）：SDK 模块加载（ensureSdkModule，
// 小程序分包场景异步）→ ChatClient.init → login，各阶段 Promise 缓存、失败清缓存可重试。
export class EmClient {
  private client: ChatClient | null = null
  private initPromise: Promise<ChatClient> | null = null

  init(config: EmKitConfig): void {
    if (this.initPromise != null) {
      return
    }
    // UI 行为维度（draft/typing/菜单/输入栏功能集/品牌色等）与 uikit logger 级别保持同步生效；
    // SDK 侧日志管理（setSdkLogLevel/setConsoleLogEnabled 为 SDK 模块级函数）在模块就绪后接线
    applyKitConfig(config)
    setLogLevel(config.logLevel ?? LOG_LEVEL.INFO)
    // SDK 模块就绪门：非小程序端为微任务级直通，小程序分包场景为真实异步
    this.initPromise = this.doInit(config)
  }

  /** client 就绪门：所有依赖 SDK 的入口先经此等待；未 init 时 reject（保持「call EmKit.init() first」语义） */
  whenReady(): Promise<ChatClient> {
    if (this.initPromise == null) {
      return Promise.reject(new Error('call EmKit.init() first'))
    }
    return this.initPromise
  }

  private async doInit(config: EmKitConfig): Promise<ChatClient> {
    try {
      // 宿主可经 EmKitConfig.sdkLoader/sdkModule 覆盖 SDK 来源（如自管理分包加载与预下载）
      if (config.sdkLoader != null) {
        setSdkLoader(config.sdkLoader)
      }
      if (config.sdkModule != null) {
        setSdkModule(config.sdkModule)
      }
      const sdk = await ensureSdkModule()
      // SDK 自身日志管理（模块级函数，非 client 方法）
      sdk.setLogLevel(config.sdkLogLevel ?? 'WARN')
      sdk.setConsoleLogEnabled(config.sdkConsoleLog !== false)
      const client = sdk.ChatClient.init({
        appKey: config.appkey,
        // 登录后自动同步会话 + 联系人（SDK 默认只同步 conversation，contact 需显式选择——
        // 未选时 getContacts() 只能读到本地缓存残留，小程序端即「永远空」的根因；
        // 对齐 vue 版 uikit-im 场景默认 ['conversation','contact','group']）。
        // 不含 'group'：SDK 校验 group 同步依赖 GroupManager，未注册会直接抛错，二期开群时再补
        enableSyncData: ['conversation', 'contact'],
        managers: [sdk.ChatManager, sdk.PushManager, sdk.UserInfoManager, sdk.ContactManager]
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
    } catch (e) {
      // 失败清缓存（如分包首次加载失败）：宿主修正后可重新 init 重试
      this.initPromise = null
      logger.error('init failed:', e)
      throw e
    }
  }

  get raw(): ChatClient | null {
    return this.client
  }

  async login(options: EmLoginOptions): Promise<void> {
    const client = await this.whenReady()
    connectionStore.status = CONNECTION_STATUS.CONNECTING
    try {
      await client.login({ userId: options.userId, token: options.token })
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
