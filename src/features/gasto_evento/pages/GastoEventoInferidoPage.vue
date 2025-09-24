<script setup lang="ts">
import { t } from '@/plugins/i18n'
import { useRoute, type RouteRecordName } from 'vue-router'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

import { useAuthStore } from '@/features/auth/stores'
import { useSolutionBus } from '@/shared/composables/useSolutionBus'

// ➜ Usamos tu nuevo composable
import { useCursorCrud } from '@/shared/composables/table/useCursorCrud'

import { convertToCSV, downloadCSV } from '@/shared/utils/csv-helpers'
import type { GastoEventoInferido } from '../gasto_evento'

import { columns } from '@/features/gasto_evento/columns.inferido'
import DataTable from '@/features/datatable/components/DataTable.vue'

const route = useRoute()
const authStore = useAuthStore()

import { useEmpresasCatalog } from '../catalogs/useEmpresasCatalog'

const { ensureLoaded: ensureEmpresas, options, editableOptions } = useEmpresasCatalog()

const dataTable = useTemplateRef('data-table')

function buildInitialFilters(): Record<string, Array<string>> {
  return {
    empresas: options.value.map((e) => e.value),
  }
}

// ======= CRUD con cursor (el composable maneja las filas) =======
const {
  items,
  loading,
  error,
  hasNext,
  fetch,
  nextPage,
  setFilters,
  setSort,
  clearSort,
  update: updateItem, // update en servidor (el composable sincroniza su items)
} = useCursorCrud<
  GastoEventoInferido,
  string | number,
  Partial<GastoEventoInferido>,
  Partial<GastoEventoInferido>
>({
  baseUrl: 'http://localhost:9000/pbi_gasto/inferido',
  idKey: 'id',
  initialParams: {
    limit: 50,
  },
})

const initialFilters = ref<Record<string, Array<string>>>({})
// Handlers para pasar cambios al composable
async function onServerSort(p: { sort_by: string; sort_order: 'asc' | 'desc' } | null) {
  booting.value = false
  if (p) {
    setSort(p.sort_by, p.sort_order)
  } else {
    clearSort()
  }
  await fetch() // reinicia (append desde cero en tu versión)
}

type ServerFilters = Record<string, Array<string>>

/** Si una clave no viene en `incoming`, usa el valor por defecto de `initialFilters` */
function mergeWithDefaults(incoming: ServerFilters): ServerFilters {
  const base = initialFilters.value
  // empezamos con los defaults calculados
  const merged: ServerFilters = { ...base }
  // sobrescribimos con lo que llegue (aunque venga vacío)
  for (const [k, v] of Object.entries(incoming)) {
    merged[k] = v
  }
  return merged
}

async function onServerFilters(f: ServerFilters) {
  booting.value = false

  // Rellenamos con defaults las claves ausentes
  const merged = mergeWithDefaults(f)

  // (Opcional) si quieres que la UI del DataTable/Toolbar muestre estos defaults
  // cuando el usuario “limpia” un filtro, descomenta esta línea:
  // initialFilters.value = merged

  setFilters(merged) // limpia items + reset cursor en tu composable
  await fetch() // primera página
}

// ======= Adaptadores para DataTable (sin duplicar filas) =======
const isPaging = ref(false)
const booting = ref(true)
const status = computed<'pending' | 'success' | 'error'>(() => {
  if (booting.value || loading.value) return 'pending'
  if (error.value) return 'error'
  return 'success'
})

const hasNextPage = computed(() => hasNext.value)
const isFetching = computed(() => loading.value)
const isFetchingNextPage = computed(() => loading.value && isPaging.value)

async function loadMore(): Promise<void> {
  if (!hasNextPage.value) return
  isPaging.value = true
  try {
    await nextPage() // el composable añade/gestiona sus items
  } finally {
    isPaging.value = false
  }
}

// ======= Bus de solución y utilidades =======
const SEP = '::' as const

