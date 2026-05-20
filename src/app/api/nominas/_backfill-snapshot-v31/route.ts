/**
 * POST /api/nominas/_backfill-snapshot-v31 — Backfill de snapshots v3.0 → v3.1.
 *
 * Migra snapshots viejos en `liquidaciones_empleado_periodo` para que tengan
 * `snapshot_calculo.fila_listado` poblado y el endpoint /api/nominas pueda
 * saltarse el motor en los GET futuros.
 *
 * Sin este backfill, empleados ya liquidados (antes del PR de v3.1) siguen
 * recalculando en vivo hasta que se reliquiden o paguen de nuevo — el código
 * de /api/nominas detecta el shape viejo y cae a fallback transparente, pero
 * pierde la oportunidad de performance del skip del motor.
 *
 * Procesa UN período por llamada (más eficiente: una sola pasada al motor
 * cubre todos los empleados del período). Para backfillar varios meses,
 * llamar al endpoint N veces, una por período.
 *
 * Seguridad: requiere `es_superadmin` en el JWT. No alcanza con permiso
 * 'nomina', porque este endpoint modifica datos persistidos del audit trail
 * y debería usarse solo durante la migración inicial.
 *
 * Body:
 *   {
 *     desde:        'YYYY-MM-DD',   // inicio del período
 *     hasta:        'YYYY-MM-DD',   // fin del período
 *     periodo?:     'mes' | 'quincena' | 'semana',  // se infiere si no viene
 *     empresa_id?:  string          // por default usa empresa_activa_id del JWT
 *   }
 *
 * Devuelve:
 *   {
 *     periodo: { desde, hasta },
 *     candidatos: number,           // snapshots v3.0 encontrados
 *     actualizados: number,         // cuántos quedaron en v3.1
 *     omitidos: Array<{ miembro_id, razon }>,
 *   }
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

interface Payload {
  desde: string
  hasta: string
  periodo?: 'mes' | 'quincena' | 'semana'
  empresa_id?: string
}

export async function POST(request: NextRequest) {
  // Auth + superadmin guard.
  const { user } = await obtenerUsuarioRuta()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  const esSuperadmin = !!user.app_metadata?.es_superadmin
  if (!esSuperadmin) {
    return NextResponse.json({ error: 'Requiere superadmin' }, { status: 403 })
  }

  let body: Payload
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { desde, hasta, periodo } = body
  const empresaId = body.empresa_id ?? (user.app_metadata?.empresa_activa_id as string | undefined)
  if (!desde || !hasta || !empresaId) {
    return NextResponse.json({ error: 'desde, hasta y empresa_id requeridos' }, { status: 400 })
  }

  const admin = crearClienteAdmin()

  // 1. Identificar candidatos: liquidaciones del período con snapshot
  //    poblado pero sin `fila_listado` (= shape v3.0).
  const { data: filasRaw } = await admin
    .from('liquidaciones_empleado_periodo')
    .select('miembro_id, estado_clave, snapshot_calculo')
    .eq('empresa_id', empresaId)
    .eq('periodo_inicio', desde)
    .eq('periodo_fin', hasta)
    .neq('estado_clave', 'borrador')

  const candidatos: Array<{ miembro_id: string; snapshotActual: Record<string, unknown> }> = []
  for (const f of (filasRaw ?? []) as Array<{ miembro_id: string; estado_clave: string; snapshot_calculo: Record<string, unknown> | null }>) {
    const snap = f.snapshot_calculo
    if (!snap) continue
    // Si ya tiene fila_listado, está en v3.1 — saltar.
    if ('fila_listado' in snap && snap.fila_listado) continue
    candidatos.push({ miembro_id: f.miembro_id, snapshotActual: snap })
  }

  if (candidatos.length === 0) {
    return NextResponse.json({
      periodo: { desde, hasta },
      candidatos: 0,
      actualizados: 0,
      omitidos: [],
    })
  }

  // 2. Llamar a /api/nominas para obtener la fila completa de cada
  //    empleado del período. Una sola pasada al motor cubre todos.
  //    Como los empleados están en estado != borrador, normalmente
  //    /api/nominas leería del snapshot — pero como el snapshot está
  //    v3.0 (sin fila_listado), cae al recálculo en vivo, justo lo
  //    que queremos para capturar la fila enriquecida.
  const params = new URLSearchParams()
  params.set('desde', desde)
  params.set('hasta', hasta)
  if (periodo) params.set('periodo', periodo)
  const url = new URL(`/api/nominas?${params.toString()}`, request.url)
  const cookie = request.headers.get('cookie') ?? ''
  const r = await fetch(url, { headers: { cookie }, cache: 'no-store' })
  if (!r.ok) {
    return NextResponse.json({ error: 'No se pudo obtener listado' }, { status: 500 })
  }
  const data = await r.json() as { resultados?: Array<Record<string, unknown>> }
  const filaPorMiembro = new Map<string, Record<string, unknown>>()
  for (const fila of (data.resultados ?? [])) {
    filaPorMiembro.set(fila.miembro_id as string, fila)
  }

  // 3. Update por candidato: enriquecemos su snapshot con fila_listado
  //    y bumpeamos version_motor a v3.1, preservando lo demás.
  const omitidos: Array<{ miembro_id: string; razon: string }> = []
  let actualizados = 0
  for (const c of candidatos) {
    const fila = filaPorMiembro.get(c.miembro_id)
    if (!fila) {
      omitidos.push({ miembro_id: c.miembro_id, razon: 'no_aparecio_en_listado' })
      continue
    }
    const snapshotNuevo = {
      ...c.snapshotActual,
      version_motor: 'v3.1',
      // Si el snapshot viejo no tenía `detalle` (era spread plano al toplevel),
      // lo mantenemos así para no romper consumidores que leen campos planos.
      // El consumidor nuevo (calcular-con-snapshot.ts) ya tiene fallback.
      fila_listado: fila,
      backfilled_en: new Date().toISOString(),
    }
    const { error } = await admin
      .from('liquidaciones_empleado_periodo')
      .update({ snapshot_calculo: snapshotNuevo })
      .eq('empresa_id', empresaId)
      .eq('miembro_id', c.miembro_id)
      .eq('periodo_inicio', desde)
      .eq('periodo_fin', hasta)
    if (error) {
      omitidos.push({ miembro_id: c.miembro_id, razon: `update_falló: ${error.message}` })
      continue
    }
    actualizados++
  }

  return NextResponse.json({
    periodo: { desde, hasta },
    candidatos: candidatos.length,
    actualizados,
    omitidos,
  })
}
