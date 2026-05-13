import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearNotificacion } from '@/lib/notificaciones'
import { sanitizarHtmlNota } from '@/lib/notas/html'

/**
 * PATCH /api/notas-rapidas/[id] — Actualizar una nota (título, contenido, color, fijada, archivada).
 * DELETE /api/notas-rapidas/[id] — Eliminar una nota.
 *
 * Se usa en: PanelNotas (edición inline, archivar, fijar, eliminar).
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requerirPermisoAPI('notas', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const { id } = await params
    const body = await request.json()

    const admin = crearClienteAdmin()

    // Verificar que la nota existe y el usuario tiene acceso
    const { data: nota } = await admin
      .from('notas_rapidas')
      .select('id, creador_id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!nota) return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })

    // Si no es el creador, verificar que tiene permiso de edición
    if (nota.creador_id !== user.id) {
      const { data: compartida } = await admin
        .from('notas_rapidas_compartidas')
        .select('puede_editar')
        .eq('nota_id', id)
        .eq('usuario_id', user.id)
        .single()

      if (!compartida?.puede_editar) {
        return NextResponse.json({ error: 'Sin permiso para editar' }, { status: 403 })
      }
    }

    // Restaurar desde papelera
    if ('en_papelera' in body && body.en_papelera === false) {
      const { data, error } = await admin
        .from('notas_rapidas')
        .update({
          en_papelera: false,
          papelera_en: null,
          actualizado_en: new Date().toISOString(),
          actualizado_por: user.id,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: 'Error al restaurar' }, { status: 500 })
      return NextResponse.json(data)
    }

    // Campos permitidos para actualizar
    const campos_validos = ['titulo', 'contenido', 'color', 'fijada', 'archivada'] as const
    const actualizacion: Record<string, unknown> = {
      actualizado_en: new Date().toISOString(),
      actualizado_por: user.id,
    }

    for (const campo of campos_validos) {
      if (campo in body) {
        // El contenido es HTML de Tiptap: sanitizar para bloquear scripts
        // / iframes / eventos inline que pudieran inyectarse desde un
        // cliente comprometido. El resto de campos se pasan tal cual.
        if (campo === 'contenido' && typeof body[campo] === 'string') {
          actualizacion[campo] = sanitizarHtmlNota(body[campo])
        } else {
          actualizacion[campo] = body[campo]
        }
      }
    }

    const { data, error } = await admin
      .from('notas_rapidas')
      .update(actualizacion)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

    // Notificar a compartidos si se editó contenido o título (no color/fijada)
    const esEdicionContenido = 'titulo' in body || 'contenido' in body
    if (esEdicionContenido) {
      // Obtener todos los compartidos + el creador (si el editor no es el creador)
      const usuariosANotificar: string[] = []

      // Compartidos con esta nota
      const { data: compartidos } = await admin
        .from('notas_rapidas_compartidas')
        .select('usuario_id')
        .eq('nota_id', id)

      if (compartidos) {
        for (const c of compartidos) {
          if (c.usuario_id !== user.id) usuariosANotificar.push(c.usuario_id)
        }
      }

      // Si el editor no es el creador, notificar al creador también
      if (nota.creador_id !== user.id) {
        usuariosANotificar.push(nota.creador_id)
      }

      if (usuariosANotificar.length > 0) {
        const { data: perfil } = await admin
          .from('perfiles')
          .select('nombre, apellido')
          .eq('id', user.id)
          .single()

        const nombreEditor = perfil ? `${perfil.nombre} ${perfil.apellido}` : 'Alguien'
        const tituloNota = data.titulo || 'Sin título'

        for (const uid of usuariosANotificar) {
          crearNotificacion({
            empresaId,
            usuarioId: uid,
            tipo: 'nota_editada',
            titulo: `${nombreEditor} editó una nota compartida`,
            cuerpo: `"${tituloNota}"`,
            icono: '✏️',
            color: '#f59e0b',
            referenciaTipo: 'nota_rapida',
            referenciaId: id,
          }).catch(() => {})
        }
      }
    }

    return NextResponse.json(data)
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
    const admin = crearClienteAdmin()

    // Solo el creador puede eliminar
    const { data: nota } = await admin
      .from('notas_rapidas')
      .select('id, titulo, creador_id, en_papelera')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!nota) return NextResponse.json({ error: 'Nota no encontrada' }, { status: 404 })
    if (nota.creador_id !== user.id) {
      return NextResponse.json({ error: 'Solo el creador puede eliminar' }, { status: 403 })
    }

    // Avisar a los compartidos ANTES del delete — para que tengan la
    // notificación con el título de la nota mientras todavía existe.
    // Solo en el soft-delete (la primera eliminación, no en el hard
    // desde papelera porque ahí ya no es visible para nadie).
    if (!nota.en_papelera) {
      const { data: compartidos } = await admin
        .from('notas_rapidas_compartidas')
        .select('usuario_id')
        .eq('nota_id', id)

      const usuariosANotificar = (compartidos ?? [])
        .map((c) => c.usuario_id)
        .filter((uid): uid is string => Boolean(uid))

      if (usuariosANotificar.length > 0) {
        const { data: perfil } = await admin
          .from('perfiles')
          .select('nombre, apellido')
          .eq('id', user.id)
          .single()

        const nombreCreador = perfil
          ? `${perfil.nombre || ''} ${perfil.apellido || ''}`.trim() || 'Alguien'
          : 'Alguien'
        const tituloNota = nota.titulo || 'Sin título'

        for (const uid of usuariosANotificar) {
          crearNotificacion({
            empresaId,
            usuarioId: uid,
            tipo: 'nota_eliminada',
            titulo: `${nombreCreador} eliminó una nota compartida`,
            cuerpo: `"${tituloNota}"`,
            icono: '🗑️',
            color: '#dc2626',
            referenciaTipo: 'nota_rapida',
            referenciaId: id,
          }).catch(() => {})
        }
      }
    }

    // Si ya está en papelera, eliminar definitivamente (hard delete).
    // El cascade de notas_rapidas_compartidas se ocupa de limpiar
    // los registros de compartidos.
    if (nota.en_papelera) {
      await admin.from('notas_rapidas').delete().eq('id', id)
      return NextResponse.json({ ok: true })
    }

    // Soft delete: enviar a papelera
    await admin
      .from('notas_rapidas')
      .update({
        en_papelera: true,
        papelera_en: new Date().toISOString(),
        actualizado_por: user.id,
      })
      .eq('id', id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
