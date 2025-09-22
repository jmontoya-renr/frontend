<script setup lang="ts" generic="T extends WithId">
import type { Column, ColumnFiltersState, Table } from '@tanstack/vue-table'
import { computed, onMounted, reactive, watch, type VNode } from 'vue'

import { X } from 'lucide-vue-next'
import { Button } from '@/shared/components/ui/button'

import Separator from '../ui/separator/Separator.vue'
import type { WithId } from '@/shared/types/with-id'

import type {
  ColumnFilterMeta,
  DateRangeFilterMeta,
  MultiSelectFilterMeta,
  TextFilterMeta,
  Option,
  DateRangeValue,
  OptionsLoaderCtx,
  OptionsSource,
} from '@/shared/types/table-filters'
import { getLocalTimeZone, today, parseDate, type DateValue } from '@internationalized/date'

import ComboboxSelect, { type SelectOption } from '@/shared/components/ComboboxSelect.vue'
import DatePickerPopover from '@/shared/components/DatePickerPopover.vue'

interface DataTableToolbarProps {
  table: Table<T>
  initialColumnFilters?: ColumnFiltersState
}

const props = defineProps<DataTableToolbarProps>()

const tz = getLocalTimeZone()
const todayDV: DateValue = today(tz)

/* -------------------- Type guards -------------------- */
const isText = (m: ColumnFilterMeta): m is TextFilterMeta => m.type === 'text'
const isDateRange = (m: ColumnFilterMeta): m is DateRangeFilterMeta => m.type === 'dateRange'
const isMulti = (m: ColumnFilterMeta): m is MultiSelectFilterMeta => m.type === 'multiSelect'

interface FilterableCol<T> {
  col: Column<T>
  meta: ColumnFilterMeta
}

/** ---------- Helpers: typed, no `any` ---------- */
function normalizeValue(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normalizeValue)
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(obj).sort()) out[k] = normalizeValue(obj[k])
    return out
  }
  return v
}

function sortFilters(fs: ColumnFiltersState): ColumnFiltersState {
  return [...fs].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

function sameColumnFilters(a: ColumnFiltersState, b: ColumnFiltersState): boolean {
  if (a.length !== b.length) return false
  const aa = sortFilters(a)
  const bb = sortFilters(b)
  for (let i = 0; i < aa.length; i++) {
    if (aa[i].id !== bb[i].id) return false
    const av = JSON.stringify(normalizeValue(aa[i].value))
    const bv = JSON.stringify(normalizeValue(bb[i].value))
    if (av !== bv) return false
  }
  return true
}

const initialFiltersNormalized = computed<ColumnFiltersState>(() =>
  props.initialColumnFilters && props.initialColumnFilters.length
    ? sortFilters(props.initialColumnFilters)
    : [],
)

const currentColumnFilters = computed<ColumnFiltersState>(() => {
  // TanStack Table state; keep it typed
  const state = props.table.getState() as { columnFilters?: ColumnFiltersState }
  return state.columnFilters ? sortFilters(state.columnFilters) : []
})

const isInitialState = computed<boolean>(() =>
  sameColumnFilters(currentColumnFilters.value, initialFiltersNormalized.value),
)

const showReset = computed<boolean>(() => !isInitialState.value)

/* -------------------- Title extraction -------------------- */
/** Get a human-readable title for a column:
 *  - If header is string → use it
 *  - If header is function that returns <DataTableColumnHeader :title="..."> → read vnode.props.title
 *  - Fallback to column id
 */
function getColumnTitle<T>(col: Column<T, unknown>): string {
  const header = col.columnDef.header

  // header as a plain string
  if (typeof header === 'string') return header

  // header as a function returning a VNode (like h(DataTableColumnHeader, { title: '...' }))
  if (typeof header === 'function') {
    try {
      // TanStack passes { column, table } habitualmente; con 'vue-table' al menos 'column'
      const vnode = (header as (ctx: { column: Column<T, unknown> }) => VNode)({ column: col })
      const maybeTitle = (vnode?.props as Readonly<Record<string, unknown>> | null | undefined)
        ?.title
      if (typeof maybeTitle === 'string' && maybeTitle.trim().length > 0) {
        return maybeTitle
      }
    } catch {
      // si algo falla, hacemos fallback
    }
  }

  // fallback
  const id = (col.id ??
    (col.columnDef as { id?: string; accessorKey?: string }).accessorKey ??
    '') as string
  return id || '—'
}

/* -------------------- Column selection -------------------- */
const filterableColumns = computed<Array<FilterableCol<T>>>(() =>
  props.table
    .getAllLeafColumns()
    .map((c) => {
      const meta = c.columnDef.meta?.filter
      return meta ? ({ col: c, meta } as FilterableCol<T>) : null
    })
    .filter((x): x is FilterableCol<T> => x !== null),
)

function toDV(s: string | undefined): DateValue | null {
  if (!s) return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  if (!m) return null
  try {
    return parseDate(m[1])
  } catch {
    return null
  }
}

// ⬇️ NEW: normalize string "YYYY-MM-DD" (or undefined)
function normDateStr(s: string | undefined | null): string | undefined {
  const m = typeof s === 'string' ? /^(\d{4}-\d{2}-\d{2})/.exec(s) : null
  return m ? m[1] : undefined
}

// ⬇️ NEW: per-column constraints for the pickers
function getFromMaxDV(columnId: string): DateValue {
  const toStr = normDateStr(dateInputs[columnId]?.to)
  return toDV(toStr) ?? todayDV
}
function getToMinDV(columnId: string): DateValue | null {
  const fromStr = normDateStr(dateInputs[columnId]?.from)
  return toDV(fromStr)
}

/* -------------------- Local state (synced with TanStack) -------------------- */
const textInputs = reactive<Record<string, string>>({})
const dateInputs = reactive<Record<string, DateRangeValue>>({})
const multiInputs = reactive<Record<string, string[]>>({})
const optionsMap = reactive<Record<string, SelectOption[]>>({})
const loading = reactive<Record<string, boolean>>({})

/* -------------------- Utils -------------------- */
function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let t: number | undefined
  return ((...args: Parameters<T>) => {
    window.clearTimeout(t)
    t = window.setTimeout(() => fn(...args), ms)
  }) as T
}

