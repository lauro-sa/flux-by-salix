/**
 * Helper para crear notificaciones desde el servidor.
 * Inserta en la tabla notificaciones — Supabase Realtime se encarga de
 * enviarla al cliente en tiempo real via useNotificaciones.
 * Se usa en: APIs de actividades, cron de vencimientos, etc.
 */

import { crearClienteAdmin } from '@/lib/supabase/admin'

interface CrearNotificacionParams {
  empresaId: string
  usuarioId: string
  tipo: string
  titulo: string
  cuerpo?: string
  icono?: string
  color?: string
  url?: string
  referenciaTipo?: string
  referenciaId?: string
}

/**
 * Crea una notificación para un usuario específico.
 * Anti-duplicación: si ya existe una no leída con mismo referencia_tipo + referencia_id,
 * actualiza título/cuerpo/creada_en en vez de crear otra.
 * La notificación aparecerá en tiempo real en la campana del header.
 */
export async function crearNotificacion({
  empresaId,
  usuarioId,
  tipo,
  titulo,
  cuerpo,
  icono,
  color,
  url,
  referenciaTipo,
  referenciaId,
}: CrearNotificacionParams) {
  const admin = crearClienteAdmin()

  // Limpiar notificaciones viejas leídas de la misma referencia para no acumular basura
  if (referenciaTipo && referenciaId) {
    admin
      .from('notificaciones')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('usuario_id', usuarioId)
      .eq('referencia_tipo', referenciaTipo)
      .eq('referencia_id', referenciaId)
      .eq('leida', true)
      .then(() => {})
  }

  // Intento principal: INSERT. El índice único parcial
  // `notificaciones_dedup_no_leida_idx` garantiza que no haya dos filas
  // no leídas con la misma (empresa, usuario, referencia_tipo, referencia_id).
  // Si ya existe una, el INSERT falla con 23505 y caemos al UPDATE.
  const { error } = await admin
    .from('notificaciones')
    .insert({
      empresa_id: empresaId,
      usuario_id: usuarioId,
      tipo,
      titulo,
      cuerpo: cuerpo || null,
      icono: icono || null,
      color: color || null,
      url: url || null,
      leida: false,
      referencia_tipo: referenciaTipo || null,
      referencia_id: referenciaId || null,
    })

  // 23505 = unique_violation: ya existe una notificación no leída para la misma
  // referencia. Actualizamos en lugar de insertar (dedup atómica garantizada por DB).
  if (error && error.code === '23505' && referenciaTipo && referenciaId) {
    const { data: existente } = await admin
      .from('notificaciones')
      .select('id, titulo, cuerpo')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', usuarioId)
      .eq('referencia_tipo', referenciaTipo)
      .eq('referencia_id', referenciaId)
      .eq('leida', false)
      .limit(1)
      .maybeSingle()

    if (existente) {
      const contenidoCambio = existente.titulo !== titulo || existente.cuerpo !== (cuerpo || null)

      await admin
        .from('notificaciones')
        .update({ titulo, cuerpo: cuerpo || null, creada_en: new Date().toISOString() })
        .eq('id', existente.id)

      // Solo re-enviar push si el contenido cambió (nuevo evento real, no re-procesado)
      if (contenidoCambio) {
        console.log(`[Push] crearNotificacion (dedup, contenido nuevo): enviando push a usuario ${usuarioId.slice(0, 8)}...`)
        enviarPush({ empresaId, usuarioId, titulo, cuerpo, url }).catch((err) => console.error('[Push] Error dedup:', err))
      } else {
        console.log(`[Push] crearNotificacion (dedup, mismo contenido): omitiendo push para usuario ${usuarioId.slice(0, 8)}`)
      }
    }
    return
  }

  if (error) {
    console.error('Error al crear notificación:', error)
    return
  }

  // Push notification (fire-and-forget, pero con log de error)
  console.log(`[Push] crearNotificacion: enviando push a usuario ${usuarioId.slice(0, 8)}...`)
  enviarPush({ empresaId, usuarioId, titulo, cuerpo, url }).catch((err) => console.error('[Push] Error:', err))

  // Notificar a admins que tienen "recibir todas las notificaciones" activado
  notificarAdminsObservadores({
    empresaId, usuarioIdOriginal: usuarioId, tipo, titulo, cuerpo, icono, color, url, referenciaTipo, referenciaId,
  }).catch(() => {})
}

