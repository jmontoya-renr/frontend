import api from '@/plugins/axios'
import { ref, computed, type Ref } from 'vue'

type Concepto = {
  id: number
  concepto: string
  agrupador_concepto?: string | null
}

const loaded = ref(false)
const loading = ref(false)
const error = ref<unknown>(null)
const list = ref<Array<Concepto>>([]) as Ref<Array<Concepto>>
let pending: Promise<void> | null = null

const PATH = '/pbi_concepto/'

async function ensureLoaded(): Promise<void> {
  if (loaded.value) return Promise.resolve()
  if (pending) return pending

  loading.value = true
  error.value = null

  pending = api
    .get<Array<Concepto>>(PATH)
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

export function useConceptoCatalog() {
  const options = computed(() =>
    list.value.map((e) => ({ label: e.concepto, value: String(e.id) })),
  )
  const byId = computed(() => new Map(list.value.map((e) => [e.id, e])))

  return {
    loaded,
    loading,
    error,
    list,
    ensureLoaded,
    options,
    byId,
  }
}
