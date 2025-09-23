import type { ColumnDef, ColumnFiltersState, SortingState } from '@tanstack/vue-table'
import type { ColumnFilterMeta, DateRangeValue } from '@/features/datatable/types/table-filters'

export function getColumnId<T>(c: ColumnDef<T>): string | null {
  const byId = (c as { id?: string }).id
  if (byId) return byId
  const byAccessor = (c as { accessorKey?: string }).accessorKey
  return byAccessor ?? null
}

export function flattenColumns<T>(cols: Array<ColumnDef<T>>): Array<ColumnDef<T>> {
  const out: Array<ColumnDef<T>> = []
  const walk = (arr: Array<ColumnDef<T>>): void => {
    for (const c of arr) {
      const maybeGroup = c as unknown as { columns?: Array<ColumnDef<T>> }
      if (maybeGroup.columns && maybeGroup.columns.length) walk(maybeGroup.columns)
      else out.push(c)
    }
  }
  walk(cols)
  return out
}

export function fromServerToColumnFilters<T>(
  cols: Array<ColumnDef<T>>,
  server: Record<string, Array<string>>,
): ColumnFiltersState {
  const leafs = flattenColumns(cols)
  const res: ColumnFiltersState = []

  for (const c of leafs) {
    const id = getColumnId(c)
    if (!id) continue

    const meta = c.meta?.filter as ColumnFilterMeta | undefined

    if (!meta) {
      const arr = server[id]
      if (Array.isArray(arr) && arr.length) res.push({ id, value: arr })
      continue
    }

    if (meta.type === 'text') {
      const key = meta.param || id
      const v = server[key]?.[0] ?? ''
      if (v) res.push({ id, value: v })
      continue
    }

    if (meta.type === 'multiSelect') {
      const key = meta.param
      const raw = server[key] ?? []
      const arr: Array<string> = Array.isArray(raw) ? raw.map((x) => String(x)).filter(Boolean) : []
      if (arr.length) res.push({ id, value: arr })
      continue
    }

    if (meta.type === 'dateRange') {
      const fromKey = meta.serverKeys?.from ?? `${id}_from`
      const toKey = meta.serverKeys?.to ?? `${id}_to`
      const from = server[fromKey]?.[0]
      const to = server[toKey]?.[0]
      if (from || to) {
        const vr: DateRangeValue = {}
        if (from) vr.from = from
        if (to) vr.to = to
        res.push({ id, value: vr })
      }
      continue
    }
  }

  return res
}

export function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function mapFiltersToServer(
  metaById: Map<string, ColumnFilterMeta | undefined>,
  fs: ColumnFiltersState,
): Record<string, Array<string>> {
  const out: Record<string, Array<string>> = {}

  for (const f of fs) {
    const meta = metaById.get(f.id)
    const raw = (f as { value: unknown }).value

    if (!meta) {
      const v = Array.isArray(raw)
        ? raw.map(String).filter(Boolean)
        : raw == null
          ? []
          : [String(raw).trim()].filter(Boolean)
      if (v.length) out[f.id] = v
      continue
    }

    if (meta.type === 'text') {
      const key = meta.param || f.id
      const v = raw == null ? '' : String(raw).trim()
      if (v) out[key] = [v]
      continue
    }

    if (meta.type === 'multiSelect') {
      const key = meta.param
      const arr = Array.isArray(raw)
        ? raw.map(String).filter((s) => s.length > 0)
        : raw == null
          ? []
          : [String(raw)].filter((s) => s.length > 0)
      out[key] = arr
      continue
    }

    if (meta.type === 'dateRange') {
      const { from, to } = (raw ?? {}) as { from?: string; to?: string }
      const fromKey = meta.serverKeys?.from ?? `${f.id}_from`
      const toKey = meta.serverKeys?.to ?? `${f.id}_to`
      if (from) out[fromKey] = [from]
      if (to) out[toKey] = [to]
      continue
    }

    if (meta.type === 'boolean') {
      const key = meta.param || f.id
      if (typeof raw === 'boolean') {
        out[key] = [raw ? 'true' : 'false']
      } else if (typeof raw === 'string') {
        const v = raw.trim().toLowerCase()
        if (v === 'true' || v === 'false') out[key] = [v]
      }
      continue
    }
  }

  return out
}

export function mapSortingToServer(
  s: SortingState,
): { sort_by: string; sort_order: 'asc' | 'desc' } | null {
  if (!s.length) return null
  const first = s[0]
  return { sort_by: first.id, sort_order: first.desc ? 'desc' : 'asc' }
}
