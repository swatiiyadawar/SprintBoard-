const fs = require('node:fs')
const { Pool } = require('pg')
const { loadConfig } = require('../config')

function createPool(config = loadConfig()) {
  if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required. Copy .env.example to .env and configure PostgreSQL.')
  }

  return new Pool({
    connectionString: config.databaseUrl,
    // Keep hostname/certificate verification enabled and trust Supabase's root CA.
    ssl: config.pgSsl ? {
      ca: fs.readFileSync(config.pgSslCaPath, 'utf8'),
      rejectUnauthorized: true,
    } : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  })
}

module.exports = { createPool }
