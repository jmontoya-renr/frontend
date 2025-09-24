<script setup lang="ts" generic="T extends WithId">
import { useEventListener, useElementSize } from '@vueuse/core'
import { FlexRender } from '@tanstack/vue-table'
import type { WithId } from '@/shared/types/with-id'
import { valueUpdater } from '@/shared/utils/valueUpdater'
import type { ColumnDef, TableMeta } from '@tanstack/vue-table'
import { ref, watch, nextTick, computed, onMounted, onBeforeUnmount, useTemplateRef } from 'vue'

import {
  useTableCore,
  useRowEditing,
  useServerSync,
  usePrefs,
  useVirtualRows,
  useFocus,
  useKeyboardNav,
} from '@/features/datatable/composables'

import type { RowCommitReason } from '@/features/datatable/types/row'
import { Skeleton } from '@/shared/components/ui/skeleton'
import DataTableEmpty from '@/features/datatable/components/DataTableEmpty.vue'
import DataTableHeader from '@/features/datatable/components/DataTableHeader.vue'
import DataTableToolbar from '@/features/datatable/components/DataTableToolbar.vue'
import DataTableViewOptions from '@/features/datatable/components/DataTableViewOptions.vue'
import DataTableSkeletonBody from '@/features/datatable/components/DataTableSkeletonBody.vue'
import DataTableAppend from './DataTableAppend.vue'

interface DataTableProps<T> {
  columns: Array<ColumnDef<T>>
  records: Array<T>
  persistKey?: string
  status?: 'pending' | 'success' | 'error'
  error?: unknown
  isFetching?: boolean
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  disableNewRows?: boolean
  initialServerFilters?: Record<string, Array<string>>
  loadMore?: () => void | Promise<void>
  isRowEditable?: (row: T) => boolean
}

interface DataTableEmits<T> {
  (e: 'edit-start', payload: { rowIndex: number; colIndex: number }): void
  (e: 'edit-end', payload: { rowIndex: number; colIndex: number; commit: boolean }): void
  (
    e: 'row-commit',
    payload: {
      rowIndex: number
      rowId: string | number
      patch: Partial<T>
      full: T
      reason: RowCommitReason
      onSuccess: () => void
      onError: (err?: unknown) => void
    },
  ): void
  (
    e: 'row-delete',
    payload: {
      rowIndex: number
      rowId: string | number
      full: T
      onSuccess: () => void
      onError: (err?: unknown) => void
    },
  ): void
  (
    e: 'rows-add',
    payload: {
      drafts: Array<Partial<T>>
      onSuccess: () => void
      onError: (err?: unknown) => void
    },
  ): void
  (e: 'server-sort', payload: { sort_by: string; sort_order: 'asc' | 'desc' } | null): void
  (e: 'server-filters', payload: Record<string, Array<string>>): void
}

const props = defineProps<DataTableProps<T>>()
const emit = defineEmits<DataTableEmits<T>>()
defineExpose({
  showViewOptionsDialog() {
    if (viewOptions.value) viewOptions.value.openDialog()
  },
  focusCell: (r: number, c: number) => focusCellByIndex(r, c, { select: true }),
  startEditAt: (r: number, c: number) => {
    focusCellByIndex(r, c, { select: true })
    queueMicrotask(() => onCellDblClick(r, c))
  },
  scrollToRow: (r: number) => scrollToIndex(r, { align: 'center' }),
  resetColumnSizes: () => table.resetColumnSizing?.(true),
  resetColumnOrder: () => table.resetColumnOrder?.(),
})

const PREFS_VERSION = 1
const PREFETCH_GAP = 10
const SKELETON_ROWS = 10

const containerRef = ref<HTMLElement | null>(null)
const viewOptions = useTemplateRef('view-options')
const tableWidthPx = computed(() => `${table.getTotalSize()}px`)

const isInitialPending = computed(() => props.status === 'pending')
const isLoadingAnything = computed(
  () => isInitialPending.value || !!props.isFetching || !!props.isFetchingNextPage,
)