function toSelectOptions(arr: ReadonlyArray<Option>): SelectOption[] {
  return arr.map((o) => ({ label: o.label, value: String(o.value) }))
}

function getColumnFilterValue(columnId: string): unknown {
  const found = props.table.getState().columnFilters.find((f) => f.id === columnId)
  return found?.value
}

function ensureOptionArray<T>(src: OptionsSource<T>, ctx: OptionsLoaderCtx<T>): Promise<Option[]> {
  if (typeof src === 'function') {
    return Promise.resolve(src(ctx))
  }
  return Promise.resolve(src)
}

async function loadMultiOptions<T>(f: FilterableCol<T>): Promise<void> {
  const id = f.col.id
  if (!isMulti(f.meta)) return
  loading[id] = true
  try {
    const ctx: OptionsLoaderCtx<T> = {
      table: props.table as unknown as Table<T>,
      column: f.col,
      getColumnFilterValue,
    }
    const raw = await ensureOptionArray<T>(f.meta.options as OptionsSource<T>, ctx)
    optionsMap[id] = toSelectOptions(raw)

    // 🔁 re-lee el valor actual del filtro en la tabla y normalízalo a string[]
    const tableVal = f.col.getFilterValue()
    multiInputs[id] = Array.isArray(tableVal) ? (tableVal as unknown[]).map((v) => String(v)) : []

    // 🔒 elimina valores que no existan en las opciones (por si acaso)
    sanitizeMultiSelection(id)
  } finally {
    loading[id] = false
  }
}

function sanitizeMultiSelection(id: string): void {
  const allowed = new Set((optionsMap[id] ?? []).map((o) => o.value))
  const curr = multiInputs[id] ?? []
  const next = curr.filter((v) => allowed.has(v))

  if (next.length !== curr.length) {
    multiInputs[id] = next
    const col = filterableColumns.value.find((f) => f.col.id === id)?.col
    if (!col) return
    if (next.length === 0) {
      col.setFilterValue(undefined) // ← elimina el filtro si ya no quedan valores válidos
    } else {
      col.setFilterValue(next)
    }
  }
}

/* -------------------- Init -------------------- */
onMounted(async () => {
  for (const f of filterableColumns.value) {
    const id = f.col.id
    const current = f.col.getFilterValue()

    if (isText(f.meta)) {
      textInputs[id] = typeof current === 'string' ? current : ''
    } else if (isDateRange(f.meta)) {
      const v = (current ?? {}) as DateRangeValue
      dateInputs[id] = { from: v.from, to: v.to }
    } else if (isMulti(f.meta)) {
      multiInputs[id] = Array.isArray(current) ? (current as string[]) : []
      await loadMultiOptions(f)
    }
  }
})

/* -------------------- Handlers -------------------- */
const setTextFilterDebounced = debounce((id: string, v: string) => {
  const col = filterableColumns.value.find((f) => f.col.id === id)?.col
  col?.setFilterValue(v)
}, 300)

function onDateChange(id: string, key: 'from' | 'to', value: string | null): void {
  const curr = dateInputs[id] ?? {}
  const fromStr = normDateStr(key === 'from' ? value : curr.from)
  let toStr = normDateStr(key === 'to' ? value : curr.to)

  // If both set and invalid order, fix it:
  if (fromStr && toStr && toStr < fromStr) {
    // Clamp "to" up to "from" (UX-friendly, avoids surprises)
    toStr = fromStr
  }

  const next: DateRangeValue = {
    from: fromStr,
    to: toStr,
  }

  dateInputs[id] = next
  const col = filterableColumns.value.find((f) => f.col.id === id)?.col
  col?.setFilterValue(next)
}

