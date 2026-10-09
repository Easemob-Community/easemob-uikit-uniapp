// 相对时间格式化：今天 HH:mm / 昨天 / 周几（一周内）/ YYYY/M/D
import { useLocale } from '../use/useLocale'

const WEEKDAY_KEYS = [
  'time.sunday',
  'time.monday',
  'time.tuesday',
  'time.wednesday',
  'time.thursday',
  'time.friday',
  'time.saturday'
]

function pad(n: number): string {
  return n < 10 ? '0' + n : '' + n
}

export function formatTimeHM(time: number): string {
  const d = new Date(time)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatConversationTime(time: number): string {
  if (time <= 0) return ''
  const { t } = useLocale()
  const d = new Date(time)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  if (time >= startOfToday) {
    return formatTimeHM(time)
  }
  if (time >= startOfToday - 86400000) {
    return t('time.yesterday')
  }
  if (time >= startOfToday - 6 * 86400000) {
    return t(WEEKDAY_KEYS[d.getDay()])
  }
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}
