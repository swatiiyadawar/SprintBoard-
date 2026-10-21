const assert = require('node:assert/strict')
const { after, before, beforeEach, test } = require('node:test')
const { createServer } = require('node:http')
const { createApp } = require('../src/app')

const projectId = 'e5654d97-7020-4ca8-9477-8294f8da1930'
const secondProjectId = 'a78014f9-27b5-4f06-b952-b422e20103ae'
const taskId = 'f9d2c94f-cd8b-4cd7-8d46-91fca8667772'
const commentId = '1773d4c1-e124-4f24-a9c7-30ad94a70ca1'
let server
let baseUrl
let state
let databaseAvailable

const projects = {
  list: async () => {
    if (!databaseAvailable) { const error = new Error('offline'); error.code = 'ECONNREFUSED'; throw error }
    return state.projects
  },
  getById: async (id) => state.projects.find((project) => project.id === id) || null,
  create: async (input) => {
    if (state.projects.some((project) => project.key === input.key)) {
      const error = new Error('duplicate key'); error.code = '23505'; throw error
    }
    const project = { id: secondProjectId, ...input, createdAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z' }
    state.projects.push(project)
    return project
  },
  update: async (id, changes) => {
    const project = state.projects.find((item) => item.id === id)
    if (!project) return null
    Object.assign(project, changes)
    return project
  },
  delete: async (id) => {
    const index = state.projects.findIndex((item) => item.id === id)
    if (index < 0) return null
    state.tasks = state.tasks.filter((task) => task.projectId !== id)
    return state.projects.splice(index, 1)[0]
  },
}

const tasks = {
  list: async (filters) => state.tasks.filter((task) =>
    (!filters.projectId || task.projectId === filters.projectId) &&
    (!filters.status || task.status === filters.status) &&
    (!filters.priority || task.priority === filters.priority) &&
    (!filters.assignee || task.assigneeName?.toLowerCase() === filters.assignee.toLowerCase()),
  ).slice(filters.offset, filters.offset + filters.limit),
  getById: async (id) => state.tasks.find((task) => task.id === id) || null,
  create: async (id, input) => {
    const project = state.projects.find((item) => item.id === id)
    if (!project) { const error = new Error('foreign key'); error.code = '23503'; throw error }
    const task = { id: taskId, key: `${project.key}-${state.tasks.length + 1}`, projectId: id, project: project.name, ...input }
    state.tasks.push(task)
    return task
  },
  update: async (id, changes) => {
    const task = state.tasks.find((item) => item.id === id)
    if (!task) return null
    Object.assign(task, changes)
    return task
  },
  delete: async (id) => {
    const index = state.tasks.findIndex((task) => task.id === id)
    return index < 0 ? null : state.tasks.splice(index, 1)[0]
  },
}

const comments = {
  list: async (id) => state.comments.filter((comment) => comment.taskId === id),
  create: async (taskId, body) => {
    const comment = {
      id: commentId,
      taskId,
      body,
      createdAt: '2026-10-20T00:00:00.000Z',
      updatedAt: '2026-10-20T00:00:00.000Z',
    }
    state.comments.push(comment)
    return comment
  },
  update: async (taskId, id, body) => {
    const comment = state.comments.find((item) => item.taskId === taskId && item.id === id)
    if (!comment) return null
    comment.body = body
    return comment
  },
  delete: async (taskId, id) => {
    const index = state.comments.findIndex((item) => item.taskId === taskId && item.id === id)
    return index < 0 ? null : state.comments.splice(index, 1)[0]
  },
}

const activity = {
  list: async (id) => state.activity.filter((event) => event.taskId === id),
}

const dependencies = {
  list: async (id) => state.dependencies.filter((edge) => edge.taskId === id).map((edge) => ({ dependsOnTaskId: edge.dependsOnTaskId })),
  listDependents: async (id) => state.dependencies.filter((edge) => edge.dependsOnTaskId === id).map((edge) => ({ taskId: edge.taskId })),
  impact: async (id) => state.dependencies.filter((edge) => edge.dependsOnTaskId === id).map((edge) => ({ taskId: edge.taskId, depth: 1 })),
  add: async (taskId, dependsOnTaskId) => {
    if (state.dependencies.some((edge) => edge.taskId === taskId && edge.dependsOnTaskId === dependsOnTaskId)) {
      throw Object.assign(new Error('duplicate'), { code: '23505' })
    }
    const edge = { taskId, dependsOnTaskId }
    state.dependencies.push(edge)
    return edge
  },
  remove: async (taskId, dependsOnTaskId) => {
    const index = state.dependencies.findIndex((edge) => edge.taskId === taskId && edge.dependsOnTaskId === dependsOnTaskId)
    return index < 0 ? null : state.dependencies.splice(index, 1)[0]
  },
}

before(async () => {
  const app = createApp({
    projects,
    tasks,
    comments,
    dependencies,
    activity,
    pool: { query: async () => { if (!databaseAvailable) { const error = new Error('offline'); error.code = 'ECONNREFUSED'; throw error } return { rows: [{ '?column?': 1 }] } } },
  })
  server = createServer(app)
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  baseUrl = `http://127.0.0.1:${server.address().port}`
})

beforeEach(() => {
  state = {
    projects: [{ id: projectId, name: 'Platform', key: 'PLAT', description: null }],
    tasks: [
      { id: taskId, key: 'PLAT-1', projectId, project: 'Platform', title: 'Ship API', status: 'in_progress', priority: 'high', assigneeName: 'Maya Chen' },
      { id: '85e9a2ca-644f-4c2f-9e5d-7d4c9d4b8a41', key: 'PLAT-2', projectId, project: 'Platform', title: 'Write docs', status: 'backlog', priority: 'low', assigneeName: 'Jon Bell' },
    ],
    comments: [],
    dependencies: [],
    activity: [{
      id: 'd4e34d89-472a-440c-9836-141ae4261ee1',
      taskId,
      eventType: 'status_changed',
      details: { before: 'backlog', after: 'in_progress' },
      createdAt: '2026-10-20T10:00:00.000Z',
    }],
  }
  databaseAvailable = true
})

after(async () => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))

