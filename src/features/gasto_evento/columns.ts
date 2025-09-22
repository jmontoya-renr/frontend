// columns-gasto-evento.ts
import { h } from 'vue'
import type { Column, ColumnDef } from '@tanstack/vue-table'
import type { WithId } from '@/shared/types/with-id'
import type { GastoEvento } from './gasto_evento' // Ajusta la ruta a tu interfaz

import DataTableColumnHeader from '@/shared/components/table/DataTableColumnHeader.vue'
import ComboboxSelect from '@/shared/components/ComboboxSelect.vue'
import { Checkbox } from '@/shared/components/ui/checkbox'

// 🔗 Catálogos
import { useEmpresasCatalog } from './catalogs'
import { useCampanyaCatalog, useConceptoCatalog } from './catalogs'

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

export const columns: Array<ColumnDef<GastoEvento>> = [
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
    size: 56,
    minSize: 56,
    maxSize: 56,
    meta: {
      fixedFirst: true,
      filter: {
        type: 'boolean',
        param: 'sin_completar',
        label: 'Mostrar filas',
        order: 10,
        trueLabel: 'Filas sin completar',
        falseLabel: 'Todas las filas',
      },
    },
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
        label: 'Sociedades',
        order: 1,
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
      filter: {
        type: 'dateRange',
        serverKeys: { from: 'fecha_inicio', to: 'fecha_fin' },
        label: 'Fechas',
        order: 3,
      },
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
    meta: {
      editable: false,
      filter: { type: 'text', param: 'texto_asiento', label: 'Texto del asiento', order: 2 },
    },
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
    header: ({ column }) => {
      if (!campLoaded.value && !campLoading.value) void ensureCampLoaded()
      return h(DataTableColumnHeader, {
        column: column as unknown as Column<WithId>,
        title: 'Campaña',
      })
    },
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false

      const value = (table.options.meta?.getCellValue?.(row.index, 'campanya', row.original) ??
        (row.getValue('campanya') as number | null)) as number | null

      // label amistoso via byCodigo (Campanya.campanya.titulo)
      const friendly =
        (value != null ? campByCodigo.value.get(value)?.campanya.titulo : undefined) ??
        (value == null ? '' : String(value))

      if (!isEditing) return ro(friendly)

      const disabled = campOptions.value.length === 0 || campLoading.value

      return h(ComboboxSelect, {
        modelValue: value == null ? null : String(value),
        options: campOptions.value,
        placeholder: 'Selecciona campaña…',
        disabled,
        loading: campLoading.value,
        clearable: true,
        'onUpdate:modelValue': (next?) => {
          const nextNum = next == null ? null : Number(next)
          table.options.meta?.setRowField?.(
            row.index,
            'campanya',
            nextNum as GastoEvento['campanya'],
            row.original,
          )
        },
      })
    },
    minSize: 160,
    size: 190,
    enableHiding: false,
    meta: {
      editable: true,
      /*
      filter: {
        type: 'multiSelect',
        param: 'campanya',
        options: async () => {
          if (!campLoaded.value) await ensureCampLoaded()
          return campOptions.value.map((o) => ({ label: o.label, value: String(o.value) }))
        },
      },
      */
    },
  },

  // CONCEPTO_GASTO (editable, select desde catálogo)
  {
    accessorKey: 'concepto_gasto',
    header: ({ column }) => {
      if (!concLoaded.value && !concLoading.value) void ensureConcLoaded()
      return h(DataTableColumnHeader, {
        column: column as unknown as Column<WithId>,
        title: 'Concepto',
      })
    },
    cell: ({ row, column, table }) => {
      const isEditing = table.options.meta?.isCellEditing?.(row.index, column.getIndex()) ?? false

      const value = (table.options.meta?.getCellValue?.(
        row.index,
        'concepto_gasto',
        row.original,
      ) ?? (row.getValue('concepto_gasto') as number | null)) as number | null

      const friendly =
        (value != null ? concById.value.get(value)?.concepto : undefined) ??
        (value == null ? '' : String(value))

      if (!isEditing) return ro(friendly)

      const disabled = concOptions.value.length === 0 || concLoading.value

      return h(ComboboxSelect, {
        modelValue: value == null ? null : String(value),
        options: concOptions.value,
        placeholder: 'Selecciona concepto…',
        disabled,
        loading: concLoading.value,
        clearable: true,
        'onUpdate:modelValue': (next?) => {
          const nextNum = next == null ? null : Number(next)
          table.options.meta?.setRowField?.(
            row.index,
            'concepto_gasto',
            nextNum as GastoEvento['concepto_gasto'],
            row.original,
          )
        },
      })
    },
    minSize: 200,
    size: 240,
    enableHiding: false,
    meta: {
      editable: true,
      /*
      filter: {
        type: 'multiSelect',
        param: 'concepto_gasto',
        options: async () => {
          if (!concLoaded.value) await ensureConcLoaded()
          return concOptions.value.map((o) => ({ label: o.label, value: String(o.value) }))
        },
      },
      */
    },
  },
]
