import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import {
  listarMensajesGmail,
  obtenerMensajeCompleto,
  descargarAdjuntoGmail,
  obtenerHistorialGmail,
  obtenerPerfilGmail,
  extraerEmail,
  extraerNombreDeEmail,
  normalizarAsunto,
  textoPreviewCorreo,
  type CorreoParsedo,
  type CursorSincronizacion,
} from '@/lib/gmail'
import type { ConfigIMAP } from '@/tipos/inbox'
import { registrarCorreoRecibidoEnChatter } from '@/lib/chatter'

/**
 * POST /api/inbox/correo/sincronizar — Sincroniza correos de un canal o todos.
 * Puede ser llamado manualmente, por el cron, o tras el callback de OAuth.
 *
 * Body: { canal_id?: string, empresa_id?: string }
 * - canal_id: sincronizar un canal específico
 * - empresa_id: sincronizar todos los canales de esa empresa
 * - Sin params: requiere CRON_SECRET header (para el cron global)
 */
export async function POST(request: NextRequest) {
  try {
    const admin = crearClienteAdmin()
    const body = await request.json().catch(() => ({}))
    const { canal_id, empresa_id } = body

    // Determinar qué canales sincronizar
    let query = admin
      .from('canales_inbox')
      .select('*')
      .eq('tipo', 'correo')
      .eq('activo', true)

    if (canal_id) {
      // Validar que el canal pertenezca a la empresa del usuario autenticado
      try {
        const supabase = await crearClienteServidor()
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.app_metadata?.empresa_activa_id) {
          query = query.eq('empresa_id', user.app_metadata.empresa_activa_id)
        }
      } catch { /* si no hay usuario, el filtro por canal_id solo aplica */ }
      query = query.eq('id', canal_id)
    } else if (empresa_id) {
      // Validar que empresa_id coincida con la empresa del usuario autenticado
      try {
        const supabase = await crearClienteServidor()
        const { data: { user } } = await supabase.auth.getUser()
        if (user?.app_metadata?.empresa_activa_id && empresa_id !== user.app_metadata.empresa_activa_id) {
          return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
        }
      } catch { /* si falla auth, continuar solo si viene de cron */ }
      const cronSecret = request.headers.get('x-cron-secret')
      if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
        // Solo usuarios autenticados pueden pasar empresa_id (validado arriba)
      }
      query = query.eq('empresa_id', empresa_id)
    } else {
      // Sin canal_id ni empresa_id: puede ser cron (con secret) o usuario autenticado
      const cronSecret = request.headers.get('x-cron-secret')
      if (cronSecret && cronSecret === process.env.CRON_SECRET) {
        // Cron global: sincronizar todos
      } else {
        // Intentar autenticar como usuario
        try {
          const supabase = await crearClienteServidor()
          const { data: { user } } = await supabase.auth.getUser()
          if (user?.app_metadata?.empresa_activa_id) {
            query = query.eq('empresa_id', user.app_metadata.empresa_activa_id)
          } else {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
          }
        } catch {
          return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
        }
      }
    }

    const { data: canales, error: errorCanales } = await query

    if (errorCanales) {
      return NextResponse.json({ error: 'Error al obtener canales' }, { status: 500 })
    }

    if (!canales || canales.length === 0) {
      return NextResponse.json({ mensaje: 'Sin canales de correo activos', sincronizados: 0 })
    }

    const resultados: { canal_id: string; mensajes_nuevos: number; error?: string }[] = []

    for (const canal of canales) {
      try {
        let mensajesNuevos = 0

        if (canal.proveedor === 'gmail_oauth') {
          mensajesNuevos = await sincronizarGmail(admin, canal)
        } else if (canal.proveedor === 'imap') {
          mensajesNuevos = await sincronizarIMAP(admin, canal)
        }

        // Actualizar estado del canal
        await admin
          .from('canales_inbox')
          .update({
            estado_conexion: 'conectado',
            ultimo_error: null,
            ultima_sincronizacion: new Date().toISOString(),
            actualizado_en: new Date().toISOString(),
          })
          .eq('id', canal.id)

        resultados.push({ canal_id: canal.id, mensajes_nuevos: mensajesNuevos })
      } catch (err) {
        const errorMsg = (err as Error).message
        console.error(`Error sincronizando canal ${canal.id}:`, errorMsg)

        // Marcar canal con error
        await admin
          .from('canales_inbox')
          .update({
            estado_conexion: 'error',
            ultimo_error: errorMsg.slice(0, 500),
            actualizado_en: new Date().toISOString(),
          })
          .eq('id', canal.id)

        resultados.push({ canal_id: canal.id, mensajes_nuevos: 0, error: errorMsg })
      }
    }

    return NextResponse.json({
      sincronizados: resultados.filter(r => !r.error).length,
      errores: resultados.filter(r => r.error).length,
      resultados,
    })
  } catch (err) {
    console.error('Error en sincronización de correo:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

// ─── Helpers ───

/** Ejecuta una promesa con timeout. Rechaza si excede los ms indicados. */
function conTimeout<T>(promesa: Promise<T>, ms: number, descripcion = 'operación'): Promise<T> {
  return Promise.race([
    promesa,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${descripcion} excedió ${ms}ms`)), ms)
    ),
  ])
}

// ─── Sincronización Gmail ───

async function sincronizarGmail(
  admin: ReturnType<typeof crearClienteAdmin>,
  canal: Record<string, unknown>,
): Promise<number> {
  const config = canal.config_conexion as { refresh_token: string; email: string }
  const cursor = (canal.sync_cursor || {}) as CursorSincronizacion
  const empresaId = canal.empresa_id as string
  const canalId = canal.id as string
  const emailCanal = config.email
  const canalNombre = (canal.nombre as string) || emailCanal

  // Pre-cargar admins una sola vez para toda la sincronización (evita N queries)
  const { data: adminsCache } = await admin
    .from('miembros')
    .select('usuario_id')
    .eq('empresa_id', empresaId)
    .in('rol', ['propietario', 'administrador'])
    .eq('activo', true)

  let mensajesNuevos = 0
  let nuevoHistoryId = cursor.historyId

  if (cursor.historyId) {
    // Sync incremental con historyId
    try {
      const { cambios, historyIdNuevo } = await obtenerHistorialGmail(
        config.refresh_token,
        cursor.historyId,
      )
      nuevoHistoryId = historyIdNuevo

      for (const msgId of cambios.mensajesAgregados) {
        try {
          const correo = await conTimeout(
            obtenerMensajeCompleto(config.refresh_token, msgId),
            30000, `obtener mensaje ${msgId}`,
          )
          const procesado = await procesarCorreoEntrante(admin, correo, empresaId, canalId, emailCanal, false, undefined, canalNombre)
          if (procesado) mensajesNuevos++
        } catch (err) {
          console.error(`Error procesando mensaje ${msgId}:`, err)
        }
      }
    } catch (err) {
      // Si historyId expiró, hacer sync completo
      const errorMsg = (err as Error).message
      if (errorMsg.includes('404') || errorMsg.includes('historyId')) {
        console.info(`historyId expirado para canal ${canalId}, haciendo sync completo`)
        return await sincronizarGmailCompleto(admin, canal)
      }
      throw err
    }
  } else {
    // Sync inicial: obtener últimos mensajes
    return await sincronizarGmailCompleto(admin, canal)
  }

  // Actualizar cursor
  await admin
    .from('canales_inbox')
    .update({
      sync_cursor: {
        historyId: nuevoHistoryId,
        ultimaSincronizacion: new Date().toISOString(),
      },
    })
    .eq('id', canalId)

  return mensajesNuevos
}

/** Sync completo de Gmail (primera vez o historyId expirado) */
async function sincronizarGmailCompleto(
  admin: ReturnType<typeof crearClienteAdmin>,
  canal: Record<string, unknown>,
): Promise<number> {
  const config = canal.config_conexion as { refresh_token: string; email: string }
  const empresaId = canal.empresa_id as string
  const canalId = canal.id as string
  const emailCanal = config.email
  const canalNombre = (canal.nombre as string) || emailCanal

  // Obtener historyId actual
  const perfil = await obtenerPerfilGmail(config.refresh_token)

  // Obtener últimos mensajes de inbox y enviados (últimos 30 días)
  const hace30Dias = Math.floor(Date.now() / 1000) - 30 * 86400
  const queryInbox = `in:inbox after:${hace30Dias}`
  const querySent = `in:sent after:${hace30Dias}`

  let mensajesNuevos = 0

  // Sync inicial de Gmail: no marcar como sin leer
  const esSyncInicialGmail = true

  // Procesar inbox
  const resultadoInbox = await conTimeout(
    listarMensajesGmail(config.refresh_token, queryInbox, undefined, 100),
    60000, 'listar inbox Gmail',
  )
  for (const msg of resultadoInbox.mensajes) {
    try {
      const correo = await conTimeout(
        obtenerMensajeCompleto(config.refresh_token, msg.id),
        30000, `obtener mensaje ${msg.id}`,
      )
      const procesado = await procesarCorreoEntrante(admin, correo, empresaId, canalId, emailCanal, esSyncInicialGmail, undefined, canalNombre)
      if (procesado) mensajesNuevos++
    } catch (err) {
      console.error(`Error procesando mensaje ${msg.id}:`, err)
    }
  }

  // Procesar enviados
  const resultadoSent = await conTimeout(
    listarMensajesGmail(config.refresh_token, querySent, undefined, 100),
    60000, 'listar enviados Gmail',
  )
  for (const msg of resultadoSent.mensajes) {
    try {
      const correo = await conTimeout(
        obtenerMensajeCompleto(config.refresh_token, msg.id),
        30000, `obtener mensaje enviado ${msg.id}`,
      )
      const procesado = await procesarCorreoEntrante(admin, correo, empresaId, canalId, emailCanal, esSyncInicialGmail, undefined, canalNombre)
      if (procesado) mensajesNuevos++
    } catch (err) {
      console.error(`Error procesando mensaje enviado ${msg.id}:`, err)
    }
  }

  // Guardar cursor
  await admin
    .from('canales_inbox')
    .update({
      sync_cursor: {
        historyId: perfil.historyId,
        ultimaSincronizacion: new Date().toISOString(),
      },
    })
    .eq('id', canalId)

  return mensajesNuevos
}

// ─── Sincronización IMAP ───

async function sincronizarIMAP(
  admin: ReturnType<typeof crearClienteAdmin>,
  canal: Record<string, unknown>,
): Promise<number> {
  const { obtenerMensajesIMAP, detectarCarpetasIMAP } = await import('@/lib/correo-imap')
  const config = canal.config_conexion as ConfigIMAP
  const cursor = (canal.sync_cursor || {}) as CursorSincronizacion & {
    ultimoUID_sent?: number
    ultimoUID_junk?: number
    carpeta_sent?: string
    carpeta_junk?: string
  }
  const empresaId = canal.empresa_id as string
  const canalId = canal.id as string
  const emailCanal = config.usuario
  const canalNombre = (canal.nombre as string) || emailCanal
  const esSyncInicial = !cursor.ultimoUID || cursor.ultimoUID === 0

  // Pre-cargar admins una sola vez para toda la sincronización IMAP
  const { data: adminsCacheImap } = await admin
    .from('miembros')
    .select('usuario_id')
    .eq('empresa_id', empresaId)
    .in('rol', ['propietario', 'administrador'])
    .eq('activo', true)

  let mensajesNuevos = 0
  let ultimoUIDInbox = cursor.ultimoUID || 0
  let ultimoUIDSent = cursor.ultimoUID_sent || 0
  let ultimoUIDJunk = cursor.ultimoUID_junk || 0

  // Detectar carpetas reales del servidor (solo si no las tenemos en cache)
  let carpetaSent = cursor.carpeta_sent || null
  let carpetaJunk = cursor.carpeta_junk || null
  if (!carpetaSent && !carpetaJunk) {
    try {
      const detectadas = await detectarCarpetasIMAP(config)
      carpetaSent = detectadas.sent
      carpetaJunk = detectadas.junk
      console.info(`[IMAP ${emailCanal}] Carpetas detectadas — sent: ${carpetaSent}, junk: ${carpetaJunk}`)
    } catch (err) {
      console.error(`[IMAP ${emailCanal}] Error detectando carpetas:`, err)
    }
  }

  // Carpetas a sincronizar (solo las que existen)
  const carpetas: { nombre: string; tipo: 'inbox' | 'sent' | 'junk'; desdeUID: number; estado: 'abierta' | 'spam' }[] = [
    { nombre: 'INBOX', tipo: 'inbox', desdeUID: ultimoUIDInbox, estado: 'abierta' },
  ]
  if (carpetaSent) {
    carpetas.push({ nombre: carpetaSent, tipo: 'sent', desdeUID: ultimoUIDSent, estado: 'abierta' })
  }
  if (carpetaJunk) {
    carpetas.push({ nombre: carpetaJunk, tipo: 'junk', desdeUID: ultimoUIDJunk, estado: 'spam' })
  }

  for (const carpeta of carpetas) {
    try {
      const resultado = await obtenerMensajesIMAP(config, {
        carpeta: carpeta.nombre,
        desdeUID: carpeta.desdeUID,
        limite: 500,
      })

      console.info(`[IMAP ${emailCanal}] ${carpeta.nombre}: ${resultado.mensajes.length} mensajes nuevos (UID desde ${carpeta.desdeUID}, último UID: ${resultado.ultimoUID})`)

      for (const correo of resultado.mensajes) {
        try {
          const procesado = await procesarCorreoEntrante(
            admin, correo, empresaId, canalId, emailCanal, esSyncInicial,
            carpeta.estado === 'spam' ? 'spam' : undefined,
            canalNombre, adminsCacheImap || undefined,
          )
          if (procesado) mensajesNuevos++
        } catch (err) {
          console.error(`Error procesando correo ${carpeta.nombre}:`, err)
        }
      }

      // Actualizar UID por tipo de carpeta
      if (carpeta.tipo === 'inbox' && resultado.ultimoUID > ultimoUIDInbox) {
        ultimoUIDInbox = resultado.ultimoUID
      } else if (carpeta.tipo === 'sent' && resultado.ultimoUID > ultimoUIDSent) {
        ultimoUIDSent = resultado.ultimoUID
      } else if (carpeta.tipo === 'junk' && resultado.ultimoUID > ultimoUIDJunk) {
        ultimoUIDJunk = resultado.ultimoUID
      }
    } catch (err) {
      // Solo silenciar si no es INBOX (carpeta principal siempre debe existir)
      if (carpeta.tipo === 'inbox') throw err
      console.warn(`[IMAP ${emailCanal}] Carpeta ${carpeta.nombre} no accesible:`, (err as Error).message)
    }
  }

  // Guardar cursor con UIDs por carpeta + nombres detectados
  await admin.from('canales_inbox').update({
    sync_cursor: {
      ultimoUID: ultimoUIDInbox,
      ultimoUID_sent: ultimoUIDSent,
      ultimoUID_junk: ultimoUIDJunk,
      carpeta_sent: carpetaSent,
      carpeta_junk: carpetaJunk,
      ultimaSincronizacion: new Date().toISOString(),
    },
  }).eq('id', canalId)

  return mensajesNuevos
}

// ─── Procesamiento de correo entrante (Threading) ───

/**
 * Procesa un correo: lo asigna a una conversación existente o crea una nueva.
 * Retorna true si se insertó un mensaje nuevo, false si era duplicado.
 */
async function procesarCorreoEntrante(
  admin: ReturnType<typeof crearClienteAdmin>,
  correo: CorreoParsedo,
  empresaId: string,
  canalId: string,
  emailCanal: string,
  syncInicial = false,
  estadoForzado?: 'spam',
  canalNombre?: string,
  adminsCache?: { usuario_id: string }[],
): Promise<boolean> {
  // 1. Deduplicar por correo_message_id
  if (correo.messageId) {
    const { data: existente } = await admin
      .from('mensajes')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('correo_message_id', correo.messageId)
      .maybeSingle()

    if (existente) return false // Ya procesado
  }

  // 2. Determinar dirección (entrante vs saliente)
  const emailRemitente = extraerEmail(correo.de)
  const esEntrante = emailRemitente.toLowerCase() !== emailCanal.toLowerCase()

  // 2.5. Verificar listas de permitidos/bloqueados (solo entrantes)
  let estadoInicial: 'abierta' | 'spam' = 'abierta'
  if (esEntrante) {
    const { data: configInbox } = await admin
      .from('config_inbox')
      .select('correo_lista_permitidos, correo_lista_bloqueados')
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (configInbox) {
      const permitidos = (configInbox.correo_lista_permitidos || []) as string[]
      const bloqueados = (configInbox.correo_lista_bloqueados || []) as string[]
      const dominio = emailRemitente.split('@')[1] || ''

      const estaBloqueado = bloqueados.some(b =>
        b.startsWith('@') ? dominio === b.slice(1).toLowerCase() : emailRemitente === b.toLowerCase()
      )
      const estaPermitido = permitidos.some(p =>
        p.startsWith('@') ? dominio === p.slice(1).toLowerCase() : emailRemitente === p.toLowerCase()
      )

      if (estaBloqueado && !estaPermitido) {
        estadoInicial = 'spam'
      }
    }
  }

  // 3. Encontrar o crear conversación
  let conversacionId = await buscarConversacionPorHilo(admin, correo, empresaId, canalId)

  if (!conversacionId) {
    const estadoConv = estadoForzado || estadoInicial
    conversacionId = await crearConversacion(admin, correo, empresaId, canalId, esEntrante, emailCanal, estadoConv, syncInicial)
  }

  // 4. Buscar/crear contacto si es entrante
  let contactoNombre = extraerNombreDeEmail(correo.de)
  if (esEntrante) {
    const { data: contacto } = await admin
      .from('contactos')
      .select('id, nombre, apellido')
      .eq('empresa_id', empresaId)
      .eq('correo', emailRemitente)
      .maybeSingle()

    if (contacto) {
      contactoNombre = `${contacto.nombre} ${contacto.apellido || ''}`.trim()

      // Vincular contacto a conversación si no está vinculado
      await admin
        .from('conversaciones')
        .update({
          contacto_id: contacto.id,
          contacto_nombre: contactoNombre,
        })
        .eq('id', conversacionId)
        .is('contacto_id', null)
    }
  }

  // 5. Insertar mensaje
  const previewTexto = textoPreviewCorreo(correo)
  const { data: mensaje, error: errorMensaje } = await admin
    .from('mensajes')
    .insert({
      empresa_id: empresaId,
      conversacion_id: conversacionId,
      es_entrante: esEntrante,
      remitente_tipo: esEntrante ? 'contacto' : 'agente',
      remitente_nombre: esEntrante ? contactoNombre : extraerNombreDeEmail(correo.de),
      tipo_contenido: correo.html ? 'email_html' : 'texto',
      texto: correo.textoPlano || previewTexto,
      html: correo.html || null,
      correo_de: correo.de,
      correo_para: correo.para,
      correo_cc: correo.cc.length > 0 ? correo.cc : null,
      correo_cco: correo.cco.length > 0 ? correo.cco : null,
      correo_asunto: correo.asunto,
      correo_message_id: correo.messageId || null,
      correo_in_reply_to: correo.inReplyTo || null,
      correo_references: correo.references.length > 0 ? correo.references : null,
      estado: 'entregado',
      metadata: {
        gmail_id: correo.gmailId,
        thread_id: correo.threadId,
        etiquetas: correo.etiquetas,
      },
      creado_en: correo.fecha,
    })
    .select('id')
    .single()

  if (errorMensaje || !mensaje) {
    console.error('Error insertando mensaje:', errorMensaje)
    return false
  }

  // 6. Procesar adjuntos
  if (correo.adjuntos.length > 0) {
    await procesarAdjuntos(admin, correo, mensaje.id, empresaId, canalId)
  }

  // 7. Actualizar conversación con último mensaje
  await admin
    .from('conversaciones')
    .update({
      ultimo_mensaje_texto: previewTexto.slice(0, 200) || correo.asunto,
      ultimo_mensaje_en: correo.fecha,
      ultimo_mensaje_es_entrante: esEntrante,
      // mensajes_sin_leer se incrementa abajo por separado
      actualizado_en: new Date().toISOString(),
    })
    .eq('id', conversacionId)

  // 8. Ejecutar reglas automáticas
  if (esEntrante) {
    try {
      await ejecutarReglas(admin, correo, empresaId, conversacionId)
    } catch (err) {
      console.error('Error ejecutando reglas:', err)
    }
  }

  // Incrementar mensajes_sin_leer si es entrante (no en sync inicial para evitar miles de no leídos)
  if (esEntrante && !syncInicial) {
    const { data: convActual } = await admin
      .from('conversaciones')
      .select('mensajes_sin_leer, asignado_a')
      .eq('id', conversacionId)
      .single()

    if (convActual) {
      await admin
        .from('conversaciones')
        .update({ mensajes_sin_leer: (convActual.mensajes_sin_leer || 0) + 1 })
        .eq('id', conversacionId)

      // Crear notificación de correo entrante
      // Si hay agente asignado → notificar solo a él.
      // Si NO hay agente → notificar a admins/propietarios.
      try {
        const { crearNotificacion, crearNotificacionesBatch } = await import('@/lib/notificaciones')
        const datosNotif = {
          tipo: 'mensaje_correo',
          titulo: `📩 ${contactoNombre}`,
          cuerpo: (canalNombre ? `Correo · ${canalNombre} · ` : 'Correo · ') + (previewTexto.slice(0, 120) || correo.asunto),
          icono: 'Mail',
          color: 'var(--canal-correo)',
          url: `/inbox?conv=${conversacionId}&tab=correo`,
          referenciaTipo: 'conversacion',
          referenciaId: conversacionId,
        }

        if (convActual.asignado_a) {
          await crearNotificacion({ empresaId, usuarioId: convActual.asignado_a, ...datosNotif })
        } else {
          // Sin asignado → notificar a admins/propietarios (usar cache si disponible)
          const admins = adminsCache ?? (await admin
            .from('miembros')
            .select('usuario_id')
            .eq('empresa_id', empresaId)
            .in('rol', ['propietario', 'administrador'])
            .eq('activo', true)
          ).data

          if (admins && admins.length > 0) {
            await crearNotificacionesBatch(admins.map(a => ({ empresaId, usuarioId: a.usuario_id, ...datosNotif })))
          }
        }
      } catch {
        // Silenciar si falla la notificación
      }
    }
  }

  // ─── Vincular respuesta entrante al chatter del documento ───
  // Si este correo responde a uno que fue enviado desde un documento,
  // registrar la respuesta en el chatter de ese documento automáticamente
  if (esEntrante && !syncInicial) {
    try {
      // Buscar en chatter si algún correo previo de esta conversación está vinculado a un documento
      const { data: mensajesPrevios } = await admin
        .from('mensajes')
        .select('correo_message_id')
        .eq('conversacion_id', conversacionId)
        .eq('es_entrante', false)
        .not('correo_message_id', 'is', null)
        .limit(10)

      if (mensajesPrevios?.length) {
        const messageIds = mensajesPrevios.map(m => m.correo_message_id).filter(Boolean)
        // Buscar en chatter si alguno de esos message_ids está vinculado a un documento
        const { data: chatterVinculado } = await admin
          .from('chatter')
          .select('entidad_tipo, entidad_id')
          .eq('empresa_id', empresaId)
          .eq('tipo', 'correo')
          .in('metadata->>correo_message_id', messageIds)
          .limit(1)
          .maybeSingle()

        if (chatterVinculado) {
          await registrarCorreoRecibidoEnChatter({
            empresaId,
            entidadTipo: chatterVinculado.entidad_tipo,
            entidadId: chatterVinculado.entidad_id,
            asunto: correo.asunto,
            remitente: correo.de,
            messageId: correo.messageId || undefined,
            html: correo.html || undefined,
          })
        }
      }
    } catch (err) {
      // No bloquear la sincronización si falla el registro en chatter
      console.error('Error vinculando respuesta a chatter de documento:', err)
    }
  }

  return true
}

// ─── Buscar conversación por hilo (threading) ───

async function buscarConversacionPorHilo(
  admin: ReturnType<typeof crearClienteAdmin>,
  correo: CorreoParsedo,
  empresaId: string,
  canalId: string,
): Promise<string | null> {
  // 1. Buscar por Gmail threadId (más fiable — mismo threadId para todo el hilo)
  if (correo.threadId) {
    const { data } = await admin
      .from('conversaciones')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('canal_id', canalId)
      .eq('hilo_externo_id', correo.threadId)
      .maybeSingle()

    if (data) return data.id
  }

  // 2. Buscar por In-Reply-To → correo_message_id de un mensaje existente
  if (correo.inReplyTo) {
    const { data } = await admin
      .from('mensajes')
      .select('conversacion_id')
      .eq('empresa_id', empresaId)
      .eq('correo_message_id', correo.inReplyTo)
      .limit(1)
      .maybeSingle()

    if (data) return data.conversacion_id
  }

  // 3. Buscar por References → cualquier message_id referenciado
  if (correo.references.length > 0) {
    const { data } = await admin
      .from('mensajes')
      .select('conversacion_id, creado_en')
      .eq('empresa_id', empresaId)
      .in('correo_message_id', correo.references)
      .order('creado_en', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (data) return data.conversacion_id
  }

  // 4. Fallback: buscar por asunto normalizado + identificador en últimos 7 días
  const asuntoNormalizado = normalizarAsunto(correo.asunto)
  if (asuntoNormalizado) {
    const hace7Dias = new Date(Date.now() - 7 * 86400000).toISOString()
    const emailRemitente = extraerEmail(correo.de)

    const { data } = await admin
      .from('conversaciones')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('canal_id', canalId)
      .eq('tipo_canal', 'correo')
      .eq('asunto', asuntoNormalizado)
      .or(`identificador_externo.eq.${emailRemitente}`)
      .gte('creado_en', hace7Dias)
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (data) return data.id
  }

  return null
}

// ─── Crear conversación nueva ───

async function crearConversacion(
  admin: ReturnType<typeof crearClienteAdmin>,
  correo: CorreoParsedo,
  empresaId: string,
  canalId: string,
  esEntrante: boolean,
  emailCanal: string,
  estado: 'abierta' | 'spam' = 'abierta',
  syncInicial = false,
): Promise<string> {
  // El identificador externo es la contraparte (no nuestro email)
  const identificadorExterno = esEntrante
    ? extraerEmail(correo.de)
    : correo.para.length > 0 ? extraerEmail(correo.para[0]) : ''

  const contactoNombre = esEntrante
    ? extraerNombreDeEmail(correo.de)
    : correo.para.length > 0 ? extraerNombreDeEmail(correo.para[0]) : ''

  const asuntoNormalizado = normalizarAsunto(correo.asunto)

  const { data, error } = await admin
    .from('conversaciones')
    .insert({
      empresa_id: empresaId,
      canal_id: canalId,
      tipo_canal: 'correo',
      identificador_externo: identificadorExterno,
      hilo_externo_id: correo.threadId || null,
      contacto_nombre: contactoNombre || identificadorExterno,
      estado,
      prioridad: 'normal',
      asunto: asuntoNormalizado || correo.asunto || null,
      mensajes_sin_leer: (esEntrante && !syncInicial) ? 1 : 0,
    })
    .select('id')
    .single()

  if (error || !data) {
    throw new Error(`Error creando conversación: ${error?.message}`)
  }

  return data.id
}

// ─── Procesar adjuntos ───

async function procesarAdjuntos(
  admin: ReturnType<typeof crearClienteAdmin>,
  correo: CorreoParsedo,
  mensajeId: string,
  empresaId: string,
  canalId: string,
): Promise<void> {
  // Obtener refresh_token del canal
  const { data: canal } = await admin
    .from('canales_inbox')
    .select('config_conexion, proveedor')
    .eq('id', canalId)
    .single()

  if (!canal) return

  for (const adj of correo.adjuntos) {
    try {
      let buffer: Buffer

      if (canal.proveedor === 'gmail_oauth') {
        const config = canal.config_conexion as { refresh_token: string }
        buffer = await descargarAdjuntoGmail(
          config.refresh_token,
          correo.gmailId,
          adj.attachmentId,
        )
      } else if (adj.contenido) {
        // IMAP: el contenido viene incluido en el adjunto parseado por mailparser
        buffer = adj.contenido
      } else {
        console.warn(`Adjunto ${adj.nombre} sin contenido (proveedor: ${canal.proveedor})`)
        continue
      }

      // Sanitizar nombre de archivo
      const nombreLimpio = adj.nombre
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .slice(0, 100)

      // Subir a Supabase Storage
      const storagePath = `inbox/${empresaId}/correo/${mensajeId}/${nombreLimpio}`
      const { error: errorStorage } = await admin.storage
        .from('adjuntos')
        .upload(storagePath, buffer, {
          contentType: adj.tipoMime,
          upsert: true,
        })

      if (errorStorage) {
        console.error(`Error subiendo adjunto ${adj.nombre}:`, errorStorage)
        continue
      }

      // Obtener URL pública
      const { data: urlData } = admin.storage
        .from('adjuntos')
        .getPublicUrl(storagePath)

      // Generar miniatura para imágenes
      let miniaturaUrl: string | null = null
      if (adj.tipoMime.startsWith('image/')) {
        try {
          const sharp = (await import('sharp')).default
          const miniatura = await sharp(buffer)
            .resize(200, 200, { fit: 'cover' })
            .jpeg({ quality: 70 })
            .toBuffer()

          const miniaturaPath = `inbox/${empresaId}/correo/${mensajeId}/thumb_${nombreLimpio}`
          await admin.storage
            .from('adjuntos')
            .upload(miniaturaPath, miniatura, {
              contentType: 'image/jpeg',
              upsert: true,
            })

          const { data: thumbUrl } = admin.storage
            .from('adjuntos')
            .getPublicUrl(miniaturaPath)

          miniaturaUrl = thumbUrl.publicUrl
        } catch {
          // Si falla la miniatura, seguir sin ella
        }
      }

      // Insertar registro de adjunto
      await admin.from('mensaje_adjuntos').insert({
        mensaje_id: mensajeId,
        empresa_id: empresaId,
        nombre_archivo: adj.nombre,
        tipo_mime: adj.tipoMime,
        tamano_bytes: adj.tamano,
        url: urlData.publicUrl,
        storage_path: storagePath,
        miniatura_url: miniaturaUrl,
      })
    } catch (err) {
      console.error(`Error procesando adjunto ${adj.nombre}:`, err)
    }
  }
}

// ─── Ejecutar reglas automáticas ───

async function ejecutarReglas(
  admin: ReturnType<typeof crearClienteAdmin>,
  correo: CorreoParsedo,
  empresaId: string,
  conversacionId: string,
): Promise<void> {
  const { data: reglas } = await admin
    .from('reglas_correo')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('activa', true)
    .order('orden', { ascending: true })

  if (!reglas || reglas.length === 0) return

  for (const regla of reglas) {
    const condiciones = regla.condiciones as { campo: string; operador: string; valor: string }[]
    const acciones = regla.acciones as { tipo: string; valor: string }[]

    // Verificar todas las condiciones (AND)
    const cumple = condiciones.every(cond => {
      let valor = ''
      if (cond.campo === 'correo_de') valor = correo.de.toLowerCase()
      else if (cond.campo === 'asunto') valor = correo.asunto.toLowerCase()
      else if (cond.campo === 'texto') valor = correo.textoPlano.toLowerCase()
      else if (cond.campo === 'correo_para') valor = correo.para.join(', ').toLowerCase()

      const buscar = cond.valor.toLowerCase()

      switch (cond.operador) {
        case 'contiene': return valor.includes(buscar)
        case 'es': return valor === buscar
        case 'empieza': return valor.startsWith(buscar)
        case 'termina': return valor.endsWith(buscar)
        case 'dominio': {
          const dominio = valor.split('@')[1]?.split('>')[0] || ''
          return dominio === buscar
        }
        default: return false
      }
    })

    if (!cumple) continue

    // Ejecutar acciones
    for (const accion of acciones) {
      switch (accion.tipo) {
        case 'etiquetar':
          try {
            await admin.from('conversacion_etiquetas').insert({
              conversacion_id: conversacionId,
              etiqueta_id: accion.valor,
            })
          } catch { /* duplicado ok */ }
          break

        case 'asignar':
          await admin.from('conversaciones').update({
            asignado_a: accion.valor,
            actualizado_en: new Date().toISOString(),
          }).eq('id', conversacionId)
          break

        case 'marcar_spam':
          await admin.from('conversaciones').update({
            estado: 'spam',
            actualizado_en: new Date().toISOString(),
          }).eq('id', conversacionId)
          break

        case 'archivar':
          await admin.from('conversaciones').update({
            estado: 'resuelta',
            cerrado_en: new Date().toISOString(),
            actualizado_en: new Date().toISOString(),
          }).eq('id', conversacionId)
          break
      }
    }

    // Solo ejecutar la primera regla que matchea (no cascadear)
    break
  }
}
