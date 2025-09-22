import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import api from '@/plugins/axios'

import type { MetaData, PaginationData, ResponseData } from '@/shared/schemas/api-data-response'

// ==== Tipos del composable ====

export type SortOrder = 'asc' | 'desc'
export type Filters = Record<string, Array<string>>

export interface ListParams {
  cursor?: string
  sort_by?: string
  sort_order?: SortOrder
  limit?: number
  filters?: Filters
}

export interface UseCursorCrudState<T> {
  items: Ref<Array<T>>
  meta: Ref<MetaData>
  loading: Ref<boolean>
  error: Ref<string | null>
  hasNext: Ref<boolean>
  hasPrev: Ref<boolean>
  params: Ref<ListParams>
}

export interface UseCursorCrudReturn<T, Id extends string | number, C, U>
  extends UseCursorCrudState<T> {
  fetch: (override?: Partial<ListParams>) => Promise<void>
  refresh: () => Promise<void>
  setFilters: (filters: Filters) => void
  setFilter: (key: string, values: Array<string>) => void
  clearFilters: () => void
  setSort: (sort_by: string, sort_order?: SortOrder) => void
  clearSort: () => void
  setLimit: (limit: number) => void
  setCursor: (cursor?: string) => void
  nextPage: () => Promise<void>
  prevPage: () => Promise<void>
  reset: () => void

  create: (payload: C) => Promise<ResponseData<T>>
  update: (id: Id, payload: U) => Promise<ResponseData<T>>
  remove: (id: Id) => Promise<void>
}

function serializeParams(p: ListParams): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  if (p.cursor) out.cursor = p.cursor
  if (p.sort_by) out.sort_by = p.sort_by
  if (p.sort_order) out.sort_order = p.sort_order
  if (typeof p.limit === 'number') out.limit = p.limit

  // Filtros individuales
  if (p.filters) {
    for (const [key, values] of Object.entries(p.filters)) {
      if (values.length > 0) out[key] = values
    }
  }
  return out
}

function findIndexById<T, Id extends string | number>(
  arr: Array<T>,
  idKey: keyof T & string,
  id: Id,
): number {
  return arr.findIndex((item) => {
    const record = item as unknown as Record<string, unknown>
    const value = record[idKey]
    return String(value) === String(id)
  })
}

