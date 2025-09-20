<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <section class="flex flex-1 flex-col justify-center gap-4 p-4 pt-0">
    <div class="w-full space-y-6 text-center">
      <div class="space-y-3">
        <h1 class="text-4xl font-bold tracking-tighter sm:text-5xl">404</h1>
        <p class="text-gray-500">{{ $t('app.notfound') }}</p>
      </div>
      <RouterLink
        class="inline-flex h-10 items-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
        :to="{ name: 'app.home' }"
      >
        {{ $t('app.return') }}
      </RouterLink>
    </div>
  </section>
</template>
