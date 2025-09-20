import { z } from 'zod'
import { ROLE_CODES_VALUES } from '@/shared/utils/roles'

export const RolSchema = z.object({
  id: z.number(),
  nombre: z.string(),
  codigo: z.enum(ROLE_CODES_VALUES),
})

export const UserDataSchema = z.object({
  nombre: z.string(),
  nick: z.string(),
  email: z.email(),
  activo: z.boolean(),
  nif: z.string().regex(/^\d{8}[A-Za-z]$/),
})

export const GrupoSchema = z.object({
  id: z.number(),
  codigo: z.string(),
  nombre: z.string(),
})

export const ActividadSchema = z.object({
  id: z.number(),
  codigo: z.string(),
})

export const SolucionSchema = z.object({
  id: z.number(),
  id_usuario_solucion: z.number(),
  codigo: z.string(),
  nombre: z.string(),
  activa: z.boolean(),
  rol: RolSchema,
  sed: z.unknown().nullable(),
})

export const SociedadSchema = z.object({
  id: z.number(),
  id_sociedad_usuario: z.number(),
  codigo: z.string(),
  nombre: z.string(),
  activa: z.boolean(),
  tipo: z.string(),
  actividad: ActividadSchema.nullable(),
  erp_publicidad: z.unknown().nullable(),
  erp_financiero: z.unknown().nullable(),
})

export const SolucionSociedadSchema = z.object({
  id_solucion: z.number(),
  id_sociedad: z.number(),
  id_usuario_solucion_sociedad: z.number(),
  rol: RolSchema,
  activo: z.boolean(),
  // En tu ejemplo viene null; permito también el objeto por si se usa en el futuro.
  actividad: ActividadSchema.nullable(),
})

export const AuthJwtPayloadSchema = z.object({
  id: z.number(),
  user_data: UserDataSchema,
  grupo: GrupoSchema,
  soluciones: z.array(SolucionSchema),
  sociedades: z.array(SociedadSchema),
  soluciones_sociedades: z.array(SolucionSociedadSchema),
})

export type Rol = z.infer<typeof RolSchema>
export type UserData = z.infer<typeof UserDataSchema>
export type Grupo = z.infer<typeof GrupoSchema>
export type Actividad = z.infer<typeof ActividadSchema>
export type Solucion = z.infer<typeof SolucionSchema>
export type Sociedad = z.infer<typeof SociedadSchema>
export type SolucionSociedad = z.infer<typeof SolucionSociedadSchema>
export type AuthJwtPayload = z.infer<typeof AuthJwtPayloadSchema>
