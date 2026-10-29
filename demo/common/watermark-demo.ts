import { computed, reactive } from 'vue'
import { EmKit, displayNameOf } from '@/uni_modules/easemob-uikit-uni/libs'

// Demo 水印偏好（M2.27）：与 vue 版 demo 的「水印」开关同语义，文案 = 当前用户昵称 + userId。
// 偏好持久化在设备本地，默认关闭；各页面把 text 透传给 watermark prop（关闭时为空串 → 不显示）。
const STORAGE_KEY = 'emkit.demo.watermark'

const watermarkState = reactive({ enabled: false })

try {
  watermarkState.enabled = uni.getStorageSync(STORAGE_KEY) === true
} catch (e) {
  // 存储不可用时保持默认关闭
}

export function useDemoWatermark() {
  const enabled = computed(() => watermarkState.enabled)

  const text = computed(() => {
    if (!watermarkState.enabled) return ''
    const userId = EmKit.state.userId
    if (userId === '') return ''
    const name = displayNameOf(userId)
    return name !== '' && name !== userId ? `${name} ${userId}` : userId
  })

  function toggle(): void {
    watermarkState.enabled = !watermarkState.enabled
    try {
      uni.setStorageSync(STORAGE_KEY, watermarkState.enabled)
    } catch (e) {
      // 持久化失败不影响本次会话内生效
    }
  }

  return { enabled, text, toggle }
}
