<script setup lang="ts" generic="T extends WithId">
import type { Column, Table, TableState, ColumnDef } from '@tanstack/vue-table'
import { computed, ref, onMounted, watch } from 'vue'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Button } from '@/shared/components/ui/button'
import { ScrollArea } from '@/shared/components/ui/scroll-area'

import { ChevronUp, ChevronDown, ChevronsUp, ChevronsDown, RotateCcw } from 'lucide-vue-next'
import type { WithId } from '@/shared/types/with-id'

interface DataTableViewOptionsProps {
  table: Table<T>
}
const props = defineProps<DataTableViewOptionsProps>()

const open = ref(false)

type FixedMeta = { fixedFirst?: boolean; fixedLast?: boolean }

function isFixedFirstColumn(col: Column<T>): boolean {
  const meta = (col.columnDef as ColumnDef<T> & { meta?: FixedMeta }).meta
  return !!meta?.fixedFirst
}

function isFixedLastColumn(col: Column<T>): boolean {
  const meta = (col.columnDef as ColumnDef<T> & { meta?: FixedMeta }).meta
  return !!meta?.fixedLast
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

const leafIds = computed(() => allColumns.value.map((c) => c.id))

const allColumns = computed<Column<T>[]>(() => props.table.getAllLeafColumns())

const fixedFirstIds = computed<string[]>(() =>
  allColumns.value.filter((c) => isFixedFirstColumn(c)).map((c) => c.id),
)

const fixedLastIds = computed<string[]>(() =>
  allColumns.value.filter((c) => isFixedLastColumn(c)).map((c) => c.id),
)

function forcePinned(order: string[]): string[] {
  const first = fixedFirstIds.value
  const last = fixedLastIds.value
  if (first.length === 0 && last.length === 0) return order

  // Dedupe helper to avoid duplicates if arrays overlap
  const seen = new Set<string>()
  const dedupe = (arr: string[]) => arr.filter((id) => !seen.has(id) && (seen.add(id), true))

  const inOrder = new Set(order)
  const middle = order.filter((id) => !first.includes(id) && !last.includes(id))

  const firstPresent = first.filter((id) => inOrder.has(id))
  const firstMissing = first.filter((id) => !inOrder.has(id))

  const lastPresent = last.filter((id) => inOrder.has(id))
  const lastMissing = last.filter((id) => !inOrder.has(id))

  // Result: FIRST ... MIDDLE ... LAST
  return dedupe([...firstPresent, ...firstMissing, ...middle, ...lastPresent, ...lastMissing])
}

const orderedIds = computed<string[]>(() => {
  const state = props.table.getState() as TableState
  const order = state.columnOrder ?? []
  const sanitized = order.filter((id) => leafIds.value.includes(id))
  const missing = leafIds.value.filter((id) => !sanitized.includes(id))
  return forcePinned([...sanitized, ...missing])
})

const idToCol = computed(() => new Map(allColumns.value.map((c) => [c.id, c])))

const visibleColumnsOrdered = computed(() =>
  orderedIds.value
    .map((id) => idToCol.value.get(id))
    .filter((c): c is Column<T, unknown> => Boolean(c && c.getIsVisible())),
)

const firstMovableIndex = computed<number>(() => {
  const list = visibleColumnsOrdered.value
  for (let k = 0; k < list.length; k++) {
    if (!isFixedFirstColumn(list[k])) return k
  }
  return list.length
})

const lastMovableIndex = computed<number>(() => {
  const list = visibleColumnsOrdered.value
  for (let k = list.length - 1; k >= 0; k--) {
    if (!isFixedLastColumn(list[k])) return k
  }
  return -1
})

const hiddenColumns = computed(() =>
  allColumns.value.filter(
    (c) => c.getCanHide() && !isFixedFirstColumn(c) && !isFixedLastColumn(c) && !c.getIsVisible(),
  ),
)

function setOrder(newOrder: string[]) {
  props.table.setColumnOrder(forcePinned(newOrder))
}

function moveVisible(id: string, where: 'up' | 'down' | 'start' | 'end') {
  if (fixedFirstIds.value.includes(id) || fixedLastIds.value.includes(id)) return

  const order = [...orderedIds.value]
  const isVisible = (x: string) => props.table.getColumn(x)?.getIsVisible()
  const visibles = order.filter(isVisible)

  const idx = visibles.indexOf(id)
  if (idx === -1) return

  const F = firstMovableIndex.value
  const L = lastMovableIndex.value
  if (L < 0 || F > L) return

  const swap = (a: number, b: number) => {
    const t = visibles[a]
    visibles[a] = visibles[b]
    visibles[b] = t
  }

  if (where === 'up') {
    if (idx <= F) return
    const prev = idx - 1
    if (prev < F) return
    swap(idx, prev)
  }

  if (where === 'down') {
    if (idx >= L) return
    const next = idx + 1
    if (next > L) return
    swap(idx, next)
  }

  if (where === 'start') {
    if (idx <= F) return
    const [moved] = visibles.splice(idx, 1)
    visibles.splice(F, 0, moved)
  }

  if (where === 'end') {
    if (idx >= L) return
    const [moved] = visibles.splice(idx, 1)
    visibles.splice(L, 0, moved)
  }

  let vi = 0
  const nextOrder = order.map((colId) => (isVisible(colId) ? visibles[vi++] : colId))
  setOrder(forcePinned(nextOrder))
}

function resetOrder() {
  props.table.resetColumnOrder()
  props.table.resetColumnSizing()
  props.table.resetColumnVisibility()
  ensureFixedVisible()
  ensureOrderNow()
}

function ensureFixedVisible(): void {
  for (const id of [...fixedFirstIds.value, ...fixedLastIds.value]) {
    const col = props.table.getColumn(id)
    if (col && col.getIsVisible() === false) col.toggleVisibility(true)
  }
}

function ensureOrderNow(): void {
  const state = props.table.getState() as TableState
  const curr =
    state.columnOrder && state.columnOrder.length > 0
      ? state.columnOrder
      : props.table.getAllLeafColumns().map((c) => c.id)
  const next = forcePinned(curr)
  if (!arraysEqual(curr, next)) props.table.setColumnOrder(next)
}

onMounted(() => {
  ensureFixedVisible()
  ensureOrderNow()
})

watch(
  () => (props.table.getState() as TableState).columnOrder,
  (order) => {
    if (!order) return
    const next = forcePinned(order)
    if (!arraysEqual(order, next)) props.table.setColumnOrder(next)
  },
  { deep: true },
)

watch(
  () =>
    props.table
      .getAllLeafColumns()
      .map((c) => c.id)
      .join('|'),
  () => {
    ensureFixedVisible()
    ensureOrderNow()
  },
)

defineExpose({
  openDialog() {
    open.value = true
  },
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[720px]">
      <DialogHeader class="flex sm:flex-row items-center mt-4">
        <DialogTitle class="flex-1">Columnas</DialogTitle>
        <Button variant="outline" size="sm" class="gap-1" @click="resetOrder">
          <RotateCcw class="h-4 w-4" />
          Reset orden
        </Button>
      </DialogHeader>

      <div class="grid gap-4 md:grid-cols-2">
        <section class="rounded-lg border bg-muted/30 p-3">
          <header class="mb-2 flex items-center justify-between">
            <h4 class="text-sm font-medium">Visibles</h4>
            <span class="text-xs text-muted-foreground">{{ visibleColumnsOrdered.length }}</span>
          </header>

          <ScrollArea class="h-[320px] pr-2">
            <ul class="space-y-1">
              <li v-for="(col, i) in visibleColumnsOrdered" :key="col.id">
                <div class="flex items-center gap-2 rounded-md border bg-background px-2 py-1">
                  <Checkbox
                    :disabled="
                      !col.getCanHide() ||
                      (col.columnDef.meta &&
                        (col.columnDef.meta as { fixedFirst?: boolean; fixedLast?: boolean })
                          .fixedFirst === true) ||
                      (col.columnDef.meta &&
                        (col.columnDef.meta as { fixedFirst?: boolean; fixedLast?: boolean })
                          .fixedLast === true)
                    "
                    :model-value="col.getIsVisible()"
                    @update:model-value="(v) => col.getCanHide() && col.toggleVisibility(!!v)"
                  />
                  <span class="truncate capitalize text-sm">
                    {{ col.id }}
                  </span>
                  <span
                    v-if="
                      !col.getCanHide() ||
                      (col.columnDef.meta as { fixedFirst?: boolean; fixedLast?: boolean })
                        ?.fixedFirst ||
                      (col.columnDef.meta as { fixedFirst?: boolean; fixedLast?: boolean })
                        ?.fixedLast
                    "
                    class="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground"
                  >
                    fija
                  </span>

                  <div class="ml-auto flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7"
                      :disabled="
                        isFixedFirstColumn(col) || isFixedLastColumn(col) || i <= firstMovableIndex
                      "
                      @click="moveVisible(col.id, 'start')"
                      aria-label="Mover al inicio"
                    >
                      <ChevronsUp />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7"
                      :disabled="
                        isFixedFirstColumn(col) || isFixedLastColumn(col) || i <= firstMovableIndex
                      "
                      @click="moveVisible(col.id, 'up')"
                      aria-label="Subir"
                    >
                      <ChevronUp />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7"
                      :disabled="
                        isFixedFirstColumn(col) || isFixedLastColumn(col) || i >= lastMovableIndex
                      "
                      @click="moveVisible(col.id, 'down')"
                      aria-label="Bajar"
                    >
                      <ChevronDown />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7"
                      :disabled="
                        isFixedFirstColumn(col) || isFixedLastColumn(col) || i >= lastMovableIndex
                      "
                      @click="moveVisible(col.id, 'end')"
                      aria-label="Mover al final"
                    >
                      <ChevronsDown />
                    </Button>
                  </div>
                </div>
              </li>
            </ul>
          </ScrollArea>
        </section>

        <section class="rounded-lg border bg-muted/30 p-3">
          <header class="mb-2 flex items-center justify-between">
            <h4 class="text-sm font-medium">Ocultas</h4>
            <span class="text-xs text-muted-foreground">{{ hiddenColumns.length }}</span>
          </header>

          <ScrollArea class="h-[320px] pr-2">
            <ul class="space-y-1">
              <li v-for="col in hiddenColumns" :key="col.id">
                <label
                  class="flex items-center gap-2 rounded-md border border-dashed bg-background px-2 py-1"
                >
                  <Checkbox
                    :model-value="col.getIsVisible()"
                    @update:model-value="(v) => col.toggleVisibility(!!v)"
                  />
                  <span class="truncate capitalize text-sm text-muted-foreground">{{
                    col.id
                  }}</span>
                </label>
              </li>
            </ul>
          </ScrollArea>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
