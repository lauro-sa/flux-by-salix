/**
 * Orquestador de dry-run del motor de workflows (sub-PR 19.5).
 *
 * Función paralela a `correrEjecucion` (PR 15.1/15.2) que ejecuta un
 * flujo en modo prueba para la consola del editor visual. Diferencias
 * clave con el orquestador de producción:
 *
 *   1. NO lee ni escribe en `ejecuciones_flujo`. Trabaja con un contexto
 *      sintético en memoria — no requiere fila pre-creada en BD.
 *   2. NO escribe en `acciones_pendientes` (esperar avanza synchronous).
 *   3. NO hace reintentos con backoff (el dry-run es informativo; un
 *      timeout transitorio se reporta tal cual sin consumir 21s reales).
 *   4. Pasa `dry_run: true` al `ContextoEjecucion` que recibe el
 *      executor — los handlers con side-effect cortocircuitan a
 *      resultados simulados (verificado por tests del executor).
 *
 * Por qué función paralela y NO refactor del orquestador real:
 *   El motor de producción ya está validado E2E (PR 13-17 + bell de
 *   Lauro en Vercel Preview). Tocar `correrEjecucion` para extraer un
 *   helper compartido pone en riesgo ese motor por una optimización de
 *   ~30 líneas duplicadas. La duplicación es chica, los tests del
 *   motor quedan IDÉNTICOS (ningún cambio en `correr-ejecucion.ts`),
 *   y la cobertura del dry-run vive en sus propios tests.
 *
 *   Criterio de aborto del coordinador (R1): "abortar refactor = test
 *   executor existente fallando". Aplicado de forma preventiva — no
 *   refactorizo nada del orquestador real.
 *
 * Estructura del log devuelto: paralela a `PasoLog` del orquestador
 * real (mismas columnas) pero con dos extras:
 *   - `simulado: true` siempre.
 *   - `respuesta` con el payload simulado (lo que devolvió el executor).
 *   - `no_implementada?: true` si el tipo de acción aún no tiene
 *     handler en el motor (el dry-run lo simula igual y la UI muestra
 *     un banner ámbar — caveat D3 del scope plan).
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
  type ContextoEjecucion,
} from './executor'
import {
  resolverEnObjeto,
  VariableFaltanteError,
  HelperTipoInvalidoError,
  HelperDesconocidoError,
  type ContextoVariables,
} from './resolver-variables'

// =============================================================
// Tipos del log dry-run (paralelo a PasoLog del orquestador real)
// =============================================================

export interface PasoLogDryRun {
  paso: number
  tipo: string
  estado: 'ok' | 'fallado'
  inicio_en: string
  fin_en: string
  duracion_ms: number
  /** Payload simulado (el resultado.simulado del executor cuando ok). */
  respuesta?: Record<string, unknown>
  error?: { mensaje: string; status?: number; raw_class?: string }
  /** true si el tipo de acción no tiene handler real en el motor todavía. */
  no_implementada?: boolean
  /** true si el paso falló pero la acción tiene `continuar_si_falla`. */
  continuo_pese_a_fallo?: boolean
}

export interface ResumenDryRun {
  completados: number
  fallados: number
  simulados: number
  no_implementados: number
  /** El flujo terminó por terminar_flujo antes de procesar todos los pasos. */
  terminado_temprano: boolean
}

export interface ResultadoDryRun {
  log: PasoLogDryRun[]
  estado_final: EstadoEjecucion
  duracion_total_ms: number
  resumen: ResumenDryRun
}

export interface CorrerDryRunOpts {
  empresaId: string
  /** Lista de acciones a simular (orden raíz). Pueden contener branches. */
  acciones: unknown[]
  /** Contexto de variables enriquecido (PR 16). Se usa para resolver `{{vars}}`. */
  contextoVars: ContextoVariables
}

// =============================================================
// Implementación
// =============================================================

const DURACION_DRY_RUN_FAKE_MS_BASE = 50 // duración mínima del log para la animación visual

