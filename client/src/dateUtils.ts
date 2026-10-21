const DAY_MS = 86_400_000

function utcCalendarDay(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

export function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

export function formatUtcTaskDate(value: string | null, includeYear = false) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' as const } : {}),
    timeZone: 'UTC',
  }).format(new Date(utcCalendarDay(value)))
}

export function formatUtcDashboardDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(utcCalendarDay(value)))
}

export function daysUntilUtc(value: string, now = new Date()) {
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.floor((utcCalendarDay(value) - todayStart) / DAY_MS)
}

function localCalendarDay(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatLocalTaskDate(value: string | null) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(localCalendarDay(value))
}

export function daysUntilLocal(value: string, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const target = localCalendarDay(value).getTime()
  return Math.round((target - today) / DAY_MS)
}
