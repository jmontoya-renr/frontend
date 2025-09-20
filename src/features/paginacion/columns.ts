import type { ColumnDef } from '@tanstack/vue-table'
import { h, nextTick, vShow, withDirectives } from 'vue'
import type { Paginacion } from '@/features/paginacion/paginacion'
import DataTableColumnHeader from '@/shared/components/table/DataTableColumnHeader.vue'

import ComboboxSelect, { type SelectOption } from '@/shared/components/ComboboxSelect.vue'
import DatePickerPopover from '@/shared/components/DatePickerPopover.vue'

import { today, getLocalTimeZone, CalendarDate } from '@internationalized/date'

import { useEmpresasCatalog, useProductosCatalog } from './catalogs'
import { Checkbox } from '@/shared/components/ui/checkbox'

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
  nextTick(() => {
    const el = e.target as HTMLElement | null
    if (!el) return

    // Siempre intenta enfocar
    el.focus({ preventScroll: true })

    // Selecciona solo si el tipo lo permite
    const input = el as HTMLInputElement | HTMLTextAreaElement
    const isSelectableTextarea = input instanceof HTMLTextAreaElement
    const isSelectableInput =
      input instanceof HTMLInputElement &&
      ['text', 'search', 'tel', 'url', 'password', 'email'].includes(input.type)

    if (
      (isSelectableTextarea || isSelectableInput) &&
      typeof input.setSelectionRange === 'function'
    ) {
      input.setSelectionRange(0, value.length)
    }
  })
}

type BoundsOpts = {
  min?: number
  max?: number
  integer?: boolean // por defecto true
  allowEmpty?: boolean // por defecto false
}

/** Devuelve handlers para <input type="number"> que:
 *  - bloquean e/E/+/-/. si es entero
 *  - acotan al rango [min, max] en cada input (también tras pegar)
 *  - llaman a onValue(n) con el número ya acotado
 */
function bindNumberBounds(opts: BoundsOpts, onValue: (n: number) => void) {
  const integer = opts.integer ?? true

  function clamp(n: number): number {
    if (!Number.isFinite(n)) n = opts.min ?? 0
    if (opts.min !== undefined && n < opts.min) n = opts.min
    if (opts.max !== undefined && n > opts.max) n = opts.max
    return integer ? Math.trunc(n) : n
  }

  function normalizeAndCommit(el: HTMLInputElement) {
    if (opts.allowEmpty && el.value === '') {
      // no forzamos nada (útil si quisieras permitir vacío temporal)
      return
    }
    let n = Number(el.value)
    n = clamp(n)
    const next = String(n)
    if (el.value !== next) el.value = next
    onValue(n)
  }

  return {
    onKeydown(e: KeyboardEvent) {
      // Evita escribir notación científica y signos si pedimos enteros no negativos
      if (integer && ['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault()
      // Si min >= 0, evita '-'
      if ((opts.min ?? -Infinity) >= 0 && e.key === '-') e.preventDefault()
    },
    onInput(e: Event) {
      const el = e.target as HTMLInputElement
      normalizeAndCommit(el)
    },
    onPaste(e: ClipboardEvent) {
      // Dejamos pegar y lo normalizamos en onInput inmediatamente
      // (el orden de eventos del browser ya llama a input después)
      // Si quieres bloquear texto no numérico, descomenta lo de abajo:
      // const t = e.clipboardData?.getData('text') ?? ''
      // if (!/^\d+$/.test(t)) e.preventDefault()
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
        ariaLabel: 'Select row',
        class: 'ml-2 translate-y-0.5',
      }),
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    size: 60,
  },
  /* === EMPRESA (select al editar) === */
  {
    accessorKey: 'empresa',
    header: ({ column }) => {
      if (!empLoaded.value && !empLoading.value) void ensureEmpresasLoaded()
      return h(DataTableColumnHeader, {
        column,
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
      const isCreateRow = row.original?.__isNew === true
      if (createOnly && !isCreateRow) return h('p', { class: 'truncate' }, friendly)
      if (!isEditing) return h('p', { class: 'truncate' }, friendly)

      const opts: ReadonlyArray<SelectOption> = empresaEditableOptions.value
      const disabled = opts.length === 0 || empLoading.value

      return h(ComboboxSelect, {
        modelValue: value,
        options: opts,
        placeholder: 'Selecciona sociedad…',
        disabled,
        loading: empLoading.value,
        clearable: false,
        'data-keep-edit-open': '',
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
    minSize: 100,
    size: 200,
    maxSize: 250,
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
        column,
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
      const isCreateRow = row.original?.__isNew === true
      const canEditHere = (createOnly ? isCreateRow : true) && isEditing
      if (!canEditHere) return h('p', { class: 'truncate' }, friendly)

      const disabled = !empresaCode || prodLoading.value

      return h(ComboboxSelect, {
        modelValue: value,
        options,
        placeholder: empresaCode ? 'Selecciona producto…' : 'Seleccione sociedad…',
        disabled,
        loading: prodLoading.value,
        clearable: false,
        'data-keep-edit-open': '',
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
    minSize: 300,
    size: 400,
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
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Fecha' }),
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
    minSize: 160,
    size: 200,
    meta: {
      editable: false,
      createOnly: true,
      filter: { type: 'dateRange', serverKeys: { from: 'fecha_inicio', to: 'fecha_fin' } },
    },
  },
  /* === num_paginas (input number al editar) === */
  {
    accessorKey: 'num_paginas',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Número de páginas' }),
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
    minSize: 120,
    size: 150,
    meta: { editable: true },
  },
  {
    accessorKey: 'num_clasificados',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Número de clasificados' }),
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false
      const value = (table.options.meta?.getCellValue?.(
        row.index,
        'num_clasificados',
        row.original,
      ) ?? row.getValue('num_clasificados')) as number | string | null

      const handlers = bindNumberBounds({ min: 0, max: 999, integer: true }, (n) =>
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
        step: '1',
        min: '0',
        max: '999',
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
    minSize: 120,
    size: 160,
    meta: { editable: true },
  },
  {
    accessorKey: 'num_extras',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Número de extras' }),
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false
      const value = (table.options.meta?.getCellValue?.(row.index, 'num_extras', row.original) ??
        row.getValue('num_extras')) as number | string | null

      const handlers = bindNumberBounds({ min: 0, max: 999, integer: true }, (n) =>
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
        step: '1',
        min: '0',
        max: '999',
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
    minSize: 120,
    size: 160,
    meta: { editable: true },
  },
]
