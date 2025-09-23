import { computed, ref, type Ref } from 'vue'
import {
  useVueTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  type TableState,
  type Updater,
  type Row,
  type Column,
  type TableMeta,
} from '@tanstack/vue-table'
import type { WithId } from '@/shared/types/with-id'

export interface TableHandlers {
  onSortingChange: (u: Updater<SortingState>) => void
  onColumnFiltersChange: (u: Updater<ColumnFiltersState>) => void
  onColumnVisibilityChange: (u: Updater<VisibilityState>) => void
  onRowSelectionChange: (u: Updater<Record<string, boolean>>) => void
  onColumnOrderChange: (u: Updater<string[]>) => void
  onColumnSizingChange: (u: Updater<Record<string, number>>) => void
}

export function useTableCore<T extends WithId>(opts: {
  data: () => T[]
  columns: () => Array<ColumnDef<T>>
  meta: () => TableMeta<T>
  handlers: TableHandlers
}) {
  const sorting: Ref<SortingState> = ref<SortingState>([])
  const columnFilters: Ref<ColumnFiltersState> = ref<ColumnFiltersState>([])
  const columnVisibility: Ref<VisibilityState> = ref<VisibilityState>({})
  const rowSelection: Ref<Record<string, boolean>> = ref<Record<string, boolean>>({})
  const columnOrder: Ref<Array<string>> = ref<Array<string>>([])
  const columnSizing: Ref<Record<string, number>> = ref<Record<string, number>>({})

  const table = useVueTable<T>({
    get data() {
      return opts.data()
    },
    get columns() {
      return opts.columns()
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
    onSortingChange: opts.handlers.onSortingChange,
    onColumnFiltersChange: opts.handlers.onColumnFiltersChange,
    onColumnVisibilityChange: opts.handlers.onColumnVisibilityChange,
    onRowSelectionChange: opts.handlers.onRowSelectionChange,
    onColumnOrderChange: opts.handlers.onColumnOrderChange,
    onColumnSizingChange: opts.handlers.onColumnSizingChange,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    meta: opts.meta(),
  })

  const rows = computed<ReadonlyArray<Row<T>>>(() => table.getRowModel().rows)
  const visibleLeafColumns = computed<ReadonlyArray<Column<T>>>(() => table.getVisibleLeafColumns())
  const colCount = computed<number>(() => visibleLeafColumns.value.length)
  const rowCount = computed<number>(() => rows.value.length)

  const getTableState = (): TableState => table.getState() as TableState

  return {
    table,
    rows,
    visibleLeafColumns,
    colCount,
    rowCount,
    sorting,
    columnFilters,
    columnVisibility,
    rowSelection,
    columnOrder,
    columnSizing,
    getTableState,
  }
}
