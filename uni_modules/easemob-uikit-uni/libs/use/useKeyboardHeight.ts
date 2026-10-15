import { onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'

// 软键盘高度 composable：uni.onKeyboardHeightChange 事件封装，五端统一入口（App/MP/H5 均可用）。
// keyboardHeight > 0 即键盘弹起；消费点：聊天页键盘弹起滚底、输入栏手动避让顶起与面板高度对齐。
// 每个调用方各自注册/反注册一对监听（inputbar 与 chat-page 各一份，成本可忽略）。
//
// 平台差异（对齐 hello-uni-app-x keyboard-adjust 官方示例）：
// - iOS/鸿蒙上报的键盘高度已含底部安全区，需扣除，否则输入栏过顶（Android/小程序/H5 不扣）
// - 返回值可直接写（如 input blur 时清零兜底：部分端键盘收起可能不补发 0 高度事件）

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
  // offXxx 按 id 反注册
  const listenerId = uni.onKeyboardHeightChange(onChange)
  onUnmounted(() => {
    uni.offKeyboardHeightChange(listenerId)
  })
  return { keyboardHeight }
}
