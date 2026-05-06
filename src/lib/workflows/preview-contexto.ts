/**
 * Builder del "contexto de preview" para el `PickerVariables` del
 * editor (sub-PR 19.3b, decisión §5.2 del PLAN_UI_FLUJOS.md).
 *
 * Cuando el usuario abre el panel lateral de un paso, el picker muestra
 * cada variable con un preview del valor real (ej: `{{presupuesto.total}}`
 * → `$ 12.450,00`). Para resolver esos previews necesitamos un objeto
 * con la misma forma que el contexto que `enriquecerContexto` (PR 16)
 * inyecta en runtime — pero "fingiendo" que estamos disparando el
 * flujo con la última entidad-objetivo del estado correspondiente.
 *
 * Estructura:
 *   1. `decidirEntidadAPrevisar(disparador)` — función PURA que devuelve
 *      qué tabla consultar y con qué filtros, según el `tipo` del
 *      disparador. Retorna null para disparadores sin entidad-natural
 *      (cron, webhook).
 *
 *   2. `armarContextoPreview(flujo, admin)` — wrapper async: consulta
 *      Supabase con la decisión de #1, arma una `EjecucionEnriquecible`
 *      sintética y llama a `enriquecerContexto`. El resultado tiene
 *      shape compatible con el resolver del motor.
 *
 * Si la tabla está vacía (no hay ninguna entidad en el estado-objetivo),
 * devolvemos un contexto SIN `entidad`/`contacto`, solo con `empresa`,
 * `actor: null` y `ahora`. El picker muestra el árbol pero los previews
 * salen vacíos — comportamiento aceptable según caveat del coordinador.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { EntidadConEstado } from '@/tipos/estados'
import { TABLA_PRINCIPAL_POR_ENTIDAD } from '@/lib/estados/mapeo'
import {
  enriquecerContexto,
  type EjecucionEnriquecible,
} from '@/lib/workflows/contexto'
import type {
  ContextoVariables,
} from '@/lib/workflows/resolver-variables'
import type { TipoDisparador } from '@/tipos/workflow'

// =============================================================
// Tipos públicos
// =============================================================

export interface DecisionEntidadPreview {
  /** Tipo de entidad cuya tabla principal vamos a consultar. */
  tipoEntidad: EntidadConEstado
  /** Tabla principal correspondiente (de TABLA_PRINCIPAL_POR_ENTIDAD). */
  tabla: string
  /**
   * Filtros adicionales para acotar la búsqueda al "estado-objetivo"
   * del disparador. `null` significa "última fila ordenada por defecto".
   */
  filtros: { estadoClave?: string } | null
  /** Columna por la que ordenar al hacer LIMIT 1. */
  ordenarPor: 'creado_en' | 'actualizado_en'
}

// =============================================================
// Función pura: decisión de qué entidad cargar
// =============================================================

/**
 * Devuelve la decisión de "qué entidad de qué tabla cargar para el
 * preview", en función del disparador. Si el disparador no tiene
 * entidad asociada (cron, webhook), devuelve null — el contexto del
 * preview va a quedar sin `entidad`/`contacto`, solo con empresa+ahora.
 */
