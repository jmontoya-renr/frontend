import type { Column, ColumnDef, Table } from '@tanstack/vue-table'
import { h, nextTick, vShow, withDirectives, type ComponentPublicInstance, type VNode } from 'vue'
import type { Difusion } from '@/features/difusion/difusion'
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
  nextTick(() => {
    const el = e.target as HTMLElement | null
    if (!el) return
    if (!el.isConnected) return

    try {
      el.focus({ preventScroll: true })
    } catch {}

    const input = el as HTMLInputElement | HTMLTextAreaElement

    const isTextArea = input instanceof HTMLTextAreaElement
    const isTextInput =
      input instanceof HTMLInputElement &&
      ['text', 'search', 'tel', 'url', 'password'].includes(input.type)

    if ((isTextArea || isTextInput) && typeof input.setSelectionRange === 'function') {
      try {
        input.setSelectionRange(0, value.length)
      } catch {}
    }
  })
}

type BoundsOpts = {
  min?: number
  max?: number
  integer?: boolean
  allowEmpty?: boolean
}

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
      if (integer && ['e', 'E', '+', '-', '.'].includes(e.key)) e.preventDefault()
      if ((opts.min ?? -Infinity) >= 0 && e.key === '-') e.preventDefault()
    },
    onInput(e: Event) {
      const el = e.target as HTMLInputElement
      normalizeAndCommit(el)
    },
    onPaste(_e: ClipboardEvent) {},
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

