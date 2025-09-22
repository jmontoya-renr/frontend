import { t } from '@/plugins/i18n'
import type { RouteRecordRaw } from 'vue-router'

export const paginacion_route = {
  path: '/paginacion',
  name: 'ZMS_PAGINACION',
  component: () => import('@/features/paginacion/pages/PaginacionPage.vue'),
  meta: { title: () => t('titles.zms.paginacion'), category: 'ZMS' },
}

const routes: Array<RouteRecordRaw> = [paginacion_route]

export default routes
