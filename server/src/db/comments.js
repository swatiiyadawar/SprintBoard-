const COMMENT_SELECT = `id,
  task_id AS "taskId",
  body,
  created_at AS "createdAt",
  updated_at AS "updatedAt"`

function createCommentsRepository(pool) {
  return {
    async list(taskId) {
      const result = await pool.query(
        `SELECT ${COMMENT_SELECT}
         FROM task_comments
         WHERE task_id = $1
         ORDER BY created_at ASC, id ASC`,
        [taskId],
      )
      return result.rows
    },

    async create(taskId, body) {
      const result = await pool.query(
        `INSERT INTO task_comments (task_id, body)
         VALUES ($1, $2)
         RETURNING ${COMMENT_SELECT}`,
        [taskId, body],
      )
      return result.rows[0]
    },

    async update(taskId, commentId, body) {
      const result = await pool.query(
        `UPDATE task_comments
         SET body = $3
         WHERE task_id = $1 AND id = $2
         RETURNING ${COMMENT_SELECT}`,
        [taskId, commentId, body],
      )
      return result.rows[0] || null
    },

    async delete(taskId, commentId) {
      const result = await pool.query(
        `DELETE FROM task_comments
         WHERE task_id = $1 AND id = $2
         RETURNING id`,
        [taskId, commentId],
      )
      return result.rows[0] || null
    },
  }
}

module.exports = { createCommentsRepository }
