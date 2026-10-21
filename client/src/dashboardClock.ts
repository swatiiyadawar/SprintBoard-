export type Greeting = 'Good morning' | 'Good afternoon' | 'Good evening'

export function getGreeting(now: Date): Greeting {
  const hour = now.getHours()
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function localDateKey(now: Date) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatLocalDashboardDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

export function formatLocalShortDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

export function nextDashboardRefreshDelay(now: Date) {
  const boundaries = [0, 5, 12, 17].map((hour) => {
    const date = new Date(now)
    date.setHours(hour, 0, 0, 0)
    if (date <= now) date.setDate(date.getDate() + 1)
    return date.getTime()
  })
  return Math.max(1, Math.min(...boundaries) - now.getTime())
}
