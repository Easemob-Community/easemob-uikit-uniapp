// 平台适配层：存储 / 网络 / 媒体差异统一收口，组件不直接碰平台 API。
// localStorage 在 App 端 js 引擎不可用，一律走 uni.setStorage。

import { createLogger } from './utils/logger'
import type { EmAttachment } from './types'

const logger = createLogger('platform')

/**
 * 平台能力开关（1.0 功能显隐）：
 * 不支持的端在 UI 侧直接隐藏入口，避免「点一下只弹暂不支持」的坏体验。
 * 平台差异只允许出现在本文件（#ifdef），组件消费布尔值，不再散落条件编译。
 */
export interface EmPlatformCapabilities {
  /** 视频播放/预览：一期仅 H5（window.open）；App/小程序原生播放器待接 */
  videoPreview: boolean
  /** 内置文件选择：小程序 + H5；App 无内置选择器（宿主注入附件能力后由 libs/attachment.ts 调起） */
  filePick: boolean
  /** 文件打开/下载：一期全端未接，气泡点击入口先隐藏 */
  fileOpen: boolean
}

function detectPlatformCapabilities(): EmPlatformCapabilities {
  const caps: EmPlatformCapabilities = {
    videoPreview: false,
    filePick: true,
    fileOpen: false
  }
  // #ifdef WEB
  caps.videoPreview = true
  // #endif
  // #ifdef APP
  // 内置选择器在 App 端不可用；宿主可经 EmKit.setAttachmentProvider 注入平台文件选择能力，
  // UI 显隐统一读 libs/attachment.ts 的 canPickAttachment()（本开关只表示“内置能力”）
  caps.filePick = false
  // #endif
  return caps
}

/** 当前端能力快照（组件只读；平台分支集中在 detectPlatformCapabilities） */
export const PLATFORM_CAPABILITIES: EmPlatformCapabilities = detectPlatformCapabilities()

/**
 * 页面是否可见：H5 标签页隐藏时，当前会话收到消息不应清未读/发已读回执。
 * App/小程序没有跨端统一的页面可见 API，默认 true（退化为原行为）。
 */
export function isPageVisible(): boolean {
  // #ifdef WEB
  return typeof document === 'undefined' || document.visibilityState === 'visible'
  // #endif
  // #ifndef WEB
  return true
  // #endif
}

// ========== 网络状态收口 ==========

/**
 * 监听网络连通性变化，返回取消函数（`uni.onXxx` 在 x 端返回监听 id，`offXxx` 按 id 反注册）。
 *
 * 只用 `uni.onNetworkStatusChange`，**不探测 `uni.getNetworkType`**：两者同属 iOS/Android 的
 * `uni-getNetworkType` UTS 模块，旧自定义基座若没把该模块编进去，调用会抛
 * `undefined class: UTSSDKModulesDCloudUniGetNetworkTypeIndexSwift`。websdk 5.1.3 默认 runtime
 * 适配器在 `onNetworkChange` 里既调 `onNetworkStatusChange` 又同步调 `getNetworkType`，
 * 而 SDK 在建连（login）阶段就注册网络监听 → 该异常会直接表现为「登录失败」。
 * 这里再兜一层 try/catch：基座缺模块时降级为不监听（SDK 仍有心跳/重连循环），不让登录被拖死。
 */
export function subscribeNetworkStatus(listener: (online: boolean) => void): () => void {
  try {
    if (typeof uni.onNetworkStatusChange !== 'function') {
      return () => {}
    }
    const id = uni.onNetworkStatusChange((res) => {
      listener(res.isConnected)
    })
    return () => {
      try {
        uni.offNetworkStatusChange(id)
      } catch (e) {}
    }
  } catch (e) {
    logger.warn('subscribeNetworkStatus: 网络状态监听不可用（基座可能缺 uni-getNetworkType 模块）', e)
    return () => {}
  }
}

export function setStorage(key: string, value: string): void {
  try {
    uni.setStorageSync(key, value)
  } catch (e) {
    logger.error('setStorage fail:', key, e)
  }
}

export function getStorage(key: string): string {
  try {
    const value = uni.getStorageSync(key) as string | null
    return value ?? ''
  } catch (e) {
    return ''
  }
}

export interface EmPickedImage {
  path: string              // 本地临时路径（H5 为 blob URL，仅用于本地预览）
  name: string
  size: number              // 字节（部分端可能为 0）
  webFile: unknown | null   // H5 的 File 对象（SDK 上传需要 File），其它端恒 null
}

function fileNameOf(path: string): string {
  const idx = path.lastIndexOf('/')
  return idx >= 0 ? path.slice(idx + 1) : path
}

