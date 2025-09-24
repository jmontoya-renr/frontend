<script setup lang="ts" generic="T extends WithId">
import { ref, computed, nextTick, type Ref, h, type VNode } from 'vue'
import {
  FlexRender,
  useVueTable,
  getCoreRowModel,
  type ColumnDef,
  type TableMeta,
  type Column,
} from '@tanstack/vue-table'
import type { WithId } from '@/shared/types/with-id'
import { useVirtualRows } from '@/features/datatable/composables/useVirtualRows'
import { useFocus } from '@/features/datatable/composables'

/* -------------------- Types -------------------- */
type AccessorKeyOf<T> = Extract<keyof T, string>
type ColMeta = {
  required?: boolean
  editable?: boolean
  createOnly?: boolean
  input?: 'text' | 'number' | 'checkbox'
}

type Draft<T> = Partial<T> & {
  id: T extends { id: infer U } ? U : string | number
  __tmpId: string
  __pending?: boolean
  __errors?: Partial<Record<AccessorKeyOf<T>, boolean>>
  __rowError?: boolean
  __rowErrorMsg?: string
}

interface Props<T> {
  columns: Array<ColumnDef<T>>
  disabled?: boolean
}
const props = defineProps<Props<T>>()

const emit = defineEmits<{
  (
    e: 'rows-add',
    payload: { drafts: Array<Partial<T>>; onSuccess: () => void; onError: (err?: unknown) => void },
  ): void
}>()

/* -------------------- Consts -------------------- */
const ROW_HEIGHT = 40
const OVERSCAN = 6

/* -------------------- Drafts -------------------- */
const drafts: Ref<Array<Draft<T>>> = ref([])
const bulkOpen = ref(false)
const bulkCount = ref(5)

function rnd(): string {
  return Math.random().toString(36).slice(2, 10)
}
function newDraft(): Draft<T> {
  const idStr = `__append__-${rnd()}`
  const d = { __tmpId: idStr } as Draft<T>
  ;(d as Draft<T> & { id: T['id'] }).id = idStr as unknown as T['id']
  return d
}
function stripInternals(row: Draft<T>): Partial<T> {
  const {
    __tmpId: _a,
    __pending: _b,
    __errors: _c,
    __rowError: _d,
    __rowErrorMsg: _e,
    ...rest
  } = row
  return rest as Partial<T>
}

function addOneDraft() {
  drafts.value.push(newDraft())
  if (drafts.value.length === 1) nextTick(() => focusCell(0, 0, { select: true }))
}
function addBulk(n: number) {
  const count = Math.max(1, Math.min(n, 500))
  drafts.value.push(...Array.from({ length: count }, () => newDraft()))
  bulkOpen.value = false
}
function removeDraft(i: number) {
  drafts.value.splice(i, 1)
}

/* -------------------- Columnas -------------------- */
function isPrivateCol(c: ColumnDef<T>): boolean {
  const id = (c as { id?: string }).id ?? (c as { accessorKey?: string }).accessorKey ?? ''
  return typeof id === 'string' && /^__.*__$/.test(id)
}

const baseColumns = computed<Array<ColumnDef<T>>>(() =>
  props.columns
    .filter((c) => !isPrivateCol(c))
    .map((c) => {
      const meta = (c as { meta?: ColMeta }).meta
      const cloned: ColumnDef<T> = {
        ...c,
        enableSorting: false,
        enableHiding: false,
        enableResizing: (c as { enableResizing?: boolean }).enableResizing ?? true,
        meta: meta ? { ...meta, createOnly: false } : meta,
      }
      return cloned
    }),
)

