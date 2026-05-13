import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearNotificacion } from '@/lib/notificaciones'

/**
 * POST /api/notas-rapidas/[id]/compartir — Compartir nota con usuarios.
 * DELETE /api/notas-rapidas/[id]/compartir — Dejar de compartir con un usuario.
 *
 * Se usa en: PanelNotas (selector de usuarios para compartir).
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requerirPermisoAPI('notas', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const { id } = await params
    const body = await request.json()
    const { usuario_id, puede_editar = true } = body

    if (!usuario_id) return NextResponse.json({ error: 'usuario_id requerido' }, { status: 400 })

    const admin = crearClienteAdmin()

    // Verificar que es el creador de la nota
    const { data: nota } = await admin
      .from('notas_rapidas')
      .select('id, creador_id, titulo')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!nota) return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })
    if (nota.creador_id !== user.id) {
      return NextResponse.json({ error: 'Solo el creador puede compartir' }, { status: 403 })
    }

    // No compartir consigo mismo
    if (usuario_id === user.id) {
      return NextResponse.json({ error: 'No puedes compartir contigo mismo' }, { status: 400 })
    }

    // Upsert para evitar duplicados a nivel de nota-usuario
    const { error } = await admin
      .from('notas_rapidas_compartidas')
      .upsert({
        nota_id: id,
        usuario_id,
        puede_editar,
      }, { onConflict: 'nota_id,usuario_id' })

    if (error) return NextResponse.json({ error: 'Error al compartir' }, { status: 500 })

    // Notificación + push al usuario con quien se comparte
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()

    const nombreCreador = perfil ? `${perfil.nombre} ${perfil.apellido}` : 'Alguien'
    const tituloNota = nota.titulo || 'Sin título'

    await crearNotificacion({
      empresaId,
      usuarioId: usuario_id,
      tipo: 'nota_compartida',
      titulo: `${nombreCreador} compartió una nota contigo`,
      cuerpo: `"${tituloNota}"`,
      icono: '📝',
      color: '#f59e0b',
      referenciaTipo: 'nota_rapida',
      referenciaId: id,
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requerirPermisoAPI('notas', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const { id } = await params
    const body = await request.json()
    const { usuario_id } = body

    if (!usuario_id) return NextResponse.json({ error: 'usuario_id requerido' }, { status: 400 })

    const admin = crearClienteAdmin()

    // Verificar que es el creador
    const { data: nota } = await admin
      .from('notas_rapidas')
      .select('id, titulo, creador_id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!nota) return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })
    if (nota.creador_id !== user.id) {
      return NextResponse.json({ error: 'Solo el creador puede gestionar compartidos' }, { status: 403 })
    }

    await admin
      .from('notas_rapidas_compartidas')
      .delete()
      .eq('nota_id', id)
      .eq('usuario_id', usuario_id)

    // Avisar al usuario que ya no tiene acceso — útil porque la nota
    // simplemente desaparece de su panel y sino no sabría por qué.
    // Fire-and-forget: si falla, no rompemos la operación principal.
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()

    const nombreCreador = perfil
      ? `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim() || 'Alguien'
      : 'Alguien'
    const tituloNota = nota.titulo || 'Sin título'

    crearNotificacion({
      empresaId,
      usuarioId: usuario_id,
      tipo: 'nota_descompartida',
      titulo: `${nombreCreador} dejó de compartir una nota contigo`,
      cuerpo: `"${tituloNota}"`,
      icono: '🔕',
      color: '#6b7280',
      referenciaTipo: 'nota_rapida',
      referenciaId: id,
    }).catch(() => {})

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
