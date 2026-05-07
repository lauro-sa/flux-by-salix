/**
 * GET /api/cron/barrer-workflows-pendientes (sub-PR 15.2)
 *
 * Cron de Vercel que barre la cola `acciones_pendientes` y dispara
 * fire-and-forget al worker `/api/workflows/correr-ejecucion` para
 * cada ejecución cuyo `esperar` ya venció. NO ejecuta el orquestador
 * in-line para evitar quedar atado al timeout de 60s de Vercel
 * cuando hay muchos pendientes en la misma corrida.
 *
 * Patrón de auth (siguiendo convención del resto de crons del proyecto):
 *   - Request entrante: header `Authorization: Bearer <CRON_SECRET>`
 *     que Vercel inyecta automáticamente en cron jobs.
 *   - Request saliente al worker: header `Authorization: Bearer
 *     <WEBHOOK_SECRET>` (mismo secret que dispatcher → worker).
 *
 * Lógica:
 *   1. SELECT acciones_pendientes WHERE ejecutar_en <= now() AND
 *      estado = 'pendiente' LIMIT 50.
 *   2. Para cada fila, UPDATE optimista a 'ejecutando' con WHERE
 *      estado='pendiente' RETURNING id. Si el UPDATE retorna 0 filas
 *      (otro cron la tomó), saltear silenciosamente.
 *   3. UPDATE a 'ok' inmediato. El rol de la fila es solo "diferir
 *      hasta este momento" — el éxito o fallo del flujo real queda
 *      en ejecuciones_flujo.log, no en acciones_pendientes.
 *   4. fire-and-forget fetch al worker con el ejecucion_id. Cada
 *      Vercel Function corre con su propio timeout de 60s,
 *      desacoplado del cron.
 *
 * Cadencia: cada 1 minuto (configurado en vercel.json).
 */

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'

const LIMITE_POR_CORRIDA = 50

interface FilaPendiente {
  id: string
  ejecucion_id: string
  empresa_id: string
}

