/**
 * POST /api/ejecuciones/[id]/reejecutar (PR 18.3)
 *
 * Crea una ejecución NUEVA tomando el contexto de una ejecución
 * ya terminada (completado / fallado / cancelado) y la dispara.
 *
 * Decisiones aplicadas:
 *   - C: estados de origen permitidos = completado | fallado | cancelado
 *        (puedeReejecutar lo valida).
 *   - D: el flujo asociado debe estar en 'activo' o 'pausado'.
 *        Reejecutar un flujo en 'borrador' (nunca publicado) no
 *        tiene sentido — la versión que el original ejecutó ya no
 *        existe como publicada.
 *   - E: contexto_inicial se copia LITERAL. Lo que se hubiera
 *        ejecutado entonces es lo que se reejecuta. No re-enriquecemos
 *        el contexto con datos actuales (eso confundiría rerun con
 *        nueva ejecución).
 *   - O.4: clave_idempotencia de la ejecución nueva = NULL. No
 *        comparte clave con la original — UNIQUE parcial sobre
 *        (flujo_id, clave_idempotencia) WHERE clave_idempotencia IS
 *        NOT NULL no aplica a NULL, así que no hay conflicto.
 *
 * Sin dry-run: si en el body llega `dry_run: true`, devolvemos 501.
 * El sandbox real (con dry_run en el executor) se implementa en PR
 * 19.5.
 *
 * Permiso: `flujos.activar`.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { puedeReejecutar } from '@/lib/workflows/transiciones-ejecucion'
import {
  serializarDisparadoPor,
  type EstadoEjecucion,
} from '@/tipos/workflow'

type ParamsPromise = Promise<{ id: string }>

const MOTIVO_MAX_LEN = 500

export async function POST(request: NextRequest, { params }: { params: ParamsPromise }) {
  const { id } = await params

  const guard = await requerirPermisoAPI('flujos', 'activar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  // Body opcional: motivo + dry_run reservado.
  let motivo: string | null = null
  try {
    const body = await request.json().catch(() => ({}))
    if (body && typeof body === 'object') {
      const r = body as Record<string, unknown>
      if ('dry_run' in r && r.dry_run === true) {
        return NextResponse.json(
          {
            error:
              'dry_run todavía no está implementado. Llegará en PR 19.5 ' +
              'junto con el sandbox de la UI.',
            codigo: 'no_implementado',
          },
          { status: 501 },
        )
      }
      if ('motivo' in r) {
        const m = r.motivo
        if (m === null || m === undefined) {
          motivo = null
        } else if (typeof m !== 'string' || m.length > MOTIVO_MAX_LEN) {
          return NextResponse.json(
            { error: `motivo debe ser string de hasta ${MOTIVO_MAX_LEN} chars` },
            { status: 400 },
          )
        } else {
          motivo = m.trim() || null
        }
      }
    }
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const admin = crearClienteAdmin()

  // 1) Cargar ejecución original + flujo asociado.
  const { data: original } = await admin
    .from('ejecuciones_flujo')
    .select('id, flujo_id, estado, contexto_inicial, flujos!inner(id, estado)')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (!original) {
    return NextResponse.json({ error: 'Ejecución no encontrada' }, { status: 404 })
  }

  // 2) puedeReejecutar (decisión C).
  const evalE = puedeReejecutar(original.estado as EstadoEjecucion)
  if (!evalE.ok) {
    return NextResponse.json(
      { error: evalE.mensaje, codigo: evalE.codigo },
      { status: 409 },
    )
  }

  // 3) Estado del flujo (decisión D): activo o pausado.
  // PostgREST a veces devuelve el sub-recurso como objeto y a veces
  // como array según el tipo de relación inferida; normalizamos.
  const flujosCrudo = (original as { flujos?: unknown }).flujos
  const flujo = (Array.isArray(flujosCrudo) ? flujosCrudo[0] : flujosCrudo) as
    | { id: string; estado: string }
    | null
    | undefined
  if (!flujo) {
    return NextResponse.json(
      { error: 'El flujo asociado ya no existe.', codigo: 'flujo_eliminado' },
      { status: 409 },
    )
  }
  if (flujo.estado !== 'activo' && flujo.estado !== 'pausado') {
    return NextResponse.json(
      {
        error:
          'Solo se pueden reejecutar ejecuciones de flujos activos o ' +
          'pausados. Este flujo está en estado "' + flujo.estado + '".',
        codigo: 'flujo_no_activo',
      },
      { status: 409 },
    )
  }

  // 4) INSERT ejecución nueva. Copiamos contexto_inicial literal
  //    (decisión E). clave_idempotencia=NULL (O.4) para que no haya
  //    conflicto con la original ni con futuros reejecutar del mismo
  //    original. log y resultado arrancan vacíos.
  const { data: nueva, error: errIns } = await admin
    .from('ejecuciones_flujo')
    .insert({
      empresa_id: empresaId,
      flujo_id: original.flujo_id,
      estado: 'pendiente',
      disparado_por: serializarDisparadoPor({ tipo: 'manual', usuario_id: user.id }),
      contexto_inicial: original.contexto_inicial,
      log: [],
      intentos: 0,
      clave_idempotencia: null,
    })
    .select()
    .single()

  if (errIns) {
    console.error(JSON.stringify({
      nivel: 'error',
      mensaje: 'error_insert_ejecucion_reejecutar',
      ejecucion_original: id,
      detalle: errIns.message,
    }))
    return NextResponse.json({ error: 'Error al crear la ejecución nueva' }, { status: 500 })
  }

  // 5) Auditoría sobre el flujo (los rows de auditoria_flujos se
  //    indexan por flujo_id, así "reejecutar de Y" queda visible en
  //    el historial del flujo). valor_anterior=ejecución original,
  //    valor_nuevo=ejecución nueva.
  await admin.from('auditoria_flujos').insert({
    empresa_id: empresaId,
    flujo_id: original.flujo_id,
    editado_por: user.id,
    campo_modificado: 'reejecutar',
    valor_anterior: id,
    valor_nuevo: (nueva as { id: string }).id,
    motivo,
  })

  // 6) Disparar al worker fire-and-forget. Mismo patrón que el cron
  //    de tiempo (PR 17): await + AbortController + timeout 10s. No
  //    bloqueamos al cliente esperando el resultado del workflow —
  //    para eso se polea el detalle de la ejecución nueva.
  const webhookSecret = process.env.WEBHOOK_SECRET
  if (webhookSecret) {
    const workerUrl = `${request.nextUrl.origin}/api/workflows/correr-ejecucion`
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 10_000)
    try {
      await fetch(workerUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${webhookSecret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ ejecucion_id: (nueva as { id: string }).id }),
        signal: ctrl.signal,
      })
    } catch (e) {
      const nombre = e instanceof Error ? e.name : 'unknown'
      console.error(JSON.stringify({
        nivel: nombre === 'AbortError' ? 'warn' : 'error',
        mensaje: 'fetch_worker_reejecutar_incompleto',
        ejecucion_id: (nueva as { id: string }).id,
        detalle: e instanceof Error ? e.message : String(e),
      }))
    } finally {
      clearTimeout(timeoutId)
    }
  } else {
    console.error(JSON.stringify({
      nivel: 'critical',
      mensaje: 'webhook_secret_ausente_reejecutar',
      ejecucion_id: (nueva as { id: string }).id,
    }))
  }

  return NextResponse.json({ ejecucion: nueva })
}
