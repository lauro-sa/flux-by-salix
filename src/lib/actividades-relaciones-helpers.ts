import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Helpers compartidos para leer/escribir `actividades_relaciones` con
 * el shape `vinculos[]` legacy.
 *
 * Reusado por endpoints API (commits 2-4), motor de flujos (commit 3),
 * Salix IA (commit 5) y sync de visitas (commit 7) del sub-PR 20.6.
 */

export type VinculoLegacy = { tipo: string; id: string; nombre: string }

export type RelacionFila = {
  entidad_tipo: string
  entidad_id: string
  entidad_nombre: string | null
}

export function legacyARelacion(v: VinculoLegacy): RelacionFila {
  return {
    entidad_tipo: v.tipo,
    entidad_id: v.id,
    entidad_nombre: v.nombre,
  }
}

export function relacionALegacy(r: RelacionFila): VinculoLegacy {
  return {
    tipo: r.entidad_tipo,
    id: r.entidad_id,
    nombre: r.entidad_nombre || '',
  }
}

/**
 * Carga vínculos (shape legacy) para un conjunto de actividades.
 * Devuelve un Map: actividad_id → array de VinculoLegacy.
 * Empty Map si `actividadIds` viene vacío (evita query inútil).
 */
export async function cargarVinculosPorActividad(
  admin: SupabaseClient,
  empresaId: string,
  actividadIds: string[],
): Promise<Map<string, VinculoLegacy[]>> {
  const mapa = new Map<string, VinculoLegacy[]>()
  if (actividadIds.length === 0) return mapa

  const { data } = await admin
    .from('actividades_relaciones')
    .select('actividad_id, entidad_tipo, entidad_id, entidad_nombre')
    .eq('empresa_id', empresaId)
    .in('actividad_id', actividadIds)

  for (const fila of (data || []) as Array<RelacionFila & { actividad_id: string }>) {
    const lista = mapa.get(fila.actividad_id) ?? []
    lista.push(relacionALegacy(fila))
    mapa.set(fila.actividad_id, lista)
  }
  return mapa
}

/**
 * Sincroniza las relaciones de UNA actividad con un nuevo set de vínculos.
 *
 * Diff vs estado actual:
 *   - Filas en `nuevosVinculos` ausentes en BD       → INSERT.
 *   - Filas en BD ausentes en `nuevosVinculos`       → DELETE.
 *   - Filas presentes en ambos con `nombre` distinto → UPDATE (refresca cache).
 *
 * Idempotente: si no hay cambios, no ejecuta ninguna mutación.
 *
 * `creadoPor` se usa solo para los INSERT. Puede ser null si la mutación
 * viene de un sistema (motor de flujos, sync de visitas).
 */
export async function sincronizarVinculosActividad(
  admin: SupabaseClient,
  empresaId: string,
  actividadId: string,
  nuevosVinculos: VinculoLegacy[],
  creadoPor: string | null,
): Promise<void> {
  const { data: actuales } = await admin
    .from('actividades_relaciones')
    .select('entidad_tipo, entidad_id, entidad_nombre')
    .eq('empresa_id', empresaId)
    .eq('actividad_id', actividadId)

  const claveDe = (entidadTipo: string, entidadId: string) => `${entidadTipo}::${entidadId}`

  const actualesPorClave = new Map<string, RelacionFila>()
  for (const r of (actuales || []) as RelacionFila[]) {
    actualesPorClave.set(claveDe(r.entidad_tipo, r.entidad_id), r)
  }

  const nuevasPorClave = new Map<string, VinculoLegacy>()
  for (const v of nuevosVinculos) {
    nuevasPorClave.set(claveDe(v.tipo, v.id), v)
  }

  const aInsertar: VinculoLegacy[] = []
  const aActualizar: VinculoLegacy[] = []
  for (const [clave, v] of nuevasPorClave) {
    const actual = actualesPorClave.get(clave)
    if (!actual) {
      aInsertar.push(v)
    } else if ((actual.entidad_nombre || '') !== v.nombre) {
      aActualizar.push(v)
    }
  }

  const aEliminar: RelacionFila[] = []
  for (const [clave, r] of actualesPorClave) {
    if (!nuevasPorClave.has(clave)) aEliminar.push(r)
  }

  if (aInsertar.length > 0) {
    await admin.from('actividades_relaciones').insert(
      aInsertar.map(v => ({
        empresa_id: empresaId,
        actividad_id: actividadId,
        entidad_tipo: v.tipo,
        entidad_id: v.id,
        entidad_nombre: v.nombre,
        creado_por: creadoPor,
      })),
    )
  }

  for (const v of aActualizar) {
    await admin
      .from('actividades_relaciones')
      .update({ entidad_nombre: v.nombre })
      .eq('empresa_id', empresaId)
      .eq('actividad_id', actividadId)
      .eq('entidad_tipo', v.tipo)
      .eq('entidad_id', v.id)
  }

  for (const r of aEliminar) {
    await admin
      .from('actividades_relaciones')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('actividad_id', actividadId)
      .eq('entidad_tipo', r.entidad_tipo)
      .eq('entidad_id', r.entidad_id)
  }
}

/**
 * Inserta en batch las relaciones para una actividad recién creada.
 * Optimización del path POST/INSERT (no necesita diff porque la actividad
 * no tiene relaciones previas). Usa `ON CONFLICT DO NOTHING` vía la
 * convención del UNIQUE index existente.
 *
 * Idempotente: rerun con los mismos vínculos no rompe (matchea ON CONFLICT
 * del unique index `actividades_relaciones_unique_idx`).
 */
export async function insertarVinculosActividad(
  admin: SupabaseClient,
  empresaId: string,
  actividadId: string,
  vinculos: VinculoLegacy[],
  creadoPor: string | null,
): Promise<void> {
  if (vinculos.length === 0) return

  await admin.from('actividades_relaciones').upsert(
    vinculos.map(v => ({
      empresa_id: empresaId,
      actividad_id: actividadId,
      entidad_tipo: v.tipo,
      entidad_id: v.id,
      entidad_nombre: v.nombre,
      creado_por: creadoPor,
    })),
    { onConflict: 'empresa_id,actividad_id,entidad_tipo,entidad_id', ignoreDuplicates: true },
  )
}
