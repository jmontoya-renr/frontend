import { t } from '@/plugins/i18n'
import type { RouteRecordRaw } from 'vue-router'

// Child: database page
export const gastos_eventos_route: RouteRecordRaw = {
  path: 'database',
  name: 'PBI_GASTOS_EVENTOS::DATABASE',
  component: () => import('@/features/gasto_evento/pages/GastoEventoPage.vue'),
  meta: {
    // Short label for folder children
    childLabel: () => 'Base de Datos', // e.g., "Base de datos"
    // Optional: title can stay or be omitted; childLabel takes precedence in the tree
    title: () => 'Base de Datos',
    category: 'PBI',
  },
}

// Index child: the folder will open this route
export const gastos_eventos_inferido_route: RouteRecordRaw = {
  path: '',
  name: 'PBI_GASTOS_EVENTOS::INDEX',
  component: () => import('@/features/gasto_evento/pages/GastoEventoInferidoPage.vue'),
  meta: {
    // If you ever decide to show index inside children, this would be its label
    childLabel: () => 'Inferidos', // e.g., "Inicio"
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
      // Folder title shown in the tree
      title: () => t('titles.pbi.gastos_eventos'),
      category: 'PBI',
    },
    redirect: { name: 'PBI_GASTOS_EVENTOS::INDEX' },
    // Keep the index child ('') so the parent becomes a "folder proxy"
    children: [gastos_eventos_inferido_route, gastos_eventos_route],
  },
]

export default routes