const actionColumns = computed<Array<ColumnDef<T>>>(() => {
  const saveCol: ColumnDef<T> = {
    id: 'append_save',
    header: 'Guardar',
    enableResizing: false,
    enableSorting: false,
    meta: { editable: false } as ColMeta,
    cell: ({ row }) =>
      h(
        'button',
        {
          class:
            'inline-flex items-center justify-center h-7 px-2 text-xs font-medium rounded-md border bg-primary text-primary-foreground disabled:opacity-60',
          disabled: drafts.value[row.index]?.__pending === true || props.disabled === true,
          title: 'Guardar fila',
          'aria-label': 'Guardar fila',
          onClick: (e: MouseEvent) => {
            e.stopPropagation()
            commitRow(row.index)
          },
          onMousedown: (e: MouseEvent) => e.stopPropagation(),
          'data-keep-edit-open': 'true',
        },
        drafts.value[row.index]?.__pending ? 'Guardando…' : 'Guardar',
      ),
    size: 104,
    minSize: 92,
    maxSize: 140,
  }

  const deleteCol: ColumnDef<T> = {
    id: 'append_delete',
    header: 'Eliminar',
    enableResizing: false,
    enableSorting: false,
    meta: { editable: false } as ColMeta,
    cell: ({ row }) =>
      h(
        'button',
        {
          class:
            'inline-flex items-center justify-center h-7 px-2 text-xs font-medium rounded-md border bg-destructive text-destructive-foreground disabled:opacity-60',
          disabled: drafts.value[row.index]?.__pending === true || props.disabled === true,
          title: 'Eliminar borrador',
          'aria-label': 'Eliminar borrador',
          onClick: (e: MouseEvent) => {
            e.stopPropagation()
            removeDraft(row.index)
          },
          onMousedown: (e: MouseEvent) => e.stopPropagation(),
          'data-keep-edit-open': 'true',
        },
        'Eliminar',
      ),
    size: 104,
    minSize: 92,
    maxSize: 140,
  }

  return [saveCol, deleteCol]
})

const columns = computed<Array<ColumnDef<T>>>(() => [...baseColumns.value, ...actionColumns.value])

/* -------------------- Tabla -------------------- */
const data = computed<Array<T>>(() => [...drafts.value] as Array<T>)

const tableMeta = (): TableMeta<T> => ({
  setRowField,
  getCellValue,
  isCellEditing: () => true, // SIEMPRE en edición
})

const table = useVueTable<T>({
  get data() {
    return data.value as Array<T>
  },
  get columns() {
    return columns.value
  },
  getCoreRowModel: getCoreRowModel(),
  columnResizeMode: 'onChange',
  columnResizeDirection: 'ltr',
  meta: tableMeta(),
  getRowId: (row, index) => {
    const maybe = (row as unknown as { id?: string | number }).id
    return (maybe ?? index).toString()
  },
})

const tableWidthPx = computed(() => `${table.getTotalSize()}px`)

/* -------------------- Virtualización -------------------- */
const containerRef = ref<HTMLElement | null>(null)
const rowCount = computed(() => table.getRowModel().rows.length)

const { virtualRows, totalSize, scrollToIndex } = useVirtualRows({
  containerRef,
  rowCount: () => rowCount.value,
  hasNextPage: () => false,
  isLoadingAnything: () => false,
  loadMore: undefined,
  estimateSize: ROW_HEIGHT,
  overscan: OVERSCAN,
  prefetchGap: 0,
  skeletonRows: 0,
})

/* -------------------- Foco (como DataTable) -------------------- */
const activeRowIndex = ref(0)
const activeColIndex = ref(0)
const rowSelection = ref<Record<string, boolean>>({})

const rowsRef = computed(() => table.getRowModel().rows)
const colCount = computed(() => table.getAllLeafColumns().length)

const { setRowRef, setCellRef, focusCellByIndex, clearCellFocus, focusFirstEditableInCell } =
  useFocus<T>({
    rows: () => rowsRef.value,
    colCount: () => colCount.value,
    rowSelection,
    activeRowIndex,
    activeColIndex,
    scrollToIndex,
  })

function focusCell(r: number, c: number, opts?: { select?: boolean }) {
  const rr = Math.max(0, Math.min(r, rowsRef.value.length - 1))
  const cc = Math.max(0, Math.min(c, colCount.value - 1))
  focusCellByIndex(rr, cc, { select: !!opts?.select })
  nextTick(() => focusFirstEditableInCell(rr, cc))
}

/* -------------------- Evitar robar foco a popovers/listbox -------------------- */
function isKeepOpenTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el) return false
  return !!el.closest(
    '[data-keep-edit-open="true"],[role="listbox"],[aria-haspopup="listbox"],[data-ignore-cell-focus="true"]',
  )
}
function onPointerDownCapture(e: MouseEvent) {
  if (isKeepOpenTarget(e.target)) e.stopPropagation()
}

