/**
 * Tipo PermisoAuditoria — registro de cambios en permisos de un miembro.
 * Se usa en: SeccionPermisos (timeline de cambios), API de permisos.
 */

import type { PermisosMapa } from './permisos'

export type TipoAccionAuditoria = 'editar_permisos' | 'revocar_todo' | 'restablecer_rol'

export interface PermisoAuditoria {
  id: string
  empresa_id: string
  miembro_id: string
  modulo: string | null // null = cambio global
  accion_tipo: TipoAccionAuditoria
  permisos_antes: PermisosMapa | null
  permisos_despues: PermisosMapa | null
  motivo: string | null
  editado_por: string // usuario_id del propietario
  editado_en: string
}
