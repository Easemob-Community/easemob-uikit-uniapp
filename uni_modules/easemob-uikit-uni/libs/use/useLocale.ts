import { reactive } from 'vue'
import { themeStore } from '../store/theme'
import { LOCALE } from '../constants'
import type { EmLocaleName } from '../types'
import zhCN from '../locale/zh-CN'
import en from '../locale/en'

// 文案表为可变 store（reactive）：zh-CN/en 为初始值，业务方可经 mergeMessages 运行时
// 注入新语言或覆盖既有文案（i18n 注入口）；t() 读取口径与 key 不变
const messages = reactive<Record<string, Record<string, string>>>({
  [LOCALE.ZH_CN]: { ...zhCN },
  [LOCALE.EN]: { ...en }
})

/** 运行时合并文案表：同 locale 浅合并（覆盖同 key），新 locale 直接挂载 */
export function mergeMessages(locale: EmLocaleName, table: Record<string, string>): void {
  messages[locale] = { ...(messages[locale] ?? {}), ...table }
}

// i18n composable：t(key) 查扁平表，支持 {name} 插值；
// 缺 key 回退 zh-CN，再回退 key 本身。文案无硬编码，组件内一律走 t()
export function useLocale() {
  function t(key: string, params?: Record<string, string | number>): string {
    const table = messages[themeStore.locale]
    let text = table[key]
    if (text == null) text = messages[LOCALE.ZH_CN][key]
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
