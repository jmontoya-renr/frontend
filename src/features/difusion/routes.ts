import { t } from '@/plugins/i18n'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/difusion',
    name: 'ZMS_DIFUSION',
    component: () => import('@/features/difusion/pages/DifusionPage.vue'),
    meta: { title: () => t('titles.zms.difusion'), category: 'ZMS' },
  },
]

export default routes
