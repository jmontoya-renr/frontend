import api from '@/plugins/axios'
import { ref, computed, type Ref } from 'vue'

type Producto = {
  empresa: string
  codigo: string
  nombre: string
  id: number
}

const loaded = ref(false)
const loading = ref(false)
const error = ref<unknown>(null)
const list = ref<Array<Producto>>([]) as Ref<Array<Producto>>
let pending: Promise<void> | null = null

const PATH = '/zms_producto/'

async function ensureLoaded(): Promise<void> {
  if (loaded.value) return Promise.resolve()
  if (pending) return pending

  loading.value = true
  error.value = null

  pending = api
    .get<Array<Producto>>(PATH)
    .then(({ data }) => {
      list.value = data ?? []
      loaded.value = true
    })
    .catch((e) => {
      error.value = e
      list.value = []
    })
    .finally(() => {
      loading.value = false
      pending = null
    })
  return pending
}

export function useProductosCatalog() {
  const options = computed(() => list.value.map((e) => ({ label: e.nombre, value: e.codigo })))

  const byEmpresa = computed(() => {
    const m = new Map<string, Producto[]>()
    for (const p of list.value) {
      const arr = m.get(p.empresa)
      if (arr) arr.push(p)
      else m.set(p.empresa, [p])
    }
    return m
  })

  const optionsByEmpresa = computed<Map<string, Array<{ label: string; value: string }>>>(() => {
    const m = new Map<string, Array<{ label: string; value: string }>>()
    for (const [emp, arr] of byEmpresa.value.entries()) {
      m.set(
        emp,
        arr.map((p) => ({ label: p.nombre, value: p.codigo })),
      )
    }
    return m
  })

  const labelsByKey = computed(() => {
    const m = new Map<string, string>()
    for (const p of list.value) {
      m.set(`${p.empresa}::${p.codigo}`, p.nombre)
    }
    return m
  })
  return {
    loaded,
    loading,
    error,
    list,
    ensureLoaded,
    options,
    optionsByEmpresa,
    labelsByKey,
    byEmpresa,
  }
}