test('GET /api/health reports database status and keeps the Phase 1 alias', async () => {
  const response = await fetch(`${baseUrl}/api/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { data: { status: 'ok', database: 'connected' } })
  const alias = await fetch(`${baseUrl}/health`)
  assert.equal(alias.status, 200)
})

test('health and data routes return a consistent 503 when PostgreSQL is unavailable', async () => {
  databaseAvailable = false
  const health = await fetch(`${baseUrl}/api/health`)
  assert.equal(health.status, 503)
  assert.equal((await health.json()).error.code, 'DATABASE_UNAVAILABLE')
  const response = await fetch(`${baseUrl}/api/projects`)
  assert.equal(response.status, 503)
  assert.equal((await response.json()).error.code, 'DATABASE_UNAVAILABLE')
})

test('GET and POST /api/projects return project data', async () => {
  const list = await fetch(`${baseUrl}/api/projects/`)
  assert.equal(list.status, 200)
  assert.equal((await list.json()).data[0].key, 'PLAT')
  const created = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: ' Web Platform ', key: 'web' }),
  })
  assert.equal(created.status, 201)
  assert.deepEqual((await created.json()).data, {
    id: secondProjectId, name: 'Web Platform', key: 'WEB', description: null,
    createdAt: '2026-10-20T00:00:00.000Z', updatedAt: '2026-10-20T00:00:00.000Z',
  })
})

test('GET, PATCH, and DELETE /api/projects/:id handle missing records and cascade', async () => {
  const detail = await fetch(`${baseUrl}/api/projects/${projectId}`)
  assert.equal(detail.status, 200)
  const updated = await fetch(`${baseUrl}/api/projects/${projectId}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Core Platform' }),
  })
  assert.equal((await updated.json()).data.name, 'Core Platform')
  const deleted = await fetch(`${baseUrl}/api/projects/${projectId}`, { method: 'DELETE' })
  assert.equal(deleted.status, 204)
  assert.equal(state.tasks.length, 0)
  const missing = await fetch(`${baseUrl}/api/projects/${projectId}`)
  assert.equal(missing.status, 404)
})

