import type { Column, ColumnDef } from '@tanstack/vue-table'
import { h, nextTick, vShow, withDirectives, type ComponentPublicInstance, type VNode } from 'vue'
import type { Paginacion } from '@/features/paginacion/paginacion'
import DataTableColumnHeader from '@/shared/components/table/DataTableColumnHeader.vue'

import ComboboxSelect, { type SelectOption } from '@/shared/components/ComboboxSelect.vue'
import DatePickerPopover from '@/shared/components/DatePickerPopover.vue'

import { today, getLocalTimeZone, CalendarDate } from '@internationalized/date'

import { useEmpresasCatalog, useProductosCatalog } from './catalogs'
import { Checkbox } from '@/shared/components/ui/checkbox'
import type { WithId } from '@/shared/types/with-id'
import { Trash2 } from 'lucide-vue-next'

const {
  loaded: empLoaded,
  loading: empLoading,
  ensureLoaded: ensureEmpresasLoaded,
  options: empresaOptions,
  editableOptions: empresaEditableOptions,
  byCodigo: empresaByCodigo,
} = useEmpresasCatalog()

const {
  loaded: prodLoaded,
  loading: prodLoading,
  ensureLoaded: ensureProductosLoaded,
  options: prodOptions,
  optionsByEmpresa: productOptionsByEmpresa,
  labelsByKey: productLabelByKey,
} = useProductosCatalog()

void ensureProductosLoaded()
void ensureEmpresasLoaded()

function focusAllText(e: FocusEvent, value: string) {
  // Focus + safe select-all for text-like inputs only
  nextTick(() => {
    const el = e.target as HTMLElement | null
    if (!el) return
    if (!el.isConnected) return // element got unmounted/replaced

    try {
      el.focus({ preventScroll: true })
    } catch {
      // ignore focus errors (rare)
    }

    const input = el as HTMLInputElement | HTMLTextAreaElement

    // Only select on text-like controls; NEVER on <input type="number">
    const isTextArea = input instanceof HTMLTextAreaElement
    const isTextInput =
      input instanceof HTMLInputElement &&
      ['text', 'search', 'tel', 'url', 'password'].includes(input.type)

    if ((isTextArea || isTextInput) && typeof input.setSelectionRange === 'function') {
      try {
        input.setSelectionRange(0, value.length)
      } catch {
        // Some browsers can still throw if the control isn't ready; ignore gracefully
      }
    }
  })
}

type BoundsOpts = {
  min?: number
  max?: number
  integer?: boolean
  allowEmpty?: boolean
  decimals?: number // ⬅️ NUEVO: nº de decimales cuando integer=false
}

function bindNumberBounds(opts: BoundsOpts, onValue: (n: number) => void) {
  const integer = opts.integer ?? true
  const decs = !integer && typeof opts.decimals === 'number' ? Math.max(0, opts.decimals) : null

  function clamp(n: number): number {
    if (!Number.isFinite(n)) n = opts.min ?? 0
    if (opts.min !== undefined && n < opts.min) n = opts.min
    if (opts.max !== undefined && n > opts.max) n = opts.max
    if (integer) return Math.trunc(n)
    if (decs != null) {
      const f = 10 ** decs
      return Math.round(n * f) / f
    }
    return n
  }

  function normalizeAndCommit(el: HTMLInputElement) {
    if (opts.allowEmpty && el.value === '') return
    // soporta coma decimal
    let raw = el.value.replace(',', '.')
    if (raw === '.' || raw === '-.' || raw === '-,') raw = '0.'
    let n = Number(raw)
    n = clamp(n)
    const next = String(n)
    if (el.value !== next) el.value = next
    onValue(n)
  }

  return {
    onKeydown(e: KeyboardEvent) {
      // bloquea notación científica y + siempre
      if (['e', 'E', '+'].includes(e.key)) e.preventDefault()
      // si min >= 0, bloquea '-'
      if ((opts.min ?? -Infinity) >= 0 && e.key === '-') e.preventDefault()
      // el punto solo se bloquea si pedimos enteros
      if (integer && e.key === '.') e.preventDefault()
    },
    onInput(e: Event) {
      const el = e.target as HTMLInputElement
      normalizeAndCommit(el)
    },
    onPaste(_e: ClipboardEvent) {
      /* normalizamos en onInput */
    },
    onBlur(e: FocusEvent) {
      const el = e.target as HTMLInputElement
      normalizeAndCommit(el)
    },
  }
}

