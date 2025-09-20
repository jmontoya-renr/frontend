import type { WithId } from '@/shared/types/with-id'

export interface Paginacion extends WithId {
  empresa: string
  producto: string
  anyo: number
  mes: number
  fecha: string
  num_paginas: number
  num_clasificados: number
  num_extras: number
}
