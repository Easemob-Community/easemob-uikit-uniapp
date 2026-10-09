import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { themeStore } from '../store/theme'
import type { EmThemeMode } from '../types'

// 主题 composable：setTheme 切换明暗；themeClass 供页面级组件根节点绑定
// （App 端无 :root 可用，主题 class 必须挂组件根节点，RiceUI trick）
export function useTheme() {
  const themeClass: ComputedRef<string> = computed(() => `em-theme-${themeStore.mode}`)

  function setTheme(mode: EmThemeMode): void {
    themeStore.mode = mode
  }

  function getTheme(): EmThemeMode {
    return themeStore.mode
  }

  return { themeStore, themeClass, setTheme, getTheme }
}