// type guard for route names
const isStrName = (n: RouteRecordName | null | undefined): n is string =>
  typeof n === 'string' && n.length > 0

// extract solutionId from "SOLUTION::page"
const extractSolutionId = (fullName: string): string => {
  const i = fullName.indexOf(SEP)
  return i === -1 ? fullName : fullName.slice(0, i)
}

const getSolutionId = computed<number | undefined>(() => {
  if (!isStrName(route.name)) return undefined

  const fullCode = route.name

  const solCode = extractSolutionId(fullCode)
  const bySolution = authStore.soluciones.find((s) => s.codigo === solCode)
  if (bySolution) return bySolution.id

  return undefined
})

const bus = useSolutionBus(getSolutionId.value ?? 0)

function getFormattedFilename(title: string): string {
  const normalizedTitle = title.toLowerCase().replace(/\s+/g, '_')
  const today = new Date()
  const formattedDate = today.toISOString().split('T')[0]
  return `${normalizedTitle}_${formattedDate}.csv`
}

function exportLocal() {
  const recordsToExport = items.value // usamos directamente las filas del composable
  if (recordsToExport.length > 0) {
    const csvContent = convertToCSV(recordsToExport)
    const name = t('titles.pbi.gastos_eventos')
    const filename = getFormattedFilename(name)
    downloadCSV(csvContent, filename)
  } else {
    console.log('No hay datos para exportar.')
  }
}

function exportRemote() {
  console.log('EXPORT REMOTE')
}

function customize() {
  if (dataTable.value) dataTable.value.showViewOptionsDialog()
}

type SolutionEvent = { type: 'export:local' } | { type: 'export:remote' } | { type: 'customize' }

const off = bus.on((e: SolutionEvent) => {
  if (e.type === 'export:local') exportLocal()
  if (e.type === 'export:remote') exportRemote()
  if (e.type === 'customize') customize()
})

onBeforeUnmount(() => {
  if (typeof off === 'function') off()
})

// ======= Edición de filas =======
function isRowEditable(row: GastoEventoInferido) {
  return editableOptions.value.map((e) => e.value).includes(row.empresa)
}

type RowCommitPayload = {
  rowId: string | number
  patch: Partial<GastoEventoInferido>
  full: GastoEventoInferido
  onSuccess: () => void
  onError: (err?: unknown) => void
}

async function onRowCommit({ rowId, patch, full, onSuccess, onError }: RowCommitPayload) {
  try {
    const payload = {
      ...patch,
      ...('campanya_inferido' in full ? { campanya_inferido: full.campanya_inferido } : {}),
      ...('concepto_gasto_inferido' in full
        ? { concepto_gasto_inferido: full.concepto_gasto_inferido }
        : {}),
    }
    await updateItem(rowId, payload) // el composable actualiza su `items` internamente
    onSuccess()
  } catch (e) {
    onError(e)
  }
}

// ======= Montaje =======
onMounted(async () => {
  await ensureEmpresas()
  initialFilters.value = buildInitialFilters()
})
</script>

<template>
  <section class="mx-auto flex flex-col min-h-0 min-w-0 flex-1 px-8 py-4 w-full max-w-8xl">
    <!-- Header -->
    <header class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">{{ $t('titles.pbi.gastos_eventos') }}</h1>
    </header>

    <section class="flex-1 min-h-0 min-w-0 flex flex-col space-y-4">
      <DataTable
        ref="data-table"
        disableNewRows
        :records="items"
        :columns="columns"
        :persist-key="`${route.name as string}-${authStore.user.id}`"
        :is-row-editable="isRowEditable"
        :has-next-page="hasNextPage"
        :error="error"
        :status="status"
        :is-fetching="isFetching"
        :is-fetching-next-page="isFetchingNextPage"
        :load-more="loadMore"
        :initial-server-filters="initialFilters"
        @row-commit="onRowCommit"
        @server-sort="onServerSort"
        @server-filters="onServerFilters"
      />
    </section>
  </section>
</template>