const {
  activeRowIndex,
  activeColIndex,
  isEditing,
  rowIndexOf,
  getCellValue,
  setRowField,
  isRowPendingAt,
  isRowErrorAt,
  isCellDirtyById,
  isCellErrorById,
  isRowEditableAt,
  commitRow,
  commitRowPromise,
  deleteRow,
  deleteRowPromise,
  discardRow,
} = useRowEditing({
  rows: () => rows.value,
  colCount: () => colCount.value,
  isRowEditableBase: props.isRowEditable,
  emit,
})

const tableMeta = (): TableMeta<T> => ({
  setRowField: setRowField,
  getCellValue: getCellValue,
  isCellDirtyById: isCellDirtyById,
  isRowEditable: props.isRowEditable,
  isCellEditing: (rowIndex, colIndex) =>
    isEditing.value && activeRowIndex.value === rowIndex && activeColIndex.value === colIndex,
  commitRowAt: (rowIndex, reason = 'row-change') => commitRow(rowIndex, reason),
  commitRowAtAsync: (rowIndex, reason = 'row-change') => commitRowPromise(rowIndex, reason),
  commitOriginalAsync: (original, reason = 'row-change') => {
    const idx = rowIndexOf(original)
    return idx < 0 ? Promise.resolve() : commitRowPromise(idx, reason)
  },
  deleteRowAt: (rowIndex) => deleteRow(rowIndex),
  deleteRowAtAsync: (rowIndex) => deleteRowPromise(rowIndex),
  deleteOriginalAsync: (original) => {
    const i = rowIndexOf(original)
    return i >= 0 ? deleteRowPromise(i) : Promise.resolve()
  },
})

const {
  table,
  rows,
  visibleLeafColumns,
  colCount,
  rowCount,
  sorting,
  columnFilters,
  columnVisibility,
  rowSelection,
  columnOrder,
  columnSizing,
} = useTableCore({
  data: () => props.records,
  columns: () => props.columns as Array<ColumnDef<T>>,
  meta: tableMeta,
  handlers: {
    onSortingChange: (u) => valueUpdater(u, sorting),
    onColumnFiltersChange: (u) => valueUpdater(u, columnFilters),
    onColumnVisibilityChange: (u) => valueUpdater(u, columnVisibility),
    onRowSelectionChange: (u) => valueUpdater(u, rowSelection),
    onColumnOrderChange: (u) => valueUpdater(u, columnOrder),
    onColumnSizingChange: (u) => valueUpdater(u, columnSizing),
  },
})

const { initialColumnFiltersDefault, liveMessage } = useServerSync<T>({
  columns: () => props.columns as Array<ColumnDef<T>>,
  rowsLen: () => rows.value.length,
  sorting: sorting,
  columnFilters: columnFilters,
  initialServerFilters: () => props.initialServerFilters,
  status: () => props.status,
  isFetching: () => props.isFetching,
  isFetchingNextPage: () => props.isFetchingNextPage,
  emit,
})

usePrefs<T>({
  table,
  persistKey: () => props.persistKey,
  columnVisibility: columnVisibility,
  columnOrder: columnOrder,
  columnSizing: columnSizing,
  version: PREFS_VERSION,
})

const { virtualRows, totalSize, isLoaderIndex, scrollToIndex } = useVirtualRows({
  containerRef,
  rowCount: () => rowCount.value,
  hasNextPage: () => !!props.hasNextPage,
  isLoadingAnything: () => isLoadingAnything.value,
  loadMore: props.loadMore,
  prefetchGap: PREFETCH_GAP,
  skeletonRows: SKELETON_ROWS,
})

const {
  setRowRef,
  setCellRef,
  focusCellByIndex,
  clearCellFocus,
  focusFirstEditableInCell,
  ensureCursorOnEditableRow,
} = useFocus<T>({
  rows: () => rows.value,
  colCount: () => colCount.value,
  rowSelection: rowSelection,
  activeRowIndex: activeRowIndex,
  activeColIndex: activeColIndex,
  scrollToIndex,
})

const isColumnEditableAt = (j: number): boolean => {
  const col = visibleLeafColumns.value[j]
  return !!col && col.columnDef?.meta?.editable !== false
}

