import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

const ESTADOS_VALIDOS = ['abierta', 'en_espera', 'resuelta', 'spam'] as const

/**
 * GET /api/inbox/conversaciones/[id] — Detalle de una conversación.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { data, error } = await admin
      .from('conversaciones')
      .select(`
        *,
        canal:canales_inbox!canal_id(id, nombre, tipo, proveedor, estado_conexion)
      `)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    return NextResponse.json({ conversacion: data })
  } catch (err) {
    console.error('Error al obtener conversación:', err)
    return NextResponse.json({ error: 'Error al obtener conversación' }, { status: 500 })
  }
}

/**
 * PATCH /api/inbox/conversaciones/[id] — Actualizar conversación.
 * Se usa para: cambiar estado, asignar agente, cambiar prioridad, vincular contacto.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()

    // Validar estado si se envía
    if (body.estado !== undefined && !ESTADOS_VALIDOS.includes(body.estado)) {
      return NextResponse.json({ error: `Estado inválido. Permitidos: ${ESTADOS_VALIDOS.join(', ')}` }, { status: 400 })
    }

    // Validar mensajes_sin_leer si se envía
    if (body.mensajes_sin_leer !== undefined && (typeof body.mensajes_sin_leer !== 'number' || body.mensajes_sin_leer < 0)) {
      return NextResponse.json({ error: 'mensajes_sin_leer debe ser un número >= 0' }, { status: 400 })
    }

    const camposPermitidos = [
      'estado', 'prioridad', 'asignado_a', 'asignado_a_nombre',
      'contacto_id', 'contacto_nombre', 'asunto', 'etiquetas',
      'mensajes_sin_leer', 'etapa_id',
      'snooze_hasta', 'snooze_nota', 'snooze_por',
      'sector_id', 'sector_nombre', 'sector_color',
      'chatbot_activo', 'agente_ia_activo', 'chatbot_pausado_hasta', 'ia_pausado_hasta',
      'bloqueada', 'en_pipeline', 'en_papelera', 'papelera_en',
    ]
    const cambios: Record<string, unknown> = { actualizado_en: new Date().toISOString() }

    for (const campo of camposPermitidos) {
      if (body[campo] !== undefined) {
        cambios[campo] = body[campo]
      }
    }

    // Exclusión mutua: chatbot vs agente IA
    if (body.chatbot_activo === true) {
      cambios.agente_ia_activo = false
      cambios.ia_pausado_hasta = null
    }
    if (body.agente_ia_activo === true) {
      cambios.chatbot_activo = false
      cambios.chatbot_pausado_hasta = null
    }

    // Al mover a papelera, registrar timestamp
    if (body.en_papelera === true) {
      cambios.papelera_en = new Date().toISOString()
    }

    // Si se cierra la conversación
    if (body.estado === 'resuelta') {
      cambios.cerrado_en = new Date().toISOString()
      cambios.cerrado_por = user.id
    }

    const admin = crearClienteAdmin()

    // ─── Helper: insertar mensaje de sistema en la conversación ───
    const nombreCompleto = `${user.user_metadata?.nombre || ''} ${user.user_metadata?.apellido || ''}`.trim() || 'Usuario'
    const insertarSistema = async (texto: string) => {
      await admin.from('mensajes').insert({
        empresa_id: empresaId,
        conversacion_id: id,
        es_entrante: false,
        remitente_tipo: 'sistema',
        remitente_id: user.id,
        remitente_nombre: nombreCompleto,
        tipo_contenido: 'texto',
        texto,
        es_nota_interna: true, // solo visible para agentes
        estado: 'enviado',
        reacciones: {},
        metadata: {},
      })
    }

    // ─── Registrar cambios con mensajes de sistema ───

    // Asignación de agente
    if (body.asignado_a !== undefined) {
      await admin.from('asignaciones_inbox').insert({
        empresa_id: empresaId,
        conversacion_id: id,
        usuario_id: body.asignado_a,
        usuario_nombre: body.asignado_a_nombre || null,
        tipo: body.tipo_asignacion || 'manual',
        asignado_por: user.id,
        asignado_por_nombre: nombreCompleto,
        notas: body.notas_asignacion || null,
      })

      if (body.asignado_a) {
        await insertarSistema(`asignó a ${body.asignado_a_nombre || 'un agente'}`)
      } else {
        await insertarSistema('quitó la asignación de agente')
      }

      // Notificar al agente asignado (push + sistema)
      if (body.asignado_a && body.asignado_a !== user.id) {
        const { crearNotificacion } = await import('@/lib/notificaciones')
        const { data: conv } = await admin
          .from('conversaciones')
          .select('contacto_nombre, identificador_externo')
          .eq('id', id)
          .single()
        const contacto = conv?.contacto_nombre || conv?.identificador_externo || 'una conversación'
        await crearNotificacion({
          empresaId,
          usuarioId: body.asignado_a,
          tipo: 'asignacion',
          titulo: 'Te asignaron una conversación',
          cuerpo: `${nombreCompleto} te asignó la conversación de ${contacto}`,
          icono: '👤',
          color: '#0ea5e9',
          url: `/inbox?conv=${id}&tab=whatsapp`,
          referenciaTipo: 'conversacion',
          referenciaId: id,
        })
      }
    }

    // Cambio de etapa
    if (body.etapa_id !== undefined) {
      if (body.etapa_id) {
        const { data: etapa } = await admin
          .from('etapas_conversacion')
          .select('etiqueta')
          .eq('id', body.etapa_id)
          .single()
        await insertarSistema(`movió a "${etapa?.etiqueta || 'desconocida'}"${body.nota_etapa ? ` — ${body.nota_etapa}` : ''}`)
      } else {
        await insertarSistema('quitó la etapa')
      }
    }

    // Cambio de sector
    if (body.sector_id !== undefined) {
      if (body.sector_nombre) {
        await insertarSistema(`asignó al sector "${body.sector_nombre}"`)
      } else {
        await insertarSistema('quitó el sector')
      }
    }

    // Cambio de estado
    if (body.estado !== undefined) {
      const etiquetas: Record<string, string> = {
        abierta: 'reabrió la conversación',
        en_espera: 'puso en espera',
        resuelta: 'resolvió la conversación',
        spam: 'marcó como spam',
      }
      if (etiquetas[body.estado]) {
        await insertarSistema(etiquetas[body.estado])
      }
    }

    // Bot / IA
    if (body.chatbot_activo === true) {
      await insertarSistema('activó el chatbot')
    } else if (body.chatbot_activo === false && body.chatbot_pausado_hasta) {
      await insertarSistema('pausó el chatbot')
    } else if (body.chatbot_activo === false && !body.chatbot_pausado_hasta) {
      await insertarSistema('desactivó el chatbot')
    }

    if (body.agente_ia_activo === true) {
      await insertarSistema('activó el agente IA')
    } else if (body.agente_ia_activo === false && body.ia_pausado_hasta) {
      await insertarSistema('pausó el agente IA')
    } else if (body.agente_ia_activo === false && !body.ia_pausado_hasta) {
      await insertarSistema('desactivó el agente IA')
    }

    // Bloqueo
    if (body.bloqueada === true) {
      await insertarSistema('bloqueó este número')
    } else if (body.bloqueada === false) {
      await insertarSistema('desbloqueó este número')
    }

    // Papelera
    if (body.en_papelera === true) {
      await insertarSistema('movió a la papelera')
    }

    const { data, error } = await admin
      .from('conversaciones')
      .update(cambios)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ conversacion: data })
  } catch (err) {
    console.error('Error al actualizar conversación:', err)
    return NextResponse.json({ error: 'Error al actualizar conversación' }, { status: 500 })
  }
}

/**
 * DELETE /api/inbox/conversaciones/[id] — Eliminar conversación y sus mensajes.
 * Elimina de la BD (mensajes + conversación). No toca servidores externos (IMAP/Gmail).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de eliminar
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'inbox_correo', 'eliminar')
    if (!permitido) {
      return NextResponse.json({ error: 'Sin permiso para eliminar conversaciones' }, { status: 403 })
    }

    const admin = crearClienteAdmin()

    // Verificar que la conversación pertenece a la empresa
    const { data: conv } = await admin
      .from('conversaciones')
      .select('id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!conv) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 })
    }

    // Eliminar mensajes de la conversación
    await admin
      .from('mensajes')
      .delete()
      .eq('conversacion_id', id)

    // Eliminar la conversación
    const { error } = await admin
      .from('conversaciones')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al eliminar conversación:', err)
    return NextResponse.json({ error: 'Error al eliminar conversación' }, { status: 500 })
  }
}
