// 平台适配层：存储 / 网络 / 媒体差异统一收口，组件不直接碰平台 API。
// localStorage 在 App 端 js 引擎不可用，一律走 uni.setStorage。

import { createLogger } from './utils/logger'

const logger = createLogger('platform')

/**
 * 平台能力开关（1.0 功能显隐）：
 * 不支持的端在 UI 侧直接隐藏入口，避免「点一下只弹暂不支持」的坏体验。
 * 平台差异只允许出现在本文件（#ifdef），组件消费布尔值，不再散落条件编译。
 */
export interface EmPlatformCapabilities {
  /** 视频播放/预览：一期仅 H5（window.open）；App/小程序原生播放器待接 */
  videoPreview: boolean
  /** 发送文件时的文件选择：一期小程序 + H5；App 无通用选择器 */
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
  // App 端没有跨端通用文件选择器（需 uts 插件或原生 intent），入口隐藏；
  // chooseFile 的 APP 分支保留为后续接入点（当前返回 null 并 warn）
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

export interface EmPickedFile {
  path: string              // App/小程序临时路径；H5 恒为 ''
  name: string
  size: number              // 字节
  webFile: unknown | null   // H5 的 File 对象（SDK 上传需要 File），其它端恒 null
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
    // App 端没有跨端通用文件选择器（需 uts 插件或原生 intent）。
    // 一期先按平台隐藏「文件」入口（PLATFORM_CAPABILITIES.filePick=false），
    // 这里保留空实现作为后续接入点；正常 UI 路径不会调到。
    logger.warn('chooseFile: App 端暂不支持文件选择')
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
// 小程序/App 写用户数据目录（resolve 文件路径）；失败 reject 由调用方兜底剪贴板
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
      const env = (uni as unknown as { env?: { USER_DATA_PATH?: string } }).env
      const filePath = `${env?.USER_DATA_PATH ?? ''}/${filename}`
      fs.writeFile({
        filePath,
        data: content,
        encoding: 'utf8',
        success: () => resolve(filePath),
        fail: (e) => reject(new Error(e?.errMsg ?? 'writeFile fail'))
      })
    } catch (e) {
      reject(e)
    }
    // #endif
  })
}

// 剪贴板兜底（日志导出降级、复制类功能共用）；失败静默
export function copyText(text: string): void {
  try {
    uni.setClipboardData({ data: text })
  } catch (e) {}
}
