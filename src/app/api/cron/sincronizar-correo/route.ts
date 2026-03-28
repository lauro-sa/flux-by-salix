import { NextResponse, type NextRequest } from 'next/server'

/**
 * GET /api/cron/sincronizar-correo — Cron job para sincronizar correos.
 * Ejecutado por Vercel Cron cada 5 minutos.
 * Llama al endpoint de sincronización con el CRON_SECRET.
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar secret del cron
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin

    const res = await fetch(`${baseUrl}/api/inbox/correo/sincronizar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': cronSecret || '',
      },
      body: JSON.stringify({}),
    })

    const data = await res.json()

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      ...data,
    })
  } catch (err) {
    console.error('Error en cron sincronizar-correo:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
