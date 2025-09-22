<script setup lang="ts" generic="T extends WithId">
import type { Column, Table, TableState, ColumnDef } from '@tanstack/vue-table' // CAMBIO: +ColumnDef
import { computed, ref, onMounted, watch } from 'vue' // CAMBIO: +onMounted, +watch

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

/* =========================
   Fixed-first helpers (NO any)
   ========================= */
// CAMBIO: meta type + guard + utilities
type FixedFirstMeta = { fixedFirst?: boolean }

function isFixedFirstColumn(col: Column<T, unknown>): boolean {
  // Read ColumnDef.meta in a typed way (no 'any')
  const meta = (col.columnDef as ColumnDef<T, unknown> & { meta?: FixedFirstMeta }).meta
  return !!meta?.fixedFirst
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i])
}

const allColumns = computed<Column<T, unknown>[]>(() => props.table.getAllLeafColumns())

const leafIds = computed(() => allColumns.value.map((c) => c.id))

// CAMBIO: ids fijos (en orden de aparición)
const fixedFirstIds = computed<string[]>(() =>
  allColumns.value.filter((c) => isFixedFirstColumn(c)).map((c) => c.id),
)

// CAMBIO: fuerza que los fijos vayan delante (y presentes)
function forceFixedFirst(order: string[]): string[] {
  const fixed = fixedFirstIds.value
  if (fixed.length === 0) return order

  const inOrder = new Set(order)
  const tail = order.filter((id) => !fixed.includes(id))
  const fixedPresent = fixed.filter((id) => inOrder.has(id))
  const fixedMissing = fixed.filter((id) => !inOrder.has(id))

  return [...fixedPresent, ...fixedMissing, ...tail]
}

// Orden efectivo: respetar state y completar con faltantes (incluye no-ocultables)
const orderedIds = computed<string[]>(() => {
  const state = props.table.getState() as TableState
  const order = state.columnOrder ?? []
  const sanitized = order.filter((id) => leafIds.value.includes(id))
  const missing = leafIds.value.filter((id) => !sanitized.includes(id))
  // CAMBIO: aplicamos la fuerza aquí
  return forceFixedFirst([...sanitized, ...missing])
})

const idToCol = computed(() => new Map(allColumns.value.map((c) => [c.id, c])))

const visibleColumnsOrdered = computed(() =>
  orderedIds.value
    .map((id) => idToCol.value.get(id))
    .filter((c): c is Column<T, unknown> => Boolean(c && c.getIsVisible())),
)

// CAMBIO: índice del primer elemento movible (el primero que NO es fixedFirst)
const firstMovableIndex = computed<number>(() => {
  const list = visibleColumnsOrdered.value
  for (let k = 0; k < list.length; k++) {
    if (!isFixedFirstColumn(list[k])) return k
  }
  return list.length // no hay columnas movibles
})

// Solo ocultables y ocultas
// CAMBIO: nunca listar columnas fijas aquí
const hiddenColumns = computed(() =>
  allColumns.value.filter((c) => c.getCanHide() && !isFixedFirstColumn(c) && !c.getIsVisible()),
)

// CAMBIO: setOrder siempre respeta fijos
function setOrder(newOrder: string[]) {
  props.table.setColumnOrder(forceFixedFirst(newOrder))
}

/** Reordena SOLO las visibles (incluye fijas y ocultables visibles), preserva ocultas */
// CAMBIO: bloquear mover si es fija + re-aplicar fuerza al final
// CAMBIO: nunca cruzar el bloque fijo; mover 'start' al primer índice movible
function moveVisible(id: string, where: 'up' | 'down' | 'start' | 'end') {
  if (fixedFirstIds.value.includes(id)) return // do not move fixed-first

  const order = [...orderedIds.value]
  const isVisible = (x: string) => props.table.getColumn(x)?.getIsVisible()
  const visibles = order.filter(isVisible)

  const idx = visibles.indexOf(id)
  if (idx === -1) return

  const F = firstMovableIndex.value // primera posición permitida para no-fijos

  const swap = (a: number, b: number) => {
    const t = visibles[a]
    visibles[a] = visibles[b]
    visibles[b] = t
  }

  if (where === 'up') {
    if (idx <= F) return // no puedes subir por encima del muro
    const prev = idx - 1
    if (prev < F) return
    swap(idx, prev)
  }

  if (where === 'down') {
    if (idx >= visibles.length - 1) return
    swap(idx, idx + 1)
  }

  if (where === 'start') {
    if (idx <= F) return // ya está en la primera posición movible
    const [moved] = visibles.splice(idx, 1)
    visibles.splice(F, 0, moved) // CAMBIO: insertamos justo detrás del bloque fijo
  }

  if (where === 'end') {
    if (idx >= visibles.length - 1) return
    const [moved] = visibles.splice(idx, 1)
    visibles.push(moved)
  }

  // reconstruir: sustituir visibles en su orden nuevo, ocultas quedan donde estaban
  let vi = 0
  const nextOrder = order.map((colId) => (isVisible(colId) ? visibles[vi++] : colId))
  setOrder(forceFixedFirst(nextOrder)) // mantener fijas al frente por si acaso
}

