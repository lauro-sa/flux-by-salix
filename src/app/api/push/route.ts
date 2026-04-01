import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/push — Registrar suscripción push (Web Push API).
 * Body: { endpoint, keys: { p256dh, auth } }
 *
 * DELETE /api/push — Eliminar suscripción push.
 * Body: { endpoint }
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { endpoint, keys } = body as {
      endpoint: string
      keys: { p256dh: string; auth: string }
    }

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Upsert: si ya existe este endpoint para este usuario, actualizar claves
    const { error } = await admin
      .from('suscripciones_push')
      .upsert(
        {
          usuario_id: user.id,
          empresa_id: empresaId,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
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
    const { endpoint } = body as { endpoint: string }

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint requerido' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    await admin
      .from('suscripciones_push')
      .delete()
      .eq('usuario_id', user.id)
      .eq('endpoint', endpoint)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error eliminando push:', err)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
}
