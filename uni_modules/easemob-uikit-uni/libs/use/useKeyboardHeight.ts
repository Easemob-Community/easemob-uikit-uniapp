import { onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'

// 软键盘高度 composable：uni.onKeyboardHeightChange 事件封装，App/小程序统一入口。
// 每个调用方各自注册/反注册一对监听（inputbar 与 chat-page 各一份，成本可忽略）。
//
// 平台口径（鸿蒙已真机实测，改动前务必先读）：
// 同一个上报值有两种用法，不能混：
// - **面板口径**（keyboardHeight）：emoji/媒体面板的对齐高度。iOS/鸿蒙上报值已含底部安全区，
//   沿用历史口径扣除后交给面板（面板自身还有 safe-bottom padding），该口径本次不改动。
// - **上推口径**（keyboardLift）：输入栏 margin-bottom 的「从屏幕底边算起的实际遮挡高度」。
//   本库页面是边到边布局（页面底边 = 屏幕底边），所以要的是「键盘画到屏幕底的那一段」。
// - Android / 小程序：两种口径都等于上报值。
// - iOS：面板口径 = 上报值 - 安全区；上推口径沿用同一值（**未真机验证**，见 STATUS 待验；
//   若真机复现「输入栏被压一截」，按鸿蒙口径改成直接用上报值）。
// - 鸿蒙（2026-10-21 实测 6.0.1 / API 20，25PVB24711005055，density 3）：
//   上报 314vp == 屏幕高 804vp - 键盘上沿 490vp，**就是实际遮挡高度**（含手势导航条）；
//   `hidumper -s WindowManagerService` 里应用窗口 0..2412 全屏、手势导航条窗口 84px(=28vp)。
//   故上推口径直接用上报值；面板口径仍扣 28vp。
//   历史坑：原实现把面板口径（已扣安全区）直接当 margin-bottom → 输入栏整体低 28vp，被键盘压住 84px。
//
// 因此返回两个值：
// - keyboardHeight：面板口径（emoji/媒体面板按它对齐，口径与历史一致）
// - keyboardLift：底部输入栏的上推高度（= 键盘从屏幕底边实际遮挡的高度，写 margin-bottom 用）
// resetKeyboardHeight()：收起兜底（部分端键盘收起不补发 0 高度事件）
//
// H5 特别说明（P0）：uni-app x 的 H5 运行时没有实现 uni.onKeyboardHeightChange，
// 编译器会把该调用原样留成裸全局 `uni.*`（H5 的 window.uni 只有统计 report），
// 调用即 TypeError。该 composable 在 em-chat-page / em-chat-inputbar 的 setup 顶部执行，
// 一旦抛出会导致整个聊天页挂载失败（白屏）。故 H5 分支不注册监听：
// 浏览器自己处理 visualViewport/滚动，input 的 adjust-position 在 H5 也是无效属性。

export interface UseKeyboardHeightResult {
  /** 面板口径：emoji/媒体面板对齐高度（iOS/鸿蒙已扣底部安全区，沿用历史口径） */
  keyboardHeight: Ref<number>
  /** 上推口径：从屏幕底边算起的实际遮挡高度（鸿蒙 = 上报值，含导航条） */
  keyboardLift: Ref<number>
  /** 收起兜底：键盘高度与上推高度一起清零（blur / hideKeyboard 后调用） */
  resetKeyboardHeight: () => void
}

export function useKeyboardHeight(): UseKeyboardHeightResult {
  const keyboardHeight = ref(0)
  const keyboardLift = ref(0)

  const onChange = (res: { height: number }): void => {
    const reported = res.height > 0 ? res.height : 0
    let height = reported
    // 上推口径：App 端页面边到边，上报值即遮挡高度；iOS 沿用旧口径（未真机验证，见文件头）
    let lift = reported
    // #ifdef APP-IOS
    if (reported > 0) {
      height -= uni.getWindowInfo().safeAreaInsets?.bottom ?? 0
      lift = height
    }
    // #endif
    // #ifdef APP-HARMONY
    if (reported > 0) {
      height -= uni.getWindowInfo().safeAreaInsets?.bottom ?? 0
    }
    // #endif
    keyboardHeight.value = height > 0 ? height : 0
    keyboardLift.value = lift > 0 ? lift : 0
  }

  function resetKeyboardHeight(): void {
    keyboardHeight.value = 0
    keyboardLift.value = 0
  }

  // uni-app x 的 uni.onXxx 统一返回监听 id（App 蒸汽端与 VDOM 端同语义，与经典 uni-app 的按函数引用反注册不同），
  // offXxx 按 id 反注册。
  // H5 无此 API（见文件头），条件编译保证 H5 产物里不出现该调用。
  let listenerId: number | null = null
  // #ifndef WEB
  listenerId = uni.onKeyboardHeightChange(onChange)
  // #endif
  onUnmounted(() => {
    // #ifndef WEB
    if (listenerId != null) {
      uni.offKeyboardHeightChange(listenerId)
    }
    // #endif
  })
  return { keyboardHeight, keyboardLift, resetKeyboardHeight }
}
