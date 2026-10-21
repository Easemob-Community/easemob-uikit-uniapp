import type { ChatClient, LogEntry } from 'easemob-websdk'
import { CONNECTION_STATUS, LOG_LEVEL } from '../constants'
import { connectionStore } from '../store/connection'
import { applyKitConfig } from '../store/config'
import { setLocale } from '../use/useLocale'
import { createLogger, setLogLevel } from '../utils/logger'
import type { EmKitConfig, EmLoginOptions, EmTokenRenewalResult } from '../types'
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
  // init 配置留存：Token 生命周期回调（onTokenWillExpire/onTokenExpired）在连接事件里消费
  private config: EmKitConfig | null = null

  init(config: EmKitConfig): void {
    if (this.initPromise != null) {
      return
    }
    this.config = config
    // UI 行为维度（draft/typing/菜单/输入栏功能集/品牌色等）与 uikit logger 级别保持同步生效；
    // SDK 侧日志管理（setSdkLogLevel/setConsoleLogEnabled 为 SDK 模块级函数）在模块就绪后接线
    applyKitConfig(config)
    setLogLevel(config.logLevel ?? LOG_LEVEL.INFO)
    if (config.locale != null) setLocale(config.locale)
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
        // 登录后自动同步会话 + 联系人 + 群（SDK 默认只同步 conversation，contact/group 需显式选择——
        // 未选时 getContacts()/getJoinedGroupList() 只能读到本地缓存残留，小程序端即「永远空」的根因；
        // 对齐 vue 版 uikit-im 场景默认 ['conversation','contact','group']）。
        // enableSyncData 与 managers 必须成对：含 'group' 而未注册 GroupManager 会直接抛错
        enableSyncData: ['conversation', 'contact', 'group'],
        managers: [sdk.ChatManager, sdk.PushManager, sdk.UserInfoManager, sdk.ContactManager, sdk.GroupManager]
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
        // 首次连接 vs 自动重连：attempt>0 视为重连，宿主可据此显示「连接中/重连中」
        onConnecting: (payload) => {
          const attempt = payload.attempt ?? 0
          const reconnecting = attempt > 0
          connectionStore.status = reconnecting ? CONNECTION_STATUS.RECONNECTING : CONNECTION_STATUS.CONNECTING
          connectionStore.reconnecting = reconnecting
          connectionStore.reconnectAttempt = attempt
          connectionStore.reason = payload.reason
        },
        onConnected: (payload) => {
          connectionStore.status = CONNECTION_STATUS.ONLINE
          connectionStore.reason = payload.reason
          connectionStore.errorCode = 0
          connectionStore.reconnecting = false
          connectionStore.reconnectAttempt = 0
          logger.info('connected')
        },
        onDisconnected: (payload) => {
          connectionStore.status = CONNECTION_STATUS.CLOSED
          connectionStore.reason = payload.reason
          connectionStore.errorCode = payload.errorCode ?? 0
          connectionStore.reconnecting = false
          logger.warn('disconnected:', payload.reason, payload.errorCode ?? 0)
        },
        // 自动重连达到上限：状态落 CLOSED，原因/错误码透出给宿主做「重新登录/检查网络」引导
        onReconnectFailed: (payload) => {
          connectionStore.status = CONNECTION_STATUS.CLOSED
          connectionStore.reason = payload.reason
          connectionStore.errorCode = payload.errorCode ?? 0
          connectionStore.reconnecting = false
          logger.warn('reconnect failed:', payload.reason, payload.errorCode ?? 0)
        },
        // Token 生命周期：约 80% 生命周期触发续期；过期时回落宿主回调（通常跳登录页）
        onTokenWillExpire: () => {
          void this.handleTokenWillExpire()
        },
        onTokenExpired: () => {
          connectionStore.status = CONNECTION_STATUS.CLOSED
          connectionStore.reason = 'token-expired'
          connectionStore.reconnecting = false
          logger.warn('token expired')
          try {
            this.config?.onTokenExpired?.()
          } catch (e) {
            logger.error('onTokenExpired handler fail:', e)
          }
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

  /** Token 续期（宿主拿服务端新 token 后调用；配置了 EmKitConfig.onTokenWillExpire 时 UIKit 自动调） */
  async renewToken(token: string): Promise<EmTokenRenewalResult> {
    const client = await this.whenReady()
    const result = await client.renewToken(token)
    return { token: result.token, expireAt: result.expireAt }
  }

  // onTokenWillExpire 续期：回调返回新 token 才 renew；失败只记录，SDK 仍会在过期时触发 onTokenExpired
  private async handleTokenWillExpire(): Promise<void> {
    const handler = this.config?.onTokenWillExpire
    if (handler == null) {
      logger.warn('token will expire: no onTokenWillExpire handler, call EmKit.renewToken manually')
      return
    }
    try {
      const token = await handler()
      if (typeof token !== 'string' || token === '') {
        logger.warn('onTokenWillExpire returned empty token, skip renew')
        return
      }
      await this.renewToken(token)
      logger.info('token renewed')
    } catch (e) {
      logger.error('token renew failed:', e)
    }
  }

  async login(options: EmLoginOptions): Promise<void> {
    const client = await this.whenReady()
    connectionStore.status = CONNECTION_STATUS.CONNECTING
    connectionStore.reason = ''
    connectionStore.errorCode = 0
    connectionStore.reconnecting = false
    connectionStore.reconnectAttempt = 0
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
    connectionStore.reason = ''
    connectionStore.errorCode = 0
    connectionStore.reconnecting = false
    connectionStore.reconnectAttempt = 0
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
