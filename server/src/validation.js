const STATUSES = ['backlog', 'in_progress', 'in_review', 'done']
const PRIORITIES = ['urgent', 'high', 'medium', 'low']
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TASK_FIELDS = ['title', 'description', 'status', 'priority', 'assigneeName', 'assigneeInitials', 'dueDate', 'labels', 'blocked']
const COMMENT_MAX_LENGTH = 5000

function invalid(message) {
  const error = new Error(message)
  error.code = 'VALIDATION_ERROR'
  throw error
}

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function requireObject(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Request body must be a JSON object')
}

function cleanString(value, field, { required = false, max = 2000 } = {}) {
  if (value === undefined || value === null) {
    if (required) invalid(`${field} is required`)
    return null
  }
  if (typeof value !== 'string') invalid(`${field} must be a string`)
  const cleaned = value.trim()
  if (required && !cleaned) invalid(`${field} is required`)
  if (cleaned.length > max) invalid(`${field} must be at most ${max} characters`)
  return cleaned || null
}

function rejectUnknownFields(input, allowed) {
  const unknown = Object.keys(input).filter((key) => !allowed.includes(key))
  if (unknown.length) invalid(`Unknown field${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`)
}

function requireChanges(input) {
  if (!Object.keys(input).length) invalid('At least one field is required')
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
}

function normalizeProject(input, { partial = false } = {}) {
  requireObject(input)
  const allowed = ['name', 'key', 'description']
  rejectUnknownFields(input, allowed)
  const project = {}
  if (!partial || 'name' in input) project.name = cleanString(input.name, 'name', { required: true, max: 120 })
  if (!partial || 'key' in input) {
    const key = cleanString(input.key, 'key', { required: true, max: 12 })
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(key)) invalid('key must start with a letter and contain only letters, numbers, _ or -')
    project.key = key.toUpperCase()
  }
  if (!partial || 'description' in input) project.description = cleanString(input.description, 'description')
  if (partial) requireChanges(project)
  return project
}

function validateProject(input) {
  return normalizeProject(input)
}

function validateProjectPatch(input) {
  return normalizeProject(input, { partial: true })
}

function normalizeTask(input, { partial = false } = {}) {
  requireObject(input)
  rejectUnknownFields(input, TASK_FIELDS)
  const task = {}

  if (!partial || 'title' in input) task.title = cleanString(input.title, 'title', { required: true, max: 240 })
  if (!partial || 'description' in input) task.description = cleanString(input.description, 'description')
  if (!partial || 'status' in input) {
    task.status = input.status === undefined ? 'backlog' : input.status
    if (!STATUSES.includes(task.status)) invalid(`status must be one of: ${STATUSES.join(', ')}`)
  }
  if (!partial || 'priority' in input) {
    task.priority = input.priority === undefined ? 'medium' : input.priority
    if (!PRIORITIES.includes(task.priority)) invalid(`priority must be one of: ${PRIORITIES.join(', ')}`)
  }
  if (!partial || 'assigneeName' in input) task.assigneeName = cleanString(input.assigneeName, 'assigneeName', { max: 120 })
  if (!partial || 'assigneeInitials' in input) task.assigneeInitials = cleanString(input.assigneeInitials, 'assigneeInitials', { max: 8 })
  if (!partial || 'dueDate' in input) {
    const dueDate = input.dueDate === '' ? null : input.dueDate
    if (dueDate !== undefined && dueDate !== null && !isValidDate(dueDate)) invalid('dueDate must be null or a date in YYYY-MM-DD format')
    task.dueDate = dueDate ?? null
  }
  if (!partial || 'labels' in input) {
    const labels = input.labels === undefined ? [] : input.labels
    if (!Array.isArray(labels) || labels.length > 20 || labels.some((label) => typeof label !== 'string' || !label.trim() || label.length > 40)) {
      invalid('labels must be an array of up to 20 non-empty strings, each at most 40 characters')
    }
    task.labels = labels.map((label) => label.trim())
  }
  if ('blocked' in input) {
    if (typeof input.blocked !== 'boolean') invalid('blocked must be a boolean')
    task.blocked = input.blocked
  } else if (!partial) {
    task.blocked = false
  }

  if (partial) requireChanges(task)
  return task
}

function validateTask(input) {
  return normalizeTask(input)
}

function validateTaskPatch(input) {
  return normalizeTask(input, { partial: true })
}

function validateProjectId(value, field = 'projectId') {
  if (!isUuid(value)) invalid(`${field} must be a UUID`)
  return value
}

function validateTaskId(value, field = 'taskId') {
  return validateProjectId(value, field)
}

function validateDependency(input) {
  requireObject(input)
  rejectUnknownFields(input, ['dependsOnTaskId'])
  return { dependsOnTaskId: validateTaskId(input.dependsOnTaskId, 'dependsOnTaskId') }
}

function normalizeComment(input, { partial = false } = {}) {
  requireObject(input)
  rejectUnknownFields(input, ['body'])
  const comment = {}
  if (!partial || 'body' in input) {
    comment.body = cleanString(input.body, 'body', { required: true, max: COMMENT_MAX_LENGTH })
  }
  if (partial) requireChanges(comment)
  return comment
}

function validateComment(input) {
  return normalizeComment(input)
}

function validateCommentPatch(input) {
  return normalizeComment(input, { partial: true })
}

function validateTaskFilters(query) {
  const allowed = ['status', 'priority', 'assignee', 'projectId', 'limit', 'offset']
  rejectUnknownFields(query, allowed)
  const filters = {}
  if (query.status !== undefined) {
    if (!STATUSES.includes(query.status)) invalid(`status must be one of: ${STATUSES.join(', ')}`)
    filters.status = query.status
  }
  if (query.priority !== undefined) {
    if (!PRIORITIES.includes(query.priority)) invalid(`priority must be one of: ${PRIORITIES.join(', ')}`)
    filters.priority = query.priority
  }
  if (query.assignee !== undefined) filters.assignee = cleanString(query.assignee, 'assignee', { required: true, max: 120 })
  if (query.projectId !== undefined) filters.projectId = validateProjectId(query.projectId)
  for (const field of ['limit', 'offset']) {
    if (query[field] === undefined) continue
    if (!/^\d+$/.test(query[field])) invalid(`${field} must be a positive integer`)
    const value = Number(query[field])
    if (!Number.isSafeInteger(value) || (field === 'limit' && (value < 1 || value > 100)) || (field === 'offset' && value > 1_000_000)) {
      invalid(field === 'limit' ? 'limit must be between 1 and 100' : 'offset must be between 0 and 1000000')
    }
    filters[field] = value
  }
  filters.limit ??= 50
  filters.offset ??= 0
  return filters
}

module.exports = {
  isUuid,
  validateProject,
  validateProjectPatch,
  validateProjectId,
  validateTaskId,
  validateDependency,
  validateTask,
  validateTaskPatch,
  validateTaskFilters,
  validateComment,
  validateCommentPatch,
}
