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

    // Verificar unicidad: no puede haber otra nota del creador compartida
    // con exactamente los mismos usuarios (evitar duplicados de notas compartidas)
    // Primero, obtener los compartidos actuales de esta nota + el nuevo
    const { data: compartidosActuales } = await admin
      .from('notas_rapidas_compartidas')
      .select('usuario_id')
      .eq('nota_id', id)

    const idsCompartidos = [...(compartidosActuales ?? []).map((c) => c.usuario_id), usuario_id]
      .sort()

    // Buscar otras notas del mismo creador que tengan exactamente los mismos compartidos
    const { data: otrasNotas } = await admin
      .from('notas_rapidas')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('creador_id', user.id)
      .eq('archivada', false)
      .neq('id', id)

    if (otrasNotas && otrasNotas.length > 0) {
      for (const otra of otrasNotas) {
        const { data: otrosCompartidos } = await admin
          .from('notas_rapidas_compartidas')
          .select('usuario_id')
          .eq('nota_id', otra.id)

        const idsOtra = (otrosCompartidos ?? []).map((c) => c.usuario_id).sort()
        if (idsOtra.length === idsCompartidos.length && idsOtra.every((id, i) => id === idsCompartidos[i])) {
          return NextResponse.json({
            error: 'Ya tenés una nota compartida con estas mismas personas',
          }, { status: 409 })
        }
      }
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
      .select('id, creador_id')
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

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
