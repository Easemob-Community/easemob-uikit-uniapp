// Demo 宿主侧卡片解析（不是 UIKit）：演示「#custom-message 插槽 + 自定义 event → 卡片数据」的完整做法。
// UIKit 只负责收发 custom 消息与提供插槽；卡片字段、样式、多语言、动作全由宿主决定。
// 新增一种卡片 = 在 KIND_BY_EVENT 加一行 +（可选）在 demoCardOf 里补宿主逻辑 + 在 catalog 加一条数据。
import type { EmMessageItem } from '@/uni_modules/easemob-uikit-uni/libs'

export const DEMO_UNKNOWN_EVENT = 'demoUnregisteredCard'

export type DemoCardKind = 'default' | 'order' | 'profile' | 'document' | 'action'

export interface DemoCardField {
  label: string
  value: string
}

export interface DemoCardData {
  title: string
  subtitle?: string
  badge?: string
  icon?: string
  fields?: DemoCardField[]
  footer?: string
  actionText?: string
  actionKey?: string
  secondaryText?: string
  secondaryKey?: string
}

// 宿主自己的 event → 视觉族映射（UIKit 不知道这些业务事件）
const KIND_BY_EVENT: Record<string, DemoCardKind> = {
  orderCard: 'order',
  serviceTicket: 'order',
  refundReview: 'action',
  medicalCase: 'document',
  prescription: 'document',
  productCard: 'order',
  priceOffer: 'action',
  resumeCard: 'profile',
  interviewInvite: 'action',
  phoneExchange: 'profile',
  homeworkCard: 'document',
  leaveApproval: 'action',
  activityCard: 'action',
  gearList: 'document'
}

export function demoCardKindOf(event: string): DemoCardKind {
  const kind = KIND_BY_EVENT[event]
  return kind != null ? kind : 'default'
}

function readString(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  return typeof value === 'string' ? value : ''
}

function readFields(source: Record<string, unknown>): DemoCardField[] {
  const raw = source['fields']
  if (!Array.isArray(raw)) {
    return []
  }
  const rows: DemoCardField[] = []
  raw.forEach((item) => {
    if (item == null || typeof item !== 'object') {
      return
    }
    const row = item as Record<string, unknown>
    const label = readString(row, 'label')
    const value = readString(row, 'value')
    if (label !== '' && value !== '') {
      rows.push({ label, value })
    }
  })
  return rows
}

function maskPhone(phone: string): string {
  if (phone.length < 7) {
    return phone
  }
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`
}

/** 宿主解析：只处理自己认识的 event；未知 event 返回 null，由宿主决定回落样式 */
export function demoCardOf(message: EmMessageItem): DemoCardData | null {
  if (KIND_BY_EVENT[message.customEvent] == null) {
    return null
  }
  const ext = message.ext
  const title = readString(ext, 'title')
  if (title === '') {
    return null
  }
  const card: DemoCardData = { title }
  const subtitle = readString(ext, 'subtitle')
  if (subtitle !== '') {
    card.subtitle = subtitle
  }
  const badge = readString(ext, 'badge')
  if (badge !== '') {
    card.badge = badge
  }
  const icon = readString(ext, 'icon')
  if (icon !== '') {
    card.icon = icon
  }
  const fields = readFields(ext)
  if (fields.length > 0) {
    card.fields = fields
  }
  const footer = readString(ext, 'footer')
  if (footer !== '') {
    card.footer = footer
  }
  const actionText = readString(ext, 'actionText')
  if (actionText !== '') {
    card.actionText = actionText
    card.actionKey = readString(ext, 'actionKey')
  }
  const secondaryText = readString(ext, 'secondaryText')
  if (secondaryText !== '') {
    card.secondaryText = secondaryText
    card.secondaryKey = readString(ext, 'secondaryKey')
  }
  // 宿主业务逻辑示例：手机号存明文在 wire params，渲染前统一脱敏（UIKit 不参与）
  if (message.customEvent === 'phoneExchange') {
    const phone = message.customParams['phone'] ?? ''
    if (phone !== '') {
      const rows = card.fields != null ? card.fields.slice(0) : []
      rows.push({ label: '联系方式', value: maskPhone(phone) })
      card.fields = rows
    }
  }
  return card
}
