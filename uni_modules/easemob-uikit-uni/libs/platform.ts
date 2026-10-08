// 平台适配层：存储 / 网络 / 媒体差异统一收口，组件不直接碰平台 API。
// M0 阶段先收口存储（localStorage 在 App 端 js 引擎不可用，一律走 uni.setStorage）。

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
