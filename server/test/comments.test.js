const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createCommentsRepository } = require('../src/db/comments')

test('comments repository binds text and IDs as query parameters and scopes edits by task', async () => {
  const calls = []
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values })
      return { rows: [{ id: 'comment-id' }] }
    },
  }
  const repository = createCommentsRepository(pool)

  await repository.list('task-id')
  await repository.create('task-id', 'Comment text')
  await repository.update('task-id', 'comment-id', 'Updated text')
  await repository.delete('task-id', 'comment-id')

  assert.deepEqual(calls.map((call) => call.values), [
    ['task-id'],
    ['task-id', 'Comment text'],
    ['task-id', 'comment-id', 'Updated text'],
    ['task-id', 'comment-id'],
  ])
  assert.match(calls[2].sql, /WHERE task_id = \$1 AND id = \$2/)
  assert.match(calls[3].sql, /WHERE task_id = \$1 AND id = \$2/)
})
