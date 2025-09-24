<script setup lang="ts" generic="T extends WithId">
import type { Table } from '@tanstack/vue-table'
import { computed } from 'vue'
import type { WithId } from '@/shared/types/with-id'
import { Skeleton } from '@/shared/components/ui/skeleton'

interface Props<T> {
  table: Table<T>
  rows: number
  rowHeight?: number
}

const props = withDefaults(defineProps<Props<T>>(), {
  rowHeight: 40,
})

const visibleLeafColumns = computed(() => props.table.getVisibleLeafColumns())
</script>

<template>
  <tbody data-slot="table-body" role="presentation" aria-hidden="true">
    <tr v-for="i in props.rows" :key="'sk-' + i" role="row" class="border-b">
      <td
        v-for="col in visibleLeafColumns"
        :key="`${i}-${col.id}`"
        :style="{ width: `${col.getSize()}px`, height: `${props.rowHeight}px` }"
        role="gridcell"
        class="p-2 align-middle"
      >
        <Skeleton class="h-3 rounded-md" :style="{ width: ['70%', '55%', '85%'][i % 3] }" />
      </td>
    </tr>
  </tbody>
</template>
