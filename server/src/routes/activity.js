const express = require('express')
const { validateTaskId } = require('../validation')

function createActivityRouter({ activity, tasks }) {
  const router = express.Router()

  router.get('/tasks/:taskId/activity', async (req, res) => {
    const taskId = validateTaskId(req.params.taskId)
    if (!await tasks.getById(taskId)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } })
    }
    res.json({ data: await activity.list(taskId) })
  })

  return router
}

module.exports = { createActivityRouter }
