<script setup lang="ts" generic="T extends WithId">
import type { Column } from '@tanstack/vue-table'

import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from 'lucide-vue-next'

import { cn } from '@/shared/utils/cn'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import type { WithId } from '@/shared/types/with-id'

interface DataTableColumnHeaderProps {
  column: Column<T, unknown>
  title: string
}

const props = defineProps<DataTableColumnHeaderProps>()

const sortAsc = () => {
  if (props.column.getIsSorted() !== 'asc') props.column.toggleSorting(false)
}
const sortDesc = () => {
  if (props.column.getIsSorted() !== 'desc') props.column.toggleSorting(true)
}
const sortClear = () => {
  if (props.column.getIsSorted()) props.column.clearSorting()
}
</script>

<script lang="ts">
export default {
  inheritAttrs: false,
}
</script>

<template>
  <div v-if="column.getCanSort()" :class="cn('flex items-center space-x-2', $attrs.class ?? '')">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="ghost" size="sm" class="-ml-3 h-8 data-[state=open]:bg-accent">
          <span>{{ title }}</span>
          <ArrowDown v-if="column.getIsSorted() === 'desc'" class="ml-2 h-4 w-4" />
          <ArrowUp v-else-if="column.getIsSorted() === 'asc'" class="ml-2 h-4 w-4" />
          <ChevronsUpDown v-else class="ml-2 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem @click="sortAsc">
          <ArrowUp class="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
          Asc
        </DropdownMenuItem>
        <DropdownMenuItem @click="sortDesc">
          <ArrowDown class="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
          Desc
        </DropdownMenuItem>
        <DropdownMenuItem @click="sortClear">
          <ChevronsUpDown class="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
          None
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem @click="column.toggleVisibility(false)">
          <EyeOff class="mr-2 h-3.5 w-3.5 text-muted-foreground/70" />
          Hide
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>

  <div v-else :class="$attrs.class">
    {{ title }}
  </div>
</template>
