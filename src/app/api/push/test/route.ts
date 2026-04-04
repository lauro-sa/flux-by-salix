import { NextResponse } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/push/test — Envía un push de prueba via FCM al usuario autenticado.
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

    // 2. Verificar Firebase
    const diagnostico: Record<string, unknown> = {
      FIREBASE_SERVICE_ACCOUNT: process.env.FIREBASE_SERVICE_ACCOUNT ? 'OK (configurada)' : 'FALTA',
    }

    if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
      return NextResponse.json({ error: 'FIREBASE_SERVICE_ACCOUNT no configurada', diagnostico })
    }

    // 3. Buscar tokens FCM activos
    const admin = crearClienteAdmin()
    const { data: suscripciones, error: errSub } = await admin
      .from('suscripciones_push')
      .select('id, endpoint, activa')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .eq('activa', true)

    if (errSub) {
      return NextResponse.json({ error: 'Error buscando suscripciones', detalle: errSub.message, diagnostico })
    }

    if (!suscripciones || suscripciones.length === 0) {
      return NextResponse.json({ error: 'No hay tokens FCM activos. Desactivá y reactivá push en Mi Cuenta.', usuario: user.id, empresa: empresaId, diagnostico })
    }

    // 4. Enviar push de prueba via FCM
    const { obtenerMensajeriaAdmin } = await import('@/lib/firebase-admin')
    const mensajeria = obtenerMensajeriaAdmin()

    const tokens = suscripciones.map(s => s.endpoint).filter(Boolean)

    const mensaje = {
      data: {
        title: 'Test Push - Flux',
        body: 'Si ves esto, push funciona correctamente!',
        url: '/dashboard',
        tipo: 'test',
      },
      webpush: {
        headers: { Urgency: 'high' },
        notification: {
          title: 'Test Push - Flux',
          body: 'Si ves esto, push funciona correctamente!',
          icon: '/iconos/icon-192.png',
          badge: '/iconos/icon-192.png',
          tag: 'flux-test',
          requireInteraction: false,
          silent: false,
          data: { url: '/dashboard' },
        },
        fcmOptions: { link: '/dashboard' },
      },
      apns: {
        headers: { 'apns-priority': '10' },
        payload: {
          aps: {
            alert: { title: 'Test Push - Flux', body: 'Si ves esto, push funciona correctamente!' },
            sound: 'default',
            badge: 1,
            'content-available': 1,
          },
        },
      },
      android: {
        priority: 'high' as const,
        notification: {
          title: 'Test Push - Flux',
          body: 'Si ves esto, push funciona correctamente!',
          sound: 'default',
          channelId: 'notificaciones',
        },
      },
      tokens,
    }

    const response = await mensajeria.sendEachForMulticast(mensaje)

    const resultados = response.responses.map((r, i) => ({
      token: tokens[i].slice(0, 20) + '...',
      ok: r.success,
      ...(r.success ? { messageId: r.messageId } : { error: r.error?.code, detalle: r.error?.message }),
    }))

    return NextResponse.json({
      diagnostico,
      tokens: tokens.length,
      enviados: response.successCount,
      fallidos: response.failureCount,
      resultados,
    })
  } catch (err) {
    return NextResponse.json({ error: 'Error general', detalle: (err as Error).message }, { status: 500 })
  }
}