test('rejects invalid project input and reports duplicate project keys', async () => {
  const invalid = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '', key: 'bad key', unexpected: true }),
  })
  assert.equal(invalid.status, 400)
  assert.equal((await invalid.json()).error.code, 'INVALID_INPUT')
  const conflict = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Duplicate', key: 'plat' }),
  })
  assert.equal(conflict.status, 409)
  assert.equal((await conflict.json()).error.code, 'CONFLICT')
})

test('GET /api/tasks supports validated filters and pagination', async () => {
  const response = await fetch(`${baseUrl}/api/tasks/?status=in_progress&priority=high&assignee=maya%20chen&projectId=${projectId}&limit=10`)
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.data.length, 1)
  assert.equal(body.data[0].key, 'PLAT-1')
  assert.deepEqual(body.meta, { limit: 10, offset: 0 })
  const invalid = await fetch(`${baseUrl}/api/tasks?status=started`)
  assert.equal(invalid.status, 400)
  assert.equal((await invalid.json()).error.code, 'INVALID_INPUT')
})

test('POST /api/tasks creates a dashboard-ready task; nested Phase 1 alias remains', async () => {
  const created = await fetch(`${baseUrl}/api/tasks`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectId, title: ' Add invitation flow ', assigneeName: 'Maya Chen', assigneeInitials: 'MC', labels: ['Frontend'] }),
  })
  assert.equal(created.status, 201)
  const task = (await created.json()).data
  assert.equal(task.title, 'Add invitation flow')
  assert.equal(task.status, 'backlog')
  assert.equal(task.priority, 'medium')
  assert.equal(task.blocked, false)
  const nested = await fetch(`${baseUrl}/api/projects/${projectId}/tasks`)
  assert.equal(nested.status, 200)
})

test('GET, PATCH, and DELETE /api/tasks/:id work and validate task fields', async () => {
  const detail = await fetch(`${baseUrl}/api/tasks/${taskId}`)
  assert.equal(detail.status, 200)
  const updated = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ status: 'done', blocked: true }),
  })
  assert.equal(updated.status, 200)
  assert.equal((await updated.json()).data.blocked, true)
  const invalid = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dueDate: '2026-02-31' }),
  })
  assert.equal(invalid.status, 400)
  const deleted = await fetch(`${baseUrl}/api/tasks/${taskId}`, { method: 'DELETE' })
  assert.equal(deleted.status, 204)
  const missing = await fetch(`${baseUrl}/api/tasks/${taskId}`)
  assert.equal(missing.status, 404)
})

test('GET /api/tasks/:id/activity lists events and validates task identifiers', async () => {
  const response = await fetch(`${baseUrl}/api/tasks/${taskId}/activity`)
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).data, state.activity)

  const invalidId = await fetch(`${baseUrl}/api/tasks/not-a-uuid/activity`)
  assert.equal(invalidId.status, 400)

  const missingTask = await fetch(`${baseUrl}/api/tasks/a580d468-a85a-4056-b1fc-cf4e9cb4dfc1/activity`)
  assert.equal(missingTask.status, 404)
  assert.equal((await missingTask.json()).error.message, 'Task not found')
})

test('dependency routes list prerequisites, dependents and impact and add/remove a link', async () => {
  const otherTaskId = '85e9a2ca-644f-4c2f-9e5d-7d4c9d4b8a41'
  const created = await fetch(`${baseUrl}/api/tasks/${taskId}/dependencies`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dependsOnTaskId: otherTaskId }),
  })
  assert.equal(created.status, 201)
  assert.deepEqual((await created.json()).data, { taskId, dependsOnTaskId: otherTaskId })
  assert.deepEqual((await (await fetch(`${baseUrl}/api/tasks/${taskId}/dependencies`)).json()).data, [{ dependsOnTaskId: otherTaskId }])
  assert.deepEqual((await (await fetch(`${baseUrl}/api/tasks/${otherTaskId}/dependents`)).json()).data, [{ taskId }])
  assert.deepEqual((await (await fetch(`${baseUrl}/api/tasks/${otherTaskId}/impact`)).json()).data, [{ taskId, depth: 1 }])

  const duplicate = await fetch(`${baseUrl}/api/tasks/${taskId}/dependencies`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dependsOnTaskId: otherTaskId }),
  })
  assert.equal(duplicate.status, 409)
  const self = await fetch(`${baseUrl}/api/tasks/${taskId}/dependencies`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dependsOnTaskId: taskId }),
  })
  assert.equal(self.status, 400)
  assert.equal((await self.json()).error.code, 'INVALID_DEPENDENCY')

  assert.equal((await fetch(`${baseUrl}/api/tasks/not-a-uuid/dependents`)).status, 400)
  assert.equal((await fetch(`${baseUrl}/api/tasks/a580d468-a85a-4056-b1fc-cf4e9cb4dfc1/impact`)).status, 404)
  assert.equal((await fetch(`${baseUrl}/api/tasks/${taskId}/dependencies/${otherTaskId}`, { method: 'DELETE' })).status, 204)
  assert.deepEqual(state.dependencies, [])
})

