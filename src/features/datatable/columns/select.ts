import { h } from 'vue'
import { Checkbox } from '@/shared/components/ui/checkbox'
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

type SelectionArgs<T> = string | ({ title: string; meta?: ColumnMeta<T> } & BaseOpts) // full object

export function createSelectionColumn<T>(title: string): ColumnDef<T>
export function createSelectionColumn<T>(
  args: { title: string; meta?: ColumnMeta<T> } & BaseOpts,
): ColumnDef<T>
export function createSelectionColumn<T>(arg: SelectionArgs<T>): ColumnDef<T> {
  const isString = typeof arg === 'string'
  const title = isString ? arg : arg.title

  const {
    meta: passedMeta,
    id = '__select__',
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
  if (meta.fixedFirst === undefined) meta.fixedFirst = true

  const col: ColumnDef<T> = {
    id,
    meta,
    header: ({ table }) =>
      h(Checkbox, {
        modelValue:
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate'),
        'onUpdate:modelValue': (v) => table.toggleAllPageRowsSelected(!!v),
        ariaLabel: title,
        class: 'translate-y-0.5',
      }),
    cell: ({ row }) =>
      h(Checkbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (v) => row.toggleSelected(!!v),
        onClick: (e: MouseEvent) => e.stopPropagation(),
        onMousedown: (e: MouseEvent) => e.stopPropagation(),
        ariaLabel: `${title} row`,
        class: 'ml-2 translate-y-0.5',
      }),
  }

  if (enableSorting !== undefined) col.enableSorting = enableSorting
  if (enableHiding !== undefined) col.enableHiding = enableHiding
  if (enableResizing !== undefined) col.enableResizing = enableResizing
  if (size !== undefined) col.size = size
  if (minSize !== undefined) col.minSize = minSize
  if (maxSize !== undefined) col.maxSize = maxSize

  return col
}
