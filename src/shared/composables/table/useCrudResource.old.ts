import { ref, shallowRef } from 'vue'
import axiosInstance from '@/plugins/axios'
import axios from 'axios'
import type { AxiosError, AxiosInstance } from 'axios'

export type ListResponse<T, Cursor = number> = {
  items: Array<T>
  total?: number
  nextCursor?: Cursor | null
}

export type Sort = { id: string; desc?: boolean }

export interface CrudConfig<
  T,
  TCreate = Partial<T>,
  TUpdate = Partial<T>,
  TId = string,
  Cursor = number,
> {
  /** Axios instance (opcional). Si no se pasa, se crea con baseURL si existe */
  axios?: AxiosInstance
  /** baseURL para crear internamente axios si no se pasa instancia */
  baseURL?: string
  /** Recurso base, e.g. "/tasks" */
  resource: string
  /** Cómo obtener el id primaria del item */
  getId?: (entity: T) => TId
  /** Config de listado */
  list?: {
    /** "page" (page/pageSize) o "cursor" (cursor/limit) */
    mode?: 'page' | 'cursor'
    /** Ruta (por defecto resource). Puede ser función */
    path?:
      | string
      | ((opts: {
          page: number
          pageSize: number
          filters: Record<string, unknown>
          sort: Sort[]
          cursor: Cursor | null
          signal?: AbortSignal
        }) => string)
    /** Mapeo de params para el backend */
    mapParams?: (opts: {
      page: number
      pageSize: number
      filters: Record<string, any>
      sort: Sort[]
      cursor: Cursor | null
    }) => Record<string, unknown>
    /** Parseador de la respuesta */
    parse?: (data: unknown) => ListResponse<T, Cursor>
  }
  /** Config de create */
  create?: { path?: string; parse?: (data: any) => T }
  /** Config de update */
  update?: {
    path?: (id: TId) => string
    method?: 'patch' | 'put'
    parse?: (data: any) => T
  }
  /** Config de delete */
  remove?: { path?: (id: TId) => string; parse?: (data: any) => { id: TId } | void }
  /** Tamaño de página inicial */
  initialPageSize?: number
}

export function useCrudResource<
  T,
  TCreate = Partial<T>,
  TUpdate = Partial<T>,
  TId = string,
  Cursor = number,
