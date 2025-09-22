import { t } from '@/plugins/i18n'
import type { RouteRecordRaw } from 'vue-router'

export const difusion_route = {
  path: '/difusion',
  name: 'ZMS_DIFUSION',
  component: () => import('@/features/difusion/pages/DifusionPage.vue'),
  meta: { title: () => t('titles.zms.difusion'), category: 'ZMS' },
}

const routes: Array<RouteRecordRaw> = [difusion_route]

export default routes
