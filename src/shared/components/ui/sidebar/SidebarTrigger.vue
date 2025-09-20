<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-vue-next'
import { cn } from '@/shared/utils/cn'
import { Button } from '@/shared/components/ui/button'
import { useSidebar } from './utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const { state, toggleSidebar, isMobile } = useSidebar()
</script>

<template>
  <Button
    data-sidebar="trigger"
    data-slot="sidebar-trigger"
    variant="ghost"
    size="icon"
    :class="cn('h-7 w-7', props.class)"
    @click="toggleSidebar"
  >
    <component :is="state === 'collapsed' || isMobile ? PanelLeftOpen : PanelLeftClose" />
    <span class="sr-only">Toggle Sidebar</span>
  </Button>
</template>
