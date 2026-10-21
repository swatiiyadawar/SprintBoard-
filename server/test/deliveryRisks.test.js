const assert = require('node:assert/strict')
const { after, before, test } = require('node:test')
const { createServer } = require('node:http')
const { createApp } = require('../src/app')
const { summarizeDeliveryRisks } = require('../src/deliveryRisk')
const { createDeliveryRisksRepository } = require('../src/db/deliveryRisks')

const today = '2026-10-21'
const task = (id, overrides = {}) => ({
  id, key: `PLAT-${id}`, projectId: 'project-1', project: 'Platform', projectKey: 'PLAT',
  title: `Task ${id}`, description: null, status: 'in_progress', priority: 'medium',
  assigneeName: 'Maya', assigneeInitials: 'M', dueDate: null, labels: [], blocked: false,
  createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z',
  ...overrides,
})

test('delivery risk metrics use UTC due dates and count affected tasks only once', () => {
  const tasks = [
    task('1', { dueDate: '2026-10-20', priority: 'high', assigneeName: null }),
    task('2', { priority: 'high' }),
    task('3', { dueDate: today }),
    task('4', { dueDate: '2026-10-19', priority: 'high', assigneeName: null, status: 'done' }),
    task('5', { priority: 'low', assigneeName: null }),
  ]
  const result = summarizeDeliveryRisks({ tasks, dependencies: [], asOfDate: today })

  assert.deepEqual(result.summary, {
    totalTasks: 5,
    uniqueAffectedTasks: 1,
    overdueTasks: 1,
    blockedTasks: 0,
    unassignedHighPriorityTasks: 1,
    dependencyBottlenecks: 0,
  })
  assert.deepEqual(result.tasks[0].riskTypes, ['overdue', 'unassigned_high_priority'])
  assert.equal(result.tasks[0].reasons[0], 'Overdue · due 2026-10-20')
})

test('unfinished prerequisites block tasks; completed prerequisites and completed tasks do not', () => {
  const tasks = [task('1'), task('2'), task('3', { status: 'done' }), task('4')]
  const dependencies = [
    { taskId: '2', dependsOnTaskId: '1' },
    { taskId: '4', dependsOnTaskId: '3' },
  ]
  const result = summarizeDeliveryRisks({ tasks, dependencies, asOfDate: today })

  assert.deepEqual(result.tasks.map((item) => item.task.id), ['2'])
  assert.equal(result.summary.blockedTasks, 1)
  assert.equal(result.tasks.length, result.summary.uniqueAffectedTasks)
  assert.match(result.tasks[0].reasons[0], /PLAT-1 · Task 1 \(In progress\)/)
})

test('dependency bottlenecks count unique incomplete downstream tasks across chains and paths', () => {
  const tasks = [
    task('1'), task('2'), task('3'), task('4', { status: 'done' }),
    task('5', { status: 'done' }),
  ]
  const dependencies = [
    { taskId: '2', dependsOnTaskId: '1' },
    { taskId: '3', dependsOnTaskId: '2' },
    { taskId: '3', dependsOnTaskId: '1' },
    { taskId: '4', dependsOnTaskId: '1' },
  ]
  const result = summarizeDeliveryRisks({ tasks, dependencies, asOfDate: today })

  assert.equal(result.summary.dependencyBottlenecks, 1)
  assert.equal(result.summary.blockedTasks, 2)
  assert.equal(result.summary.uniqueAffectedTasks, 3)
  assert.deepEqual(result.tasks[0].riskTypes, ['dependency_bottleneck'])
  assert.match(result.tasks[0].reasons[0], /2 incomplete downstream dependents: PLAT-2, PLAT-3/)
})

test('dashboard repository reads tasks and dependencies in two bulk queries and handles an empty task set', async () => {
  const calls = []
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values })
      if (sql.includes('WITH utc_today')) return { rows: [{ asOfDate: today, id: null }] }
      return { rows: [{ taskId: 'task-2', dependsOnTaskId: 'task-1' }] }
    },
  }
  const repository = createDeliveryRisksRepository(pool)
  const data = await repository.getSummary()

  assert.equal(data.asOfDate, today)
  assert.deepEqual(data.tasks, [])
  assert.deepEqual(data.dependencies, [{ taskId: 'task-2', dependsOnTaskId: 'task-1' }])
  assert.equal(calls.length, 2)
  assert.ok(calls.every((call) => call.values === undefined))
})

test('GET /api/dashboard/delivery-risks returns a consistent data envelope', async (context) => {
  const deliveryRisks = {
    async getSummary() {
      return { asOfDate: today, tasks: [task('1', { dueDate: '2026-10-20' })], dependencies: [] }
    },
  }
  const app = createApp({
    projects: {}, tasks: {}, comments: {}, deliveryRisks,
    pool: { query: async () => ({ rows: [] }) },
  })
  const server = createServer(app)
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/dashboard/delivery-risks`)
  const body = await response.json()

  assert.equal(response.status, 200)
  assert.equal(body.data.asOfDate, today)
  assert.equal(body.data.summary.totalTasks, 1)
  assert.deepEqual(body.data.tasks[0].riskTypes, ['overdue'])
})

test('delivery risk database failures use the shared JSON error response', async (context) => {
  const deliveryRisks = {
    async getSummary() { throw Object.assign(new Error('database unavailable'), { code: 'ECONNREFUSED' }) },
  }
  const app = createApp({
    projects: {}, tasks: {}, comments: {}, deliveryRisks,
    pool: { query: async () => ({ rows: [] }) },
  })
  const server = createServer(app)
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/dashboard/delivery-risks`)
  const body = await response.json()

  assert.equal(response.status, 503)
  assert.equal(body.error.code, 'DATABASE_UNAVAILABLE')
})