/**
 * Crea notificaciones para múltiples usuarios (batch).
 * Útil para notificar a seguidores, creador + asignado, etc.
 */
export async function crearNotificacionesBatch(
  notificaciones: CrearNotificacionParams[]
) {
  if (notificaciones.length === 0) return

  const admin = crearClienteAdmin()

  // Anti-duplicación: filtrar notificaciones que ya existen sin leer con misma referencia
  const conReferencia = notificaciones.filter(n => n.referenciaTipo && n.referenciaId)
  const sinReferencia = notificaciones.filter(n => !n.referenciaTipo || !n.referenciaId)

  // Buscar existentes para las que tienen referencia (filtrar por empresa + tipo)
  let yaExistentes: Set<string> = new Set()
  if (conReferencia.length > 0) {
    const referenciaIds = [...new Set(conReferencia.map(n => n.referenciaId!))]
    const empresaIds = [...new Set(conReferencia.map(n => n.empresaId))]
    const { data: existentes } = await admin
      .from('notificaciones')
      .select('usuario_id, referencia_id')
      .in('referencia_id', referenciaIds)
      .in('empresa_id', empresaIds)
      .eq('leida', false)

    if (existentes) {
      yaExistentes = new Set(existentes.map(e => `${e.usuario_id}|${e.referencia_id}`))
    }
  }

  // Separar: las que ya existen se actualizan, las nuevas se insertan
  const paraActualizar: CrearNotificacionParams[] = []
  const paraInsertar: CrearNotificacionParams[] = [...sinReferencia]

  for (const n of conReferencia) {
    const clave = `${n.usuarioId}|${n.referenciaId}`
    if (yaExistentes.has(clave)) {
      paraActualizar.push(n)
    } else {
      paraInsertar.push(n)
    }
  }

  // Actualizar existentes (nuevo mensaje en misma conversación)
  for (const n of paraActualizar) {
    await admin
      .from('notificaciones')
      .update({ titulo: n.titulo, cuerpo: n.cuerpo || null, creada_en: new Date().toISOString() })
      .eq('usuario_id', n.usuarioId)
      .eq('referencia_id', n.referenciaId!)
      .eq('leida', false)
  }

  // Limpiar notificaciones leídas viejas de las mismas referencias (evita acumular basura)
  if (conReferencia.length > 0) {
    const referenciaIds = [...new Set(conReferencia.map(n => n.referenciaId!))]
    const empresaIds = [...new Set(conReferencia.map(n => n.empresaId))]
    admin
      .from('notificaciones')
      .delete()
      .in('referencia_id', referenciaIds)
      .in('empresa_id', empresaIds)
      .eq('leida', true)
      .then(() => {})
  }

  // Insertar nuevas
  if (paraInsertar.length > 0) {
    const filas = paraInsertar.map(n => ({
      empresa_id: n.empresaId,
      usuario_id: n.usuarioId,
      tipo: n.tipo,
      titulo: n.titulo,
      cuerpo: n.cuerpo || null,
      icono: n.icono || null,
      color: n.color || null,
      url: n.url || null,
      leida: false,
      referencia_tipo: n.referenciaTipo || null,
      referencia_id: n.referenciaId || null,
    }))

    const { error } = await admin.from('notificaciones').insert(filas)
    if (error) {
      console.error('Error al crear notificaciones batch:', error)
      return
    }
  }

  // Push notifications: solo para notificaciones NUEVAS (no actualizadas — evita push spam)
  const uniqueUsuarios = [...new Set(paraInsertar.map(n => `${n.empresaId}|${n.usuarioId}`))]
  if (uniqueUsuarios.length > 0) {
    console.log(`[Push] Batch: enviando push a ${uniqueUsuarios.length} usuario(s) (${paraActualizar.length} actualizados sin push)`)
  }
  for (const key of uniqueUsuarios) {
    const [empresaId, usuarioId] = key.split('|')
    const primera = paraInsertar.find(n => n.empresaId === empresaId && n.usuarioId === usuarioId)
    if (primera) {
      enviarPush({
        empresaId,
        usuarioId,
        titulo: primera.titulo,
        cuerpo: primera.cuerpo,
        url: primera.url,
      }).catch((err) => console.error('[Push] Error en batch:', err))
    }
  }
}

