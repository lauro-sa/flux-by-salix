/**
 * Resuelve los permisos del usuario actual sobre las galerías de una OT
 * (relevamiento + bitácora).
 *
 * Reglas:
 *   - `puedeVer`: cualquiera con `verificarVisibilidad('ordenes_trabajo')`
 *     que además pueda ver esta OT (acá NO chequeamos ver_propio porque
 *     los endpoints de galería ya validan que la OT exista para el actor).
 *   - `puedeGestionar`: tiene permiso `editar` del módulo, o es creador
 *     de la OT, o es cabecilla asignado. Mismo criterio que en
 *     `/api/ordenes/[id]/tareas`.
 *   - `esAsignado`: figura en `asignados_orden_trabajo` (cabecilla o no).
 *
 * Reutilizable por los endpoints de galería de OT (relevamiento + bitácora).
 */

import type { User } from '@supabase/supabase-js'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerDatosMiembro, verificarPermiso } from '@/lib/permisos-servidor'

export interface PermisosGaleriaOT {
  /** La orden de trabajo, o null si no existe / no pertenece a la empresa. */
  orden: {
    id: string
    numero: string | null
    creado_por: string
    publicada: boolean
  } | null
  /** El usuario puede crear/editar/borrar entradas de relevamiento, y
   *  puede crear/editar/borrar cualquier entrada de bitácora (no solo las
   *  propias). True si tiene editar de ordenes_trabajo, es creador, o es
   *  cabecilla. */
  puedeGestionar: boolean
  /** El usuario figura como asignado de la OT (cabecilla o común). Habilita
   *  agregar entradas a la bitácora durante la ejecución. */
  esAsignado: boolean
}

export async function resolverPermisosGaleriaOT(
  admin: ReturnType<typeof crearClienteAdmin>,
  user: User,
  empresaId: string,
  ordenId: string,
): Promise<PermisosGaleriaOT> {
  const [{ data: orden }, { data: asignados }, datosActor] = await Promise.all([
    admin
      .from('ordenes_trabajo')
      .select('id, numero, creado_por, publicada')
      .eq('id', ordenId)
      .eq('empresa_id', empresaId)
      .maybeSingle(),
    admin
      .from('asignados_orden_trabajo')
      .select('usuario_id, es_cabecilla')
      .eq('orden_trabajo_id', ordenId),
    obtenerDatosMiembro(user.id, empresaId),
  ])

  if (!orden) {
    return { orden: null, puedeGestionar: false, esAsignado: false }
  }

  const puedeEditarTodas = datosActor
    ? verificarPermiso(datosActor, 'ordenes_trabajo', 'editar')
    : false
  const esCreador = orden.creado_por === user.id
  const asigs = asignados ?? []
  const esCabecilla = asigs.some(a => a.usuario_id === user.id && a.es_cabecilla)
  const esAsignado = asigs.some(a => a.usuario_id === user.id)
  const puedeGestionar = puedeEditarTodas || esCreador || esCabecilla

  return {
    orden: {
      id: orden.id as string,
      numero: (orden.numero as string | null) ?? null,
      creado_por: orden.creado_por as string,
      publicada: Boolean(orden.publicada),
    },
    puedeGestionar,
    esAsignado,
  }
}
