/**
 * Tipos compartidos para los sub-componentes de permisos.
 * Se usa en: SeccionPermisos y todos sus sub-componentes.
 */

import type { Rol, Modulo, Accion, PermisosMapa } from '@/tipos'
import type { PermisoAuditoria } from '@/tipos/permisos_auditoria'
import type { CambioDescrito } from '@/hooks/useCambiosPendientes'

/** Props publicas de SeccionPermisos */
export interface PropiedadesSeccionPermisos {
  miembroId: string
  rol: Rol
  permisosCustomIniciales: PermisosMapa | null
  auditoriaInicial?: PermisoAuditoria[]
  /** Nombre legible del miembro (para el modal "cambios sin guardar"). */
  nombreMiembro?: string
  onGuardar: (permisos: PermisosMapa | null) => Promise<void>
  onRevocar: (motivo: string) => Promise<void>
}

/** Estadisticas calculadas de permisos */
export interface EstadisticasPermisos {
  porcentaje: number
  completos: number
  sinAcceso: number
  parciales: number
}

/** Valor de retorno del hook usePermisos */
export interface RetornoUsePermisos {
  permisos: PermisosMapa
  usaCustom: boolean
  guardando: boolean
  /** Hay cambios locales que no están persistidos. */
  dirty: boolean
  /** Lista legible de cambios pendientes (para el modal "cambios sin guardar"). */
  cambios: CambioDescrito[]
  /** Diff de los permisos actuales contra los defaults del rol base. */
  diffVsRol: CambioDescrito[]
  estadisticas: EstadisticasPermisos
  toggleAccion: (modulo: Modulo, accion: Accion) => void
  todoModulo: (modulo: Modulo) => void
  nadaModulo: (modulo: Modulo) => void
  toggleColumna: (modulos: Modulo[], accion: Accion) => void
  aplicarPreset: (tipo: 'todo' | 'lectura' | 'nada') => void
  aplicarPresetCategoria: (categoriaKey: string, tipo: 'todo' | 'lectura' | 'nada') => void
  restablecer: () => Promise<void>
  guardar: () => Promise<void>
  /** Descarta los cambios locales y vuelve al estado persistido. */
  descartar: () => void
}
