const PROJECT_COLUMNS = `id, name, key, description,
  created_at AS "createdAt", updated_at AS "updatedAt"`

function createProjectsRepository(pool) {
  return {
    async list() {
      const result = await pool.query(
        `SELECT ${PROJECT_COLUMNS} FROM projects ORDER BY created_at DESC, id`,
      )
      return result.rows
    },

    async getById(projectId) {
      const result = await pool.query(
        `SELECT ${PROJECT_COLUMNS} FROM projects WHERE id = $1`, [projectId],
      )
      return result.rows[0] || null
    },

    async create({ name, key, description }) {
      const result = await pool.query(
        `INSERT INTO projects (name, key, description)
         VALUES ($1, $2, $3)
         RETURNING ${PROJECT_COLUMNS}`,
        [name, key, description],
      )
      return result.rows[0]
    },

    async update(projectId, changes) {
      const columns = { name: 'name', key: 'key', description: 'description' }
      const fields = Object.keys(changes)
      const assignments = fields.map((field, index) => `${columns[field]} = $${index + 2}`)
      const result = await pool.query(
        `UPDATE projects SET ${assignments.join(', ')}
         WHERE id = $1
         RETURNING ${PROJECT_COLUMNS}`,
        [projectId, ...fields.map((field) => changes[field])],
      )
      return result.rows[0] || null
    },

    async delete(projectId) {
      const result = await pool.query(
        `DELETE FROM projects WHERE id = $1 RETURNING ${PROJECT_COLUMNS}`,
        [projectId],
      )
      return result.rows[0] || null
    },
  }
}

module.exports = { createProjectsRepository }
