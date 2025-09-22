<script setup lang="ts" generic="T extends WithId">
import type { Column, ColumnFiltersState, Table } from '@tanstack/vue-table'
import { computed, onMounted, reactive, watch, type VNode } from 'vue'

import { X } from 'lucide-vue-next'
import { Button } from '@/shared/components/ui/button'
import Separator from '@/shared/components/ui/separator/Separator.vue'

import type { WithId } from '@/shared/types/with-id'

import type {
  ColumnFilterMeta,
  DateRangeFilterMeta,
  MultiSelectFilterMeta,
  BooleanFilterMeta,
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

const isText = (m: ColumnFilterMeta): m is TextFilterMeta => m.type === 'text'
const isDateRange = (m: ColumnFilterMeta): m is DateRangeFilterMeta => m.type === 'dateRange'
const isMulti = (m: ColumnFilterMeta): m is MultiSelectFilterMeta<T> => m.type === 'multiSelect'
const isBoolean = (m: ColumnFilterMeta): m is BooleanFilterMeta => m.type === 'boolean'

interface FilterableCol<T> {
  col: Column<T>
  meta: ColumnFilterMeta
}

function getFilterLabel<T>(f: FilterableCol<T>): string {
  const custom = f.meta.label
  if (typeof custom === 'string' && custom.trim()) return custom
  return getColumnTitle(f.col)
}

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
  const state = props.table.getState() as { columnFilters?: ColumnFiltersState }
  return state.columnFilters ? sortFilters(state.columnFilters) : []
})

const isInitialState = computed<boolean>(() =>
  sameColumnFilters(currentColumnFilters.value, initialFiltersNormalized.value),
)

const showReset = computed<boolean>(() => !isInitialState.value)

function getColumnTitle<T>(col: Column<T, unknown>): string {
  const header = col.columnDef.header

  if (typeof header === 'string') return header

  if (typeof header === 'function') {
    try {
      const vnode = (header as (ctx: { column: Column<T, unknown> }) => VNode)({ column: col })
      const maybeTitle = (vnode?.props as Readonly<Record<string, unknown>> | null | undefined)
        ?.title
      if (typeof maybeTitle === 'string' && maybeTitle.trim().length > 0) {
        return maybeTitle
      }
    } catch {}
  }

  const id = (col.id ??
    (col.columnDef as { id?: string; accessorKey?: string }).accessorKey ??
    '') as string
  return id || '—'
}

const filterableColumns = computed<Array<FilterableCol<T>>>(() =>
  props.table
    .getAllLeafColumns()
    .map((c) => {
      const meta = c.columnDef.meta?.filter
      return meta ? ({ col: c, meta } as FilterableCol<T>) : null
    })
    .filter((x): x is FilterableCol<T> => x !== null)
    .sort((a, b) => {
      // sort by meta.order (undefined -> Infinity), tie-breaker by column id
      const ao = a.meta?.order ?? Number.POSITIVE_INFINITY
      const bo = b.meta?.order ?? Number.POSITIVE_INFINITY
      if (ao !== bo) return ao - bo
      return a.col.id < b.col.id ? -1 : a.col.id > b.col.id ? 1 : 0
    }),
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

function normDateStr(s: string | undefined | null): string | undefined {
  const m = typeof s === 'string' ? /^(\d{4}-\d{2}-\d{2})/.exec(s) : null
  return m ? m[1] : undefined
}

function getFromMaxDV(columnId: string): DateValue {
  const toStr = normDateStr(dateInputs[columnId]?.to)
  return toDV(toStr) ?? todayDV
}
function getToMinDV(columnId: string): DateValue | null {
  const fromStr = normDateStr(dateInputs[columnId]?.from)
  return toDV(fromStr)
}

const textInputs = reactive<Record<string, string>>({})
const dateInputs = reactive<Record<string, DateRangeValue>>({})
const multiInputs = reactive<Record<string, string[]>>({})
const optionsMap = reactive<Record<string, SelectOption[]>>({})
const booleanInputs = reactive<Record<string, 'true' | 'false'>>({})

const loading = reactive<Record<string, boolean>>({})

function debounce<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let t: number | undefined
  return ((...args: Parameters<T>) => {
    window.clearTimeout(t)
    t = window.setTimeout(() => fn(...args), ms)
  }) as T
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
    optionsMap[id] = raw

    const tableVal = f.col.getFilterValue()
    multiInputs[id] = Array.isArray(tableVal) ? (tableVal as unknown[]).map((v) => String(v)) : []

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
      col.setFilterValue(undefined)
    } else {
      col.setFilterValue(next)
    }
  }
}

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
    } else if (isBoolean(f.meta)) {
      booleanInputs[id] = current ? 'true' : 'false'
    }
  }
})

