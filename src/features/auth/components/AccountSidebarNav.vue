<script setup lang="ts">
import { useRoute, RouterLink } from 'vue-router'
import { cn } from '@/shared/utils/cn'
import { Button } from '@/shared/components/ui/button'
import { t } from '@/plugins/i18n'

interface Item {
  title: () => string
  to: { name: string; params?: Record<string, string> }
}

const $route = useRoute()

const sidebarNavItems: Item[] = [
  {
    title: () => t('account.profile.title'),
    to: { name: 'auth.account.profile' },
  },
  {
    title: () => t('account.companies.title'),
    to: { name: 'auth.account.companies' },
  },
  {
    title: () => t('account.solutions.title'),
    to: { name: 'auth.account.solutions' },
  },
]
</script>

<template>
  <nav class="flex flex-col gap-1 lg:space-x-0 lg:space-y-1 sticky top-18">
    <Button
      v-for="item in sidebarNavItems"
      :key="item.title()"
      :as="RouterLink"
      :to="item.to"
      variant="ghost"
      :class="
        cn(
          'w-full text-left justify-start',
          $route.name === item.to.name && 'bg-muted hover:bg-muted',
        )
      "
    >
      {{ item.title() }}
    </Button>
  </nav>
</template>
