/**
 * Helper para resolver la "identidad" de un miembro (nombre, apellido,
 * correo, etc.) consolidando dos fuentes:
 *
 *   1. `perfiles` — para miembros con cuenta de Flux (usuario_id != null).
 *   2. `contactos` con `miembro_id` apuntando al miembro — para
 *      empleados sin cuenta de Flux que fueron cargados manualmente.
 *      A esto le llamamos "contacto-equipo".
 *
 * Antes esta lógica estaba duplicada en `/api/miembros`, `/api/miembros/[id]`
 * y `/api/nominas/empleados`, y los lugares de nóminas que no la
 * implementaban mostraban "—" para los empleados sin cuenta. Este helper
 * la centraliza para que cualquier endpoint del módulo nóminas (motor de
 * cálculo, listado de empleados, ficha laboral) trate por igual a todos
 * los miembros activos, tengan o no cuenta de Flux.
 *
 * Devuelve un `Map<miembro_id, IdentidadMiembro>`. Si un miembro no tiene
 * ni perfil ni contacto-equipo, no aparece en el map (el caller decide
 * cómo mostrarlo — típicamente "—").
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Datos de identidad consolidados desde perfil o contacto-equipo. */
export interface IdentidadMiembro {
  nombre: string | null
  apellido: string | null
  correo: string | null
  telefono: string | null
  /**
   * Correo corporativo asignado dentro de la empresa. Solo lo tienen
   * miembros con cuenta de Flux — para contacto-equipo siempre es null.
   */
  correo_empresa: string | null
  /** Idem: solo aplica a miembros con cuenta de Flux. */
  telefono_empresa: string | null
  /** Solo presente cuando viene de perfil (los contactos-equipo no tienen avatar). */
  avatar_url: string | null
  /** De dónde se resolvió (útil para debug / decisiones de UI). */
  fuente: 'perfil' | 'contacto_equipo'
}

interface MiembroMinimo {
  id: string
  usuario_id: string | null
}

/**
 * Resuelve identidades en bulk para un set de miembros. Hace como mucho
 * dos queries: una a `perfiles` (para los que tienen `usuario_id`) y otra
 * a `contactos` (para los que no).
 */
export async function cargarIdentidadMiembros(
  admin: SupabaseClient,
  miembros: MiembroMinimo[],
  empresaId: string,
): Promise<Map<string, IdentidadMiembro>> {
  const mapa = new Map<string, IdentidadMiembro>()
  if (miembros.length === 0) return mapa

  const conCuenta = miembros.filter(m => !!m.usuario_id)
  const sinCuenta = miembros.filter(m => !m.usuario_id)

  // ─── 1) Perfiles (miembros con cuenta) ───
  if (conCuenta.length > 0) {
    const usuarioIds = conCuenta.map(m => m.usuario_id as string)
    const { data: perfiles } = await admin
      .from('perfiles')
      .select('id, nombre, apellido, correo, correo_empresa, telefono, telefono_empresa, avatar_url')
      .in('id', usuarioIds)

    const porUsuarioId = new Map<string, IdentidadMiembro>()
    for (const p of perfiles ?? []) {
      porUsuarioId.set(p.id, {
        nombre: p.nombre ?? null,
        apellido: p.apellido ?? null,
        correo: p.correo ?? null,
        correo_empresa: p.correo_empresa ?? null,
        telefono: p.telefono ?? null,
        telefono_empresa: p.telefono_empresa ?? null,
        avatar_url: p.avatar_url ?? null,
        fuente: 'perfil',
      })
    }

    for (const m of conCuenta) {
      const perfil = porUsuarioId.get(m.usuario_id as string)
      if (perfil) mapa.set(m.id, perfil)
    }
  }

  // ─── 2) Contacto-equipo (miembros sin cuenta) ───
  if (sinCuenta.length > 0) {
    const miembroIds = sinCuenta.map(m => m.id)
    const { data: contactos } = await admin
      .from('contactos')
      .select('miembro_id, nombre, apellido, correo, telefono')
      .in('miembro_id', miembroIds)
      .eq('empresa_id', empresaId)
      .eq('en_papelera', false)

    for (const c of contactos ?? []) {
      if (!c.miembro_id) continue
      mapa.set(c.miembro_id, {
        nombre: c.nombre ?? null,
        apellido: c.apellido ?? null,
        correo: c.correo ?? null,
        correo_empresa: null,
        telefono: c.telefono ?? null,
        telefono_empresa: null,
        avatar_url: null,
        fuente: 'contacto_equipo',
      })
    }
  }

  return mapa
}

/**
 * Helper para una sola identidad. Conveniente cuando hay un único miembro
 * (ej. endpoint `/api/miembros/[id]`).
 */
export async function obtenerIdentidadMiembro(
  admin: SupabaseClient,
  miembro: MiembroMinimo,
  empresaId: string,
): Promise<IdentidadMiembro | null> {
  const mapa = await cargarIdentidadMiembros(admin, [miembro], empresaId)
  return mapa.get(miembro.id) ?? null
}
