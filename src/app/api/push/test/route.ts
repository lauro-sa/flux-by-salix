import { NextResponse } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import webpush from 'web-push'

/**
 * GET /api/push/test — Envía un push de prueba al usuario autenticado.
 * Solo para debugging — remover en producción.
 */
export async function GET() {
  try {
    // 1. Verificar auth
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa' }, { status: 403 })

    // 2. Verificar VAPID
    const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env
    const diagnostico: Record<string, unknown> = {
      VAPID_PUBLIC_KEY: VAPID_PUBLIC_KEY ? `${VAPID_PUBLIC_KEY.slice(0, 10)}...` : 'FALTA',
      VAPID_PRIVATE_KEY: VAPID_PRIVATE_KEY ? 'OK (oculta)' : 'FALTA',
      VAPID_SUBJECT: VAPID_SUBJECT || 'FALTA',
    }

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      return NextResponse.json({ error: 'VAPID no configurado', diagnostico })
    }

    // 3. Buscar suscripciones
    const admin = crearClienteAdmin()
    const { data: suscripciones, error: errSub } = await admin
      .from('suscripciones_push')
      .select('id, endpoint, p256dh, auth, activa')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .eq('activa', true)

    if (errSub) {
      return NextResponse.json({ error: 'Error buscando suscripciones', detalle: errSub.message, diagnostico })
    }

    if (!suscripciones || suscripciones.length === 0) {
      return NextResponse.json({ error: 'No hay suscripciones activas', usuario: user.id, empresa: empresaId, diagnostico })
    }

    // 4. Enviar push de prueba
    webpush.setVapidDetails(
      VAPID_SUBJECT || 'mailto:soporte@fluxsalix.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY,
    )

    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://fluxsalix.com'

    // Payload dual: custom para SW + Declarative Web Push para Safari 18.4+
    const payload = JSON.stringify({
      titulo: 'Test Push - Flux',
      cuerpo: 'Si ves esto, push funciona correctamente!',
      url: '/dashboard',
      icono: '/iconos/icon-192.png',
      // Declarative Web Push (Safari 18.4+ / iOS 18.4+)
      web_push: 8030,
      notification: {
        title: 'Test Push - Flux',
        body: 'Si ves esto, push funciona correctamente!',
        navigate: `${APP_URL}/dashboard`,
        silent: false,
        app_badge: 'increment',
      },
    })

    const resultados = []

    for (const sub of suscripciones) {
      const esApple = sub.endpoint.includes('web.push.apple.com')
      try {
        const res = await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          {
            TTL: esApple ? 86400 : 3600,
            urgency: 'high',
            contentEncoding: 'aes128gcm',
            headers: {
              Urgency: 'high',
              ...(esApple ? { Topic: 'flux-test' } : {}),
            },
          },
        )
        resultados.push({
          endpoint: sub.endpoint.slice(0, 60) + '...',
          plataforma: esApple ? 'Apple (iOS/Safari)' : 'Chrome/Firefox',
          status: res.statusCode,
          ok: true,
        })
      } catch (err) {
        const e = err as { statusCode?: number; body?: string; message?: string }
        resultados.push({
          endpoint: sub.endpoint.slice(0, 60) + '...',
          plataforma: esApple ? 'Apple (iOS/Safari)' : 'Chrome/Firefox',
          status: e.statusCode,
          error: e.message || e.body || 'desconocido',
          ok: false,
        })
      }
    }

    return NextResponse.json({
      diagnostico,
      suscripciones: suscripciones.length,
      resultados,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Error general', detalle: (err as Error).message }, { status: 500 })
  }
}
