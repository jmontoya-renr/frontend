<script setup lang="ts">
import { t } from '@/plugins/i18n'
import { useRoute } from 'vue-router'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

import { useAuthStore } from '@/features/auth/stores'
import { useSolutionBus } from '@/shared/composables/useSolutionBus'

// ➜ Usamos tu nuevo composable
import { useCursorCrud } from '@/shared/composables/table/useCursorCrud'

import { convertToCSV, downloadCSV } from '@/shared/utils/csv-helpers'
import type { Paginacion } from '../paginacion'

import { columns } from '../columns'
import DataTable from '@/shared/components/table/DataTable.vue'
import { PERMISSION_TYPES } from '@/shared/utils/roles'

const route = useRoute()
const authStore = useAuthStore()

import { useEmpresasCatalog } from '../catalogs/useEmpresasCatalog'
import { useProductosCatalog } from '../catalogs/useProductosCatalog'

const { ensureLoaded: ensureEmpresas } = useEmpresasCatalog()
const { ensureLoaded: ensureProductos } = useProductosCatalog()

const dataTable = useTemplateRef('data-table')

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
  create: createItem,
} = useCursorCrud<Paginacion, string | number, Partial<Paginacion>, Partial<Paginacion>>({
  baseUrl: 'http://localhost:9000/zms_paginacion',
  idKey: 'id',
  initialParams: {
    filters: {
      fecha_inicio: ['2000-01-01'],
      fecha_fin: ['3000-01-01'],
      empresas: ['ALI', 'ENA', 'ERM', 'EPN', 'NES'],
    },
    limit: 50,
  },
})

// Handlers para pasar cambios al composable
async function onServerSort(p: { sort_by: string; sort_order: 'asc' | 'desc' } | null) {
  if (p) {
    setSort(p.sort_by, p.sort_order)
  } else {
    clearSort()
  }
  await fetch() // reinicia (append desde cero en tu versión)
}

async function onServerFilters(f: Record<string, Array<string>>) {
  setFilters(f) // limpia items + reset cursor
  await fetch() // primera página (append sobre [])
}

// ======= Adaptadores para DataTable (sin duplicar filas) =======
const isPaging = ref(false)

const status = computed<'pending' | 'success' | 'error'>(() => {
  if (loading.value) return 'pending'
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
const getSolutionId = computed(() => {
  const solutionCode = route.name
  return authStore.soluciones.find((sol) => sol.codigo === solutionCode)?.id
})

const bus = useSolutionBus(getSolutionId.value!)

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
    const name = t('titles.zms.paginacion')
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

onBeforeUnmount(off)

// ======= Edición de filas =======
function isRowEditable(row: Paginacion, rowIndex: number) {
  return authStore.canAccessEmpresaModulo(row.empresa, route.name as string, PERMISSION_TYPES.EDIT)
}

type RowCommitPayload = {
  rowId: string | number
  patch: Partial<Paginacion>
  onSuccess: () => void
  onError: (err?: unknown) => void
}

async function onRowCommit({ rowId, patch, onSuccess, onError }: RowCommitPayload) {
  try {
    await updateItem(rowId, patch) // el composable actualiza su `items` internamente
    onSuccess()
  } catch (e) {
    onError(e)
  }
}

// ======= Montaje =======
onMounted(async () => {
  await Promise.all([ensureEmpresas(), ensureProductos()])
  await fetch() // primera carga; `items` viene del composable
})
</script>

<template>
  <section class="mx-auto flex flex-col min-h-0 min-w-0 flex-1 px-8 py-4 w-full max-w-8xl">
    <!-- Header -->
    <header class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">{{ $t('titles.zms.paginacion') }}</h1>
    </header>

    <section class="flex-1 min-h-0 min-w-0 flex flex-col space-y-4">
      <DataTable
        ref="data-table"
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
        @row-commit="onRowCommit"
        @server-sort="onServerSort"
        @server-filters="onServerFilters"
      />
    </section>
  </section>
</template>
