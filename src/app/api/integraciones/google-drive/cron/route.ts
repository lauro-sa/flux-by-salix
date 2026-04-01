import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { sincronizarEmpresa } from '@/lib/google-drive-sync'
import type { ConfigGoogleDrive } from '@/lib/google-drive'

/**
 * POST /api/integraciones/google-drive/cron — Cron de sincronización automática.
 * Se ejecuta cada hora (vía Supabase cron, Vercel cron, o cron externo).
 * Recorre todas las empresas con Google Drive conectado y sincroniza
 * las que ya cumplieron su frecuencia configurada.
 *
 * Protección: requiere header Authorization con CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autorización del cron
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = crearClienteAdmin()

    // Obtener todas las empresas con Google Drive conectado
    const { data: configs } = await admin
      .from('configuracion_google_drive')
      .select('*')
      .eq('conectado', true)

    if (!configs?.length) {
      return NextResponse.json({ mensaje: 'No hay empresas con Google Drive conectado', sincronizadas: 0 })
    }

    const ahora = Date.now()
    let sincronizadas = 0
    const errores: string[] = []

    for (const config of configs as ConfigGoogleDrive[]) {
      // Verificar si ya pasó el tiempo de frecuencia
      const ultimaSync = config.ultima_sync ? new Date(config.ultima_sync).getTime() : 0
      const horasDesdeSync = (ahora - ultimaSync) / (1000 * 60 * 60)

      if (horasDesdeSync < config.frecuencia_horas) continue

      try {
        const resultado = await sincronizarEmpresa(admin, config)
        if (resultado.ok) {
          sincronizadas++
        } else {
          errores.push(`Empresa ${config.empresa_id}: ${resultado.error}`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        errores.push(`Empresa ${config.empresa_id}: ${msg}`)
      }
    }

    return NextResponse.json({
      sincronizadas,
      total: configs.length,
      errores: errores.length > 0 ? errores : undefined,
    })
  } catch (err) {
    console.error('Error cron Google Drive:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
