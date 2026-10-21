const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createDependenciesRepository } = require('../src/db/dependencies')

const a = '00000000-0000-4000-8000-000000000001'
const b = '00000000-0000-4000-8000-000000000002'
const c = '00000000-0000-4000-8000-000000000003'
const d = '00000000-0000-4000-8000-000000000004'
const x = '00000000-0000-4000-8000-000000000005'

function fixture({ failActivity = false } = {}) {
  const tasks = new Map([a, b, c, d].map((id, index) => [id, {
    id, project_id: 'same-project', title: `Task ${index + 1}`, status: 'backlog',
    task_number: index + 1, project_key: 'PLAT', project: 'Platform',
  }]))
  tasks.set(x, { id: x, project_id: 'other-project', title: 'Other project task', status: 'backlog', task_number: 1, project_key: 'OTHER', project: 'Other' })
  let edges = [{ task_id: b, depends_on_task_id: a }, { task_id: c, depends_on_task_id: b }]
  const events = []
  const client = {
    async query(sql, values = []) {
      if (sql === 'BEGIN' || sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [] }
      if (sql === 'COMMIT') return { rows: [] }
      if (sql === 'ROLLBACK') { edges = snapshot.edges; events.splice(0, events.length, ...snapshot.events); return { rows: [] } }
      if (sql.includes('SELECT task.id AS task_id')) {
        const task = tasks.get(values[0]); const prerequisite = tasks.get(values[1])
        return { rows: task && prerequisite ? [{ task_id: task.id, task_project_id: task.project_id,
          prerequisite_id: prerequisite.id, prerequisite_project_id: prerequisite.project_id,
          prerequisite_title: prerequisite.title, prerequisite_number: prerequisite.task_number,
          prerequisite_project_key: prerequisite.project_key }] : [] }
      }
      if (sql.includes('WITH RECURSIVE prerequisites')) {
        const seen = new Set([values[1]])
        const queue = [values[1]]
        while (queue.length) {
          const current = queue.shift()
          for (const edge of edges.filter((item) => item.task_id === current)) {
            if (!seen.has(edge.depends_on_task_id)) { seen.add(edge.depends_on_task_id); queue.push(edge.depends_on_task_id) }
          }
        }
        return { rows: [{ would_create_cycle: seen.has(values[0]) }] }
      }
      if (sql.includes('INSERT INTO task_dependencies')) {
        if (edges.some((edge) => edge.task_id === values[0] && edge.depends_on_task_id === values[1])) throw Object.assign(new Error('duplicate'), { code: '23505' })
        edges.push({ task_id: values[0], depends_on_task_id: values[1] })
        return { rows: [{ taskId: values[0], dependsOnTaskId: values[1] }] }
      }
      if (sql.includes("'dependency_added'")) {
        if (failActivity) throw Object.assign(new Error('activity insert failed'), { code: 'XX000' })
        events.push({ task_id: values[0], type: 'dependency_added', details: JSON.parse(values[1]) }); return { rows: [] }
      }
      if (sql.includes("'dependency_removed'")) {
        if (failActivity) throw Object.assign(new Error('activity insert failed'), { code: 'XX000' })
        events.push({ task_id: values[0], type: 'dependency_removed', details: JSON.parse(values[1]) }); return { rows: [] }
      }
      if (sql.includes('DELETE FROM task_dependencies')) {
        const [taskId, dependsOnTaskId] = values
        const edgeIndex = edges.findIndex((edge) => edge.task_id === taskId && edge.depends_on_task_id === dependsOnTaskId)
        if (edgeIndex < 0) return { rows: [] }
        edges.splice(edgeIndex, 1)
        const prerequisite = tasks.get(dependsOnTaskId)
        return { rows: [{ taskId, dependsOnTaskId, key: `${prerequisite.project_key}-${prerequisite.task_number}`, title: prerequisite.title }] }
      }
      throw new Error(`Unexpected client query: ${sql}`)
    },
    release() {},
  }
  let snapshot = { edges: structuredClone(edges), events: [] }
  const pool = {
    async connect() { snapshot = { edges: structuredClone(edges), events: structuredClone(events) }; return client },
    async query(sql, values) {
      if (sql.includes('WHERE d.task_id = $1')) return { rows: edges.filter((edge) => edge.task_id === values[0]).map((edge) => ({ dependsOnTaskId: edge.depends_on_task_id })) }
      if (sql.includes('WHERE d.depends_on_task_id = $1')) return { rows: edges.filter((edge) => edge.depends_on_task_id === values[0]).map((edge) => ({ taskId: edge.task_id, key: edge.task_id, title: tasks.get(edge.task_id).title })) }
      if (sql.includes('WITH RECURSIVE downstream')) {
        const distances = new Map(); const queue = [{ id: values[0], depth: 0 }]
        while (queue.length) {
          const current = queue.shift()
          for (const edge of edges.filter((item) => item.depends_on_task_id === current.id)) {
            const depth = current.depth + 1
            if (!distances.has(edge.task_id) || depth < distances.get(edge.task_id)) { distances.set(edge.task_id, depth); queue.push({ id: edge.task_id, depth }) }
          }
        }
        return { rows: [...distances].map(([taskId, depth]) => ({ taskId, depth, title: tasks.get(taskId).title })) }
      }
      throw new Error(`Unexpected pool query: ${sql}`)
    },
  }
  return { repository: createDependenciesRepository(pool), events, edgeCount: () => edges.length }
}

test('dependency operations add and remove persistent relationships with activity events', async () => {
  const f = fixture()
  const added = await f.repository.add(d, c)
  assert.deepEqual(added, { taskId: d, dependsOnTaskId: c })
  assert.equal(f.events[0].type, 'dependency_added')
  assert.equal(f.events[0].task_id, d)
  const removed = await f.repository.remove(d, c)
  assert.equal(removed.key, 'PLAT-3')
  assert.equal(f.events[1].type, 'dependency_removed')
  assert.equal(f.edgeCount(), 2)
})

test('dependency adds reject missing tasks, self-links, cross-project pairs, duplicates, and cycles', async () => {
  const f = fixture()
  await assert.rejects(f.repository.add(a, x), { code: 'DEPENDENCY_PROJECT_MISMATCH' })
  await assert.rejects(f.repository.add(a, '00000000-0000-4000-8000-000000000099'), { code: 'TASK_NOT_FOUND' })
  await assert.rejects(f.repository.add(a, a), { code: 'DEPENDENCY_SELF' })
  await assert.rejects(f.repository.add(a, b), { code: 'DEPENDENCY_CYCLE' })
  await assert.rejects(f.repository.add(b, a), { code: '23505' })
  assert.equal(f.events.length, 0)
})

test('dependency listings and downstream impact include a multi-step chain', async () => {
  const f = fixture()
  assert.deepEqual(await f.repository.list(a), [])
  assert.equal((await f.repository.listDependents(a))[0].taskId, b)
  assert.deepEqual((await f.repository.impact(a)).map((item) => [item.taskId, item.depth]), [[b, 1], [c, 2]])
})

test('dependency and activity writes roll back together if activity insertion fails', async () => {
  const f = fixture({ failActivity: true })
  await assert.rejects(f.repository.add(d, c), /activity insert failed/)
  assert.equal(f.edgeCount(), 2)
  assert.equal(f.events.length, 0)
})
