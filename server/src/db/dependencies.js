const DEPENDENCY_SELECT = `d.depends_on_task_id AS "dependsOnTaskId",
  p.key || '-' || prerequisite.task_number::text AS key,
  prerequisite.title,
  prerequisite.status,
  prerequisite.project_id AS "projectId"`

const TASK_SELECT = `t.id AS "taskId",
  p.key || '-' || t.task_number::text AS key,
  t.title,
  t.status,
  t.project_id AS "projectId",
  p.name AS project`

function dependencyError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function createDependenciesRepository(pool) {
  return {
    async list(taskId) {
      const result = await pool.query(
        `SELECT ${DEPENDENCY_SELECT}
         FROM task_dependencies d
         JOIN tasks prerequisite ON prerequisite.id = d.depends_on_task_id
         JOIN projects p ON p.id = prerequisite.project_id
         WHERE d.task_id = $1
         ORDER BY d.created_at, prerequisite.title`,
        [taskId],
      )
      return result.rows
    },

    async listDependents(taskId) {
      const result = await pool.query(
        `SELECT ${TASK_SELECT}
         FROM task_dependencies d
         JOIN tasks t ON t.id = d.task_id
         JOIN projects p ON p.id = t.project_id
         WHERE d.depends_on_task_id = $1
         ORDER BY d.created_at, t.title`,
        [taskId],
      )
      return result.rows
    },

    async impact(taskId) {
      const result = await pool.query(
        `WITH RECURSIVE downstream(task_id, depth, path) AS (
           SELECT dependency.task_id, 1, ARRAY[$1::uuid, dependency.task_id]
           FROM task_dependencies dependency
           WHERE dependency.depends_on_task_id = $1
           UNION ALL
           SELECT dependency.task_id, downstream.depth + 1, downstream.path || dependency.task_id
           FROM task_dependencies dependency
           JOIN downstream ON dependency.depends_on_task_id = downstream.task_id
           WHERE NOT dependency.task_id = ANY(downstream.path)
         ), nearest AS (
           SELECT DISTINCT ON (task_id) task_id, depth
           FROM downstream
           ORDER BY task_id, depth
         )
         SELECT ${TASK_SELECT}, nearest.depth
         FROM nearest
         JOIN tasks t ON t.id = nearest.task_id
         JOIN projects p ON p.id = t.project_id
         ORDER BY nearest.depth, t.title`,
        [taskId],
      )
      return result.rows
    },

    async add(taskId, dependsOnTaskId) {
      if (taskId === dependsOnTaskId) {
        throw dependencyError('DEPENDENCY_SELF', 'A task cannot depend on itself')
      }
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        // Serialize graph edits so concurrent requests cannot jointly create a cycle.
        await client.query('SELECT pg_advisory_xact_lock($1)', [537_214_937])
        const pair = await client.query(
          `SELECT task.id AS task_id, task.project_id AS task_project_id,
                  prerequisite.id AS prerequisite_id, prerequisite.project_id AS prerequisite_project_id,
                  prerequisite.title AS prerequisite_title,
                  prerequisite.task_number AS prerequisite_number,
                  project.key AS prerequisite_project_key
           FROM tasks task
           JOIN tasks prerequisite ON prerequisite.id = $2
           JOIN projects project ON project.id = prerequisite.project_id
           WHERE task.id = $1
           FOR KEY SHARE OF task, prerequisite`,
          [taskId, dependsOnTaskId],
        )
        if (!pair.rows[0]) throw dependencyError('TASK_NOT_FOUND', 'Both tasks must exist')
        if (pair.rows[0].task_project_id !== pair.rows[0].prerequisite_project_id) {
          throw dependencyError('DEPENDENCY_PROJECT_MISMATCH', 'Dependencies must belong to the same project')
        }

        const cycle = await client.query(
          `WITH RECURSIVE prerequisites(id) AS (
             SELECT $2::uuid
             UNION
             SELECT dependency.depends_on_task_id
             FROM task_dependencies dependency
             JOIN prerequisites current ON dependency.task_id = current.id
           )
           SELECT EXISTS (SELECT 1 FROM prerequisites WHERE id = $1) AS would_create_cycle`,
          [taskId, dependsOnTaskId],
        )
        if (cycle.rows[0]?.would_create_cycle) {
          throw dependencyError('DEPENDENCY_CYCLE', 'This dependency would create a circular task dependency')
        }

        const result = await client.query(
          `INSERT INTO task_dependencies (task_id, depends_on_task_id)
           VALUES ($1, $2)
           RETURNING task_id AS "taskId", depends_on_task_id AS "dependsOnTaskId"`,
          [taskId, dependsOnTaskId],
        )
        await client.query(
          `INSERT INTO task_activity (task_id, event_type, event_details)
           VALUES ($1, 'dependency_added', $2::jsonb)`,
          [taskId, JSON.stringify({ dependsOnTaskId, key: `${pair.rows[0].prerequisite_project_key}-${pair.rows[0].prerequisite_number}`, title: pair.rows[0].prerequisite_title })],
        )
        await client.query('COMMIT')
        return result.rows[0] || null
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        client.release()
      }
    },

    async remove(taskId, dependsOnTaskId) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('SELECT pg_advisory_xact_lock($1)', [537_214_937])
        const result = await client.query(
          `DELETE FROM task_dependencies d
           USING tasks prerequisite, projects project
           WHERE d.task_id = $1 AND d.depends_on_task_id = $2
             AND prerequisite.id = d.depends_on_task_id
             AND project.id = prerequisite.project_id
           RETURNING d.task_id AS "taskId", d.depends_on_task_id AS "dependsOnTaskId",
                     project.key || '-' || prerequisite.task_number::text AS key,
                     prerequisite.title`,
          [taskId, dependsOnTaskId],
        )
        if (result.rows[0]) {
          await client.query(
            `INSERT INTO task_activity (task_id, event_type, event_details)
             VALUES ($1, 'dependency_removed', $2::jsonb)`,
            [taskId, JSON.stringify({ dependsOnTaskId, key: result.rows[0].key, title: result.rows[0].title })],
          )
        }
        await client.query('COMMIT')
        return result.rows[0] || null
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        client.release()
      }
    },
  }
}

module.exports = { createDependenciesRepository }
