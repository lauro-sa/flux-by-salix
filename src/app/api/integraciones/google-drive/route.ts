import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import {
  generarUrlAutorizacion,
  revocarToken,
  MODULOS_SYNC,
} from '@/lib/google-drive'

/**
 * API de integración Google Drive.
 * GET  — Obtener configuración actual
 * POST — Iniciar conexión (devuelve URL de OAuth)
 * PATCH — Actualizar configuración (frecuencia, módulos activos)
 * DELETE — Desconectar Google Drive
 * Se usa en: configuración de contactos → sección Google Drive.
 */

export async function GET() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    const { data: config } = await admin
      .from('configuracion_google_drive')
      .select('id, conectado, email, frecuencia_horas, modulos_activos, hojas, ultima_sync, ultimo_error, resumen')
      .eq('empresa_id', empresaId)
      .maybeSingle()

    return NextResponse.json({
      config: config || { conectado: false },
      modulosDisponibles: MODULOS_SYNC,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar que las credenciales de Google estén configuradas
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      return NextResponse.json({
        error: 'Para conectar Google Drive necesitás configurar GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET en las variables de entorno del servidor. Creá las credenciales en Google Cloud Console.',
      }, { status: 400 })
    }

    // Generar URL de OAuth con el empresa_id como state
    const estado = Buffer.from(JSON.stringify({ empresaId, userId: user.id })).toString('base64')
    const url = generarUrlAutorizacion(estado)

    return NextResponse.json({ url })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { frecuencia_horas, modulos_activos } = body

    const admin = crearClienteAdmin()
    const campos: Record<string, unknown> = { actualizado_en: new Date().toISOString() }

    if (frecuencia_horas !== undefined) {
      const validas = [1, 6, 12, 24, 48, 72]
      if (!validas.includes(frecuencia_horas)) {
        return NextResponse.json({ error: 'Frecuencia no válida' }, { status: 400 })
      }
      campos.frecuencia_horas = frecuencia_horas
    }

    if (modulos_activos !== undefined) {
      const clavesValidas = MODULOS_SYNC.map(m => m.clave)
      const filtrados = (modulos_activos as string[]).filter(m => clavesValidas.includes(m))
      campos.modulos_activos = filtrados
    }

    await admin
      .from('configuracion_google_drive')
      .update(campos)
      .eq('empresa_id', empresaId)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Obtener config actual para revocar token
    const { data: config } = await admin
      .from('configuracion_google_drive')
      .select('refresh_token')
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (config?.refresh_token) {
      await revocarToken(config.refresh_token)
    }

    // Limpiar configuración (no borrar el registro, solo desconectar)
    await admin
      .from('configuracion_google_drive')
      .update({
        conectado: false,
        email: null,
        refresh_token: null,
        access_token: null,
        token_expira_en: null,
        folder_id: null,
        hojas: {},
        ultima_sync: null,
        ultimo_error: null,
        resumen: {},
        actualizado_en: new Date().toISOString(),
      })
      .eq('empresa_id', empresaId)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
