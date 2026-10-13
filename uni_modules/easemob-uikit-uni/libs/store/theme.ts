import { reactive } from 'vue'
import { LOCALE, THEME_MODE } from '../constants'
import type { EmLocaleName, EmThemeMode } from '../types'

// 主题与语言全局唯一 store（裸 reactive，零依赖）
export const themeStore = reactive({
  mode: THEME_MODE.LIGHT as EmThemeMode,
  locale: LOCALE.ZH_CN as EmLocaleName
})