/**
 * Notifica a admins/propietarios que activaron "recibir todas las notificaciones".
 * Busca miembros de la empresa con rol admin/propietario que tengan la preferencia activa,
 * excluye al usuario que ya recibió la notificación original.
 */
async function notificarAdminsObservadores({
  empresaId,
  usuarioIdOriginal,
  tipo,
  titulo,
  cuerpo,
  icono,
  color,
  url,
  referenciaTipo,
  referenciaId,
}: Omit<CrearNotificacionParams, 'usuarioId'> & { usuarioIdOriginal: string }) {
  const admin = crearClienteAdmin()

  // Buscar miembros admin/propietario de la empresa
  const { data: miembros } = await admin
    .from('miembros')
    .select('usuario_id, rol')
    .eq('empresa_id', empresaId)
    .in('rol', ['propietario', 'administrador'])
    .eq('activo', true)
    .neq('usuario_id', usuarioIdOriginal)

  if (!miembros || miembros.length === 0) return

  // Verificar cuáles tienen la preferencia activada en alguno de sus dispositivos.
  // preferencias_usuario es por (usuario_id, dispositivo_id) — basta con que un
  // dispositivo tenga el flag para considerar al usuario observador.
  const { data: preferencias } = await admin
    .from('preferencias_usuario')
    .select('usuario_id')
    .in('usuario_id', miembros.map(m => m.usuario_id))
    .eq('recibir_todas_notificaciones', true)

  const observadoresIds = new Set(preferencias?.map(p => p.usuario_id) ?? [])
  const observadores = miembros.filter(m => observadoresIds.has(m.usuario_id))

  if (observadores.length === 0) return

  // Crear notificaciones para cada observador
  const notificaciones = observadores.map(obs => ({
    empresa_id: empresaId,
    usuario_id: obs.usuario_id,
    tipo,
    titulo,
    cuerpo: cuerpo || null,
    icono: icono || null,
    color: color || null,
    url: url || null,
    leida: false,
    referencia_tipo: referenciaTipo || null,
    referencia_id: referenciaId || null,
  }))

  await admin.from('notificaciones').insert(notificaciones)

  // Push a cada observador
  for (const obs of observadores) {
    enviarPush({ empresaId, usuarioId: obs.usuario_id, titulo, cuerpo, url }).catch(() => {})
  }
}

// Rate-limit en memoria: evita enviar push al mismo usuario+url más de 1 vez cada 5 minutos.
// Esto previene spam de push por eventos re-procesados, bugs de cursor, etc.
const pushRateLimit = new Map<string, number>()
const PUSH_COOLDOWN_MS = 5 * 60 * 1000 // 5 minutos

/**
 * Envía push notification via Firebase Cloud Messaging (FCM).
 * FCM enruta automáticamente a APNs para iOS — mucho más confiable que web-push directo.
 * El payload incluye webpush.notification para que iOS lo muestre sin depender del SW.
 */