function onMultiChange(id: string, values: string[]): void {
  multiInputs[id] = values

  const col = filterableColumns.value.find((f) => f.col.id === id)?.col
  if (!col) return

  if (values.length === 0) {
    col.setFilterValue(undefined)
  } else {
    col.setFilterValue(values)
  }
}

function clearAll(): void {
  // If initialColumnFilters is provided (and possibly non-empty), restore it.
  // Otherwise, clear everything (no filters).
  const next: ColumnFiltersState =
    props.initialColumnFilters && props.initialColumnFilters.length
      ? [...props.initialColumnFilters]
      : []
  props.table.setColumnFilters(next)
  // Los inputs locales se sincronizan vía el watch de columnFilters del propio toolbar.
}

watch(
  () => props.table.getState().columnFilters,
  async () => {
    for (const f of filterableColumns.value) {
      const id = f.col.id
      const val = f.col.getFilterValue()

      if (isText(f.meta)) {
        textInputs[id] = typeof val === 'string' ? val : ''
      } else if (isDateRange(f.meta)) {
        const v = (val ?? {}) as DateRangeValue
        dateInputs[id] = { from: v.from, to: v.to }
      } else if (isMulti(f.meta)) {
        // normaliza a string[]
        multiInputs[id] = Array.isArray(val) ? (val as unknown[]).map((x) => String(x)) : []

        // si las opciones ya están, depura selección inválida
        if ((optionsMap[id]?.length ?? 0) > 0) sanitizeMultiSelection(id)

        // si las opciones son dinámicas, recárgalas
        if (typeof f.meta.options === 'function') {
          await loadMultiOptions(f)
        }
      }
    }
  },
  { deep: true },
)
</script>

<template>
  <section class="flex gap-4 px-4 items-center">
    <span class="min-w-max flex items-center">
      {{ $t('forms.results', table.getRowCount()) }}
    </span>
    <Separator orientation="vertical" class="max-h-6" />
    <span class="flex flex-1 justify-start items-center gap-3 overflow-scroll">
      <template v-for="f in filterableColumns" :key="f.col.id">
        <!-- TEXT -->
        <div v-if="f.meta.type === 'text'" class="flex flex-col">
          <label class="text-xs font-medium mb-1">{{ getColumnTitle(f.col) }}</label>
          <input
            type="text"
            class="border rounded px-2 py-1"
            :value="textInputs[f.col.id] ?? ''"
            :placeholder="`Filtrar ${getColumnTitle(f.col)}`"
            @input="(e) => setTextFilterDebounced(f.col.id, (e.target as HTMLInputElement).value)"
          />
        </div>

        <!-- DATE RANGE (two DatePickerPopover controls) -->
        <div v-else-if="f.meta.type === 'dateRange'" class="flex flex-col">
          <label class="text-xs font-medium mb-1">{{ getColumnTitle(f.col) }}</label>
          <div class="flex items-center gap-2">
            <DatePickerPopover
              :model-value="dateInputs[f.col.id]?.from ?? null"
              placeholder-text="Desde…"
              :no-clear="false"
              :max-value="getFromMaxDV(f.col.id)"
              @update:model-value="(v: string | null) => onDateChange(f.col.id, 'from', v)"
            />
            <span>-</span>
            <DatePickerPopover
              :model-value="dateInputs[f.col.id]?.to ?? null"
              placeholder-text="Hasta…"
              :no-clear="false"
              :min-value="getToMinDV(f.col.id) ?? undefined"
              :max-value="todayDV"
              @update:model-value="(v: string | null) => onDateChange(f.col.id, 'to', v)"
            />
          </div>
        </div>

        <!-- MULTI-SELECT (ComboboxSelect with multiple) -->
        <div v-else-if="f.meta.type === 'multiSelect'" class="flex flex-col min-w-[16rem]">
          <label class="text-xs font-medium mb-1">{{ getColumnTitle(f.col) }}</label>
          <ComboboxSelect
            :model-value="multiInputs[f.col.id] ?? []"
            :options="optionsMap[f.col.id] ?? []"
            :loading="loading[f.col.id] ?? false"
            :disabled="loading[f.col.id] ?? false"
            placeholder="Selecciona…"
            multiple
            clearable
            @update:model-value="
              (vals: string[] | string | null) =>
                onMultiChange(f.col.id, Array.isArray(vals) ? vals : vals ? [vals] : [])
            "
          />
        </div>
      </template>
    </span>
    <template v-if="showReset">
      <Separator orientation="vertical" class="max-h-6" />
      <Button variant="ghost" class="h-8 px-2 lg:px-3" @click="clearAll">
        Reset filters
        <X class="ml-2 h-4 w-4" />
      </Button>
    </template>
  </section>
</template>
