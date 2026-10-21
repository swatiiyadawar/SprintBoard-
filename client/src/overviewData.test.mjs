import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getOverviewData } from './overviewData.ts'

const task = (id, overrides = {}) => ({
  apiId: id, id, projectId: 'p1', title: `Task ${id}`, project: 'Platform', status: 'To do',
  priority: 'Medium', assignee: 'Unassigned', initials: '—', due: 'No date', dueDate: null,
  labels: [], description: '', blocked: false, isBacklog: false,
  createdAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z', ...overrides,
})

test('overview derives totals, recent work and upcoming dates while excluding backlog from active work', () => {
  const tasks = [
    task('1', { updatedAt: '2026-10-20T10:00:00.000Z', dueDate: '2026-10-24' }),
    task('2', { status: 'Done', updatedAt: '2026-10-20T12:00:00.000Z' }),
    task('3', { isBacklog: true, dueDate: '2026-10-22' }),
    task('4', { dueDate: '2026-10-29' }),
  ]
  const result = getOverviewData(tasks, '2026-10-21')
  assert.equal(result.totalTasks, 4)
  assert.equal(result.openTasks, 2)
  assert.equal(result.completedTasks, 1)
  assert.deepEqual(result.recentlyUpdatedTasks.map((item) => item.id), ['2', '1', '4'])
  assert.deepEqual(result.upcomingDueTasks.map((item) => item.id), ['1'])
})

test('overview supports empty workspace data', () => {
  const result = getOverviewData([], '2026-10-21')
  assert.equal(result.totalTasks, 0)
  assert.equal(result.openTasks, 0)
  assert.deepEqual(result.recentlyUpdatedTasks, [])
  assert.deepEqual(result.upcomingDueTasks, [])
})