function resetOrder() {
  // vuelve al orden base de las leaf columns
  props.table.resetColumnOrder()
  props.table.resetColumnSizing()
  props.table.resetColumnVisibility()
  // CAMBIO: asegurar fijos tras reset
  ensureFixedVisible()
  ensureOrderNow()
}

/* =========================
   Guards that keep invariants
   ========================= */
// CAMBIO: asegurar que los fijos están visibles
function ensureFixedVisible(): void {
  for (const id of fixedFirstIds.value) {
    const col = props.table.getColumn(id)
    if (col && col.getIsVisible() === false) {
      col.toggleVisibility(true)
    }
  }
}

// CAMBIO: corregir el order actual si hace falta
function ensureOrderNow(): void {
  const state = props.table.getState() as TableState
  const curr =
    state.columnOrder && state.columnOrder.length > 0
      ? state.columnOrder
      : props.table.getAllLeafColumns().map((c) => c.id)
  const next = forceFixedFirst(curr)
  if (!arraysEqual(curr, next)) props.table.setColumnOrder(next)
}

// CAMBIO: activar guards en mount y cuando cambie el estado
onMounted(() => {
  ensureFixedVisible()
  ensureOrderNow()
})

watch(
  () => (props.table.getState() as TableState).columnOrder,
  (order) => {
    if (!order) return
    const next = forceFixedFirst(order)
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
        <!-- Visibles: TODAS las visibles (ocultables y NO ocultables) -->
        <section class="rounded-lg border bg-muted/30 p-3">
          <header class="mb-2 flex items-center justify-between">
            <h4 class="text-sm font-medium">Visibles</h4>
            <span class="text-xs text-muted-foreground">{{ visibleColumnsOrdered.length }}</span>
          </header>

          <ScrollArea class="h-[320px] pr-2">
            <ul class="space-y-1">
              <li v-for="(col, i) in visibleColumnsOrdered" :key="col.id">
                <div class="flex items-center gap-2 rounded-md border bg-background px-2 py-1">
                  <!-- CAMBIO: bloquear toggle si es fija (además de getCanHide) -->
                  <Checkbox
                    :disabled="
                      !col.getCanHide() ||
                      (col.columnDef.meta &&
                        (col.columnDef.meta as { fixedFirst?: boolean }).fixedFirst === true)
                    "
                    :model-value="col.getIsVisible()"
                    @update:model-value="
                      (v) =>
                        col.getCanHide() &&
                        !(col.columnDef.meta as { fixedFirst?: boolean })?.fixedFirst &&
                        col.toggleVisibility(!!v)
                    "
                  />
                  <span class="truncate capitalize text-sm">
                    {{ col.id }}
                  </span>
                  <span
                    v-if="
                      !col.getCanHide() ||
                      (col.columnDef.meta as { fixedFirst?: boolean })?.fixedFirst
                    "
                    class="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground"
                  >
                    fija
                  </span>

                  <div class="ml-auto flex items-center">
                    <!-- CAMBIO: desactivar mover si es fija -->
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7"
                      :disabled="
                        (col.columnDef.meta as { fixedFirst?: boolean })?.fixedFirst ||
                        i <= firstMovableIndex
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
                        (col.columnDef.meta as { fixedFirst?: boolean })?.fixedFirst ||
                        i <= firstMovableIndex
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
                        (col.columnDef.meta as { fixedFirst?: boolean })?.fixedFirst ||
                        i === visibleColumnsOrdered.length - 1
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
                        (col.columnDef.meta as { fixedFirst?: boolean })?.fixedFirst ||
                        i === visibleColumnsOrdered.length - 1
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

        <!-- Ocultas: solo las que se pueden ocultar -->
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
