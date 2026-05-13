import { NextResponse } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/notas-rapidas/miembros — Listar miembros de la empresa para
 * resolver nombres en el panel de notas.
 *
 * Devuelve TODOS los miembros con `usuario_id` (incluye inactivos y al
 * propio usuario actual), porque el endpoint sirve dos propósitos:
 *
 *   1) Selector de compartir → el cliente filtra `activo` y excluye al
 *      usuario actual.
 *   2) Resolver nombres en avatares de `_compartidos_con` → necesitamos
 *      poder mostrar el nombre incluso si el miembro fue desactivado
 *      después de compartir, o si por algún caso edge aparece el propio
 *      usuario en la lista.
 *
 * Sin esta unificación, los avatares de compartidos caen al fallback
 * "?" cuando el destinatario está fuera del filtro del selector.
 *
 * Usa service role para evitar problemas de RLS con la tabla perfiles.
 */

interface MiembroResponse {
  id: string
  usuario_id: string
  nombre: string
  apellido: string
  activo: boolean
  /** True si este miembro corresponde al usuario que hace la consulta. */
  es_yo: boolean
}

export async function GET() {
  try {
    const guard = await requerirPermisoAPI('notas', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    // Traemos todos los miembros (activos e inactivos) que tengan
    // usuario_id. Los miembros en modo "Solo fichaje" (usuario_id null)
    // no pueden recibir notas compartidas, así que los excluimos.
    const { data: miembrosRaw } = await admin
      .from('miembros')
      .select('id, usuario_id, activo')
      .eq('empresa_id', empresaId)
      .not('usuario_id', 'is', null)

    if (!miembrosRaw || miembrosRaw.length === 0) {
      return NextResponse.json([])
    }

    const usuarioIds = miembrosRaw
      .map((m) => m.usuario_id)
      .filter((id): id is string => Boolean(id))

    const { data: perfiles } = await admin
      .from('perfiles')
      .select('id, nombre, apellido')
      .in('id', usuarioIds)

    const perfilesMapa: Record<string, { nombre: string | null; apellido: string | null }> = {}
    if (perfiles) {
      for (const p of perfiles) {
        perfilesMapa[p.id] = { nombre: p.nombre, apellido: p.apellido }
      }
    }

    const miembros: MiembroResponse[] = miembrosRaw.map((m) => {
      const perfil = perfilesMapa[m.usuario_id as string]
      return {
        id: m.id,
        usuario_id: m.usuario_id as string,
        // Normalizamos null/undefined a '' para que el cliente pueda
        // construir nombre completo sin tener "null" / "undefined" en el
        // template literal.
        nombre: (perfil?.nombre ?? '').trim(),
        apellido: (perfil?.apellido ?? '').trim(),
        activo: m.activo === true,
        es_yo: m.usuario_id === user.id,
      }
    })

    return NextResponse.json(miembros)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
