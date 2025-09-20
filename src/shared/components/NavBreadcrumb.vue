<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import useBreadcrumbs from '@/shared/composables/useBreadcrumbs'

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/shared/components/ui/breadcrumb'

const { breadcrumbs } = useBreadcrumbs()

const lastCrumb = computed(() => {
  const arr = breadcrumbs.value
  return arr.length ? arr[arr.length - 1] : null
})
</script>

<template>
  <Breadcrumb>
    <!-- Desktop/Tablet (md+) -> todo el trail -->
    <BreadcrumbList class="hidden md:flex">
      <template v-for="(bc, i) in breadcrumbs" :key="i">
        <BreadcrumbItem v-if="bc.name !== '...'">
          <BreadcrumbLink
            as-child
            v-if="i < breadcrumbs.length - 1"
            class="inline-flex px-2 py-1 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50"
          >
            <RouterLink :to="{ name: bc.pathName }">
              {{ bc.name }}
            </RouterLink>
          </BreadcrumbLink>
          <BreadcrumbPage v-else class="ml-2">{{ bc.name }}</BreadcrumbPage>
        </BreadcrumbItem>

        <BreadcrumbItem v-else>
          <span>{{ bc.name }}</span>
        </BreadcrumbItem>

        <BreadcrumbSeparator class="-mx-2" v-if="i < breadcrumbs.length - 1" />
      </template>
    </BreadcrumbList>

    <!-- Mobile (<md) -> solo el último -->
    <BreadcrumbList class="md:hidden">
      <BreadcrumbItem v-if="lastCrumb">
        <BreadcrumbPage class="ml-2">
          {{ lastCrumb.name }}
        </BreadcrumbPage>
      </BreadcrumbItem>
    </BreadcrumbList>
  </Breadcrumb>
</template>
