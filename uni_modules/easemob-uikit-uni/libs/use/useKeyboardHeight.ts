import { onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'

// 软键盘高度 composable：uni.onKeyboardHeightChange 事件封装，App/小程序统一入口。
// keyboardHeight > 0 即键盘弹起；消费点：聊天页键盘弹起滚底、输入栏手动避让顶起与面板高度对齐。
// 每个调用方各自注册/反注册一对监听（inputbar 与 chat-page 各一份，成本可忽略）。
//
// 平台差异（对齐 hello-uni-app-x keyboard-adjust 官方示例）：
// - iOS/鸿蒙上报的键盘高度已含底部安全区，需扣除，否则输入栏过顶（Android/小程序不扣）
// - 返回值可直接写（如 input blur 时清零兜底：部分端键盘收起可能不补发 0 高度事件）
//
// H5 特别说明（P0）：uni-app x 的 H5 运行时没有实现 uni.onKeyboardHeightChange，
// 编译器会把该调用原样留成裸全局 `uni.*`（H5 的 window.uni 只有统计 report），
// 调用即 TypeError。该 composable 在 em-chat-page / em-chat-inputbar 的 setup 顶部执行，
// 一旦抛出会导致整个聊天页挂载失败（白屏）。故 H5 分支不注册监听：
// 浏览器自己处理 visualViewport/滚动，input 的 adjust-position 在 H5 也是无效属性。

export function useKeyboardHeight(): { keyboardHeight: Ref<number> } {
  const keyboardHeight = ref(0)
  const onChange = (res: { height: number }): void => {
    let height = res.height
    // #ifdef APP-IOS || APP-HARMONY
    if (height > 0) {
      height -= uni.getWindowInfo().safeAreaInsets?.bottom ?? 0
    }
    // #endif
    keyboardHeight.value = height
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
  return { keyboardHeight }
}
