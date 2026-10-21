import type { Project } from './api'
import type { DashboardTask } from './dashboardTypes'
import './ProjectsView.css'

export function ProjectsView({
  projects, tasks, selectedProjectId, loading, error, onRetry, onSelectProject, onBack, onCreateProject, onCreateTask, onOpenTask,
}: {
  projects: Project[]
  tasks: DashboardTask[]
  selectedProjectId?: string
  loading: boolean
  error: string
  onRetry: () => void
  onSelectProject: (projectId: string) => void
  onBack: () => void
  onCreateProject: () => void
  onCreateTask: () => void
  onOpenTask: (task: DashboardTask) => void
}) {
  const project = projects.find((item) => item.id === selectedProjectId)
  const projectTasks = project ? tasks.filter((task) => task.projectId === project.id) : []
  const activeCount = projectTasks.filter((task) => !task.isBacklog && task.status !== 'Done').length
  const completedCount = projectTasks.filter((task) => task.status === 'Done').length

  return <section className="projects-page" aria-labelledby="projects-title">
    <header className="projects-heading">
      <div>{project && <button className="project-back-link" onClick={onBack}>← All projects</button>}<div className="eyebrow">WORKSPACE</div><h1 id="projects-title">{project?.name || 'Projects'}</h1><p>{project ? project.description || `Project ${project.key} · ${projectTasks.length} tasks` : 'Choose a project to see its tasks and delivery status.'}</p></div>
      {project ? <button className="primary-button" onClick={onCreateTask} disabled={loading}>＋ New task</button> : <button className="primary-button" onClick={onCreateProject}>＋ New project</button>}
    </header>
    {loading ? <div className="projects-state" role="status">Loading projects and tasks…</div>
      : error ? <div className="projects-state projects-error" role="alert"><span>{error}</span><button className="subtle-link" onClick={onRetry}>Retry</button></div>
        : project ? <>
          <div className="project-summary-grid"><div><span>Total tasks</span><strong>{projectTasks.length}</strong></div><div><span>Active</span><strong>{activeCount}</strong></div><div><span>Completed</span><strong>{completedCount}</strong></div><div><span>Backlog</span><strong>{projectTasks.filter((task) => task.isBacklog).length}</strong></div></div>
          <div className="panel project-task-panel"><div className="panel-header"><div><h2>{project.key} work</h2><p>Tasks in this project, including queued backlog work</p></div></div>
            {projectTasks.length ? <div className="project-task-list">{projectTasks.map((task) => <button className="project-task-row" key={task.apiId} onClick={() => onOpenTask(task)}><span className="project-task-title"><strong>{task.title}</strong><small>{task.id} · {task.project}</small></span><span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span><span className="project-task-status">{task.isBacklog ? 'Backlog' : task.status}</span><span className="project-task-assignee">{task.assignee}</span></button>)}</div> : <div className="projects-state">No tasks in this project yet. Create the first one.</div>}
          </div>
        </> : projects.length ? <div className="project-card-grid">{projects.map((item) => {
          const count = tasks.filter((task) => task.projectId === item.id).length
          return <button className="project-card" key={item.id} onClick={() => onSelectProject(item.id)}><span className="project-card-top"><span className="project-key">{item.key}</span><span className="project-card-count">{count} {count === 1 ? 'task' : 'tasks'}</span></span><strong>{item.name}</strong><p>{item.description || 'Open this project to view its tasks.'}</p><span className="project-open">Open project →</span></button>
        })}</div> : <div className="projects-state"><strong>No projects yet</strong><span>Create a project to start organizing tasks.</span><button className="primary-button" onClick={onCreateProject}>Create project</button></div>}
  </section>
}
