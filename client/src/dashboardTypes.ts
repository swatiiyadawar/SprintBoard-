export type DashboardTask = {
  apiId: string
  id: string
  projectId: string
  title: string
  project: string
  status: 'To do' | 'In progress' | 'In review' | 'Done'
  priority: 'Urgent' | 'High' | 'Medium' | 'Low'
  assignee: string
  initials: string
  due: string
  dueDate: string | null
  labels: string[]
  description: string
  blocked: boolean
  isBacklog: boolean
  createdAt: string
  updatedAt: string
}
