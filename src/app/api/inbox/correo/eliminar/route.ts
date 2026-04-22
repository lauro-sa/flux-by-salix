import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import type { ConfigIMAP } from '@/tipos/inbox'

/**
 * POST /api/inbox/correo/eliminar — Elimina un correo de Flux y del servidor IMAP/Gmail.
 * Body: { conversacion_id, mensaje_id? }
 * - Si solo viene conversacion_id: elimina toda la conversación (todos los mensajes)
 * - Si viene mensaje_id: elimina solo ese mensaje del hilo
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('inbox_correo', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const { conversacion_id, mensaje_id } = await request.json()
    if (!conversacion_id) {
      return NextResponse.json({ error: 'conversacion_id requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener conversación y canal
    const { data: conversacion } = await admin
      .from('conversaciones')
      .select('id, canal_id, tipo_canal')
      .eq('id', conversacion_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!conversacion) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    // Obtener canal para saber el proveedor
    const { data: canal } = await admin
      .from('canales_correo')
      .select('id, proveedor, config_conexion')
      .eq('id', conversacion.canal_id)
      .single()

    if (!canal) {
      return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })
    }

    // Obtener mensajes a eliminar
    let queryMensajes = admin
      .from('mensajes')
      .select('id, metadata, correo_message_id')
      .eq('conversacion_id', conversacion_id)
      .eq('empresa_id', empresaId)

    if (mensaje_id) {
      queryMensajes = queryMensajes.eq('id', mensaje_id)
    }

    const { data: mensajes } = await queryMensajes

    if (!mensajes || mensajes.length === 0) {
      return NextResponse.json({ error: 'Sin mensajes para eliminar' }, { status: 400 })
    }

    // Eliminar del servidor IMAP si corresponde
    if (canal.proveedor === 'imap') {
      try {
        await eliminarDeIMAP(
          canal.config_conexion as ConfigIMAP,
          mensajes.map(m => {
            const meta = m.metadata as Record<string, unknown>
            // El gmail_id para IMAP es "imap_{UID}"
            const gmailId = (meta?.gmail_id as string) || ''
            const uid = parseInt(gmailId.replace('imap_', ''))
            return isNaN(uid) ? 0 : uid
          }).filter(uid => uid > 0)
        )
      } catch (err) {
        console.error('Error eliminando de IMAP:', err)
        // Continuar eliminando de Flux aunque falle IMAP
      }
    } else if (canal.proveedor === 'gmail_oauth') {
      try {
        const config = canal.config_conexion as { refresh_token: string }
        await eliminarDeGmail(
          config.refresh_token,
          mensajes.map(m => {
            const meta = m.metadata as Record<string, unknown>
            return (meta?.gmail_id as string) || ''
          }).filter(Boolean)
        )
      } catch (err) {
        console.error('Error eliminando de Gmail:', err)
      }
    }

    // Eliminar de Flux
    if (mensaje_id) {
      // Eliminar solo un mensaje
      await admin.from('mensaje_adjuntos').delete().eq('mensaje_id', mensaje_id)
      await admin.from('mensajes').delete().eq('id', mensaje_id).eq('empresa_id', empresaId)

      // Verificar si quedan mensajes en la conversación
      const { count } = await admin
        .from('mensajes')
        .select('id', { count: 'exact', head: true })
        .eq('conversacion_id', conversacion_id)

      if (count === 0) {
        // Sin mensajes: eliminar conversación
        await admin.from('conversaciones').delete().eq('id', conversacion_id)
      } else {
        // Actualizar último mensaje de la conversación
        const { data: ultimoMsg } = await admin
          .from('mensajes')
          .select('texto, creado_en, es_entrante')
          .eq('conversacion_id', conversacion_id)
          .order('creado_en', { ascending: false })
          .limit(1)
          .single()

        if (ultimoMsg) {
          await admin.from('conversaciones').update({
            ultimo_mensaje_texto: ultimoMsg.texto?.slice(0, 200) || null,
            ultimo_mensaje_en: ultimoMsg.creado_en,
            ultimo_mensaje_es_entrante: ultimoMsg.es_entrante,
            actualizado_en: new Date().toISOString(),
          }).eq('id', conversacion_id)
        }
      }
    } else {
      // Eliminar toda la conversación
      // Los mensajes y adjuntos se borran en cascada por FK
      await admin.from('conversaciones').delete().eq('id', conversacion_id)
    }

    return NextResponse.json({ ok: true, eliminados: mensajes.length })
  } catch (err) {
    console.error('Error eliminando correo:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// ─── Eliminar de IMAP ───

async function eliminarDeIMAP(config: ConfigIMAP, uids: number[]): Promise<void> {
  if (uids.length === 0) return

  const { conectarIMAP, desconectarIMAP } = await import('@/lib/correo-imap')
  const cliente = await conectarIMAP(config)

  try {
    const lock = await cliente.getMailboxLock('INBOX')
    try {
      // Marcar como eliminados
      await cliente.messageFlagsAdd({ uid: uids.join(',') }, ['\\Deleted'], { uid: true })
      // Expunge: eliminar permanentemente
      await cliente.messageDelete({ uid: uids.join(',') }, { uid: true })
    } finally {
      lock.release()
    }
  } finally {
    await desconectarIMAP(cliente)
  }
}

// ─── Eliminar de Gmail ───

async function eliminarDeGmail(refreshToken: string, messageIds: string[]): Promise<void> {
  if (messageIds.length === 0) return

  const { crearClienteGmail } = await import('@/lib/gmail')
  const gmail = crearClienteGmail(refreshToken)

  // Gmail: mover a papelera (no eliminar permanentemente)
  for (const id of messageIds) {
    try {
      await gmail.users.messages.trash({ userId: 'me', id })
    } catch (err) {
      console.error(`Error moviendo mensaje ${id} a papelera:`, err)
    }
  }
}
