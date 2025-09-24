<script setup lang="ts" generic="T extends WithId">
import { computed } from 'vue'
import type { WithId } from '@/shared/types/with-id'
import { type Table, FlexRender } from '@tanstack/vue-table'

interface Props<T> {
  table: Table<T>
  tableWidthPx: string
}

const props = defineProps<Props<T>>()

const visibleLeafColumns = computed(() => props.table.getVisibleLeafColumns())
</script>

<template>
  <colgroup>
    <col v-for="col in visibleLeafColumns" :key="col.id" :style="{ width: `${col.getSize()}px` }" />
  </colgroup>
  <thead data-slot="table-header" class="sticky top-0 bg-background z-50">
    <tr
      v-for="headerGroup in table.getHeaderGroups()"
      :key="headerGroup.id"
      :style="{ width: tableWidthPx }"
      data-slot="table-row"
      class="hover:bg-muted/50 transition-colors after:content-[''] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-px after:bg-border after:pointer-events-none"
      role="row"
    >
      <th
        v-for="header in headerGroup.headers"
        scope="col"
        :key="header.id"
        :colSpan="header.colSpan"
        :style="{ width: `${header.getSize()}px` }"
        data-slot="table-head"
        class="relative text-muted-foreground h-10 px-2 text-left align-middle font-medium"
        :aria-sort="
          header.column.getIsSorted() === 'asc'
            ? 'ascending'
            : header.column.getIsSorted() === 'desc'
              ? 'descending'
              : 'none'
        "
        role="columnheader"
      >
        <FlexRender
          v-if="!header.isPlaceholder"
          :render="header.column.columnDef.header"
          :props="header.getContext()"
          class="ml-2"
        />
        <div
          v-if="header.column.getCanResize()"
          @dblclick="() => header.column.resetSize()"
          @mousedown="(event) => header.getResizeHandler()(event)"
          @touchstart="(event) => header.getResizeHandler()(event)"
          class="resizer"
          :class="[
            table.options.columnResizeDirection,
            { isResizing: header.column.getIsResizing() },
          ]"
        />
      </th>
    </tr>
  </thead>
</template>

<style lang="css" scoped>
.resizer {
  position: absolute;
  top: 0.5rem;
  bottom: 0.5rem;
  width: 3px;
  padding-inline: 2px;
  background: var(--border);
  cursor: col-resize;
  user-select: none;
  z-index: 20;
  touch-action: none;
}
.resizer.ltr {
  right: 0;
}
.resizer.rtl {
  left: 0;
}
.resizer.isResizing {
  background: var(--color-primary, blue);
  opacity: 1;
}

@media (hover: hover) {
  .resizer {
    opacity: 0;
  }
  *:hover > .resizer {
    opacity: 1;
  }
}
</style>
