<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import {
  ArrowDown,
  Link,
  MoreHorizontal,
  Settings2,
  CloudDownload,
  RefreshCw,
} from 'lucide-vue-next'

import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/shared/components/ui/sidebar'
import { t } from '@/plugins/i18n'
import { useSolutionBus } from '@/shared/composables/useSolutionBus'

type MenuItem = {
  label: string
  icon: typeof Link
  action: () => void | Promise<void>
}

const props = defineProps<{ solution_id: number }>()
const bus = useSolutionBus(props.solution_id)
const isMoreOpen = ref(false)

const close = () => {
  isMoreOpen.value = false
}

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(location.href)
    toast.success('Copiado!')
  } finally {
    close()
  }
}

const refreshPage = () => {
  close()
  location.reload()
}

const customize = () => {
  bus.emit({ type: 'customize' })
  close()
}

const exportLocal = () => {
  bus.emit({ type: 'export:local' })
  close()
}

const exportRemote = () => {
  bus.emit({ type: 'export:remote' })
  close()
}

const data: Array<Array<MenuItem>> = [
  [
    { label: t('solutions.more-menu.copy'), icon: Link, action: copyLink },
    { label: t('solutions.more-menu.refresh'), icon: RefreshCw, action: refreshPage },
    { label: t('solutions.more-menu.customize'), icon: Settings2, action: customize },
  ],
  [
    { label: t('solutions.more-menu.export.local'), icon: ArrowDown, action: exportLocal },
    { label: t('solutions.more-menu.export.remote'), icon: CloudDownload, action: exportRemote },
  ],
]
</script>

<template>
  <Popover v-model:open="isMoreOpen">
    <PopoverTrigger as-child>
      <Button variant="ghost" size="icon" class="h-7 w-7 data-[state=open]:bg-accent">
        <MoreHorizontal />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-56 overflow-hidden rounded-lg p-0" align="end">
      <Sidebar collapsible="none" class="bg-transparent">
        <SidebarContent>
          <SidebarGroup
            v-for="(group, index) in data"
            :key="index"
            class="border-b last:border-none"
          >
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem v-for="(item, index) in group" :key="index">
                  <SidebarMenuButton @click="item.action">
                    <component :is="item.icon" />
                    <span>{{ item.label }}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </PopoverContent>
  </Popover>
</template>
