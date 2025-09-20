import type { RouteRecordRaw } from 'vue-router'
import { t } from '@/plugins/i18n'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'auth.login',
    component: () => import('@/features/auth/pages/LoginPage.vue'),
    meta: { public: true, title: () => t('titles.auth.login') },
  },
  {
    path: '/account',
    name: 'auth.account',
    component: () => import('@/features/auth/layouts/AccountLayout.vue'),
    meta: { noPermsRequired: true, title: () => t('account.title') },
    redirect: { name: 'auth.account.profile' },
    children: [
      {
        path: '',
        name: 'auth.account.profile',
        component: () => import('@/features/auth/pages/account/ProfilePage.vue'),
        meta: { title: () => t('account.profile.title') },
      },
      {
        path: 'solutions',
        name: 'auth.account.solutions',
        component: () => import('@/features/auth/pages/account/SolutionsPage.vue'),
        meta: { title: () => t('account.solutions.title') },
      },
      {
        path: 'companies',
        name: 'auth.account.companies',
        component: () => import('@/features/auth/pages/account/CompaniesPage.vue'),
        meta: { title: () => t('account.companies.title') },
      },
    ],
  },
  {
    path: '/preferences',
    name: 'auth.preferences',
    component: () => import('@/features/auth/layouts/PreferencesLayout.vue'),
    meta: { noPermsRequired: true, title: () => t('preferences.title') },
    redirect: { name: 'auth.preferences.appearance' },
    children: [
      /*
      {
        path: '',
        name: 'auth.preferences.root',
        component: () => import('@/features/auth/pages/preferences/PreferencesPage.vue'),
        meta: { title: 'Preferences' },
      },
      */
      {
        path: 'appearance',
        name: 'auth.preferences.appearance',
        component: () => import('@/features/auth/pages/preferences/AppearancePage.vue'),
        meta: { title: () => t('preferences.appearance.title') },
      },
    ],
  },
]

export default routes
