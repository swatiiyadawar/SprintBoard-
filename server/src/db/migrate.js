const fs = require('node:fs/promises')
const path = require('node:path')
const { createPool } = require('./pool')
const MIGRATION_LOCK_KEY = 537_214_936

async function runMigrations(pool, migrationsDir = path.resolve(__dirname, '../../migrations')) {
  await pool.query('CREATE SCHEMA IF NOT EXISTS sprintboard_private')
  await pool.query(`CREATE TABLE IF NOT EXISTS sprintboard_private.schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`)

  const files = (await fs.readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort()
  for (const name of files) {
    const sql = await fs.readFile(path.join(migrationsDir, name), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock($1)', [MIGRATION_LOCK_KEY])
      const existing = await client.query(
        'SELECT 1 FROM sprintboard_private.schema_migrations WHERE name = $1', [name],
      )
      if (existing.rowCount) {
        await client.query('COMMIT')
        continue
      }
      await client.query(sql)
      await client.query(
        'INSERT INTO sprintboard_private.schema_migrations (name) VALUES ($1)', [name],
      )
      await client.query('COMMIT')
      console.log(`Applied migration ${name}`)
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
  }
}

if (require.main === module) {
  const pool = createPool()
  runMigrations(pool)
    .catch((error) => {
      console.error(`Database migration failed: ${error.message}`)
      process.exitCode = 1
    })
    .finally(() => pool.end())
}

module.exports = { runMigrations }
