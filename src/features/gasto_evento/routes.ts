import { t } from '@/plugins/i18n'
import type { RouteRecordRaw } from 'vue-router'

export const gastos_eventos_route: RouteRecordRaw = {
  path: 'database',
  name: 'PBI_GASTOS_EVENTOS::DATABASE',
  component: () => import('@/features/gasto_evento/pages/GastoEventoPage.vue'),
  meta: {
    childLabel: () => 'Base de Datos',
    title: () => 'Base de Datos',
    category: 'PBI',
  },
}

export const gastos_eventos_inferido_route: RouteRecordRaw = {
  path: '',
  name: 'PBI_GASTOS_EVENTOS::INDEX',
  component: () => import('@/features/gasto_evento/pages/GastoEventoInferidoPage.vue'),
  meta: {
    childLabel: () => 'Inferidos',
    title: () => t('titles.pbi.gastos_eventos'),
    category: 'PBI',
  },
}

const routes: Array<RouteRecordRaw> = [
  {
    path: '/gasto-evento',
    name: 'PBI_GASTOS_EVENTOS',
    component: () => import('@/app/layouts/PlainLayout.vue'),
    meta: {
      title: () => t('titles.pbi.gastos_eventos'),
      category: 'PBI',
    },
    redirect: { name: 'PBI_GASTOS_EVENTOS::INDEX' },
    children: [gastos_eventos_inferido_route, gastos_eventos_route],
  },
]

export default routes
