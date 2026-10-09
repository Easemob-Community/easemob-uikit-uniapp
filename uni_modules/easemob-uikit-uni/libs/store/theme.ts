import { reactive } from 'vue'
import type { EmLocaleName, EmThemeMode } from '../types'

// 主题与语言全局唯一 store（裸 reactive，零依赖）
export const themeStore = reactive({
  mode: 'light' as EmThemeMode,
  locale: 'zh-CN' as EmLocaleName
})
