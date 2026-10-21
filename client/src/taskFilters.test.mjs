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

test('backlog membership remains independent from workflow status and combines with filters', () => {
  const queue = [
    { title: 'Plan release', status: 'To do', priority: 'high', assignee: 'Maya Chen', projectId: 'p1', isBacklog: true },
    { title: 'Ship release', status: 'In progress', priority: 'high', assignee: 'Maya Chen', projectId: 'p1', isBacklog: false },
    { title: 'Review release', status: 'To do', priority: 'low', assignee: 'Jon Bell', projectId: 'p2', isBacklog: true },
  ]
  assert.deepEqual(filterTasks(queue, { isBacklog: true }), [queue[0], queue[2]])
  assert.deepEqual(filterTasks(queue, { isBacklog: true, status: 'To do', priority: 'high', assignee: 'Maya Chen', projectId: 'p1', query: 'release' }), [queue[0]])
  assert.deepEqual(filterTasks(queue, { isBacklog: false }), [queue[1]])
})

test('combines quick tabs with advanced filters and leaves input records untouched', () => {
  const before = structuredClone(tasks)
  assert.deepEqual(filterTasks(tasks, { shortcut: 'My tasks', status: 'In progress' }), [tasks[0], tasks[2]])
  assert.deepEqual(filterTasks(tasks, { shortcut: 'In progress', priority: 'Low' }), [])
  assert.deepEqual(tasks, before)
})