export async function GET(request: NextRequest) {
  // 1) Auth del request entrante: CRON_SECRET (mismo que el resto
  //    de crons del proyecto). Vercel lo inyecta en headers de
  //    cron jobs.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error(
      JSON.stringify({
        nivel: 'critical',
        mensaje: 'CRON_SECRET no configurado en Vercel env',
      }),
    )
    return NextResponse.json(
      { ok: false, error: 'cron_secret_not_configured' },
      { status: 401 },
    )
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 },
    )
  }

  // 2) WEBHOOK_SECRET para el fire-and-forget saliente al worker.
  const webhookSecret = process.env.WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error(
      JSON.stringify({
        nivel: 'critical',
        mensaje: 'WEBHOOK_SECRET no configurado, no puedo invocar el worker',
      }),
    )
    return NextResponse.json(
      { ok: false, error: 'webhook_secret_not_configured' },
      { status: 500 },
    )
  }

  // 3) Cargar pendientes vencidos.
  const admin = crearClienteAdmin()
  const { data: pendientes, error: errSel } = await admin
    .from('acciones_pendientes')
    .select('id, ejecucion_id, empresa_id')
    .eq('estado', 'pendiente')
    .lte('ejecutar_en', new Date().toISOString())
    .order('ejecutar_en', { ascending: true })
    .limit(LIMITE_POR_CORRIDA)

  if (errSel) {
    console.error(
      JSON.stringify({
        nivel: 'error',
        mensaje: 'error_select_pendientes',
        detalle: errSel.message,
      }),
    )
    return NextResponse.json(
      { ok: false, error: 'select_failed' },
      { status: 500 },
    )
  }

  const filas = (pendientes ?? []) as FilaPendiente[]
  if (filas.length === 0) {
    return NextResponse.json({
      ok: true,
      barrido: 0,
      disparados: 0,
      lock_perdido: 0,
    })
  }

  // 4) Procesar cada fila: lock optimista + marca ok + fire-and-forget.
  const ejecucionesDisparadas = new Set<string>()
  let disparados = 0
  let lockPerdido = 0
  const workerUrl = armarWorkerUrl(request.url)

  for (const fila of filas) {
    // Lock optimista: solo procesa quien gane el UPDATE.
    const { data: lockResult, error: errLock } = await admin
      .from('acciones_pendientes')
      .update({ estado: 'ejecutando', intentos: 1 })
      .eq('id', fila.id)
      .eq('estado', 'pendiente')
      .select('id')
      .maybeSingle()

    if (errLock) {
      console.error(
        JSON.stringify({
          nivel: 'error',
          mensaje: 'error_lock_pendiente',
          accion_pendiente_id: fila.id,
          detalle: errLock.message,
        }),
      )
      continue
    }

    if (!lockResult) {
      // Otro cron la tomó entre el SELECT y el UPDATE. No es error.
      lockPerdido += 1
      continue
    }

    // Marcar ok inmediato. La fila ya cumplió su propósito (retener
    // la ejecución hasta `ejecutar_en`).
    await admin
      .from('acciones_pendientes')
      .update({ estado: 'ok' })
      .eq('id', fila.id)

    // Deduplicar: si dos acciones_pendientes apuntan a la misma
    // ejecución (caso edge: 2 esperar consecutivos sin acción
    // intermedia), disparamos una sola vez.
    if (ejecucionesDisparadas.has(fila.ejecucion_id)) continue
    ejecucionesDisparadas.add(fila.ejecucion_id)

    // Invocar worker con AWAIT y timeout corto.
    //
    // Por qué NO usamos `void fetch` (probado y descartado en E2E
    // del sub-PR 15.2): en Vercel Node Functions, los fetches
    // disparados sin await se abortan cuando la function retorna —
    // a diferencia del Edge Runtime que sí tiene EdgeRuntime.waitUntil.
    // El cron entonces marcaría 'disparados' pero el worker nunca
    // recibiría el request, y la ejecución quedaría colgada en
    // 'esperando' indefinidamente.
    //
    // Solución: AWAIT con timeout. El cron espera hasta que el
    // request HTTP llega al worker (típicamente <1s). Si el worker
    // tarda >10s en responder, el cron aborta el cliente fetch pero
    // el worker ya recibió el request y sigue procesando en su
    // propia Vercel Function (no se cancela del lado server).
    //
    // Performance: para flujos típicos cada fetch dura ~1-3s. Con 50
    // pendientes secuenciales el cron tarda <60s (timeout default).
    // Si crece, paralelizar con Promise.allSettled.
    const ctrl = new AbortController()
    const timeoutId = setTimeout(() => ctrl.abort(), 10_000)
    try {
      await fetch(workerUrl, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${webhookSecret}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ ejecucion_id: fila.ejecucion_id }),
        signal: ctrl.signal,
      })
    } catch (e) {
      // AbortError: el worker está tardando >10s pero ya recibió el
      // request. La ejecución sigue su curso del lado del worker.
      // Otros errores: red, DNS, etc. — log y seguir.
      const nombre = e instanceof Error ? e.name : 'unknown'
      const mensaje = e instanceof Error ? e.message : String(e)
      console.error(
        JSON.stringify({
          nivel: nombre === 'AbortError' ? 'warn' : 'error',
          mensaje: 'fetch_worker_incompleto',
          ejecucion_id: fila.ejecucion_id,
          tipo: nombre,
          detalle: mensaje,
        }),
      )
    } finally {
      clearTimeout(timeoutId)
    }

    disparados += 1
  }

  console.log(
    JSON.stringify({
      nivel: 'info',
      mensaje: 'barrer_pendientes_corrida',
      barrido: filas.length,
      disparados,
      lock_perdido: lockPerdido,
    }),
  )

  return NextResponse.json({
    ok: true,
    barrido: filas.length,
    disparados,
    lock_perdido: lockPerdido,
  })
}

/**
 * Construye URL del worker basándose en el host del request, así
 * en Preview apunta al Preview y en Production a Production sin env
 * var adicional. Ej:
 *   request.url = https://flux.salixweb.com/api/cron/barrer-workflows-pendientes
 *   → worker = https://flux.salixweb.com/api/workflows/correr-ejecucion
 */
function armarWorkerUrl(requestUrl: string): string {
  const u = new URL(requestUrl)
  return `${u.origin}/api/workflows/correr-ejecucion`
}
