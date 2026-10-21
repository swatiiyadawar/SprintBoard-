const express = require('express')
const { validateComment, validateCommentPatch, validateTaskId } = require('../validation')

function createCommentsRouter({ comments, tasks }) {
  const router = express.Router()

  router.get('/tasks/:taskId/comments', async (req, res) => {
    const taskId = validateTaskId(req.params.taskId)
    if (!await tasks.getById(taskId)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } })
    }
    res.json({ data: await comments.list(taskId) })
  })

  router.post('/tasks/:taskId/comments', async (req, res) => {
    const taskId = validateTaskId(req.params.taskId)
    if (!await tasks.getById(taskId)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } })
    }
    const { body } = validateComment(req.body)
    res.status(201).json({ data: await comments.create(taskId, body) })
  })

  router.patch('/tasks/:taskId/comments/:commentId', async (req, res) => {
    const taskId = validateTaskId(req.params.taskId)
    const commentId = validateTaskId(req.params.commentId, 'commentId')
    if (!await tasks.getById(taskId)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } })
    }
    const { body } = validateCommentPatch(req.body)
    const comment = await comments.update(taskId, commentId, body)
    if (!comment) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Comment not found' } })
    res.json({ data: comment })
  })

  router.delete('/tasks/:taskId/comments/:commentId', async (req, res) => {
    const taskId = validateTaskId(req.params.taskId)
    const commentId = validateTaskId(req.params.commentId, 'commentId')
    if (!await tasks.getById(taskId)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } })
    }
    const comment = await comments.delete(taskId, commentId)
    if (!comment) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Comment not found' } })
    res.status(204).end()
  })

  return router
}

module.exports = { createCommentsRouter }
