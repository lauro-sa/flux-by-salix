import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { registrarWatchGmail } from '@/lib/gmail'

/**
 * GET /api/cron/sincronizar-correo — Cron job para sincronizar correos.
 * Ejecutado por Vercel Cron cada 5 minutos.
 * Llama al endpoint de sincronización con el CRON_SECRET.
 * También renueva los watches de Gmail que están por expirar.
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar secret del cron
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

    // 1. Sincronizar correos
    const res = await fetch(`${baseUrl}/api/inbox/correo/sincronizar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret || '',
      },
      body: JSON.stringify({}),
    })

    const data = await res.json()

    // 2. Renovar watches de Gmail que expiran en las próximas 24 horas
    let watchesRenovados = 0
    const topicName = process.env.GMAIL_PUBSUB_TOPIC
    if (topicName) {
      try {
        const admin = crearClienteAdmin()
        const { data: canalesGmail } = await admin
          .from('canales_inbox')
          .select('id, config_conexion, sync_cursor')
          .eq('tipo', 'correo')
          .eq('proveedor', 'gmail_oauth')
          .eq('activo', true)

        if (canalesGmail) {
          const en24Horas = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

          for (const canal of canalesGmail) {
            const cursor = (canal.sync_cursor || {}) as { watchExpiracion?: string; historyId?: string }
            const config = canal.config_conexion as { refresh_token: string; email: string }

            // Renovar si no tiene watch o si expira en las próximas 24h
            const necesitaRenovar = !cursor.watchExpiracion || cursor.watchExpiracion < en24Horas

            if (necesitaRenovar) {
              try {
                const watch = await registrarWatchGmail(config.refresh_token, topicName)
                await admin
                  .from('canales_inbox')
                  .update({
                    sync_cursor: {
                      ...cursor,
                      historyId: watch.historyId || cursor.historyId,
                      watchExpiracion: watch.expiracion,
                    },
                  })
                  .eq('id', canal.id)
                watchesRenovados++
                console.info(`[Gmail Watch] Renovado para ${config.email}, expira: ${watch.expiracion}`)
              } catch (err) {
                console.error(`[Gmail Watch] Error renovando watch para ${config.email}:`, err)
              }
            }
          }
        }
      } catch (err) {
        console.error('[Gmail Watch] Error en renovación de watches:', err)
      }
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      watchesRenovados,
      ...data,
    })
  } catch (err) {
    console.error('Error en cron sincronizar-correo:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
