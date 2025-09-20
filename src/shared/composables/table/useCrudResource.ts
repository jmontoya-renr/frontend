import { ref, shallowRef, type Ref } from 'vue'
import axiosInstance from '@/plugins/axios' // Usamos tu instancia personalizada de axios
import type { AxiosError } from 'axios'
import type { WithId } from '@/shared/types/with-id'

export function useCrudResource<
  T extends WithId,
  TCreate = Partial<T>,
  TUpdate = Partial<T>,
  TId = string,
  Cursor = string,
>(config: { resource: string; getId?: (entity: T) => TId }) {
  const api = axiosInstance // Usamos tu instancia de axiosInstance preconfigurada

  const getId = config.getId ?? ((e) => e.id as TId)

  // STATE -------------------------------------------------------------
  const records = ref<Array<T>>([]) as Ref<Array<T>>
  const byId = shallowRef(new Map<TId, T>())

  const status = ref<'idle' | 'loading' | 'success' | 'error'>('idle')
  const error = shallowRef<AxiosError | null>(null)

  const isFetching = ref(false)
  const isFetchingNextPage = ref(false)
  const hasNextPage = ref(false)

  const cursor = ref<Cursor | null>(null)
  const filters = ref<Record<string, unknown>>({})
  const sortBy = ref<string | null>(null)
  const sortOrder = ref<'asc' | 'desc' | null>(null)
  const limit = ref<number>(50)

  // HELPERS -----------------------------------------------------------
  function indexRecords(items: Array<T>, mode: 'replace' | 'append' = 'replace') {
    if (mode === 'replace') {
      records.value = items
      byId.value = new Map(items.map((it) => [getId(it), it]))
    } else {
      const arr = records.value.slice()
      for (const item of items) {
        const id = getId(item)
        const pos = arr.findIndex((r) => getId(r) === id)
        if (pos >= 0) arr[pos] = item
        else arr.push(item)
        byId.value.set(id, item)
      }
      records.value = arr
    }
  }

  // LIST --------------------------------------------------------------
  async function list() {
    error.value = null
    status.value = 'loading'
    isFetching.value = true

    try {
      // Params
      const params = {
        cursor: cursor.value ?? null,
        limit: limit.value,
        ...filters.value,
        sort_by: sortBy.value ?? null,
        sort_order: sortOrder.value ?? null,
      }

      // Petición al backend
      const res = await api.get(config.resource, { params })

      // Parsear la respuesta
      const parsed: { items: Array<T>; nextCursor: Cursor | null } = res.data
      indexRecords(parsed.items, 'replace')
      hasNextPage.value = parsed.nextCursor != null
      cursor.value = parsed.nextCursor ?? null
      status.value = 'success'
    } catch (e) {
      error.value = e
      status.value = 'error'
    } finally {
      isFetching.value = false
    }
  }

  // Otros métodos CRUD (create, update, remove) se mantienen igual, pero no se detallan para simplificar...
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
  function setFilters(next: Record<string, unknown>) {
    filters.value = { ...next }
    list()
  }

  function setSort(next: Sort[]) {
    sort.value = [...next]
    list()
  }

  function setPageSize(size: number) {
    pageSize.value = size
    list()
  }

  async function refresh() {
    return list()
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
      await update(args.rowId, args.patch as TUpdate, { optimistic: true })
      args.onSuccess?.()
    } catch (e) {
      args.onError?.(e)
    }
  }

  return {
    records,
    status,
    error,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    cursor,
    filters,
    sortBy,
    sortOrder,
    limit,
    setFilters,
    setPageSize,
    setSort,
    refresh,
    list,
    create,
    update,
    remove,
    commitRow,
  }
}
