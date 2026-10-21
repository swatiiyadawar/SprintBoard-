const TASK_COLUMNS = `t.id,
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

function createDeliveryRisksRepository(pool) {
  return {
    async getSummary() {
      const [taskResult, dependencyResult] = await Promise.all([
        pool.query(
          `WITH utc_today AS (
             SELECT (NOW() AT TIME ZONE 'UTC')::date::text AS "asOfDate"
           )
           SELECT utc_today."asOfDate", ${TASK_COLUMNS}
           FROM utc_today
           LEFT JOIN tasks t ON TRUE
           LEFT JOIN projects p ON p.id = t.project_id
           ORDER BY t.created_at DESC NULLS LAST, t.id`,
        ),
        pool.query(
          `SELECT task_id AS "taskId", depends_on_task_id AS "dependsOnTaskId"
           FROM task_dependencies`,
        ),
      ])

      return {
        asOfDate: taskResult.rows[0]?.asOfDate,
        tasks: taskResult.rows.filter((row) => row.id),
        dependencies: dependencyResult.rows,
      }
    },
  }
}

module.exports = { createDeliveryRisksRepository }
