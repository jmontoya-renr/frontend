import { useDebounceFn } from '@vueuse/core'
import { computed, nextTick, ref, watch, type Ref } from 'vue'
import type { ColumnDef, ColumnFiltersState, SortingState } from '@tanstack/vue-table'
import {
  flattenColumns,
  fromServerToColumnFilters,
  mapFiltersToServer,
  mapSortingToServer,
  getColumnId,
} from '@/features/datatable/utils'
import type { WithId } from '@/shared/types/with-id'
import type { ServerSyncEmit } from '@/features/datatable/types/row'
import type { ColumnFilterMeta } from '@/features/datatable/types/table-filters'

export function useServerSync<T extends WithId>(opts: {
  columns: () => Array<ColumnDef<T>>
  rowsLen: () => number
  sorting: Ref<SortingState>
  columnFilters: Ref<ColumnFiltersState>
  initialServerFilters?: () => Record<string, string[]> | undefined
  status: () => 'pending' | 'success' | 'error' | undefined
  isFetching?: () => boolean | undefined
  isFetchingNextPage?: () => boolean | undefined
  emit: ServerSyncEmit
}) {
  const suppressServerSync = ref<boolean>(true)
  const initialColumnFiltersDefault = ref<ColumnFiltersState>([])
  const liveMessage = ref<string>('')

  watch(
    () => opts.initialServerFilters?.(),
    (nf) => {
      suppressServerSync.value = true
      const next = nf ? fromServerToColumnFilters(opts.columns(), nf) : []
      opts.columnFilters.value = next
      initialColumnFiltersDefault.value = next
      nextTick(() => {
        suppressServerSync.value = false
      })
    },
    { deep: true, immediate: true, flush: 'sync' },
  )

  const metaById = computed<Map<string, ColumnFilterMeta | undefined>>(() => {
    const map = new Map<string, ColumnFilterMeta | undefined>()
    for (const c of flattenColumns(opts.columns())) {
      const id = getColumnId(c)
      if (id) map.set(id, c.meta?.filter as ColumnFilterMeta | undefined)
    }
    return map
  })

  const emitServerSort = useDebounceFn((s: SortingState) => {
    if (suppressServerSync.value) return
    opts.emit('server-sort', mapSortingToServer(s))
  }, 250)

  const emitServerFilters = useDebounceFn((cf: ColumnFiltersState) => {
    if (suppressServerSync.value) return
    opts.emit('server-filters', mapFiltersToServer(metaById.value, cf))
  }, 1000)

  watch(
    () => opts.sorting.value,
    (s) => emitServerSort(s),
    { deep: true },
  )
  watch(
    () => opts.columnFilters.value,
    (cf) => emitServerFilters(cf),
    { deep: true },
  )

  // live region message
  watch(
    [
      () => opts.status?.(),
      () => opts.isFetching?.(),
      () => opts.isFetchingNextPage?.(),
      () => opts.rowsLen(),
    ],
    ([status, isFetch, isNext, len]) => {
      if (status === 'pending') liveMessage.value = 'Loading...'
      else if (!isNext && !isFetch && (len ?? 0) === 0) liveMessage.value = 'No results.'
      else liveMessage.value = `${len ?? 0} results`
    },
    { immediate: true },
  )

  return { suppressServerSync, initialColumnFiltersDefault, liveMessage }
}
