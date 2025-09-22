import api from '@/plugins/axios'
import { ref, type Ref, onScopeDispose } from 'vue'
import type { AxiosInstance, AxiosError } from 'axios'

export interface Message {
  id: number
  id_solucion: number
  texto_mensaje: string
  fecha_alta_mensaje: string // ISO string
  fecha_baja_mensaje: string // ISO string
}

type Status = 'idle' | 'loading' | 'success' | 'error'

const cache = new Map<number, Message[]>()
const inflight = new Map<number, Promise<Message[]>>()

function schedule(fn: () => void): number {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return (
      window as Window & {
        requestIdleCallback(cb: IdleRequestCallback, opts?: IdleRequestOptions): number
      }
    ).requestIdleCallback(fn, { timeout: 1500 })
  }
  return setTimeout(fn, 0)
}

export function useMessagesLazy(solutionId: number, instance: AxiosInstance = api) {
  const messages: Ref<Message[]> = ref(cache.get(solutionId) ?? [])
  const status: Ref<Status> = ref(messages.value.length ? 'success' : 'idle')
  const error: Ref<unknown> = ref(null)

  const ac = new AbortController()
  onScopeDispose(() => ac.abort())

  function load(force = false): void {
    if (!force && cache.has(solutionId)) {
      messages.value = cache.get(solutionId) ?? []
      status.value = 'success'
      return
    }
    if (inflight.has(solutionId)) {
      status.value = 'loading'
      inflight.get(solutionId)!.then(
        (data) => {
          messages.value = data
          status.value = 'success'
        },
        (e) => {
          error.value = e
          status.value = 'error'
        },
      )
      return
    }

    status.value = 'loading'
    schedule(() => {
      const p: Promise<Message[]> = instance
        .get<Message[]>(`/sed_mensaje/solucion/${solutionId}`, {
          signal: ac.signal,
          headers: { Accept: 'application/json' },
        })
        .then((r) => {
          const data = r.data ?? []
          cache.set(solutionId, data)
          messages.value = data
          status.value = 'success'
          return data
        })
        .catch((e: AxiosError | unknown) => {
          if (ac.signal.aborted) return []
          error.value = e
          status.value = 'error'
          return []
        })
        .finally(() => {
          inflight.delete(solutionId)
        })

      inflight.set(solutionId, p)
    })
  }

  return { messages, status, error, load }
}
