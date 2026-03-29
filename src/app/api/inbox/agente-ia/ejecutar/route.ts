import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { ejecutarPipelineAgente } from '@/lib/agente-ia/pipeline'

/**
 * POST /api/inbox/agente-ia/ejecutar — Ejecutar pipeline del agente IA en un mensaje.
 * Se usa en: testing manual y ejecución forzada desde la UI.
 *
 * Body: { conversacion_id, mensaje_id, canal_id, forzar? }
 */

export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { conversacion_id, mensaje_id, canal_id, forzar } = await request.json()

    if (!conversacion_id || !mensaje_id || !canal_id) {
      return NextResponse.json(
        { error: 'conversacion_id, mensaje_id y canal_id son requeridos' },
        { status: 400 },
      )
    }

    const admin = crearClienteAdmin()

    const resultado = await ejecutarPipelineAgente({
      admin,
      empresa_id: empresaId,
      conversacion_id,
      mensaje_id,
      canal_id,
      forzar,
    })

    return NextResponse.json({ resultado })
  } catch (err) {
    console.error('Error al ejecutar agente IA:', err)
    return NextResponse.json({ error: 'Error al ejecutar pipeline' }, { status: 500 })
  }
}
