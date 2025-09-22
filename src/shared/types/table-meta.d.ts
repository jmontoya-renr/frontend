// Asegúrate de que esto esté en un archivo .d.ts (por ejemplo, `table-types.d.ts`)
import { TableMeta } from '@tanstack/vue-table'
import { ColumnFilterMeta } from './table-filters'

type RowCommitReason = 'row-change' | 'edit-exit' | 'unmount'

// Extiende TableMeta sin sobrescribir la interfaz completa
declare module '@tanstack/vue-table' {
  interface TableMeta<TData> {
    isCellEditing?: (rowIndex: number, colIndex: number) => boolean
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
    isCellDirtyById?: (rowIndex: number, colId: keyof TData) => boolean
  }

  interface ColumnMeta<TData, TValue> {
    editable?: boolean
    createOnly?: boolean
    fixedFirst?: boolean
    filter?: ColumnFilterMeta
  }
}
