import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { generarUrlAutorizacionGmail } from '@/lib/gmail'
import { generarUrlAutorizacionOutlook } from '@/lib/outlook'

/**
 * POST /api/inbox/correo/oauth — Inicia el flujo OAuth de Gmail o Microsoft.
 * Genera la URL de autorización y la retorna para redirect.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('config_correo', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const body = await request.json()
    const { canal_id, nombre, proveedor, propietario_usuario_id } = body

    // Codificar estado para el callback. Si viene propietario_usuario_id, se propaga
    // para que el callback cree el canal como bandeja personal de ese usuario.
    const estado = Buffer.from(JSON.stringify({
      empresaId,
      userId: user.id,
      canalId: canal_id || null,
      nombre: nombre || (proveedor === 'outlook_oauth' ? 'Outlook' : 'Gmail'),
      proveedor: proveedor || 'gmail_oauth',
      propietarioUsuarioId: propietario_usuario_id || null,
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
