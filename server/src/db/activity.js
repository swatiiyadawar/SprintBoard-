const ACTIVITY_SELECT = `id,
  task_id AS "taskId",
  event_type AS "eventType",
  event_details AS details,
  created_at AS "createdAt"`

function createActivityRepository(pool) {
  return {
    async list(taskId) {
      const result = await pool.query(
        `SELECT ${ACTIVITY_SELECT}
         FROM task_activity
         WHERE task_id = $1
         ORDER BY created_at DESC, id DESC`,
        [taskId],
      )
      return result.rows
    },
  }
}

module.exports = { createActivityRepository }
