<script setup lang="ts">
import { RouterView } from 'vue-router'
import { Separator } from '@/shared/components/ui/separator'
import AccountSidebarNav from '../components/AccountSidebarNav.vue'
</script>

<template>
  <div class="space-y-6 p-10 pb-16">
    <div class="space-y-0.5">
      <h2 class="text-2xl font-bold tracking-tight">{{ $t('account.title') }}</h2>
      <p class="text-muted-foreground">{{ $t('account.description') }}</p>
    </div>
    <Separator class="my-6" />
    <div class="flex flex-col space-y-8 lg:flex-row lg:space-x-12 lg:space-y-0">
      <aside class="-ml-4 lg:w-1/5">
        <AccountSidebarNav />
      </aside>
      <div class="flex-1 w-full lg:max-w-3xl">
        <div class="space-y-6">
          <RouterView />
        </div>
      </div>
    </div>
  </div>
</template>
