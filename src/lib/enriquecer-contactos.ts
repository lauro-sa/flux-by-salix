/**
 * Enriquecimiento de listado de contactos: añade última etapa de
 * conversación, actividades activas agrupadas por tipo y conteo de
 * visitas programadas. Compartido entre el endpoint /api/contactos
 * (cliente fetch) y la page.tsx (SSR), para que ambos sirvan la misma
 * forma de datos y la hidratación de React Query no se desfase.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type EtapaContacto = {
  etapa_etiqueta: string
  etapa_color: string
  tipo_canal: string
}

export type TipoActividadResumen = {
  tipo_id: string
  tipo_etiqueta: string
  tipo_color: string
  tipo_icono: string | null
  cantidad: number
}

export type EnriquecimientoContacto = {
  ultima_etapa: EtapaContacto | null
  actividades_activas: TipoActividadResumen[]
  cantidad_visitas_activas: number
}

/**
 * Devuelve un mapa por contacto_id con etapa, actividades y visitas
 * activas. "Activo" = actividad sin completar/cancelar y visita en estado
 * 'programada'. Las actividades se vinculan vía la columna `vinculo_ids`
 * (uuid[]) — no hay `contacto_id` directo en `actividades`.
 */
export async function enriquecerContactos(
  admin: SupabaseClient,
  empresaId: string,
  contactoIds: string[],
): Promise<Record<string, EnriquecimientoContacto>> {
  const resultado: Record<string, EnriquecimientoContacto> = {}
  if (contactoIds.length === 0) return resultado

  const [resEtapas, resActividades, resVisitas] = await Promise.all([
    admin
      .from('conversaciones')
      .select('contacto_id, tipo_canal, etapa:etapas_conversacion!etapa_id(etiqueta, color)')
      .in('contacto_id', contactoIds)
      .not('etapa_id', 'is', null)
      .order('ultimo_mensaje_en', { ascending: false })
      .limit(contactoIds.length * 2),
    admin
      .from('actividades')
      .select('vinculo_ids, tipo_id, tipo:tipos_actividad!tipo_id(id, etiqueta, color, icono)')
      .eq('empresa_id', empresaId)
      .filter('vinculo_ids', 'ov', `{${contactoIds.join(',')}}`)
      .eq('en_papelera', false)
      .not('estado_clave', 'in', '(completada,cancelada)'),
    admin
      .from('visitas')
      .select('contacto_id')
      .eq('empresa_id', empresaId)
      .in('contacto_id', contactoIds)
      .eq('en_papelera', false)
      .eq('estado', 'programada'),
  ])

  const etapasPorContacto: Record<string, EtapaContacto> = {}
  if (resEtapas.data) {
    for (const conv of resEtapas.data) {
      if (!conv.contacto_id || etapasPorContacto[conv.contacto_id]) continue
      const etapa = conv.etapa as unknown as { etiqueta: string; color: string } | null
      if (etapa) {
        etapasPorContacto[conv.contacto_id] = {
          etapa_etiqueta: etapa.etiqueta,
          etapa_color: etapa.color,
          tipo_canal: conv.tipo_canal,
        }
      }
    }
  }

  // Una actividad puede estar vinculada a varios contactos; para cada
  // contacto de la página intersectamos `vinculo_ids` y agrupamos por tipo.
  const setIds = new Set(contactoIds)
  const actividadesPorContacto: Record<string, Map<string, TipoActividadResumen>> = {}
  for (const a of resActividades.data || []) {
    const vinculoIds = (a.vinculo_ids as string[] | null) || []
    const tipo = a.tipo as unknown as { id: string; etiqueta: string; color: string; icono: string | null } | null
    if (!tipo) continue
    for (const vid of vinculoIds) {
      if (!setIds.has(vid)) continue
      if (!actividadesPorContacto[vid]) actividadesPorContacto[vid] = new Map()
      const mapaTipos = actividadesPorContacto[vid]
      const existente = mapaTipos.get(tipo.id)
      if (existente) {
        existente.cantidad += 1
      } else {
        mapaTipos.set(tipo.id, {
          tipo_id: tipo.id,
          tipo_etiqueta: tipo.etiqueta,
          tipo_color: tipo.color,
          tipo_icono: tipo.icono,
          cantidad: 1,
        })
      }
    }
  }

  const visitasPorContacto: Record<string, number> = {}
  for (const v of resVisitas.data || []) {
    if (v.contacto_id) {
      visitasPorContacto[v.contacto_id] = (visitasPorContacto[v.contacto_id] || 0) + 1
    }
  }

  for (const id of contactoIds) {
    resultado[id] = {
      ultima_etapa: etapasPorContacto[id] || null,
      actividades_activas: actividadesPorContacto[id]
        ? [...actividadesPorContacto[id].values()]
        : [],
      cantidad_visitas_activas: visitasPorContacto[id] || 0,
    }
  }
  return resultado
}