export function useCursorCrud<T, Id extends string | number, C = unknown, U = Partial<C>>(config: {
  baseUrl: string
  idKey?: keyof T & string
  initialParams?: ListParams
  usePatchForUpdate?: boolean
}): UseCursorCrudReturn<T, Id, C, U> {
  const idKey = (config.idKey ?? 'id') as keyof T & string

  const items = ref<Array<T>>([]) as Ref<Array<T>>
  const meta = ref<MetaData>({})
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)

  const stateParams = ref<ListParams>({
    limit: 25,
    sort_order: 'asc',
    ...config.initialParams,
  })

  const hasNext = computed<boolean>(
    () => typeof meta.value.next_cursor === 'string' && meta.value.next_cursor.length > 0,
  )
  const hasPrev = computed<boolean>(
    () => typeof meta.value.prev_cursor === 'string' && meta.value.prev_cursor.length > 0,
  )

  // dentro del composable
  const lastKey = ref<string | null>(null)
  const keyOf = (p: ListParams) => JSON.stringify(serializeParams(p))

  async function fetch(override?: Partial<ListParams>): Promise<void> {
    loading.value = true
    error.value = null
    const merged: ListParams = {
      ...stateParams.value,
      ...override,
      filters: override?.filters ?? stateParams.value.filters,
    }
    const k = keyOf(merged)
    if (lastKey.value === k) {
      loading.value = false
      return
    } // ✅ dedupe
    lastKey.value = k
    try {
      const { data } = await api.get<PaginationData<T>>(config.baseUrl, {
        params: serializeParams(merged),
      })
      items.value = [...items.value, ...data.content] // tu append
      meta.value = data.meta
      stateParams.value = { ...merged }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Error desconocido'
    } finally {
      loading.value = false
    }
  }

  async function refresh(): Promise<void> {
    // Reinicia el listado antes de volver a cargar (pero el fetch seguirá haciendo append)
    items.value = []
    setCursor(undefined)
    await fetch()
  }

  function setFilters(filters: Filters): void {
    // Cada cambio reinicia el listado; el siguiente fetch hará append desde cero
    items.value = []
    stateParams.value = { ...stateParams.value, filters, cursor: undefined }
  }

  function setFilter(key: string, values: Array<string>): void {
    const current = stateParams.value.filters ?? {}
    items.value = []
    stateParams.value = {
      ...stateParams.value,
      filters: { ...current, [key]: [...values] },
      cursor: undefined,
    }
  }

  function clearFilters(): void {
    items.value = []
    stateParams.value = { ...stateParams.value, filters: {}, cursor: undefined }
  }

  function setSort(sort_by: string, sort_order: SortOrder = 'asc'): void {
    items.value = []
    stateParams.value = { ...stateParams.value, sort_by, sort_order, cursor: undefined }
  }

  function clearSort(): void {
    // Reinicia listado y borra sort_by/sort_order. El siguiente fetch hará append desde cero.
    items.value = []
    stateParams.value = {
      ...stateParams.value,
      sort_by: undefined,
      sort_order: undefined,
      cursor: undefined,
    }
  }

  function setLimit(limit: number): void {
    items.value = []
    stateParams.value = { ...stateParams.value, limit, cursor: undefined }
  }

  function setCursor(cursor?: string): void {
    stateParams.value = { ...stateParams.value, cursor }
  }

  async function nextPage(): Promise<void> {
    if (!hasNext.value) return
    setCursor(meta.value.next_cursor)
    await fetch()
  }

  async function prevPage(): Promise<void> {
    if (!hasPrev.value) return
    setCursor(meta.value.prev_cursor)
    await fetch()
  }

  function reset(): void {
    items.value = []
    meta.value = {}
    error.value = null
    stateParams.value = {
      limit: 25,
      sort_order: 'asc',
      ...config.initialParams,
    }
  }

  async function create(payload: C): Promise<ResponseData<T>> {
    const { data } = await api.post<ResponseData<T>>(config.baseUrl, payload)
    items.value = [data.content, ...items.value]
    if (typeof meta.value.returned === 'number') {
      meta.value.returned = meta.value.returned + 1
    }
    return data
  }

  async function update(id: Id, payload: U): Promise<ResponseData<T>> {
    const url = `${config.baseUrl}/${id}`
    const method = config.usePatchForUpdate ? 'patch' : 'put'
    const { data } = await api[method]<ResponseData<T>>(url, payload as unknown)
    const idx = findIndexById<T, Id>(items.value, idKey, id)
    if (idx >= 0) {
      const clone = [...items.value]
      clone[idx] = data.content
      items.value = clone
    }
    return data
  }

  async function remove(id: Id): Promise<void> {
    const url = `${config.baseUrl}/${id}`
    await api.delete<void>(url)
    const idx = findIndexById<T, Id>(items.value, idKey, id)
    if (idx >= 0) {
      const clone = [...items.value]
      clone.splice(idx, 1)
      items.value = clone
      if (typeof meta.value.returned === 'number') {
        meta.value.returned = Math.max(0, meta.value.returned - 1)
      }
    }
  }

  return {
    // estado
    items,
    meta,
    loading,
    error,
    hasNext,
    hasPrev,
    params: stateParams, // sin Readonly
    // navegación y control
    fetch,
    refresh,
    setFilters,
    setFilter,
    clearFilters,
    setSort,
    clearSort,
    setLimit,
    setCursor,
    nextPage,
    prevPage,
    reset,
    // crud
    create,
    update,
    remove,
  }
}