/* -------------------- Click/Teclado (sin autoguardar) -------------------- */
function onCellClick(i: number, j: number, ev?: MouseEvent) {
  if (ev && isKeepOpenTarget(ev.target)) return
  ev?.preventDefault()
  focusCell(i, j, { select: true })
}
function onKeydown(e: KeyboardEvent) {
  const ae = document.activeElement as HTMLElement | null
  if (ae && isKeepOpenTarget(ae)) return
  if (!rowsRef.value.length || !colCount.value) return
  const move = (dr: number, dc: number) => {
    e.preventDefault()
    focusCell(activeRowIndex.value + dr, activeColIndex.value + dc, { select: true })
  }
  switch (e.key) {
    case 'ArrowRight':
      move(0, 1)
      break
    case 'ArrowLeft':
      move(0, -1)
      break
    case 'ArrowDown':
      move(1, 0)
      break
    case 'ArrowUp':
      move(-1, 0)
      break
    case 'Tab':
      move(0, e.shiftKey ? -1 : 1)
      break
    case 'Enter':
      move(e.shiftKey ? -1 : 1, 0)
      break // NO guarda
  }
}

/* -------------------- Edición helpers -------------------- */
function columnIsEditable(col: Column<T, unknown>): boolean {
  const meta = col.columnDef.meta as ColMeta | undefined
  const ak = (col.columnDef as ColumnDef<T> & { accessorKey?: AccessorKeyOf<T> }).accessorKey
  return typeof ak === 'string' && meta?.editable !== false
}
function setRowField<K extends keyof T>(rowIndex: number, key: K, value: T[K]) {
  const r = drafts.value[rowIndex]
  if (!r) return
  ;(r as Partial<T>)[key] = value
  // limpiar errores de la celda tocada y resetear error de fila
  if (r.__errors && key in r.__errors) delete r.__errors[key as AccessorKeyOf<T>]
  r.__rowError = false
  r.__rowErrorMsg = undefined
}
function getCellValue<K extends keyof T>(rowIndex: number, key: K): T[K] {
  const r = drafts.value[rowIndex]
  const v = r ? (r as Partial<T>)[key] : undefined
  return (v === undefined || v === null ? '' : v) as T[K]
}

/* ---- header & error helpers ---- */
function headerTitle(col: Column<T, unknown>): string {
  const h = col.columnDef.header
  if (typeof h === 'string') return h
  if (typeof h === 'function') {
    try {
      const vnode = (h as (ctx: { column: Column<T, unknown> }) => VNode)({ column: col })
      const title = (vnode?.props as Readonly<Record<string, unknown>> | null | undefined)?.title
      if (typeof title === 'string' && title.trim()) return title
    } catch {}
  }
  const id = (col.id ??
    (col.columnDef as { id?: string; accessorKey?: string }).accessorKey ??
    '') as string
  return id || '—'
}
function colAccessor(col: Column<T, unknown>): AccessorKeyOf<T> | null {
  const ak = (col.columnDef as ColumnDef<T> & { accessorKey?: AccessorKeyOf<T> }).accessorKey
  return typeof ak === 'string' ? ak : null
}
function cellHasError(rowIndex: number, col: Column<T, unknown>): boolean {
  const key = colAccessor(col)
  if (!key) return false
  const err = drafts.value[rowIndex]?.__errors?.[key]
  return !!err
}

/* -------------------- Server error mapping (422, etc.) -------------------- */
function applyServerErrors(rowIndex: number, err: unknown) {
  const r = drafts.value[rowIndex]
  if (!r) return
  const errors: Partial<Record<AccessorKeyOf<T>, boolean>> = { ...(r.__errors ?? {}) }

  // intentar extraer errores típicos
  // 1) { errors: { field: ['msg', ...] }, message?: string }
  const e1 = (err as any)?.errors as Record<string, unknown> | undefined
  if (e1 && typeof e1 === 'object') {
    for (const k of Object.keys(e1)) errors[k as AccessorKeyOf<T>] = true
  }

  // 2) { error: { fieldErrors: { field: 'msg' }, message?: string } }
  const e2 = (err as any)?.error?.fieldErrors as Record<string, unknown> | undefined
  if (e2 && typeof e2 === 'object') {
    for (const k of Object.keys(e2)) errors[k as AccessorKeyOf<T>] = true
  }

  // 3) { fieldErrors: { field: 'msg' } }
  const e3 = (err as any)?.fieldErrors as Record<string, unknown> | undefined
  if (e3 && typeof e3 === 'object') {
    for (const k of Object.keys(e3)) errors[k as AccessorKeyOf<T>] = true
  }

  r.__errors = errors
  r.__rowError = true
  r.__rowErrorMsg =
    (err as any)?.message ??
    (err as any)?.error?.message ??
    (typeof err === 'string' ? err : 'No se pudo guardar la fila.')
}

