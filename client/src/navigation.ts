export type PageName = 'Overview' | 'Backlog' | 'Projects' | 'Inbox' | 'Insights'

export type AppRoute = { page: PageName; projectId?: string }

const pagePaths: Record<PageName, string> = {
  Overview: '/overview',
  Backlog: '/backlog',
  Projects: '/projects',
  Inbox: '/inbox',
  Insights: '/insights',
}

export function parseRoute(pathname: string): AppRoute {
  const parts = pathname.split('/').filter(Boolean)
  if (!parts.length || parts[0] === 'overview') return { page: 'Overview' }
  if (parts[0] === 'backlog' && parts.length === 1) return { page: 'Backlog' }
  if (parts[0] === 'inbox' && parts.length === 1) return { page: 'Inbox' }
  if (parts[0] === 'insights' && parts.length === 1) return { page: 'Insights' }
  if (parts[0] === 'projects') {
    try { return { page: 'Projects', ...(parts[1] ? { projectId: decodeURIComponent(parts[1]) } : {}) } }
    catch { return { page: 'Projects' } }
  }
  return { page: 'Overview' }
}

export function routePath(route: AppRoute) {
  if (route.page === 'Projects' && route.projectId) return `/projects/${encodeURIComponent(route.projectId)}`
  return pagePaths[route.page]
}
