<script setup lang="ts" generic="T extends WithId">
import type { Column, Table } from '@tanstack/vue-table'
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

import ComboboxSelect, { type SelectOption } from '@/shared/components/ComboboxSelect.vue'
import DatePickerPopover from '@/shared/components/DatePickerPopover.vue'

interface DataTableToolbarProps {
  table: Table<T>
}

const props = defineProps<DataTableToolbarProps>()

const isFiltered = computed(() => props.table.getState().columnFilters.length > 0)

/* -------------------- Type guards -------------------- */
const isText = (m: ColumnFilterMeta): m is TextFilterMeta => m.type === 'text'
const isDateRange = (m: ColumnFilterMeta): m is DateRangeFilterMeta => m.type === 'dateRange'
const isMulti = (m: ColumnFilterMeta): m is MultiSelectFilterMeta => m.type === 'multiSelect'

interface FilterableCol<TData = unknown> {
  col: Column<TData, unknown>
  meta: ColumnFilterMeta
}

/* -------------------- Title extraction -------------------- */
/** Get a human-readable title for a column:
 *  - If header is string → use it
 *  - If header is function that returns <DataTableColumnHeader :title="..."> → read vnode.props.title
 *  - Fallback to column id
 */
function getColumnTitle<TData>(col: Column<TData, unknown>): string {
  const header = col.columnDef.header

  // header as a plain string
  if (typeof header === 'string') return header

  // header as a function returning a VNode (like h(DataTableColumnHeader, { title: '...' }))
  if (typeof header === 'function') {
    try {
      // TanStack passes { column, table } habitualmente; con 'vue-table' al menos 'column'
      const vnode = (header as (ctx: { column: Column<TData, unknown> }) => VNode)({ column: col })
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
const filterableColumns = computed<FilterableCol[]>(() =>
  props.table
    .getAllLeafColumns()
    .map((c) => {
      const meta = c.columnDef.meta?.filter
      return meta ? ({ col: c, meta } as FilterableCol) : null
    })
    .filter((x): x is FilterableCol => x !== null),
)

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
  return arr.map((o) => ({ label: o.label, value: o.value }))
}

function getColumnFilterValue(columnId: string): unknown {
  const found = props.table.getState().columnFilters.find((f) => f.id === columnId)
  return found?.value
}

function ensureOptionArray<TData>(
  src: OptionsSource<TData>,
  ctx: OptionsLoaderCtx<TData>,
): Promise<Option[]> {
  if (typeof src === 'function') {
    return Promise.resolve(src(ctx))
  }
  return Promise.resolve(src)
}

async function loadMultiOptions<TData>(f: FilterableCol<TData>): Promise<void> {
  const id = f.col.id
  if (!isMulti(f.meta)) return
  loading[id] = true
  try {
    const ctx: OptionsLoaderCtx<TData> = {
      table: props.table,
      column: f.col as Column<TData, unknown>,
      getColumnFilterValue,
    }
    const raw = await ensureOptionArray<TData>(f.meta.options as OptionsSource<TData>, ctx)
    optionsMap[id] = toSelectOptions(raw)
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
    col?.setFilterValue(next)
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
  const next: DateRangeValue = { ...curr, [key]: value ?? undefined }
  dateInputs[id] = next
  const col = filterableColumns.value.find((f) => f.col.id === id)?.col
  col?.setFilterValue(next)
}

function onMultiChange(id: string, values: string[]): void {
  multiInputs[id] = values
  const col = filterableColumns.value.find((f) => f.col.id === id)?.col
  col?.setFilterValue(values)
}

function clearAll(): void {
  props.table.resetColumnFilters()
  for (const f of filterableColumns.value) {
    const id = f.col.id
    if (isText(f.meta)) textInputs[id] = ''
    if (isDateRange(f.meta)) dateInputs[id] = { from: undefined, to: undefined }
    if (isMulti(f.meta)) multiInputs[id] = []
  }
}

watch(
  () => props.table.getState().columnFilters,
  async () => {
    for (const f of filterableColumns.value) {
      if (isMulti(f.meta) && typeof f.meta.options === 'function') {
        await loadMultiOptions(f)
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
              @update:model-value="(v: string | null) => onDateChange(f.col.id, 'from', v)"
            />
            <span>-</span>
            <DatePickerPopover
              :model-value="dateInputs[f.col.id]?.to ?? null"
              placeholder-text="Hasta…"
              :no-clear="false"
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
    <template v-if="isFiltered">
      <Separator orientation="vertical" class="max-h-6" />
      <Button variant="ghost" class="h-8 px-2 lg:px-3" @click="clearAll">
        Reset filters
        <X class="ml-2 h-4 w-4" />
      </Button>
    </template>
  </section>
</template>
