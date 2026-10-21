const assert = require('node:assert/strict')
const path = require('node:path')
const { test } = require('node:test')
const { loadConfig } = require('../src/config')
const { createPool } = require('../src/db/pool')
const { validateProject, validateProjectPatch, validateTask, validateTaskFilters, validateTaskPatch } = require('../src/validation')

test('loads safe defaults and parses environment configuration', () => {
  assert.deepEqual(loadConfig({}), {
    port: 3001,
    databaseUrl: '',
    clientOrigin: 'http://localhost:5173',
    pgSsl: false,
    pgSslCaPath: path.resolve(__dirname, '..', 'certs', 'supabase-root.crt'),
  })
  assert.equal(loadConfig({ PORT: '4100', DATABASE_URL: 'postgres://db', PGSSL: 'true' }).port, 4100)
  assert.throws(() => loadConfig({ PORT: '70000' }), /PORT must be/)
})

test('configures PostgreSQL TLS with the supplied CA and certificate verification enabled', async () => {
  const pool = createPool({
    databaseUrl: 'postgres://example.invalid/postgres',
    pgSsl: true,
    pgSslCaPath: path.resolve(__dirname, '..', 'certs', 'supabase-root.crt'),
  })

  try {
    assert.ok(pool.options.ssl.ca.includes('BEGIN CERTIFICATE'))
    assert.equal(pool.options.ssl.rejectUnauthorized, true)
  } finally {
    await pool.end()
  }
})

test('validates project fields and normalizes its key', () => {
  assert.deepEqual(validateProject({ name: 'Platform', key: 'plat' }), {
    name: 'Platform', key: 'PLAT', description: null,
  })
  assert.throws(() => validateProject({ name: 'Platform', key: 'bad key' }), /key must start/)
  assert.deepEqual(validateProjectPatch({ description: null }), { description: null })
  assert.throws(() => validateProjectPatch({}), /At least one field/)
})

test('validates task defaults, date, labels, and partial updates', () => {
  assert.deepEqual(validateTask({ title: 'Build API' }), {
    title: 'Build API', description: null, status: 'backlog', priority: 'medium',
    assigneeName: null, assigneeInitials: null, dueDate: null, labels: [], blocked: false,
  })
  assert.deepEqual(validateTaskPatch({ dueDate: null, status: 'done' }), { status: 'done', dueDate: null })
  assert.throws(() => validateTask({ title: 'Task', dueDate: '2026-13-45' }), /dueDate/)
  assert.throws(() => validateTask({ title: 'Task', dueDate: '2026-02-31' }), /dueDate/)
  assert.throws(() => validateTask({ title: 'Task', blocked: 'yes' }), /blocked must be/)
  assert.throws(() => validateTaskPatch({}), /At least one field/)
  assert.deepEqual(validateTaskFilters({ status: 'in_progress', limit: '15' }), {
    status: 'in_progress', limit: 15, offset: 0,
  })
  assert.throws(() => validateTaskFilters({ limit: '101' }), /limit must be/)
})
