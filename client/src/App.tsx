import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type ApiPriority, type ApiStatus, type Project, type Task as ApiTask, type TaskActivity, type TaskComment, type TaskDependency, type TaskDependent, type TaskImpact, type UpdateTaskInput } from './api'
import { filterTasks } from './taskFilters'
import './App.css'
import './ApiStates.css'
import './TaskFilters.css'
import './Comments.css'
import './TaskFields.css'

type Status = 'Backlog' | 'In progress' | 'In review' | 'Done'
type Priority = 'Urgent' | 'High' | 'Medium' | 'Low'
type Task = {
  apiId: string
  id: string
  projectId: string
  title: string
  project: string
  status: Status
  priority: Priority
  assignee: string
  initials: string
  due: string
  dueDate: string | null
  labels: string[]
  description: string
  blocked: boolean
  createdAt: string
  updatedAt: string
}

const columns: Status[] = ['Backlog', 'In progress', 'In review', 'Done']
const statuses: Record<ApiStatus, Status> = {
  backlog: 'Backlog', in_progress: 'In progress', in_review: 'In review', done: 'Done',
}
const apiStatuses: Record<Status, ApiStatus> = {
  Backlog: 'backlog', 'In progress': 'in_progress', 'In review': 'in_review', Done: 'done',
}
const priorities: Record<ApiPriority, Priority> = {
  urgent: 'Urgent', high: 'High', medium: 'Medium', low: 'Low',
}
const apiPriorities: Record<Priority, ApiPriority> = {
  Urgent: 'urgent', High: 'high', Medium: 'medium', Low: 'low',
}
const avatarColors = ['lilac', 'peach', 'mint', 'blue']

function mapTask(task: ApiTask): Task {
  const assignee = task.assigneeName || 'Unassigned'
  const initials = task.assigneeInitials || (task.assigneeName
    ? task.assigneeName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
    : '—')
  return {
    apiId: task.id,
    id: task.key,
    projectId: task.projectId,
    title: task.title,
    project: task.project,
    status: statuses[task.status],
    priority: priorities[task.priority],
    assignee,
    initials,
    due: formatDate(task.dueDate),
    dueDate: task.dueDate,
    labels: task.labels || [],
    description: task.description || '',
    blocked: task.blocked,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  }
}

