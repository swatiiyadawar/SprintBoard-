export type FilterableTask = {
  title: string
  status: string
  priority: string
  assignee: string
  projectId: string
}

export type TaskFilters = {
  query?: string
  status?: string
  priority?: string
  assignee?: string
  projectId?: string
  shortcut?: 'All tasks' | 'My tasks' | 'In progress'
}

export function filterTasks<T extends FilterableTask>(tasks: readonly T[], filters: TaskFilters): T[] {
  const query = filters.query?.trim().toLocaleLowerCase() || ''

  return tasks.filter((task) => {
    if (query && !task.title.toLocaleLowerCase().includes(query)) return false
    if (filters.status && task.status !== filters.status) return false
    if (filters.priority && task.priority !== filters.priority) return false
    if (filters.assignee && task.assignee !== filters.assignee) return false
    if (filters.projectId && task.projectId !== filters.projectId) return false
    if (filters.shortcut === 'My tasks' && task.assignee !== 'Maya Chen') return false
    if (filters.shortcut === 'In progress' && task.status !== 'In progress') return false
    return true
  })
}
