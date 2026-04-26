import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Resuelve puesto (vía FK miembros.puesto_id → puestos.nombre) y sector primario
 * (vía relación miembros_sectores con es_primario=true → sectores.nombre).
 *
 * Es la fuente única de verdad para los textos "puesto" y "sector" de un miembro.
 * No leer nunca columnas de texto en `miembros` para esto: no existen más.
 *
 * Uso: pasarle los miembros tal como vinieron del select (con `id` y `puesto_id`).
 * Devuelve un Map<miembro_id, { puesto, sector }>; ambos pueden ser null.
 */
export async function cargarEtiquetasMiembros(
  admin: SupabaseClient,
  miembros: Array<{ id: string; puesto_id: string | null }>
): Promise<Map<string, { puesto: string | null; sector: string | null }>> {
  const mapa = new Map<string, { puesto: string | null; sector: string | null }>()
  if (miembros.length === 0) return mapa
  for (const m of miembros) mapa.set(m.id, { puesto: null, sector: null })

  // Resolver nombres de puestos (por FK directo)
  const puestoIds = [...new Set(miembros.map(m => m.puesto_id).filter((x): x is string => !!x))]
  const puestoNombres = new Map<string, string>()
  if (puestoIds.length > 0) {
    const { data } = await admin.from('puestos').select('id, nombre').in('id', puestoIds)
    for (const p of (data || []) as Array<{ id: string; nombre: string }>) {
      puestoNombres.set(p.id, p.nombre)
    }
  }

  // Resolver sector primario (vía miembros_sectores)
  const miembroIds = miembros.map(m => m.id)
  const { data: relSectores } = await admin
    .from('miembros_sectores')
    .select('miembro_id, sector_id')
    .in('miembro_id', miembroIds)
    .eq('es_primario', true)
  const relsTipadas = (relSectores || []) as Array<{ miembro_id: string; sector_id: string }>

  const sectorIds = [...new Set(relsTipadas.map(r => r.sector_id))]
  const sectorNombres = new Map<string, string>()
  if (sectorIds.length > 0) {
    const { data } = await admin.from('sectores').select('id, nombre').in('id', sectorIds)
    for (const s of (data || []) as Array<{ id: string; nombre: string }>) {
      sectorNombres.set(s.id, s.nombre)
    }
  }

  for (const m of miembros) {
    const puesto = m.puesto_id ? puestoNombres.get(m.puesto_id) ?? null : null
    const actual = mapa.get(m.id) ?? { puesto: null, sector: null }
    actual.puesto = puesto
    mapa.set(m.id, actual)
  }
  for (const r of relsTipadas) {
    const actual = mapa.get(r.miembro_id) ?? { puesto: null, sector: null }
    actual.sector = sectorNombres.get(r.sector_id) ?? null
    mapa.set(r.miembro_id, actual)
  }

  return mapa
}
