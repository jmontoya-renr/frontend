import api from '@/plugins/axios'
import { ref, computed, type Ref } from 'vue'

type CampanyasData = {
  codigo: number
  titulo: string
}

type Campanya = {
  id: string
  empresa: string
  tipo: string
  cuenta_ceco: string
  campanya: CampanyasData
}

const loaded = ref(false)
const loading = ref(false)
const error = ref<unknown>(null)
const list = ref<Array<Campanya>>([]) as Ref<Array<Campanya>>
let pending: Promise<void> | null = null

const PATH = '/pbi_campanya/'

async function ensureLoaded(): Promise<void> {
  if (loaded.value) return Promise.resolve()
  if (pending) return pending

  loading.value = true
  error.value = null

  pending = api
    .get<Array<Campanya>>(PATH)
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

export function useCampanyaCatalog() {
  const options = computed(() =>
    list.value.map((e) => ({ label: e.campanya.titulo, value: String(e.campanya.codigo) })),
  )
  const byCodigo = computed(() => new Map(list.value.map((e) => [e.campanya.codigo, e])))

  return {
    loaded,
    loading,
    error,
    list,
    ensureLoaded,
    options,
    byCodigo,
  }
}
