function notFound(_req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } })
}

function errorHandler(error, _req, res, _next) {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } })
  }

  if (error.code === '23505') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'A record with those values already exists' } })
  }
  if (error.code === '23503') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } })
  }
  if (error.code === '23514' || error.code === '22P02' || error.code === '22007') {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'One or more values are invalid' } })
  }
  if (error.code === 'VALIDATION_ERROR') {
    return res.status(400).json({ error: { code: 'INVALID_INPUT', message: error.message } })
  }
  if (error.code === 'DEPENDENCY_CYCLE') {
    return res.status(400).json({ error: { code: 'INVALID_DEPENDENCY', message: error.message } })
  }
  if (error.code === 'DEPENDENCY_SELF' || error.code === 'DEPENDENCY_PROJECT_MISMATCH') {
    return res.status(400).json({ error: { code: 'INVALID_DEPENDENCY', message: error.message } })
  }
  if (error.code === 'TASK_NOT_FOUND') {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: error.message } })
  }
  if (error.code === '42P01') {
    return res.status(503).json({ error: { code: 'DATABASE_SCHEMA_NOT_READY', message: 'A required database migration has not been applied to this database' } })
  }
  if (error.type === 'entity.too.large' || error.status === 413) {
    return res.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds the 100 KB limit' } })
  }
  if (['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH', 'EAI_AGAIN', '57P01', '57P03', '53300', '08000', '08003', '08006'].includes(error.code)) {
    console.error('Database unavailable:', error.code)
    return res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'The database is temporarily unavailable' } })
  }

  console.error(error)
  return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' } })
}

module.exports = { notFound, errorHandler }
