import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatLocalDashboardDate, getGreeting, localDateKey, nextDashboardRefreshDelay } from './dashboardClock.ts'

test('greeting follows local hour boundaries', () => {
  assert.equal(getGreeting(new Date(2026, 0, 2, 4, 59)), 'Good evening')
  assert.equal(getGreeting(new Date(2026, 0, 2, 5, 0)), 'Good morning')
  assert.equal(getGreeting(new Date(2026, 0, 2, 11, 59)), 'Good morning')
  assert.equal(getGreeting(new Date(2026, 0, 2, 12, 0)), 'Good afternoon')
  assert.equal(getGreeting(new Date(2026, 0, 2, 16, 59)), 'Good afternoon')
  assert.equal(getGreeting(new Date(2026, 0, 2, 17, 0)), 'Good evening')
})

test('local dashboard date formatting uses the local calendar day', () => {
  const day = new Date(2026, 9, 21, 23, 45)
  assert.equal(localDateKey(day), '2026-10-21')
  assert.equal(formatLocalDashboardDate(localDateKey(day)), 'Wednesday, October 21, 2026')
})

test('clock schedules one refresh at the next greeting or midnight boundary', () => {
  const beforeMorning = new Date(2026, 0, 2, 4, 30)
  const delay = nextDashboardRefreshDelay(beforeMorning)
  assert.equal(delay, 30 * 60 * 1000)
})
