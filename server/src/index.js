const { loadConfig } = require('./config')
const { createPool } = require('./db/pool')
const { createProjectsRepository } = require('./db/projects')
const { createTasksRepository } = require('./db/tasks')
const { createCommentsRepository } = require('./db/comments')
const { createDependenciesRepository } = require('./db/dependencies')
const { createActivityRepository } = require('./db/activity')
const { createApp } = require('./app')

async function start() {
  const config = loadConfig()
  const pool = createPool(config)
  const projects = createProjectsRepository(pool)
  const tasks = createTasksRepository(pool)
  const comments = createCommentsRepository(pool)
  const dependencies = createDependenciesRepository(pool)
  const activity = createActivityRepository(pool)
  const app = createApp({ projects, tasks, comments, dependencies, activity, pool, clientOrigin: config.clientOrigin })
  const server = app.listen(config.port, () => {
    console.log(`SprintBoard API listening on http://localhost:${config.port}`)
  })

  const shutdown = () => server.close(async () => {
    await pool.end()
    process.exit(0)
  })
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

if (require.main === module) {
  start().catch((error) => {
    console.error(`Failed to start SprintBoard API: ${error.message}`)
    process.exitCode = 1
  })
}

module.exports = { start }
