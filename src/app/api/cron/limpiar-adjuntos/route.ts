import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { descontarUsoStorage } from '@/lib/uso-storage'

/**
 * GET /api/cron/limpiar-adjuntos — Limpia adjuntos huérfanos (borradores no enviados).
 * Ejecutado por Vercel Cron diariamente.
 * Elimina adjuntos con mensaje_id NULL que tengan más de 24 horas.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = crearClienteAdmin()
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // Buscar adjuntos huérfanos
    const { data: huerfanos } = await admin
      .from('mensaje_adjuntos')
      .select('id, storage_path, empresa_id, tamano_bytes')
      .is('mensaje_id', null)
      .lt('creado_en', hace24h)
      .limit(100)

    if (!huerfanos || huerfanos.length === 0) {
      return NextResponse.json({ eliminados: 0, timestamp: new Date().toISOString() })
    }

    // Eliminar de Storage
    const paths = huerfanos.map(a => a.storage_path).filter(Boolean)
    if (paths.length > 0) {
      await admin.storage.from('adjuntos').remove(paths)
    }

    // Eliminar de BD
    const ids = huerfanos.map(a => a.id)
    await admin
      .from('mensaje_adjuntos')
      .delete()
      .in('id', ids)

    // Descontar uso de storage por empresa
    for (const h of huerfanos) {
      if (h.empresa_id && h.tamano_bytes) {
        descontarUsoStorage(h.empresa_id, 'adjuntos', h.tamano_bytes)
      }
    }

    return NextResponse.json({
      eliminados: ids.length,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Error limpiando adjuntos:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
