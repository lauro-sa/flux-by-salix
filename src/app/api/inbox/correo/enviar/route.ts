import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import {
  enviarCorreoGmail,
  extraerEmail,
  type OpcionesMensajeRFC2822,
} from '@/lib/gmail'
import type { ConfigIMAP } from '@/tipos/inbox'
import { generarNombreRemitente } from '@/lib/nombre-remitente'
import { registrarCorreoEnChatter } from '@/lib/chatter'

/**
 * POST /api/inbox/correo/enviar — Enviar correo electrónico.
 * Soporta: nuevo, responder, responder a todos, reenviar.
 * Patrón similar a /api/inbox/whatsapp/enviar.
 */
export async function POST(request: NextRequest) {
  try {
    // Detectar llamada desde cron (envío programado) via headers internos
    const programadoPor = request.headers.get('x-programado-por')
    const empresaIdCron = request.headers.get('x-empresa-id')
    const esProgramado = !!(programadoPor && empresaIdCron)

    let userId: string
    let empresaId: string

    if (esProgramado) {
      // Llamada interna del cron — usar datos del header
      userId = programadoPor
      empresaId = empresaIdCron
    } else {
      // Llamada normal de usuario — requiere sesión
      const supabase = await crearClienteServidor()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

      const empId = user.app_metadata?.empresa_activa_id
      if (!empId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

      // Verificar permiso de enviar correos
      const { permitido } = await obtenerYVerificarPermiso(user.id, empId, 'inbox_correo', 'enviar')
      if (!permitido) {
        return NextResponse.json({ error: 'Sin permiso para enviar correos' }, { status: 403 })
      }

      userId = user.id
      empresaId = empId
    }

    const body = await request.json()
    const {
      conversacion_id,
      canal_id,
      correo_para,
      correo_cc,
      correo_cco,
      correo_asunto,
      texto,
      html,
      correo_in_reply_to,
      correo_references,
      adjuntos_ids,
      tipo = 'nuevo', // 'nuevo' | 'responder' | 'responder_todos' | 'reenviar'
      pdf_url,       // URL directa de un PDF a adjuntar (ej: presupuesto)
      pdf_nombre,    // Nombre del archivo PDF
      entidad_tipo,  // Opcional: tipo de entidad para registrar en chatter (ej: 'presupuesto')
      entidad_id,    // Opcional: ID de entidad para registrar en chatter
    } = body

    if (!canal_id) {
      return NextResponse.json({ error: 'canal_id es requerido' }, { status: 400 })
    }
    if (!correo_para || correo_para.length === 0) {
      return NextResponse.json({ error: 'Debe haber al menos un destinatario' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Obtener canal y config
    const { data: canal } = await admin
      .from('canales_inbox')
      .select('id, config_conexion, proveedor, nombre')
      .eq('id', canal_id)
      .eq('empresa_id', empresaId)
      .single()

    if (!canal) return NextResponse.json({ error: 'Canal no encontrado' }, { status: 404 })

    // Obtener nombre del agente con formato personalizado
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido, formato_nombre_remitente')
      .eq('id', userId)
      .single()

    // Obtener sector del agente
    let sectorNombre: string | null = null
    const { data: miembro } = await admin
      .from('miembros')
      .select('id')
      .eq('usuario_id', userId)
      .eq('empresa_id', empresaId)
      .single()
    if (miembro) {
      const { data: ms } = await admin
        .from('miembros_sectores')
        .select('sector_id')
        .eq('miembro_id', miembro.id)
        .eq('es_primario', true)
        .single()
      if (ms) {
        const { data: sector } = await admin
          .from('sectores')
          .select('nombre')
          .eq('id', ms.sector_id)
          .single()
        if (sector) sectorNombre = sector.nombre
      }
    }

    const nombreAgente = perfil
      ? generarNombreRemitente(perfil.formato_nombre_remitente, {
          nombre: perfil.nombre, apellido: perfil.apellido, sector: sectorNombre,
        })
      : 'Agente'

    // Nombre real del usuario (para chatter, no el formato de remitente)
    const nombreRealUsuario = perfil
      ? `${perfil.nombre} ${perfil.apellido || ''}`.trim()
      : 'Agente'

    // Determinar email remitente
    let emailRemitente = ''
    if (canal.proveedor === 'gmail_oauth') {
      emailRemitente = (canal.config_conexion as { email: string }).email
    } else if (canal.proveedor === 'imap') {
      emailRemitente = (canal.config_conexion as ConfigIMAP).usuario
    }

    const de = `${nombreAgente} <${emailRemitente}>`

    // Preparar adjuntos para reenvío
    const adjuntosParaEnvio: { nombre: string; tipoMime: string; contenido: Buffer }[] = []
    if (adjuntos_ids?.length) {
      const { data: adjuntosBD } = await admin
        .from('mensaje_adjuntos')
        .select('*')
        .in('id', adjuntos_ids)
        .eq('empresa_id', empresaId)

      if (adjuntosBD) {
        for (const adj of adjuntosBD) {
          try {
            const { data: archivoData, error: dlError } = await admin.storage
              .from('adjuntos')
              .download(adj.storage_path)

            if (dlError || !archivoData) continue

            const buffer = Buffer.from(await archivoData.arrayBuffer())
            adjuntosParaEnvio.push({
              nombre: adj.nombre_archivo,
              tipoMime: adj.tipo_mime,
              contenido: buffer,
            })
          } catch {
            console.error(`Error descargando adjunto ${adj.id} para reenvío`)
          }
        }
      }
    }

    // Adjuntar PDF directo (ej: PDF del presupuesto desde Storage)
    if (pdf_url) {
      try {
        // Extraer storage_path de la URL de Supabase
        const match = (pdf_url as string).match(/\/storage\/v1\/object\/(?:public|sign)\/([^?]+)/)
        if (match) {
          const bucket = match[1].split('/')[0]
          const path = match[1].split('/').slice(1).join('/')
          const { data: pdfData, error: pdfError } = await admin.storage
            .from(bucket)
            .download(path)
          if (!pdfError && pdfData) {
            adjuntosParaEnvio.push({
              nombre: (pdf_nombre as string) || 'documento.pdf',
              tipoMime: 'application/pdf',
              contenido: Buffer.from(await pdfData.arrayBuffer()),
            })
          }
        } else {
          // URL externa — descargar directo
          const res = await fetch(pdf_url as string)
          if (res.ok) {
            adjuntosParaEnvio.push({
              nombre: (pdf_nombre as string) || 'documento.pdf',
              tipoMime: 'application/pdf',
              contenido: Buffer.from(await res.arrayBuffer()),
            })
          }
        }
      } catch {
        console.error('Error descargando PDF para adjuntar')
      }
    }

    // Construir opciones del mensaje
    const opcionesMensaje: OpcionesMensajeRFC2822 = {
      de,
      para: correo_para,
      cc: correo_cc,
      cco: correo_cco,
      asunto: correo_asunto || '(Sin asunto)',
      textoPlano: texto || '',
      html: html || undefined,
      inReplyTo: correo_in_reply_to || undefined,
      references: correo_references || undefined,
      adjuntos: adjuntosParaEnvio.length > 0 ? adjuntosParaEnvio : undefined,
    }

    // ─── Threading automático para documentos ───
    // Si se envía desde un documento (presupuesto, factura, etc.), buscar si ya
    // hay correos previos enviados para ese documento y reutilizar el hilo
    let hiloDocumento: { messageId: string; conversacionId: string; threadId?: string } | null = null
    if (entidad_tipo && entidad_id && tipo === 'nuevo') {
      // Buscar en chatter el último correo enviado para este documento
      const { data: chatterPrevio } = await admin
        .from('chatter')
        .select('metadata')
        .eq('empresa_id', empresaId)
        .eq('entidad_tipo', entidad_tipo)
        .eq('entidad_id', entidad_id)
        .eq('tipo', 'correo')
        .order('creado_en', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (chatterPrevio?.metadata) {
        const meta = chatterPrevio.metadata as Record<string, unknown>
        const prevMessageId = meta.correo_message_id as string | undefined
        if (prevMessageId) {
          // Buscar la conversación y threadId del mensaje previo
          const { data: msgPrevio } = await admin
            .from('mensajes')
            .select('conversacion_id, metadata')
            .eq('empresa_id', empresaId)
            .eq('correo_message_id', prevMessageId)
            .maybeSingle()

          if (msgPrevio) {
            hiloDocumento = {
              messageId: prevMessageId,
              conversacionId: msgPrevio.conversacion_id,
              threadId: (msgPrevio.metadata as Record<string, unknown>)?.thread_id as string | undefined,
            }
            // Inyectar headers de threading
            opcionesMensaje.inReplyTo = prevMessageId
            opcionesMensaje.references = [prevMessageId]
          }
        }
      }
    }

    // Enviar según proveedor
    let correoMessageId: string | null = null
    let gmailThreadId: string | null = null

    if (canal.proveedor === 'gmail_oauth') {
      const config = canal.config_conexion as { refresh_token: string }

      // Obtener threadId si es respuesta o continuación de hilo de documento
      let threadId: string | undefined = hiloDocumento?.threadId || undefined
      if (!threadId && conversacion_id && tipo !== 'nuevo') {
        // Respuesta desde inbox — buscar threadId en metadata del último mensaje
        const { data: ultimoMsg } = await admin
          .from('mensajes')
          .select('metadata')
          .eq('conversacion_id', conversacion_id)
          .order('creado_en', { ascending: false })
          .limit(1)
          .maybeSingle()

        threadId = (ultimoMsg?.metadata as Record<string, unknown>)?.thread_id as string || undefined
      }

      const resultado = await enviarCorreoGmail(config.refresh_token, opcionesMensaje, threadId)
      correoMessageId = resultado.id
      gmailThreadId = resultado.threadId
    } else if (canal.proveedor === 'imap') {
      const { enviarCorreoSMTP } = await import('@/lib/correo-imap')
      const config = canal.config_conexion as ConfigIMAP

      const resultado = await enviarCorreoSMTP(config, {
        de,
        para: correo_para,
        cc: correo_cc,
        cco: correo_cco,
        asunto: correo_asunto || '(Sin asunto)',
        textoPlano: texto || '',
        html: html || undefined,
        inReplyTo: correo_in_reply_to || undefined,
        references: correo_references || undefined,
        adjuntos: adjuntosParaEnvio.length > 0 ? adjuntosParaEnvio : undefined,
      })

      correoMessageId = resultado.messageId
    }

    // Crear o usar conversación (prioridad: explícito > hilo documento > nueva)
    let convId = conversacion_id || hiloDocumento?.conversacionId || null
    if (!convId) {
      // Crear nueva conversación para correo nuevo
      const { data: nuevaConv, error: errorConv } = await admin
        .from('conversaciones')
        .insert({
          empresa_id: empresaId,
          canal_id,
          tipo_canal: 'correo',
          identificador_externo: extraerEmail(correo_para[0]),
          contacto_nombre: correo_para[0],
          estado: 'abierta',
          prioridad: 'normal',
          asunto: correo_asunto || null,
          mensajes_sin_leer: 0,
        })
        .select('id')
        .single()

      if (errorConv || !nuevaConv) {
        return NextResponse.json({ error: 'Error creando conversación' }, { status: 500 })
      }

      convId = nuevaConv.id
    }

    // Guardar mensaje en BD
    const previewTexto = texto
      ? texto.slice(0, 200).replace(/\s+/g, ' ').trim()
      : '(Sin texto)'

    // Headers de threading efectivos (pueden venir del body o del hilo de documento)
    const inReplyToFinal = opcionesMensaje.inReplyTo || correo_in_reply_to || null
    const referencesFinal = opcionesMensaje.references || (correo_references?.length > 0 ? correo_references : null)

    const { data: mensaje } = await admin
      .from('mensajes')
      .insert({
        empresa_id: empresaId,
        conversacion_id: convId,
        es_entrante: false,
        remitente_tipo: 'agente',
        remitente_id: userId,
        remitente_nombre: nombreAgente,
        tipo_contenido: html ? 'email_html' : 'texto',
        texto: texto || '',
        html: html || null,
        correo_de: de,
        correo_para,
        correo_cc: correo_cc?.length > 0 ? correo_cc : null,
        correo_cco: correo_cco?.length > 0 ? correo_cco : null,
        correo_asunto: correo_asunto || null,
        correo_message_id: correoMessageId || null,
        correo_in_reply_to: inReplyToFinal,
        correo_references: referencesFinal,
        estado: 'enviado',
        ...(gmailThreadId ? { metadata: { thread_id: gmailThreadId } } : {}),
      })
      .select()
      .single()

    // Linkear adjuntos subidos al mensaje recién creado
    if (adjuntos_ids?.length && mensaje?.id) {
      await admin
        .from('mensaje_adjuntos')
        .update({ mensaje_id: mensaje.id })
        .in('id', adjuntos_ids)
        .eq('empresa_id', empresaId)
    }

    // Actualizar conversación
    await admin
      .from('conversaciones')
      .update({
        ultimo_mensaje_texto: previewTexto,
        ultimo_mensaje_en: new Date().toISOString(),
        ultimo_mensaje_es_entrante: false,
        tiempo_sin_respuesta_desde: null,
        actualizado_en: new Date().toISOString(),
      })
      .eq('id', convId)

    // ─── Registrar en chatter si hay entidad vinculada ───
    if (entidad_tipo && entidad_id) {
      try {
        await registrarCorreoEnChatter({
          empresaId,
          entidadTipo: entidad_tipo,
          entidadId: entidad_id,
          asunto: correo_asunto || '(Sin asunto)',
          destinatario: correo_para.join(', '),
          cc: correo_cc?.length > 0 ? correo_cc : undefined,
          cco: correo_cco?.length > 0 ? correo_cco : undefined,
          remitente: de,
          messageId: correoMessageId || undefined,
          html: html || undefined,
          usuarioId: userId,
          usuarioNombre: nombreRealUsuario,
        })
      } catch (e) {
        // No bloquear el envío si falla el registro en chatter
        console.error('Error al registrar correo en chatter:', e)
      }
    }

    return NextResponse.json({
      mensaje,
      conversacion_id: convId,
      correo_message_id: correoMessageId,
    }, { status: 201 })
  } catch (err) {
    console.error('Error al enviar correo:', err)
    console.error('Stack:', (err as Error).stack)
    return NextResponse.json({ error: `Error al enviar: ${(err as Error).message}` }, { status: 500 })
  }
}
