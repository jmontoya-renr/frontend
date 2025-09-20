import { useEventBus } from '@vueuse/core'

export type SolutionEvent =
  | { type: 'export:local' }
  | { type: 'export:remote' }
  | { type: 'customize' }

export function useSolutionBus(id: number | string) {
  return useEventBus<SolutionEvent>(`solution:${id}`)
}
