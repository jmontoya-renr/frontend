import { ROLE_CODES } from '@/shared/utils/roles'

/**
 * Role codes used in the system.
 */
export type RolCodigo = (typeof ROLE_CODES)[keyof typeof ROLE_CODES]

/**
 * Interface defining permissions assigned to a role.
 */
interface RolPermisos {
  label: string
  puedeVer: boolean
  puedeEditar: boolean
  puedeAdministrar?: boolean
}
