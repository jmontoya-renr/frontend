import { t } from '@/plugins/i18n'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/gasto-evento',
    name: 'PBI_GASTOS_EVENTOS',
    component: () => import('@/features/gasto_evento/pages/GastoEventoPage.vue'),
    meta: { title: () => t('titles.pbi.gastos_eventos'), category: 'PBI' },
  },
]

export default routes