const isCellEditable = (i: number, j: number): boolean =>
  isRowEditableAt(i) && isColumnEditableAt(j)

const { onKeydown, onKeydownCapture, onCellClick, onCellDblClick, endEdit } = useKeyboardNav({
  rowsLen: () => rows.value.length,
  colCount: () => colCount.value,
  isCellEditable,
  focusCellByIndex: focusCellByIndex,
  focusFirstEditableInCell: focusFirstEditableInCell,
  clearCellFocus: clearCellFocus,
  activeRowIndex: activeRowIndex,
  activeColIndex: activeColIndex,
  isEditing: isEditing,
  commitRow: commitRow,
  discardRow: discardRow,
})

watch(
  () => rows.value.length,
  (len) => {
    if (!len) return
    if (activeRowIndex.value >= 0 && activeRowIndex.value > len - 1) activeRowIndex.value = len - 1
    if (!isEditing.value && activeRowIndex.value >= 0 && activeColIndex.value >= 0) {
      nextTick(() =>
        focusCellByIndex(activeRowIndex.value, activeColIndex.value, { select: false }),
      )
    }
  },
)

watch(colCount, (cols) => {
  if (!cols) return
  if (activeColIndex.value >= 0 && activeColIndex.value > cols - 1) activeColIndex.value = cols - 1
  if (!isEditing.value && activeRowIndex.value >= 0 && activeColIndex.value >= 0) {
    nextTick(() => focusCellByIndex(activeRowIndex.value, activeColIndex.value, { select: false }))
  }
})

function onContainerFocus(_e: FocusEvent) {}

let rafId: number | null = null
let stopPointer: (() => void) | undefined

const ensureCursor = () => {
  // If current row is no longer editable, exit editing first
  if (isEditing.value && !isRowEditableAt(activeRowIndex.value)) {
    isEditing.value = false
  }

  // Coalesce multiple calls in the same frame
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  // Defer to next paint to avoid layout thrashing
  rafId = requestAnimationFrame(() => {
    ensureCursorOnEditableRow(isRowEditableAt)
    rafId = null
  })
}

watch([() => rows.value.length, () => colCount.value, columnVisibility, columnOrder], () =>
  nextTick(ensureCursor),
)

onMounted(() => {
  ensureCursor()

  const onPointerDown = (e: PointerEvent) => {
    const t = e.target as HTMLElement
    if (
      t.closest('[data-keep-edit-open],[role="listbox"],[role="dialog"],[aria-haspopup="listbox"]')
    )
      return

    const container = containerRef.value
    if (!container) return
    if (container.contains(t)) return

    if (isEditing.value) {
      endEdit(true, undefined)
      return
    }
    clearCellFocus()
  }

  if (typeof window !== 'undefined') {
    stopPointer = useEventListener(document, 'pointerdown', onPointerDown, { capture: true })
  }
})

onBeforeUnmount(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }

  stopPointer?.()

  if (isEditing.value && activeRowIndex.value >= 0) {
    commitRow(activeRowIndex.value, 'unmount')
  }
})

const appendHostRef = ref<HTMLElement | null>(null)
const { height: appendHeight } = useElementSize(appendHostRef)

const containerDynamicStyle = computed(() => {
  // si está deshabilitado, no restamos nada
  const h = props.disableNewRows ? 0 : Math.max(0, Math.round(appendHeight.value))
  return { maxHeight: `calc(100% - ${h}px)` }
})
</script>

