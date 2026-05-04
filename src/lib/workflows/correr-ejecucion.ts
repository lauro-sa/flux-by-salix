/**
 * Orquestador de ejecuciones de workflow (sub-PR 15.1).
 *
 * `correrEjecucion(ejecucionId, admin)` carga la ejecución y el flujo
 * asociado, recorre las acciones en orden y delega cada una al
 * `executor.ts`. Maneja reintentos con backoff exponencial, registra
 * cada intento append-only en el `log` jsonb, y actualiza el estado
 * de la ejecución (`pendiente` → `corriendo` → `completado` o
 * `fallado`).
 *
 * Reintentos:
 *   Hasta 3 intentos por acción con backoff 1s/5s/15s. Solo se
 *   reintenta cuando el resultado del executor tiene
 *   `error.transitorio: true`. Errores permanentes fallan al primer
 *   intento.
 *
 * Comportamiento al fallar:
 *   - Acción sin `continuar_si_falla` → flujo se detiene, estado
 *     `fallado`. NO se ejecutan las acciones siguientes.
 *   - Acción con `continuar_si_falla: true` → se loggea como fallada
 *     y el flujo continúa con la siguiente.
 *
 * Reanudación incremental (preparación para sub-PR 15.2):
 *   El orquestador lee el `log` para saber por qué paso ir. Si la
 *   ejecución ya estaba `corriendo` (caso de reanudación post-pausa
 *   en 15.2), salta los pasos ya completados. En 15.1 esto siempre
 *   arranca desde paso 1, pero el código está listo.
 *
 * Estructura del entry de log (append-only):
 * {
 *   paso: 1, tipo: 'notificar_usuario',
 *   estado: 'ok' | 'fallado',
 *   inicio_en, fin_en,
 *   intentos: [
 *     { n, ts, duracion_ms, resultado: 'ok' | 'fallo_transitorio' | 'fallo_permanente',
 *       respuesta?: {...}, error?: { mensaje, status?, raw_class? } }
 *   ]
 * }
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  AccionWorkflow,
  EstadoEjecucion,
} from '@/tipos/workflow'
import { esAccionConocida } from '@/tipos/workflow'
import {
  ejecutarAccion,
  MARCADOR_ESPERANDO,
  MARCADOR_TERMINAR,
  type ResultadoAccion,
} from './executor'

// =============================================================
// Constantes de reintentos
// =============================================================
// Backoff entre intentos. Exportado para tests poder mockear con
// valores chicos sin tener que esperar 21s reales.
export const BACKOFF_REINTENTOS_MS: readonly number[] = [1000, 5000, 15000]
export const MAX_INTENTOS = BACKOFF_REINTENTOS_MS.length + 1 // 1 inicial + 3 reintentos = 4

// Permite a los tests inyectar un `setTimeout` instantáneo.
export type SleepFn = (ms: number) => Promise<void>
const sleepReal: SleepFn = (ms) => new Promise((r) => setTimeout(r, ms))

// =============================================================
// Tipos del log
// =============================================================

export interface IntentoLog {
  n: number
  ts: string
  duracion_ms: number
  resultado: 'ok' | 'fallo_transitorio' | 'fallo_permanente'
  respuesta?: Record<string, unknown>
  error?: { mensaje: string; status?: number; raw_class?: string }
}

export interface PasoLog {
  paso: number
  tipo: string
  estado: 'ok' | 'fallado'
  inicio_en: string
  fin_en: string
  intentos: IntentoLog[]
  /** true si la acción tiene continuar_si_falla y por eso el flujo siguió. */
  continuo_pese_a_fallo?: boolean
}

// =============================================================
// Contrato público
// =============================================================

export interface ResultadoCorrida {
  ejecucion_id: string
  estado_final: EstadoEjecucion
  pasos_completados: number
  pasos_fallados: number
}

export interface CorrerEjecucionOpts {
  /** Función para esperar entre reintentos. Inyectable para tests. */
  sleep?: SleepFn
}

// =============================================================
// Implementación
// =============================================================

