import { ref, watch, type Ref } from 'vue'
import type { Row } from '@tanstack/vue-table'
import type { RowCommitReason, RowEditingEmit } from '@/features/datatable/types/row'
import type { WithId } from '@/shared/types/with-id'

type CellErrors<T> = Partial<Record<keyof T, unknown>>

export function useRowEditing<T extends WithId>(opts: {
  rows: () => ReadonlyArray<Row<T>>
  colCount: () => number
  isRowEditableBase?: (row: T) => boolean // default true
  emit: RowEditingEmit<T>
}) {
  const activeRowIndex: Ref<number> = ref(-1)
  const activeColIndex: Ref<number> = ref(-1)
  const isEditing: Ref<boolean> = ref(false)

  const rowDrafts = ref<Record<string, Partial<T>>>({})
  const rowPending = ref<Record<string, boolean>>({})
  const rowErrors = ref<Record<string, CellErrors<T>>>({})

  const rowIdAt = (i: number): string => (opts.rows()?.[i]?.id as string) ?? ''

  function rowIndexOf(original: T): number {
    const id = String(original.id)
    return opts.rows().findIndex((r) => r.id === id)
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

    // clear field-level error if exists
    const errs = rowErrors.value[id]
    if (errs && Object.prototype.hasOwnProperty.call(errs, colId)) {
      const nextErrs: Partial<Record<keyof T, unknown>> = { ...errs }
      delete nextErrs[colId]
      if (Object.keys(nextErrs).length) rowErrors.value[id] = nextErrs
      else {
        const copyAll = { ...rowErrors.value }
        delete copyAll[id]
        rowErrors.value = copyAll
      }
    }

    const orig = originalRow[colId]
    if (next === orig) {
      const draft = rowDrafts.value[id]
      if (!draft) return
      const nextDraft = { ...draft }
      delete nextDraft[colId]
      if (Object.keys(nextDraft).length) rowDrafts.value[id] = nextDraft
      else {
        const copyAll = { ...rowDrafts.value }
        delete copyAll[id]
        rowDrafts.value = copyAll
      }
    } else {
      rowDrafts.value = { ...rowDrafts.value, [id]: { ...rowDrafts.value[id], [colId]: next } }
    }
  }

  function getRowPatch(i: number): Partial<T> | null {
    const id = rowIdAt(i)
    if (!id) return null
    const patch = rowDrafts.value[id]
    return patch && Object.keys(patch).length ? patch : null
  }

  const isRowPendingAt = (i: number): boolean => {
    const id = rowIdAt(i)
    return !!(id && rowPending.value[id])
  }

  function isRowErrorAt(i: number): boolean {
    const id = rowIdAt(i)
    const e = rowErrors.value[id]
    return !!(e && Object.keys(e).length)
  }

  function isCellDirtyById(i: number, colId: keyof T): boolean {
    const id = rowIdAt(i)
    const draft = rowDrafts.value[id]
    return !!(draft && colId in draft)
  }

  function isCellErrorById(i: number, colId: keyof T): boolean {
    const id = rowIdAt(i)
    const e = rowErrors.value[id]
    return !!(id && e && e[colId] !== undefined)
  }

  function isRowEditableAt(i: number): boolean {
    const r = opts.rows()[i]
    if (!r) return false
    const base = opts.isRowEditableBase ? !!opts.isRowEditableBase(r.original as T) : true
    return base && !isRowPendingAt(i)
  }

  function deleteRow(i: number): boolean {
    const id = rowIdAt(i)
    if (!id) return false
    if (isRowPendingAt(i)) return false

    const original = opts.rows()[i]?.original as T | undefined
    if (!original) return false

    rowPending.value[id] = true
    delete rowErrors.value[id]

    const onSuccess = (): void => {
      delete rowPending.value[id]
      delete rowDrafts.value[id]
      delete rowErrors.value[id]
    }
    const onError = (): void => {
      delete rowPending.value[id]
    }

    opts.emit('row-delete', { rowIndex: i, rowId: original.id, full: original, onSuccess, onError })
    return true
  }

  function deleteRowPromise(i: number): Promise<void> {
    return new Promise<void>((resolve) => {
      const ok = deleteRow(i)
      if (!ok) return resolve()
      const id = rowIdAt(i)
      queueMicrotask(() => {
        if (!rowPending.value[id]) return resolve()
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

    const original = opts.rows()[i]?.original as T | undefined
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
        err && typeof err === 'object' && 'fields' in (err as Record<string, unknown>)
          ? ((err as Record<string, unknown>).fields as unknown as CellErrors<T>)
          : null

      if (perField) {
        rowErrors.value[id] = { ...rowErrors.value[id], ...perField }
      } else {
        const mark: CellErrors<T> = {}
        ;(Object.keys(patch) as Array<keyof T>).forEach((k) => (mark[k] = true))
        rowErrors.value[id] = { ...rowErrors.value[id], ...mark }
      }
    }

    opts.emit('row-commit', {
      rowIndex: i,
      rowId: original.id,
      patch,
      full,
      reason,
      onSuccess,
      onError,
    })
    return true
  }

  function commitRowPromise(i: number, reason: RowCommitReason): Promise<void> {
    return new Promise<void>((resolve) => {
      const ok = commitRow(i, reason)
      if (!ok) return resolve()
      const id = rowIdAt(i)
      queueMicrotask(() => {
        if (!rowPending.value[id]) return resolve()
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

  return {
    activeRowIndex,
    activeColIndex,
    isEditing,
    rowDrafts,
    rowPending,
    rowErrors,
    rowIndexOf,
    rowIdAt,
    getCellValue,
    setRowField,
    getRowPatch,
    isRowPendingAt,
    isRowErrorAt,
    isCellDirtyById,
    isCellErrorById,
    isRowEditableAt,
    commitRow,
    commitRowPromise,
    deleteRow,
    deleteRowPromise,
    discardRow,
  }
}
