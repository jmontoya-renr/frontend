import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { toast } from 'vue-sonner'

import http from '@/plugins/axios'
import { jwtHandler } from '@/shared/utils/jwtHandler'
import type { RolCodigo } from '@/shared/types/roles'
import { AuthLoginResponseSchema } from '@/features/auth/schemas/auth'
import { hasRolePermission, type PermissionType } from '@/shared/utils/roles'
import {
  AuthJwtPayloadSchema,
  type AuthJwtPayload,
  type Solucion,
  type Sociedad,
  type SolucionSociedad,
} from '@/features/auth/schemas/user'

/**
 * API endpoints used in the auth store.
 */
const API_ENDPOINTS = {
  LOGIN: '/sed_auth/login',
  REFRESH: '/sed_auth/refresh',
} as const

/**
 * Pinia store for authentication and authorization management.
 */
export const useAuthStore = defineStore('auth', () => {
  // --- STATE ---
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const payload = ref<AuthJwtPayload | null>(null)
  const error = ref<string | null>(null)
  const isReady = ref(false)
  const isRestoringSession = ref(false)

  // --- AUTH STATE ---
  const isAuthenticated = computed(() => {
    if (!accessToken.value) return false
    if (jwtHandler.isExpired(accessToken.value)) return false
    return !!payload.value
  })

  // --- SELECTORES CRUDOS (payload directo) ---
  const user = computed(() => ({ ...payload.value?.user_data, id: payload.value?.id }))
  const grupo = computed(() => ({ ...payload.value?.grupo }))
  const soluciones = computed(() => payload.value?.soluciones ?? [])
  const sociedades = computed(() => payload.value?.sociedades ?? [])
  const solucionesSociedades = computed(() => payload.value?.soluciones_sociedades ?? [])
  const shouldRefreshSoon = computed(() =>
    accessToken.value ? (jwtHandler.secondsToExpiry(accessToken.value) ?? 0) < 60 : false,
  )

  // Índices para búsquedas rápidas
  const solucionesById = computed<Map<number, Solucion>>(() => {
    const map = new Map<number, Solucion>()
    payload.value?.soluciones.forEach((s) => map.set(s.id, s))
    return map
  })
  const solucionesByCode = computed<Map<string, Solucion>>(() => {
    const map = new Map<string, Solucion>()
    payload.value?.soluciones.forEach((s) => map.set(s.codigo.toUpperCase(), s))
    return map
  })
  const sociedadesById = computed<Map<number, Sociedad>>(() => {
    const map = new Map<number, Sociedad>()
    payload.value?.sociedades.forEach((s) => map.set(s.id, s))
    return map
  })
  const sociedadesByCode = computed<Map<string, Sociedad>>(() => {
    const map = new Map<string, Sociedad>()
    payload.value?.sociedades.forEach((s) => map.set(s.codigo, s))
    return map
  })

  function setPayloadFromTokenOrThrow(token: string) {
    const raw = jwtHandler.decodePayload(token)
    if (!raw) throw new Error('JWT inválido')
    const parsed = AuthJwtPayloadSchema.safeParse(raw.context)
    if (!parsed.success) throw new Error('JWT inválido')
    payload.value = parsed.data
  }

  function getActiveLink(solId: number, socId: number): SolucionSociedad | null {
    const link = payload.value?.soluciones_sociedades.find(
      (l) => l.id_solucion === solId && l.id_sociedad === socId && l.activo,
    )
    if (!link) return null
    if (!solucionesById.value.get(solId)) return null
    return link
  }

  async function restoreSession() {
    isRestoringSession.value = true
    try {
      await refreshAccessToken()
      if (accessToken.value && !jwtHandler.isExpired(accessToken.value)) {
        setPayloadFromTokenOrThrow(accessToken.value)
      } else {
        logout()
      }
    } catch {
      logout()
    } finally {
      isRestoringSession.value = false
      isReady.value = true
    }
  }

  async function login(credentials: { username: string; password: string }) {
    error.value = null
    const form = new URLSearchParams()
    form.append('username', credentials.username)
    form.append('password', credentials.password)

    try {
      const res = await http.post(API_ENDPOINTS.LOGIN, form, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      const parsed = AuthLoginResponseSchema.safeParse(res.data)
      if (!parsed.success) {
        logout()
        error.value = 'Respuesta de login inválida'
        toast.error(error.value)
        return false
      }

      await setAuth({
        access_token: parsed.data.access_token,
        refresh_token: parsed.data.refresh_token,
      })
      toast.success(`Ha iniciado sesión correctamente!`)
      return true
    } catch (e) {
      logout()
      console.error(e)
      const message = e.response.data.title
      error.value = message ?? 'No se ha podido iniciar sesión'
      toast.error(message)
      return false
    }
  }

  async function refreshAccessToken() {
    if (!refreshToken.value) return logout()
    try {
      const { data } = await http.post(API_ENDPOINTS.REFRESH, {
        refresh_token: refreshToken.value,
      })
      accessToken.value = data.access_token
      refreshToken.value = data.refresh_token
    } catch {
      logout()
    }
  }

  function logout() {
    accessToken.value = null
    refreshToken.value = null
    payload.value = null
    error.value = null
  }

  async function setAuth(data: { access_token: string; refresh_token: string }) {
    accessToken.value = data.access_token
    refreshToken.value = data.refresh_token
    setPayloadFromTokenOrThrow(accessToken.value)
    error.value = null
  }

  function hasPermission(routeName: string) {
    const sol = solucionesByCode.value.get(routeName.toUpperCase())
    if (!sol) return false
    return !!payload.value?.soluciones_sociedades.some((l) => {
      if (!l.activo || l.id_solucion !== sol.id) return false
      const soc = sociedadesById.value.get(l.id_sociedad)
      return !!soc?.activa
    })
  }

  function canAccessEmpresaModulo(empresa: string, solucionCode: string, tipo: PermissionType) {
    const sol = solucionesByCode.value.get(solucionCode.toUpperCase())
    const soc = sociedadesByCode.value.get(empresa)
    if (!sol || !soc || !soc.activa) return false

    const link = getActiveLink(sol.id, soc.id)
    if (!link) return false

    return hasRolePermission(link.rol.codigo as RolCodigo, tipo)
  }

  watch(
    shouldRefreshSoon,
    (v) => {
      if (v) refreshAccessToken()
    },
    { immediate: true },
  )

  return {
    // state
    accessToken,
    refreshToken,
    payload,
    error,
    isReady,
    isRestoringSession,

    // derived
    user,
    grupo,
    isAuthenticated,
    soluciones,
    sociedades,
    solucionesSociedades,
    shouldRefreshSoon,

    // actions
    restoreSession,
    login,
    logout,
    setAuth,
    refreshAccessToken,

    // permissions
    hasPermission,
    canAccessEmpresaModulo,
  }
})
