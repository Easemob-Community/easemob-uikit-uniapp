import { themeStore } from '../store/theme'
import type { EmLocaleName } from '../types'
import zhCN from '../locale/zh-CN'
import en from '../locale/en'

const messages: Record<EmLocaleName, Record<string, string>> = {
  'zh-CN': zhCN,
  en
}

// i18n composable：t(key) 查扁平表，支持 {name} 插值；
// 缺 key 回退 zh-CN，再回退 key 本身。文案无硬编码，组件内一律走 t()
export function useLocale() {
  function t(key: string, params?: Record<string, string | number>): string {
    const table = messages[themeStore.locale]
    let text = table[key]
    if (text == null) text = messages['zh-CN'][key]
    if (text == null) return key
    if (params != null) {
      Object.keys(params).forEach((name) => {
        text = (text as string).replace(`{${name}}`, `${params[name]}`)
      })
    }
    return text
  }

  function setLocale(locale: EmLocaleName): void {
    themeStore.locale = locale
  }

  function getLocale(): EmLocaleName {
    return themeStore.locale
  }

  return { t, setLocale, getLocale }
}
