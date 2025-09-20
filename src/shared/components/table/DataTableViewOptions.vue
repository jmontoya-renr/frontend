<script setup lang="ts" generic="T extends WithId">
import type { Column, Table, TableState } from '@tanstack/vue-table'
import { computed, ref } from 'vue'

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

// IMPORTANTe: usar TODAS las leaf columns (columnOrder aplica a leafs)
const allColumns = computed<Column<T, unknown>[]>(
  () => props.table.getAllLeafColumns() as Column<T, unknown>[],
)
const leafIds = computed(() => allColumns.value.map((c) => c.id))

// Orden efectivo: respetar state y completar con faltantes (incluye no-ocultables)
const orderedIds = computed<string[]>(() => {
  const state = props.table.getState() as TableState
  const order = state.columnOrder ?? []
  const sanitized = order.filter((id) => leafIds.value.includes(id))
  const missing = leafIds.value.filter((id) => !sanitized.includes(id))
  return [...sanitized, ...missing]
})

const idToCol = computed(() => new Map(allColumns.value.map((c) => [c.id, c])))

const visibleColumnsOrdered = computed(() =>
  orderedIds.value
    .map((id) => idToCol.value.get(id))
    .filter((c): c is Column<T, unknown> => Boolean(c && c.getIsVisible())),
)

// Solo ocultables y ocultas
const hiddenColumns = computed(() =>
  allColumns.value.filter((c) => c.getCanHide() && !c.getIsVisible()),
)

function setOrder(newOrder: string[]) {
  props.table.setColumnOrder(newOrder)
}

/** Reordena SOLO las visibles (incluye fijas y ocultables visibles), preserva ocultas */
function moveVisible(id: string, where: 'up' | 'down' | 'start' | 'end') {
  const order = [...orderedIds.value]
  const isVisible = (x: string) => props.table.getColumn(x)?.getIsVisible()
  const visibles = order.filter(isVisible)

  const idx = visibles.indexOf(id)
  if (idx === -1) return

  const swap = (a: number, b: number) => {
    const t = visibles[a]
    visibles[a] = visibles[b]
    visibles[b] = t
  }

  if (where === 'up' && idx > 0) swap(idx, idx - 1)
  if (where === 'down' && idx < visibles.length - 1) swap(idx, idx + 1)
  if (where === 'start' && idx > 0) {
    visibles.splice(0, 0, visibles.splice(idx, 1)[0])
  }
  if (where === 'end' && idx < visibles.length - 1) {
    visibles.splice(visibles.length, 0, visibles.splice(idx, 1)[0])
  }

  // reconstruir: sustituir visibles en su orden nuevo, ocultas quedan donde estaban
  let vi = 0
  const nextOrder = order.map((colId) => (isVisible(colId) ? visibles[vi++] : colId))
  setOrder(nextOrder)
}

function resetOrder() {
  // vuelve al orden base de las leaf columns
  props.table.resetColumnOrder()
  props.table.resetColumnSizing()
  props.table.resetColumnVisibility()
}

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
                  <Checkbox
                    :disabled="!col.getCanHide()"
                    :model-value="col.getIsVisible()"
                    @update:model-value="(v) => col.getCanHide() && col.toggleVisibility(!!v)"
                  />
                  <span class="truncate capitalize text-sm">
                    {{ col.id }}
                  </span>
                  <span
                    v-if="!col.getCanHide()"
                    class="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground"
                  >
                    fija
                  </span>

                  <div class="ml-auto flex items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7"
                      :disabled="i === 0"
                      @click="moveVisible(col.id, 'start')"
                      aria-label="Mover al inicio"
                    >
                      <ChevronsUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7"
                      :disabled="i === 0"
                      @click="moveVisible(col.id, 'up')"
                      aria-label="Subir"
                    >
                      <ChevronUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7"
                      :disabled="i === visibleColumnsOrdered.length - 1"
                      @click="moveVisible(col.id, 'down')"
                      aria-label="Bajar"
                    >
                      <ChevronDown />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      class="h-7 w-7"
                      :disabled="i === visibleColumnsOrdered.length - 1"
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