<template>
  <DataTableViewOptions ref="view-options" :table="table" />
  <DataTableToolbar :table="table" :initial-column-filters="initialColumnFiltersDefault" />

  <p class="sr-only" aria-live="polite">{{ liveMessage }}</p>

  <section class="flex-1 min-h-0 h-full min-w-0 w-full">
    <div
      ref="containerRef"
      data-slot="table-container"
      class="relative rounded-md border min-h-0 h-max max-h-full overflow-auto scrollbar-thin min-w-0 w-max max-w-full"
      tabindex="0"
      @keydown="onKeydown"
      @keydown.capture="onKeydownCapture"
      @focus="onContainerFocus"
      role="grid"
      aria-label="Tabla de datos"
      :aria-colcount="colCount"
      :aria-rowcount="rows.length || 0"
      :aria-busy="status === 'pending' || isFetchingNextPage ? 'true' : 'false'"
      :style="containerDynamicStyle"
    >
      <table
        data-slot="table"
        :style="{ width: tableWidthPx }"
        class="caption-bottom text-sm relative table-fixed pr-4"
        role="presentation"
      >
        <DataTableHeader :table="table" :table-width-px="tableWidthPx" />
        <DataTableSkeletonBody
          v-if="status === 'pending' && !isFetchingNextPage"
          :table="table"
          :rows="SKELETON_ROWS"
          :row-height="40"
        />

        <DataTableEmpty
          v-else-if="!isFetching && rows.length <= 0"
          :col-span="props.columns.length"
        >
          <slot name="empty">No results.</slot>
        </DataTableEmpty>

        <tbody
          v-else
          data-slot="table-body"
          class="[&_tr:last-child]:border-0 relative"
          :style="{ height: `${totalSize}px` }"
        >
          <tr
            v-for="vr in virtualRows"
            :key="vr.key as number"
            :data-state="!isLoaderIndex(vr.index) && rows[vr.index].getIsSelected() && 'selected'"
            data-slot="table-row"
            class="absolute left-0 top-0 hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors"
            role="row"
            :aria-selected="
              !isLoaderIndex(vr.index) && rows[vr.index].getIsSelected() ? 'true' : 'false'
            "
            :aria-readonly="
              !isLoaderIndex(vr.index) && !isRowEditableAt(vr.index) ? 'true' : 'false'
            "
            :data-readonly="
              !isLoaderIndex(vr.index) && !isRowEditableAt(vr.index) ? 'true' : undefined
            "
            :aria-rowindex="vr.index + 1"
            :data-pending="
              !isLoaderIndex(vr.index) && isRowPendingAt(vr.index) ? 'true' : undefined
            "
            :data-row-error="
              !isLoaderIndex(vr.index) && isRowErrorAt(vr.index) ? 'true' : undefined
            "
            :ref="
              (el) =>
                setRowRef(
                  !isLoaderIndex(vr.index) && rows[vr.index]
                    ? rows[vr.index]!.id
                    : `__loader__-${vr.index}`,
                  el as HTMLTableRowElement | null,
                )
            "
            :style="{
              width: tableWidthPx,
              height: `${vr.size}px`,
              transform: `translateY(${vr.start}px)`,
            }"
          >
            <template v-if="isLoaderIndex(vr.index)">
              <td
                v-for="cell in visibleLeafColumns"
                :key="`${vr.index}-${cell.id}`"
                :style="{ width: `${cell.getSize()}px`, height: `${vr.size}px` }"
                role="gridcell"
                class="p-2 align-middle"
              >
                <Skeleton class="h-3 rounded-md" :style="{ width: '85%' }" />
              </td>
            </template>
            <template v-else>
              <td
                v-for="(cell, j) in rows[vr.index].getVisibleCells()"
                :key="cell.id"
                :id="`${rows[vr.index].id}-${cell.id}`"
                role="gridcell"
                data-slot="table-cell"
                :aria-readonly="!isCellEditable(vr.index, j) ? 'true' : 'false'"
                :data-readonly="!isCellEditable(vr.index, j) ? 'true' : undefined"
                :data-focused="
                  vr.index === activeRowIndex && j === activeColIndex ? 'true' : undefined
                "
                :data-editing="
                  isEditing && vr.index === activeRowIndex && j === activeColIndex
                    ? 'true'
                    : undefined
                "
                :data-dirty="
                  isCellDirtyById(vr.index, cell.column.id as keyof T) ? 'true' : undefined
                "
                :data-error="
                  isCellErrorById(vr.index, cell.column.id as keyof T) ? 'true' : undefined
                "
                :tabindex="vr.index === activeRowIndex && j === activeColIndex ? 0 : -1"
                :aria-colindex="j + 1"
                :aria-selected="rows[vr.index].getIsSelected() ? 'true' : 'false'"
                :ref="(el) => setCellRef(cell.id, el as HTMLTableCellElement | null)"
                class="align-middle"
                :style="{ width: `${cell.column.getSize()}px` }"
                @click="(ev) => onCellClick(vr.index, j, ev)"
                @dblclick="() => onCellDblClick(vr.index, j)"
              >
                <div
                  class="overflow-hidden flex items-center w-full h-full box-border p-2"
                  :style="{ width: `${cell.column.getSize()}px`, height: `${vr.size}px` }"
                >
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </div>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
    <div
      ref="appendHostRef"
      v-if="!props.disableNewRows && !(status === 'pending' && !isFetchingNextPage)"
    >
      <DataTableAppend :columns="props.columns" @rows-add="(p) => emit('rows-add', p)" />
    </div>
  </section>
