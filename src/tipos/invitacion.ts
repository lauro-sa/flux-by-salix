import type { Rol } from './miembro'

/**
 * Tipo Invitación — token para unirse a una empresa.
 * Se usa en: gestión de usuarios, página de invitación, API de invitaciones.
 */
export interface Invitacion {
  id: string
  token: string
  empresa_id: string
  rol: Rol
  correo: string
  creado_por: string
  usado: boolean
  creado_en: string
  expira_en: string
}
