import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/inbox/mensajes/[id]/lecturas — Quién vio un mensaje específico.
 * Retorna: { leido_por: [{nombre, apellido, leido_en}], sin_leer: [{nombre, apellido}] }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: mensajeId } = await params
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Verificar que el mensaje pertenece a la empresa
    const { data: mensaje } = await admin
      .from('mensajes')
      .select('id, conversacion_id, empresa_id')
      .eq('id', mensajeId)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (!mensaje) return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 })

    // Obtener la conversación para saber el canal interno
    const { data: conv } = await admin
      .from('conversaciones')
      .select('canal_interno_id')
      .eq('id', mensaje.conversacion_id)
      .maybeSingle()

    if (!conv?.canal_interno_id) {
      return NextResponse.json({ leido_por: [], sin_leer: [] })
    }

    // Obtener todos los miembros del canal
    const { data: miembros } = await admin
      .from('canal_interno_miembros')
      .select('usuario_id')
      .eq('canal_id', conv.canal_interno_id)

    const todosIds = (miembros || []).map(m => m.usuario_id)

    // Obtener lecturas de este mensaje
    const { data: lecturas } = await admin
      .from('mensaje_lecturas')
      .select('usuario_id, leido_en')
      .eq('mensaje_id', mensajeId)

    const lecturasMap = new Map((lecturas || []).map(l => [l.usuario_id, l.leido_en]))
    const idsLeidos = new Set(lecturasMap.keys())

    // Obtener perfiles de todos los miembros
    const { data: perfiles } = await admin
      .from('perfiles')
      .select('id, nombre, apellido, avatar_url')
      .in('id', todosIds)

    const perfilMap = new Map((perfiles || []).map(p => [p.id, p]))

    const leido_por = todosIds
      .filter(uid => idsLeidos.has(uid))
      .map(uid => ({
        usuario_id: uid,
        nombre: perfilMap.get(uid)?.nombre || '',
        apellido: perfilMap.get(uid)?.apellido || '',
        avatar_url: perfilMap.get(uid)?.avatar_url || null,
        leido_en: lecturasMap.get(uid) || '',
      }))
      .sort((a, b) => new Date(a.leido_en).getTime() - new Date(b.leido_en).getTime())

    const sin_leer = todosIds
      .filter(uid => !idsLeidos.has(uid))
      .map(uid => ({
        usuario_id: uid,
        nombre: perfilMap.get(uid)?.nombre || '',
        apellido: perfilMap.get(uid)?.apellido || '',
        avatar_url: perfilMap.get(uid)?.avatar_url || null,
      }))

    return NextResponse.json({ leido_por, sin_leer })
  } catch (err) {
    console.error('Error al obtener lecturas:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
