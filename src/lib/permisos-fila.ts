import type { Modulo, Accion } from '@/tipos'

/**
 * Lógica pura para decidir qué puede hacer un usuario sobre un registro dado.
 * Se usa desde el hook `usePermisosFila` (cliente) y desde tests — vive en
 * `lib/` para no arrastrar React/Supabase en la cadena de imports.
 *
 * El criterio se centraliza aquí: si mañana cambia (p. ej. "completar solo
 * lo pide a los cabecillas"), se cambia en un único lugar y se actualizan
 * todos los listados que usan el hook.
 */

export interface RegistroConOwnership {
  creado_por?: string | null
  asignado_a?: string | null
  asignados_ids?: string[] | null
  asignados?: { usuario_id: string }[] | null
  responsables?: { usuario_id: string }[] | null
}

export interface PermisosFila {
  /** Usuario es dueño (creador o asignado/responsable) del registro. */
  tieneOwnership: boolean
  /** Admin/propietario/superadmin o rol que ve-todos. */
  esGestorGlobal: boolean
  puedeEditar: boolean
  puedeEliminar: boolean
  /** Solo para módulos con la acción `completar`. */
  puedeCompletar: boolean
  /** Solo para módulos con la acción `enviar` (documentos, inbox). */
  puedeEnviar: boolean
  /** Solo para módulos con la acción `asignar` (visitas). */
  puedeAsignar: boolean
}

/**
 * Calcula flags de permisos sobre un registro. Recibe `tienePermiso` y el
 * `usuarioId` actual desde afuera — así se puede llamar con mocks en tests
 * sin montar providers de React.
 */
export function calcularPermisosFila(
  modulo: Modulo,
  registro: RegistroConOwnership | null | undefined,
  usuarioId: string | null,
  tienePermiso: (m: Modulo, a: Accion) => boolean,
  contexto: { esAdmin: boolean; esPropietario: boolean },
): PermisosFila {
  const esGestorGlobal = contexto.esAdmin || contexto.esPropietario

  if (!registro || !usuarioId) {
    return {
      tieneOwnership: false,
      esGestorGlobal,
      puedeEditar: esGestorGlobal && tienePermiso(modulo, 'editar'),
      puedeEliminar: esGestorGlobal && tienePermiso(modulo, 'eliminar'),
      puedeCompletar: esGestorGlobal && tienePermiso(modulo, 'completar'),
      puedeEnviar: esGestorGlobal && tienePermiso(modulo, 'enviar'),
      puedeAsignar: esGestorGlobal && tienePermiso(modulo, 'asignar'),
    }
  }

  // Computar ownership según la forma del registro.
  const esCreador = registro.creado_por === usuarioId
  const esAsignadoUnico = registro.asignado_a === usuarioId
  const enAsignadosIds = (registro.asignados_ids ?? []).includes(usuarioId)
  const enAsignados = (registro.asignados ?? []).some(a => a.usuario_id === usuarioId)
  const enResponsables = (registro.responsables ?? []).some(r => r.usuario_id === usuarioId)
  const tieneOwnership = esCreador || esAsignadoUnico || enAsignadosIds || enAsignados || enResponsables

  // Criterio estándar:
  //  - editar/eliminar/enviar/asignar: basta con tener el permiso del módulo.
  //    El servidor valida de nuevo al recibir la mutación.
  //  - completar: además exige ownership (quien hace el trabajo lo marca).
  const puedeEditar = tienePermiso(modulo, 'editar')
  const puedeEliminar = tienePermiso(modulo, 'eliminar')
  const puedeCompletar = tienePermiso(modulo, 'completar') && (esGestorGlobal || tieneOwnership)
  const puedeEnviar = tienePermiso(modulo, 'enviar')
  const puedeAsignar = tienePermiso(modulo, 'asignar')

  return {
    tieneOwnership,
    esGestorGlobal,
    puedeEditar,
    puedeEliminar,
    puedeCompletar,
    puedeEnviar,
    puedeAsignar,
  }
}