export function decidirEntidadAPrevisar(
  disparador: { tipo?: TipoDisparador; configuracion?: Record<string, unknown> } | null,
): DecisionEntidadPreview | null {
  if (!disparador?.tipo) return null
  const config = (disparador.configuracion ?? {}) as Record<string, unknown>
  const tipoEntidadConfig =
    typeof config.entidad_tipo === 'string'
      ? (config.entidad_tipo as EntidadConEstado)
      : null

  switch (disparador.tipo) {
    case 'entidad.estado_cambio': {
      if (!tipoEntidadConfig) return null
      const tabla = TABLA_PRINCIPAL_POR_ENTIDAD[tipoEntidadConfig]
      if (!tabla) return null
      const hasta = typeof config.hasta_clave === 'string' ? config.hasta_clave : undefined
      return {
        tipoEntidad: tipoEntidadConfig,
        tabla,
        filtros: hasta ? { estadoClave: hasta } : null,
        ordenarPor: 'actualizado_en',
      }
    }
    case 'entidad.creada': {
      if (!tipoEntidadConfig) return null
      const tabla = TABLA_PRINCIPAL_POR_ENTIDAD[tipoEntidadConfig]
      if (!tabla) return null
      return {
        tipoEntidad: tipoEntidadConfig,
        tabla,
        filtros: null,
        ordenarPor: 'creado_en',
      }
    }
    case 'entidad.campo_cambia': {
      if (!tipoEntidadConfig) return null
      const tabla = TABLA_PRINCIPAL_POR_ENTIDAD[tipoEntidadConfig]
      if (!tabla) return null
      return {
        tipoEntidad: tipoEntidadConfig,
        tabla,
        filtros: null,
        ordenarPor: 'actualizado_en',
      }
    }
    case 'actividad.completada': {
      const tabla = TABLA_PRINCIPAL_POR_ENTIDAD['actividad']
      if (!tabla) return null
      return {
        tipoEntidad: 'actividad',
        tabla,
        filtros: { estadoClave: 'completada' },
        ordenarPor: 'actualizado_en',
      }
    }
    case 'tiempo.relativo_a_campo': {
      // Preview informativo: tomamos la última entidad disponible sin
      // filtros (el cálculo "fecha + delta == hoy" es difícil de
      // simular en preview). El usuario ve la idea de qué variables
      // tiene; la ejecución real las acota.
      if (!tipoEntidadConfig) return null
      const tabla = TABLA_PRINCIPAL_POR_ENTIDAD[tipoEntidadConfig]
      if (!tabla) return null
      return {
        tipoEntidad: tipoEntidadConfig,
        tabla,
        filtros: null,
        ordenarPor: 'actualizado_en',
      }
    }
    case 'tiempo.cron':
    case 'webhook.entrante':
    case 'inbox.mensaje_recibido':
    case 'inbox.conversacion_sin_respuesta':
      return null
  }
}

// =============================================================
// Wrapper async: consulta Supabase y enriquece
// =============================================================

interface FlujoMin {
  disparador: unknown
  borrador_jsonb: unknown
  empresa_id: string
}

/**
 * Devuelve el contexto a usar para previews del picker. Lee la versión
 * editable del flujo (borrador interno si existe, sino publicado),
 * decide qué entidad consultar, hace la query con admin, y enriquece.
 *
 * Si la consulta no encuentra nada → devuelve solo `{ empresa, ahora,
 * actor: null }`. El picker maneja la ausencia de entidad/contacto.
 */
export async function armarContextoPreview(
  flujo: FlujoMin,
  admin: SupabaseClient,
): Promise<ContextoVariables> {
  const disparador = leerDisparadorEditable(flujo)
  const decision = decidirEntidadAPrevisar(disparador)

  let contextoInicial: ContextoVariables = {}
  if (decision) {
    const id = await obtenerIdUltimaEntidad(decision, flujo.empresa_id, admin)
    if (id) {
      contextoInicial = {
        entidad: { tipo: decision.tipoEntidad, id },
      }
    }
  }

  const ejecucion: EjecucionEnriquecible = {
    empresa_id: flujo.empresa_id,
    contexto_inicial: contextoInicial,
    disparado_por: null, // No hay actor real en preview.
  }

  return enriquecerContexto(ejecucion, admin)
}

/**
 * Lee el disparador "editable" del flujo: si hay `borrador_jsonb` con
 * disparador, gana ese (el usuario está editando la versión interna);
 * si no, el publicado top-level. Mantiene paridad con
 * `obtenerVersionEditable` del PR 18.
 */
function leerDisparadorEditable(
  flujo: FlujoMin,
): { tipo?: TipoDisparador; configuracion?: Record<string, unknown> } | null {
  const borrador = flujo.borrador_jsonb as Record<string, unknown> | null | undefined
  if (borrador && typeof borrador === 'object') {
    const d = borrador.disparador as
      | { tipo?: TipoDisparador; configuracion?: Record<string, unknown> }
      | undefined
    if (d) return d
  }
  if (flujo.disparador && typeof flujo.disparador === 'object') {
    return flujo.disparador as {
      tipo?: TipoDisparador
      configuracion?: Record<string, unknown>
    }
  }
  return null
}

/**
 * Devuelve el id de la última fila que matchea con `decision`, o null
 * si no hay ninguna. Aislado para que el wrapper de tests pueda
 * mockear este paso si quiere.
 */
async function obtenerIdUltimaEntidad(
  decision: DecisionEntidadPreview,
  empresaId: string,
  admin: SupabaseClient,
): Promise<string | null> {
  let q = admin
    .from(decision.tabla)
    .select('id')
    .eq('empresa_id', empresaId)
    .order(decision.ordenarPor, { ascending: false })
    .limit(1)

  if (decision.filtros?.estadoClave) {
    q = q.eq('estado_clave', decision.filtros.estadoClave)
  }

  const { data, error } = await q.maybeSingle()
  if (error || !data) return null
  return typeof data.id === 'string' ? data.id : null
}
