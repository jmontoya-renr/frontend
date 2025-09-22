import type { NavigationGuard, RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '@/features/auth/stores'
import { pinia } from '@/plugins'
import { parseSolutionName } from '@/shared/utils/parseSolutionName'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
    noPermsRequired?: boolean
    requiredAny?: Array<string>
    requiredAll?: Array<string>
    redirectIfDenied?: RouteLocationRaw
  }
}

const HOME: RouteLocationRaw = { name: 'app.home' }
const AUTH_REDIRECT: RouteLocationRaw = { name: 'auth.login' }
const PERMS_REDIRECT: RouteLocationRaw = { name: 'app.unauthorized' }

const NO_REDIRECT_TO = ['app.unauthorized', 'app.error', 'app.notfound', 'auth.login']

export const requireAuth: NavigationGuard = (to, from) => {
  const auth = useAuthStore(pinia)
  // When going to LoginPage: If not logged -> LoginPage; Else -> Home
  if (to.name === 'auth.login') return auth.isAuthenticated ? HOME : true
  // Does not require auth
  if (to.meta.public) return true
  // If not logged -> LoginPage
  if (!auth.isAuthenticated) return { ...AUTH_REDIRECT, query: { redirect: to.fullPath } }
  // Does not require permissions
  if (to.meta.noPermsRequired) return true
  // If have permission -> SolutionPage
  const allowed = new Set<string>(auth.soluciones.map((s) => s.codigo))
  const byName = typeof to.name === 'string' && allowed.has(to.name)
  const { solutionId } = parseSolutionName(to.name)
  const bySolution = !!solutionId && allowed.has(solutionId)
  if (byName || bySolution) return true

  const canUseFrom = !!from.name && !NO_REDIRECT_TO.includes(from.name as string)

  // -> UnAuthorizedPage
  return {
    ...PERMS_REDIRECT,
    ...(canUseFrom ? { query: { redirect: from.fullPath } } : {}),
  }
}
