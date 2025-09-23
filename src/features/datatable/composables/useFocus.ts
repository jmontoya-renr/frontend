import { nextTick, ref, type Ref } from 'vue'
import type { Row } from '@tanstack/vue-table'

export function useFocus<T>(opts: {
  rows: () => ReadonlyArray<Row<T>>
  colCount: () => number
  rowSelection: Ref<Record<string, boolean>>
  activeRowIndex: Ref<number>
  activeColIndex: Ref<number>
  scrollToIndex: (index: number, o?: { align?: 'auto' | 'center' | 'end' | 'start' }) => void
}) {
  const cellEls = ref<Record<string, HTMLTableCellElement | null>>({})
  const rowEls = ref<Record<string, HTMLTableRowElement | null>>({})
  const setRowRef = (id: string, el: HTMLTableRowElement | null) => (rowEls.value[id] = el)
  const setCellRef = (id: string, el: HTMLTableCellElement | null) => (cellEls.value[id] = el)

  const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n))

  function focusCellByIndex(
    r: number,
    c: number,
    optsFocus: { select?: boolean; additive?: boolean } = { select: true, additive: false },
  ) {
    const R = opts.rows().length
    const C = opts.colCount()
    if (!R || !C) return
    const ri = clamp(r, 0, R - 1)
    const ci = clamp(c, 0, C - 1)
    opts.activeRowIndex.value = ri
    opts.activeColIndex.value = ci

    const row = opts.rows()[ri]
    const cell = row.getVisibleCells()[ci]

    if (optsFocus.select) {
      opts.rowSelection.value = optsFocus.additive
        ? { ...opts.rowSelection.value, [row.id]: true }
        : { [row.id]: true }
    }

    nextTick(() => {
      opts.scrollToIndex(ri, { align: 'auto' })
      nextTick(() => {
        const td = cellEls.value[cell.id]
        if (!td) return
        td.focus({ preventScroll: true })
        td.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      })
    })
  }

  function clearCellFocus() {
    opts.activeRowIndex.value = -1
    opts.activeColIndex.value = -1
  }

  function ensureCursorOnEditableRow(isRowEditableAt: (i: number) => boolean) {
    const R = opts.rows().length
    const C = opts.colCount()
    if (R === 0 || C === 0) {
      clearCellFocus()
      return
    }
    const ri = opts.activeRowIndex.value < 0 ? 0 : opts.activeRowIndex.value
    const ci = opts.activeColIndex.value < 0 ? 0 : opts.activeColIndex.value
    opts.activeRowIndex.value = clamp(ri, 0, R - 1)
    opts.activeColIndex.value = clamp(ci, 0, C - 1)

    if (!isRowEditableAt(opts.activeRowIndex.value)) {
      nextTick(() =>
        focusCellByIndex(opts.activeRowIndex.value, opts.activeColIndex.value, { select: false }),
      )
    }
  }

  function focusFirstEditableInCell(i: number, j: number) {
    const row = opts.rows()[i]
    const td = cellEls.value[row.getVisibleCells()[j].id]
    if (!td) return
    const sel =
      'input, textarea, [contenteditable="true"], select, button, [tabindex]:not([tabindex="-1"])'
    const el = td.querySelector<HTMLElement>(sel)
    if (!el) return
    nextTick(() => {
      el.focus({ preventScroll: true })
    })
  }

  return {
    cellEls,
    rowEls,
    setRowRef,
    setCellRef,
    focusCellByIndex,
    clearCellFocus,
    ensureCursorOnEditableRow,
    focusFirstEditableInCell,
  }
}
