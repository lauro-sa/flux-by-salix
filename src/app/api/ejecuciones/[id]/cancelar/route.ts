/**
 * POST /api/ejecuciones/[id]/cancelar (PR 18.3)
 *
 * Cancela una ejecución que está esperando en cola o pendiente de
 * arrancar. NO cancela las ejecuciones en estado 'corriendo' —
 * cortar a mitad de un workflow puede dejar WhatsApps a medio
 * enviar, actividades creadas sin notificación, etc. (decisión F
 * del plan de scope).
 *
 * Permiso: `flujos.activar`.
 *
 * Body: `{ motivo?: string }`.
 *
 * Lógica:
 *   1. puedeCancelar(estado) — devuelve `corriendo_no_cancelable` o
 *      `ya_terminada` si no aplica.
 *   2. UPDATE atómico sobre `ejecuciones_flujo` con guarda
 *      `WHERE estado IN ('pendiente', 'esperando')` para que un
 *      cron que toma la ejecución entre el SELECT y el UPDATE no
 *      cause race.
 *   3. UPDATE acciones_pendientes asociadas a `cancelada` (las
 *      pendientes de la cola; las que ya están en 'ejecutando' o
 *      'ok' no se tocan).
 *   4. 1 row de auditoría sobre el flujo: `campo='cancelar_ejecucion'`,
 *      `valor_anterior=estado_anterior`, `valor_nuevo='cancelado'`.
 *
 * TODO post-merge a main:
 *   Endpoint admin "forzar-cancelar" para ejecuciones colgadas en
 *   'corriendo' (caso edge: el worker se cayó a mitad y la fila
 *   quedó marcada 'corriendo' indefinidamente). Requeriría permiso
 *   super-admin (es_superadmin del JWT) y dejaría el log con un
 *   warning explícito de que se cortó a mano. NO se hace en 18.x.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { puedeCancelar } from '@/lib/workflows/transiciones-ejecucion'
import type { EstadoEjecucion } from '@/tipos/workflow'

type ParamsPromise = Promise<{ id: string }>

const MOTIVO_MAX_LEN = 500

export async function POST(request: NextRequest, { params }: { params: ParamsPromise }) {
  const { id } = await params

  const guard = await requerirPermisoAPI('flujos', 'activar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let motivo: string | null = null
  try {
    const body = await request.json().catch(() => ({}))
    if (body && typeof body === 'object' && 'motivo' in body) {
      const m = (body as { motivo?: unknown }).motivo
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
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const admin = crearClienteAdmin()

  // 1) Cargar ejecución (404 si no existe).
  const { data: ejecucion } = await admin
    .from('ejecuciones_flujo')
    .select('id, flujo_id, estado')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!ejecucion) {
    return NextResponse.json({ error: 'Ejecución no encontrada' }, { status: 404 })
  }

  // 2) Validar transición.
  const estadoAnterior = ejecucion.estado as EstadoEjecucion
  const evalC = puedeCancelar(estadoAnterior)
  if (!evalC.ok) {
    return NextResponse.json(
      { error: evalC.mensaje, codigo: evalC.codigo },
      { status: 409 },
    )
  }

  // 3) UPDATE atómico con guarda en WHERE.
  const { data: actualizada, error: errUpd } = await admin
    .from('ejecuciones_flujo')
    .update({
      estado: 'cancelado',
      fin_en: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .in('estado', ['pendiente', 'esperando'])
    .select()
    .maybeSingle()

  if (errUpd) {
    console.error(JSON.stringify({
      nivel: 'error',
      mensaje: 'error_cancelar_ejecucion',
      ejecucion_id: id,
      detalle: errUpd.message,
    }))
    return NextResponse.json({ error: 'Error al cancelar la ejecución' }, { status: 500 })
  }
  if (!actualizada) {
    // Race: alguien cambió el estado entre SELECT y UPDATE.
    // Recargamos y devolvemos el estado actual con 409.
    const { data: actual } = await admin
      .from('ejecuciones_flujo').select('*').eq('id', id).eq('empresa_id', empresaId).maybeSingle()
    return NextResponse.json(
      {
        error: 'La ejecución cambió de estado y ya no es cancelable.',
        codigo: 'estado_cambio',
        ejecucion: actual ?? null,
      },
      { status: 409 },
    )
  }

  // 4) Cancelar acciones pendientes asociadas en la cola diferida.
  //    Solo las que están 'pendiente' (las 'ejecutando' u 'ok' no se
  //    tocan). Esto cierra la trazabilidad: el cron de barrido las
  //    ignora porque filtra estado='pendiente'.
  await admin
    .from('acciones_pendientes')
    .update({ estado: 'cancelada' })
    .eq('ejecucion_id', id)
    .eq('empresa_id', empresaId)
    .eq('estado', 'pendiente')

  // 5) Auditoría sobre el flujo (los rows se indexan por flujo_id).
  await admin.from('auditoria_flujos').insert({
    empresa_id: empresaId,
    flujo_id: ejecucion.flujo_id,
    editado_por: user.id,
    campo_modificado: 'cancelar_ejecucion',
    valor_anterior: estadoAnterior,
    valor_nuevo: 'cancelado',
    motivo,
  })

  return NextResponse.json({ ejecucion: actualizada })
}