export async function correrEjecucion(
  ejecucionId: string,
  admin: SupabaseClient,
  opts: CorrerEjecucionOpts = {},
): Promise<ResultadoCorrida> {
  const sleep = opts.sleep ?? sleepReal

  // 1) Cargar ejecución + flujo (acciones en jsonb).
  //    contexto_inicial se incluye porque el evaluador de condiciones
  //    de condicion_branch lee de ahí (sub-PR 15.2).
  const { data: ejecucion, error: errEj } = await admin
    .from('ejecuciones_flujo')
    .select('id, empresa_id, flujo_id, estado, log, inicio_en, contexto_inicial')
    .eq('id', ejecucionId)
    .maybeSingle()

  if (errEj || !ejecucion) {
    throw new Error(
      `correrEjecucion: ejecución ${ejecucionId} no encontrada (${errEj?.message ?? 'no rows'})`,
    )
  }

  // Cortocircuito:
  //   - completado/fallado/cancelado → devolver tal cual.
  //   - corriendo → otro orquestador ya está procesando; no tocamos.
  //   - esperando → permitido reanudar (sub-PR 15.2: el cron despertó
  //                 esta ejecución después de un `esperar` y vino a
  //                 retomarla). No cortocircuitamos.
  //   - pendiente → primera invocación, se procesa.
  if (
    ejecucion.estado === 'completado' ||
    ejecucion.estado === 'fallado' ||
    ejecucion.estado === 'cancelado' ||
    ejecucion.estado === 'corriendo'
  ) {
    const log = (ejecucion.log as PasoLog[] | null) ?? []
    return {
      ejecucion_id: ejecucionId,
      estado_final: ejecucion.estado as EstadoEjecucion,
      pasos_completados: log.filter((p) => p.estado === 'ok').length,
      pasos_fallados: log.filter((p) => p.estado === 'fallado').length,
    }
  }

  const { data: flujo, error: errFl } = await admin
    .from('flujos')
    .select('id, acciones')
    .eq('id', ejecucion.flujo_id)
    .maybeSingle()

  if (errFl || !flujo) {
    throw new Error(
      `correrEjecucion: flujo ${ejecucion.flujo_id} no encontrado (${errFl?.message ?? 'no rows'})`,
    )
  }

  const acciones = Array.isArray(flujo.acciones)
    ? (flujo.acciones as unknown[])
    : []

  // 2) Marcar corriendo + setear inicio_en si aún no estaba (idempotente).
  const ahoraInicio = new Date().toISOString()
  const updateInicial: Record<string, unknown> = { estado: 'corriendo' }
  if (!ejecucion.inicio_en) updateInicial.inicio_en = ahoraInicio

  await admin
    .from('ejecuciones_flujo')
    .update(updateInicial)
    .eq('id', ejecucionId)

  // 3) Determinar paso inicial leyendo el log para reanudar.
  const logExistente: PasoLog[] = Array.isArray(ejecucion.log)
    ? (ejecucion.log as PasoLog[])
    : []
  const pasoInicial = logExistente.length // 0-indexed: si ya hay 2 pasos en log, arrancamos por el 3ro.

  let log: PasoLog[] = [...logExistente]
  let estadoFinal: EstadoEjecucion = 'completado'

  // 4) Recorrer acciones en orden.
  for (let i = pasoInicial; i < acciones.length; i++) {
    const accion = acciones[i]
    const numeroPaso = i + 1

    // Validar shape antes de invocar al executor.
    if (!esAccionConocida(accion)) {
      const inicio = new Date().toISOString()
      log.push({
        paso: numeroPaso,
        tipo: 'desconocido',
        estado: 'fallado',
        inicio_en: inicio,
        fin_en: inicio,
        intentos: [
          {
            n: 1,
            ts: inicio,
            duracion_ms: 0,
            resultado: 'fallo_permanente',
            error: {
              mensaje: 'Acción con shape inválido o tipo desconocido',
              raw_class: 'AccionInvalida',
            },
          },
        ],
      })
      estadoFinal = 'fallado'
      break
    }

    const tipo = accion.tipo
    const continuarSiFalla = accion.continuar_si_falla === true

    const inicioPaso = new Date().toISOString()
    const inicioPasoMs = Date.now()
    const intentos: IntentoLog[] = []

    let exitoso = false
    let resultadoFinal: ResultadoAccion | null = null

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      const tsIntento = new Date().toISOString()
      const tsMs = Date.now()
      const r = await ejecutarAccion(
        accion,
        {
          empresa_id: ejecucion.empresa_id as string,
          ejecucion_id: ejecucionId,
          flujo_id: ejecucion.flujo_id as string,
          contexto_inicial:
            (ejecucion.contexto_inicial as Record<string, unknown> | null) ?? undefined,
        },
        admin,
      )
      const duracion_ms = Date.now() - tsMs
      resultadoFinal = r

      if (r.ok) {
        intentos.push({
          n: intento,
          ts: tsIntento,
          duracion_ms,
          resultado: 'ok',
          respuesta: r.resultado,
        })
        exitoso = true
        break
      }

      // Falló este intento. Decidir si reintentar.
      const transitorio = r.error.transitorio
      intentos.push({
        n: intento,
        ts: tsIntento,
        duracion_ms,
        resultado: transitorio ? 'fallo_transitorio' : 'fallo_permanente',
        error: {
          mensaje: r.error.mensaje,
          status: r.error.status,
          raw_class: r.error.raw_class,
        },
      })

      if (!transitorio) break // permanente: no reintentamos
      if (intento >= MAX_INTENTOS) break // agotamos reintentos

      // Backoff antes del siguiente intento.
      await sleep(BACKOFF_REINTENTOS_MS[intento - 1])
    }

    const finPaso = new Date().toISOString()

    // Detección de marcadores de control de flujo (sub-PR 15.2):
    // si la acción devolvió `esperando: true` o `terminar: true`
    // en su resultado, manejamos esos casos especiales.
    const respuestaOk = exitoso && resultadoFinal?.ok === true
      ? resultadoFinal.resultado
      : null
    const esEsperando = respuestaOk?.[MARCADOR_ESPERANDO] === true
    const esTerminar = respuestaOk?.[MARCADOR_TERMINAR] === true

    log.push({
      paso: numeroPaso,
      tipo,
      estado: exitoso ? 'ok' : 'fallado',
      inicio_en: inicioPaso,
      fin_en: finPaso,
      intentos,
      ...(exitoso ? {} : continuarSiFalla ? { continuo_pese_a_fallo: true } : {}),
    })

    // Persistir log incrementalmente para que el debugging no
    // dependa de que la ejecución termine. Si el process muere a
    // mitad, los pasos ya hechos quedan visibles.
    await admin
      .from('ejecuciones_flujo')
      .update({ log })
      .eq('id', ejecucionId)

    void inicioPasoMs // referenciar para no warn (lo usamos en duracion).

    // 4a) Si la acción fue `esperar`, marcar la ejecución como
    //     'esperando' con `proximo_paso_en` y RETURN. El cron va a
    //     reanudar cuando llegue ejecutar_en (la fila de
    //     acciones_pendientes ya quedó insertada por el executor).
    if (esEsperando && respuestaOk) {
      const proximoPasoEn =
        typeof respuestaOk.ejecutar_en === 'string'
          ? respuestaOk.ejecutar_en
          : null

      await admin
        .from('ejecuciones_flujo')
        .update({
          estado: 'esperando',
          proximo_paso_en: proximoPasoEn,
          log,
        })
        .eq('id', ejecucionId)

      return {
        ejecucion_id: ejecucionId,
        estado_final: 'esperando',
        pasos_completados: log.filter((p) => p.estado === 'ok').length,
        pasos_fallados: log.filter((p) => p.estado === 'fallado').length,
      }
    }

    // 4b) Si la acción fue `terminar_flujo` (o un branch que la
    //     contenía), break del loop con estado completado.
    if (esTerminar) {
      estadoFinal = 'completado'
      break
    }

    if (!exitoso && !continuarSiFalla) {
      estadoFinal = 'fallado'
      break
    }
  }

  // 5) Marcar estado final + fin_en.
  await admin
    .from('ejecuciones_flujo')
    .update({
      estado: estadoFinal,
      fin_en: new Date().toISOString(),
      log,
      // Limpiar proximo_paso_en si veníamos de esperando.
      proximo_paso_en: null,
    })
    .eq('id', ejecucionId)

  return {
    ejecucion_id: ejecucionId,
    estado_final: estadoFinal,
    pasos_completados: log.filter((p) => p.estado === 'ok').length,
    pasos_fallados: log.filter((p) => p.estado === 'fallado').length,
  }
}
