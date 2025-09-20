import type { RouteRecordRaw } from 'vue-router'
import { t } from '@/plugins/i18n'

export const staticRoutes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'app.home',
    component: () => import('@/app/pages/HomePage.vue'),
    meta: { noPermsRequired: true, title: () => t('titles.app.home') },
  },
  {
    path: '/server-error',
    name: 'app.error',
    component: () => import('@/app/pages/ServerError.vue'),
    meta: { noPermsRequired: true, title: () => t('titles.app.error') },
  },
  {
    path: '/unauthorized',
    name: 'app.unauthorized',
    component: () => import('@/app/pages/NotAuthorized.vue'),
    meta: { noPermsRequired: true, title: () => t('titles.app.unauthorized') },
  },
]

export const notFoundRoute: RouteRecordRaw = {
  path: '/:pathMatch(.*)*',
  name: 'app.notfound',
  component: () => import('@/app/pages/NotFound.vue'),
  meta: { noPermsRequired: true, title: () => t('titles.app.notfound') },
}

export default staticRoutes
