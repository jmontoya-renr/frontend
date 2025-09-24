import { TableMeta } from '@tanstack/vue-table'
import type { RowCommitReason } from '@/features/datatable/types/row'
import { ColumnFilterMeta } from '@/features/datatable/types/table-filters'

declare module '@tanstack/vue-table' {
  interface TableMeta<TData> {
    isRowEditable?: (row: TData) => boolean
    isCellEditing?: (rowIndex: number, colIndex: number) => boolean
    isCellDirtyById?: (rowIndex: number, colId: keyof TData) => boolean
    getCellValue?: <K extends keyof TData>(
      rowIndex: number,
      colId: K,
      originalRow: TData,
    ) => TData[K]
    setRowField?: <K extends keyof TData>(
      rowIndex: number,
      colId: K,
      value: TData[K],
      originalRow: TData,
    ) => void
    commitRowAt?: (rowIndex: number, reason: RowCommitReason = 'row-change') => boolean
    commitRowAtAsync?: (rowIndex: number, reason: RowCommitReason = 'row-change') => Promise<void>
    commitOriginalAsync?: (original: TData, reason: RowCommitReason = 'row-change') => Promise<void>
    deleteRowAt?: (rowIndex: number) => boolean
    deleteRowAtAsync?: (rowIndex: number) => Promise<void>
    deleteOriginalAsync?: (original: TData) => Promise<void>
  }

  interface ColumnMeta<TData, TValue = unknown> {
    editable?: boolean
    createOnly?: boolean
    fixedFirst?: boolean
    fixedLast?: boolean
    filter?: ColumnFilterMeta
  }
}
