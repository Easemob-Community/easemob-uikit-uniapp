// 引用（quote）展示映射纯函数：聊天页引用卡与输入栏引用条共用，收敛两处拷贝（行为不变，依赖注入）：
// - 摘要/发送人文案依赖 locale 与用户信息 store，以函数参数注入（本文件不反向依赖 use/store）
// - 类名由调用方传入（引用卡与引用条的宿主 class 不同），避免 utils 反向依赖组件命名
import { MESSAGE_TYPE } from '../constants'
import type { EmQuoteInfo } from '../types'
import type { EmIconName } from '../../components/em-icon/em-icons'

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

/** 摘要后缀（冒号按 locale 的 summary 模板拼，发送人单列以便套 medium 字重） */
export function quoteSuffixOf(q: EmQuoteInfo | null, t: TranslateFn): string {
  if (q == null) return ''
  return t('message.quote.summary', { from: '', text: q.text })
}

/** 引用发送者展示名（用户资料昵称优先，回落原始 userId；displayName 由调用方注入） */
export function quoteSenderOf(from: string, displayName: (userId: string) => string): string {
  return displayName(from)
}

/** 引用文字 class：base + 可选 self 修饰（类名由调用方传入，引用卡与引用条宿主不同） */
export function quoteTextClassOf(self: boolean, baseClass: string, selfClass: string): string {
  return self ? `${baseClass} ${selfClass}` : baseClass
}

/** 引用文字内联样式基串（小程序样式隔离，见 em-text 注释） */
export const QUOTE_TEXT_STYLE_BASE =
  'font-family: var(--em-font-family); font-size: var(--em-font-size-13); line-height: 18px; color: var(--em-text-secondary);'

/** 引用文字内联样式：己方追加右对齐 */
export function quoteTextStyleOf(self: boolean): string {
  return self ? `${QUOTE_TEXT_STYLE_BASE} text-align: right;` : QUOTE_TEXT_STYLE_BASE
}

/** 非文本引用在文本流开头带类型图标（文本不带） */
export function quoteHasIcon(type: string | undefined): boolean {
  return type === MESSAGE_TYPE.IMAGE || type === MESSAGE_TYPE.VIDEO || type === MESSAGE_TYPE.AUDIO || type === MESSAGE_TYPE.FILE
}

/** 引用类型图标（em-icons 现有映射里语义最近的） */
export function quoteIconNameOf(type: string | undefined): EmIconName {
  if (type === MESSAGE_TYPE.IMAGE) return 'image'
  if (type === MESSAGE_TYPE.VIDEO) return 'videocam'
  if (type === MESSAGE_TYPE.AUDIO) return 'sound'
  if (type === MESSAGE_TYPE.FILE) return 'paperclip'
  return 'more'
}