// 媒体选择收口：SDK 5.x createXxxMessage 的 data 不收字符串路径，
// 必须 File（H5）或 MiniAppFile { path, name, size }（小程序/App），这里把两端的素材都带齐
// sourceType 'camera' 即拍摄（小程序/App 调起相机；H5 浏览器无相机概念，一律退化为文件选择器）
export function chooseImage(count = 1, sourceType: 'album' | 'camera' = 'album'): Promise<EmPickedImage[]> {
  return new Promise((resolve, reject) => {
    uni.chooseImage({
      count,
      sourceType: [sourceType],
      success: (res) => {
        const paths = res.tempFilePaths as string[]
        const files = (res.tempFiles ?? []) as Array<{ path?: string, size?: number, name?: string }>
        resolve(paths.map((p, i) => {
          const f = files[i]
          // #ifdef WEB
          // H5 的 tempFiles 是 File 对象，SDK 上传直接用它
          return { path: p, name: f?.name ?? fileNameOf(p), size: f?.size ?? 0, webFile: f ?? null }
          // #endif
          // #ifndef WEB
          return { path: p, name: fileNameOf(f?.path ?? p), size: f?.size ?? 0, webFile: null }
          // #endif
        }))
      },
      fail: (e) => {
        reject(e)
      }
    })
  })
}

export function previewImage(urls: string[], current: string): void {
  uni.previewImage({ urls, current })
}

// ========== 媒体选择 / 录音 / 播放收口 ==========

export interface EmPickedVideo {
  path: string
  name: string
  duration: number  // 秒
  width: number
  height: number
  size: number      // 字节
}

// 取消/失败统一 resolve(null)，组件层不区分
export function chooseVideo(): Promise<EmPickedVideo | null> {
  return new Promise((resolve) => {
    // H5 的 uni.chooseVideo 支持度有限（依赖浏览器文件选择与视频元数据解析），失败同样回落 null
    uni.chooseVideo({
      sourceType: ['album'],
      success: (res) => {
        resolve({
          path: res.tempFilePath,
          name: fileNameOf(res.tempFilePath),
          duration: Math.round(res.duration ?? 0),
          width: res.width ?? 0,
          height: res.height ?? 0,
          size: res.size ?? 0
        })
      },
      fail: () => {
        resolve(null)
      }
    })
  })
}

/** 内置选择器产物 / 宿主附件能力的可发送形态；H5 的 File 走 webFile，其它端走本地路径 */
export interface EmPickedFile extends EmAttachment {
  webFile?: unknown | null   // H5 的 File 对象（SDK 上传需要 File），其它端为 null
}

export function chooseFile(): Promise<EmPickedFile | null> {
  return new Promise((resolve) => {
    // #ifdef MP-WEIXIN
    uni.chooseMessageFile({
      count: 1,
      type: 'file',
      success: (res) => {
        const f = res.tempFiles[0]
        resolve({ path: f.path, name: f.name, size: f.size, webFile: null })
      },
      fail: () => {
        resolve(null)
      }
    })
    // #endif
    // #ifdef WEB
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = () => {
      const files = input.files
      if (files == null || files.length === 0) {
        resolve(null)
        return
      }
      const f = files[0]
      resolve({ path: '', name: f.name, size: f.size, webFile: f })
    }
    input.click()
    // #endif
    // #ifdef APP
    // App 端没有内置通用文件选择器：宿主注入附件能力后，UI 走 libs/attachment.ts 的 provider；
    // 直接调用本函数仍返回 null（保留旧行为，避免宿主误以为内置可用）。
    logger.warn('chooseFile: App 端无内置文件选择器，请使用 EmKit.setAttachmentProvider')
    resolve(null)
    // #endif
  })
}

export interface EmRecordResult {
  path: string
  duration: number  // 秒
}

/** 录音回调：权限/设备错误与 60s 自动停止（否则自动停止的音频会被静默丢弃） */
export interface EmRecordOptions {
  onError?: (err: unknown) => void
  onAutoStop?: (res: EmRecordResult) => void
}

let recording = false
let recordStartAt = 0
let recordStopResolve: ((res: EmRecordResult) => void) | null = null
let recordDiscarding = false
let recordOptions: EmRecordOptions = {}

// #ifndef WEB
let recorder: ReturnType<typeof uni.getRecorderManager> | null = null

// 单例注册 onStop/onError：每次 start 都 addEventHandler 会累积监听（真机反复录音后回调翻倍）
function ensureRecorder(): ReturnType<typeof uni.getRecorderManager> {
  if (recorder == null) {
    const manager = uni.getRecorderManager()
    recorder = manager
    manager.onStop((res) => {
      recording = false
      const ms = res.duration > 0 ? res.duration : Date.now() - recordStartAt
      const result: EmRecordResult = { path: res.tempFilePath, duration: Math.round(ms / 1000) }
      if (recordDiscarding) {
        // 取消语义：丢弃本次录音，不回调发送
        recordDiscarding = false
        recordStopResolve = null
        recordOptions = {}
        return
      }
      const resolve = recordStopResolve
      recordStopResolve = null
      if (resolve != null) {
        recordOptions = {}
        resolve(result)
        return
      }
      // 未主动 stop：只可能是 60s 上限自动停止，交给输入栏按正常语音发送
      const onAutoStop = recordOptions.onAutoStop
      recordOptions = {}
      if (onAutoStop != null) onAutoStop(result)
    })
    manager.onError((err) => {
      recording = false
      recordStopResolve = null
      const onError = recordOptions.onError
      recordOptions = {}
      if (onError != null) {
        onError(err)
      } else {
        logger.warn('recorder error:', err)
      }
    })
  }
  return recorder
}
// #endif

