const express = require('express')
const { validateProject, validateProjectPatch, validateProjectId } = require('../validation')

function createProjectsRouter(projects) {
  const router = express.Router()

  router.get('/', async (_req, res) => {
    res.json({ data: await projects.list() })
  })

  router.post('/', async (req, res) => {
    const input = validateProject(req.body)
    const project = await projects.create(input)
    res.status(201).json({ data: project })
  })

  router.get('/:projectId', async (req, res) => {
    const projectId = validateProjectId(req.params.projectId)
    const project = await projects.getById(projectId)
    if (!project) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } })
    res.json({ data: project })
  })

  router.patch('/:projectId', async (req, res) => {
    const projectId = validateProjectId(req.params.projectId)
    const changes = validateProjectPatch(req.body)
    const project = await projects.update(projectId, changes)
    if (!project) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } })
    res.json({ data: project })
  })

  router.delete('/:projectId', async (req, res) => {
    const projectId = validateProjectId(req.params.projectId)
    const project = await projects.delete(projectId)
    if (!project) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } })
    res.status(204).end()
  })

  return router
}

module.exports = { createProjectsRouter }
