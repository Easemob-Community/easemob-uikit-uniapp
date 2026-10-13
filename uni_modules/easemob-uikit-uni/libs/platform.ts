// 平台适配层：存储 / 网络 / 媒体差异统一收口，组件不直接碰平台 API。
// localStorage 在 App 端 js 引擎不可用，一律走 uni.setStorage。

export function setStorage(key: string, value: string): void {
  try {
    uni.setStorageSync(key, value)
  } catch (e) {
    console.error('[emkit] setStorage fail:', key, e)
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

export function removeStorage(key: string): void {
  try {
    uni.removeStorageSync(key)
  } catch (e) {}
}

// 媒体选择收口：返回本地临时文件路径列表
export function chooseImage(count = 1): Promise<string[]> {
  return new Promise((resolve, reject) => {
    uni.chooseImage({
      count,
      success: (res) => {
        resolve(res.tempFilePaths as string[])
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
    // App 端没有跨端通用文件选择器（需 uts 插件或原生 intent），一期空实现待真机验证后补齐
    console.warn('[emkit] chooseFile: App 端暂不支持文件选择')
    resolve(null)
    // #endif
  })
}

export interface EmRecordResult {
  path: string
  duration: number  // 秒
}

let recording = false
let recordStartAt = 0
let recordStopResolve: ((res: EmRecordResult) => void) | null = null

// 录音：微信/App 走 uni.getRecorderManager；H5 不支持，调用即抛错（组件层 catch 降级）
export function startRecord(): void {
  // #ifdef WEB
  console.warn('[emkit] startRecord: H5 不支持录音')
  throw new Error('record not supported on web')
  // #endif
  // #ifndef WEB
  const manager = uni.getRecorderManager()
  manager.onStop((res) => {
    recording = false
    const ms = res.duration > 0 ? res.duration : Date.now() - recordStartAt
    const resolve = recordStopResolve
    recordStopResolve = null
    if (resolve != null) {
      resolve({ path: res.tempFilePath, duration: Math.round(ms / 1000) })
    }
  })
  recordStartAt = Date.now()
  recording = true
  manager.start({ duration: 60000, format: 'aac' })
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
    uni.getRecorderManager().stop()
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