// 录音：微信/App 走 uni.getRecorderManager；H5 不支持，调用即抛错（组件层 catch 降级）
export function startRecord(options: EmRecordOptions = {}): void {
  // #ifdef WEB
  logger.warn('startRecord: H5 不支持录音')
  throw new Error('record not supported on web')
  // #endif
  // #ifndef WEB
  recordOptions = options
  recordStartAt = Date.now()
  recordDiscarding = false
  recordStopResolve = null
  recording = true
  try {
    ensureRecorder().start({ duration: 60000, format: 'aac' })
  } catch (e) {
    recording = false
    recordOptions = {}
    throw e
  }
  // #endif
}

// 取消录音：停止并丢弃（上滑取消手势用）
export function cancelRecord(): void {
  if (!recording) return
  recordDiscarding = true
  recordOptions = {}
  // #ifndef WEB
  ensureRecorder().stop()
  // #endif
}

export function stopRecord(): Promise<EmRecordResult> {
  return new Promise((resolve, reject) => {
    // #ifdef WEB
    reject(new Error('record not supported on web'))
    // #endif
    // #ifndef WEB
    if (!recording) {
      reject(new Error('not recording'))
      return
    }
    recordStopResolve = resolve
    ensureRecorder().stop()
    // #endif
  })
}

export function isRecording(): boolean {
  return recording
}

// 语音播放：全局互斥（播新停旧）；onEnd 在自然结束/出错/被顶替时回调
type EmAudioContext = ReturnType<typeof uni.createInnerAudioContext>
let audioCtx: EmAudioContext | null = null
let audioOnEnd: (() => void) | null = null

export function playAudio(url: string, onEnd: () => void): void {
  stopAudio()
  const ctx = uni.createInnerAudioContext()
  audioCtx = ctx
  audioOnEnd = onEnd
  ctx.src = url
  ctx.onEnded(() => {
    if (audioCtx === ctx) {
      audioCtx = null
    }
    ctx.destroy()
    onEnd()
  })
  ctx.onError(() => {
    if (audioCtx === ctx) {
      audioCtx = null
    }
    ctx.destroy()
    onEnd()
  })
  ctx.play()
}

export function stopAudio(): void {
  const ctx = audioCtx
  if (ctx != null) {
    audioCtx = null
    const onEnd = audioOnEnd
    audioOnEnd = null
    ctx.stop()
    ctx.destroy()
    // 被新播放顶替时也通知旧的调用方复位播放态
    if (onEnd != null) {
      onEnd()
    }
  }
}

// 导出文本文件（日志下载用）：H5 走 Blob + a[download]（resolve ''）；
// 小程序/App 写用户数据目录（resolve 文件路径）；失败 reject 由调用方兜底剪贴板。
// App 两个专属口径：
// 1) encoding 只能是 'utf-8'——App 的 FileSystemManager 只认 ascii/base64/utf-8，
//    传小程序惯用的 'utf8' 会直接 fail（错误码 1200002）；
// 2) App 的 USER_DATA_PATH 是应用沙盒（文件管理器不可见），返回路径只用于分享/回传，
//    不是「下载目录」；要取到文件得靠剪贴板或宿主自行 share/上传。
export function exportTextFile(filename: string, content: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    // #ifdef WEB
    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      resolve('')
    } catch (e) {
      reject(e)
    }
    // #endif
    // #ifndef WEB
    try {
      const fs = uni.getFileSystemManager()
      // 沙盒根目录缺失（基座缺 uni-fileSystemManager 模块等）时直接失败，别写出 "/xxx.txt" 这种坏路径
      const base = (uni.env.USER_DATA_PATH ?? '').replace(/\/+$/, '')
      if (base === '') {
        reject(new Error('USER_DATA_PATH unavailable'))
        return
      }
      const filePath = `${base}/${filename}`
      fs.writeFile({
        filePath,
        data: content,
        encoding: 'utf-8',
        success: () => resolve(filePath),
        fail: (e) => reject(new Error(e?.errMsg ?? 'writeFile fail'))
      })
    } catch (e) {
      reject(e)
    }
    // #endif
  })
}

// 剪贴板兜底（日志导出降级、复制类功能共用）；失败不阻塞业务，但要进日志便于排查
// （App 端超长文本可能超系统剪贴板限制，静默失败会让「已复制」的提示骗人）
export function copyText(text: string): void {
  try {
    uni.setClipboardData({
      data: text,
      fail: (e) => logger.warn('setClipboardData fail:', e?.errMsg ?? e)
    })
  } catch (e) {
    logger.warn('setClipboardData unavailable:', e)
  }
}
