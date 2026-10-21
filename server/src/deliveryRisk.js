const RISK_TYPES = Object.freeze({
  OVERDUE: 'overdue',
  BLOCKED: 'blocked',
  UNASSIGNED_HIGH_PRIORITY: 'unassigned_high_priority',
  DEPENDENCY_BOTTLENECK: 'dependency_bottleneck',
})

const STATUS_LABELS = Object.freeze({
  backlog: 'Backlog',
  in_progress: 'In progress',
  in_review: 'In review',
  done: 'Done',
})

function asDateString(value) {
  if (!value) return null
  return String(value).slice(0, 10)
}

function summarizeDeliveryRisks({ tasks, dependencies, asOfDate }) {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const prerequisites = new Map()
  const downstream = new Map()

  for (const edge of dependencies) {
    if (!byId.has(edge.taskId) || !byId.has(edge.dependsOnTaskId)) continue
    const taskPrerequisites = prerequisites.get(edge.taskId) || []
    taskPrerequisites.push(byId.get(edge.dependsOnTaskId))
    prerequisites.set(edge.taskId, taskPrerequisites)

    const directDependents = downstream.get(edge.dependsOnTaskId) || []
    directDependents.push(edge.taskId)
    downstream.set(edge.dependsOnTaskId, directDependents)
  }

  // Dependency writes reject cycles. Keep this traversal guarded as defense in depth
  // for databases that contain older or manually-created relationships.
  const descendantCache = new Map()
  function descendantsFor(taskId, visiting = new Set()) {
    if (descendantCache.has(taskId)) return descendantCache.get(taskId)
    if (visiting.has(taskId)) return new Set()
    const nextVisiting = new Set(visiting)
    nextVisiting.add(taskId)
    const result = new Set()
    for (const dependentId of downstream.get(taskId) || []) {
      result.add(dependentId)
      for (const nestedId of descendantsFor(dependentId, nextVisiting)) result.add(nestedId)
    }
    descendantCache.set(taskId, result)
    return result
  }

  const incomplete = (task) => task.status !== 'done'
  const affected = []
  const counts = {
    overdueTasks: 0,
    blockedTasks: 0,
    unassignedHighPriorityTasks: 0,
    dependencyBottlenecks: 0,
  }

  for (const task of tasks) {
    if (!incomplete(task)) continue
    const risks = []
    const reasons = []
    const dueDate = asDateString(task.dueDate)
    if (dueDate && dueDate < asOfDate) {
      risks.push(RISK_TYPES.OVERDUE)
      reasons.push(`Overdue · due ${dueDate}`)
      counts.overdueTasks += 1
    }

    const unfinishedPrerequisites = (prerequisites.get(task.id) || []).filter(incomplete)
    if (unfinishedPrerequisites.length) {
      risks.push(RISK_TYPES.BLOCKED)
      reasons.push(`Waiting on ${unfinishedPrerequisites.length} unfinished prerequisite${unfinishedPrerequisites.length === 1 ? '' : 's'}: ${unfinishedPrerequisites.map((item) => `${item.key} · ${item.title} (${STATUS_LABELS[item.status] || item.status})`).join('; ')}`)
      counts.blockedTasks += 1
    }

    if (task.priority === 'high' && !String(task.assigneeName || '').trim()) {
      risks.push(RISK_TYPES.UNASSIGNED_HIGH_PRIORITY)
      reasons.push('High priority · unassigned')
      counts.unassignedHighPriorityTasks += 1
    }

    const incompleteDownstreamTasks = [...descendantsFor(task.id)]
      .map((id) => byId.get(id))
      .filter((dependent) => dependent && dependent.id !== task.id && incomplete(dependent))
      .sort((a, b) => a.key.localeCompare(b.key))
    if (incompleteDownstreamTasks.length > 1) {
      risks.push(RISK_TYPES.DEPENDENCY_BOTTLENECK)
      reasons.push(`${incompleteDownstreamTasks.length} incomplete downstream dependents: ${incompleteDownstreamTasks.map((item) => item.key).join(', ')}`)
      counts.dependencyBottlenecks += 1
    }

    if (risks.length) {
      affected.push({ task, riskTypes: risks, reasons })
    }
  }

  return {
    asOfDate,
    summary: {
      totalTasks: tasks.length,
      uniqueAffectedTasks: affected.length,
      ...counts,
    },
    tasks: affected,
  }
}

module.exports = { RISK_TYPES, summarizeDeliveryRisks }
