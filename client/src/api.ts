export type ApiStatus = 'backlog' | 'in_progress' | 'in_review' | 'done'
export type ApiPriority = 'urgent' | 'high' | 'medium' | 'low'

export type Project = {
  id: string
  name: string
  key: string
  description: string | null
  createdAt: string
  updatedAt: string
}

export type Task = {
  id: string
  key: string
  projectId: string
  project: string
  projectKey: string
  title: string
  description: string | null
  status: ApiStatus
  priority: ApiPriority
  assigneeName: string | null
  assigneeInitials: string | null
  dueDate: string | null
  labels: string[]
  blocked: boolean
  createdAt: string
  updatedAt: string
}

export type TaskComment = {
  id: string
  taskId: string
  body: string
  createdAt: string
  updatedAt: string
}

export type TaskDependency = {
  dependsOnTaskId: string
  key: string
  title: string
  status: ApiStatus
  projectId: string
}

export type TaskDependent = {
  taskId: string
  key: string
  title: string
  status: ApiStatus
  projectId: string
  project: string
}

export type TaskImpact = TaskDependent & { depth: number }

export type TaskActivityType =
  | 'task_created'
  | 'status_changed'
  | 'priority_changed'
  | 'assignee_changed'
  | 'due_date_changed'
  | 'description_updated'
  | 'title_changed'
  | 'labels_changed'
  | 'blocked_changed'
  | 'dependency_added'
  | 'dependency_removed'

export type TaskActivity = {
  id: string
  taskId: string
  eventType: TaskActivityType
  details: Record<string, unknown>
  createdAt: string
}

export type CreateCommentInput = { body: string }

export type CreateTaskInput = {
  projectId: string
  title: string
  description?: string | null
  status?: ApiStatus
  priority?: ApiPriority
  assigneeName?: string | null
  assigneeInitials?: string | null
  dueDate?: string | null
  labels?: string[]
  blocked?: boolean
}

export type UpdateTaskInput = Partial<Omit<CreateTaskInput, 'projectId'>>
export type CreateTaskDependencyInput = { dependsOnTaskId: string }
export type CreateProjectInput = { name: string; key: string; description?: string | null }

type ApiEnvelope<T> = { data: T }
type TaskListEnvelope = { data: Task[]; meta: { limit: number; offset: number } }

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || 'http://localhost:3001/api').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new Error(`Could not reach SprintBoard API at ${API_BASE_URL}. Check that the backend is running.`)
  }

  const payload = await response.json().catch(() => null) as ({ error?: { message?: string } } & Record<string, unknown>) | null
  if (!response.ok) {
    throw new Error(payload?.error?.message || `Request failed (${response.status})`)
  }
  return payload as T
}

export const api = {
  async getProjects(): Promise<Project[]> {
    const response = await request<ApiEnvelope<Project[]>>('/projects')
    return response.data
  },
  async getTasks(): Promise<Task[]> {
    const tasks: Task[] = []
    let offset = 0
    while (true) {
      const response = await request<TaskListEnvelope>(`/tasks?limit=100&offset=${offset}`)
      tasks.push(...response.data)
      if (response.data.length < response.meta.limit) return tasks
      offset += response.data.length
    }
  },
  async createProject(input: CreateProjectInput): Promise<Project> {
    const response = await request<ApiEnvelope<Project>>('/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return response.data
  },
  async createTask(input: CreateTaskInput): Promise<Task> {
    const response = await request<ApiEnvelope<Task>>('/tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return response.data
  },
  async updateTask(id: string, input: UpdateTaskInput): Promise<Task> {
    const response = await request<ApiEnvelope<Task>>(`/tasks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    })
    return response.data
  },
  async getDependencies(taskId: string): Promise<TaskDependency[]> {
    const response = await request<ApiEnvelope<TaskDependency[]>>(`/tasks/${encodeURIComponent(taskId)}/dependencies`)
    return response.data
  },
  async getDependents(taskId: string): Promise<TaskDependent[]> {
    const response = await request<ApiEnvelope<TaskDependent[]>>(`/tasks/${encodeURIComponent(taskId)}/dependents`)
    return response.data
  },
  async getDependencyImpact(taskId: string): Promise<TaskImpact[]> {
    const response = await request<ApiEnvelope<TaskImpact[]>>(`/tasks/${encodeURIComponent(taskId)}/impact`)
    return response.data
  },
  async addDependency(taskId: string, input: CreateTaskDependencyInput): Promise<void> {
    await request<ApiEnvelope<{ taskId: string; dependsOnTaskId: string }>>(`/tasks/${encodeURIComponent(taskId)}/dependencies`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },
  async removeDependency(taskId: string, dependsOnTaskId: string): Promise<void> {
    await request<unknown>(`/tasks/${encodeURIComponent(taskId)}/dependencies/${encodeURIComponent(dependsOnTaskId)}`, {
      method: 'DELETE',
    })
  },
  async getActivity(taskId: string): Promise<TaskActivity[]> {
    const response = await request<ApiEnvelope<TaskActivity[]>>(`/tasks/${encodeURIComponent(taskId)}/activity`)
    return response.data
  },
  async getComments(taskId: string): Promise<TaskComment[]> {
    const response = await request<ApiEnvelope<TaskComment[]>>(`/tasks/${encodeURIComponent(taskId)}/comments`)
    return response.data
  },
  async createComment(taskId: string, input: CreateCommentInput): Promise<TaskComment> {
    const response = await request<ApiEnvelope<TaskComment>>(`/tasks/${encodeURIComponent(taskId)}/comments`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
    return response.data
  },
}
