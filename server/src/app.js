const express = require('express')
const cors = require('cors')
const { createProjectsRouter } = require('./routes/projects')
const { createTasksRouter } = require('./routes/tasks')
const { createCommentsRouter } = require('./routes/comments')
const { createDependenciesRouter } = require('./routes/dependencies')
const { createActivityRouter } = require('./routes/activity')
const { errorHandler, notFound } = require('./middleware/errors')

function createApp({ projects, tasks, comments, dependencies, activity, pool, clientOrigin = 'http://localhost:5173' }) {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin: clientOrigin }))
  app.use(express.json({ limit: '100kb' }))
  const health = async (_req, res) => {
    await pool.query('SELECT 1')
    res.json({ data: { status: 'ok', database: 'connected' } })
  }
  app.get('/api/health', health)
  app.get('/health', health)
  app.use('/api/projects', createProjectsRouter(projects))
  app.use('/api', createTasksRouter(tasks))
  app.use('/api', createCommentsRouter({ comments, tasks }))
  if (dependencies) app.use('/api', createDependenciesRouter({ dependencies, tasks }))
  if (activity) app.use('/api', createActivityRouter({ activity, tasks }))
  app.use(notFound)
  app.use(errorHandler)
  return app
}

module.exports = { createApp }
