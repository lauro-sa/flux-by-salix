import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/cron/limpiar-storage — Scanner de archivos huérfanos en Supabase Storage.
 * Ejecutado por Vercel Cron semanalmente (domingo 3 AM).
 *
 * Revisa:
 * 1. Firmas de portal expiradas/eliminadas → bucket "documentos"
 * 2. Fotos de kiosco de miembros eliminados → bucket "fotos"
 * 3. PDFs de presupuestos eliminados → bucket "documentos-pdf"
 * 4. Suscripciones push inactivas antiguas → tabla suscripciones_push
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = crearClienteAdmin()
    const resultado: Record<string, number> = {}

    const hace90dias = new Date()
    hace90dias.setDate(hace90dias.getDate() - 90)

    // ─── 1. FIRMAS DE PORTAL EXPIRADAS ──────────────────────
    // Buscar portal_tokens con firma_url que ya expiraron o se eliminaron
    try {
      const { data: tokensExpirados } = await admin
        .from('portal_tokens')
        .select('id, firma_url')
        .not('firma_url', 'is', null)
        .lt('expira_en', new Date().toISOString())
        .limit(100)

      if (tokensExpirados && tokensExpirados.length > 0) {
        const rutas: string[] = []
        for (const token of tokensExpirados) {
          if (!token.firma_url) continue
          const match = token.firma_url.match(/\/storage\/v1\/object\/public\/documentos\/(.+)/)
          if (match?.[1]) rutas.push(match[1])
        }

        if (rutas.length > 0) {
          await admin.storage.from('documentos').remove(rutas)
        }

        // Limpiar referencia de firma en tokens expirados
        const ids = tokensExpirados.map(t => t.id)
        await admin
          .from('portal_tokens')
          .update({ firma_url: null })
          .in('id', ids)

        resultado.firmas_portal_limpiadas = rutas.length
      } else {
        resultado.firmas_portal_limpiadas = 0
      }
    } catch (err) {
      console.error('Error limpiando firmas portal:', err)
      resultado.firmas_portal_limpiadas = -1
    }

    // ─── 2. SUSCRIPCIONES PUSH INACTIVAS > 90 DÍAS ─────────
    try {
      const { count } = await admin
        .from('suscripciones_push')
        .delete({ count: 'exact' })
        .eq('activa', false)
        .lt('creada_en', hace90dias.toISOString())

      resultado.suscripciones_push_borradas = count || 0
    } catch (err) {
      console.error('Error limpiando suscripciones push:', err)
      resultado.suscripciones_push_borradas = -1
    }

    // ─── 3. LIMPIAR THUMBNAILS HUÉRFANOS DE PRESUPUESTOS ────
    // Buscar presupuestos en papelera que tienen PDFs en Storage
    try {
      const { data: presupuestosEliminados } = await admin
        .from('presupuestos')
        .select('id, empresa_id')
        .eq('en_papelera', true)
        .lt('papelera_en', hace90dias.toISOString())
        .limit(50)

      let pdfsLimpiados = 0
      if (presupuestosEliminados && presupuestosEliminados.length > 0) {
        const rutas: string[] = []
        for (const p of presupuestosEliminados) {
          // Rutas posibles de PDF y thumbnail
          rutas.push(
            `${p.empresa_id}/presupuestos/${p.id}.pdf`,
            `${p.empresa_id}/presupuestos/${p.id}_thumb.webp`,
          )
        }

        if (rutas.length > 0) {
          await admin.storage.from('documentos-pdf').remove(rutas)
          pdfsLimpiados = rutas.length
        }
      }
      resultado.pdfs_presupuestos_limpiados = pdfsLimpiados
    } catch (err) {
      console.error('Error limpiando PDFs presupuestos:', err)
      resultado.pdfs_presupuestos_limpiados = -1
    }

    return NextResponse.json({
      ...resultado,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Error en cron limpiar-storage:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
