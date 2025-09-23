import { onMounted, ref, watch, type Ref } from 'vue'
import type { Table, TableState, VisibilityState } from '@tanstack/vue-table'
import type { WithId } from '@/shared/types/with-id'
import { safeParse } from '@/features/datatable/utils'

type TablePrefs = {
  v: number
  columnVisibility?: VisibilityState
  columnOrder?: string[]
  columnSizing?: Record<string, number>
}

export function usePrefs<T extends WithId>(opts: {
  table: Table<T>
  persistKey: () => string | null | undefined
  columnVisibility: Ref<VisibilityState>
  columnOrder: Ref<string[]>
  columnSizing: Ref<Record<string, number>>
  version: number
}) {
  const keyFor = (): string | null => {
    const k = opts.persistKey()
    return k ? `datatable:${k}:v${opts.version}` : null
  }

  function currentIds(): string[] {
    return (opts.table.getAllLeafColumns() as Array<{ id: string }>).map((c) => c.id)
  }
  function mergeOrder(saved?: string[]) {
    const ids = currentIds()
    if (!saved?.length) return ids
    const set = new Set(ids)
    const filtered = saved.filter((id) => set.has(id))
    const missing = ids.filter((id) => !filtered.includes(id))
    return [...filtered, ...missing]
  }
  function filterSizing(saved?: Record<string, number>) {
    if (!saved) return {}
    const ids = new Set(currentIds())
    return Object.fromEntries(Object.entries(saved).filter(([id]) => ids.has(id)))
  }

  function loadPrefs(): TablePrefs | null {
    if (typeof window === 'undefined') return null
    const key = keyFor()
    if (!key) return null
    return safeParse<TablePrefs>(localStorage.getItem(key))
  }

  let saveT: number | undefined
  function savePrefsDebounced() {
    if (typeof window === 'undefined') return
    const key = keyFor()
    if (!key) return
    if (saveT) window.clearTimeout(saveT)
    saveT = window.setTimeout(() => {
      const st = opts.table.getState() as TableState
      const data: TablePrefs = {
        v: opts.version,
        columnVisibility: opts.columnVisibility.value,
        columnOrder: st.columnOrder,
        columnSizing: st.columnSizing,
      }
      localStorage.setItem(key, JSON.stringify(data))
    }, 250)
  }

  const storageHandler = ref<((e: StorageEvent) => void) | null>(null)

  onMounted(() => {
    const prefs = loadPrefs()
    if (prefs) {
      if (prefs.columnVisibility) opts.columnVisibility.value = prefs.columnVisibility
      if (prefs.columnOrder)
        (opts.table as Table<unknown>).setColumnOrder(mergeOrder(prefs.columnOrder))
      if (prefs.columnSizing)
        (opts.table as Table<unknown>).setColumnSizing(filterSizing(prefs.columnSizing))
    }

    if (typeof window !== 'undefined') {
      storageHandler.value = (e) => {
        if (e.key !== keyFor()) return
        const p = safeParse<TablePrefs>(e.newValue)
        if (!p) return
        if (p.columnVisibility) opts.columnVisibility.value = p.columnVisibility
        if (p.columnOrder) opts.table.setColumnOrder(mergeOrder(p.columnOrder))
        if (p.columnSizing) opts.table.setColumnSizing(filterSizing(p.columnSizing))
      }
      window.addEventListener('storage', storageHandler.value)
    }
  })

  watch([opts.columnVisibility, opts.columnOrder, opts.columnSizing], savePrefsDebounced, {
    deep: true,
  })

  return { savePrefsDebounced }
}
