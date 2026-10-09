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
