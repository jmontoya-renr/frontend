import type { Table, Column } from '@tanstack/vue-table'

export type FilterType = 'text' | 'dateRange' | 'multiSelect'

export interface Option {
  label: string
  value: string
}

export interface FilterMetaCommon {
  label?: string
  order?: number
}

export interface TextFilterMeta extends FilterMetaCommon {
  type: 'text'
  param?: string
}

export interface DateRangeFilterMeta extends FilterMetaCommon {
  type: 'dateRange'
  serverKeys: { from: string; to: string }
}

export interface OptionsLoaderCtx<TData> {
  table: Table<TData>
  column: Column<TData>
  getColumnFilterValue: (columnId: string) => unknown
}

export type OptionsSource<TData> =
  | Option[]
  | ((ctx: OptionsLoaderCtx<TData>) => Option[] | Promise<Option[]>)

export interface MultiSelectFilterMeta<TData> extends FilterMetaCommon {
  type: 'multiSelect'
  param: string
  options: OptionsSource<TData>
}

export interface BooleanFilterMeta extends FilterMetaCommon {
  type: 'boolean'
  param?: string
  trueLabel?: string // UI label for "true"
  falseLabel?: string // UI label for "false"
}

export type ColumnFilterMeta =
  | TextFilterMeta
  | DateRangeFilterMeta
  | MultiSelectFilterMeta
  | BooleanFilterMeta
  | undefined

export interface DateRangeValue {
  from?: string
  to?: string
}
