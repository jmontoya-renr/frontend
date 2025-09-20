<script setup lang="ts">
import { computed } from 'vue'
import { Toaster } from 'vue-sonner'
import { useRoute } from 'vue-router'
import { useTitle } from '@vueuse/core'
import { ConfigProvider } from 'reka-ui'

import { useAuthStore } from '@/features/auth/stores'
import { useUiStore } from '@/shared/stores/useUiStore'

import MainLayout from '@/app/layouts/MainLayout.vue'
import AuthLayout from '@/app/layouts/AuthLayout.vue'

const auth = useAuthStore()
const route = useRoute()

const ui = useUiStore()
ui.initLang()

const DEFAULT_TITLE = 'Portal SED - Prensa Ibérica'

// coge el title de la última ruta matcheada (más específica)
const pageTitle = computed(() => {
  const m = route.matched
  const last = m.length ? m[m.length - 1] : null

  const title = last?.meta?.title

  return typeof title === 'function' ? title() : (title ?? DEFAULT_TITLE)
})

// Document.title con VueUse (plantilla opcional)
useTitle(
  computed(() => pageTitle.value),
  {
    titleTemplate: (t) => `${t} ${t.length ? '-' : ''} ${DEFAULT_TITLE}`,
  },
)
</script>

<template>
  <ConfigProvider dir="ltr" :scroll-body="false" :locale="ui.lang">
    <component :is="auth.isAuthenticated ? MainLayout : AuthLayout">
      <RouterView />
    </component>
    <Toaster class="pointer-events-auto" rich-colors close-button />
  </ConfigProvider>
</template>
