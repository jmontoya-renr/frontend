import { ref, computed, type Ref } from 'vue'
import axios from '@/plugins/axios'
// import type { Task } from '@/shared/components/data/schema'
import type { PaginationData } from '@/shared/schemas/api-data-response'

// /** ESTO DE AQUÍ VA FUERA */
// const PAGE_SIZE = 40

// async function fetchServerPage(
//   limit: number,
//   offset = 0,
// ): Promise<{ rows: Task[]; nextOffset: number | null }> {
//   const rows = new Array(limit).fill(0).map((_, i) => ({
//     id: `tmp-${rand((i % 6) + 1)}`,
//     title: `Row ${rand(10)}-${rand(6)} #${rand(4)}`,
//     status: 'todo',
//     label: 'bug',
//     priority: 'high',
//   })) as unknown as Task[]

//   await sleep(1000)
//   // Simulando latencia
//   return { rows, nextOffset: offset + 1 } // o null si no hay más
// }

// // Función de latencia mock
// function sleep(ms: number) {
//   return new Promise((resolve) => setTimeout(resolve, ms))
// }

// // Función para generar un número aleatorio (mock)
// function rand(max: number): number {
//   return Math.floor(Math.random() * max)
// }
// /** HASTA AQUí */

export function useCursorPagination<T>(apiUrl: string, pageSize: number = 40) {
  const status = ref<'pending' | 'success' | 'error' | undefined>('pending')
  const isFetching = ref(false)
  const isFetchingNextPage = ref(false)
  const hasNextPage = ref(true)
  const error = ref<unknown | null>(null)

  const pages = ref<Array<PaginationData<T>>>([]) as Ref<Array<PaginationData<T>>>
  const currentCursor = ref<string | null>(null)

  const fetchPage = async (cursor: string | null) => {
    if (isFetching.value) return

    isFetching.value = true
    status.value = 'pending'
    error.value = null

    try {
      const response = await axios.get<PaginationData<T>>(apiUrl, {
        params: { limit: pageSize, cursor },
      })
      console.log(response)
      const newPage = response.data as PaginationData<T>

      pages.value.push(newPage)
      currentCursor.value = newPage.meta.next_cursor ?? null
      hasNextPage.value = newPage.meta.next_cursor !== null

      status.value = 'success'
    } catch (err) {
      console.error('Error fetching data:', err)
      error.value = err
      status.value = 'error'
    } finally {
      isFetching.value = false
    }
  }

  const loadFirstPage = async () => {
    await fetchPage(null)
  }

  const loadMore = async () => {
    if (isFetchingNextPage.value || !hasNextPage.value) return

    isFetchingNextPage.value = true
    await fetchPage(currentCursor.value)
    isFetchingNextPage.value = false
  }

  const allItems = computed(() => pages.value.flatMap((page) => page.content) ?? [])

  return {
    status,
    allItems,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    error,
    loadFirstPage,
    loadMore,
  }
}
