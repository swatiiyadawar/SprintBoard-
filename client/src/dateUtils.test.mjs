import assert from 'node:assert/strict'
import { test } from 'node:test'
import { daysUntilLocal, daysUntilUtc, formatLocalTaskDate, formatUtcDashboardDate, formatUtcTaskDate, utcDateKey } from './dateUtils.ts'

test('dashboard and delivery dates share an explicit UTC calendar day', () => {
  const latePacificTime = new Date('2026-10-20T23:30:00-07:00')
  assert.equal(utcDateKey(latePacificTime), '2026-10-21')
  assert.equal(formatUtcDashboardDate('2026-10-21'), 'Wednesday, October 21, 2026')
  assert.equal(formatUtcTaskDate('2026-10-21', true), 'Oct 21, 2026')
})

test('due date distance uses UTC day boundaries consistently', () => {
  const latePacificTime = new Date('2026-10-20T23:30:00-07:00')
  assert.equal(daysUntilUtc('2026-10-20', latePacificTime), -1)
  assert.equal(daysUntilUtc('2026-10-21', latePacificTime), 0)
  assert.equal(daysUntilUtc('2026-10-22', latePacificTime), 1)
})

test('task due dates use local calendar days for display and dashboard distance', () => {
  const localMorning = new Date(2026, 9, 21, 0, 15)
  assert.equal(daysUntilLocal('2026-10-21', localMorning), 0)
  assert.equal(daysUntilLocal('2026-10-22', localMorning), 1)
  assert.equal(formatLocalTaskDate('2026-10-21'), 'Oct 21')
})
