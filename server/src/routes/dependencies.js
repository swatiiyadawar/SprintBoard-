const express = require('express')
const { validateTaskId, validateDependency } = require('../validation')

function createDependenciesRouter({ dependencies, tasks }) {
  const router = express.Router()

  router.get('/tasks/:taskId/dependencies', async (req, res) => {
    const taskId = validateTaskId(req.params.taskId)
    if (!await tasks.getById(taskId)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } })
    }
    res.json({ data: await dependencies.list(taskId) })
  })

  router.get('/tasks/:taskId/dependents', async (req, res) => {
    const taskId = validateTaskId(req.params.taskId)
    if (!await tasks.getById(taskId)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } })
    }
    res.json({ data: await dependencies.listDependents(taskId) })
  })

  router.get('/tasks/:taskId/impact', async (req, res) => {
    const taskId = validateTaskId(req.params.taskId)
    if (!await tasks.getById(taskId)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } })
    }
    res.json({ data: await dependencies.impact(taskId) })
  })

  router.post('/tasks/:taskId/dependencies', async (req, res) => {
    const taskId = validateTaskId(req.params.taskId)
    const { dependsOnTaskId } = validateDependency(req.body)
    if (taskId === dependsOnTaskId) {
      return res.status(400).json({ error: { code: 'INVALID_DEPENDENCY', message: 'A task cannot depend on itself' } })
    }
    if (!await tasks.getById(taskId) || !await tasks.getById(dependsOnTaskId)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } })
    }
    const dependency = await dependencies.add(taskId, dependsOnTaskId)
    res.status(201).json({ data: dependency })
  })

  router.delete('/tasks/:taskId/dependencies/:dependsOnTaskId', async (req, res) => {
    const taskId = validateTaskId(req.params.taskId)
    const dependsOnTaskId = validateTaskId(req.params.dependsOnTaskId, 'dependsOnTaskId')
    if (!await tasks.getById(taskId)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } })
    }
    const dependency = await dependencies.remove(taskId, dependsOnTaskId)
    if (!dependency) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Dependency not found' } })
    }
    res.status(204).end()
  })

  return router
}

module.exports = { createDependenciesRouter }
