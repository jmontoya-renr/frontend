<script setup lang="ts">
import { RouterLink, useRoute, type RouteLocationRaw } from 'vue-router'
import { computed } from 'vue'

const route = useRoute()

const redirectTo = computed<RouteLocationRaw>(() => {
  const q = route.query.redirect
  const v = Array.isArray(q) ? q[0] : q

  if (typeof v === 'string' && v.startsWith('/')) return v

  return { name: 'app.home' }
})
</script>

<template>
  <section class="flex flex-1 flex-col justify-center gap-4 p-4 pt-0">
    <div class="w-full space-y-6 text-center">
      <div class="space-y-3">
        <h1 class="text-4xl font-bold tracking-tighter sm:text-5xl">401</h1>
        <p class="text-gray-500">{{ $t('app.unauthorized') }}</p>
      </div>
      <RouterLink
        class="inline-flex h-10 items-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        :to="redirectTo"
      >
        {{ $t('app.return') }}
      </RouterLink>
    </div>
  </section>
</template>
