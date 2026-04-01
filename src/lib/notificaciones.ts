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

  // Anti-duplicación: buscar notificación existente no leída con misma referencia
  if (referenciaTipo && referenciaId) {
    const { data: existente } = await admin
      .from('notificaciones')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', usuarioId)
      .eq('referencia_tipo', referenciaTipo)
      .eq('referencia_id', referenciaId)
      .eq('leida', false)
      .limit(1)
      .maybeSingle()

    if (existente) {
      await admin
        .from('notificaciones')
        .update({ titulo, cuerpo: cuerpo || null, creada_en: new Date().toISOString() })
        .eq('id', existente.id)
      return
    }
  }

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

  if (error) {
    console.error('Error al crear notificación:', error)
    return
  }

  // Push notification (fire-and-forget, no bloquear)
  enviarPush({ empresaId, usuarioId, titulo, cuerpo, url }).catch(() => {})
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

  const filas = notificaciones.map(n => ({
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

  // Push notifications (fire-and-forget, no bloquear)
  const uniqueUsuarios = [...new Set(notificaciones.map(n => `${n.empresaId}|${n.usuarioId}`))]
  for (const key of uniqueUsuarios) {
    const [empresaId, usuarioId] = key.split('|')
    const primera = notificaciones.find(n => n.empresaId === empresaId && n.usuarioId === usuarioId)
    if (primera) {
      enviarPush({
        empresaId,
        usuarioId,
        titulo: primera.titulo,
        cuerpo: primera.cuerpo,
        url: primera.url,
      }).catch(() => {})
    }
  }
}

/**
 * Envía push notification a todas las suscripciones activas de un usuario.
 * Usa la librería web-push directamente para evitar llamadas HTTP internas.
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
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return

  const admin = crearClienteAdmin()

  // Buscar suscripciones activas
  const { data: suscripciones } = await admin
    .from('suscripciones_push')
    .select('id, endpoint, p256dh, auth')
    .eq('usuario_id', usuarioId)
    .eq('empresa_id', empresaId)
    .eq('activa', true)

  if (!suscripciones || suscripciones.length === 0) return

  // Import dinámico para no cargar web-push si no se usa
  const webpush = await import('web-push')
  webpush.setVapidDetails(
    VAPID_SUBJECT || 'mailto:soporte@fluxsalix.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  )

  const payload = JSON.stringify({
    titulo: titulo || 'Flux',
    cuerpo: cuerpo || '',
    url: url || '/',
  })

  for (const sub of suscripciones) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: 3600 },
      )
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        await admin.from('suscripciones_push').update({ activa: false }).eq('id', sub.id)
      }
    }
  }
}
