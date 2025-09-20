import type { ColumnDef } from '@tanstack/vue-table'
import type { Task } from '../data/schema'

import { h, nextTick, vShow, withDirectives } from 'vue'
import { Badge } from '@/shared/components/ui/badge'
import { labels, priorities, statuses } from '../data/data'
import DataTableColumnHeader from './DataTableColumnHeader.vue'

export const columns: ColumnDef<Task>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Task' }),
    cell: ({ row }) => h('div', { class: 'w-20' }, row.getValue('id')),
    enableSorting: false,
    enableHiding: false,
    size: 200,
    minSize: 100,
    maxSize: 330,
    meta: { editable: false },
  },
  {
    accessorKey: 'badge',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Badge' }),

    cell: ({ row }) => {
      const label = labels.find((label) => label.value === row.original.label)

      return h(Badge, { variant: 'outline' }, () => label?.label ?? '')
    },
    maxSize: 250,
    size: 200,
    minSize: 100,
  },
  {
    accessorKey: 'title',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Title' }),
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false

      // Obtener el valor de la celda (ya sea desde el draft o el valor original)
      const value: Task['title'] =
        table.options.meta?.getCellValue?.(row.index, 'title', row.original) ?? row.original.title

      const input = h('input', {
        class: 'w-full p-0 bg-transparent outline-none border-0 m-0 min-w-0',
        type: 'text',
        value,
        onInput: (e: Event) =>
          table.options.meta?.setRowField?.(
            row.index,
            'title',
            (e.target as HTMLInputElement).value,
            row.original,
          ),
        onFocus: (e: FocusEvent) => {
          nextTick(() => {
            const t = e.target as HTMLInputElement
            t.focus()
            t.setSelectionRange(0, value.length)
          })
        },
      })

      const view = h('p', { class: 'font-medium min-w-0 truncate max-w-full' }, value ?? '')

      return [
        withDirectives(input, [[vShow, isEditing]]),
        withDirectives(view, [[vShow, !isEditing]]),
      ]
    },
    minSize: 400,
    size: 800,
  },
  {
    accessorKey: 'status',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Status' }),
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false

      const values: Record<string, string> = {
        backlog: 'Backlog',
        todo: 'Todo',
        inprogress: 'In Progress',
        done: 'Done',
        canceled: 'Canceled',
      }

      // Obtener el valor de la celda (ya sea desde el draft o el valor original)
      const value: Task['status'] =
        table.options.meta?.getCellValue?.(row.index, 'status', row.original) ?? row.original.status

      const input = h(
        'select',
        { column, title: 'Status' },
        Object.keys(values).map((k) => h('option', { value: k }, values[k])),
      )

      const view = h(
        'p',
        { class: 'font-medium min-w-0 truncate max-w-full' },
        values[value] ?? value ?? '',
      )

      return [
        withDirectives(input, [[vShow, isEditing]]),
        withDirectives(view, [[vShow, !isEditing]]),
      ]
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
    minSize: 100,
    size: 150,
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Priority' }),
    cell: ({ row }) => {
      const priority = priorities.find((priority) => priority.value === row.getValue('priority'))

      if (!priority) return null

      return h('div', { class: 'flex items-center' }, [
        priority.icon && h(priority.icon, { class: 'mr-2 h-4 w-4 text-muted-foreground' }),
        h('span', {}, priority.label),
      ])
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },

    minSize: 100,
    size: 150,
  },
]
