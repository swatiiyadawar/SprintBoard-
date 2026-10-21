const express = require('express')
const {
  validateProjectId,
  validateTask,
  validateTaskFilters,
  validateTaskPatch,
} = require('../validation')

function createTasksRouter(tasks) {
  const router = express.Router()

  router.get('/tasks', async (req, res) => {
    const filters = validateTaskFilters(req.query)
    res.json({ data: await tasks.list(filters), meta: { limit: filters.limit, offset: filters.offset } })
  })

  router.post('/tasks', async (req, res) => {
    const projectId = validateProjectId(req.body?.projectId)
    const { projectId: _projectId, ...taskBody } = req.body
    const input = validateTask(taskBody)
    const task = await tasks.create(projectId, input)
    res.status(201).json({ data: task })
  })

  router.get('/tasks/:taskId', async (req, res) => {
    const taskId = validateProjectId(req.params.taskId, 'taskId')
    const task = await tasks.getById(taskId)
    if (!task) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } })
    res.json({ data: task })
  })

  router.patch('/tasks/:taskId', async (req, res) => {
    const taskId = validateProjectId(req.params.taskId, 'taskId')
    const changes = validateTaskPatch(req.body)
    const task = await tasks.update(taskId, changes)
    if (!task) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } })
    res.json({ data: task })
  })

  router.delete('/tasks/:taskId', async (req, res) => {
    const taskId = validateProjectId(req.params.taskId, 'taskId')
    const task = await tasks.delete(taskId)
    if (!task) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } })
    res.status(204).end()
  })

  // Keep the Phase 1 nested list/create endpoints available as aliases.
  router.get('/projects/:projectId/tasks', async (req, res) => {
    const filters = validateTaskFilters(req.query)
    filters.projectId = validateProjectId(req.params.projectId)
    res.json({ data: await tasks.list(filters), meta: { limit: filters.limit, offset: filters.offset } })
  })

  router.post('/projects/:projectId/tasks', async (req, res) => {
    const projectId = validateProjectId(req.params.projectId)
    const input = validateTask(req.body)
    const task = await tasks.create(projectId, input)
    res.status(201).json({ data: task })
  })

  return router
}

module.exports = { createTasksRouter }
