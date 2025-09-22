import { h, reactive } from 'vue'
import type { Column, ColumnDef, Row, Table, TableMeta } from '@tanstack/vue-table'
import type { WithId } from '@/shared/types/with-id'
import type { GastoEventoInferido } from './gasto_evento' // Ajusta la ruta a tu interfaz

import DataTableColumnHeader from '@/shared/components/table/DataTableColumnHeader.vue'
import ComboboxSelect, { type SelectOption } from '@/shared/components/ComboboxSelect.vue'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { MoveRight, Loader2 } from 'lucide-vue-next'

// 🔗 Catálogos
import { useEmpresasCatalog, useCampanyaCatalog, useConceptoCatalog } from './catalogs'

// --- Empresas: para mostrar nombre amigable ---
const {
  loaded: empLoaded,
  loading: empLoading,
  ensureLoaded: ensureEmpresasLoaded,
  options: empresaOptions, // para filtros
  byCodigo: empresaByCodigo, // Map<string, Empresa>
} = useEmpresasCatalog()

// --- Campañas: editable ---
const {
  loaded: campLoaded,
  loading: campLoading,
  ensureLoaded: ensureCampLoaded,
  options: campOptions, // [{label, value:number}]
  byCodigo: campByCodigo, // Map<number, Campanya>
} = useCampanyaCatalog()

// --- Conceptos: editable ---
const {
  loaded: concLoaded,
  loading: concLoading,
  ensureLoaded: ensureConcLoaded,
  options: concOptions, // [{label, value:number}]
  byId: concById, // Map<number, Concepto>
} = useConceptoCatalog()

type InferField = 'campanya' | 'concepto_gasto'
type CheckboxState = boolean | 'indeterminate'

// Saving state map (row+field -> isSaving)
const savingMap = reactive(new Map<string, boolean>())

function savingKey(row: Row<GastoEventoInferido>, field: InferField): string {
  return `${(row.original as WithId).id}:${field}`
}
function isSaving(row: Row<GastoEventoInferido>, field: InferField): boolean {
  return savingMap.get(savingKey(row, field)) === true
}
function setSaving(row: Row<GastoEventoInferido>, field: InferField, v: boolean): void {
  savingMap.set(savingKey(row, field), !!v)
}

// ---------------- Ephemeral check state per row+field ----------
const inferApply = reactive(new Map<string, boolean>())

function inferKey(row: Row<GastoEventoInferido>, field: InferField): string {
  return `${(row.original as WithId).id}:${field}`
}
function isMarked(row: Row<GastoEventoInferido>, field: InferField): boolean {
  return inferApply.get(inferKey(row, field)) === true
}
function setMarked(row: Row<GastoEventoInferido>, field: InferField, value: boolean): void {
  inferApply.set(inferKey(row, field), !!value)
}

// --------------------- Friendly label helpers -----------------
function friendlyCampanya(value: number | null | undefined): string {
  return (
    (value != null ? campByCodigo.value.get(value)?.campanya.titulo : undefined) ??
    (value == null ? '' : String(value))
  )
}
function friendlyConcepto(value: number | null | undefined): string {
  return (
    (value != null ? concById.value.get(value)?.concepto : undefined) ??
    (value == null ? '' : String(value))
  )
}

// -------------------- Inferred getter by field ----------------
function getInferred(row: Row<GastoEventoInferido>, field: InferField): number | null {
  return field === 'campanya'
    ? (row.original.campanya_inferido ?? null)
    : (row.original.concepto_gasto_inferido ?? null)
}

// --------------- Compute header checkbox tri-state ------------
function headerState(
  rows: ReadonlyArray<Row<GastoEventoInferido>>,
  field: InferField,
): CheckboxState {
  if (rows.length === 0) return false
  const marked = rows.reduce((acc, r) => acc + (isMarked(r, field) ? 1 : 0), 0)
  if (marked === 0) return false
  if (marked === rows.length) return true
  return 'indeterminate'
}

