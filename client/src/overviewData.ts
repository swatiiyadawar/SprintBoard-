import type { DashboardTask } from './dashboardTypes'

function addDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function getOverviewData(tasks: readonly DashboardTask[], today: string) {
  const activeTasks = tasks.filter((task) => !task.isBacklog)
  const completedTasks = tasks.filter((task) => task.status === 'Done').length
  const upcomingDueTasks = activeTasks
    .filter((task) => task.status !== 'Done' && task.dueDate && task.dueDate >= today && task.dueDate <= addDays(today, 7))
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
  const recentlyUpdatedTasks = [...activeTasks]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 5)

  return {
    totalTasks: tasks.length,
    openTasks: activeTasks.filter((task) => task.status !== 'Done').length,
    completedTasks,
    recentlyUpdatedTasks,
    upcomingDueTasks,
  }
}
