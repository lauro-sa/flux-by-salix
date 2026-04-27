/**
 * GET/POST /api/admin/migrar-comprobantes-bucket
 *
 * Migra comprobantes de pago del bucket público `documentos-pdf` al privado
 * `comprobantes-pago`. Idempotente: solo procesa filas con
 * presupuesto_pago_comprobantes.bucket = 'documentos-pdf'. Una vez migrados
 * todos, el endpoint devuelve `migrados: 0` en cada llamada.
 *
 * Para cada comprobante:
 *   1) Descarga el archivo del bucket viejo.
 *   2) Lo sube al bucket nuevo (mismo storage_path).
 *   3) Actualiza `bucket = 'comprobantes-pago'` en BD + limpia `url` (legacy).
 *   4) Borra el archivo del bucket viejo.
 *
 * Si falla en cualquier paso para una fila, esa fila se salta (no se cambia
 * el bucket en BD) y la próxima corrida la reintenta.
 *
 * Auth (cualquiera de las dos):
 *   - Sesión activa con rol super-admin → abrir la URL desde el navegador.
 *   - Header Authorization: Bearer ${CRON_SECRET} → desde curl o cron.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'

const BATCH_MAX = 200
const BUCKET_VIEJO = 'documentos-pdf'
const BUCKET_NUEVO = 'comprobantes-pago'

async function ejecutar(): Promise<NextResponse> {
  const admin = crearClienteAdmin()

  const { data: comprobantes, error } = await admin
    .from('presupuesto_pago_comprobantes')
    .select('id, storage_path, mime_tipo, empresa_id')
    .eq('bucket', BUCKET_VIEJO)
    .limit(BATCH_MAX)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!comprobantes || comprobantes.length === 0) {
    return NextResponse.json({ migrados: 0, timestamp: new Date().toISOString() })
  }

  const okIds: string[] = []
  const fallos: Array<{ id: string; razon: string }> = []

  for (const c of comprobantes) {
    try {
      const { data: blob, error: errDownload } = await admin.storage
        .from(BUCKET_VIEJO)
        .download(c.storage_path)
      if (errDownload || !blob) {
        fallos.push({ id: c.id, razon: `download: ${errDownload?.message || 'sin blob'}` })
        continue
      }

      const buffer = Buffer.from(await blob.arrayBuffer())
      const { error: errUpload } = await admin.storage
        .from(BUCKET_NUEVO)
        .upload(c.storage_path, buffer, {
          contentType: c.mime_tipo || 'application/octet-stream',
          upsert: true,
        })
      if (errUpload) {
        fallos.push({ id: c.id, razon: `upload: ${errUpload.message}` })
        continue
      }

      const { error: errUpdate } = await admin
        .from('presupuesto_pago_comprobantes')
        .update({ bucket: BUCKET_NUEVO, url: '' })
        .eq('id', c.id)
      if (errUpdate) {
        // Storage subido pero BD no actualizada: dejamos el archivo en el
        // bucket nuevo y reintentamos en la próxima corrida (no doblamos
        // espacio porque upload era con upsert=true).
        fallos.push({ id: c.id, razon: `update: ${errUpdate.message}` })
        continue
      }

      const { error: errRemoveOld } = await admin.storage
        .from(BUCKET_VIEJO)
        .remove([c.storage_path])
      if (errRemoveOld) {
        // BD ya apunta al nuevo, así que el archivo viejo es huérfano.
        // No bloqueamos por esto; logueamos y seguimos.
        console.warn(`No se pudo borrar viejo ${c.storage_path}:`, errRemoveOld.message)
      }

      okIds.push(c.id)
    } catch (err) {
      fallos.push({ id: c.id, razon: (err as Error).message })
    }
  }

  return NextResponse.json({
    migrados: okIds.length,
    fallos: fallos.length,
    detalle_fallos: fallos,
    timestamp: new Date().toISOString(),
  })
}

async function autorizado(request: NextRequest): Promise<boolean> {
  // Modo curl/cron: Bearer CRON_SECRET.
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true

  // Modo browser: usuario logueado con rol super-admin (es_superadmin del JWT).
  // Permite invocar el backfill abriendo la URL desde la app sin curl.
  const { user } = await obtenerUsuarioRuta()
  if (user?.app_metadata?.es_superadmin === true) return true

  return false
}

export async function GET(request: NextRequest) {
  if (!(await autorizado(request))) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  try {
    return await ejecutar()
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