// --------------- Shared header/cell renderers (typed) ---------
function specialHeader(opts: {
  table: Table<GastoEventoInferido>
  field: InferField
  title: string
  ensureLoaded?: () => void
  applyFromRow: (row: Row<GastoEventoInferido>) => number | null
}): ReturnType<typeof h> {
  const { table, field, title, ensureLoaded, applyFromRow } = opts
  if (ensureLoaded) ensureLoaded()

  const rows = table.getRowModel().rows as Row<GastoEventoInferido>[]
  const modelValue: CheckboxState = headerState(rows, field)

  const anySavingThisField = rows.some((r) => isSaving(r, field))
  const canApply = rows.some((r) => isMarked(r, field) && !isSaving(r, field))

  const applyAll = async (e: MouseEvent) => {
    e.stopPropagation()
    const meta = table.options.meta as TableMeta<GastoEventoInferido> | undefined
    if (!meta || !meta.setRowField) return

    const targets = rows.filter((r) => isMarked(r, field) && !isSaving(r, field))
    if (targets.length === 0) return

    // Optimistic draft + per-row saving
    const ops = targets.map((r) => {
      const next = applyFromRow(r)
      meta.setRowField?.(r.index, field, next, r.original)
      setSaving(r, field, true)
      const p = meta.commitRowAtAsync?.(r.index, 'row-change')
      return Promise.resolve(p)
        .then(() => {
          setMarked(r, field, false)
        })
        .catch(() => {})
        .finally(() => {
          setSaving(r, field, false)
        })
    })

    await Promise.all(ops)
  }

  return h('div', { class: 'grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-1 py-1' }, [
    h('span', { class: 'text-xs text-muted-foreground' }, `${title} (inferido)`),
    h('div', { class: 'flex items-center gap-1' }, [
      h(Checkbox, {
        modelValue: modelValue,
        'onUpdate:modelValue': (value) => {
          for (const r of rows) setMarked(r, field, !!value)
        },
        ariaLabel: 'Marcar todos',
        onClick: (e: MouseEvent) => e.stopPropagation(),
        onMousedown: (e: MouseEvent) => e.stopPropagation(),
        class: 'size-5',
      }),
      h(
        'button',
        {
          class:
            'size-5 flex justify-center items-center peer border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
          title: 'Copiar inferido a valores marcados y guardar',
          disabled: !canApply,
          onClick: applyAll,
          onMousedown: (e: MouseEvent) => e.stopPropagation(),
        },
        anySavingThisField
          ? h(Loader2, { class: 'size-4 animate-spin', 'aria-hidden': 'true' })
          : h(MoveRight, { class: 'size-4', 'aria-hidden': 'true' }),
      ),
    ]),
    h('span', { class: 'text-xs text-muted-foreground text-right' }, title),
  ])
}

function specialCell(opts: {
  row: Row<GastoEventoInferido>
  column: Column<GastoEventoInferido, unknown>
  table: Table<GastoEventoInferido>
  field: InferField
  inferredValue: number | null
  friendlyInfer: (v: number | null | undefined) => string
  isLoading: boolean
  options: ReadonlyArray<SelectOption>
  placeholder: string
}): ReturnType<typeof h> {
  const {
    row,
    column,
    table,
    field,
    inferredValue,
    friendlyInfer,
    isLoading,
    options,
    placeholder,
  } = opts

  const meta = table.options.meta as TableMeta<GastoEventoInferido> | undefined
  const isEditing = meta?.isCellEditing?.(row.index, column.getIndex()) ?? false

  const currentValue =
    meta?.getCellValue?.(row.index, field, row.original) ??
    (row.getValue(field) as number | null) ??
    null

  const disabledUI = options.length === 0 || isLoading || isSaving(row, field)

  const friendlyReal =
    field === 'campanya' ? friendlyCampanya(currentValue) : friendlyConcepto(currentValue)

  const rightNode = isEditing
    ? h(ComboboxSelect, {
        modelValue: currentValue == null ? null : String(currentValue),
        options,
        placeholder,
        disabled: disabledUI,
        loading: isLoading || isSaving(row, field),
        clearable: true,
        // When value changes, persist
        'onUpdate:modelValue': (next?) => {
          const nextNum = next == null ? null : Number(next)
          table.options.meta?.setRowField?.(row.index, field, nextNum, row.original)
        },
      })
    : h('p', { class: 'truncate text-right' }, friendlyReal)

  return h('div', { class: 'grid grid-cols-[1fr_auto_1fr] items-center gap-2 w-full' }, [
    h('p', { class: 'truncate opacity-80' }, friendlyInfer(inferredValue)),
    h(Checkbox, {
      modelValue: isMarked(row, field),
      disabled: isSaving(row, field),
      'onUpdate:modelValue': (v) => setMarked(row, field, !!v),
      onClick: (e: MouseEvent) => e.stopPropagation(),
      onMousedown: (e: MouseEvent) => e.stopPropagation(),
      ariaLabel: `Aplicar inferido en esta fila`,
      class: 'size-5',
    }),
    isSaving(row, field)
      ? h('div', { class: 'flex items-center gap-1 justify-end' }, [
          h(Loader2, { class: 'h-3.5 w-3.5 animate-spin', 'aria-hidden': 'true' }),
          rightNode,
        ])
      : rightNode,
  ])
}