async function enviarPush({
  empresaId,
  usuarioId,
  titulo,
  cuerpo,
  url,
}: {
  empresaId: string
  usuarioId: string
  titulo: string
  cuerpo?: string
  url?: string
}) {
  // Rate-limit: no enviar push al mismo usuario+url si ya se envió hace menos de 5 min
  const rateLimitKey = `${usuarioId}|${url || '/'}`
  const ultimoEnvio = pushRateLimit.get(rateLimitKey)
  if (ultimoEnvio && Date.now() - ultimoEnvio < PUSH_COOLDOWN_MS) {
    console.log(`[Push] Rate-limited: omitiendo push para ${usuarioId.slice(0, 8)}... (url: ${url}, último envío hace ${Math.round((Date.now() - ultimoEnvio) / 1000)}s)`)
    return
  }
  pushRateLimit.set(rateLimitKey, Date.now())

  // Limpiar entradas viejas del rate-limit cada 20 entradas (evitar memory leak)
  if (pushRateLimit.size > 20) {
    const ahora = Date.now()
    for (const [key, tiempo] of pushRateLimit) {
      if (ahora - tiempo > PUSH_COOLDOWN_MS) pushRateLimit.delete(key)
    }
  }

  const admin = crearClienteAdmin()

  // Buscar tokens FCM activos (guardados en la columna "endpoint")
  const { data: suscripciones } = await admin
    .from('suscripciones_push')
    .select('id, endpoint')
    .eq('usuario_id', usuarioId)
    .eq('empresa_id', empresaId)
    .eq('activa', true)

  if (!suscripciones || suscripciones.length === 0) return

  const tokens = suscripciones.map(s => s.endpoint).filter(Boolean)
  if (tokens.length === 0) return

  // Import dinámico para no cargar firebase-admin si no se usa
  const { obtenerMensajeriaAdmin } = await import('@/lib/firebase-admin')
  const mensajeria = obtenerMensajeriaAdmin()

  const urlDestino = url || '/'
  const tituloFinal = titulo || 'Flux'
  const cuerpoFinal = cuerpo || ''

  // Payload FCM multi-plataforma (mismo formato que el repo viejo que SÍ funcionaba)
  const mensaje = {
    // data: siempre presente, el SW lo usa para data-only messages
    data: {
      title: tituloFinal,
      body: cuerpoFinal,
      url: urlDestino,
      tipo: 'notificacion',
    },
    // webpush.notification: iOS Safari PWA lo muestra automáticamente sin pasar por el SW
    webpush: {
      headers: { Urgency: 'high' },
      notification: {
        title: tituloFinal,
        body: cuerpoFinal,
        icon: '/iconos/icon-192.png',
        badge: '/iconos/icon-192.png',
        tag: urlDestino,
        renotify: false,
        requireInteraction: false,
        silent: false,
        data: { url: urlDestino },
      },
      fcmOptions: { link: urlDestino },
    },
    // APNs nativo: canal directo de Apple (el más confiable para iOS)
    // apns-collapse-id agrupa notificaciones de la misma conversación en iOS
    apns: {
      headers: {
        'apns-priority': '10',
        'apns-collapse-id': urlDestino.slice(0, 64),
      },
      payload: {
        aps: {
          alert: { title: tituloFinal, body: cuerpoFinal },
          sound: 'default',
          badge: 1,
          'content-available': 1,
        },
      },
    },
    // Android: alta prioridad + collapseKey agrupa por conversación
    android: {
      priority: 'high' as const,
      collapseKey: urlDestino.slice(0, 64),
      notification: {
        title: tituloFinal,
        body: cuerpoFinal,
        sound: 'default',
        channelId: 'notificaciones',
      },
    },
    tokens,
  }

  try {
    const response = await mensajeria.sendEachForMulticast(mensaje)
    console.log(`[Push FCM] Enviados: ${response.successCount}/${tokens.length} a usuario ${usuarioId.slice(0, 8)}...`)

    // Limpiar tokens inválidos
    if (response.failureCount > 0) {
      const tokensInvalidos: string[] = []
      response.responses.forEach((r, i) => {
        if (!r.success) {
          const code = r.error?.code
          if (code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered') {
            tokensInvalidos.push(tokens[i])
          }
          console.error(`[Push FCM] Error token ${i}: ${code} — ${r.error?.message}`)
        }
      })

      // Desactivar suscripciones con tokens inválidos (filtrar por empresa también)
      for (const tokenInvalido of tokensInvalidos) {
        await admin
          .from('suscripciones_push')
          .update({ activa: false })
          .eq('endpoint', tokenInvalido)
          .eq('usuario_id', usuarioId)
          .eq('empresa_id', empresaId)
      }
    }

    // Actualizar timestamp de última notificación
    await admin
      .from('suscripciones_push')
      .update({ ultima_notificacion_en: new Date().toISOString() })
      .eq('usuario_id', usuarioId)
      .eq('empresa_id', empresaId)
      .eq('activa', true)
  } catch (err) {
    console.error(`[Push FCM] Error general:`, (err as Error).message)
  }
}
