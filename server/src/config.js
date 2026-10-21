const path = require('node:path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '..', '.env') })

function loadConfig(env = process.env) {
  const port = Number(env.PORT || 3001)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535')
  }

  return {
    port,
    databaseUrl: env.DATABASE_URL || '',
    clientOrigin: env.CLIENT_ORIGIN || 'http://localhost:5173',
    pgSsl: env.PGSSL === 'true',
    pgSslCaPath: env.PGSSL_CA_PATH
      ? path.resolve(env.PGSSL_CA_PATH)
      : path.resolve(__dirname, '..', 'certs', 'supabase-root.crt'),
  }
}

module.exports = { loadConfig }
