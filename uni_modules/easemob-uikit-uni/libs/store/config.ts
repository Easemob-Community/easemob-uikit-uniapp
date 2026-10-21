import { reactive } from 'vue'
import {
  CONVERSATION_MENU_KEY,
  DEFAULT_EMOJI_LIST,
  MESSAGE_MENU_KEY,
  RECALL_TIME_LIMIT,
  STREAM_FLUSH_INTERVAL,
  TIME_DIVIDER_INTERVAL,
  TYPING_THROTTLE,
  TYPING_TIMEOUT
} from '../constants'
import type { EmKitConfig, EmUiConfig } from '../types'

// 全局 UI 行为配置 store（三层混合配置体系的全局层：EmKitConfig 行为开关）。
// 默认值全部与整改前行为一致（零行为变更）；RECALL_TIME_LIMIT/TYPING_*/TIME_DIVIDER_INTERVAL
// 等 constants 降级为「默认值来源」，运行时经 EmKit.init 或 setConfig 覆盖。
export const uiConfig = reactive<EmUiConfig>({
  enableDraft: true,
  enableTyping: true,
  recallTimeLimit: RECALL_TIME_LIMIT,
  typingThrottle: TYPING_THROTTLE,
  typingTimeout: TYPING_TIMEOUT,
  timeDividerInterval: TIME_DIVIDER_INTERVAL,
  enableStreamMessage: true,
  streamThrottle: STREAM_FLUSH_INTERVAL,
  inputFeatures: { voice: true, emoji: true, image: true, camera: true, video: true, file: true },
  messageMenuKeys: [MESSAGE_MENU_KEY.COPY, MESSAGE_MENU_KEY.QUOTE, MESSAGE_MENU_KEY.RECALL, MESSAGE_MENU_KEY.DELETE],
  conversationMenuKeys: [CONVERSATION_MENU_KEY.PIN, CONVERSATION_MENU_KEY.MUTE, CONVERSATION_MENU_KEY.DELETE],
  emojiList: DEFAULT_EMOJI_LIST,
  primaryColor: '',
  logPayload: false
})

/** 运行时合并（一层深合并：inputFeatures 字段级合并，其余顶层键整体替换） */
export function setConfig(partial: Partial<EmUiConfig>): void {
  Object.keys(partial).forEach((k) => {
    const key = k as keyof EmUiConfig
    const value = partial[key]
    if (value === undefined) return
    if (key === 'inputFeatures' && typeof value === 'object' && value !== null) {
      Object.assign(uiConfig.inputFeatures, value)
    } else {
      ;(uiConfig as Record<string, unknown>)[key] = value
    }
  })
}

// 配置 composable：config 为全量 resolved 的响应式 uiConfig；宿主可用 setConfig 运行时覆盖
export function useConfig() {
  return { config: uiConfig, setConfig }
}

/** 品牌色内联样式片段：页面级组件根节点绑定（App 端无 :root，变量随根节点内联下行，同 RiceUI trick）。
 *  未配置品牌色时返回空串（零样式变更） */
export function primaryColorStyle(): string {
  return uiConfig.primaryColor !== '' ? `--em-primary-color: ${uiConfig.primaryColor};` : ''
}

/** EmKit.init 接线：把 EmKitConfig 的可选 UI 维度写进 uiConfig（未传保持默认，零行为变更） */
export function applyKitConfig(kitConfig: EmKitConfig): void {
  const patch: Partial<EmUiConfig> = {}
  if (kitConfig.enableDraft !== undefined) patch.enableDraft = kitConfig.enableDraft
  if (kitConfig.enableTyping !== undefined) patch.enableTyping = kitConfig.enableTyping
  if (kitConfig.recallTimeLimit !== undefined) patch.recallTimeLimit = kitConfig.recallTimeLimit
  if (kitConfig.typingThrottle !== undefined) patch.typingThrottle = kitConfig.typingThrottle
  if (kitConfig.typingTimeout !== undefined) patch.typingTimeout = kitConfig.typingTimeout
  if (kitConfig.timeDividerInterval !== undefined) patch.timeDividerInterval = kitConfig.timeDividerInterval
  if (kitConfig.enableStreamMessage !== undefined) patch.enableStreamMessage = kitConfig.enableStreamMessage
  if (kitConfig.streamThrottle !== undefined) patch.streamThrottle = kitConfig.streamThrottle
  if (kitConfig.inputFeatures != null) patch.inputFeatures = { ...uiConfig.inputFeatures, ...kitConfig.inputFeatures }
  if (kitConfig.messageMenuKeys != null) patch.messageMenuKeys = [...kitConfig.messageMenuKeys]
  if (kitConfig.conversationMenuKeys != null) patch.conversationMenuKeys = [...kitConfig.conversationMenuKeys]
  if (kitConfig.emojiList != null) patch.emojiList = [...kitConfig.emojiList]
  if (kitConfig.logPayload !== undefined) patch.logPayload = kitConfig.logPayload
  setConfig(patch)
  if (kitConfig.primaryColor != null && kitConfig.primaryColor !== '') {
    uiConfig.primaryColor = kitConfig.primaryColor
    // #ifdef WEB
    document.documentElement.style.setProperty('--em-primary-color', kitConfig.primaryColor)
    // #endif
  }
}
