<script setup lang="ts">
import { routes } from '@/router/index'
import { RouterLink, useRouter } from 'vue-router'

import NavUser from '@/shared/components/NavUser.vue'
import NavTree from '@/shared/components/NavTree.vue'
import LogoPi from '@/shared/assets/svg/logo_prensa_iberica_negro.svg'

import { Search } from 'lucide-vue-next'
import { Label } from '@/shared/components/ui/label'
import {
  Sidebar,
  SidebarMenuButton,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarGroup,
  SidebarMenu,
  SidebarInput,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/shared/components/ui/sidebar'
import { useAuthStore } from '@/features/auth/stores'
import useTree from '@/shared/composables/useTree'
import useRouteTree from '@/shared/composables/useRouteTree'

const auth = useAuthStore()
const router = useRouter()

function logout() {
  auth.logout()

  router.push({ name: 'auth.login' })
}

const data = {
  user: {
    name: auth.user.nombre!,
    email: auth.user.email!,
    avatar: '/avatars/shadcn.jpg',
  },
}

const { tree } = useRouteTree(routes)
const { search, filteredTree, isEmpty } = useTree(tree.value)
</script>

<template>
  <Sidebar>
    <SidebarHeader>
      <SidebarGroup class="py-0">
        <SidebarGroupContent>
          <SidebarMenuButton
            as-child
            class="text-primary hover:text-primary active:text-primary focus:text-primary pr-4 h-19 mb-2 [&>svg]:size-full"
          >
            <RouterLink :to="{ name: 'app.home' }">
              <LogoPi />
            </RouterLink>
          </SidebarMenuButton>
        </SidebarGroupContent>
        <SidebarGroupContent class="relative">
          <Label for="search" class="sr-only"> {{ $t('forms.search') }} </Label>
          <SidebarInput
            v-model="search"
            id="search"
            :placeholder="`${$t('forms.search-solutions')}...`"
            class="pl-8"
          />
          <Search
            class="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 select-none opacity-50"
          />
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarHeader>
    <SidebarContent class="scrollbar-hidden">
      <SidebarGroup v-for="(items, categoria) in filteredTree" :key="categoria">
        <SidebarGroupLabel>{{ categoria }}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <NavTree
              v-for="(item, index) in items"
              :key="`${index}-${categoria}-${item.name}`"
              :node="item"
            />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup v-if="isEmpty">
        <SidebarGroupLabel> {{ $t('forms.no-results') }} </SidebarGroupLabel>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <NavUser :user="data.user" :logout="logout" />
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