/* ---------------- helpers (view-only render) ---------------- */
function ro(text: string) {
  return h('p', { class: 'truncate' }, text)
}
function formatDateEs(value: string | Date | null | undefined): string {
  if (!value) return ''
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return String(value)
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
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

export const columns: Array<ColumnDef<GastoEventoInferido>> = [
  // === SELECT CHECKBOX ===
  {
    id: 'select',
    header: ({ table }) =>
      h(Checkbox, {
        modelValue:
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate'),
        'onUpdate:modelValue': (value) => table.toggleAllPageRowsSelected(!!value),
        ariaLabel: 'Select all',
        class: 'translate-y-0.5 size-5',
      }),
    cell: ({ row }) =>
      h(Checkbox, {
        modelValue: row.getIsSelected(),
        'onUpdate:modelValue': (value) => row.toggleSelected(!!value),
        onClick: (e: MouseEvent) => e.stopPropagation(),
        onMousedown: (e: MouseEvent) => e.stopPropagation(),
        ariaLabel: 'Select row',
        class: 'ml-2 translate-y-0.5 size-5',
      }),
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    size: 56,
    minSize: 56,
    maxSize: 56,
    meta: { fixedFirst: true },
  },

  /* =================== LECTURA (readonly) =================== */

  // EMPRESA (readonly, label desde catálogo)
  {
    accessorKey: 'empresa',
    header: ({ column }) => {
      if (!empLoaded.value && !empLoading.value) void ensureEmpresasLoaded()
      return h(DataTableColumnHeader, {
        column: column as unknown as Column<WithId>,
        title: 'Sociedad',
      })
    },
    cell: ({ row }) => {
      const codigo = String(row.getValue('empresa') ?? '')
      const friendly = empresaByCodigo.value.get(codigo)?.nombre ?? codigo
      return ro(friendly)
    },
    minSize: 160,
    size: 200,
    meta: {
      editable: false,
      filter: {
        type: 'multiSelect',
        param: 'empresas',
        options: async () => {
          if (!empLoaded.value) await ensureEmpresasLoaded()
          // empresaOptions ya trae {label, value:string} en la mayoría de implementaciones
          return empresaOptions.value
        },
      },
    },
  },

  // FECHA IMPORTE (readonly)
  {
    accessorKey: 'fecha_importe',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as unknown as Column<WithId>,
        title: 'Fecha importe',
      }),
    cell: ({ row }) => ro(formatDateEs(row.getValue('fecha_importe') as string | Date | null)),
    minSize: 130,
    size: 150,
    meta: { editable: false },
  },

  // FECHA (readonly)
  {
    accessorKey: 'fecha',
    header: ({ column }) =>
      h(DataTableColumnHeader, { column: column as unknown as Column<WithId>, title: 'Fecha' }),
    cell: ({ row }) => ro(formatDateEs(row.getValue('fecha') as string | Date | null)),
    minSize: 130,
    size: 150,
    meta: {
      editable: false,
      filter: { type: 'dateRange', serverKeys: { from: 'fecha_inicio', to: 'fecha_fin' } },
    },
  },

  // CUENTA (readonly)
  {
    accessorKey: 'cuenta',
    header: ({ column }) =>
      h(DataTableColumnHeader, { column: column as unknown as Column<WithId>, title: 'Cuenta' }),
    cell: ({ row }) => ro(String(row.getValue('cuenta') ?? '')),
    minSize: 120,
    size: 140,
    meta: { editable: false },
  },

  // CECO (readonly)
  {
    accessorKey: 'ceco',
    header: ({ column }) =>
      h(DataTableColumnHeader, { column: column as unknown as Column<WithId>, title: 'CECO' }),
    cell: ({ row }) => ro(String(row.getValue('ceco') ?? '')),
    minSize: 120,
    size: 140,
    meta: { editable: false },
  },

  // DESCRIPCION (readonly)
  {
    accessorKey: 'descripcion',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as unknown as Column<WithId>,
        title: 'Descripción',
      }),
    cell: ({ row }) => ro(String(row.getValue('descripcion') ?? '')),
    minSize: 220,
    size: 280,
    meta: { editable: false },
  },

  // ASIENTO (readonly)
  {
    accessorKey: 'asiento',
    header: ({ column }) =>
      h(DataTableColumnHeader, { column: column as unknown as Column<WithId>, title: 'Asiento' }),
    cell: ({ row }) => ro(String(row.getValue('asiento') ?? '')),
    minSize: 120,
    size: 140,
    meta: { editable: false },
  },

  // DOCUMENTO (readonly)
  {
    accessorKey: 'documento',
    header: ({ column }) =>
      h(DataTableColumnHeader, { column: column as unknown as Column<WithId>, title: 'Documento' }),
    cell: ({ row }) => ro(String(row.getValue('documento') ?? '')),
    minSize: 140,
    size: 160,
    meta: { editable: false },
  },

  // TEXTO ASIENTO (readonly)
  {
    accessorKey: 'texto_asiento',
    header: ({ column }) =>
      h(DataTableColumnHeader, {
        column: column as unknown as Column<WithId>,
        title: 'Texto asiento',
      }),
    cell: ({ row }) => ro(String(row.getValue('texto_asiento') ?? '')),
    minSize: 220,
    size: 280,
    meta: { editable: false, filter: { type: 'text', param: 'texto_asiento' } },
  },

  // IMPORTE (readonly)
  {
    accessorKey: 'importe',
    header: ({ column }) =>
      h(DataTableColumnHeader, { column: column as unknown as Column<WithId>, title: 'Importe' }),
    cell: ({ row }) =>
      h(
        'p',
        { class: 'w-full pr-4 truncate font-medium text-right' },
        formatMoneyEs(row.getValue('importe')),
      ),
    minSize: 120,
    size: 140,
    meta: { editable: false },
  },

  /* =================== EDITABLES =================== */

  // CAMPANYA (editable, select desde catálogo)
  {
    accessorKey: 'campanya',
    header: ({ table }) =>
      specialHeader({
        table: table as Table<GastoEventoInferido>,
        field: 'campanya',
        title: 'Campaña',
        ensureLoaded: () => {
          if (!campLoaded.value && !campLoading.value) void ensureCampLoaded()
        },
        applyFromRow: (row) => {
          const infer = getInferred(row, 'campanya')
          // devolvemos el valor a aplicar
          return infer
        },
      }),
    cell: ({ row, column, table }) => {
      const inferred = getInferred(row as Row<GastoEventoInferido>, 'campanya')
      return specialCell({
        row: row as Row<GastoEventoInferido>,
        column: column as Column<GastoEventoInferido, unknown>,
        table: table as Table<GastoEventoInferido>,
        field: 'campanya',
        inferredValue: inferred,
        friendlyInfer: friendlyCampanya,
        isLoading: campLoading.value,
        options: campOptions.value,
        placeholder: 'Selecciona campaña…',
      })
    },
    minSize: 500,
    size: 600,
    enableSorting: false,
    enableHiding: false,
    meta: { editable: true },
  },

  // CONCEPTO_GASTO (especial)
  {
    accessorKey: 'concepto_gasto',
    header: ({ table }) =>
      specialHeader({
        table: table as Table<GastoEventoInferido>,
        field: 'concepto_gasto',
        title: 'Concepto',
        ensureLoaded: () => {
          if (!concLoaded.value && !concLoading.value) void ensureConcLoaded()
        },
        applyFromRow: (row) => {
          const infer = getInferred(row, 'concepto_gasto')
          return infer
        },
      }),
    cell: ({ row, column, table }) => {
      const inferred = getInferred(row as Row<GastoEventoInferido>, 'concepto_gasto')
      return specialCell({
        row: row as Row<GastoEventoInferido>,
        column: column as Column<GastoEventoInferido, unknown>,
        table: table as Table<GastoEventoInferido>,
        field: 'concepto_gasto',
        inferredValue: inferred,
        friendlyInfer: friendlyConcepto,
        isLoading: concLoading.value,
        options: concOptions.value,
        placeholder: 'Selecciona concepto…',
      })
    },
    minSize: 500,
    size: 600,
    enableSorting: false,
    enableHiding: false,
    meta: { editable: true },
  },
]
