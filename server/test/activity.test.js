const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createActivityRepository } = require('../src/db/activity')
const { createTasksRepository } = require('../src/db/tasks')

const taskId = 'f9d2c94f-cd8b-4cd7-8d46-91fca8667772'
const projectId = 'e5654d97-7020-4ca8-9477-8294f8da1930'

const startingTask = {
  id: taskId,
  key: 'PLAT-1',
  projectId,
  project: 'Platform',
  projectKey: 'PLAT',
  title: 'Ship API',
  description: 'Initial description',
  status: 'in_progress',
  priority: 'high',
  assigneeName: 'Maya Chen',
  assigneeInitials: 'MC',
  dueDate: '2026-10-30',
  labels: ['api'],
  blocked: false,
  isBacklog: false,
  createdAt: '2026-10-20T09:00:00.000Z',
  updatedAt: '2026-10-20T09:00:00.000Z',
}

function makeTaskPool({ failUpdate = false, failActivity = false } = {}) {
  let task = structuredClone(startingTask)
  let snapshot = null
  const events = []
  const calls = []
  const columns = {
    title: 'title',
    description: 'description',
    status: 'status',
    priority: 'priority',
    assignee_name: 'assigneeName',
    assignee_initials: 'assigneeInitials',
    due_date: 'dueDate',
    labels: 'labels',
    blocked: 'blocked',
    is_backlog: 'isBacklog',
  }
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values })
      if (sql === 'BEGIN') { snapshot = structuredClone(task); return { rows: [] } }
      if (sql === 'COMMIT') return { rows: [] }
      if (sql === 'ROLLBACK') { if (snapshot) task = snapshot; return { rows: [] } }
      if (sql.includes('FROM tasks WHERE id = $1 FOR UPDATE')) return { rows: [structuredClone(task)] }
      if (sql.includes('WITH created AS')) {
        task = {
          ...startingTask,
          id: 'new-task-id',
          key: 'PLAT-2',
          projectId: values[0],
          title: values[1],
          description: values[2],
          status: values[3],
          priority: values[4],
          assigneeName: values[5],
          assigneeInitials: values[6],
          dueDate: values[7],
          labels: values[8],
          blocked: values[9],
          isBacklog: values[10],
        }
        return { rows: [structuredClone(task)] }
      }
      if (sql.includes('WITH updated AS')) {
        if (failUpdate) throw Object.assign(new Error('simulated update failure'), { code: '23514' })
        const assignments = sql.match(/UPDATE tasks SET ([\s\S]*?)\s+WHERE/)[1]
        for (const [, column, placeholder] of assignments.matchAll(/([a-z_]+)\s*=\s*\$(\d+)/g)) {
          task[columns[column]] = values[Number(placeholder) - 1]
        }
        return { rows: [structuredClone(task)] }
      }
      if (sql.includes('INSERT INTO task_activity')) {
        if (failActivity) throw Object.assign(new Error('simulated activity insert failure'), { code: 'XX000' })
        events.push({ taskId: values[0], eventType: values[1], details: JSON.parse(values[2]) })
        return { rows: [] }
      }
      throw new Error(`Unexpected SQL in test fixture: ${sql}`)
    },
    release() {},
  }
  return { pool: { connect: async () => client }, events, calls, currentTask: () => task }
}

test('successful task updates commit a before-and-after activity event in the same transaction', async () => {
  const fixture = makeTaskPool()
  const tasks = createTasksRepository(fixture.pool)

  const updated = await tasks.update(taskId, { status: 'done' })

  assert.equal(updated.status, 'done')
  assert.deepEqual(fixture.events, [{
    taskId,
    eventType: 'status_changed',
    details: { before: 'in_progress', after: 'done' },
  }])
  const insertIndex = fixture.calls.findIndex(({ sql }) => sql.includes('INSERT INTO task_activity'))
  const commitIndex = fixture.calls.findIndex(({ sql }) => sql === 'COMMIT')
  assert.ok(insertIndex > -1 && insertIndex < commitIndex)
})

test('moving a task into backlog persists membership and a backlog activity event transactionally', async () => {
  const fixture = makeTaskPool()
  const tasks = createTasksRepository(fixture.pool)

  const updated = await tasks.update(taskId, { isBacklog: true })

  assert.equal(updated.isBacklog, true)
  assert.deepEqual(fixture.events, [{
    taskId, eventType: 'backlog_changed', details: { before: false, after: true },
  }])
  assert.ok(fixture.calls.findIndex(({ sql }) => sql.includes('INSERT INTO task_activity')) < fixture.calls.findIndex(({ sql }) => sql === 'COMMIT'))
})

test('successful task creation records the created task details before commit', async () => {
  const fixture = makeTaskPool()
  const tasks = createTasksRepository(fixture.pool)

  const created = await tasks.create(projectId, {
    title: 'Add review flow',
    description: null,
    status: 'backlog',
    priority: 'medium',
    assigneeName: null,
    assigneeInitials: null,
    dueDate: null,
    labels: [],
    blocked: false,
    isBacklog: true,
  })

  assert.equal(created.title, 'Add review flow')
  assert.equal(created.isBacklog, true)
  assert.equal(fixture.events[0].eventType, 'task_created')
  assert.equal(fixture.events[0].details.after.title, 'Add review flow')
  assert.equal(fixture.events[0].details.after.isBacklog, true)
  assert.ok(fixture.calls.findIndex(({ sql }) => sql.includes('INSERT INTO task_activity')) < fixture.calls.findIndex(({ sql }) => sql === 'COMMIT'))
})

test('failed task updates do not create activity events and roll back', async () => {
  const fixture = makeTaskPool({ failUpdate: true })
  const tasks = createTasksRepository(fixture.pool)

  await assert.rejects(tasks.update(taskId, { status: 'done' }), /simulated update failure/)
  assert.deepEqual(fixture.events, [])
  assert.equal(fixture.currentTask().status, 'in_progress')
  assert.ok(fixture.calls.some(({ sql }) => sql === 'ROLLBACK'))
})

test('activity insert failures roll back the task change', async () => {
  const fixture = makeTaskPool({ failActivity: true })
  const tasks = createTasksRepository(fixture.pool)

  await assert.rejects(tasks.update(taskId, { priority: 'low' }), /simulated activity insert failure/)
  assert.deepEqual(fixture.events, [])
  assert.equal(fixture.currentTask().priority, 'high')
  assert.ok(fixture.calls.some(({ sql }) => sql === 'ROLLBACK'))
})

test('activity repository filters by task and orders newest events first', async () => {
  const event = { id: 'event-1', taskId, eventType: 'task_created', details: {}, createdAt: '2026-10-20T10:00:00Z' }
  let call
  const repository = createActivityRepository({
    async query(sql, values) {
      call = { sql, values }
      return { rows: [event] }
    },
  })

  assert.deepEqual(await repository.list(taskId), [event])
  assert.deepEqual(call.values, [taskId])
  assert.match(call.sql, /WHERE task_id = \$1/)
  assert.match(call.sql, /ORDER BY created_at DESC, id DESC/)
})
