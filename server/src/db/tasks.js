const TASK_SELECT = `t.id,
  p.key || '-' || t.task_number::text AS key,
  t.project_id AS "projectId",
  p.name AS project,
  p.key AS "projectKey",
  t.title,
  t.description,
  t.status,
  t.priority,
  t.assignee_name AS "assigneeName",
  t.assignee_initials AS "assigneeInitials",
  t.due_date AS "dueDate",
  t.labels,
  t.blocked,
  t.created_at AS "createdAt",
  t.updated_at AS "updatedAt"`

const ACTIVITY_FIELDS = [
  ['title', 'title_changed'],
  ['status', 'status_changed'],
  ['priority', 'priority_changed'],
  ['assigneeName', 'assignee_changed'],
  ['dueDate', 'due_date_changed'],
  ['description', 'description_updated'],
  ['labels', 'labels_changed'],
  ['blocked', 'blocked_changed'],
]

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function writeActivity(client, taskId, eventType, details) {
  await client.query(
    `INSERT INTO task_activity (task_id, event_type, event_details)
     VALUES ($1, $2, $3::jsonb)`,
    [taskId, eventType, JSON.stringify(details)],
  )
}

function creationDetails(task) {
  return {
    after: {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignee: { name: task.assigneeName, initials: task.assigneeInitials },
      dueDate: task.dueDate,
      labels: task.labels,
      blocked: task.blocked,
    },
  }
}

function taskActivityChanges(before, after) {
  return ACTIVITY_FIELDS.flatMap(([field, eventType]) => {
    const beforeValue = field === 'assigneeName'
      ? { name: before.assigneeName, initials: before.assigneeInitials }
      : before[field]
    const afterValue = field === 'assigneeName'
      ? { name: after.assigneeName, initials: after.assigneeInitials }
      : after[field]
    if (sameValue(beforeValue, afterValue)) return []
    return [{ eventType, details: { before: beforeValue ?? null, after: afterValue ?? null } }]
  })
}

function createTasksRepository(pool) {
  return {
    async list(filters) {
      const conditions = []
      const values = []
      const fields = {
        projectId: 't.project_id',
        status: 't.status',
        priority: 't.priority',
      }

      for (const field of ['projectId', 'status', 'priority']) {
        if (filters[field] === undefined) continue
        values.push(filters[field])
        conditions.push(`${fields[field]} = $${values.length}`)
      }
      if (filters.assignee !== undefined) {
        values.push(filters.assignee)
        conditions.push(`t.assignee_name ILIKE $${values.length}`)
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
      values.push(filters.limit, filters.offset)
      const result = await pool.query(
        `SELECT ${TASK_SELECT}
         FROM tasks t JOIN projects p ON p.id = t.project_id
         ${where}
         ORDER BY t.created_at DESC, t.task_number DESC
         LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values,
      )
      return result.rows
    },

    async getById(taskId) {
      const result = await pool.query(
        `SELECT ${TASK_SELECT}
         FROM tasks t JOIN projects p ON p.id = t.project_id
         WHERE t.id = $1`,
        [taskId],
      )
      return result.rows[0] || null
    },

    async create(projectId, task) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await client.query(
          `WITH created AS (
             INSERT INTO tasks (
               project_id, title, description, status, priority, assignee_name,
               assignee_initials, due_date, labels, blocked
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING *
           )
           SELECT ${TASK_SELECT}
           FROM created t JOIN projects p ON p.id = t.project_id`,
          [projectId, task.title, task.description, task.status, task.priority,
            task.assigneeName, task.assigneeInitials, task.dueDate, task.labels, task.blocked],
        )
        const created = result.rows[0] || null
        if (created) await writeActivity(client, created.id, 'task_created', creationDetails(created))
        await client.query('COMMIT')
        return created
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        client.release()
      }
    },

    async update(taskId, changes) {
      const columns = {
        title: 'title',
        description: 'description',
        status: 'status',
        priority: 'priority',
        assigneeName: 'assignee_name',
        assigneeInitials: 'assignee_initials',
        dueDate: 'due_date',
        labels: 'labels',
        blocked: 'blocked',
      }
      const fields = Object.keys(changes)
      const assignments = fields.map((field, index) => `${columns[field]} = $${index + 2}`)
      const values = [taskId, ...fields.map((field) => changes[field])]
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const current = await client.query(
          `SELECT title, description, status, priority,
                  assignee_name AS "assigneeName",
                  assignee_initials AS "assigneeInitials",
                  due_date AS "dueDate", labels, blocked
           FROM tasks WHERE id = $1 FOR UPDATE`,
          [taskId],
        )
        if (!current.rows[0]) {
          await client.query('COMMIT')
          return null
        }

        const result = await client.query(
          `WITH updated AS (
             UPDATE tasks SET ${assignments.join(', ')}
             WHERE id = $1
             RETURNING *
           )
           SELECT ${TASK_SELECT}
           FROM updated t JOIN projects p ON p.id = t.project_id`,
          values,
        )
        const updated = result.rows[0] || null
        if (updated) {
          for (const event of taskActivityChanges(current.rows[0], updated)) {
            await writeActivity(client, taskId, event.eventType, event.details)
          }
        }
        await client.query('COMMIT')
        return updated
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        client.release()
      }
    },

    async delete(taskId) {
      const result = await pool.query(
        `DELETE FROM tasks WHERE id = $1 RETURNING id`, [taskId],
      )
      return result.rows[0] || null
    },
  }
}

module.exports = { createTasksRepository }
