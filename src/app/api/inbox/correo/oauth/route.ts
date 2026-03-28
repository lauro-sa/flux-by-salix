import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { generarUrlAutorizacionGmail } from '@/lib/gmail'
import { generarUrlAutorizacionOutlook } from '@/lib/outlook'

/**
 * POST /api/inbox/correo/oauth — Inicia el flujo OAuth de Gmail o Microsoft.
 * Genera la URL de autorización y la retorna para redirect.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { canal_id, nombre, proveedor } = body

    // Codificar estado para el callback
    const estado = Buffer.from(JSON.stringify({
      empresaId,
      userId: user.id,
      canalId: canal_id || null,
      nombre: nombre || (proveedor === 'outlook_oauth' ? 'Outlook' : 'Gmail'),
      proveedor: proveedor || 'gmail_oauth',
    })).toString('base64')

    let url: string

    if (proveedor === 'outlook_oauth') {
      url = generarUrlAutorizacionOutlook(estado)
    } else {
      url = generarUrlAutorizacionGmail(estado)
    }

    return NextResponse.json({ url })
  } catch (err) {
    console.error('Error iniciando OAuth correo:', err)
    return NextResponse.json({ error: 'Error al iniciar conexión' }, { status: 500 })
  }
}
