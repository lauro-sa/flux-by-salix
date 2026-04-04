import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/push — Registrar token FCM.
 * Body: { token }
 *
 * DELETE /api/push — Eliminar token FCM.
 * Body: { token }
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { token } = body as { token: string }

    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Upsert: si ya existe este token para este usuario, actualizar
    const { error } = await admin
      .from('suscripciones_push')
      .upsert(
        {
          usuario_id: user.id,
          empresa_id: empresaId,
          endpoint: token,       // Reutilizamos la columna endpoint para guardar el FCM token
          p256dh: 'fcm',         // Marcador para diferenciar de suscripciones web-push legacy
          auth: 'fcm',
          activa: true,
          creada_en: new Date().toISOString(),
        },
        { onConflict: 'usuario_id,endpoint' }
      )

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error registrando push:', err)
    return NextResponse.json({ error: 'Error al registrar' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const body = await request.json()
    const { token } = body as { token: string }

    if (!token) {
      return NextResponse.json({ error: 'Token requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    await admin
      .from('suscripciones_push')
      .delete()
      .eq('usuario_id', user.id)
      .eq('endpoint', token)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error eliminando push:', err)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
