export type TodoDueDateQuickOption = {
  readonly value: string
  readonly label: string
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000

function getUtcDayNumber(localDateString: string): number {
  const [year, month, day] = localDateString.split('-').map(Number)
  return Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY
}

export function addDaysToLocalDateString(
  localDateString: string,
  days: number,
): string {
  const [year, month, day] = localDateString.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)

  const nextYear = date.getFullYear()
  const nextMonth = String(date.getMonth() + 1).padStart(2, '0')
  const nextDay = String(date.getDate()).padStart(2, '0')
  return `${nextYear}-${nextMonth}-${nextDay}`
}

export function getTodoDueDateQuickOptions(
  today: string,
): readonly TodoDueDateQuickOption[] {
  return [
    { value: today, label: '今日' },
    { value: addDaysToLocalDateString(today, 1), label: '明日' },
    { value: addDaysToLocalDateString(today, 7), label: '1週間後' },
    { value: '', label: '期限なし' },
  ]
}

export function getTodoDueDateRelativeLabel(
  dueDate: string,
  today: string,
): string {
  const remainingDays = Math.round(
    getUtcDayNumber(dueDate) - getUtcDayNumber(today),
  )

  if (remainingDays < 0) {
    return `${Math.abs(remainingDays)}日超過`
  }
  if (remainingDays === 0) {
    return '今日まで'
  }
  return `あと${remainingDays}日`
}
