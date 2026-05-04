/**
 * GET /api/cron/disparar-workflows-tiempo (PR 17)
 *
 * Cron de Vercel cada minuto. Escanea flujos activos cuyo disparador
 * empieza con 'tiempo.', evalúa si la ventana actual matchea, y crea
 * ejecuciones_flujo + fire-and-forget al worker para cada match.
 *
 * Patrón de auth (igual al barrer-pendientes):
 *   - Request entrante: CRON_SECRET (Vercel inyecta en cron jobs).
 *   - Saliente al worker: WEBHOOK_SECRET.
 *
 * Disparadores soportados:
 *
 * 1. tiempo.cron — usa flujos.ultima_ejecucion_tiempo para idempotencia.
 *    Si proximaEjecucion(expresion, ultima) <= now(), dispara y
 *    actualiza ultima = now(). Si el cron se atrasa, recupera la
 *    ventana al próximo tick (NO se pierde nada).
 *
 * 2. tiempo.relativo_a_campo — itera entidades cuyo campo_fecha +
 *    delta_dias = hoy (en zona horaria de empresa). Idempotencia por
 *    clave_idempotencia que incluye fecha_clave (YYYY-MM-DD): aunque
 *    el cron tick 60 veces el mismo día, el UNIQUE parcial sobre
 *    (flujo_id, clave_idempotencia) solo deja crear una ejecución
 *    por entidad por día.
 *
 * Comportamiento ante atraso del cron: se documenta en cada caso
 * (ver `disparador-tiempo.ts`). Patrón estándar idempotente.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import {
  esDisparadorTiempoCron,
  esDisparadorTiempoRelativoACampo,
  type DisparadorTiempoCron,
  type DisparadorTiempoRelativoACampo,
} from '@/tipos/workflow'
import {
  proximaEjecucion,
  cargarMatchsRelativoACampo,
} from '@/lib/workflows/disparador-tiempo'

const ZONA_HORARIA_DEFAULT = 'America/Argentina/Buenos_Aires'

interface FlujoTiempo {
  id: string
  empresa_id: string
  activo: boolean
  disparador: unknown
  ultima_ejecucion_tiempo: string | null
}

export async function GET(request: NextRequest) {
  // 1) Auth.
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json(
      { ok: false, error: 'cron_secret_not_configured' },
      { status: 401 },
    )
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  const webhookSecret = process.env.WEBHOOK_SECRET
  if (!webhookSecret) {
    return NextResponse.json(
      { ok: false, error: 'webhook_secret_not_configured' },
      { status: 500 },
    )
  }

  const admin = crearClienteAdmin()
  const ahora = new Date()
  const workerUrl = armarWorkerUrl(request.url)

  // 2) Cargar flujos activos con disparador.tipo LIKE 'tiempo.%'.
  //    El índice parcial flujos_tiempo_activos_idx (sql/055) hace que
  //    este SELECT escale aunque crezcan flujos event-driven.
  const { data: flujos, error: errSel } = await admin
    .from('flujos')
    .select('id, empresa_id, activo, disparador, ultima_ejecucion_tiempo')
    .eq('activo', true)
    .like('disparador->>tipo', 'tiempo.%')

  if (errSel) {
    console.error(
      JSON.stringify({
        nivel: 'error',
        mensaje: 'error_select_flujos_tiempo',
        detalle: errSel.message,
      }),
    )
    return NextResponse.json({ ok: false, error: 'select_failed' }, { status: 500 })
  }

  const filas = (flujos ?? []) as FlujoTiempo[]
  if (filas.length === 0) {
    return NextResponse.json({ ok: true, escaneados: 0, ejecuciones_creadas: 0 })
  }

  // 3) Pre-cargar zonas horarias por empresa (una sola query).
  const empresaIds = Array.from(new Set(filas.map((f) => f.empresa_id)))
  const zonasPorEmpresa = await cargarZonasHorarias(empresaIds, admin)

  // 4) Procesar cada flujo según el tipo de disparador.
  let ejecucionesCreadas = 0
  let yaExistian = 0

  for (const flujo of filas) {
    const zona = zonasPorEmpresa.get(flujo.empresa_id) ?? ZONA_HORARIA_DEFAULT

    if (esDisparadorTiempoCron(flujo.disparador)) {
      const r = await procesarTiempoCron(flujo, flujo.disparador, ahora, admin)
      if (r.creada) {
        ejecucionesCreadas += 1
        // Disparar worker fire-and-forget (await con timeout, igual
        // que el cron de barrer-pendientes — void fetch se aborta en
        // Node Vercel Functions).
        await fireWorker(workerUrl, webhookSecret, r.ejecucionId)
      }
      continue
    }

    if (esDisparadorTiempoRelativoACampo(flujo.disparador)) {
      const r = await procesarTiempoRelativoACampo(
        flujo,
        flujo.disparador,
        zona,
        ahora,
        admin,
      )
      ejecucionesCreadas += r.creadas
      yaExistian += r.yaExistian
      for (const id of r.ejecucionIds) {
        await fireWorker(workerUrl, webhookSecret, id)
      }
      continue
    }
  }

  console.log(
    JSON.stringify({
      nivel: 'info',
      mensaje: 'disparar_workflows_tiempo_corrida',
      escaneados: filas.length,
      ejecuciones_creadas: ejecucionesCreadas,
      ya_existian: yaExistian,
    }),
  )

  return NextResponse.json({
    ok: true,
    escaneados: filas.length,
    ejecuciones_creadas: ejecucionesCreadas,
    ya_existian: yaExistian,
  })
}

// =============================================================
// Procesamiento por tipo
// =============================================================

async function procesarTiempoCron(
  flujo: FlujoTiempo,
  _disparador: DisparadorTiempoCron,
  ahora: Date,
  admin: ReturnType<typeof crearClienteAdmin>,
): Promise<{ creada: false } | { creada: true; ejecucionId: string }> {
  const proxima = proximaEjecucion(
    _disparador.configuracion.expresion,
    flujo.ultima_ejecucion_tiempo,
    ahora,
  )
  if (!proxima) return { creada: false }
  // Si la próxima ejecución es estrictamente después de ahora, todavía
  // no toca. Cuando llegue ese minuto, el cron tick correspondiente
  // verá proxima <= ahora y disparará.
  if (proxima.getTime() > ahora.getTime()) return { creada: false }

  const claveIdempotencia = `flujo:${flujo.id}:tiempo:${proxima.toISOString()}`

  const { data: ej, error: errIns } = await admin
    .from('ejecuciones_flujo')
    .insert({
      empresa_id: flujo.empresa_id,
      flujo_id: flujo.id,
      estado: 'pendiente',
      disparado_por: `cron:${_disparador.configuracion.expresion}`,
      contexto_inicial: {
        trigger: {
          tipo: 'tiempo.cron',
          expresion: _disparador.configuracion.expresion,
          fecha: ahora.toISOString(),
        },
      },
      clave_idempotencia: claveIdempotencia,
    })
    .select('id')
    .maybeSingle()

  if (errIns) {
    if (errIns.code === '23505') {
      // Otro tick disparó la misma ventana. No es error.
      return { creada: false }
    }
    console.error(
      JSON.stringify({
        nivel: 'error',
        mensaje: 'error_insert_ejecucion_tiempo_cron',
        flujo_id: flujo.id,
        detalle: errIns.message,
      }),
    )
    return { creada: false }
  }

  // Actualizar ultima_ejecucion_tiempo para que el próximo tick no
  // dispare otra vez la misma ventana.
  await admin
    .from('flujos')
    .update({ ultima_ejecucion_tiempo: proxima.toISOString() })
    .eq('id', flujo.id)

  return { creada: true, ejecucionId: ej?.id as string }
}

async function procesarTiempoRelativoACampo(
  flujo: FlujoTiempo,
  disparador: DisparadorTiempoRelativoACampo,
  zonaHoraria: string,
  ahora: Date,
  admin: ReturnType<typeof crearClienteAdmin>,
): Promise<{ creadas: number; yaExistian: number; ejecucionIds: string[] }> {
  // Filtro adicional: solo ejecutar si la `hora_local` del config
  // matchea la hora actual en la zona de la empresa. Default '09:00'.
  const horaConfig = disparador.configuracion.hora_local ?? '09:00'
  if (!horaActualMatchea(ahora, zonaHoraria, horaConfig)) {
    return { creadas: 0, yaExistian: 0, ejecucionIds: [] }
  }

  const matchs = await cargarMatchsRelativoACampo(
    { id: flujo.id, empresa_id: flujo.empresa_id, disparador },
    zonaHoraria,
    ahora,
    admin,
  )
  if (matchs.length === 0) {
    return { creadas: 0, yaExistian: 0, ejecucionIds: [] }
  }

  let creadas = 0
  let yaExistian = 0
  const ejecucionIds: string[] = []

  for (const match of matchs) {
    const claveIdempotencia = `flujo:${flujo.id}:entidad:${match.entidad_id}:fecha:${match.fecha_clave}`

    const { data: ej, error: errIns } = await admin
      .from('ejecuciones_flujo')
      .insert({
        empresa_id: flujo.empresa_id,
        flujo_id: flujo.id,
        estado: 'pendiente',
        disparado_por: `cron:tiempo.relativo_a_campo`,
        contexto_inicial: {
          trigger: {
            tipo: 'tiempo.relativo_a_campo',
            entidad_tipo: disparador.configuracion.entidad_tipo,
            campo_fecha: disparador.configuracion.campo_fecha,
            delta_dias: disparador.configuracion.delta_dias,
            fecha: ahora.toISOString(),
          },
          entidad: {
            tipo: disparador.configuracion.entidad_tipo,
            id: match.entidad_id,
          },
        },
        clave_idempotencia: claveIdempotencia,
      })
      .select('id')
      .maybeSingle()

    if (errIns) {
      if (errIns.code === '23505') {
        yaExistian += 1
        continue
      }
      console.error(
        JSON.stringify({
          nivel: 'error',
          mensaje: 'error_insert_ejecucion_relativo_a_campo',
          flujo_id: flujo.id,
          entidad_id: match.entidad_id,
          detalle: errIns.message,
        }),
      )
      continue
    }
    creadas += 1
    if (ej?.id) ejecucionIds.push(ej.id as string)
  }

  return { creadas, yaExistian, ejecucionIds }
}

// =============================================================
// Helpers
// =============================================================

async function cargarZonasHorarias(
  empresaIds: string[],
  admin: ReturnType<typeof crearClienteAdmin>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (empresaIds.length === 0) return map
  const { data } = await admin
    .from('empresas')
    .select('id, zona_horaria')
    .in('id', empresaIds)
  for (const row of data ?? []) {
    const r = row as { id: string; zona_horaria: string | null }
    map.set(r.id, r.zona_horaria ?? ZONA_HORARIA_DEFAULT)
  }
  return map
}

/**
 * ¿La hora actual (en zona) matchea exactamente la hora_local de
 * config? Comparamos HH:MM. El cron corre cada minuto, así que esto
 * filtra a 1 tick por día por flujo.
 */
function horaActualMatchea(ahora: Date, zona: string, horaConfig: string): boolean {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: zona,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const horaActual = fmt.format(ahora) // "HH:MM"
  return horaActual === horaConfig
}

async function fireWorker(
  workerUrl: string,
  webhookSecret: string,
  ejecucionId: string,
): Promise<void> {
  const ctrl = new AbortController()
  const timeoutId = setTimeout(() => ctrl.abort(), 10_000)
  try {
    await fetch(workerUrl, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${webhookSecret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ejecucion_id: ejecucionId }),
      signal: ctrl.signal,
    })
  } catch (e) {
    const nombre = e instanceof Error ? e.name : 'unknown'
    console.error(
      JSON.stringify({
        nivel: nombre === 'AbortError' ? 'warn' : 'error',
        mensaje: 'fetch_worker_incompleto',
        ejecucion_id: ejecucionId,
        detalle: e instanceof Error ? e.message : String(e),
      }),
    )
  } finally {
    clearTimeout(timeoutId)
  }
}

function armarWorkerUrl(requestUrl: string): string {
  const u = new URL(requestUrl)
  return `${u.origin}/api/workflows/correr-ejecucion`
}
