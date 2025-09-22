<script setup lang="ts" generic="T extends WithId">
import type {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  TableState,
  VisibilityState,
} from '@tanstack/vue-table'
import {
  FlexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'
import {
  ref,
  watch,
  nextTick,
  computed,
  watchEffect,
  onMounted,
  onBeforeUnmount,
  useTemplateRef,
} from 'vue'
import { valueUpdater } from '@/shared/utils/valueUpdater'
import DataTableToolbar from '@/shared/components/table/DataTableToolbar.vue'
import DataTableViewOptions from '@/shared/components/table/DataTableViewOptions.vue'
import { Skeleton } from '@/shared/components/ui/skeleton'

import { useVirtualizer } from '@tanstack/vue-virtual'
import type { WithId } from '@/shared/types/with-id'

import { useDebounceFn, useEventListener, useThrottleFn } from '@vueuse/core'

interface DataTableProps<T> {
  columns: Array<ColumnDef<T, unknown>>
  records: Array<T>
  persistKey?: string
  status?: 'pending' | 'success' | 'error'
  error?: unknown
  isFetching?: boolean
  hasNextPage?: boolean
  isFetchingNextPage?: boolean
  disableNewRows?: boolean
  initialServerFilters?: Record<string, string[]>
  loadMore?: () => void | Promise<void>
  isRowEditable?: (row: T) => boolean
}

const props = defineProps<DataTableProps<T>>()
const emit = defineEmits<{
  (e: 'edit-start', payload: { rowIndex: number; colIndex: number }): void
  (e: 'edit-end', payload: { rowIndex: number; colIndex: number; commit: boolean }): void
  (
    e: 'row-commit',
    payload: {
      rowIndex: number
      rowId: string | number
      patch: Partial<T>
      full: T
      reason: 'row-change' | 'row-add' | 'edit-exit' | 'unmount'
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
  (e: 'server-sort', payload: { sort_by: string; sort_order: 'asc' | 'desc' } | null): void
  (e: 'server-filters', payload: Record<string, Array<string>>): void
}>()

type RowCommitReason = 'row-change' | 'edit-exit' | 'unmount'

type FilterMeta =
  | { type: 'text'; param?: string }
  | { type: 'multiSelect'; param: string }
  | { type: 'dateRange'; serverKeys?: { from?: string; to?: string } }

type DateRangeValue = { from?: string; to?: string }

function getColumnId<T>(c: ColumnDef<T, unknown>): string | null {
  const byId = (c as { id?: string }).id
  if (byId) return byId
  const byAccessor = (c as { accessorKey?: string }).accessorKey
  return byAccessor ?? null
}

function flattenColumns<T>(cols: Array<ColumnDef<T, unknown>>): Array<ColumnDef<T, unknown>> {
  const out: Array<ColumnDef<T, unknown>> = []
  const walk = (arr: Array<ColumnDef<T, unknown>>): void => {
    for (const c of arr) {
      const maybeGroup = c as unknown as { columns?: Array<ColumnDef<T, unknown>> }
      if (maybeGroup.columns && maybeGroup.columns.length) walk(maybeGroup.columns)
      else out.push(c)
    }
  }
  walk(cols)
  return out
}

function fromServerToColumnFilters<T>(
  cols: Array<ColumnDef<T, unknown>>,
  server: Record<string, string[]>,
): ColumnFiltersState {
  const leafs = flattenColumns(cols)
  const res: ColumnFiltersState = []

  for (const c of leafs) {
    const id = getColumnId(c)
    if (!id) continue

    const meta = c.meta?.filter as FilterMeta | undefined

    if (!meta) {
      const arr = server[id]
      if (Array.isArray(arr) && arr.length) res.push({ id, value: arr })
      continue
    }

    if (meta.type === 'text') {
      const key = meta.param || id
      const v = server[key]?.[0] ?? ''
      if (v) res.push({ id, value: v })
      continue
    }

    if (meta.type === 'multiSelect') {
      const key = meta.param
      const raw = server[key] ?? []
      const arr: string[] = Array.isArray(raw) ? raw.map((x) => String(x)).filter(Boolean) : []
      if (arr.length) res.push({ id, value: arr })
      continue
    }

    if (meta.type === 'dateRange') {
      const fromKey = meta.serverKeys?.from ?? `${id}_from`
      const toKey = meta.serverKeys?.to ?? `${id}_to`
      const from = server[fromKey]?.[0]
      const to = server[toKey]?.[0]
      if (from || to) {
        const vr: DateRangeValue = {}
        if (from) vr.from = from
        if (to) vr.to = to
        res.push({ id, value: vr })
      }
      continue
    }
  }

  return res
}

const sorting = ref<SortingState>([])
const columnFilters = ref<ColumnFiltersState>([])
const columnVisibility = ref<VisibilityState>({})
const rowSelection = ref<Record<string, boolean>>({})
const viewOptions = useTemplateRef('view-options')
const initialColumnFiltersDefault = ref<ColumnFiltersState>([])

const columnOrder = ref<Array<string>>([])
const columnSizing = ref<Record<string, number>>({})

const containerRef = ref<HTMLElement | null>(null)
const activeRowIndex = ref(-1)
const activeColIndex = ref(-1)
const isEditing = ref(false)

const rowEls = ref<Record<string, HTMLTableRowElement | null>>({})
const cellEls = ref<Record<string, HTMLTableCellElement | null>>({})
const setRowRef = (id: string, el: HTMLTableRowElement | null) => (rowEls.value[id] = el)
const setCellRef = (id: string, el: HTMLTableCellElement | null) => (cellEls.value[id] = el)

const SKELETON_ROWS = 10
const leafColumns = computed(() => table.getAllLeafColumns())

const isLoaderIndex = (i: number): boolean => i >= rowCount.value

const rowDrafts = ref<Record<string, Partial<T>>>({})

const rowIdAt = (i: number): string => rows.value[i]?.id ?? ''

function rowIndexOf(original: T): number {
  const id = String(original.id)
  return rows.value.findIndex((r) => r.id === id)
}

function getCellValue<K extends keyof T>(i: number, colId: K, originalRow: T): T[K] {
  const id = rowIdAt(i)
  if (!id) return originalRow[colId]
  const draft = rowDrafts.value[id]
  return draft && colId in draft ? (draft[colId] as T[K]) : originalRow[colId]
}

function setRowField<K extends keyof T>(i: number, colId: K, next: T[K], originalRow: T): void {
  const id = rowIdAt(i)
  if (!id) return

  const orig = originalRow[colId]

  const errs = rowErrors.value[id]
  if (errs && Object.prototype.hasOwnProperty.call(errs, colId)) {
    const nextErrs: Partial<Record<keyof T, unknown>> = { ...errs }
    delete nextErrs[colId]
    if (Object.keys(nextErrs).length) {
      rowErrors.value[id] = nextErrs
    } else {
      const copyAll = { ...rowErrors.value }
      delete copyAll[id]
      rowErrors.value = copyAll
    }
  }

  if (next === orig) {
    const draft = rowDrafts.value[id]
    if (!draft) return
    const nextDraft = { ...draft }
    delete nextDraft[colId]
    if (Object.keys(nextDraft).length) {
      rowDrafts.value[id] = nextDraft
    } else {
      const copyAll = { ...rowDrafts.value }
      delete copyAll[id]
      rowDrafts.value = copyAll
    }
  } else {
    rowDrafts.value = {
      ...rowDrafts.value,
      [id]: { ...rowDrafts.value[id], [colId]: next },
    }
  }
}

function isCellDirtyById(i: number, colId: keyof T): boolean {
  const id = rowIdAt(i)
  const draft = rowDrafts.value[id]
  return !!(draft && colId in draft)
}

function ensureCursorOnEditableRow(): void {
  const R = rows.value.length
  const C = colCount.value
  // Si no hay tabla visible, salimos de edición sin más
  if (R === 0 || C === 0) {
    if (isEditing.value) isEditing.value = false
    return
  }

  // Aseguramos que los índices están dentro de rango
  const ri = clamp(activeRowIndex.value < 0 ? 0 : activeRowIndex.value, 0, R - 1)
  const ci = clamp(activeColIndex.value < 0 ? 0 : activeColIndex.value, 0, C - 1)
  activeRowIndex.value = ri
  activeColIndex.value = ci

  // Si estamos en edición pero la fila actual no es editable -> salimos a movimiento
  if (isEditing.value && !isRowEditableAt(ri)) {
    isEditing.value = false
    // Mantén el foco visual en la celda (modo movimiento)
    nextTick(() => focusCellByIndex(ri, ci, { select: false }))
  }
}

const rowPending = ref<Record<string, boolean>>({})

type CellErrors = Partial<Record<keyof T, unknown>>
const rowErrors = ref<Record<string, CellErrors>>({})

function isCellErrorById(i: number, colId: keyof T): boolean {
  const id = rowIdAt(i)
  const e = rowErrors.value[id]
  return !!(id && e && e[colId] !== undefined)
}

function isRowPendingAt(i: number): boolean {
  const id = rowIdAt(i)
  return !!(id && rowPending.value[id])
}

function isRowErrorAt(i: number): boolean {
  const id = rowIdAt(i)
  const e = rowErrors.value[id]
  return !!(e && Object.keys(e).length)
}

const table = useVueTable({
  get data() {
    return props.records
  },
  get columns() {
    return props.columns
  },
  state: {
    get sorting() {
      return sorting.value
    },
    get columnFilters() {
      return columnFilters.value
    },
    get columnVisibility() {
      return columnVisibility.value
    },
    get rowSelection() {
      return rowSelection.value
    },
    get columnOrder() {
      return columnOrder.value
    },
    get columnSizing() {
      return columnSizing.value
    },
  },
  manualSorting: true,
  manualFiltering: true,
  enableRowSelection: true,
  columnResizeMode: 'onChange',
  getRowId: (row: T) => String(row.id),
  onSortingChange: (u) => valueUpdater(u, sorting),
  onColumnFiltersChange: (u) => valueUpdater(u, columnFilters),
  onColumnVisibilityChange: (u) => valueUpdater(u, columnVisibility),
  onRowSelectionChange: (u) => valueUpdater(u, rowSelection),
  onColumnOrderChange: (u) => valueUpdater(u, columnOrder),
  onColumnSizingChange: (u) => valueUpdater(u, columnSizing),
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFacetedRowModel: getFacetedRowModel(),
  getFacetedUniqueValues: getFacetedUniqueValues(),
  meta: {
    setRowField,
    getCellValue,
    isCellDirtyById,
    isRowEditable: props.isRowEditable,
    isCellEditing: (rowIndex: number, colIndex: number) =>
      isEditing.value && activeRowIndex.value === rowIndex && activeColIndex.value === colIndex,
    commitRowAt: (rowIndex: number, reason: RowCommitReason = 'row-change'): boolean => {
      return commitRow(rowIndex, reason)
    },
    commitRowAtAsync: (rowIndex: number, reason: RowCommitReason = 'row-change'): Promise<void> => {
      return commitRowPromise(rowIndex, reason)
    },
    commitOriginalAsync: (original: T, reason: RowCommitReason = 'row-change'): Promise<void> => {
      const idx = rowIndexOf(original)
      if (idx < 0) return Promise.resolve()
      return commitRowPromise(idx, reason)
    },
    deleteRowAt: (rowIndex: number): boolean => deleteRow(rowIndex),
    deleteRowAtAsync: (rowIndex: number): Promise<void> => deleteRowPromise(rowIndex),
    deleteOriginalAsync: (original: T): Promise<void> => {
      const i = rowIndexOf(original)
      return i >= 0 ? deleteRowPromise(i) : Promise.resolve()
    },
  },
})

type TablePrefs = {
  v: number
  columnVisibility?: VisibilityState
  columnOrder?: string[]
  columnSizing?: Record<string, number>
}

const PREFS_VERSION = 1
const prefsKey = computed(() =>
  props.persistKey ? `datatable:${props.persistKey}:v${PREFS_VERSION}` : null,
)

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

function loadPrefs(): TablePrefs | null {
  if (typeof window === 'undefined' || !prefsKey.value) return null
  return safeParse<TablePrefs>(localStorage.getItem(prefsKey.value))
}

let saveT: number | undefined
function savePrefsDebounced() {
  if (typeof window === 'undefined' || !prefsKey.value) return
  if (saveT) window.clearTimeout(saveT)
  saveT = window.setTimeout(() => {
    const st = table.getState() as TableState
    const data: TablePrefs = {
      v: PREFS_VERSION,
      columnVisibility: columnVisibility.value,
      columnOrder: st.columnOrder,
      columnSizing: st.columnSizing,
    }
    localStorage.setItem(prefsKey.value!, JSON.stringify(data))
  }, 250)
}

const currentIds = () => table.getAllLeafColumns().map((c) => c.id)
function mergeOrder(saved: string[] | undefined): string[] {
  const ids = currentIds()
  if (!saved?.length) return ids
  const set = new Set(ids)
  const filtered = saved.filter((id) => set.has(id))
  const missing = ids.filter((id) => !filtered.includes(id))
  return [...filtered, ...missing]
}
function filterSizing(saved: Record<string, number> | undefined) {
  if (!saved) return {}
  const ids = new Set(currentIds())
  return Object.fromEntries(Object.entries(saved).filter(([id]) => ids.has(id)))
}

const suppressServerSync = ref(true)

watch(
  () => props.initialServerFilters,
  (nf) => {
    suppressServerSync.value = true

    const next = nf ? fromServerToColumnFilters(props.columns, nf) : []
    columnFilters.value = next
    initialColumnFiltersDefault.value = next

    nextTick(() => {
      suppressServerSync.value = false
    })
  },
  { deep: true, immediate: true, flush: 'sync' },
)

onMounted(() => {
  const prefs = loadPrefs()
  if (prefs) {
    if (prefs.columnVisibility) columnVisibility.value = prefs.columnVisibility
    if (prefs.columnOrder) table.setColumnOrder(mergeOrder(prefs.columnOrder))
    if (prefs.columnSizing) table.setColumnSizing(filterSizing(prefs.columnSizing))
  }
  nextTick(() => {
    suppressServerSync.value = false
  })
})

watch([columnVisibility, columnOrder, columnSizing], savePrefsDebounced, { deep: true })

let onStorage: ((e: StorageEvent) => void) | null = null

if (typeof window !== 'undefined') {
  onStorage = (e) => {
    if (e.key !== prefsKey.value) return
    const prefs = safeParse<TablePrefs>(e.newValue)
    if (!prefs) return
    if (prefs.columnVisibility) columnVisibility.value = prefs.columnVisibility
    if (prefs.columnOrder) table.setColumnOrder(mergeOrder(prefs.columnOrder))
    if (prefs.columnSizing) table.setColumnSizing(filterSizing(prefs.columnSizing))
  }
  window.addEventListener('storage', onStorage)
}

const rows = computed(() => table.getRowModel().rows)
const colCount = computed(() => visibleLeafColumns.value.length)
const rowCount = computed(() => rows.value.length)
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

const isInitialPending = computed(() => props.status === 'pending')
const isLoadingAnything = computed(
  () => isInitialPending.value || !!props.isFetching || !!props.isFetchingNextPage,
)
const canAskMore = computed(() => !!props.hasNextPage && !isLoadingAnything.value)

function mapFiltersToServer(fs: ColumnFiltersState): Record<string, Array<string>> {
  const out: Record<string, Array<string>> = {}

  const metaById = new Map(
    table.getAllLeafColumns().map((c) => [c.id, c.columnDef.meta?.filter as unknown]),
  )

  for (const f of fs) {
    const meta = metaById.get(f.id) as
      | { type: 'text'; param?: string }
      | { type: 'multiSelect'; param: string }
      | { type: 'dateRange'; serverKeys?: { from?: string; to?: string } }
      | { type: 'boolean'; param?: string }
      | undefined

    const raw = (f as { value: unknown }).value
    if (!meta) {
      const v = Array.isArray(raw)
        ? raw.map(String).filter(Boolean)
        : raw == null
          ? []
          : [String(raw).trim()].filter(Boolean)
      if (v.length) out[f.id] = v
      continue
    }

    if (meta.type === 'text') {
      const key = meta.param || f.id
      const v = raw == null ? '' : String(raw).trim()
      if (v) out[key] = [v]
      continue
    }

    if (meta.type === 'multiSelect') {
      const key = meta.param
      const arr = Array.isArray(raw)
        ? raw.map(String).filter((s) => s.length > 0)
        : raw == null
          ? []
          : [String(raw)].filter((s) => s.length > 0)
      out[key] = arr
      continue
    }

    if (meta.type === 'dateRange') {
      const { from, to } = (raw ?? {}) as { from?: string; to?: string }
      const fromKey = meta.serverKeys?.from ?? `${f.id}_from`
      const toKey = meta.serverKeys?.to ?? `${f.id}_to`
      if (from) out[fromKey] = [from]
      if (to) out[toKey] = [to]
      continue
    }

    if (meta.type === 'boolean') {
      // Serialize boolean as 'true' | 'false' and use meta.param if provided
      const key = meta.param || f.id
      // Accept both boolean and string just in case
      if (typeof raw === 'boolean') {
        out[key] = [raw ? 'true' : 'false']
      } else if (typeof raw === 'string') {
        const v = raw.trim().toLowerCase()
        if (v === 'true' || v === 'false') out[key] = [v]
      }
      continue
    }
  }

  return out
}

function mapSortingToServer(
  s: SortingState,
): { sort_by: string; sort_order: 'asc' | 'desc' } | null {
  if (!s.length) return null
  const first = s[0]
  return { sort_by: first.id, sort_order: first.desc ? 'desc' : 'asc' }
}

const emitServerSort = useDebounceFn((s: SortingState) => {
  if (suppressServerSync.value) return
  emit('server-sort', mapSortingToServer(s))
}, 250)

watch(
  () => sorting.value,
  (s) => emitServerSort(s),
  { deep: true },
)
const emitServerFilters = useDebounceFn((cf: ColumnFiltersState) => {
  if (suppressServerSync.value) return
  emit('server-filters', mapFiltersToServer(cf))
}, 1000)

watch(
  () => columnFilters.value,
  (cf) => emitServerFilters(cf),
  { deep: true },
)

const liveMessage = ref('')

watch(
  [
    () => props.status,
    () => props.isFetching,
    () => props.isFetchingNextPage,
    () => rows.value.length,
  ],
  ([status, isFetch, isNext, len]) => {
    if (status === 'pending') liveMessage.value = 'Loading...'
    else if (!isNext && !isFetch && len == 0) liveMessage.value = 'No results.'
    else liveMessage.value = `${len} results`
  },
  { immediate: true },
)

function isRowEditableAt(i: number): boolean {
  const r = rows.value[i]
  if (!r) return false
  const base = props.isRowEditable ? props.isRowEditable(r.original as T) : true
  return base && !isRowPendingAt(i)
}

const isColumnEditableAt = (j: number): boolean => {
  const col = visibleLeafColumns.value[j]
  return !!col && col.columnDef?.meta?.editable !== false
}

const isCellEditable = (i: number, j: number): boolean =>
  isRowEditableAt(i) && isColumnEditableAt(j)

function clearCellFocus(opts: { clearSelection?: boolean; focusContainer?: boolean } = {}) {
  activeRowIndex.value = -1
  activeColIndex.value = -1
  if (opts.clearSelection) rowSelection.value = {}
  nextTick(() => {
    const el = document.activeElement as HTMLElement | null
    if (containerRef.value?.contains(el as Node)) el?.blur()
    if (opts.focusContainer && containerRef.value) containerRef.value.focus()
  })
}

function getRowPatch(i: number): Partial<T> | null {
  const id = rowIdAt(i)
  if (!id) return null
  const patch = rowDrafts.value[id]
  return patch && Object.keys(patch).length ? patch : null
}

function deleteRow(i: number): boolean {
  const id = rowIdAt(i)
  if (!id) return false
  if (isRowPendingAt(i)) return false

  const original = rows.value[i]?.original as T | undefined
  if (!original) return false

  rowPending.value[id] = true
  delete rowErrors.value[id]

  const onSuccess = (): void => {
    delete rowPending.value[id]
    delete rowDrafts.value[id]
    delete rowErrors.value[id]
    nextTick(() => ensureCursorOnEditableRow())
  }

  const onError = (_err?: unknown): void => {
    delete rowPending.value[id]
    nextTick(() => ensureCursorOnEditableRow())
  }

  emit('row-delete', { rowIndex: i, rowId: original.id, full: original, onSuccess, onError })
  return true
}

function deleteRowPromise(i: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const ok = deleteRow(i)
    if (!ok) return resolve()

    const id = rowIdAt(i)
    queueMicrotask(() => {
      if (!rowPending.value[id]) {
        resolve()
        return
      }
      const stop = watch(
        () => rowPending.value[id],
        (pending) => {
          if (!pending) {
            stop()
            resolve()
          }
        },
        { flush: 'post' },
      )
    })
  })
}

function commitRow(i: number, reason: RowCommitReason): boolean {
  const id = rowIdAt(i)
  if (!id) return false
  if (rowPending.value[id]) return false

  const patch = getRowPatch(i)
  if (!patch) return false

  const original = rows.value[i]?.original as T | undefined
  if (!original) return false
  const full = { ...original, ...patch } as T

  rowPending.value[id] = true
  delete rowErrors.value[id]

  const onSuccess = () => {
    delete rowPending.value[id]
    delete rowDrafts.value[id]
    delete rowErrors.value[id]
  }

  const onError = (err?: unknown) => {
    delete rowPending.value[id]
    const perField =
      err && typeof err === 'object' && 'fields' in err ? (err.fields as CellErrors) : null

    if (perField) {
      rowErrors.value[id] = { ...rowErrors.value[id], ...perField }
    } else {
      const mark: CellErrors = {}
      ;(Object.keys(patch) as Array<keyof T>).forEach((k) => (mark[k] = true))
      rowErrors.value[id] = { ...rowErrors.value[id], ...mark }
    }
  }

  emit('row-commit', { rowIndex: i, rowId: original.id, patch, full, reason, onSuccess, onError })

  return true
}

function commitRowPromise(i: number, reason: RowCommitReason): Promise<void> {
  return new Promise<void>((resolve) => {
    const ok = commitRow(i, reason)
    if (!ok) return resolve()

    const id = rowIdAt(i)

    queueMicrotask(() => {
      if (!rowPending.value[id]) {
        resolve()
        return
      }

      const stop = watch(
        () => rowPending.value[id],
        (pending) => {
          if (!pending) {
            stop()
            resolve()
          }
        },
        { flush: 'post' },
      )
    })
  })
}

function discardRow(i: number) {
  const id = rowIdAt(i)
  if (!id) return
  delete rowDrafts.value[id]
  delete rowErrors.value[id]
}

const rowVirtualizer = useVirtualizer(
  computed(() => ({
    count: props.hasNextPage ? rowCount.value + SKELETON_ROWS : rowCount.value,
    getScrollElement: () => containerRef.value,
    estimateSize: () => 40,
    measureElement:
      typeof window !== 'undefined'
        ? (element) => element?.getBoundingClientRect().height
        : undefined,
    overscan: 5,
  })),
)
const virtualRows = computed(() => rowVirtualizer.value.getVirtualItems())
const totalSize = computed(() => rowVirtualizer.value.getTotalSize())
const visibleLeafColumns = computed(() => table.getVisibleLeafColumns())

const triggerLoadMore = useThrottleFn(
  async () => {
    if (props.loadMore) await props.loadMore()
  },
  300,
  true,
  true,
)

watchEffect(() => {
  if (!canAskMore.value) return

  const list = virtualRows.value
  if (!list.length || rowCount.value === 0) return

  const last = list[list.length - 1]
  const reachedEnd = last.index >= rowCount.value - 1

  if (reachedEnd) {
    triggerLoadMore()
  }
})

function isInteractiveElement(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return !!el.closest('input,button,select,textarea,label,a,[role="checkbox"],[data-no-row-select]')
}

function focusCellByIndex(
  r: number,
  c: number,
  opts: { select?: boolean; additive?: boolean } = { select: true, additive: false },
) {
  const R = rows.value.length,
    C = colCount.value
  if (!R || !C) return
  const ri = clamp(r, 0, R - 1),
    ci = clamp(c, 0, C - 1)
  activeRowIndex.value = ri
  activeColIndex.value = ci

  const row = rows.value[ri]
  const cell = row.getVisibleCells()[ci]

  if (opts.select) {
    rowSelection.value = opts.additive
      ? { ...rowSelection.value, [row.id]: true }
      : { [row.id]: true }
  }

  nextTick(() => {
    rowVirtualizer.value.scrollToIndex(ri, { align: 'auto' })
    nextTick(() => {
      const td = cellEls.value[cell.id]
      if (!td) return
      td.focus({ preventScroll: true })
      td.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
  })
}

function isEditableTarget(el: EventTarget | null) {
  const t = el as HTMLElement | null
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
}

function onKeydownCapture(e: KeyboardEvent) {
  if (!isEditing.value) return

  const arrowOrScrollKey =
    e.key === 'ArrowUp' ||
    e.key === 'ArrowDown' ||
    e.key === 'ArrowLeft' ||
    e.key === 'ArrowRight' ||
    e.key === 'PageUp' ||
    e.key === 'PageDown' ||
    e.key === 'Home' ||
    e.key === 'End' ||
    e.key === ' '

  if (!arrowOrScrollKey) return

  if (isEditableTarget(e.target)) {
    e.stopPropagation()
    return
  }

  e.preventDefault()
  e.stopPropagation()
}

function focusFirstEditableInCell(i: number, j: number) {
  const row = rows.value[i]
  const td = cellEls.value[row.getVisibleCells()[j].id]
  if (!td) return

  const sel =
    'input, textarea, [contenteditable="true"], select, button, [tabindex]:not([tabindex="-1"])'
  const el = td.querySelector<HTMLElement>(sel)
  if (!el) return

  nextTick(() => {
    el.focus({ preventScroll: true })
  })
}

function enterEditMode(i: number, j: number) {
  if (i < 0 || j < 0) return
  if (isEditing.value && i === activeRowIndex.value && j === activeColIndex.value) return
  if (!isCellEditable(i, j)) return

  if (activeRowIndex.value !== i || activeColIndex.value !== j) {
    focusCellByIndex(i, j, { select: true })
  }

  isEditing.value = true
  emit('edit-start', { rowIndex: i, colIndex: j })

  nextTick(() => focusFirstEditableInCell(i, j))
}

function endEdit(
  commit: boolean,
  next?: { r: number; c: number },
  opts: { refocus?: boolean; continueIfSameRow?: boolean } = {
    refocus: true,
    continueIfSameRow: true,
  },
) {
  if (!isEditing.value) return

  const currR = activeRowIndex.value

  emit('edit-end', { rowIndex: currR, colIndex: activeColIndex.value, commit })

  if (commit) {
    const leavingRow = !next || next.r !== currR
    if (leavingRow) {
      commitRow(currR, next ? 'row-change' : 'edit-exit')
    }
  } else {
    discardRow(currR)
  }

  isEditing.value = false
  if (!opts.refocus) {
    return
  }

  if (!next) {
    nextTick(() => {
      const r = activeRowIndex.value
      const c = activeColIndex.value
      if (r >= 0 && c >= 0) focusCellByIndex(r, c, { select: false })
    })

    return
  }

  const sameRow = !!next && next.r === currR
  const canEditNext = isCellEditable(next.r, next.c)

  if (opts.continueIfSameRow && sameRow && canEditNext) {
    isEditing.value = true
    nextTick(() => {
      focusCellByIndex(next.r, next.c, { select: false })
      emit('edit-start', { rowIndex: next.r, colIndex: next.c })
      nextTick(() => focusFirstEditableInCell(next.r, next.c))
    })
    return
  }

  nextTick(() => focusCellByIndex(next.r, next.c, { select: true }))
  if (canEditNext) {
    isEditing.value = true
    emit('edit-start', { rowIndex: next.r, colIndex: next.c })
    nextTick(() => focusFirstEditableInCell(next.r, next.c))
  }
}

function onCellClick(i: number, j: number, e: MouseEvent) {
  if (isInteractiveElement(e.target)) {
    activeRowIndex.value = i
    activeColIndex.value = j
    return
  }

  const additive = e.ctrlKey || e.metaKey
  const isSameCell = i === activeRowIndex.value && j === activeColIndex.value

  if (isSameCell) {
    if (isEditing.value) return
    if (isCellEditable(i, j)) enterEditMode(i, j)
    else focusCellByIndex(i, j, { select: true, additive })
    return
  }

  if (isEditing.value) {
    const sameRow = i === activeRowIndex.value
    endEdit(true, { r: i, c: j }, { refocus: true, continueIfSameRow: sameRow })
    return
  }

  focusCellByIndex(i, j)
}

function onCellDblClick(i: number, j: number) {
  if (isCellEditable(i, j)) enterEditMode(i, j)
}

function onKeydown(e: KeyboardEvent) {
  const R = rows.value.length,
    C = colCount.value
  const r = activeRowIndex.value,
    c = activeColIndex.value

  if (isEditing.value) {
    if (e.key === 'Escape') {
      e.preventDefault()
      endEdit(false)
      return
    }
    if (e.key === 'Enter') {
      if (r < 0) return
      const atLast = !e.shiftKey && r === R - 1
      const atFirst = e.shiftKey && r === 0
      if (atLast || atFirst) {
        endEdit(true, undefined, { refocus: false })
        return
      }
      e.preventDefault()
      if (e.shiftKey) {
        endEdit(true, { r: clamp(r - 1, 0, R - 1), c })
      } else {
        endEdit(true, { r: clamp(r + 1, 0, R - 1), c })
      }

      return
    }
    if (e.key === 'Tab') {
      if (r < 0 || c < 0) return
      const atLast = !e.shiftKey && r === R - 1 && c === C - 1
      const atFirst = e.shiftKey && r === 0 && c === 0
      if (atLast || atFirst) {
        endEdit(true, undefined, { refocus: false })
        return
      }
      e.preventDefault()
      if (e.shiftKey) {
        const prevR = c > 0 ? r : r - 1
        const prevC = c > 0 ? c - 1 : C - 1
        endEdit(true, { r: clamp(prevR, 0, R - 1), c: clamp(prevC, 0, C - 1) })
      } else {
        const nextR = c < C - 1 ? r : r + 1
        const nextC = c < C - 1 ? c + 1 : 0
        endEdit(true, { r: clamp(nextR, 0, R - 1), c: clamp(nextC, 0, C - 1) })
      }
      return
    }
    return
  }

  if (!R || !C) return

  switch (e.key) {
    case 'Escape':
      e.preventDefault()
      clearCellFocus({ clearSelection: true, focusContainer: true })
      break

    case 'j':
    case 'ArrowDown':
      e.preventDefault()
      focusCellByIndex(r < 0 ? 0 : r + 1, c < 0 ? 0 : c)
      break
    case 'k':
    case 'ArrowUp':
      e.preventDefault()
      focusCellByIndex(r <= 0 ? 0 : r - 1, c < 0 ? 0 : c)
      break
    case 'l':
    case 'ArrowRight':
      e.preventDefault()
      focusCellByIndex(r < 0 ? 0 : r, c < 0 ? 0 : c + 1)
      break
    case 'h':
    case 'ArrowLeft':
      e.preventDefault()
      focusCellByIndex(r < 0 ? 0 : r, c <= 0 ? 0 : c - 1)
      break

    case 'Enter':
      if (r < 0 || c < 0) return
      e.preventDefault()
      enterEditMode(r, c)
      break

    case 'Tab': {
      if (r < 0 || c < 0) return
      const atLast = r === R - 1 && c === C - 1
      const atFirst = r === 0 && c === 0
      if (e.shiftKey) {
        if (atFirst) return
        e.preventDefault()
        if (c > 0) focusCellByIndex(r, c - 1)
        else focusCellByIndex(r - 1, C - 1)
      } else {
        if (atLast) return
        e.preventDefault()
        if (c < C - 1) focusCellByIndex(r, c + 1)
        else focusCellByIndex(r + 1, 0)
      }
      break
    }

    case 'Home':
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) focusCellByIndex(0, 0)
      else focusCellByIndex(r < 0 ? 0 : r, 0)
      break
    case 'End':
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) focusCellByIndex(R - 1, C - 1)
      else focusCellByIndex(r < 0 ? 0 : r, C - 1)
      break
    case 'PageDown':
      e.preventDefault()
      focusCellByIndex(r < 0 ? 0 : r + 10, c < 0 ? 0 : c)
      break
    case 'PageUp':
      e.preventDefault()
      focusCellByIndex(r < 0 ? 0 : r - 10, c < 0 ? 0 : c)
      break

    case ' ': {
      if (r < 0 || c < 0) {
        focusCellByIndex(0, 0, { select: false })
        e.preventDefault()
        break
      }
      e.preventDefault()
      const row = rows.value[r]
      const id = row.id
      rowSelection.value = rowSelection.value[id] ? {} : { [id]: true }
      break
    }

    default:
      break
  }
}

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

defineExpose({
  showViewOptionsDialog() {
    if (viewOptions.value) viewOptions.value.openDialog()
  },
})

onMounted(() => {
  const onPointerDown = (e: PointerEvent) => {
    const t = e.target as HTMLElement
    if (
      t.closest('[data-keep-edit-open],[role="listbox"],[role="dialog"],[aria-haspopup="listbox"]')
    )
      return
    const container = containerRef.value
    if (!container) return
    if (container.contains(t as Node)) return
    if (isEditing.value) {
      return endEdit(true, undefined, { refocus: false })
    }
    clearCellFocus({ clearSelection: false, focusContainer: false })
  }

  if (typeof window !== 'undefined') {
    useEventListener(document, 'pointerdown', onPointerDown, { capture: true })
  }
})

onBeforeUnmount(() => {
  if (isEditing.value && activeRowIndex.value >= 0) {
    commitRow(activeRowIndex.value, 'unmount')
  }
})
</script>

<template>
  <DataTableViewOptions ref="view-options" :table="table" />
  <DataTableToolbar :table="table" :initial-column-filters="initialColumnFiltersDefault" />

  <p class="sr-only" aria-live="polite">{{ liveMessage }}</p>

  <div class="flex-1 min-h-0 h-full min-w-0 w-full">
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
    >
      <table
        data-slot="table"
        :style="{ width: table.getTotalSize() + 'px' }"
        class="caption-bottom text-sm relative table-fixed pr-4"
        role="presentation"
      >
        <colgroup>
          <col
            v-for="col in visibleLeafColumns"
            :key="col.id"
            :style="{ width: `${col.getSize()}px` }"
          />
        </colgroup>
        <thead data-slot="table-header" class="sticky top-0 bg-background z-50">
          <tr
            v-for="headerGroup in table.getHeaderGroups()"
            :key="headerGroup.id"
            :style="{ width: table.getTotalSize() + 'px' }"
            data-slot="table-row"
            class="hover:bg-muted/50 transition-colors after:content-[''] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-px after:bg-border after:pointer-events-none"
            role="row"
          >
            <th
              v-for="header in headerGroup.headers"
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

        <tbody
          v-if="status === 'pending' && !isFetchingNextPage"
          data-slot="table-body"
          role="presentation"
          aria-hidden="true"
        >
          <tr v-for="i in SKELETON_ROWS" :key="'sk-' + i" role="row" class="border-b">
            <td
              v-for="col in leafColumns"
              :key="`${i}-${col.id}`"
              :style="{ width: `${col.getSize()}px`, height: '36px' }"
              role="gridcell"
              class="p-2 align-middle"
            >
              <Skeleton class="h-3 rounded-md" :style="{ width: ['70%', '55%', '85%'][i % 3] }" />
            </td>
          </tr>
        </tbody>

        <tbody
          v-else
          data-slot="table-body"
          class="[&_tr:last-child]:border-0 relative"
          :style="{ height: `${totalSize}px` }"
        >
          <template v-if="!isFetching && rows.length <= 0">
            <tr role="row" class="border-b">
              <td
                :colspan="props.columns.length"
                class="p-2 h-24 text-center align-middle"
                role="gridcell"
              >
                No results.
              </td>
            </tr>
          </template>
          <template v-else>
            <tr
              v-for="vr in virtualRows"
              :key="vr.key as number"
              :data-state="!isLoaderIndex(vr.index) && rows[vr.index].getIsSelected() && 'selected'"
              data-slot="table-row"
              class="absolute left-0 top-0 hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors"
              role="row"
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
                width: table.getTotalSize() + 'px',
                height: `${vr.size}px`,
                transform: `translateY(${vr.start}px)`,
              }"
            >
              <template v-if="isLoaderIndex(vr.index)">
                <td
                  v-for="cell in visibleLeafColumns"
                  :key="`${vr.index}-${cell.id}`"
                  :style="{ width: `${cell.getSize()}px`, height: '36px' }"
                  role="gridcell"
                  :colspan="colCount || 1"
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
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style lang="css" scoped>
.resizer {
  position: absolute;
  top: 0.5rem;
  bottom: 0.5rem;
  width: 3px;
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
