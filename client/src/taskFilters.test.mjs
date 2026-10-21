import assert from 'node:assert/strict'
import { test } from 'node:test'
import { filterTasks } from './taskFilters.ts'

const tasks = [
  { title: 'Ship API', status: 'In progress', priority: 'High', assignee: 'Maya Chen', projectId: 'p1' },
  { title: 'Write API docs', status: 'Backlog', priority: 'Low', assignee: 'Jon Bell', projectId: 'p1' },
  { title: 'Ship dashboard', status: 'In progress', priority: 'High', assignee: 'Maya Chen', projectId: 'p2' },
  { title: 'Fix login', status: 'Done', priority: 'Urgent', assignee: 'Unassigned', projectId: 'p2' },
]

test('combines title, status, priority, assignee, and project filters', () => {
  assert.deepEqual(filterTasks(tasks, {
    query: '  API ', status: 'In progress', priority: 'High', assignee: 'Maya Chen', projectId: 'p1',
  }), [tasks[0]])
})

test('searches task titles without case sensitivity or matching other fields', () => {
  assert.deepEqual(filterTasks(tasks, { query: 'SHIP' }), [tasks[0], tasks[2]])
  assert.deepEqual(filterTasks(tasks, { query: 'p1' }), [])
})

test('combines quick tabs with advanced filters and leaves input records untouched', () => {
  const before = structuredClone(tasks)
  assert.deepEqual(filterTasks(tasks, { shortcut: 'My tasks', status: 'In progress' }), [tasks[0], tasks[2]])
  assert.deepEqual(filterTasks(tasks, { shortcut: 'In progress', priority: 'Low' }), [])
  assert.deepEqual(tasks, before)
})
