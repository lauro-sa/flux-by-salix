/**
 * GET /api/cron/purgar-pagos-eliminados
 *
 * Cron diario que purga físicamente los pagos en papelera con más de 7 días
 * (presupuesto_pagos.eliminado_en < NOW() - 7 días).
 *
 * Para cada pago:
 *   1) Lee sus comprobantes desde presupuesto_pago_comprobantes.
 *   2) Borra los archivos del Storage (bucket documentos-pdf).
 *   3) Descuenta el uso de Storage por empresa.
 *   4) Borra el pago de BD (CASCADE elimina los comprobantes en BD).
 *
 * El trigger trg_presupuesto_pago_auditoria registra automáticamente el
 * evento 'delete' en presupuesto_pago_auditoria, así que la trazabilidad
 * fiscal se mantiene aún después de la purga física.
 *
 * Idempotencia: procesa en batches de 100. Si una corrida no alcanza, la
 * próxima retoma. Si falla el Storage para un pago, ese pago se salta y
 * NO se borra de BD (para evitar quedar con archivos huérfanos).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { descontarUsoStorage } from '@/lib/uso-storage'

const DIAS_GRACIA = 7
const BATCH_MAX = 100

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const admin = crearClienteAdmin()
    const limite = new Date(Date.now() - DIAS_GRACIA * 24 * 60 * 60 * 1000).toISOString()

    // Pagos a purgar (en papelera más de 7 días)
    const { data: pagos, error: errSelect } = await admin
      .from('presupuesto_pagos')
      .select('id, empresa_id')
      .not('eliminado_en', 'is', null)
      .lt('eliminado_en', limite)
      .limit(BATCH_MAX)

    if (errSelect) {
      console.error('Error al listar pagos a purgar:', errSelect)
      return NextResponse.json({ error: 'Error al listar' }, { status: 500 })
    }

    if (!pagos || pagos.length === 0) {
      return NextResponse.json({ purgados: 0, timestamp: new Date().toISOString() })
    }

    const purgadosOk: string[] = []
    const errores: Array<{ pagoId: string; razon: string }> = []

    // Traer todos los comprobantes de los pagos a purgar (una sola query)
    const ids = pagos.map((p) => p.id)
    const { data: comprobantes } = await admin
      .from('presupuesto_pago_comprobantes')
      .select('pago_id, storage_path, tamano_bytes, empresa_id')
      .in('pago_id', ids)

    const compsPorPago = new Map<
      string,
      Array<{ storage_path: string; tamano_bytes: number | null; empresa_id: string }>
    >()
    for (const c of comprobantes || []) {
      if (!c.storage_path) continue
      const arr = compsPorPago.get(c.pago_id) || []
      arr.push({
        storage_path: c.storage_path,
        tamano_bytes: c.tamano_bytes,
        empresa_id: c.empresa_id,
      })
      compsPorPago.set(c.pago_id, arr)
    }

    // Procesar uno a uno: si falla el Storage de un pago, se salta sin
    // afectar a los otros del batch.
    for (const pago of pagos) {
      const comps = compsPorPago.get(pago.id) || []
      try {
        if (comps.length > 0) {
          const paths = comps.map((c) => c.storage_path)
          const { error: errStorage } = await admin.storage
            .from('documentos-pdf')
            .remove(paths)
          if (errStorage) {
            errores.push({ pagoId: pago.id, razon: `storage: ${errStorage.message}` })
            continue
          }
          // Descontar uso una vez confirmado el remove
          for (const c of comps) {
            if (c.tamano_bytes && c.empresa_id) {
              descontarUsoStorage(c.empresa_id, 'documentos-pdf', Number(c.tamano_bytes))
            }
          }
        }

        const { error: errDelete } = await admin
          .from('presupuesto_pagos')
          .delete()
          .eq('id', pago.id)
          .eq('empresa_id', pago.empresa_id)
        if (errDelete) {
          errores.push({ pagoId: pago.id, razon: `delete: ${errDelete.message}` })
          continue
        }

        purgadosOk.push(pago.id)
      } catch (err) {
        errores.push({ pagoId: pago.id, razon: (err as Error).message })
      }
    }

    return NextResponse.json({
      purgados: purgadosOk.length,
      errores: errores.length,
      detalle_errores: errores,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Error en cron purgar-pagos-eliminados:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
