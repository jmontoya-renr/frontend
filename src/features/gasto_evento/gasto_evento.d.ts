import type { WithId } from '@/shared/types/with-id'

export interface GastoEvento extends WithId {
  empresa: string
  fecha_importe: Date
  fecha: Date
  anyo: string
  cuenta: string
  ceco: string
  descripcion: string
  asiento?: string | null
  documento: string
  texto_asiento: string
  importe: number
  campanya?: number | null
  concepto_gasto?: number | null
}

export interface GastoEventoInferido extends GastoEvento {
  campanya_inferido?: number | null
  concepto_gasto_inferido?: number | null
  inferido: boolean
}
