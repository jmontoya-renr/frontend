import type { Table, Column } from '@tanstack/vue-table'

export type FilterType = 'text' | 'dateRange' | 'multiSelect'

export interface Option {
  label: string
  value: string
}

export interface TextFilterMeta {
  type: 'text'
  param?: string
}

export interface DateRangeFilterMeta {
  type: 'dateRange'
  serverKeys: { from: string; to: string }
}

export interface OptionsLoaderCtx<TData = unknown> {
  table: Table<TData>
  column: Column<TData, unknown>
  /** Current value of another column's filter (raw TanStack value) */
  getColumnFilterValue: (columnId: string) => unknown
}

export type OptionsSource<TData = unknown> =
  | Option[]
  | ((ctx: OptionsLoaderCtx<TData>) => Option[] | Promise<Option[]>)

export interface MultiSelectFilterMeta<TData = unknown> {
  type: 'multiSelect'
  param: string
  options: OptionsSource<TData>
}

export type ColumnFilterMeta = TextFilterMeta | DateRangeFilterMeta | MultiSelectFilterMeta

export interface DateRangeValue {
  from?: string
  to?: string
}