function formatFechaEs(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return String(value)
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
}

export const columns: Array<ColumnDef<Paginacion>> = [
  {
    id: 'select',
    header: ({ table }) =>
      h(Checkbox, {
        modelValue:
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate'),
        'onUpdate:modelValue': (value) => table.toggleAllPageRowsSelected(!!value),
        ariaLabel: 'Select all',
        class: 'translate-y-0.5',
      }),
    cell: ({ row }) =>
      h(Checkbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value) => row.toggleSelected(!!value),
        onClick: (e: MouseEvent) => e.stopPropagation(),
        onMousedown: (e: MouseEvent) => e.stopPropagation(),
        ariaLabel: 'Select row',
        class: 'ml-2 translate-y-0.5',
      }),
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    size: 60,
    minSize: 60,
    maxSize: 60,
    meta: {
      fixedFirst: true,
    },
  },
  /* === EMPRESA (select al editar) === */
  {
    accessorKey: 'empresa',
    header: ({ column }) => {
      if (!empLoaded.value && !empLoading.value) void ensureEmpresasLoaded()
      return h(DataTableColumnHeader, {
        column: column as unknown as Column<WithId>,
        title: 'Sociedad',
        options: empresaEditableOptions.value,
      })
    },
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false
      const value =
        table.options.meta?.getCellValue?.(row.index, 'empresa', row.original) ??
        (row.getValue('empresa') as string | null)

      // texto de vista
      const friendly = empresaByCodigo.value.get(String(value ?? ''))?.nombre ?? value ?? ''

      const createOnly = column.columnDef.meta?.createOnly === true
      if (createOnly && !isEditing) return h('p', { class: 'truncate' }, friendly)

      const opts: ReadonlyArray<SelectOption> = empresaEditableOptions.value
      const disabled = opts.length === 0 || empLoading.value

      return h(ComboboxSelect, {
        modelValue: value,
        options: opts,
        placeholder: 'Selecciona sociedad…',
        disabled,
        loading: empLoading.value,
        clearable: false,
        // al cambiar la empresa, invalidamos producto si no coincide
        'onUpdate:modelValue': (next) => {
          const nextEmpresa = next ?? ''
          table.options.meta?.setRowField?.(
            row.index,
            'empresa',
            nextEmpresa as string,
            row.original,
          )

          const currentProd =
            table.options.meta?.getCellValue?.(row.index, 'producto', row.original) ??
            (row.getValue('producto') as string | null) ??
            ''

          const valid = (productOptionsByEmpresa.value.get(nextEmpresa as string) ?? []).some(
            (o) => o.value === currentProd,
          )

          if (!valid) {
            table.options.meta?.setRowField?.(
              row.index,
              'producto',
              '' as Paginacion['producto'],
              row.original,
            )
          }
        },
      })
    },
    minSize: 200,
    size: 200,
    meta: {
      editable: false,
      createOnly: true,
      filter: {
        type: 'multiSelect',
        param: 'empresas',
        options: async () => {
          // Espera a que el catálogo esté listo
          if (!empLoaded.value) await ensureEmpresasLoaded()
          // Devuelve un array nuevo con la forma esperada por la toolbar
          return empresaOptions.value.map((o) => ({ label: o.label, value: o.value }))
        },
      },
    },
  },
  {
    accessorKey: 'producto',
    header: ({ column }) => {
      // carga perezosa (una vez)
      if (!prodLoaded.value && !prodLoading.value) void ensureProductosLoaded()
      return h(DataTableColumnHeader, {
        column: column as unknown as Column<WithId>,
        title: 'Producto',
        // Puedes pasar todas las opciones (para filtros), o dejarlo vacío.
        // options: [...new Set(prodList.value.map(p => ({label: p.nombre, value: p.codigo})))],
      })
    },

    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false

      const value: string | null =
        table.options.meta?.getCellValue?.(row.index, 'producto', row.original) ??
        (row.getValue('producto') as string | null) ??
        null

      const empresaCode: string | null =
        table.options.meta?.getCellValue?.(row.index, 'empresa', row.original) ??
        (row.getValue('empresa') as string | null) ??
        null

      const options: ReadonlyArray<SelectOption> = empresaCode
        ? (productOptionsByEmpresa.value.get(empresaCode) ?? [])
        : []

      const friendly =
        (empresaCode && value
          ? productLabelByKey.value.get(`${empresaCode}::${value}`)
          : undefined) ??
        value ??
        ''

      const createOnly = !!column.columnDef.meta?.createOnly
      const canEditHere = !createOnly && isEditing
      if (!canEditHere) return h('p', { class: 'truncate' }, friendly)

      const disabled = !empresaCode || prodLoading.value

      return h(ComboboxSelect, {
        modelValue: value,
        options,
        placeholder: empresaCode ? 'Selecciona producto…' : 'Seleccione sociedad…',
        disabled,
        loading: prodLoading.value,
        clearable: false,
        'onUpdate:modelValue': (next) => {
          table.options.meta?.setRowField?.(
            row.index,
            'producto',
            (next ?? '') as Paginacion['producto'],
            row.original,
          )
        },
      })
    },
    minSize: 200,
    size: 200,
    // Editable SOLO en creación de fila:
    meta: {
      editable: false,
      createOnly: true,
      filter: {
        type: 'multiSelect',
        param: 'productos',
        options: async (ctx) => {
          // Ensure catalog is ready
          if (!prodLoaded.value) await ensureProductosLoaded()

          // Read current selection of "empresa" from toolbar filters
          const raw = ctx.getColumnFilterValue('empresa')
          const selectedEmpresas: string[] = Array.isArray(raw)
            ? (raw as string[])
            : raw
              ? [String(raw)]
              : []

          // If no companies selected, return ALL products
          if (selectedEmpresas.length === 0) {
            // prodOptions.value is already [{label, value}]
            // Return a fresh array to avoid reactive mutations downstream
            return prodOptions.value.map((o) => ({ label: o.label, value: o.value }))
          }

          // Otherwise: union of products belonging to the selected companies
          const seen = new Set<string>()
          const out: Array<{ label: string; value: string }> = []

          for (const emp of selectedEmpresas) {
            const opts = productOptionsByEmpresa.value.get(emp) ?? []
            for (const o of opts) {
              if (!seen.has(o.value)) {
                seen.add(o.value)
                out.push({ label: o.label, value: o.value })
              }
            }
          }

          // Optional: sort by label (Spanish locale)
          out.sort((a, b) => a.label.localeCompare(b.label, 'es'))

          return out
        },
      },
    },
  },
  /* === FECHA (vista larga, input date al editar) === */
  {
    accessorKey: 'fecha',
    header: ({ column }) =>
      h(DataTableColumnHeader, { column: column as unknown as Column<WithId>, title: 'Fecha' }),
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false
      const value = (table.options.meta?.getCellValue?.(row.index, 'fecha', row.original) ??
        (row.getValue('fecha') as Paginacion['fecha'])) as string | null

      // Vista "bonita" cuando NO se edita
      if (!isEditing) {
        return h('p', { class: 'truncate' }, formatFechaEs(value ?? null))
      }

      // Edición con botón + calendario
      return h(DatePickerPopover, {
        modelValue: value,
        noClear: true,
        minValue: new CalendarDate(1900, 1, 1),
        maxValue: today(getLocalTimeZone()),
        buttonClass: 'w-full justify-start',
        placeholderText: 'Selecciona fecha',
        'onUpdate:modelValue': (next: string | null) => {
          table.options.meta?.setRowField?.(
            row.index,
            'fecha',
            (next ?? '') as Paginacion['fecha'],
            row.original,
          )
        },
      })
    },
    minSize: 170,
    size: 200,
    maxSize: 230,
    meta: {
      editable: false,
      createOnly: true,
      filter: { type: 'dateRange', serverKeys: { from: 'fecha_inicio', to: 'fecha_fin' } },
    },
  },
  /* === num_paginas (input number al editar) === */
  {
    accessorKey: 'num_paginas',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as unknown as Column<WithId>,
        title: 'Número de páginas',
      }),
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false
      const value = (table.options.meta?.getCellValue?.(row.index, 'num_paginas', row.original) ??
        row.getValue('num_paginas')) as number | string | null

      const handlers = bindNumberBounds({ min: 0, integer: true }, (n) =>
        table.options.meta?.setRowField?.(
          row.index,
          'num_paginas',
          n as Paginacion['num_paginas'],
          row.original,
        ),
      )

      const input = h('input', {
        class: 'w-full bg-transparent outline-none border-0 m-0 min-w-0',
        type: 'number',
        step: '1',
        min: '0',
        inputmode: 'numeric',
        value: value ?? '',
        ...handlers,
        onFocus: (e: FocusEvent) => focusAllText(e, String(value ?? '')),
      })

      const view = h('p', { class: 'truncate' }, String(value ?? ''))
      return [
        withDirectives(input, [[vShow, isEditing]]),
        withDirectives(view, [[vShow, !isEditing]]),
      ]
    },
    minSize: 180,
    size: 200,
    maxSize: 220,
    meta: { editable: true },
  },
  {
    accessorKey: 'num_clasificados',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as unknown as Column<WithId>,
        title: 'Número de clasificados',
      }),
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false
      const value = (table.options.meta?.getCellValue?.(
        row.index,
        'num_clasificados',
        row.original,
      ) ?? row.getValue('num_clasificados')) as number | string | null

      const handlers = bindNumberBounds({ min: 0, max: 999.99, integer: false, decimals: 2 }, (n) =>
        table.options.meta?.setRowField?.(
          row.index,
          'num_clasificados',
          n as Paginacion['num_clasificados'],
          row.original,
        ),
      )

      const input = h('input', {
        class: 'w-full bg-transparent outline-none border-0 m-0 min-w-0',
        type: 'number',
        step: '0.01',
        min: '0',
        max: '999.99',
        inputmode: 'decimal',
        value: value ?? '',
        ...handlers,
        onFocus: (e: FocusEvent) => focusAllText(e, String(value ?? '')),
      })

      const view = h('p', { class: 'truncate' }, String(value ?? ''))
      return [
        withDirectives(input, [[vShow, isEditing]]),
        withDirectives(view, [[vShow, !isEditing]]),
      ]
    },
    minSize: 120,
    size: 160,
    meta: { editable: true },
  },
  {
    accessorKey: 'num_extras',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as unknown as Column<WithId>,
        title: 'Número de extras',
      }),
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false
      const value = (table.options.meta?.getCellValue?.(row.index, 'num_extras', row.original) ??
        row.getValue('num_extras')) as number | string | null

      const handlers = bindNumberBounds({ min: 0, max: 999.99, integer: false, decimals: 2 }, (n) =>
        table.options.meta?.setRowField?.(
          row.index,
          'num_extras',
          n as Paginacion['num_extras'],
          row.original,
        ),
      )

      const input = h('input', {
        class: 'w-full bg-transparent outline-none border-0 m-0 min-w-0',
        type: 'number',
        step: '0.01',
        min: '0',
        max: '999.99',
        inputmode: 'decimal',
        value: value ?? '',
        ...handlers,
        onFocus: (e: FocusEvent) => focusAllText(e, String(value ?? '')),
      })

      const view = h('p', { class: 'truncate' }, String(value ?? ''))
      return [
        withDirectives(input, [[vShow, isEditing]]),
        withDirectives(view, [[vShow, !isEditing]]),
      ]
    },
    minSize: 120,
    size: 160,
    meta: { editable: true },
  },
  {
    id: 'delete',
    header: () => h('span', { class: 'sr-only' }, 'Eliminar'),

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
          title: 'Eliminar fila',
          'aria-label': 'Eliminar fila',
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

    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    size: 56,
    minSize: 56,
    maxSize: 56,

    meta: { fixedLast: true },
  },
]
