import type { DeliveryRiskSummary, Task } from './api'
import { formatLocalShortDate } from './dashboardClock'
import './InsightsView.css'

const labels = {
  overdue: 'Overdue', blocked: 'Blocked', unassigned_high_priority: 'Unassigned high priority', dependency_bottleneck: 'Dependency bottleneck',
}

export function InsightsView({
  summary, loading, error, today, onRetry, onOpenTask,
}: {
  summary: DeliveryRiskSummary | null
  loading: boolean
  error: string
  today: string
  onRetry: () => void
  onOpenTask: (task: Task) => void
}) {
  return <section className="insights-page" aria-labelledby="insights-title">
    <header className="insights-heading"><div><div className="eyebrow">WORKSPACE ANALYTICS</div><h1 id="insights-title">Insights</h1><p>Delivery indicators calculated from current task and dependency records.</p></div><span className="risk-as-of">As of {formatLocalShortDate(today)}</span></header>
    {loading ? <div className="insights-state" role="status">Loading delivery insights…</div>
      : error ? <div className="insights-state insights-error" role="alert"><span>{error}</span><button className="subtle-link" onClick={onRetry}>Retry</button></div>
        : summary ? <>
          <div className="insights-metrics"><div><span>Affected tasks</span><strong>{summary.summary.uniqueAffectedTasks}</strong><small>of {summary.summary.totalTasks} total</small></div><div><span>Blocked</span><strong>{summary.summary.blockedTasks}</strong><small>Waiting on unfinished prerequisites</small></div><div><span>Overdue</span><strong>{summary.summary.overdueTasks}</strong><small>Incomplete past due date</small></div><div><span>Unassigned high priority</span><strong>{summary.summary.unassignedHighPriorityTasks}</strong><small>High priority with no assignee</small></div><div><span>Dependency bottlenecks</span><strong>{summary.summary.dependencyBottlenecks}</strong><small>Multiple incomplete downstream tasks</small></div></div>
          <div className="panel insights-risk-panel"><div className="panel-header"><div><h2>Delivery risks</h2><p>Each task appears once, with all matching risk reasons.</p></div><span className="risk-as-of">As of {formatLocalShortDate(summary.asOfDate)}</span></div>
            {summary.tasks.length ? <div className="risk-task-list">{summary.tasks.map((item) => <button className="risk-task-row" key={item.task.id} onClick={() => onOpenTask(item.task)}><span className="risk-task-main"><span className="risk-task-key">{item.task.key}</span><strong>{item.task.title}</strong><small>{item.task.project} · {item.task.status.replaceAll('_', ' ')}</small></span><span className="risk-task-reasons">{item.reasons.map((reason, index) => <span key={`${item.riskTypes[index]}-${reason}`} className={`risk-chip risk-${item.riskTypes[index]}`}>{labels[item.riskTypes[index]]}: {reason}</span>)}</span><span className="insight-chevron" aria-hidden="true">›</span></button>)}</div> : <div className="insights-state">{summary.summary.totalTasks ? 'No delivery risks found in current task data.' : 'No tasks yet. Insights will appear when your workspace has tasks.'}</div>}
          </div>
        </> : <div className="insights-state">No insight data is available yet.</div>}
  </section>
}