export async function correrEjecucionDryRun(
  opts: CorrerDryRunOpts,
  admin: SupabaseClient,
): Promise<ResultadoDryRun> {
  const inicioMs = Date.now()
  const log: PasoLogDryRun[] = []
  let estadoFinal: EstadoEjecucion = 'completado'
  let terminadoTemprano = false

  // ContextoEjecucion sintético: no hay fila en `ejecuciones_flujo`,
  // pero los handlers solo usan empresa_id + dry_run + contexto_inicial.
  const contextoEjecucion: ContextoEjecucion = {
    empresa_id: opts.empresaId,
    ejecucion_id: 'dry-run-sandbox',
    flujo_id: 'dry-run-sandbox',
    contexto_inicial: opts.contextoVars,
    dry_run: true,
  }

  for (let i = 0; i < opts.acciones.length; i++) {
    const accion = opts.acciones[i]
    const numeroPaso = i + 1
    const inicioPaso = new Date().toISOString()
    const inicioPasoMs = Date.now()

    // Validación de shape: idéntica a la del orquestador real. Si el
    // shape es inválido, log de error y break del loop.
    if (!esAccionConocida(accion)) {
      const fin = new Date().toISOString()
      log.push({
        paso: numeroPaso,
        tipo: 'desconocido',
        estado: 'fallado',
        inicio_en: inicioPaso,
        fin_en: fin,
        duracion_ms: 0,
        error: {
          mensaje: 'Acción con shape inválido o tipo desconocido',
          raw_class: 'AccionInvalida',
        },
      })
      estadoFinal = 'fallado'
      break
    }

    const tipo = accion.tipo
    const continuarSiFalla = accion.continuar_si_falla === true

    // Resolver variables `{{vars}}` contra el contexto. Los errores del
    // resolver se loguean igual que en producción — son el feedback
    // valioso del dry-run ("falta esta variable").
    let accionResuelta: typeof accion
    try {
      accionResuelta = resolverEnObjeto(accion, opts.contextoVars) as typeof accion
    } catch (e) {
      const fin = new Date().toISOString()
      log.push({
        paso: numeroPaso,
        tipo,
        estado: 'fallado',
        inicio_en: inicioPaso,
        fin_en: fin,
        duracion_ms: Date.now() - inicioPasoMs,
        error: clasificarErrorResolver(e),
      })
      if (!continuarSiFalla) {
        estadoFinal = 'fallado'
        break
      }
      log[log.length - 1].continuo_pese_a_fallo = true
      continue
    }

    const r = await ejecutarAccion(accionResuelta, contextoEjecucion, admin)
    const fin = new Date().toISOString()
    const duracion_ms = Math.max(Date.now() - inicioPasoMs, 0)

    if (r.ok) {
      const respuesta = r.resultado
      // Defensa en profundidad: el executor con dry_run NO debería devolver
      // MARCADOR_ESPERANDO (lo verifican los tests). Si ocurre, lo
      // ignoramos y avanzamos — el dry-run nunca espera.
      const noImplementada = respuesta.no_implementada === true
      log.push({
        paso: numeroPaso,
        tipo,
        estado: 'ok',
        inicio_en: inicioPaso,
        fin_en: fin,
        duracion_ms,
        respuesta,
        ...(noImplementada ? { no_implementada: true } : {}),
      })
      // Marcador terminar_flujo: corte limpio del loop.
      if (respuesta[MARCADOR_TERMINAR] === true) {
        terminadoTemprano = true
        break
      }
      // Por seguridad, ignoramos explícitamente el marcador esperando
      // si llegase a aparecer (no debería en dry-run).
      void MARCADOR_ESPERANDO
    } else {
      log.push({
        paso: numeroPaso,
        tipo,
        estado: 'fallado',
        inicio_en: inicioPaso,
        fin_en: fin,
        duracion_ms,
        error: {
          mensaje: r.error.mensaje,
          status: r.error.status,
          raw_class: r.error.raw_class,
        },
        ...(continuarSiFalla ? { continuo_pese_a_fallo: true } : {}),
      })
      if (!continuarSiFalla) {
        estadoFinal = 'fallado'
        break
      }
    }
  }

  const duracion_total_ms = Math.max(Date.now() - inicioMs, DURACION_DRY_RUN_FAKE_MS_BASE)

  const resumen: ResumenDryRun = {
    completados: log.filter((p) => p.estado === 'ok').length,
    fallados: log.filter((p) => p.estado === 'fallado').length,
    simulados: log.filter(
      (p) => p.estado === 'ok' && (p.respuesta?.simulado === true),
    ).length,
    no_implementados: log.filter((p) => p.no_implementada === true).length,
    terminado_temprano: terminadoTemprano,
  }

  return { log, estado_final: estadoFinal, duracion_total_ms, resumen }
}

/**
 * Convierte excepciones del resolver de variables (PR 16) en el shape
 * de error del log dry-run. Idéntico al criterio del orquestador real.
 */
function clasificarErrorResolver(
  e: unknown,
): { mensaje: string; status?: number; raw_class: string } {
  if (e instanceof VariableFaltanteError) {
    return { mensaje: e.message, raw_class: 'VariableFaltante' }
  }
  if (e instanceof HelperTipoInvalidoError) {
    return { mensaje: e.message, raw_class: 'HelperTipoInvalido' }
  }
  if (e instanceof HelperDesconocidoError) {
    return { mensaje: e.message, raw_class: 'HelperDesconocido' }
  }
  const mensaje = e instanceof Error ? e.message : String(e)
  return { mensaje: `Error en resolver de variables: ${mensaje}`, raw_class: 'ResolverError' }
}
