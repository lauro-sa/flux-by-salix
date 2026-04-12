import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/storage/recalcular — Recalcula el uso de storage para todas las empresas.
 * Escanea los registros de BD que referencian archivos en Storage y suma bytes.
 * Requiere CRON_SECRET o superadmin.
 *
 * Se usa: una vez para inicializar, o periódicamente para corregir drift.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = crearClienteAdmin()

    // Obtener todas las empresas
    const { data: empresas } = await admin
      .from('empresas')
      .select('id')

    if (!empresas || empresas.length === 0) {
      return NextResponse.json({ empresas_procesadas: 0 })
    }

    const resultados: Record<string, Record<string, { bytes: number; archivos: number }>> = {}

    for (const empresa of empresas) {
      const eid = empresa.id
      const buckets: Record<string, { bytes: number; archivos: number }> = {}

      // 1. Bucket "adjuntos" — mensaje_adjuntos
      const { data: adjuntos } = await admin
        .from('mensaje_adjuntos')
        .select('tamano_bytes')
        .eq('empresa_id', eid)

      if (adjuntos && adjuntos.length > 0) {
        buckets['adjuntos'] = {
          bytes: adjuntos.reduce((s, a) => s + (a.tamano_bytes || 0), 0),
          archivos: adjuntos.length,
        }
      }

      // 2. Bucket "documentos-pdf" — chatter adjuntos
      const { data: chatters } = await admin
        .from('chatter')
        .select('adjuntos')
        .eq('empresa_id', eid)
        .not('adjuntos', 'eq', '[]')

      if (chatters && chatters.length > 0) {
        let bytes = 0
        let archivos = 0
        for (const c of chatters) {
          const adjs = c.adjuntos as Array<{ tamano?: number }> | null
          if (!Array.isArray(adjs)) continue
          for (const a of adjs) {
            archivos++
            bytes += a.tamano || 0
          }
        }
        if (archivos > 0) {
          buckets['documentos-pdf'] = { bytes, archivos }
        }
      }

      // 3. Bucket "fotos" — asistencias con fotos
      const { data: asistencias } = await admin
        .from('asistencias')
        .select('foto_entrada, foto_salida')
        .eq('empresa_id', eid)
        .or('foto_entrada.not.is.null,foto_salida.not.is.null')

      if (asistencias && asistencias.length > 0) {
        // Estimación: ~100KB por foto de kiosco comprimida
        const cantFotos = asistencias.reduce((s, a) =>
          s + (a.foto_entrada ? 1 : 0) + (a.foto_salida ? 1 : 0), 0)
        if (cantFotos > 0) {
          buckets['fotos'] = {
            bytes: cantFotos * 100 * 1024, // estimación conservadora
            archivos: cantFotos,
          }
        }
      }

      // Upsert resultados en uso_storage
      for (const [bucket, datos] of Object.entries(buckets)) {
        await admin
          .from('uso_storage')
          .upsert({
            empresa_id: eid,
            bucket,
            bytes_usados: datos.bytes,
            cantidad_archivos: datos.archivos,
            actualizado_en: new Date().toISOString(),
          }, { onConflict: 'empresa_id,bucket' })
      }

      resultados[eid] = buckets
    }

    return NextResponse.json({
      empresas_procesadas: empresas.length,
      resultados,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Error recalculando storage:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
