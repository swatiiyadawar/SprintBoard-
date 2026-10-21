import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { api } from './api.ts'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('loads comments from the task-scoped comments endpoint', async () => {
  const comment = {
    id: 'comment-1', taskId: 'task/1', body: 'A useful update',
    createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z',
  }
  globalThis.fetch = async (url) => {
    assert.equal(url, 'http://localhost:3001/api/tasks/task%2F1/comments')
    return new Response(JSON.stringify({ data: [comment] }), { status: 200 })
  }

  assert.deepEqual(await api.getComments('task/1'), [comment])
})

test('posts comment text and unwraps the created comment', async () => {
  const comment = {
    id: 'comment-2', taskId: 'task-2', body: 'Persist this',
    createdAt: '2026-10-20T10:00:00.000Z', updatedAt: '2026-10-20T10:00:00.000Z',
  }
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'http://localhost:3001/api/tasks/task-2/comments')
    assert.equal(init.method, 'POST')
    assert.deepEqual(JSON.parse(init.body), { body: 'Persist this' })
    return new Response(JSON.stringify({ data: comment }), { status: 201 })
  }

  assert.deepEqual(await api.createComment('task-2', { body: 'Persist this' }), comment)
})

test('loads task activity from the task-scoped activity endpoint', async () => {
  const event = {
    id: 'activity-1', taskId: 'task-1', eventType: 'status_changed',
    details: { before: 'backlog', after: 'in_progress' },
    createdAt: '2026-10-20T10:00:00.000Z',
  }
  globalThis.fetch = async (url) => {
    assert.equal(url, 'http://localhost:3001/api/tasks/task-1/activity')
    return new Response(JSON.stringify({ data: [event] }), { status: 200 })
  }

  assert.deepEqual(await api.getActivity('task-1'), [event])
})

test('loads the database-backed dashboard delivery risk summary', async () => {
  const summary = {
    asOfDate: '2026-10-21',
    summary: {
      totalTasks: 3, uniqueAffectedTasks: 1, overdueTasks: 1,
      blockedTasks: 0, unassignedHighPriorityTasks: 1, dependencyBottlenecks: 0,
    },
    tasks: [],
  }
  globalThis.fetch = async (url) => {
    assert.equal(url, 'http://localhost:3001/api/dashboard/delivery-risks?timeZone=UTC')
    return new Response(JSON.stringify({ data: summary }), { status: 200 })
  }

  assert.deepEqual(await api.getDeliveryRisks('UTC'), summary)
})

test('loads real tasks filtered by explicit backlog membership', async () => {
  const task = { id: 'task-1', isBacklog: true }
  globalThis.fetch = async (url) => {
    assert.equal(url, 'http://localhost:3001/api/tasks?limit=100&offset=0&isBacklog=true')
    return new Response(JSON.stringify({ data: [task], meta: { limit: 100, offset: 0 } }), { status: 200 })
  }

  assert.deepEqual(await api.getTasks({ isBacklog: true }), [task])
})

test('loads direct dependents and downstream impact from their task endpoints', async () => {
  const dependent = { taskId: 'task-2', key: 'PLAT-2', title: 'Follow-up', status: 'backlog', projectId: 'project-1', project: 'Platform' }
  const impact = { ...dependent, depth: 2 }
  globalThis.fetch = async (url) => {
    if (url === 'http://localhost:3001/api/tasks/task-1/dependents') {
      return new Response(JSON.stringify({ data: [dependent] }), { status: 200 })
    }
    assert.equal(url, 'http://localhost:3001/api/tasks/task-1/impact')
    return new Response(JSON.stringify({ data: [impact] }), { status: 200 })
  }

  assert.deepEqual(await api.getDependents('task-1'), [dependent])
  assert.deepEqual(await api.getDependencyImpact('task-1'), [impact])
})