/* -------------------- Validación + Guardado manual (1x1) -------------------- */
function validateRow(rowIndex: number): { ok: true } | { ok: false; colIndex: number } {
  const r = drafts.value[rowIndex]
  if (!r) return { ok: true }
  const cols = table.getAllLeafColumns()
  for (let j = 0; j < cols.length; j++) {
    const col = cols[j]
    const meta = col.columnDef.meta as ColMeta | undefined
    const ak = (col.columnDef as ColumnDef<T> & { accessorKey?: AccessorKeyOf<T> }).accessorKey
    if (meta?.required && ak) {
      const v = (r as Partial<T>)[ak]
      const bad =
        v === null ||
        v === undefined ||
        (typeof v === 'string' && v.trim() === '') ||
        (typeof v === 'number' && Number.isNaN(v))
      if (bad) {
        const errs = (r.__errors ?? {}) as Draft<T>['__errors']
        errs![ak] = true
        r.__errors = errs
        r.__rowError = true
        r.__rowErrorMsg = 'Faltan campos obligatorios.'
        return { ok: false, colIndex: j }
      }
    }
  }
  r.__errors = {}
  r.__rowError = false
  r.__rowErrorMsg = undefined
  return { ok: true }
}

function commitRow(rowIndex: number) {
  const r = drafts.value[rowIndex]
  if (!r || r.__pending) return
  const v = validateRow(rowIndex)
  if (!v.ok) {
    focusCell(rowIndex, v.colIndex, { select: true })
    return
  }
  r.__pending = true
  const payload = stripInternals(r)

  const done = () => {
    const i = drafts.value.findIndex((d) => d.__tmpId === r.__tmpId)
    if (i >= 0) drafts.value.splice(i, 1)
    const nextIdx = Math.min(i, drafts.value.length - 1)
    if (nextIdx >= 0) nextTick(() => focusCell(nextIdx, activeColIndex.value, { select: true }))
  }
  const fail = (err?: unknown) => {
    r.__pending = false
    applyServerErrors(rowIndex, err)
    // enfocar primera col con error si la hay
    const cols = table.getAllLeafColumns()
    const firstErrCol = cols.findIndex((c) => {
      const ak = (c.columnDef as ColumnDef<T> & { accessorKey?: AccessorKeyOf<T> }).accessorKey
      return ak && r.__errors?.[ak]
    })
    if (firstErrCol >= 0) nextTick(() => focusCell(rowIndex, firstErrCol, { select: true }))
  }

  // 1x1: enviamos una sola fila
  emit('rows-add', { drafts: [payload], onSuccess: done, onError: fail })
}
</script>

