import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerHistorialGmail, obtenerMensajeCompleto } from '@/lib/gmail'

/**
 * POST /api/inbox/correo/webhook — Webhook para Gmail Push Notifications (Pub/Sub).
 * Google envía notificaciones cuando hay cambios en el buzón.
 * Payload: base64-encoded JSON con emailAddress y historyId.
 *
 * Requisitos previos:
 * 1. Crear topic en Google Cloud Pub/Sub
 * 2. Dar permisos de publicación a gmail-api-push@system.gserviceaccount.com
 * 3. Crear suscripción push apuntando a esta URL
 * 4. Registrar watch via gmail.users.watch() (se hace en el OAuth callback)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Pub/Sub envía: { message: { data: "base64...", messageId: "...", publishTime: "..." }, subscription: "..." }
    const mensajePubSub = body.message?.data
    if (!mensajePubSub) {
      return NextResponse.json({ ok: true }) // ACK sin procesar
    }

    // Decodificar mensaje
    const decoded = JSON.parse(Buffer.from(mensajePubSub, 'base64').toString())
    const { emailAddress, historyId } = decoded

    if (!emailAddress || !historyId) {
      return NextResponse.json({ ok: true })
    }

    const admin = crearClienteAdmin()

    // Buscar canal por email
    const { data: canales } = await admin
      .from('canales_inbox')
      .select('*')
      .eq('tipo', 'correo')
      .eq('proveedor', 'gmail_oauth')
      .eq('activo', true)

    if (!canales || canales.length === 0) {
      return NextResponse.json({ ok: true })
    }

    // Encontrar el canal que corresponde a este email
    const canal = canales.find(c => {
      const config = c.config_conexion as { email?: string }
      return config.email?.toLowerCase() === emailAddress.toLowerCase()
    })

    if (!canal) {
      return NextResponse.json({ ok: true })
    }

    const config = canal.config_conexion as { refresh_token: string; email: string }
    const cursor = (canal.sync_cursor || {}) as { historyId?: string }

    if (!cursor.historyId) {
      // Si no tenemos historyId previo, no podemos hacer sync incremental
      return NextResponse.json({ ok: true })
    }

    // Sync incremental desde el último historyId
    try {
      const { cambios, historyIdNuevo } = await obtenerHistorialGmail(
        config.refresh_token,
        cursor.historyId,
      )

      // Importar la lógica de procesamiento
      // En vez de duplicar, llamamos al endpoint de sincronización
      const hayCambios = cambios.mensajesAgregados.length > 0 || cambios.mensajesEliminados.length > 0
      if (hayCambios) {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL
        if (baseUrl) {
          try {
            await fetch(`${baseUrl}/api/inbox/correo/sincronizar`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-cron-secret': process.env.CRON_SECRET || '',
              },
              body: JSON.stringify({ canal_id: canal.id }),
              signal: AbortSignal.timeout(55000), // Timeout antes del límite de Vercel (60s)
            })
          } catch (err) {
            console.error(`Error sincronizando canal ${canal.id} desde webhook:`, err)
          }
        }
      }

      // Actualizar historyId
      await admin
        .from('canales_inbox')
        .update({
          sync_cursor: {
            ...cursor,
            historyId: historyIdNuevo,
          },
          actualizado_en: new Date().toISOString(),
        })
        .eq('id', canal.id)
    } catch (err) {
      console.error(`Error procesando webhook Gmail para ${emailAddress}:`, err)
    }

    // Siempre responder 200 para que Pub/Sub no reintente
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error en webhook correo:', err)
    // Siempre 200 para evitar reintentos
    return NextResponse.json({ ok: true })
  }
}