</template>

<style lang="css" scoped>
td[data-slot='table-cell'] {
  position: relative;
}

[data-slot='table-container'] {
  --movement-ring: var(--ring);
  --edit-ring: #10b98166;
  --edit-bg: color-mix(in srgb, #10b981 12%, transparent);
  --dirty-ring: #f59e0b66;
  --dirty-bg: color-mix(in srgb, #f59e0b 10%, transparent);
  --error-ring: #ef444466;
  --error-bg: color-mix(in srgb, #ef4444 12%, transparent);
  --readonly-ring: #6b728066;
  --readonly-bg: color-mix(in srgb, #6b7280 10%, transparent);
  --readonly-text: color-mix(in srgb, currentColor 70%, #6b7280);
  --pending-row-bg: color-mix(in srgb, #f59e0b 8%, transparent);
  --row-error-bg: color-mix(in srgb, #ef4444 10%, transparent);
  --pending-lock: #f59e0b;
  --error-lock: #ef4444;
}
.dark [data-slot='table-container'] {
  --edit-ring: #10b98188;
  --edit-bg: color-mix(in srgb, #10b981 18%, transparent);
  --dirty-ring: #f59e0b88;
  --dirty-bg: color-mix(in srgb, #f59e0b 35%, transparent);
  --error-ring: #ef444488;
  --error-bg: color-mix(in srgb, #ef4444 20%, transparent);
  --readonly-ring: #d1d5db99;
  --readonly-bg: color-mix(in srgb, #9ca3af 25%, transparent);
  --readonly-text: color-mix(in srgb, currentColor 65%, #9ca3af);
  --pending-row-bg: color-mix(in srgb, #f59e0b 22%, transparent);
  --row-error-bg: color-mix(in srgb, #ef4444 16%, transparent);
  --pending-lock: #f59e0b;
  --error-lock: #ef4444;
}

.dark
  td[data-readonly='true']:not([data-editing='true']):not([data-error='true']):not(
    [data-dirty='true']
  )::after {
  opacity: 1;
}

td[data-focused='true'] {
  outline: 2px solid var(--movement-ring);
  outline-offset: -2px;
}

tr[data-readonly='true'] td:not([data-editing='true']):not([data-error='true']),
td[data-readonly='true']:not([data-editing='true']):not([data-error='true']):not(
    [data-dirty='true']
  ) {
  background: var(--readonly-bg);
  color: var(--readonly-text);
}

td[data-readonly='true']:not([data-editing='true']):not([data-error='true']):not(
    [data-dirty='true']
  )::after {
  content: '';
  position: absolute;
  top: 4px;
  right: 6px;
  width: 12px;
  height: 12px;
  background-color: var(--readonly-ring);
  pointer-events: none;
  opacity: 0.9;
  z-index: 1;
  -webkit-mask-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3E%3Cpath fill=%27%23000%27 d=%27M4 7h8v7H4z%27/%3E%3Cpath fill=%27%23000%27 d=%27M5 7V5a3 3 0 1 1 6 0v2h-1V5a2 2 0 1 0-4 0v2z%27/%3E%3C/svg%3E');
  mask-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3E%3Cpath fill=%27%23000%27 d=%27M4 7h8v7H4z%27/%3E%3Cpath fill=%27%23000%27 d=%27M5 7V5a3 3 0 1 1 6 0v2h-1V5a2 2 0 1 0-4 0v2z%27/%3E%3C/svg%3E');
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}

td[data-editing='true'] {
  outline: 2px solid var(--edit-ring);
  outline-offset: -2px;
  background: var(--edit-bg);
}

tr:not([data-pending='true']):not([data-row-error='true'])
  td[data-dirty='true']:not([data-editing='true']):not([data-error='true']) {
  background: var(--dirty-bg);
}
tr:not([data-pending='true']):not([data-row-error='true'])
  td[data-dirty='true']:not([data-editing='true']):not([data-error='true'])::before {
  content: '';
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: 3px;
  background: var(--dirty-ring);
  border-radius: 2px;
  pointer-events: none;
}

tr:not([data-pending='true']):not([data-row-error='true'])
  td[data-dirty='true']:not([data-editing='true']):not([data-error='true'])::after {
  content: '';
  position: absolute;
  top: 4px;
  right: 6px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dirty-ring);
  pointer-events: none;
  z-index: 1;
}

td[data-error='true']:not([data-editing='true']) {
  background: var(--error-bg);
}
td[data-error='true']:not([data-editing='true'])::before {
  content: '';
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: 3px;
  background: var(--error-ring);
  border-radius: 2px;
  pointer-events: none;
}
td[data-editing='true'][data-error='true'] {
  outline: 2px solid var(--error-ring);
  background: var(--error-bg);
}
td[data-error='true']::after {
  content: '!';
  position: absolute;
  top: 4px;
  right: 6px;
  font-weight: 700;
  font-size: 10px;
  line-height: 1;
  color: #fff;
  background: var(--error-ring);
  padding: 1px 3px;
  border-radius: 3px;
  box-shadow: 0 0 0 1px color-mix(in srgb, #000 12%, transparent);
  pointer-events: none;
  z-index: 2;
}

tr[data-pending='true'] td {
  background: var(--pending-row-bg) !important;
  color: inherit;
}

tr[data-pending='true'] td[data-dirty='true']::before {
  content: '';
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  width: 3px;
  background: var(--dirty-ring);
  border-radius: 2px;
  pointer-events: none;
}

tr[data-pending='true'] td:not([data-editing='true']):not([data-error='true'])::after {
  content: '';
  position: absolute;
  top: 4px;
  right: 6px;
  width: 12px;
  height: 12px;
  background-color: var(--pending-lock) !important;
  pointer-events: none;
  opacity: 0.95;
  z-index: 1;
  -webkit-mask-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3E%3Cpath fill=%27%23000%27 d=%27M4 7h8v7H4z%27/%3E%3Cpath fill=%27%23000%27 d=%27M5 7V5a3 3 0 1 1 6 0v2h-1V5a2 2 0 1 0-4 0v2z%27/%3E%3C/svg%3E');
  mask-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3E%3Cpath fill=%27%23000%27 d=%27M4 7h8v7H4z%27/%3E%3Cpath fill=%27%23000%27 d=%27M5 7V5a3 3 0 1 1 6 0v2h-1V5a2 2 0 1 0-4 0v2z%27/%3E%3C/svg%3E');
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}

tr[data-row-error='true'] td {
  background: var(--row-error-bg) !important;
  color: inherit;
}

tr[data-row-error='true'] td[data-readonly='true']::after {
  content: '';
  position: absolute;
  top: 4px;
  right: 6px;
  width: 12px;
  height: 12px;
  background-color: var(--error-lock) !important;
  pointer-events: none;
  opacity: 0.95;
  z-index: 1;
  -webkit-mask-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3E%3Cpath fill=%27%23000%27 d=%27M4 7h8v7H4z%27/%3E%3Cpath fill=%27%23000%27 d=%27M5 7V5a3 3 0 1 1 6 0v2h-1V5a2 2 0 1 0-4 0v2z%27/%3E%3C/svg%3E');
  mask-image: url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3E%3Cpath fill=%27%23000%27 d=%27M4 7h8v7H4z%27/%3E%3Cpath fill=%27%23000%27 d=%27M5 7V5a3 3 0 1 1 6 0v2h-1V5a2 2 0 1 0-4 0v2z%27/%3E%3C/svg%3E');
  -webkit-mask-size: contain;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
}
</style>
