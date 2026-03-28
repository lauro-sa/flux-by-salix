import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/inbox/correo/contadores — Contadores por canal y carpeta.
 * Retorna sin leer Y totales por carpeta para cada canal.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Traer todas las conversaciones de correo con canal_id, estado y sin_leer
    const { data: conversaciones } = await admin
      .from('conversaciones')
      .select('canal_id, estado, mensajes_sin_leer')
      .eq('empresa_id', empresaId)
      .eq('tipo_canal', 'correo')

    interface Conteo {
      entrada: number
      entrada_total: number
      enviados_total: number
      spam: number
      spam_total: number
      archivado_total: number
    }

    const contadores: Record<string, Conteo> = {}

    for (const conv of conversaciones || []) {
      if (!conv.canal_id) continue
      if (!contadores[conv.canal_id]) {
        contadores[conv.canal_id] = {
          entrada: 0, entrada_total: 0,
          enviados_total: 0,
          spam: 0, spam_total: 0,
          archivado_total: 0,
        }
      }

      const c = contadores[conv.canal_id]
      const sinLeer = conv.mensajes_sin_leer || 0

      switch (conv.estado) {
        case 'abierta':
        case 'en_espera':
          c.entrada += sinLeer
          c.entrada_total++
          break
        case 'spam':
          c.spam += sinLeer
          c.spam_total++
          break
        case 'resuelta':
          c.archivado_total++
          break
      }
    }

    return NextResponse.json({ contadores })
  } catch (err) {
    console.error('Error contadores correo:', err)
    return NextResponse.json({ contadores: {} })
  }
}
