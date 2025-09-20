import { requireAuth } from '@/router/guards/requireAuth'
import staticRoutes, { notFoundRoute } from '@/router/routes.static'

import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const modules = import.meta.glob<{ default: RouteRecordRaw[] }>('@/features/**/routes.ts', {
  eager: true,
})

const featureRoutes: RouteRecordRaw[] = Object.values(modules).flatMap((m) => m.default || [])

export const routes = [...staticRoutes, ...featureRoutes, notFoundRoute]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: routes,
})

router.beforeEach(requireAuth)

export default router
