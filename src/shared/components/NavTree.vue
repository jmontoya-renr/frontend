<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

import type { TreeNode } from '@/shared/types'

import { ChevronRight, File, Folder, FolderOpen } from 'lucide-vue-next'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/shared/components/ui/collapsible'
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from '@/shared/components/ui/sidebar'

const props = defineProps<{
  node: TreeNode
}>()

const open = ref(false)

const { name, route, children: items } = props.node

function resolveName(name: string | (() => string)) {
  return typeof name === 'function' ? name() : name
}
</script>

<template>
  <SidebarMenuButton
    v-if="!items?.length"
    :is-active="name === 'button.tsx'"
    class="data-[active=true]:bg-transparent group-has-data-[sidebar=menu-action]/menu-item:pr-2"
    as-child
    :tooltip="name"
  >
    <RouterLink :as="RouterLink" :to="{ name: route }">
      <File />
      {{ resolveName(name) }}
    </RouterLink>
  </SidebarMenuButton>

  <Collapsible
    class="group/collapsible [&[data-state=open]>button>svg:first-child]:rotate-90"
    v-model:open="open"
    v-else
  >
    <SidebarMenuItem>
      <CollapsibleTrigger as-child>
        <SidebarMenuAction class="data-[state=open]:rotate-90 right-auto left-1">
          <ChevronRight class="transition-transform" />
          <span class="sr-only">Toggle</span>
        </SidebarMenuAction>
      </CollapsibleTrigger>
      <SidebarMenuButton
        as-child
        :tooltip="name"
        class="group-has-data-[sidebar=menu-action]/menu-item:pr-2 pl-8"
      >
        <RouterLink :to="{ name: route }">
          <FolderOpen v-if="open" />
          <Folder v-else />
          {{ resolveName(name) }}
        </RouterLink>
      </SidebarMenuButton>
      <CollapsibleContent>
        <SidebarMenuSub>
          <NavTree v-for="subItem in items" :key="subItem.route" :node="subItem" />
        </SidebarMenuSub>
      </CollapsibleContent>
    </SidebarMenuItem>
  </Collapsible>
</template>
