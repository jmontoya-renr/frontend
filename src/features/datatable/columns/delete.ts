import { h, type ComponentPublicInstance, type VNode } from 'vue'
import { Trash2 } from 'lucide-vue-next'
import type { ColumnDef, ColumnMeta } from '@tanstack/vue-table'

type BaseOpts = {
  id?: string
  enableSorting?: boolean
  enableHiding?: boolean
  enableResizing?: boolean
  size?: number
  minSize?: number
  maxSize?: number
}

type DeletionArgs<T> = string | ({ title: string; meta?: ColumnMeta<T> } & BaseOpts)

export function createDeletionColumn<T>(title: string): ColumnDef<T>
export function createDeletionColumn<T>(
  args: { title: string; meta?: ColumnMeta<T> } & BaseOpts,
): ColumnDef<T>
export function createDeletionColumn<T>(arg: DeletionArgs<T>): ColumnDef<T> {
  const isString = typeof arg === 'string'
  const title = isString ? arg : arg.title

  const {
    meta: passedMeta,
    id = '__delete__',
    enableSorting = false,
    enableHiding = false,
    enableResizing = false,
    size = 56,
    minSize = 56,
    maxSize = 56,
  } = (isString ? {} : arg) as { meta?: ColumnMeta<T> } & BaseOpts

  const meta: ColumnMeta<T> & { title: string } = {
    ...passedMeta,
    title,
  }
  if (meta.fixedLast === undefined) meta.fixedLast = true

  const col: ColumnDef<T> = {
    id,
    meta,

    header: () => h('span', { class: 'sr-only' }, title),

    cell: ({ row, column, table }) => {
      const perform = async () => {
        void table.options.meta?.deleteRowAtAsync?.(row.index)
      }

      const onClick = (e: MouseEvent) => {
        e.stopPropagation()
        perform()
      }

      const onKeydown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          e.stopPropagation()
          perform()
        }
      }

      // Si la fila no es editable, no mostramos botón
      if (
        table.options.meta &&
        table.options.meta.isRowEditable &&
        !table.options.meta.isRowEditable(row.original)
      ) {
        return
      }

      const isEditing =
        table.options.meta &&
        table.options.meta.isCellEditing &&
        table.options.meta.isCellEditing(row.index, column.getIndex())

      const focusDom = (el: Element | null): void => {
        if (!el || !isEditing) return
        requestAnimationFrame(() => {
          try {
            ;(el as HTMLButtonElement).focus({ preventScroll: true })
          } catch {}
        })
      }

      const setBtnRef = (el: Element | ComponentPublicInstance | null) => {
        focusDom(el as Element | null)
      }

      const onMountedHook = (v: VNode) => focusDom(v.el as Element | null)
      const onUpdatedHook = (v: VNode) => focusDom(v.el as Element | null)

      return h(
        'button',
        {
          type: 'button',
          title: `${title} fila`,
          'aria-label': `${title} fila`,
          class:
            'inline-flex items-center justify-center h-8 w-8 rounded-md ' +
            'text-destructive hover:bg-destructive/10 ' +
            'focus:outline-none focus:ring-2 focus:ring-destructive/40',
          onClick,
          onKeydown,
          onMousedown: (e: MouseEvent) => e.stopPropagation(),
          ref: setBtnRef,
          onVnodeMounted: onMountedHook,
          onVnodeUpdated: onUpdatedHook,
          autofocus: isEditing,
        },
        [h(Trash2, { class: 'size-4' })],
      )
    },
  }

  // Sin defaults: solo seteamos si vienen definidos
  if (enableSorting !== undefined) col.enableSorting = enableSorting
  if (enableHiding !== undefined) col.enableHiding = enableHiding
  if (enableResizing !== undefined) col.enableResizing = enableResizing
  if (size !== undefined) col.size = size
  if (minSize !== undefined) col.minSize = minSize
  if (maxSize !== undefined) col.maxSize = maxSize

  return col
}