>(config: CrudConfig<T, TCreate, TUpdate, TId, Cursor>) {
  const api = config.axios ?? axiosInstance
  const getId = config.getId ?? ((e) => e.id as TId)

  // STATE -------------------------------------------------------------
  const records = ref<T[]>([])
  const byId = shallowRef(new Map<TId, T>())

  const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
  const error = shallowRef<AxiosError | null>(null)

  const isFetching = ref(false)
  const isFetchingNextPage = ref(false)
  const hasNextPage = ref(false)

  const page = ref(1)
  const pageSize = ref(config.initialPageSize ?? 25)
  const total = ref<number | null>(null)
  const cursor = ref<Cursor | null>(null)

  const filters = ref<Record<string, any>>({})
  const sort = ref<Sort[]>([])

  // Control de concurrencia / cancelación
  let inFlightListAbort: AbortController | null = null
  let inFlightLoadMoreAbort: AbortController | null = null
  let listRequestSeq = 0 // para ignorar respuestas obsoletas

  // HELPERS -----------------------------------------------------------
  function indexRecords(items: T[], mode: 'replace' | 'append' = 'replace') {
    if (mode === 'replace') {
      records.value = items
      byId.value = new Map(items.map((it) => [getId(it), it]))
    } else {
      const arr = records.value.slice()
      for (const item of items) {
        const id = getId(item)
        const pos = arr.findIndex((r) => (getId(r) as any) === (id as any))
        if (pos >= 0) arr[pos] = item
        else arr.push(item)
        byId.value.set(id, item)
      }
      records.value = arr
    }
  }

  // LIST --------------------------------------------------------------
  async function list(opts?: { reset?: boolean }) {
    listRequestSeq++
    const seq = listRequestSeq

    if (inFlightListAbort) inFlightListAbort.abort()
    inFlightListAbort = new AbortController()

    error.value = null
    status.value = 'loading'
    isFetching.value = true

    if (opts?.reset) {
      page.value = 1
      cursor.value = null
    }

    try {
      const mode = config.list?.mode ?? 'page'

      const params =
        config.list?.mapParams?.({
          page: page.value,
          pageSize: pageSize.value,
          filters: filters.value,
          sort: sort.value,
          cursor: cursor.value ?? null,
        }) ??
        (mode === 'page'
          ? {
              page: page.value,
              pageSize: pageSize.value,
              ...filters.value,
              sort: sort.value.map((s) => (s.desc ? '-' : '') + s.id).join(','),
            }
          : {
              limit: pageSize.value,
              cursor: cursor.value,
              ...filters.value,
              sort: sort.value.map((s) => (s.desc ? '-' : '') + s.id).join(','),
            })

      const path =
        typeof config.list?.path === 'function'
          ? config.list?.path({
              page: page.value,
              pageSize: pageSize.value,
              filters: filters.value,
              sort: sort.value,
              cursor: cursor.value,
              signal: inFlightListAbort.signal,
            })
          : (config.list?.path ?? config.resource)

      const res = await api.get(path, { params, signal: inFlightListAbort.signal })

      if (seq !== listRequestSeq) return // respuesta obsoleta

      const parsed: ListResponse<T, Cursor> =
        config.list?.parse?.(res.data) ??
        ({
          items: res.data.items ?? res.data.data ?? res.data,
          total: res.data.total,
          nextCursor: res.data.nextCursor,
        } as ListResponse<T, Cursor>)

      indexRecords(parsed.items, 'replace')
      total.value = parsed.total ?? null

      hasNextPage.value =
        mode === 'page'
          ? total.value != null
            ? page.value * pageSize.value < (total.value as number)
            : parsed.items.length === pageSize.value
          : parsed.nextCursor != null

      cursor.value = parsed.nextCursor ?? null
      status.value = 'success'
    } catch (e) {
      if (!axios.isCancel(e)) {
        error.value = e
        status.value = 'error'
      }
    } finally {
      isFetching.value = false
    }
  }

  // LOAD MORE ---------------------------------------------------------
  async function loadMore() {
    if (!hasNextPage.value) return

    if (inFlightLoadMoreAbort) inFlightLoadMoreAbort.abort()
    inFlightLoadMoreAbort = new AbortController()

    isFetchingNextPage.value = true

    try {
      const mode = config.list?.mode ?? 'page'
      if (mode === 'page') page.value += 1

      const params =
        config.list?.mapParams?.({
          page: page.value,
          pageSize: pageSize.value,
          filters: filters.value,
          sort: sort.value,
          cursor: cursor.value,
        }) ??
        (mode === 'page'
          ? {
              page: page.value,
              pageSize: pageSize.value,
              ...filters.value,
              sort: sort.value.map((s) => (s.desc ? '-' : '') + s.id).join(','),
            }
          : {
              limit: pageSize.value,
              cursor: cursor.value,
              ...filters.value,
              sort: sort.value.map((s) => (s.desc ? '-' : '') + s.id).join(','),
            })

      const path =
        typeof config.list?.path === 'function'
          ? config.list?.path({
              page: page.value,
              pageSize: pageSize.value,
              filters: filters.value,
              sort: sort.value,
              cursor: cursor.value,
            })
          : (config.list?.path ?? config.resource)

      const res = await api.get(path, { params, signal: inFlightLoadMoreAbort.signal })

      const parsed: ListResponse<T, Cursor> =
        config.list?.parse?.(res.data) ??
        ({
          items: res.data.items ?? res.data.data ?? res.data,
          total: res.data.total,
          nextCursor: res.data.nextCursor,
        } as ListResponse<T, Cursor>)

      indexRecords(parsed.items, 'append')
      total.value = parsed.total ?? total.value

      hasNextPage.value =
        (config.list?.mode ?? 'page') === 'page'
          ? total.value != null
            ? page.value * pageSize.value < (total.value as number)
            : parsed.items.length === pageSize.value
          : parsed.nextCursor != null

      cursor.value = parsed.nextCursor ?? null
    } catch (e) {
      if (!axios.isCancel(e)) error.value = e
    } finally {
      isFetchingNextPage.value = false
    }
  }

  // CREATE ------------------------------------------------------------
  async function create(payload: TCreate, opts?: { optimistic?: boolean; at?: 'start' | 'end' }) {
    error.value = null
    const optimistic = opts?.optimistic ?? true

    let tempId: TId | null = null
    let snapshotRecords: T[] | null = null

    if (optimistic) {
      snapshotRecords = records.value.slice()
      const optimisticEntity = { ...(payload as any) } as T
      const candidateId =
        (optimisticEntity as any).id ??
        `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      ;(optimisticEntity as any).id ??= candidateId
      tempId = candidateId as unknown as TId

      if (opts?.at === 'start') records.value = [optimisticEntity, ...records.value]
      else records.value = [...records.value, optimisticEntity]

      byId.value.set(tempId, optimisticEntity)
    }

    try {
      const path = config.create?.path ?? config.resource
      const res = await api.post(path, payload as any)
      const entity: T = (config.create?.parse?.(res.data) ?? res.data.data ?? res.data) as T
      const id = getId(entity)

      if (optimistic && tempId != null) {
        const idx = records.value.findIndex((r) => (getId(r) as any) === (tempId as any))
        if (idx >= 0) records.value.splice(idx, 1, entity)
        byId.value.delete(tempId)
      } else {
        records.value =
          opts?.at === 'start' ? [entity, ...records.value] : [...records.value, entity]
      }

      byId.value.set(id, entity)
      total.value = (total.value ?? 0) + 1
      return entity
    } catch (e) {
      if (optimistic && snapshotRecords) {
        records.value = snapshotRecords
        byId.value = new Map(snapshotRecords.map((i) => [getId(i), i]))
      }
      error.value = e
      throw e
    }
  }

  // UPDATE ------------------------------------------------------------
  async function update(
    id: TId,
    payload: TUpdate,
    opts?: { optimistic?: boolean; method?: 'patch' | 'put' },
  ) {
    const optimistic = opts?.optimistic ?? true
    const method = opts?.method ?? config.update?.method ?? 'patch'

    let snapshot: T | undefined

    if (optimistic) {
      snapshot = byId.value.get(id)
      if (snapshot) {
        const merged = { ...(snapshot as any), ...(payload as any) } as T
        const idx = records.value.findIndex((r) => (getId(r) as any) === (id as any))
        if (idx >= 0) records.value.splice(idx, 1, merged)
        byId.value.set(id, merged)
      }
    }

    try {
      const path = config.update?.path?.(id) ?? `${config.resource}/${id as any}`
      const res = await api.request({ url: path, method, data: payload as any })
      const entity: T = (config.update?.parse?.(res.data) ?? res.data.data ?? res.data) as T

      const idx = records.value.findIndex((r) => (getId(r) as any) === (id as any))
      if (idx >= 0) records.value.splice(idx, 1, entity)
      byId.value.set(id, entity)
      return entity
    } catch (e) {
      if (optimistic && snapshot) {
        const idx = records.value.findIndex((r) => (getId(r) as any) === (id as any))
        if (idx >= 0) records.value.splice(idx, 1, snapshot)
        byId.value.set(id, snapshot)
      }
      error.value = e
      throw e
    }
  }

  // DELETE ------------------------------------------------------------
  async function remove(id: TId, opts?: { optimistic?: boolean }) {
    const optimistic = opts?.optimistic ?? true
    let snapshot: { index: number; entity: T } | null = null

    if (optimistic) {
      const idx = records.value.findIndex((r) => (getId(r) as any) === (id as any))
      if (idx >= 0) {
        snapshot = { index: idx, entity: records.value[idx] }
        records.value.splice(idx, 1)
        byId.value.delete(id)
        total.value = Math.max((total.value ?? 1) - 1, 0)
      }
    }

    try {
      const path = config.remove?.path?.(id) ?? `${config.resource}/${id as any}`
      await api.delete(path)
      // ok
    } catch (e) {
      if (optimistic && snapshot) {
        records.value.splice(snapshot.index, 0, snapshot.entity)
        byId.value.set(id, snapshot.entity)
        total.value = (total.value ?? 0) + 1
      }
      error.value = e
      throw e
    }
  }

  // SETTERS & UTIL ----------------------------------------------------
  function setFilters(next: Record<string, any>) {
    filters.value = { ...next }
    list({ reset: true })
  }

  function setSort(next: Sort[]) {
    sort.value = [...next]
    list({ reset: true })
  }

  function setPageSize(size: number) {
    pageSize.value = size
    list({ reset: true })
  }

  async function refresh() {
    return list({ reset: true })
  }

  /**
   * Helper para el evento `row-commit` del <DataTable />
   * @example
   * @row-commit="({ rowId, patch, onSuccess, onError }) => crud.commitRow({ rowId, patch, onSuccess, onError })"
   */
  async function commitRow(args: {
    rowId: TId
    patch: Partial<T>
    onSuccess?: () => void
    onError?: (e: unknown) => void
  }) {
    try {
      await update(args.rowId, args.patch as any, { optimistic: true })
      args.onSuccess?.()
    } catch (e) {
      args.onError?.(e)
    }
  }

  return {
    // state
    records,
    byId,
    status,
    error,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    page,
    pageSize,
    total,
    cursor,
    filters,
    sort,

    // acciones
    list,
    loadMore,
    refresh,
    create,
    update,
    remove,

    // setters
    setFilters,
    setSort,
    setPageSize,

    // helpers
    commitRow,
  }
}
