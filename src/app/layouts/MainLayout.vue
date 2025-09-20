<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useAuthStore } from '@/features/auth/stores'

import { Separator } from '@/shared/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/shared/components/ui/sidebar'

import AppSidebar from '@/shared/components/AppSidebar.vue'
import NavActions from '@/shared/components/NavActions.vue'
import NavBreadcrumb from '@/shared/components/NavBreadcrumb.vue'

const authStore = useAuthStore()
const route = useRoute()

// Computed para verificar si la página está en el array de soluciones
const getSolutionId = computed(() => {
  const solutionCode = route.name // O usa route.path dependiendo de tu ruta
  return authStore.soluciones.find((sol) => sol.codigo === solutionCode)?.id
})
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <SidebarInset class="bg-background relative min-w-0 w-full h-dvh flex flex-col min-h-0">
      <header
        class="border-grid flex sticky z-50 top-0 bg-background/95 backdrop-blur h-16 shrink-0 supports-[backdrop-filter]:bg-background/60 items-center gap-2 px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12"
      >
        <div class="flex flex-1 items-center gap-2 px-4">
          <SidebarTrigger class="-ml-1" />
          <Separator
            orientation="vertical"
            class="bg-muted-foreground/25 data-[orientation=vertical]:h-3 data-[orientation=vertical]:w-px"
          />
          <NavBreadcrumb />
        </div>
        <div class="ml-auto px-3" v-if="getSolutionId">
          <NavActions :key="getSolutionId" :solution_id="getSolutionId" />
        </div>
      </header>
      <slot />
    </SidebarInset>
  </SidebarProvider>
</template>

<style lang="css">
.border-grid {
  border-style: dashed;
  border-color: hsl(var(--border) / 0.3);
}
</style>
