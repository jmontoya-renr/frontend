// useKeyboardNav.ts
import type { Ref } from 'vue'

function isInteractiveElement(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return !!el.closest("input,button,select,textarea,label,a,[role='checkbox'],[data-no-row-select]")
}
function isEditableTarget(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null
  return !!t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))
}

export function useKeyboardNav(opts: {
  rowsLen: () => number
  colCount: () => number
  isCellEditable: (i: number, j: number) => boolean
  focusCellByIndex: (r: number, c: number, o?: { select?: boolean; additive?: boolean }) => void
  focusFirstEditableInCell: (i: number, j: number) => void
  clearCellFocus: () => void

  activeRowIndex: Ref<number>
  activeColIndex: Ref<number>
  isEditing: Ref<boolean>

  commitRow: (i: number, reason: 'row-change' | 'edit-exit' | 'unmount') => boolean
  discardRow: (i: number) => void
}) {
  function enterEditMode(i: number, j: number) {
    if (i < 0 || j < 0) return
    if (opts.isEditing.value && i === opts.activeRowIndex.value && j === opts.activeColIndex.value)
      return
    if (!opts.isCellEditable(i, j)) return

    if (opts.activeRowIndex.value !== i || opts.activeColIndex.value !== j) {
      opts.focusCellByIndex(i, j, { select: true })
    }
    opts.isEditing.value = true
    queueMicrotask(() => opts.focusFirstEditableInCell(i, j))
  }

  function endEdit(commit: boolean, next?: { r: number; c: number }) {
    if (!opts.isEditing.value) return
    const currR = opts.activeRowIndex.value

    if (commit) {
      const leavingRow = !next || next.r !== currR
      if (leavingRow) {
        opts.commitRow(currR, next ? 'row-change' : 'edit-exit')
      }
    } else {
      opts.discardRow(currR)
    }

    opts.isEditing.value = false

    if (!next) {
      queueMicrotask(() => {
        const r = opts.activeRowIndex.value
        const c = opts.activeColIndex.value
        if (r >= 0 && c >= 0) opts.focusCellByIndex(r, c, { select: false })
      })
      return
    }

    const canEditNext = opts.isCellEditable(next.r, next.c)
    queueMicrotask(() => opts.focusCellByIndex(next.r, next.c, { select: true }))
    if (canEditNext) {
      opts.isEditing.value = true
      queueMicrotask(() => opts.focusFirstEditableInCell(next.r, next.c))
    }
  }

  function onKeydownCapture(e: KeyboardEvent) {
    if (!opts.isEditing.value) return
    const arrowOrScrollKey = [
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'PageUp',
      'PageDown',
      'Home',
      'End',
      ' ',
    ].includes(e.key)
    if (!arrowOrScrollKey) return
    if (isEditableTarget(e.target)) {
      e.stopPropagation()
      return
    }
    e.preventDefault()
    e.stopPropagation()
  }

  function onKeydown(e: KeyboardEvent) {
    const R = opts.rowsLen()
    const C = opts.colCount()
    const r = opts.activeRowIndex.value
    const c = opts.activeColIndex.value

    if (opts.isEditing.value) {
      if (e.key === 'Escape') {
        e.preventDefault()
        endEdit(false)
        return
      }
      if (e.key === 'Enter') {
        if (r < 0) return
        e.preventDefault()
        const nextR = e.shiftKey ? Math.max(0, r - 1) : Math.min(R - 1, r + 1)
        endEdit(true, { r: nextR, c })
        return
      }
      if (e.key === 'Tab') {
        if (r < 0 || c < 0) return
        e.preventDefault()
        const nextR =
          !e.shiftKey && c === C - 1
            ? Math.min(R - 1, r + 1)
            : e.shiftKey && c === 0
              ? Math.max(0, r - 1)
              : r
        const nextC = e.shiftKey ? (c > 0 ? c - 1 : C - 1) : c < C - 1 ? c + 1 : 0
        endEdit(true, { r: nextR, c: nextC })
        return
      }
      return
    }

    if (!R || !C) return

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        opts.clearCellFocus()
        break
      case 'j':
      case 'ArrowDown':
        e.preventDefault()
        opts.focusCellByIndex(r < 0 ? 0 : r + 1, c < 0 ? 0 : c)
        break
      case 'k':
      case 'ArrowUp':
        e.preventDefault()
        opts.focusCellByIndex(r <= 0 ? 0 : r - 1, c < 0 ? 0 : c)
        break
      case 'l':
      case 'ArrowRight':
        e.preventDefault()
        opts.focusCellByIndex(r < 0 ? 0 : r, c < 0 ? 0 : c + 1)
        break
      case 'h':
      case 'ArrowLeft':
        e.preventDefault()
        opts.focusCellByIndex(r < 0 ? 0 : r, c <= 0 ? 0 : c - 1)
        break
      case 'Enter':
        if (r < 0 || c < 0) return
        e.preventDefault()
        enterEditMode(r, c)
        break
      case 'Tab': {
        if (r < 0 || c < 0) return
        const atLast = r === R - 1 && c === C - 1
        const atFirst = r === 0 && c === 0
        if (e.shiftKey) {
          if (atFirst) return
          e.preventDefault()
          if (c > 0) opts.focusCellByIndex(r, c - 1)
          else opts.focusCellByIndex(r - 1, C - 1)
        } else {
          if (atLast) return
          e.preventDefault()
          if (c < C - 1) opts.focusCellByIndex(r, c + 1)
          else opts.focusCellByIndex(r + 1, 0)
        }
        break
      }
      case 'Home':
        e.preventDefault()
        if (e.ctrlKey || e.metaKey) opts.focusCellByIndex(0, 0)
        else opts.focusCellByIndex(r < 0 ? 0 : r, 0)
        break
      case 'End':
        e.preventDefault()
        if (e.ctrlKey || e.metaKey) opts.focusCellByIndex(R - 1, C - 1)
        else opts.focusCellByIndex(r < 0 ? 0 : r, C - 1)
        break
      case 'PageDown':
        e.preventDefault()
        opts.focusCellByIndex(r < 0 ? 0 : r + 10, c < 0 ? 0 : c)
        break
      case 'PageUp':
        e.preventDefault()
        opts.focusCellByIndex(r < 0 ? 0 : r - 10, c < 0 ? 0 : c)
        break
      case ' ':
        if (r < 0 || c < 0) {
          opts.focusCellByIndex(0, 0, { select: false })
          e.preventDefault()
        }
        break
      default:
        break
    }
  }

  function onCellClick(i: number, j: number, e: MouseEvent) {
    if (isInteractiveElement(e.target)) {
      opts.activeRowIndex.value = i
      opts.activeColIndex.value = j
      return
    }
    const isSameCell = i === opts.activeRowIndex.value && j === opts.activeColIndex.value

    if (isSameCell) {
      if (opts.isEditing.value) return
      if (opts.isCellEditable(i, j)) enterEditMode(i, j)
      else opts.focusCellByIndex(i, j, { select: true })
      return
    }

    if (opts.isEditing.value) {
      endEdit(true, { r: i, c: j })
      return
    }
    opts.focusCellByIndex(i, j)
  }

  function onCellDblClick(i: number, j: number) {
    if (opts.isCellEditable(i, j)) enterEditMode(i, j)
  }

  return { onKeydown, onKeydownCapture, onCellClick, onCellDblClick, enterEditMode, endEdit }
}
