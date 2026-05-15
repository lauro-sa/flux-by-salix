/**
 * Busca miembros activos de la empresa que coincidan con un texto libre.
 *
 * Fuente del nombre: `contactos` (vinculados por `contactos.miembro_id`).
 * Todo miembro tiene su contacto: lo garantizan los endpoints de creación
 * (`/api/miembros/*`, `/api/empresas/crear`, `/api/invitaciones/aceptar`,
 * `/api/auth/registro`) más el trigger SQL `trg_sync_perfil_a_contactos`
 * que mantiene sincronizado el nombre/apellido cuando se edita el perfil.
 *
 * Búsqueda insensible a acentos y mayúsculas. Cada palabra de la búsqueda
 * (>= 2 caracteres) debe estar contenida en el "nombre apellido" del miembro.
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

  const { data: contactosData } = await admin
    .from('contactos')
    .select('miembro_id, nombre, apellido')
    .eq('empresa_id', empresa_id)
    .in('miembro_id', lista.map(m => m.id))

  const contactosMap = new Map<string, { nombre: string; apellido: string | null }>()
  for (const c of (contactosData || []) as Array<{ miembro_id: string | null; nombre: string | null; apellido: string | null }>) {
    if (c.miembro_id) contactosMap.set(c.miembro_id, { nombre: c.nombre || '', apellido: c.apellido })
  }

  const palabrasNorm = palabras.map(normalizarBusqueda)

  return lista
    .map(m => {
      const contacto = contactosMap.get(m.id)
      const nombre = contacto?.nombre || ''
      const apellido = contacto?.apellido || null
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
