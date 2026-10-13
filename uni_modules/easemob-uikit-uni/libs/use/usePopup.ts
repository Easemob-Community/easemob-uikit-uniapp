import { ref } from 'vue'
import type { Ref } from 'vue'

// z-index 运行时递增分配器（基准 2000），模块级计数器；
// 弹层类组件（em-popup 及上层）open 时各取一个新值，保证后开者在上
const Z_INDEX_BASE = 2000
let zIndexSeed = Z_INDEX_BASE

export function nextZIndex(): number {
  zIndexSeed += 1
  return zIndexSeed
}

// 底部安全区高度；H5 上 safeAreaInsets 可能缺失，兜底 0
export function getSafeAreaBottom(): number {
  return uni.getWindowInfo().safeAreaInsets?.bottom ?? 0
}

// 小程序/App 的原生 tabBar 渲染在页面层之上，页面内弹层（无论 z-index 多高）都盖不住，
// 只能弹层打开时 hideTabBar、全部关闭后 showTabBar。模块级计数器防嵌套弹层中途闪回。
// H5 的 tabBar 是 DOM 内组件，弹层可直接覆盖，无需处理。
let tabBarHoldCount = 0

export function holdTabBar(): void {
  // #ifdef MP-WEIXIN || APP
  tabBarHoldCount += 1
  if (tabBarHoldCount === 1) {
    uni.hideTabBar({ animation: false, fail: () => {} })
  }
  // #endif
}

export function releaseTabBar(): void {
  // #ifdef MP-WEIXIN || APP
  tabBarHoldCount = Math.max(0, tabBarHoldCount - 1)
  if (tabBarHoldCount === 0) {
    uni.showTabBar({ animation: false, fail: () => {} })
  }
  // #endif
}

export interface UsePopupResult {
  visible: Ref<boolean>
  zIndex: Ref<number>
  open: () => void
  close: () => void
}

export function usePopup(): UsePopupResult {
  const visible = ref(false)
  const zIndex = ref(Z_INDEX_BASE)

  function open(): void {
    zIndex.value = nextZIndex()
    visible.value = true
  }

  function close(): void {
    visible.value = false
  }

  return { visible, zIndex, open, close }
}
