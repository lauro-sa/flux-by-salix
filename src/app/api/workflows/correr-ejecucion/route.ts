/**
 * POST /api/workflows/correr-ejecucion (sub-PR 15.1)
 *
 * Endpoint interno invocado por el dispatcher (Edge Function de
 * Supabase) inmediatamente después de crear cada ejecución. El
 * dispatcher hace fire-and-forget con `EdgeRuntime.waitUntil(fetch())`
 * para no bloquear la respuesta del webhook de Supabase.
 *
 * Auth: `Authorization: Bearer <WEBHOOK_SECRET>`. Es el mismo secret
 * que valida el dispatcher para webhooks entrantes — ahora se usa
 * también para que el endpoint Next acepte solo requests del
 * dispatcher (que tiene el secret en su environment). Ver doc en el
 * header de supabase/functions/dispatcher-workflows/index.ts sobre por
 * qué WEBHOOK_SECRET y no SUPABASE_SERVICE_ROLE_KEY.
 *
 * Body: { ejecucion_id: string }.
 *
 * Respuestas:
 *   200 — la ejecución terminó (estado_final puede ser 'completado',
 *         'fallado', 'cancelado'). El detalle del fallo está en el
 *         log jsonb de la ejecución, no en el HTTP status.
 *   400 — body inválido.
 *   401 — auth incorrecta.
 *   500 — fallo de infraestructura al cargar/correr la ejecución
 *         (la BD no responde, la ejecución no existe, etc.). En este
 *         caso el dispatcher NO reintenta automáticamente — habría
 *         que llamarlo de nuevo manualmente.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { correrEjecucion } from '@/lib/workflows/correr-ejecucion'

export async function POST(request: NextRequest) {
  // 1) Auth: Bearer WEBHOOK_SECRET.
  const expected = process.env.WEBHOOK_SECRET
  if (!expected) {
    console.error(
      JSON.stringify({
        nivel: 'critical',
        mensaje: 'WEBHOOK_SECRET no configurado en Vercel env',
      }),
    )
    return NextResponse.json(
      { ok: false, error: 'secret_not_configured' },
      { status: 401 },
    )
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 },
    )
  }

  // 2) Parse body.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, error: 'invalid_json' },
      { status: 400 },
    )
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json(
      { ok: false, error: 'invalid_body' },
      { status: 400 },
    )
  }
  const ejecucionId = (body as { ejecucion_id?: unknown }).ejecucion_id
  if (typeof ejecucionId !== 'string' || ejecucionId.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'missing_ejecucion_id' },
      { status: 400 },
    )
  }

  // 3) Correr.
  try {
    const admin = crearClienteAdmin()
    const r = await correrEjecucion(ejecucionId, admin)
    console.log(
      JSON.stringify({
        nivel: 'info',
        mensaje: 'ejecucion_corrida',
        ejecucion_id: ejecucionId,
        estado_final: r.estado_final,
        pasos_completados: r.pasos_completados,
        pasos_fallados: r.pasos_fallados,
      }),
    )
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : String(e)
    console.error(
      JSON.stringify({
        nivel: 'error',
        mensaje: 'ejecucion_falló_infra',
        ejecucion_id: ejecucionId,
        detalle: mensaje,
      }),
    )
    return NextResponse.json(
      { ok: false, error: 'execution_infra_error', detalle: mensaje },
      { status: 500 },
    )
  }
}