function formatDate(value: string | null) {
  if (!value) return 'No date'
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`)
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function assigneeInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase()
}

function activityValue(value: unknown) {
  return value === null || value === undefined || value === '' ? 'Unassigned' : String(value)
}

function activityAssignee(value: unknown) {
  if (!value || typeof value !== 'object') return activityValue(value)
  const name = (value as { name?: unknown }).name
  return activityValue(name)
}

function activityMessage(event: TaskActivity) {
  const before = event.details.before
  const after = event.details.after
  switch (event.eventType) {
    case 'task_created': {
      const title = after && typeof after === 'object' ? (after as { title?: unknown }).title : undefined
      return title ? `Task created: ${String(title)}` : 'Task created'
    }
    case 'status_changed':
      return `Status changed from ${statuses[before as ApiStatus] || activityValue(before)} to ${statuses[after as ApiStatus] || activityValue(after)}`
    case 'priority_changed':
      return `Priority changed from ${activityValue(before)} to ${activityValue(after)}`
    case 'assignee_changed':
      return `Assignee changed from ${activityAssignee(before)} to ${activityAssignee(after)}`
    case 'due_date_changed':
      return `Due date changed from ${formatDate(typeof before === 'string' ? before : null)} to ${formatDate(typeof after === 'string' ? after : null)}`
    case 'description_updated':
      return 'Description updated'
    case 'title_changed':
      return `Title changed from “${activityValue(before)}” to “${activityValue(after)}”`
    case 'labels_changed':
      return `Labels changed from ${Array.isArray(before) && before.length ? before.join(', ') : 'none'} to ${Array.isArray(after) && after.length ? after.join(', ') : 'none'}`
    case 'blocked_changed':
      return after ? 'Task marked as blocked' : 'Task unblocked'
    case 'dependency_added': {
      const key = event.details.key
      const title = event.details.title
      return `Dependency added${key ? `: ${String(key)}` : ''}${title ? ` · ${String(title)}` : ''}`
    }
    case 'dependency_removed': {
      const key = event.details.key
      const title = event.details.title
      return `Dependency removed${key ? `: ${String(key)}` : ''}${title ? ` · ${String(title)}` : ''}`
    }
  }
}

function dayDistance(value: string) {
  const today = new Date()
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  const due = new Date(`${value.slice(0, 10)}T00:00:00Z`).getTime()
  return Math.ceil((due - todayUtc) / 86_400_000)
}

function colorFor(initials: string) {
  const hash = [...initials].reduce((value, char) => value + char.charCodeAt(0), 0)
  return avatarColors[hash % avatarColors.length]
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const }
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
    inbox: <><path d="M4 4h16l1 12h-6l-3 3-3-3H3L4 4Z"/><path d="M3 13h5l2 3h4l2-3h5"/></>,
    chart: <><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    down: <path d="m7 10 5 5 5-5"/>,
    dots: <><circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/></>,
    board: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16m6-16v16"/></>,
    list: <><path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/></>,
    filter: <><path d="M4 6h16M7 12h10m-7 6h4"/><circle cx="8" cy="6" r="2" fill="white"/><circle cx="15" cy="12" r="2" fill="white"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    spark: <><path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Z"/><path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
    arrow: <><path d="M5 12h14m-6-6 6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    bolt: <path d="m13 2-3 9h7l-6 11 2-9H6l7-11Z"/>,
    link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2A5 5 0 0 0 12.4 4.4l-1.2 1.2"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2A5 5 0 0 0 11.6 20l1.2-1.2"/></>,
  }
  return <svg {...common}>{paths[name] || paths.grid}</svg>
}

function App() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [updatingTaskId, setUpdatingTaskId] = useState('')
  const [activeNav, setActiveNav] = useState('Overview')
  const [activeProjectId, setActiveProjectId] = useState('')
  const [view, setView] = useState<'Board' | 'List'>('Board')
  const [filter, setFilter] = useState<'All tasks' | 'My tasks' | 'In progress'>('All tasks')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<Status | ''>('')
  const [priorityFilter, setPriorityFilter] = useState<Priority | ''>('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [selected, setSelected] = useState<Task | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [createMode, setCreateMode] = useState<'task' | 'project' | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newAssignee, setNewAssignee] = useState('')
  const [newDueDate, setNewDueDate] = useState('')
  const [newProjectId, setNewProjectId] = useState('')
  const [createStatus, setCreateStatus] = useState<Status>('Backlog')
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectKey, setNewProjectKey] = useState('')
  const [toast, setToast] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [editingDescription, setEditingDescription] = useState(false)
  const [descriptionDraft, setDescriptionDraft] = useState('')
  const [assigneeDraft, setAssigneeDraft] = useState('')
  const [dueDateDraft, setDueDateDraft] = useState('')
  const [dependenciesState, setDependenciesState] = useState<{ taskId: string; items: TaskDependency[]; dependents: TaskDependent[]; impact: TaskImpact[]; error: string } | null>(null)
  const [dependencyCandidate, setDependencyCandidate] = useState('')
  const [dependencySaving, setDependencySaving] = useState(false)
  const [dependenciesReloadKey, setDependenciesReloadKey] = useState(0)
  const [activityState, setActivityState] = useState<{ taskId: string; reloadKey: number; items: TaskActivity[]; error: string } | null>(null)
  const [activityReloadKey, setActivityReloadKey] = useState(0)
  const [commentsState, setCommentsState] = useState<{
    taskId: string
    reloadKey: number
    items: TaskComment[]
    error: string
  } | null>(null)
  const [commentDraft, setCommentDraft] = useState('')
  const [commentSaveError, setCommentSaveError] = useState('')
  const [commentSaving, setCommentSaving] = useState(false)
  const [commentsReloadKey, setCommentsReloadKey] = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const [nextProjects, nextTasks] = await Promise.all([api.getProjects(), api.getTasks()])
      setProjects(nextProjects)
      setTasks(nextTasks.map(mapTask))
      setActiveProjectId((current) => nextProjects.some((project) => project.id === current) ? current : '')
      setNewProjectId((current) => current || nextProjects[0]?.id || '')
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load projects and tasks.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadData])

  useEffect(() => {
    const taskId = selected?.apiId
    if (!taskId) return
    let active = true
    void api.getComments(taskId)
      .then((items) => {
        if (active) setCommentsState({ taskId, reloadKey: commentsReloadKey, items, error: '' })
      })
      .catch((error: unknown) => {
        if (active) setCommentsState({
          taskId,
          reloadKey: commentsReloadKey,
          items: [],
          error: error instanceof Error ? error.message : 'Could not load comments.',
        })
      })
    return () => { active = false }
  }, [selected?.apiId, commentsReloadKey])

  useEffect(() => {
    const taskId = selected?.apiId
    if (!taskId) return
    let active = true
    void Promise.all([api.getDependencies(taskId), api.getDependents(taskId), api.getDependencyImpact(taskId)])
      .then(([items, dependents, impact]) => {
        if (active) setDependenciesState({ taskId, items, dependents, impact, error: '' })
      })
      .catch((error: unknown) => {
        if (active) setDependenciesState({
          taskId,
          items: [],
          dependents: [],
          impact: [],
          error: error instanceof Error ? error.message : 'Could not load dependencies.',
        })
      })
    return () => { active = false }
  }, [selected?.apiId, dependenciesReloadKey])

  useEffect(() => {
    const taskId = selected?.apiId
    if (!taskId) return
    let active = true
    void api.getActivity(taskId)
      .then((items) => {
        if (active) setActivityState({ taskId, reloadKey: activityReloadKey, items, error: '' })
      })
      .catch((error: unknown) => {
        if (active) setActivityState({
          taskId,
          reloadKey: activityReloadKey,
          items: [],
          error: error instanceof Error ? error.message : 'Could not load task activity.',
        })
      })
    return () => { active = false }
  }, [selected?.apiId, activityReloadKey])

  const filteredTasks = useMemo(() => filterTasks(tasks, {
    query,
    status: statusFilter,
    priority: priorityFilter,
    assignee: assigneeFilter,
    projectId: projectFilter || activeProjectId,
    shortcut: filter,
  }), [tasks, activeProjectId, filter, query, statusFilter, priorityFilter, assigneeFilter, projectFilter])
  const assignees = useMemo(() => [...new Set(tasks.map((task) => task.assignee))].sort((a, b) => a.localeCompare(b)), [tasks])
  const hasActiveFilters = Boolean(query.trim() || statusFilter || priorityFilter || assigneeFilter || projectFilter || activeProjectId || filter !== 'All tasks')
  const currentComments = commentsState && commentsState.taskId === selected?.apiId && commentsState.reloadKey === commentsReloadKey ? commentsState : null
  const comments = currentComments?.items || []
  const commentsLoading = Boolean(selected && !currentComments)
  const commentsError = currentComments?.error || ''
  const currentDependencies = dependenciesState?.taskId === selected?.apiId ? dependenciesState : null
  const dependencies = currentDependencies?.items || []
  const dependents = currentDependencies?.dependents || []
  const dependencyImpact = currentDependencies?.impact || []
  const dependenciesLoading = Boolean(selected && !currentDependencies)
  const dependenciesError = currentDependencies?.error || ''
  const currentActivity = activityState && selected && activityState.taskId === selected.apiId && activityState.reloadKey === activityReloadKey ? activityState : null
  const activity = currentActivity?.items || []
  const activityLoading = Boolean(selected && !currentActivity)
  const activityError = currentActivity?.error || ''
  const dependencyOptions = selected
    ? tasks.filter((task) => task.apiId !== selected.apiId && task.projectId === selected.projectId && !dependencies.some((dependency) => dependency.dependsOnTaskId === task.apiId))
    : []

  const clearFilters = () => {
    setQuery('')
    setStatusFilter('')
    setPriorityFilter('')
    setAssigneeFilter('')
    setProjectFilter('')
    setActiveProjectId('')
    setFilter('All tasks')
  }

  const openTaskCreate = (status: Status = 'Backlog') => {
    setSaveError('')
    setNewTitle('')
    setNewDescription('')
    setNewAssignee('')
    setNewDueDate('')
    setCreateStatus(status)
    setNewProjectId(activeProjectId || projects[0]?.id || '')
    setCreateMode('task')
    setFilter(status === 'In progress' ? 'In progress' : 'All tasks')
  }

  const openProjectCreate = () => {
    setSaveError('')
    setNewProjectName('')
    setNewProjectKey('')
    setCreateMode('project')
  }

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  const createTask = async () => {
    if (!newTitle.trim() || !newProjectId || saving) return
    setSaving(true)
    setSaveError('')
    try {
      const created = await api.createTask({
        projectId: newProjectId,
        title: newTitle.trim(),
        description: newDescription.trim() || null,
        status: apiStatuses[createStatus],
        priority: 'medium',
        assigneeName: newAssignee.trim() || null,
        assigneeInitials: newAssignee.trim() ? assigneeInitials(newAssignee) : null,
        dueDate: newDueDate || null,
        labels: [],
      })
      setTasks((current) => [mapTask(created), ...current])
      setCreateMode(null)
      showToast('Task saved to the project')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not create the task.')
    } finally {
      setSaving(false)
    }
  }

  const createProject = async () => {
    if (!newProjectName.trim() || !newProjectKey.trim() || saving) return
    setSaving(true)
    setSaveError('')
    try {
      const created = await api.createProject({ name: newProjectName.trim(), key: newProjectKey.trim(), description: null })
      setProjects((current) => [created, ...current])
      setActiveProjectId(created.id)
      setActiveNav('Projects')
      setCreateMode(null)
      showToast('Project saved')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not create the project.')
    } finally {
      setSaving(false)
    }
  }

  const updateTask = async (task: Task, patch: UpdateTaskInput) => {
    if (updatingTaskId) return null
    setUpdatingTaskId(task.apiId)
    setSaveError('')
    try {
      const updated = mapTask(await api.updateTask(task.apiId, patch))
      setTasks((current) => current.map((item) => item.apiId === updated.apiId ? updated : item))
      setSelected((current) => current?.apiId === updated.apiId ? updated : current)
      setAssigneeDraft(updated.assignee === 'Unassigned' ? '' : updated.assignee)
      setDueDateDraft(updated.dueDate || '')
      setActivityReloadKey((current) => current + 1)
      return updated
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the task change.'
      setSaveError(message)
      showToast(message)
      return null
    } finally {
      setUpdatingTaskId('')
    }
  }

  const openTask = (task: Task) => {
    setSelected(task)
    setSaveError('')
    setCommentDraft('')
    setCommentSaveError('')
    setEditingDescription(false)
    setDescriptionDraft(task.description)
    setAssigneeDraft(task.assignee === 'Unassigned' ? '' : task.assignee)
    setDueDateDraft(task.dueDate || '')
    setDependencyCandidate('')
  }

  const addTaskDependency = async () => {
    if (!selected || !dependencyCandidate || dependencySaving) return
    setDependencySaving(true)
    setDependenciesState((current) => ({ taskId: selected.apiId, items: current?.taskId === selected.apiId ? current.items : [], dependents: current?.dependents || [], impact: current?.impact || [], error: '' }))
    try {
      await api.addDependency(selected.apiId, { dependsOnTaskId: dependencyCandidate })
      const [items, nextDependents, impact] = await Promise.all([api.getDependencies(selected.apiId), api.getDependents(selected.apiId), api.getDependencyImpact(selected.apiId)])
      setDependenciesState({ taskId: selected.apiId, items, dependents: nextDependents, impact, error: '' })
      setActivityReloadKey((current) => current + 1)
      setDependencyCandidate('')
      showToast('Dependency added')
    } catch (error) {
      setDependenciesState((current) => ({
        taskId: selected.apiId,
        items: current?.taskId === selected.apiId ? current.items : [],
        dependents: current?.dependents || [],
        impact: current?.impact || [],
        error: error instanceof Error ? error.message : 'Could not add this dependency.',
      }))
    } finally {
      setDependencySaving(false)
    }
  }

  const removeTaskDependency = async (dependsOnTaskId: string) => {
    if (!selected || dependencySaving) return
    setDependencySaving(true)
    setDependenciesState((current) => ({ taskId: selected.apiId, items: current?.taskId === selected.apiId ? current.items : [], dependents: current?.dependents || [], impact: current?.impact || [], error: '' }))
    try {
      await api.removeDependency(selected.apiId, dependsOnTaskId)
      const [items, nextDependents, impact] = await Promise.all([api.getDependencies(selected.apiId), api.getDependents(selected.apiId), api.getDependencyImpact(selected.apiId)])
      setDependenciesState({ taskId: selected.apiId, items, dependents: nextDependents, impact, error: '' })
      setActivityReloadKey((current) => current + 1)
      showToast('Dependency removed')
    } catch (error) {
      setDependenciesState((current) => ({
        taskId: selected.apiId,
        items: current?.taskId === selected.apiId ? current.items : [],
        dependents: current?.dependents || [],
        impact: current?.impact || [],
        error: error instanceof Error ? error.message : 'Could not remove this dependency.',
      }))
    } finally {
      setDependencySaving(false)
    }
  }

  const postComment = async () => {
    if (!selected || !commentDraft.trim() || commentSaving) return
    setCommentSaving(true)
    setCommentSaveError('')
    try {
      await api.createComment(selected.apiId, { body: commentDraft.trim() })
      setCommentDraft('')
      setCommentsReloadKey((current) => current + 1)
      showToast('Comment posted')
    } catch (error) {
      setCommentSaveError(error instanceof Error ? error.message : 'Could not post comment.')
    } finally {
      setCommentSaving(false)
    }
  }

  const openTasks = tasks.filter((task) => task.status !== 'Done').length
  const completedTasks = tasks.filter((task) => task.status === 'Done').length
  const dueSoon = tasks.filter((task) => task.dueDate && dayDistance(task.dueDate) >= 0 && dayDistance(task.dueDate) <= 7)
  const completedPercent = tasks.length ? Math.round(completedTasks / tasks.length * 100) : 0
  const workloads = tasks.reduce<Record<string, { name: string; initials: string; count: number }>>((grouped, task) => {
    if (task.assignee === 'Unassigned') return grouped
    const current = grouped[task.assignee] || { name: task.assignee, initials: task.initials, count: 0 }
    current.count += 1
    grouped[task.assignee] = current
    return grouped
  }, {})
  const workloadList = Object.values(workloads).slice(0, 4)
  const maxWorkload = Math.max(1, ...workloadList.map((item) => item.count))
  const attentionTasks = tasks.filter((task) => task.blocked || (task.dueDate && dayDistance(task.dueDate) <= 1)).slice(0, 2)

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><span/><span/><span/></div><span>Sprint<span className="brand-light">Board</span></span><button className="icon-button workspace-menu" aria-label="Switch workspace"><Icon name="down" size={15}/></button></div>
      <button className="workspace-card"><span className="workspace-avatar">S</span><span className="workspace-copy"><strong>Studio North</strong><small>Free workspace</small></span><Icon name="down" size={15}/></button>
      <div className="side-label">WORKSPACE</div>
      <nav className="main-nav" aria-label="Main navigation">{[{ name: 'Overview', icon: 'grid' }, { name: 'Projects', icon: 'layers', count: String(projects.length) }, { name: 'Inbox', icon: 'inbox', count: '3' }, { name: 'Insights', icon: 'chart' }].map((item) => <button key={item.name} className={`nav-item ${activeNav === item.name ? 'active' : ''}`} onClick={() => { setActiveNav(item.name); if (item.name !== 'Projects') setActiveProjectId('') }}><Icon name={item.icon}/><span>{item.name}</span>{item.count && <small>{item.count}</small>}</button>)}</nav>
      <div className="side-section"><div className="section-heading"><span>YOUR PROJECTS</span><button className="tiny-button" onClick={openProjectCreate} aria-label="Add a project"><Icon name="plus" size={16}/></button></div>{projects.length ? projects.map((project, index) => <button className={`project-link ${activeProjectId === project.id ? 'project-selected' : ''}`} key={project.id} onClick={() => { setProjectFilter(''); setActiveProjectId(project.id); setActiveNav('Projects') }}><span className={`project-dot ${avatarColors[index % avatarColors.length]}`}/><span>{project.name}</span><small>{tasks.filter((task) => task.projectId === project.id).length}</small></button>) : <div className="project-empty">{loading ? 'Loading projects…' : 'No projects yet'}</div>}</div>
      <div className="sidebar-bottom"><div className="upgrade-card"><div className="upgrade-glyph"><Icon name="spark" size={16}/></div><strong>Make room for big ideas</strong><p>Invite your team and build something great together.</p><button onClick={() => showToast('Invite flow coming soon')}>Invite teammates <Icon name="arrow" size={14}/></button></div><button className="profile-row"><span className="avatar avatar-lilac">MC</span><span><strong>Maya Chen</strong><small>Product designer</small></span><Icon name="dots"/></button></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><Icon name="chevron" size={14}/><strong>{activeNav === 'Overview' ? 'Overview' : activeNav}</strong></div><div className="top-actions"><button className="top-icon notification" aria-label="Notifications"><Icon name="inbox"/><i/></button><span className="top-divider"/><button className="avatar avatar-lilac top-avatar" aria-label="Your profile">MC</button></div></header>
      <div className="page-content">
        <div className="greeting-row"><div><div className="eyebrow"><span className="live-dot"/> MONDAY, OCTOBER 20, 2026</div><h1>Good morning, Maya <span className="wave">✳</span></h1><p className="subtitle">Here’s what’s happening across your workspace.</p></div><button className="primary-button" onClick={() => openTaskCreate()} disabled={!projects.length}><Icon name="plus" size={17}/> New task</button></div>
        <section className="stats-grid" aria-label="Workspace summary"><div className="stat-card"><div className="stat-top"><span>Open tasks</span><span className="stat-icon icon-violet"><Icon name="layers" size={17}/></span></div><div className="stat-number">{openTasks}</div><div className="stat-foot">Across {projects.length} projects</div><div className="stat-spark spark-purple"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div><div className="stat-card"><div className="stat-top"><span>Completed tasks</span><span className="stat-icon icon-green"><Icon name="check" size={17}/></span></div><div className="stat-number">{completedTasks}</div><div className="stat-foot">From {tasks.length} total tasks</div><div className="stat-spark spark-green"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div><div className="stat-card"><div className="stat-top"><span>Due in 7 days</span><span className="stat-icon icon-orange"><Icon name="clock" size={17}/></span></div><div className="stat-number">{dueSoon.length}</div><div className="stat-foot"><span className="trend-warn">{dueSoon.filter((task) => task.dueDate && dayDistance(task.dueDate) === 0).length} due today</span><span> · across {new Set(dueSoon.map((task) => task.projectId)).size} projects</span></div><div className="due-progress"><i/><i/><i/><i/><i/><i/><i/><i/></div></div><div className="stat-card health-card"><div className="stat-top"><span>Completion</span><span className="health-badge"><i/> Live data</span></div><div className="health-content"><div className="health-ring"><span>{completedPercent}<small>%</small></span></div><div><strong>{completedTasks} of {tasks.length} done</strong><p>Based on loaded<br/>project tasks.</p></div></div><div className="stat-foot">{projects.length} projects loaded <span className="health-spark">⌁</span></div></div></section>

        <section className="delivery-grid"><div className="panel work-panel"><div className="panel-header"><div><div className="panel-title-row"><h2>Team workload</h2><span className="muted-count">Current tasks</span></div><p>Tasks assigned across your team</p></div><button className="text-action" onClick={() => setFilter('My tasks')}>View my tasks <Icon name="arrow" size={15}/></button></div>{workloadList.length ? <div className="workload-list">{workloadList.map((person, index) => <div className="workload-row" key={person.name}><span className={`avatar avatar-${colorFor(person.initials)}`}>{person.initials}</span><span className="person-name">{person.name}</span><div className="workload-track"><span className={`workload-fill fill-${index}`} style={{ width: `${person.count / maxWorkload * 100}%` }}/></div><span className="workload-count">{person.count} <small>tasks</small></span></div>)}</div> : <div className="panel-empty">No assigned tasks yet</div>}</div>
          <div className="panel focus-panel"><div className="panel-header"><div><div className="panel-title-row"><h2>Needs attention</h2><span className="attention-count">{attentionTasks.length}</span></div><p>Based on blocked and near-due tasks</p></div><button className="dots-button" aria-label="More options"><Icon name="dots"/></button></div>{attentionTasks.length ? attentionTasks.map((task) => <button className="attention-item" key={task.apiId} onClick={() => openTask(task)}><span className={`attention-icon ${task.blocked ? 'red' : 'amber'}`}><Icon name={task.blocked ? 'bolt' : 'calendar'} size={16}/></span><span className="attention-copy"><strong>{task.blocked ? 'Task is blocked' : 'Due soon'}</strong><small>{task.title}</small></span><span className="attention-tag">{task.blocked ? 'Blocked' : task.due}</span></button>) : <div className="panel-empty">Nothing needs attention right now</div>}<button className="attention-footer" onClick={() => setFilter('In progress')}>See in-progress work <Icon name="arrow" size={14}/></button></div></section>

        <section className="tasks-panel panel"><div className="tasks-heading"><div><div className="panel-title-row"><h2>{projects.find((project) => project.id === (projectFilter || activeProjectId))?.name || 'Project work'}</h2><span className="task-total">{filteredTasks.length} tasks</span></div><p>Keep an eye on the work moving your team forward.</p></div><button className="ai-button" onClick={() => setAiOpen(true)}><Icon name="spark" size={16}/> Ask Sprint AI</button></div><div className="task-toolbar"><div className="filter-tabs">{(['All tasks', 'My tasks', 'In progress'] as const).map((item) => <button className={filter === item ? 'selected-tab' : ''} key={item} onClick={() => setFilter(item)}>{item}{item === 'In progress' && <span>{tasks.filter((task) => task.status === 'In progress').length}</span>}</button>)}</div><div className="toolbar-right"><label className="task-search"><Icon name="search" size={15}/><input type="search" aria-label="Search task titles" placeholder="Search task titles…" value={query} onChange={(event) => setQuery(event.target.value)}/></label><button className={`toolbar-button ${showFilter ? 'toolbar-active' : ''}`} aria-expanded={showFilter} onClick={() => setShowFilter((value) => !value)}><Icon name="filter" size={15}/> Filter {hasActiveFilters && <i/>}</button><div className="view-switch"><button aria-label="Board view" className={view === 'Board' ? 'view-active' : ''} onClick={() => setView('Board')}><Icon name="board" size={16}/></button><button aria-label="List view" className={view === 'List' ? 'view-active' : ''} onClick={() => setView('List')}><Icon name="list" size={16}/></button></div></div></div>
          {showFilter && <div className="task-filter-panel">
            <label>Status<select aria-label="Filter by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as Status | '')}><option value="">Any status</option>{columns.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label>Priority<select aria-label="Filter by priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as Priority | '')}><option value="">Any priority</option>{(['Urgent', 'High', 'Medium', 'Low'] as const).map((priority) => <option key={priority}>{priority}</option>)}</select></label>
            <label>Assignee<select aria-label="Filter by assignee" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}><option value="">Anyone</option>{assignees.map((assignee) => <option key={assignee}>{assignee}</option>)}</select></label>
            <label>Project<select aria-label="Filter by project" value={projectFilter} onChange={(event) => { setActiveProjectId(''); setProjectFilter(event.target.value) }}><option value="">Any project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name} ({project.key})</option>)}</select></label>
            {hasActiveFilters && <button className="clear-filters" onClick={clearFilters}>Clear filters</button>}
          </div>}
          {loading && <div className="api-state" role="status">Loading projects and tasks…</div>}
          {!loading && loadError && <div className="api-state api-error" role="alert"><strong>Couldn’t load workspace data</strong><span>{loadError}</span><button className="cancel-button" onClick={() => void loadData()}>Retry</button></div>}
          {!loading && !loadError && !projects.length && <div className="api-state"><strong>No projects yet</strong><span>Create a project to start adding tasks.</span><button className="primary-button" onClick={openProjectCreate}>Create project <Icon name="plus" size={15}/></button></div>}
          {!loading && !loadError && projects.length > 0 && (filteredTasks.length === 0 ? <div className="task-filter-empty"><strong>{hasActiveFilters ? 'No tasks match these filters' : 'No tasks yet'}</strong><span>{hasActiveFilters ? 'Try changing your search or clearing one or more filters.' : 'Create a task to get this project moving.'}</span><button className="cancel-button" onClick={hasActiveFilters ? clearFilters : () => openTaskCreate() }>{hasActiveFilters ? 'Clear filters' : 'Create task'}</button></div> : view === 'Board' ? <div className="board-grid">{columns.map((status) => <div className="board-column" key={status}><div className="column-head"><span className={`status-dot dot-${status.toLowerCase().replace(' ', '-')}`}/><strong>{status}</strong><span className="column-count">{filteredTasks.filter((task) => task.status === status).length}</span><button className="column-add" onClick={() => openTaskCreate(status)} aria-label={`Add task to ${status}`}><Icon name="plus" size={15}/></button><button className="column-more" aria-label={`More ${status} options`}><Icon name="dots" size={16}/></button></div><div className="column-cards">{filteredTasks.filter((task) => task.status === status).map((task) => <button className="task-card" key={task.apiId} onClick={() => openTask(task)}><div className="task-card-top"><span>{task.id}</span>{task.blocked && <span className="blocked-dot" title="Blocked"/>}<button onClick={(event) => { event.stopPropagation(); openTask(task) }} aria-label={`More options for ${task.id}`}><Icon name="dots" size={15}/></button></div><strong className="task-title">{task.title}</strong><div className="task-labels">{task.labels.slice(0, 2).map((label) => <span key={label} className={`label-chip label-${label.toLowerCase()}`}>{label}</span>)}</div><div className="task-card-foot"><span className={`priority priority-${task.priority.toLowerCase()}`}><i/>{task.priority}</span><span className="due-date"><Icon name="calendar" size={13}/>{task.due}</span><span className={`avatar avatar-${colorFor(task.initials)} mini-avatar`}>{task.initials}</span></div></button>)}</div>{filteredTasks.filter((task) => task.status === status).length === 0 && <div className="empty-column">No tasks here yet</div>}</div>)}</div> : <div className="list-view"><div className="list-head"><span>Task</span><span>Status</span><span>Assignee</span><span>Due date</span><span>Priority</span></div>{filteredTasks.map((task) => <button className="list-row" key={task.apiId} onClick={() => openTask(task)}><span className="list-task"><span className={`status-dot dot-${task.status.toLowerCase().replace(' ', '-')}`}/><span><strong>{task.title}</strong><small>{task.id} · {task.project}</small></span></span><span className="list-status">{task.status}</span><span className="list-assignee"><span className={`avatar avatar-${colorFor(task.initials)} mini-avatar`}>{task.initials}</span>{task.assignee}</span><span className="list-date"><Icon name="calendar" size={13}/>{task.due}</span><span className={`priority priority-${task.priority.toLowerCase()}`}><i/>{task.priority}</span></button>)}</div>)}
        </section>
        <footer className="page-footer"><span>Made for teams that ship thoughtfully.</span><span><i className="footer-dot"/> API connected · {projects.length} projects · {tasks.length} tasks</span></footer>
      </div>
    </main>

    {selected && <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><aside className="detail-drawer"><div className="drawer-top"><span className="drawer-id">{selected.id}</span><div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close"><Icon name="close"/></button></div></div><h2 className="drawer-title">{selected.title}</h2><div className="drawer-controls"><label>Status<select disabled={updatingTaskId === selected.apiId} value={selected.status} onChange={(event) => void updateTask(selected, { status: apiStatuses[event.target.value as Status] })}>{columns.map((status) => <option key={status}>{status}</option>)}</select></label><label>Priority<select disabled={updatingTaskId === selected.apiId} value={selected.priority} onChange={(event) => void updateTask(selected, { priority: apiPriorities[event.target.value as Priority] })}>{['Urgent', 'High', 'Medium', 'Low'].map((priority) => <option key={priority}>{priority}</option>)}</select></label></div>{updatingTaskId === selected.apiId && <div className="drawer-saving" role="status">Saving task…</div>}{saveError && <div className="inline-error" role="alert">{saveError}</div>}<div className="drawer-fields"><label className="task-edit-field"><span>Assignee</span><div><input value={assigneeDraft} onChange={(event) => setAssigneeDraft(event.target.value)} maxLength={120} placeholder="Unassigned" disabled={updatingTaskId === selected.apiId}/><button className="subtle-link" disabled={updatingTaskId === selected.apiId} onClick={() => void updateTask(selected, { assigneeName: assigneeDraft.trim() || null, assigneeInitials: assigneeDraft.trim() ? assigneeInitials(assigneeDraft) : null })}>Save</button></div><small>Names are free text until workspace members are available.</small></label><label className="task-edit-field"><span>Due date</span><div><input type="date" value={dueDateDraft} onChange={(event) => setDueDateDraft(event.target.value)} disabled={updatingTaskId === selected.apiId}/><button className="subtle-link" disabled={updatingTaskId === selected.apiId} onClick={() => void updateTask(selected, { dueDate: dueDateDraft || null })}>Save</button></div></label><div><span>Project</span><strong><span className="project-dot purple"/>{selected.project}</strong></div><div><span>Labels</span><span className="task-labels">{selected.labels.map((label) => <span className="label-chip" key={label}>{label}</span>)}</span></div></div><div className="drawer-section"><h3>Description</h3>{editingDescription ? <><textarea className="description-editor" value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} maxLength={2000}/><div className="drawer-actions"><button className="cancel-button" onClick={() => setEditingDescription(false)}>Cancel</button><button className="primary-button" disabled={updatingTaskId === selected.apiId} onClick={async () => { const updated = await updateTask(selected, { description: descriptionDraft }); if (updated) setEditingDescription(false) }}>Save description</button></div></> : <><p>{selected.description || 'No description yet.'}</p><button className="subtle-link" onClick={() => { setDescriptionDraft(selected.description); setEditingDescription(true) }}>Edit description</button></>}</div><section className="drawer-section"><div className="section-title-row"><h3>Dependencies</h3></div>{dependenciesLoading ? <div className="comments-state" role="status">Loading dependencies…</div> : dependenciesError ? <div className="comments-error" role="alert"><span>{dependenciesError}</span><button className="subtle-link" onClick={() => setDependenciesReloadKey((current) => current + 1)}>Retry</button></div> : dependencies.length ? <div className="dependency-list">{dependencies.map((dependency) => <div className="dependency-row" key={dependency.dependsOnTaskId}><Icon name="link" size={15}/><span><small>{dependency.key} · {statuses[dependency.status]}</small><strong>{dependency.title}</strong></span><button className="subtle-link" disabled={dependencySaving} onClick={() => void removeTaskDependency(dependency.dependsOnTaskId)} aria-label={`Remove dependency ${dependency.key}`}>Remove</button></div>)}</div> : <div className="dependency-empty"><Icon name="link" size={15}/> No dependencies tracked</div>}<div className="dependency-add"><select aria-label="Select prerequisite task" value={dependencyCandidate} onChange={(event) => setDependencyCandidate(event.target.value)} disabled={dependencySaving || dependenciesLoading || Boolean(dependenciesError) || !dependencyOptions.length}><option value="">Select a prerequisite task</option>{dependencyOptions.map((task) => <option key={task.apiId} value={task.apiId}>{task.id} · {task.title}</option>)}</select><button className="cancel-button" disabled={!dependencyCandidate || dependencySaving || Boolean(dependenciesError)} onClick={() => void addTaskDependency()}>{dependencySaving ? 'Saving…' : 'Add dependency'}</button></div><small className="field-hint">A prerequisite is work that must finish before this task.</small>{dependents.length > 0 && <div className="dependency-impact-group"><h4>Direct dependents</h4>{dependents.map((item) => <div className="dependency-impact-row" key={item.taskId}><strong>{item.key}</strong><span>{item.title}</span></div>)}</div>}<div className="dependency-impact-group"><h4>Downstream impact</h4>{dependencyImpact.length ? dependencyImpact.map((item) => <div className="dependency-impact-row" key={item.taskId}><strong>{item.key}</strong><span>{item.title}</span><small>{item.depth === 1 ? "Direct" : `${item.depth} steps downstream`}</small></div>) : <div className="dependency-empty">No downstream tasks are blocked by this task.</div>}</div></section><div className="drawer-section activity-section"><div className="section-title-row"><h3>Activity</h3>{activity.length > 0 && <span className="comment-count">{activity.length}</span>}</div>{activityLoading ? <div className="comments-state" role="status">Loading activity…</div> : activityError ? <div className="comments-error" role="alert"><span>{activityError}</span><button className="subtle-link" onClick={() => setActivityReloadKey((current) => current + 1)}>Retry</button></div> : activity.length ? <div className="activity-list">{activity.map((event) => <div className="activity-entry" key={event.id}><span className={`avatar mini-avatar activity-mark ${event.eventType === 'task_created' ? 'avatar-peach' : 'avatar-lilac'}`}><Icon name={event.eventType === 'task_created' ? 'check' : 'clock'} size={12}/></span><p>{activityMessage(event)}<small><time dateTime={event.createdAt}>{formatTimestamp(event.createdAt)}</time></small></p></div>)}</div> : <div className="comments-state">No activity recorded yet.</div>}</div><div className="drawer-section comments-section"><div className="section-title-row"><h3>Comments</h3><span className="comment-count">{comments.length}</span></div>{commentsLoading ? <div className="comments-state" role="status">Loading comments…</div> : commentsError ? <div className="comments-error" role="alert"><span>{commentsError}</span><button className="subtle-link" onClick={() => setCommentsReloadKey((current) => current + 1)}>Retry</button></div> : comments.length ? <div className="comment-list">{comments.map((comment) => <article className="comment-item" key={comment.id}><p>{comment.body}</p><time dateTime={comment.createdAt}>{formatTimestamp(comment.createdAt)}</time>{comment.updatedAt !== comment.createdAt && <small>Edited {formatTimestamp(comment.updatedAt)}</small>}</article>)}</div> : <div className="comments-state">No comments yet. Start the conversation.</div>}</div><div className="comment-composer"><label htmlFor="task-comment">Write a comment</label><textarea id="task-comment" value={commentDraft} onChange={(event) => setCommentDraft(event.target.value)} maxLength={5000} placeholder="Share an update with your team…" disabled={commentSaving}/>{commentSaveError && <div className="inline-error" role="alert">{commentSaveError}</div>}<div className="comment-composer-footer"><span>{commentDraft.length}/5000</span><button className="primary-button" onClick={() => void postComment()} disabled={commentSaving || !commentDraft.trim()}>{commentSaving ? 'Posting…' : 'Post comment'}</button></div></div></aside></div>}

    {aiOpen && <div className="modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setAiOpen(false) }}><section className="ai-modal"><div className="ai-modal-head"><div className="ai-mark"><Icon name="spark" size={19}/></div><div><h2>Break work into clear tasks</h2><p>Sprint AI · Preview only</p></div><button className="icon-button" onClick={() => setAiOpen(false)} aria-label="Close"><Icon name="close"/></button></div><div className="ai-source"><span className="source-icon"><Icon name="bolt" size={15}/></span><span><strong>Workspace data connection</strong><small>AI assistance is not connected in this phase.</small></span></div><div className="ai-suggestions"><h3>What Sprint AI will help with</h3><p>Task breakdowns and risk summaries will be added in a later phase. No data will be changed from this preview.</p></div><button className="primary-button" onClick={() => setAiOpen(false)}>Close preview</button></section></div>}

    {createMode && <div className="modal-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setCreateMode(null) }}><section className="create-modal"><div className="create-head"><div><h2>{createMode === 'task' ? 'Create a task' : 'Create a project'}</h2><p>{createMode === 'task' ? 'Save a task to a real project' : 'Create a project in your workspace'}</p></div><button className="icon-button" onClick={() => setCreateMode(null)} aria-label="Close" disabled={saving}><Icon name="close"/></button></div>{createMode === 'task' ? <><label className="create-label">Task name<input autoFocus placeholder="What needs to get done?" value={newTitle} maxLength={240} onChange={(event) => setNewTitle(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void createTask()}/></label><label className="create-label">Project<select value={newProjectId} onChange={(event) => setNewProjectId(event.target.value)} disabled={!projects.length || saving}><option value="" disabled>Select a project</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name} ({project.key})</option>)}</select></label><label className="create-label">Description<textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} maxLength={2000} placeholder="Optional task details"/></label><label className="create-label">Assignee<input value={newAssignee} onChange={(event) => setNewAssignee(event.target.value)} maxLength={120} placeholder="Optional name"/></label><label className="create-label">Due date<input type="date" value={newDueDate} onChange={(event) => setNewDueDate(event.target.value)}/></label><label className="create-label">Status<select value={createStatus} onChange={(event) => setCreateStatus(event.target.value as Status)} disabled={saving}>{columns.map((status) => <option key={status}>{status}</option>)}</select></label><div className="create-meta"><span>Medium priority</span></div></> : <><label className="create-label">Project name<input autoFocus value={newProjectName} maxLength={120} onChange={(event) => setNewProjectName(event.target.value)} placeholder="Project name"/></label><label className="create-label">Project key<input value={newProjectKey} maxLength={12} onChange={(event) => setNewProjectKey(event.target.value)} placeholder="e.g. PLATFORM"/></label></>}{saveError && <div className="inline-error" role="alert">{saveError}</div>}<div className="create-actions"><button className="cancel-button" onClick={() => setCreateMode(null)} disabled={saving}>Cancel</button><button className="primary-button" onClick={() => createMode === 'task' ? void createTask() : void createProject()} disabled={saving || (createMode === 'task' ? !newTitle.trim() || !newProjectId : !newProjectName.trim() || !newProjectKey.trim())}>{saving ? 'Saving…' : createMode === 'task' ? 'Create task' : 'Create project'} {!saving && <Icon name="arrow" size={15}/>}</button></div></section></div>}
    {toast && <div className="toast"><span><Icon name="check" size={15}/></span>{toast}</div>}
  </div>
}

export default App
