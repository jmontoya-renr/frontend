import type { RolCodigo, RolPermisos } from '@/shared/types/roles'

/**
 * Role codes used in the system.
 */
export const ROLE_CODES = {
  READ_ONLY: 'R',
  READ_WRITE: 'RW',
  ADMIN: 'ADMIN',
} as const

export const ROLE_CODES_VALUES = Object.values(ROLE_CODES) as [string, ...Array<string>]

/**
 * Mapping of role codes to their corresponding permissions.
 */
export const ROLES: Record<RolCodigo, RolPermisos> = {
  [ROLE_CODES.READ_ONLY]: {
    label: 'Sólo Lectura',
    puedeVer: true,
    puedeEditar: false,
  },
  [ROLE_CODES.READ_WRITE]: {
    label: 'Lectura y Escritura',
    puedeVer: true,
    puedeEditar: true,
  },
  [ROLE_CODES.ADMIN]: {
    label: 'Administrador',
    puedeVer: true,
    puedeEditar: true,
    puedeAdministrar: true,
  },
} as const

/**
 * Permission types available.
 */
export const PERMISSION_TYPES = {
  VIEW: 'view',
  EDIT: 'edit',
} as const

/**
 * Type for permission string literals.
 */
export type PermissionType = (typeof PERMISSION_TYPES)[keyof typeof PERMISSION_TYPES]

/**
 * Devuelve si un rol tiene permiso para ver o editar.
 * @param rolCodigo Código del rol ('R', 'RW', 'ADMIN')
 * @param tipo Tipo de permiso ('view' | 'edit')
 * @returns boolean indicando si se permite o no
 */
export function hasRolePermission(rolCodigo: RolCodigo, tipo: PermissionType): boolean {
  const permisos = ROLES[rolCodigo]
  if (!permisos) return false

  if (tipo === PERMISSION_TYPES.VIEW) return permisos.puedeVer
  if (tipo === PERMISSION_TYPES.EDIT) return permisos.puedeEditar

  return false
}