function getNum(
  table: Table<Difusion>,
  rowIndex: number,
  key: keyof Difusion,
  rowOriginal: Difusion,
): number {
  const raw =
    table.options.meta?.getCellValue?.(rowIndex, key as keyof Difusion, rowOriginal) ??
    rowOriginal?.[key] ??
    0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function formatMoneyEs(n: number | string | null | undefined): string {
  const v = typeof n === 'string' ? Number(n) : (n ?? 0)
  if (!Number.isFinite(v)) return String(n ?? '')
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(v)
}

/**
 *  - venta = venta_bloque + venta_kiosco
 *  - servicio = servicio_bloque + servicio_kiosco
 *  - difusion = venta + gratis + pago + colectivas
 *  - tirada = servicio + gratis + pago + colectivas
 */
function updateDerived(table: Table<Difusion>, rowIndex: number, rowOriginal: Difusion) {
  const venta_bloque = getNum(table, rowIndex, 'venta_bloque', rowOriginal)
  const venta_kiosco = getNum(table, rowIndex, 'venta_kiosco', rowOriginal)
  const servicio_bloque = getNum(table, rowIndex, 'servicio_bloque', rowOriginal)
  const servicio_kiosco = getNum(table, rowIndex, 'servicio_kiosco', rowOriginal)
  const gratis = getNum(table, rowIndex, 'gratis', rowOriginal)
  const pago = getNum(table, rowIndex, 'pago', rowOriginal)
  const colectivas = getNum(table, rowIndex, 'colectivas', rowOriginal)

  const venta = venta_bloque + venta_kiosco
  const servicio = servicio_bloque + servicio_kiosco
  const difusion = venta + gratis + pago + colectivas
  const tirada = servicio + gratis + pago + colectivas

  table.options.meta?.setRowField?.(rowIndex, 'venta', venta as Difusion['venta'], rowOriginal)
  table.options.meta?.setRowField?.(
    rowIndex,
    'servicio',
    servicio as Difusion['servicio'],
    rowOriginal,
  )
  table.options.meta?.setRowField?.(
    rowIndex,
    'difusion',
    difusion as Difusion['difusion'],
    rowOriginal,
  )
  table.options.meta?.setRowField?.(rowIndex, 'tirada', tirada as Difusion['tirada'], rowOriginal)
}

export const columns: Array<ColumnDef<Difusion>> = [
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
    meta: { fixedFirst: true },
  },

  /* === EMPRESA (select on create) === */
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

      const friendly = empresaByCodigo.value.get(String(value ?? ''))?.nombre ?? value ?? ''

      const createOnly = column.columnDef.meta?.createOnly === true
      if (createOnly || !isEditing) return h('p', { class: 'truncate' }, friendly)

      const opts: ReadonlyArray<SelectOption> = empresaEditableOptions.value
      const disabled = opts.length === 0 || empLoading.value

      return h(ComboboxSelect, {
        modelValue: value,
        options: opts,
        placeholder: 'Selecciona sociedad…',
        disabled,
        loading: empLoading.value,
        clearable: false,
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
              '' as Difusion['producto'],
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
          if (!empLoaded.value) await ensureEmpresasLoaded()
          return empresaOptions.value.map((o) => ({ label: o.label, value: o.value }))
        },
      },
    },
  },

  /* === PRODUCTO (select on create) === */
  {
    accessorKey: 'producto',
    header: ({ column }) => {
      if (!prodLoaded.value && !prodLoading.value) void ensureProductosLoaded()
      return h(DataTableColumnHeader, {
        column: column as unknown as Column<WithId>,
        title: 'Producto',
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
      if (createOnly || !isEditing) return h('p', { class: 'truncate' }, friendly)

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
            (next ?? '') as Difusion['producto'],
            row.original,
          )
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
        param: 'productos',
        options: async (ctx) => {
          if (!prodLoaded.value) await ensureProductosLoaded()

          const raw = ctx.getColumnFilterValue('empresa')
          const selectedEmpresas: string[] = Array.isArray(raw)
            ? (raw as string[])
            : raw
              ? [String(raw)]
              : []

          if (selectedEmpresas.length === 0) {
            return prodOptions.value.map((o) => ({ label: o.label, value: o.value }))
          }

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
          out.sort((a, b) => a.label.localeCompare(b.label, 'es'))
          return out
        },
      },
    },
  },

  /* === FECHA (nice view, calendar on edit) === */
  {
    accessorKey: 'fecha',
    header: ({ column }) =>
      h(DataTableColumnHeader, { column: column as unknown as Column<WithId>, title: 'Fecha' }),
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false
      const value = (table.options.meta?.getCellValue?.(row.index, 'fecha', row.original) ??
        (row.getValue('fecha') as Difusion['fecha'])) as string | null

      const createOnly = !!column.columnDef.meta?.createOnly
      if (createOnly || !isEditing)
        return h('p', { class: 'truncate' }, formatFechaEs(value ?? null))

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
            (next ?? '') as Difusion['fecha'],
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

  /* === SERVICIO_BLOQUE === */
  {
    accessorKey: 'servicio_bloque',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as unknown as Column<WithId>,
        title: 'Servicio (bloque)',
      }),
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false
      const value =
        table.options.meta?.getCellValue?.(row.index, 'servicio_bloque', row.original) ??
        row.getValue('servicio_bloque') ??
        ''

      const handlers = bindNumberBounds({ min: 0, integer: true }, (n) => {
        table.options.meta?.setRowField?.(
          row.index,
          'servicio_bloque',
          n as Difusion['servicio_bloque'],
          row.original,
        )
        updateDerived(table, row.index, row.original)
      })

      const input = h('input', {
        class: 'w-full bg-transparent outline-none border-0 m-0 min-w-0',
        type: 'number',
        step: '1',
        min: '0',
        inputmode: 'numeric',
        value,
        ...handlers,
        onFocus: (e: FocusEvent) => focusAllText(e, String(value ?? '')),
      })

      const view = h(
        'p',
        { class: 'w-full pr-4 truncate font-medium text-right' },
        formatMoneyEs(value),
      )
      return [
        withDirectives(input, [[vShow, isEditing]]),
        withDirectives(view, [[vShow, !isEditing]]),
      ]
    },
    minSize: 160,
    size: 180,
    meta: { editable: true },
  },

  /* === SERVICIO_KIOSCO === */
  {
    accessorKey: 'servicio_kiosco',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as unknown as Column<WithId>,
        title: 'Servicio (kiosco)',
      }),
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false
      const value =
        table.options.meta?.getCellValue?.(row.index, 'servicio_kiosco', row.original) ??
        row.getValue('servicio_kiosco') ??
        ''

      const handlers = bindNumberBounds({ min: 0, integer: true }, (n) => {
        table.options.meta?.setRowField?.(
          row.index,
          'servicio_kiosco',
          n as Difusion['servicio_kiosco'],
          row.original,
        )
        updateDerived(table, row.index, row.original)
      })

      const input = h('input', {
        class: 'w-full bg-transparent outline-none border-0 m-0 min-w-0',
        type: 'number',
        step: '1',
        min: '0',
        inputmode: 'numeric',
        value,
        ...handlers,
        onFocus: (e: FocusEvent) => focusAllText(e, String(value ?? '')),
      })

      const view = h(
        'p',
        { class: 'w-full pr-4 truncate font-medium text-right' },
        formatMoneyEs(value),
      )
      return [
        withDirectives(input, [[vShow, isEditing]]),
        withDirectives(view, [[vShow, !isEditing]]),
      ]
    },
    minSize: 160,
    size: 180,
    meta: { editable: true },
  },

  /* === SERVICIO (computed) === */
  {
    accessorKey: 'servicio',
    header: ({ column }) =>
      h(DataTableColumnHeader, { column: column as unknown as Column<WithId>, title: 'Servicio' }),
    cell: ({ row, table }) => {
      const servicio_bloque = getNum(table, row.index, 'servicio_bloque', row.original)
      const servicio_kiosco = getNum(table, row.index, 'servicio_kiosco', row.original)
      const total = servicio_bloque + servicio_kiosco
      return h('p', { class: 'w-full pr-4 truncate font-medium text-right' }, formatMoneyEs(total))
    },
    minSize: 120,
    size: 140,
    meta: { editable: false },
  },

  /* === VENTA_BLOQUE === */
  {
    accessorKey: 'venta_bloque',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as unknown as Column<WithId>,
        title: 'Venta (bloque)',
      }),
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false
      const value =
        table.options.meta?.getCellValue?.(row.index, 'venta_bloque', row.original) ??
        row.getValue('venta_bloque') ??
        ''

      const handlers = bindNumberBounds({ min: 0, integer: true }, (n) => {
        table.options.meta?.setRowField?.(
          row.index,
          'venta_bloque',
          n as Difusion['venta_bloque'],
          row.original,
        )
        updateDerived(table, row.index, row.original)
      })

      const input = h('input', {
        class: 'w-full bg-transparent outline-none border-0 m-0 min-w-0',
        type: 'number',
        step: '1',
        min: '0',
        inputmode: 'numeric',
        value,
        ...handlers,
        onFocus: (e: FocusEvent) => focusAllText(e, String(value ?? '')),
      })

      const view = h(
        'p',
        { class: 'w-full pr-4 truncate font-medium text-right' },
        formatMoneyEs(value),
      )
      return [
        withDirectives(input, [[vShow, isEditing]]),
        withDirectives(view, [[vShow, !isEditing]]),
      ]
    },
    minSize: 160,
    size: 180,
    meta: { editable: true },
  },

  /* === VENTA_KIOSCO === */
  {
    accessorKey: 'venta_kiosco',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as unknown as Column<WithId>,
        title: 'Venta (kiosco)',
      }),
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false
      const value =
        table.options.meta?.getCellValue?.(row.index, 'venta_kiosco', row.original) ??
        row.getValue('venta_kiosco') ??
        ''

      const handlers = bindNumberBounds({ min: 0, integer: true }, (n) => {
        table.options.meta?.setRowField?.(
          row.index,
          'venta_kiosco',
          n as Difusion['venta_kiosco'],
          row.original,
        )
        updateDerived(table, row.index, row.original)
      })

      const input = h('input', {
        class: 'w-full bg-transparent outline-none border-0 m-0 min-w-0',
        type: 'number',
        step: '1',
        min: '0',
        inputmode: 'numeric',
        value,
        ...handlers,
        onFocus: (e: FocusEvent) => focusAllText(e, String(value ?? '')),
      })

      const view = h(
        'p',
        { class: 'w-full pr-4 truncate font-medium text-right' },
        formatMoneyEs(value),
      )
      return [
        withDirectives(input, [[vShow, isEditing]]),
        withDirectives(view, [[vShow, !isEditing]]),
      ]
    },
    minSize: 160,
    size: 180,
    meta: { editable: true },
  },

  /* === VENTA (computed) === */
  {
    accessorKey: 'venta',
    header: ({ column }) =>
      h(DataTableColumnHeader, { column: column as unknown as Column<WithId>, title: 'Venta' }),
    cell: ({ row, table }) => {
      const venta_bloque = getNum(table, row.index, 'venta_bloque', row.original)
      const venta_kiosco = getNum(table, row.index, 'venta_kiosco', row.original)
      const total = venta_bloque + venta_kiosco
      return h('p', { class: 'w-full pr-4 truncate font-medium text-right' }, formatMoneyEs(total))
    },
    minSize: 120,
    size: 140,
    meta: { editable: false },
  },

  /* === GRATIS === */
  {
    accessorKey: 'gratis',
    header: ({ column }) =>
      h(DataTableColumnHeader, { column: column as unknown as Column<WithId>, title: 'Gratis' }),
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false
      const value =
        table.options.meta?.getCellValue?.(row.index, 'gratis', row.original) ??
        row.getValue('gratis') ??
        ''

      const handlers = bindNumberBounds({ min: 0, integer: true }, (n) => {
        table.options.meta?.setRowField?.(
          row.index,
          'gratis',
          n as Difusion['gratis'],
          row.original,
        )
        updateDerived(table, row.index, row.original)
      })

      const input = h('input', {
        class: 'w-full bg-transparent outline-none border-0 m-0 min-w-0',
        type: 'number',
        step: '1',
        min: '0',
        inputmode: 'numeric',
        value,
        ...handlers,
        onFocus: (e: FocusEvent) => focusAllText(e, String(value ?? '')),
      })

      const view = h(
        'p',
        { class: 'w-full pr-4 truncate font-medium text-right' },
        formatMoneyEs(value),
      )
      return [
        withDirectives(input, [[vShow, isEditing]]),
        withDirectives(view, [[vShow, !isEditing]]),
      ]
    },
    minSize: 120,
    size: 140,
    meta: { editable: true },
  },

  /* === PAGO === */
  {
    accessorKey: 'pago',
    header: ({ column }) =>
      h(DataTableColumnHeader, { column: column as unknown as Column<WithId>, title: 'Pago' }),
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false
      const value =
        table.options.meta?.getCellValue?.(row.index, 'pago', row.original) ??
        row.getValue('pago') ??
        ''

      const handlers = bindNumberBounds({ min: 0, integer: true }, (n) => {
        table.options.meta?.setRowField?.(row.index, 'pago', n as Difusion['pago'], row.original)
        updateDerived(table, row.index, row.original)
      })

      const input = h('input', {
        class: 'w-full bg-transparent outline-none border-0 m-0 min-w-0',
        type: 'number',
        step: '1',
        min: '0',
        inputmode: 'numeric',
        value,
        ...handlers,
        onFocus: (e: FocusEvent) => focusAllText(e, String(value ?? '')),
      })

      const view = h(
        'p',
        { class: 'w-full pr-4 truncate font-medium text-right' },
        formatMoneyEs(value),
      )
      return [
        withDirectives(input, [[vShow, isEditing]]),
        withDirectives(view, [[vShow, !isEditing]]),
      ]
    },
    minSize: 120,
    size: 140,
    meta: { editable: true },
  },

  /* === COLECTIVAS === */
  {
    accessorKey: 'colectivas',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as unknown as Column<WithId>,
        title: 'Colectivas',
      }),
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false
      const value =
        table.options.meta?.getCellValue?.(row.index, 'colectivas', row.original) ??
        row.getValue('colectivas') ??
        ''

      const handlers = bindNumberBounds({ min: 0, integer: true }, (n) => {
        table.options.meta?.setRowField?.(
          row.index,
          'colectivas',
          n as Difusion['colectivas'],
          row.original,
        )
        updateDerived(table, row.index, row.original)
      })

      const input = h('input', {
        class: 'w-full bg-transparent outline-none border-0 m-0 min-w-0',
        type: 'number',
        step: '1',
        min: '0',
        inputmode: 'numeric',
        value,
        ...handlers,
        onFocus: (e: FocusEvent) => focusAllText(e, String(value ?? '')),
      })

      const view = h(
        'p',
        { class: 'w-full pr-4 truncate font-medium text-right' },
        formatMoneyEs(value),
      )
      return [
        withDirectives(input, [[vShow, isEditing]]),
        withDirectives(view, [[vShow, !isEditing]]),
      ]
    },
    minSize: 140,
    size: 160,
    meta: { editable: true },
  },
  /* === DIFUSION (computed) === */
  {
    accessorKey: 'difusion',
    header: ({ column }) =>
      h(DataTableColumnHeader, { column: column as unknown as Column<WithId>, title: 'Difusión' }),
    cell: ({ row, table }) => {
      const venta_bloque = getNum(table, row.index, 'venta_bloque', row.original)
      const venta_kiosco = getNum(table, row.index, 'venta_kiosco', row.original)
      const venta = venta_bloque + venta_kiosco
      const gratis = getNum(table, row.index, 'gratis', row.original)
      const pago = getNum(table, row.index, 'pago', row.original)
      const colectivas = getNum(table, row.index, 'colectivas', row.original)
      const total = venta + gratis + pago + colectivas
      return h('p', { class: 'w-full pr-4 truncate font-medium text-right' }, formatMoneyEs(total))
    },
    minSize: 120,
    size: 140,
    meta: { editable: false },
  },

  /* === TIRADA (computed) === */
  {
    accessorKey: 'tirada',
    header: ({ column }) =>
      h(DataTableColumnHeader, { column: column as unknown as Column<WithId>, title: 'Tirada' }),
    cell: ({ row, table }) => {
      const servicio_bloque = getNum(table, row.index, 'servicio_bloque', row.original)
      const servicio_kiosco = getNum(table, row.index, 'servicio_kiosco', row.original)
      const servicio = servicio_bloque + servicio_kiosco
      const gratis = getNum(table, row.index, 'gratis', row.original)
      const pago = getNum(table, row.index, 'pago', row.original)
      const colectivas = getNum(table, row.index, 'colectivas', row.original)
      const total = servicio + gratis + pago + colectivas
      return h('p', { class: 'w-full pr-4 truncate font-medium text-right' }, formatMoneyEs(total))
    },
    minSize: 120,
    size: 140,
    meta: { editable: false },
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
