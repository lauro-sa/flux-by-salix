/**
 * Busca miembros activos de la empresa que coincidan con un texto libre.
 *
 * Resuelve nombre desde dos fuentes:
 * - `perfiles` (miembros con cuenta Flux)
 * - `contactos` (miembros sin cuenta Flux, vinculados por `contactos.miembro_id`)
 *
 * La búsqueda es insensible a acentos y mayúsculas. Cada palabra de la búsqueda
 * (>= 2 caracteres) debe estar contenida en el "nombre apellido" del miembro.
 *
 * Devuelve la lista de candidatos para que el llamador decida si pedir
 * desambiguación, error 0-matches, o usar el match único.
 */

import type { SupabaseAdmin } from '@/tipos/salix-ia'
import { normalizarBusqueda } from '@/lib/validaciones'

export interface CandidatoMiembro {
  miembro_id: string
  usuario_id: string | null
  nombre: string
  apellido: string | null
  compensacion_frecuencia: string | null
  nombre_completo: string
}

export async function buscarMiembroPorTexto(
  admin: SupabaseAdmin,
  empresa_id: string,
  busqueda: string
): Promise<CandidatoMiembro[]> {
  const palabras = busqueda.trim().split(/\s+/).filter(p => p.length >= 2)
  if (palabras.length === 0) return []

  const { data: miembros } = await admin
    .from('miembros')
    .select('id, usuario_id, compensacion_frecuencia')
    .eq('empresa_id', empresa_id)
    .eq('activo', true)
    .limit(200)

  const lista = (miembros || []) as Array<{
    id: string
    usuario_id: string | null
    compensacion_frecuencia: string | null
  }>

  if (lista.length === 0) return []

  const usuarioIds = lista.map(m => m.usuario_id).filter((u): u is string => !!u)
  const miembroIds = lista.map(m => m.id)

  const perfilesMap = new Map<string, { nombre: string; apellido: string | null }>()
  if (usuarioIds.length > 0) {
    const { data: perfilesData } = await admin
      .from('perfiles')
      .select('id, nombre, apellido')
      .in('id', usuarioIds)
    for (const p of (perfilesData || []) as Array<{ id: string; nombre: string; apellido: string | null }>) {
      perfilesMap.set(p.id, { nombre: p.nombre, apellido: p.apellido })
    }
  }

  // Contactos vinculados: cubre empleados sin cuenta Flux.
  const contactosMap = new Map<string, { nombre: string; apellido: string | null }>()
  const { data: contactosData } = await admin
    .from('contactos')
    .select('miembro_id, nombre, apellido')
    .eq('empresa_id', empresa_id)
    .in('miembro_id', miembroIds)
  for (const c of (contactosData || []) as Array<{ miembro_id: string | null; nombre: string | null; apellido: string | null }>) {
    if (!c.miembro_id) continue
    contactosMap.set(c.miembro_id, { nombre: c.nombre || '', apellido: c.apellido })
  }

  const palabrasNorm = palabras.map(normalizarBusqueda)

  return lista
    .map(m => {
      const perfil = m.usuario_id ? perfilesMap.get(m.usuario_id) : null
      const contacto = contactosMap.get(m.id)
      const fuente = perfil && (perfil.nombre || perfil.apellido) ? perfil : contacto
      const nombre = fuente?.nombre || ''
      const apellido = fuente?.apellido || null
      return {
        miembro_id: m.id,
        usuario_id: m.usuario_id,
        nombre,
        apellido,
        compensacion_frecuencia: m.compensacion_frecuencia,
        nombre_completo: [nombre, apellido].filter(Boolean).join(' '),
      } satisfies CandidatoMiembro
    })
    .filter(c => {
      const norm = normalizarBusqueda(c.nombre_completo)
      return palabrasNorm.every(p => norm.includes(p))
    })
}
