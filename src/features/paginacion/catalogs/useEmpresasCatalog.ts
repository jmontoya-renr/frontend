import api from '@/plugins/axios'
import { ref, computed, type Ref } from 'vue'

import { useAuthStore } from '@/features/auth/stores'
import { PERMISSION_TYPES } from '@/shared/utils/roles'
import { paginacion_route } from '@/features/paginacion/routes'

export type Empresa = {
  codigo: string
  nombre: string
  sed: boolean
  camara: boolean
  nif?: string | null
  nombre_nif?: string | null
  servidor?: string | null
  id: number
}

const loaded = ref(false)
const loading = ref(false)
const error = ref<unknown>(null)
const list = ref<Array<Empresa>>([]) as Ref<Array<Empresa>>
let pending: Promise<void> | null = null

const PATH = '/zms_empresa/'

async function ensureLoaded(): Promise<void> {
  if (loaded.value) return Promise.resolve()
  if (pending) return pending

  loading.value = true
  error.value = null

  pending = api
    .get<Array<Empresa>>(PATH)
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

export function useEmpresasCatalog() {
  const auth = useAuthStore()
  const solutionCode = paginacion_route.name

  const options = computed(() => list.value.map((e) => ({ label: e.nombre, value: e.codigo })))

  const editableOptions = computed(() =>
    list.value
      .filter(
        (e) => !e.sed || auth.canAccessEmpresaModulo(e.codigo, solutionCode, PERMISSION_TYPES.EDIT),
      )
      .map((e) => ({ label: e.nombre, value: e.codigo })),
  )
  const byCodigo = computed(() => new Map(list.value.map((e) => [e.codigo, e])))

  return { loaded, loading, error, list, ensureLoaded, options, editableOptions, byCodigo }
}
