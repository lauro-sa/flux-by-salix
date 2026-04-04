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
    .from('miembros_empresa')
    .select('usuario_id, rol')
    .eq('empresa_id', empresaId)
    .in('rol', ['propietario', 'administrador'])
    .eq('activo', true)
    .neq('usuario_id', usuarioIdOriginal)

  if (!miembros || miembros.length === 0) return

  // Verificar cuáles tienen la preferencia activada
  const { data: preferencias } = await admin
    .from('preferencias_usuario')
    .select('usuario_id, preferencias')
    .eq('empresa_id', empresaId)
    .in('usuario_id', miembros.map(m => m.usuario_id))

  const observadores = miembros.filter(m => {
    const pref = preferencias?.find(p => p.usuario_id === m.usuario_id)
    return pref?.preferencias?.recibir_todas_notificaciones === true
  })

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
    icono: '/iconos/icon-192.png',
  })

  for (const sub of suscripciones) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        {
          TTL: 3600,
          urgency: 'high', // iOS deprioritiza sin urgency alta
          headers: {
            Urgency: 'high',
          },
        },
      )
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 404 || statusCode === 410) {
        await admin.from('suscripciones_push').update({ activa: false }).eq('id', sub.id)
      }
    }
  }
}