const setTextFilterDebounced = debounce((id: string, v: string) => {
  const col = filterableColumns.value.find((f) => f.col.id === id)?.col
  col?.setFilterValue(v)
}, 300)

function onDateChange(id: string, key: 'from' | 'to', value: string | null): void {
  const curr = dateInputs[id] ?? {}
  const fromStr = normDateStr(key === 'from' ? value : curr.from)
  let toStr = normDateStr(key === 'to' ? value : curr.to)

  if (fromStr && toStr && toStr < fromStr) {
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

function onBooleanChange(id: string, value: 'true' | 'false'): void {
  booleanInputs[id] = value
  const col = filterableColumns.value.find((f) => f.col.id === id)?.col
  if (!col) return
  col.setFilterValue(value === 'true')
}

function clearAll(): void {
  const next: ColumnFiltersState =
    props.initialColumnFilters && props.initialColumnFilters.length
      ? [...props.initialColumnFilters]
      : []
  props.table.setColumnFilters(next)
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
        multiInputs[id] = Array.isArray(val) ? (val as unknown[]).map((x) => String(x)) : []

        if ((optionsMap[id]?.length ?? 0) > 0) sanitizeMultiSelection(id)

        if (typeof f.meta.options === 'function') {
          await loadMultiOptions(f)
        }
      } else if (isBoolean(f.meta)) {
        booleanInputs[id] = val ? 'true' : 'false'
      }
    }
  },
  { deep: true },
)

function getBooleanOptions<T>(f: FilterableCol<T>): SelectOption[] {
  return [
    { label: f.meta.trueLabel ?? 'Sí', value: 'true' },
    { label: f.meta.falseLabel ?? 'No', value: 'false' },
  ]
}
</script>

<template>
  <section class="flex gap-4 px-4 items-center">
    <span class="min-w-max flex items-center">
      {{ $t('forms.results', table.getRowCount()) }}
    </span>
    <Separator orientation="vertical" class="max-h-6" />
    <span class="flex flex-1 justify-start items-center gap-3 pb-1 overflow-scroll">
      <template v-for="f in filterableColumns" :key="f.col.id">
        <!-- TEXT -->
        <div v-if="f.meta.type === 'text'" class="flex flex-col">
          <label class="text-xs font-medium mb-1">{{ getFilterLabel(f) }}</label>
          <input
            type="text"
            class="placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex h-9 w-80 min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
            :value="textInputs[f.col.id] ?? ''"
            :placeholder="`Filtrar ${getColumnTitle(f.col)}`"
            @input="(e) => setTextFilterDebounced(f.col.id, (e.target as HTMLInputElement).value)"
          />
        </div>

        <!-- DATE RANGE  -->
        <div v-else-if="f.meta.type === 'dateRange'" class="flex flex-col">
          <label class="text-xs font-medium mb-1">{{ getFilterLabel(f) }}</label>
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

        <!-- MULTI-SELECT -->
        <div v-else-if="f.meta.type === 'multiSelect'" class="flex flex-col min-w-[16rem]">
          <label class="text-xs font-medium mb-1">{{ getFilterLabel(f) }}</label>
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

        <!-- BOOLEAN -->
        <div v-else-if="f.meta.type === 'boolean'" class="flex flex-col min-w-[12rem]">
          <label class="text-xs font-medium mb-1">{{ getFilterLabel(f) }}</label>
          <ComboboxSelect
            :model-value="booleanInputs[f.col.id] ?? null"
            :options="getBooleanOptions(f)"
            :loading="false"
            :disabled="false"
            :clearable="false"
            :search-enabled="false"
            placeholder="Selecciona…"
            @update:model-value="(val) => onBooleanChange(f.col.id, val as 'true' | 'false')"
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
