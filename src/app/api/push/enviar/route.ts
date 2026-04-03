import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import webpush from 'web-push'

/**
 * POST /api/push/enviar — Enviar push notification a un usuario.
 * Llamado internamente desde crearNotificacion.
 * Body: { usuario_id, empresa_id, titulo, cuerpo, url, icono }
 *
 * Requiere variables de entorno:
 * - VAPID_PUBLIC_KEY
 * - VAPID_PRIVATE_KEY
 * - VAPID_SUBJECT (ej: "mailto:soporte@fluxsalix.com")
 */
export async function POST(request: NextRequest) {
  try {
    // Solo llamadas internas (con CRON_SECRET o service role)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json({ error: 'VAPID no configurado' }, { status: 500 })
    }

    webpush.setVapidDetails(
      VAPID_SUBJECT || 'mailto:soporte@fluxsalix.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
    )

    const body = await request.json()
    const { usuario_id, empresa_id, titulo, cuerpo, url } = body as {
      usuario_id: string
      empresa_id: string
      titulo: string
      cuerpo?: string
      url?: string
    }

    const admin = crearClienteAdmin()

    // Verificar modo concentración (si el usuario tiene preferencia guardada)
    // Por ahora, solo enviar a suscripciones activas

    // Buscar suscripciones activas del usuario
    const { data: suscripciones } = await admin
      .from('suscripciones_push')
      .select('id, endpoint, p256dh, auth')
      .eq('usuario_id', usuario_id)
      .eq('empresa_id', empresa_id)
      .eq('activa', true)

    if (!suscripciones || suscripciones.length === 0) {
      return NextResponse.json({ enviados: 0 })
    }

    const payload = JSON.stringify({
      titulo: titulo || 'Flux',
      cuerpo: cuerpo || '',
      url: url || '/',
      icono: '/iconos/icon-192.png',
      insignia: '/iconos/icon-192.png',
    })

    let enviados = 0
    const fallidos: string[] = []

    for (const sub of suscripciones) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload,
          { TTL: 3600 }
        )
        enviados++
        // Actualizar timestamp
        await admin
          .from('suscripciones_push')
          .update({ ultima_notificacion_en: new Date().toISOString() })
          .eq('id', sub.id)
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode
        // 404 o 410 = suscripción expirada → desactivar
        if (statusCode === 404 || statusCode === 410) {
          await admin
            .from('suscripciones_push')
            .update({ activa: false })
            .eq('id', sub.id)
        }
        fallidos.push(sub.id)
      }
    }

    return NextResponse.json({ enviados, fallidos: fallidos.length })
  } catch (err) {
    console.error('Error enviando push:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