test('task comments can be listed, created, updated, and deleted', async () => {
  const empty = await fetch(`${baseUrl}/api/tasks/${taskId}/comments`)
  assert.equal(empty.status, 200)
  assert.deepEqual((await empty.json()).data, [])

  const created = await fetch(`${baseUrl}/api/tasks/${taskId}/comments`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body: '  Ready for review.  ' }),
  })
  assert.equal(created.status, 201)
  assert.deepEqual((await created.json()).data, {
    id: commentId,
    taskId,
    body: 'Ready for review.',
    createdAt: '2026-10-20T00:00:00.000Z',
    updatedAt: '2026-10-20T00:00:00.000Z',
  })

  const listed = await fetch(`${baseUrl}/api/tasks/${taskId}/comments`)
  assert.equal((await listed.json()).data.length, 1)

  const updated = await fetch(`${baseUrl}/api/tasks/${taskId}/comments/${commentId}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ body: 'Reviewed and approved.' }),
  })
  assert.equal((await updated.json()).data.body, 'Reviewed and approved.')

  const deleted = await fetch(`${baseUrl}/api/tasks/${taskId}/comments/${commentId}`, { method: 'DELETE' })
  assert.equal(deleted.status, 204)
  assert.deepEqual((await (await fetch(`${baseUrl}/api/tasks/${taskId}/comments`)).json()).data, [])
})

test('task comments validate text and reject comment access for missing tasks', async () => {
  const blank = await fetch(`${baseUrl}/api/tasks/${taskId}/comments`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: '   ' }),
  })
  assert.equal(blank.status, 400)
  assert.equal((await blank.json()).error.code, 'INVALID_INPUT')

  const tooLong = await fetch(`${baseUrl}/api/tasks/${taskId}/comments`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: 'x'.repeat(5001) }),
  })
  assert.equal(tooLong.status, 400)

  const missingTaskId = 'a580d468-a85a-4056-b1fc-cf4e9cb4dfc1'
  const missingList = await fetch(`${baseUrl}/api/tasks/${missingTaskId}/comments`)
  assert.equal(missingList.status, 404)
  assert.equal((await missingList.json()).error.message, 'Task not found')

  const missingPost = await fetch(`${baseUrl}/api/tasks/${missingTaskId}/comments`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: 'Should not be saved' }),
  })
  assert.equal(missingPost.status, 404)

  const missingUpdate = await fetch(`${baseUrl}/api/tasks/${missingTaskId}/comments/${commentId}`, {
    method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: 'Should not be changed' }),
  })
  assert.equal(missingUpdate.status, 404)

  const missingDelete = await fetch(`${baseUrl}/api/tasks/${missingTaskId}/comments/${commentId}`, { method: 'DELETE' })
  assert.equal(missingDelete.status, 404)
})

test('returns JSON errors for malformed JSON and unknown routes', async () => {
  const invalidJson = await fetch(`${baseUrl}/api/projects`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
  })
  assert.equal(invalidJson.status, 400)
  assert.equal((await invalidJson.json()).error.code, 'INVALID_JSON')
  const missing = await fetch(`${baseUrl}/not-a-route`)
  assert.equal(missing.status, 404)
  assert.equal((await missing.json()).error.code, 'NOT_FOUND')
})
