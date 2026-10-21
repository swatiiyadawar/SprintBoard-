const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')
const { runMigrations } = require('../src/db/migrate')

function createFakePool() {
  const migrationNames = new Set()
  const appliedSql = []
  return {
    migrationNames,
    appliedSql,
    async query() { return { rows: [], rowCount: 0 } },
    async connect() {
      return {
        async query(sql, values = []) {
          if (sql.startsWith('SELECT 1 FROM sprintboard_private.schema_migrations')) {
            return { rows: [], rowCount: migrationNames.has(values[0]) ? 1 : 0 }
          }
          if (sql.startsWith('INSERT INTO sprintboard_private.schema_migrations')) {
            migrationNames.add(values[0])
            return { rows: [], rowCount: 1 }
          }
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' || sql.startsWith('SELECT pg_advisory_xact_lock')) {
            return { rows: [], rowCount: 0 }
          }
          appliedSql.push(sql)
          return { rows: [], rowCount: 0 }
        },
        release() {},
      }
    },
  }
}

test('migration runner records a migration and skips it on subsequent runs', async () => {
  const migrationsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sprintboard-migrations-'))
  try {
    await fs.writeFile(path.join(migrationsDir, '001_example.sql'), 'SELECT 42;')
    const pool = createFakePool()
    await runMigrations(pool, migrationsDir)
    await runMigrations(pool, migrationsDir)
    assert.deepEqual([...pool.migrationNames], ['001_example.sql'])
    assert.deepEqual(pool.appliedSql, ['SELECT 42;'])
  } finally {
    await fs.rm(migrationsDir, { recursive: true, force: true })
  }
})

test('migration runner discovers the task comments migration without destructive DDL', async () => {
  const migrationsDir = path.resolve(__dirname, '../migrations')
  const pool = createFakePool()
  await runMigrations(pool, migrationsDir)

  assert.ok(pool.migrationNames.has('004_create_task_comments.sql'))
  const commentsSql = pool.appliedSql.find((sql) => sql.includes('CREATE TABLE IF NOT EXISTS task_comments'))
  assert.ok(commentsSql)
  assert.match(commentsSql, /REFERENCES tasks\(id\) ON DELETE CASCADE/)
  assert.match(commentsSql, /char_length\(trim\(body\)\) BETWEEN 1 AND 5000/)
  assert.match(commentsSql, /task_comments_task_created_idx/)
  assert.doesNotMatch(commentsSql, /DROP TABLE|DELETE FROM/i)
})

test('activity migration preserves tasks and adds indexed, task-scoped events', async () => {
  const migrationsDir = path.resolve(__dirname, '../migrations')
  const pool = createFakePool()
  await runMigrations(pool, migrationsDir)

  assert.ok(pool.migrationNames.has('006_create_task_activity.sql'))
  const sql = pool.appliedSql.find((statement) => statement.includes('CREATE TABLE IF NOT EXISTS task_activity'))
  assert.ok(sql)
  assert.match(sql, /task_id UUID NOT NULL REFERENCES tasks\(id\) ON DELETE CASCADE/)
  assert.match(sql, /event_type VARCHAR\(32\)/)
  assert.match(sql, /event_details JSONB/)
  assert.match(sql, /task_activity_task_chronological_idx/)
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/)
  assert.match(sql, /jsonb_build_object\('legacyRecord', TRUE\)/)
  assert.match(sql, /WHERE NOT EXISTS/)
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM/i)
})

test('dependency migration is additive and protects dependency integrity', async () => {
  const migrationsDir = path.resolve(__dirname, '../migrations')
  const pool = createFakePool()
  await runMigrations(pool, migrationsDir)

  assert.ok(pool.migrationNames.has('005_create_task_dependencies.sql'))
  const sql = pool.appliedSql.find((statement) => statement.includes('CREATE TABLE IF NOT EXISTS task_dependencies'))
  assert.ok(sql)
  assert.match(sql, /task_id UUID NOT NULL REFERENCES tasks\(id\) ON DELETE CASCADE/)
  assert.match(sql, /depends_on_task_id UUID NOT NULL REFERENCES tasks\(id\) ON DELETE CASCADE/)
  assert.match(sql, /PRIMARY KEY \(task_id, depends_on_task_id\)/)
  assert.match(sql, /CHECK \(task_id <> depends_on_task_id\)/)
  assert.match(sql, /task_dependencies_prerequisite_idx/)
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM/i)
})

test('dependency activity migration only extends the existing event type constraint', async () => {
  const migrationsDir = path.resolve(__dirname, '../migrations')
  const pool = createFakePool()
  await runMigrations(pool, migrationsDir)

  assert.ok(pool.migrationNames.has('007_task_dependency_activity.sql'))
  const sql = pool.appliedSql.find((statement) => statement.includes('dependency_added'))
  assert.match(sql, /DROP CONSTRAINT IF EXISTS task_activity_event_type_check/)
  assert.match(sql, /'dependency_added'/)
  assert.match(sql, /'dependency_removed'/)
  assert.doesNotMatch(sql, /DROP TABLE|DELETE FROM/i)
})
