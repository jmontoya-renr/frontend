import type { WithId } from '@/shared/types/with-id'

export interface Difusion extends WithId {
  empresa: string
  producto: string
  anyo: number
  mes: number
  fecha: string
  servicio: number
  servicio_bloque: number
  servicio_kiosco: number
  venta: number
  venta_bloque: number
  venta_kiosco: number
  gratis: number
  pago: number
  colectivas: number
  difusion: number
  tirada: number
}
