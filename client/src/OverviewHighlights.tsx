import type { DashboardTask } from './dashboardTypes'
import './OverviewHighlights.css'

function displayTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function OverviewHighlights({
  recentTasks, upcomingTasks, loading, error, onRetry, onOpenTask, onBrowseProjects,
}: {
  recentTasks: DashboardTask[]
  upcomingTasks: DashboardTask[]
  loading: boolean
  error: string
  onRetry: () => void
  onOpenTask: (task: DashboardTask) => void
  onBrowseProjects: () => void
}) {
  return <section className="overview-highlights" aria-label="Recent and upcoming work">
    <div className="panel overview-list-panel">
      <div className="panel-header"><div><h2>Recently updated</h2><p>Latest changes in active work</p></div></div>
      {loading ? <div className="overview-empty" role="status">Loading recent work…</div> : error ? <div className="overview-empty overview-error" role="alert"><span>{error}</span><button className="subtle-link" onClick={onRetry}>Retry</button></div> : recentTasks.length ? <div className="overview-task-list">{recentTasks.map((task) => <button className="overview-task-row" key={task.apiId} onClick={() => onOpenTask(task)}>
        <span className="overview-task-main"><strong>{task.title}</strong><small>{task.id} · {task.project}</small></span>
        <span className={`overview-status status-${task.status.toLowerCase().replaceAll(' ', '-')}`}>{task.status}</span>
        <time dateTime={task.updatedAt}>{displayTime(task.updatedAt)}</time>
      </button>)}</div> : <div className="overview-empty">No active work has been updated yet.</div>}
    </div>
    <div className="panel overview-list-panel">
      <div className="panel-header"><div><h2>Upcoming due dates</h2><p>Active tasks due in the next seven days</p></div></div>
      {loading ? <div className="overview-empty" role="status">Loading upcoming work…</div> : error ? <div className="overview-empty overview-error" role="alert"><span>{error}</span><button className="subtle-link" onClick={onRetry}>Retry</button></div> : upcomingTasks.length ? <div className="overview-task-list">{upcomingTasks.map((task) => <button className="overview-task-row upcoming-row" key={task.apiId} onClick={() => onOpenTask(task)}>
        <span className="overview-task-main"><strong>{task.title}</strong><small>{task.id} · {task.project}</small></span>
        <span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
        <time dateTime={task.dueDate || undefined}>{task.due}</time>
      </button>)}</div> : <div className="overview-empty">No active tasks are due in the next seven days.</div>}
      <button className="overview-browse-link" onClick={onBrowseProjects}>Browse projects <span aria-hidden="true">→</span></button>
    </div>
  </section>
}
