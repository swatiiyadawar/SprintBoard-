import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseRoute, routePath } from './navigation.ts'

test('navigation routes round-trip for every workspace section and project detail', () => {
  const routes = [
    { page: 'Overview' }, { page: 'Backlog' }, { page: 'Projects' },
    { page: 'Projects', projectId: 'project-1' }, { page: 'Inbox' }, { page: 'Insights' },
  ]
  for (const route of routes) assert.deepEqual(parseRoute(routePath(route)), route)
  assert.deepEqual(parseRoute('/'), { page: 'Overview' })
  assert.deepEqual(parseRoute('/unknown'), { page: 'Overview' })
})
