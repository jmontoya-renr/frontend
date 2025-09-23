import type { ColumnDef } from '@tanstack/vue-table'

export type RowCommitReason = 'row-change' | 'edit-exit' | 'row-add' | 'unmount'

export interface RowCommitPayload<T extends WithId> {
  rowIndex: number
  rowId: string | number
  patch: Partial<T>
  full: T
  reason: RowCommitReason
  onSuccess: () => void
  onError: (err?: unknown) => void
}

export interface RowDeletePayload<T extends WithId> {
  rowIndex: number
  rowId: string | number
  full: T
  onSuccess: () => void
  onError: (err?: unknown) => void
}

export interface RowEditingEmit<T extends WithId> {
  (e: 'row-commit', payload: RowCommitPayload<T>): void
  (e: 'row-delete', payload: RowDeletePayload<T>): void
}

/** Vue emit function for server sync */
export interface ServerSyncEmit {
  (e: 'server-sort', payload: { sort_by: string; sort_order: 'asc' | 'desc' } | null): void
  (e: 'server-filters', payload: Record<string, string[]>): void
}

/** Handy alias to avoid repeating the generic in many places */
export type ColumnDefs<T extends WithId> = Array<ColumnDef<T>>