<template>
  <div class="mt-1.5 border rounded-md bg-background">
    <!-- Tabla -->
    <div
      v-if="drafts.length > 0"
      ref="containerRef"
      data-slot="table-container"
      class="relative rounded-b-md h-max max-h-80 overflow-auto scrollbar-thin"
      tabindex="0"
      @keydown="onKeydown"
      @mousedown.capture="onPointerDownCapture"
      role="grid"
      aria-label="Tabla de nuevos registros"
      :aria-colcount="colCount"
      :aria-rowcount="rowCount || 0"
    >
      <table
        data-slot="table"
        :style="{ width: tableWidthPx }"
        class="caption-bottom text-sm relative table-fixed w-max min-w-full pr-4"
        role="presentation"
      >
        <!-- Header (grupos) -->
        <thead class="sticky top-0 bg-background z-10">
          <tr v-for="hg in table.getHeaderGroups()" :key="hg.id" class="border-b" role="row">
            <th
              v-for="header in hg.headers"
              :key="header.id"
              :colspan="header.colSpan"
              class="relative h-10 px-2 text-left align-middle font-medium text-muted-foreground select-none"
              :style="{ width: header.getSize() + 'px' }"
              scope="col"
              aria-sort="none"
            >
              <span v-if="!header.isPlaceholder" class="ml-2">
                {{ headerTitle(header.column) }}
              </span>

              <div
                v-if="header.column.getCanResize()"
                @dblclick="() => header.column.resetSize()"
                @mousedown="header.getResizeHandler()($event as unknown as MouseEvent)"
                @touchstart="header.getResizeHandler()($event as unknown as TouchEvent)"
                class="resizer absolute top-2 bottom-2 w-[3px] right-0 cursor-col-resize"
                :class="{ isResizing: header.column.getIsResizing() }"
              />
            </th>
          </tr>
        </thead>

        <!-- Body virtualizado -->
        <tbody
          data-slot="table-body"
          class="[&_tr:last-child]:border-0 relative"
          :style="{ height: `${totalSize}px` }"
        >
          <tr
            v-for="vr in virtualRows"
            :key="(vr.key as number) ?? vr.index"
            data-slot="table-row"
            class="absolute left-0 top-0 hover:bg-muted/50 border-b transition-colors"
            role="row"
            :aria-rowindex="vr.index + 1"
            :data-row-error="drafts[vr.index]?.__rowError ? 'true' : undefined"
            :ref="
              (el) =>
                setRowRef(
                  table.getRowModel().rows[vr.index]?.id ?? `__row__-${vr.index}`,
                  el as HTMLTableRowElement | null,
                )
            "
            :style="{
              width: tableWidthPx,
              height: `${vr.size ?? 40}px`,
              transform: `translateY(${vr.start}px)`,
            }"
          >
            <td
              v-for="(cell, j) in table.getRowModel().rows[vr.index].getVisibleCells()"
              :key="cell.id"
              :id="`${table.getRowModel().rows[vr.index].id}-${cell.id}`"
              role="gridcell"
              data-slot="table-cell"
              :aria-colindex="j + 1"
              :tabindex="vr.index === activeRowIndex && j === activeColIndex ? 0 : -1"
              :data-focused="
                vr.index === activeRowIndex && j === activeColIndex ? 'true' : undefined
              "
              :data-error="cellHasError(vr.index, cell.column) ? 'true' : undefined"
              :ref="(el) => setCellRef(cell.id, el as HTMLTableCellElement | null)"
              class="align-middle"
              :style="{ width: `${cell.column.getSize()}px` }"
              @click="(ev) => onCellClick(vr.index, j, ev)"
              :title="drafts[vr.index]?.__rowErrorMsg || undefined"
            >
              <template v-if="cell.column.columnDef.cell">
                <div
                  class="overflow-hidden flex items-center w-full h-full box-border p-2"
                  :style="{ width: `${cell.column.getSize()}px`, height: `${vr.size ?? 40}px` }"
                >
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </div>
              </template>

              <template v-else>
                <template
                  v-if="
                    columnIsEditable(cell.column) &&
                    (cell.column.columnDef.meta as any)?.input === 'checkbox'
                  "
                >
                  <input
                    type="checkbox"
                    :checked="
                      Boolean(
                        (drafts[vr.index] as unknown as Record<string, unknown>)[
                          (
                            cell.column.columnDef as ColumnDef<T> & {
                              accessorKey?: AccessorKeyOf<T>
                            }
                          ).accessorKey as string
                        ],
                      )
                    "
                    @change="
                      (ev) =>
                        setRowField(
                          vr.index,
                          (
                            cell.column.columnDef as ColumnDef<T> & {
                              accessorKey: AccessorKeyOf<T>
                            }
                          ).accessorKey,
                          (ev.target as HTMLInputElement).checked as unknown as T[AccessorKeyOf<T>],
                        )
                    "
                  />
                </template>

                <template
                  v-else-if="
                    columnIsEditable(cell.column) &&
                    (cell.column.columnDef.meta as any)?.input === 'number'
                  "
                >
                  <input
                    class="w-full border rounded-md px-2 py-1"
                    type="number"
                    :value="
                      ((drafts[vr.index] as unknown as Record<string, unknown>)[
                        (cell.column.columnDef as ColumnDef<T> & { accessorKey?: AccessorKeyOf<T> })
                          .accessorKey as string
                      ] as string | number | undefined) ?? ''
                    "
                    @input="
                      (ev) =>
                        setRowField(
                          vr.index,
                          (
                            cell.column.columnDef as ColumnDef<T> & {
                              accessorKey: AccessorKeyOf<T>
                            }
                          ).accessorKey,
                          Number(
                            (ev.target as HTMLInputElement).value,
                          ) as unknown as T[AccessorKeyOf<T>],
                        )
                    "
                  />
                </template>

                <template v-else-if="columnIsEditable(cell.column)">
                  <input
                    class="w-full border rounded-md px-2 py-1"
                    type="text"
                    :value="
                      ((drafts[vr.index] as unknown as Record<string, unknown>)[
                        (cell.column.columnDef as ColumnDef<T> & { accessorKey?: AccessorKeyOf<T> })
                          .accessorKey as string
                      ] as string | number | undefined) ?? ''
                    "
                    @input="
                      (ev) =>
                        setRowField(
                          vr.index,
                          (
                            cell.column.columnDef as ColumnDef<T> & {
                              accessorKey: AccessorKeyOf<T>
                            }
                          ).accessorKey,
                          (ev.target as HTMLInputElement).value as unknown as T[AccessorKeyOf<T>],
                        )
                    "
                  />
                </template>

                <template v-else>
                  <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
                </template>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Toolbar -->
    <footer v-if="drafts.length <= 0" class="flex items-center gap-2 p-2 border-b">
      <span class="text-sm font-medium">Añadir filas</span>

      <button
        class="px-2 py-1 text-sm border rounded-md hover:bg-muted disabled:opacity-50"
        :disabled="disabled"
        @click="addOneDraft"
      >
        Añadir 1 fila
      </button>

      <div class="relative">
        <button
          class="px-2 py-1 text-sm border rounded-md hover:bg-muted disabled:opacity-50"
          :aria-expanded="bulkOpen ? 'true' : 'false'"
          :disabled="disabled"
          @click="bulkOpen = !bulkOpen"
        >
          Añadir en bloque
        </button>

        <div
          v-if="bulkOpen"
          class="absolute z-10 mt-1 w-56 rounded-md border bg-background p-2 shadow"
        >
          <label class="block text-xs mb-1">Número de filas</label>
          <input
            class="w-full border rounded-md px-2 py-1 text-sm"
            type="number"
            min="1"
            max="500"
            v-model.number="bulkCount"
            @keydown.enter.prevent="addBulk(bulkCount)"
          />
          <div class="mt-2 flex gap-2 justify-end">
            <button class="text-sm px-2 py-1 rounded-md hover:bg-muted" @click="bulkOpen = false">
              Cancelar
            </button>
            <button
              class="text-sm px-2 py-1 rounded-md border hover:bg-muted"
              @click="addBulk(bulkCount)"
            >
              Añadir
            </button>
          </div>
        </div>
      </div>

      <div class="ml-auto text-xs text-muted-foreground">Borradores: {{ drafts.length }}</div>
    </footer>
  </div>
</template>

<style scoped>
/* Resizer */
.resizer {
  background: var(--border);
  opacity: 0;
}
.resizer.isResizing {
  background: #2563eb;
  opacity: 1;
}
@media (hover: hover) {
  th:hover .resizer {
    opacity: 1;
  }
}

/* Celdas y foco */
td[data-slot='table-cell'] {
  position: relative;
}
td[data-focused='true'] {
  box-shadow: inset 0 0 0 2px var(--ring, #2563eb);
}
td[data-focused='true'] input:focus {
  outline-color: #2563eb;
  outline-offset: 0;
}

/* Error de celda */
td[data-error='true'] {
  background: color-mix(in srgb, #ef4444 18%, transparent);
}

/* Error de fila  */
tr[data-row-error='true'] td {
  background: color-mix(in srgb, #ef4444 12%, transparent);
}
tr[data-row-error='true'] td::after {
  content: '!';
  position: absolute;
  top: 4px;
  right: 6px;
  font-weight: 700;
  font-size: 10px;
  line-height: 1;
  color: #fff;
  background: #ef4444;
  padding: 1px 3px;
  border-radius: 3px;
  box-shadow: 0 0 0 1px color-mix(in srgb, #000 12%, transparent);
  pointer-events: none;
}
</style>
