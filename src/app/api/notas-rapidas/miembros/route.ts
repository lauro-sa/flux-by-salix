import { NextResponse } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/notas-rapidas/miembros — Listar miembros activos de la empresa.
 * Devuelve usuario_id, nombre y apellido para el selector de compartir.
 * Usa service role para evitar problemas de RLS con la tabla perfiles.
 *
 * Se usa en: PanelNotas (selector de compartir).
 */

export async function GET() {
  try {
    const guard = await requerirPermisoAPI('notas', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    const { data: miembrosRaw } = await admin
      .from('miembros')
      .select('id, usuario_id, activo')
      .eq('empresa_id', empresaId)
      .eq('activo', true)

    if (!miembrosRaw || miembrosRaw.length === 0) {
      return NextResponse.json([])
    }

    // Cargar perfiles por separado (tabla sin empresa_id)
    const usuarioIds = miembrosRaw.map((m) => m.usuario_id)
    const { data: perfiles } = await admin
      .from('perfiles')
      .select('id, nombre, apellido')
      .in('id', usuarioIds)

    const perfilesMapa: Record<string, { nombre: string; apellido: string }> = {}
    if (perfiles) {
      for (const p of perfiles) {
        perfilesMapa[p.id] = { nombre: p.nombre, apellido: p.apellido }
      }
    }

    // Combinar y filtrar al usuario actual
    const miembros = miembrosRaw
      .filter((m) => m.usuario_id !== user.id)
      .map((m) => ({
        id: m.id,
        usuario_id: m.usuario_id,
        nombre: perfilesMapa[m.usuario_id]?.nombre || '',
        apellido: perfilesMapa[m.usuario_id]?.apellido || '',
      }))

    return NextResponse.json(miembros)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
