import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarError } from '@/lib/logger'

/**
 * GET /api/miembros — Lista de miembros de la empresa activa.
 * Retorna: { miembros: [{ id, usuario_id, rol, activo, perfil: { nombre, apellido, correo }, ... }] }
 * Usado por: filtro "Responsable" en contactos, menú de asignación en conversaciones, etc.
 */
export async function GET(_request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Traer miembros activos — dos queries separadas (más seguro que join ambiguo)
    const { data: miembrosData, error } = await admin
      .from('miembros')
      .select('id, usuario_id, rol, activo, puesto_nombre, sector')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .not('usuario_id', 'is', null)

    if (error) {
      registrarError(error, { ruta: '/api/miembros', accion: 'listar', empresaId })
      return NextResponse.json({ error: 'Error al listar miembros' }, { status: 500 })
    }

    // Enriquecer con perfil en query separada
    const usuarioIds = (miembrosData || []).map(m => m.usuario_id).filter(Boolean)
    const perfilesMap = new Map<string, { nombre: string; apellido: string | null; correo: string | null; avatar_url: string | null }>()
    if (usuarioIds.length > 0) {
      const { data: perfilesData } = await admin
        .from('perfiles')
        .select('id, nombre, apellido, correo, avatar_url')
        .in('id', usuarioIds)
      for (const p of (perfilesData || [])) {
        perfilesMap.set(p.id, { nombre: p.nombre, apellido: p.apellido, correo: p.correo, avatar_url: p.avatar_url })
      }
    }

    const miembros = (miembrosData || []).map(m => {
      const perfil = m.usuario_id ? perfilesMap.get(m.usuario_id) : null
      return {
        id: m.id,
        usuario_id: m.usuario_id,
        rol: m.rol,
        activo: m.activo,
        puesto_nombre: m.puesto_nombre,
        sector: m.sector,
        perfil: perfil || null,
        // Campos flat de acceso rápido
        nombre: perfil?.nombre || null,
        apellido: perfil?.apellido || null,
      }
    })

    return NextResponse.json({ miembros })
  } catch (err) {
    registrarError(err, { ruta: '/api/miembros', accion: 'listar' })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
