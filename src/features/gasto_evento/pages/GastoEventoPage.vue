<script setup lang="ts">
import { t } from '@/plugins/i18n'
import { useRoute } from 'vue-router'
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

import { useAuthStore } from '@/features/auth/stores'
import { useSolutionBus } from '@/shared/composables/useSolutionBus'
import { useCursorPagination } from '@/shared/composables/table/useCursorPagination'

import { convertToCSV, downloadCSV } from '@/shared/utils/csv-helpers'

import type { Task } from '@/shared/components/data/schema'

import { columns } from '@/shared/components/table/columns'
import DataTable from '@/shared/components/table/DataTable.vue'

const route = useRoute()
const authStore = useAuthStore()

const dataTable = useTemplateRef('data-table')

const { status, allItems, loadMore, hasNextPage, isFetching, isFetchingNextPage, error } =
  useCursorPagination<Task>('')

// Computed para verificar si la página está en el array de soluciones
const getSolutionId = computed(() => {
  const solutionCode = route.name // O usa route.path dependiendo de tu ruta
  return authStore.soluciones.find((sol) => sol.codigo === solutionCode)?.id
})

const bus = useSolutionBus(getSolutionId.value!)

function getFormattedFilename(title: string): string {
  // Normalizar el título a minúsculas y reemplazar los espacios por guiones bajos
  const normalizedTitle = title.toLowerCase().replace(/\s+/g, '_')

  // Obtener la fecha actual en formato YYYY-MM-DD
  const today = new Date()
  const formattedDate = today.toISOString().split('T')[0] // Solo la parte de la fecha (YYYY-MM-DD)

  // Combinar el título y la fecha
  return `${normalizedTitle}_${formattedDate}.csv`
}

// Tus funciones reales
function exportLocal() {
  // Obtener los registros de la tabla
  const recordsToExport = allItems.value

  if (recordsToExport.length > 0) {
    // Convertir los registros a formato CSV
    const csvContent = convertToCSV(recordsToExport)

    // Descargar el archivo CSV
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

// Suscripción
const off = bus.on((e: SolutionEvent) => {
  if (e.type === 'export:local') exportLocal()
  if (e.type === 'export:remote') exportRemote()
  if (e.type === 'customize') customize()
})

onBeforeUnmount(off)

function isRowEditable(row: Task, rowIndex: number) {
  const isEditable = !row.id.includes('8') && rowIndex >= 0
  return isEditable
}

type RowCommitPayload = {
  rowId: string
  patch: Partial<Task>
  onSuccess: () => void
  onError: (err?: unknown) => void
  // opcionales que también llegan: rowIndex?: number; full?: Task; reason?: string
}

async function onRowCommit({ rowId, patch, onSuccess, onError }: RowCommitPayload) {
  try {
    console.log(allItems.value, rowId, patch)
    onSuccess() // limpia pending/drafts en la tabla
  } catch (e) {
    onError(e)
  }
}

onMounted(() => {})
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
        :records="allItems"
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
      />
    </section>
  </section>
</template>
