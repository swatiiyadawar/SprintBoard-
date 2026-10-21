import { useMemo, useState } from 'react'
import type { Project } from './api'
import type { DashboardTask } from './dashboardTypes'
import { filterTasks } from './taskFilters'
import './BacklogView.css'

type BacklogRow = {
  task: DashboardTask
  title: string
  status: string
  priority: string
  assignee: string
  projectId: string
  isBacklog: boolean
}

const statusLabels: Record<DashboardTask['status'], string> = {
  'To do': 'To do', 'In progress': 'In progress', 'In review': 'In review', Done: 'Done',
}

export function BacklogView({
  tasks, projects, loading, error, savingTaskId, onRetry, onCreate, onOpen, onMoveToActive,
}: {
  tasks: DashboardTask[]
  projects: Project[]
  loading: boolean
  error: string
  savingTaskId: string
  onRetry: () => void
  onCreate: () => void
  onOpen: (task: DashboardTask) => void
  onMoveToActive: (task: DashboardTask) => void
}) {
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [priority, setPriority] = useState('')
  const [assignee, setAssignee] = useState('')
  const [projectId, setProjectId] = useState('')

  const rows = useMemo<BacklogRow[]>(() => tasks.map((task) => ({
    task,
    title: task.title,
    status: statusLabels[task.status],
    priority: task.priority.toLowerCase(),
    assignee: task.assignee,
    projectId: task.projectId,
    isBacklog: task.isBacklog,
  })), [tasks])
  const filtered = useMemo(() => filterTasks(rows, {
    query, status: status, priority,
    assignee, projectId, isBacklog: true,
  }), [rows, query, status, priority, assignee, projectId])
  const assignees = [...new Set(rows.map((row) => row.assignee))].sort((a, b) => a.localeCompare(b))

  return <section className="backlog-page" aria-labelledby="backlog-title">
    <header className="backlog-heading">
      <div><div className="eyebrow">WORK QUEUE</div><h1 id="backlog-title">Backlog</h1><p>Work waiting to be pulled into active delivery. Workflow status remains separate.</p></div>
      <button className="primary-button" onClick={onCreate} disabled={!projects.length}>＋ Add to backlog</button>
    </header>
    <div className="backlog-toolbar" role="search">
      <label className="backlog-search"><span>Search backlog</span><input aria-label="Search backlog by task title" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search task titles"/></label>
      <label><span>Status</span><select aria-label="Filter backlog by status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label><span>Priority</span><select aria-label="Filter backlog by priority" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">All priorities</option>{['urgent', 'high', 'medium', 'low'].map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
      <label><span>Assignee</span><select aria-label="Filter backlog by assignee" value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Anyone</option>{assignees.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      <label><span>Project</span><select aria-label="Filter backlog by project" value={projectId} onChange={(event) => setProjectId(event.target.value)}><option value="">All projects</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name} ({project.key})</option>)}</select></label>
    </div>
    <div className="backlog-table" role="table" aria-label="Backlog tasks">
      <div className="backlog-table-head" role="row"><span role="columnheader">Task</span><span role="columnheader">Status</span><span role="columnheader">Priority</span><span role="columnheader">Assignee</span><span role="columnheader">Due date</span><span role="columnheader">Project</span><span role="columnheader">Action</span></div>
      {loading ? <div className="backlog-state" role="status">Loading backlog…</div>
        : error ? <div className="backlog-state backlog-error" role="alert"><span>{error}</span><button className="subtle-link" onClick={onRetry}>Retry</button></div>
          : filtered.length ? filtered.map(({ task, status: taskStatus, priority: taskPriority, assignee: taskAssignee }) => <div className="backlog-row" role="row" key={task.apiId}>
            <button className="backlog-task" role="cell" onClick={() => onOpen(task)}><strong>{task.title}</strong><small>{task.id}{task.labels.length ? ` · ${task.labels.join(', ')}` : ''}</small></button>
            <span role="cell">{taskStatus}</span><span role="cell" className={`priority priority-${taskPriority}`}>{taskPriority[0].toUpperCase() + taskPriority.slice(1)}</span>
            <span role="cell">{taskAssignee}</span><span role="cell">{task.due || 'No date'}</span><span role="cell">{task.project}</span>
            <button className="backlog-move" disabled={savingTaskId === task.apiId} onClick={() => onMoveToActive(task)} aria-label={`Move ${task.id} to active work`}>{savingTaskId === task.apiId ? 'Moving…' : 'Move to active'}</button>
          </div>)
          : <div className="backlog-state"><strong>{tasks.length ? 'No backlog tasks match these filters.' : 'Your backlog is clear.'}</strong><span>{tasks.length ? 'Try changing or clearing a filter.' : 'Capture work here, then move it into active work when the team is ready.'}</span></div>}
    </div>
  </section>
}
