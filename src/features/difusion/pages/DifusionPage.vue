<script setup lang="ts">
import { t } from '@/plugins/i18n'
import { useRoute } from 'vue-router'
import { computed, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'

import { useAuthStore } from '@/features/auth/stores'
import { useSolutionBus } from '@/shared/composables/useSolutionBus'
import { CalendarDate, today, getLocalTimeZone, type DateValue } from '@internationalized/date'

import { useCursorCrud } from '@/shared/composables/table/useCursorCrud'

import { convertToCSV, downloadCSV } from '@/shared/utils/csv-helpers'
import type { Difusion } from '../difusion'

import { columns } from '../columns'
import DataTable from '@/shared/components/table/DataTable.vue'

const route = useRoute()
const authStore = useAuthStore()

import { useEmpresasCatalog } from '../catalogs/useEmpresasCatalog'

const { ensureLoaded: ensureEmpresas, options, editableOptions } = useEmpresasCatalog()

const dataTable = useTemplateRef('data-table')

const tz = getLocalTimeZone()
const todayDv: DateValue = today(tz)
const firstDayOfThisMonth: DateValue = new CalendarDate(todayDv.year, todayDv.month, 1)

function buildInitialFilters(): Record<string, string[]> {
  return {
    fecha_inicio: [firstDayOfThisMonth.toString()],
    fecha_fin: [todayDv.toString()],
    empresas: options.value.map((e) => e.value),
  }
}

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
  update: updateItem,
  remove: removeItem,
} = useCursorCrud<Difusion, string | number, Partial<Difusion>, Partial<Difusion>>({
  baseUrl: 'http://localhost:9000/zms_difusion',
  idKey: 'id',
  initialParams: {
    limit: 50,
  },
})

const initialFilters = ref<Record<string, string[]>>({})
async function onServerSort(p: { sort_by: string; sort_order: 'asc' | 'desc' } | null) {
  booting.value = false
  if (p) {
    setSort(p.sort_by, p.sort_order)
  } else {
    clearSort()
  }
  await fetch()
}

type ServerFilters = Record<string, string[]>

function mergeWithDefaults(incoming: ServerFilters): ServerFilters {
  const base = initialFilters.value
  const merged: ServerFilters = { ...base }
  for (const [k, v] of Object.entries(incoming)) {
    merged[k] = v
  }
  return merged
}

async function onServerFilters(f: ServerFilters) {
  booting.value = false

  const merged = mergeWithDefaults(f)

  setFilters(merged)
  await fetch()
}

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
    await nextPage()
  } finally {
    isPaging.value = false
  }
}

const getSolutionId = computed(() => {
  const solutionCode = route.name
  return authStore.soluciones.find((sol) => sol.codigo === solutionCode)?.id ?? null
})

const bus = useSolutionBus(getSolutionId.value ?? 0)

function getFormattedFilename(title: string): string {
  const normalizedTitle = title.toLowerCase().replace(/\s+/g, '_')
  const today = new Date()
  const formattedDate = today.toISOString().split('T')[0]
  return `${normalizedTitle}_${formattedDate}.csv`
}

function exportLocal() {
  const recordsToExport = items.value
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

onBeforeUnmount(() => {
  if (typeof off === 'function') off()
})

function isRowEditable(row: Difusion) {
  return editableOptions.value.map((e) => e.value).includes(row.empresa)
}

type RowCommitPayload = {
  rowId: string | number
  patch: Partial<Difusion>
  onSuccess: () => void
  onError: (err?: unknown) => void
}

async function onRowCommit({ rowId, patch, onSuccess, onError }: RowCommitPayload) {
  try {
    await updateItem(rowId, patch)
    onSuccess()
  } catch (e) {
    onError(e)
  }
}

type RowDeletePayload = {
  rowId: string | number
  onSuccess: () => void
  onError: (err?: unknown) => void
}
async function onRowDelete({ rowId, onSuccess, onError }: RowDeletePayload) {
  try {
    await removeItem(rowId)
    onSuccess()
  } catch (e) {
    onError(e)
  }
}

onMounted(async () => {
  await ensureEmpresas()
  initialFilters.value = buildInitialFilters()
})
</script>

<template>
  <section class="mx-auto flex flex-col min-h-0 min-w-0 flex-1 px-8 py-4 w-full max-w-8xl">
    <!-- Header -->
    <header class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight">{{ $t('titles.zms.difusion') }}</h1>
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
        :initial-server-filters="initialFilters"
        @row-commit="onRowCommit"
        @row-delete="onRowDelete"
        @server-sort="onServerSort"
        @server-filters="onServerFilters"
      />
    </section>
  </section>
</template>
