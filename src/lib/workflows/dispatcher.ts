/**
 * Lógica pura del dispatcher de workflows.
 *
 * `matchearFlujos(evento, flujosActivos)` recibe un cambio de estado
 * y la lista de flujos activos de una empresa, y devuelve los flujos
 * que deben dispararse. Es una función totalmente pura: no toca BD,
 * no tiene side effects, y se testea sin mocks.
 *
 * La Edge Function `dispatcher-workflows` (Deno) consume esta función
 * después de cargar los flujos activos vía Supabase. Mantener la
 * lógica de match acá permite testearla con vitest sin tener que
 * arrancar el runtime de Edge Functions.
 *
 * PR 14 — Motor de workflows, fase 2 (dispatcher).
 */

import type { CambioEstado } from '@/tipos/estados'
import {
  type Flujo,
  esDisparadorEntidadEstadoCambio,
} from '@/tipos/workflow'

/**
 * Devuelve los flujos que deben dispararse por un cambio_estado dado.
 *
 * Reglas de match (PR 14 — solo `entidad.estado_cambio`):
 *   1. El flujo está activo.
 *   2. El flujo pertenece a la misma empresa que el evento.
 *   3. El disparador es de tipo `entidad.estado_cambio` y su forma
 *      pasa el type guard.
 *   4. `configuracion.entidad_tipo === evento.entidad_tipo`.
 *   5. `configuracion.hasta_clave === evento.estado_nuevo`.
 *   6. Si `configuracion.desde_clave` está seteado (no null/undefined),
 *      tiene que coincidir con `evento.estado_anterior`. Si no está
 *      seteado, dispara desde cualquier estado anterior.
 *
 * Otros tipos de disparador (`tiempo.cron`, `webhook.entrante`, etc.)
 * los ignoramos en PR 14: se implementan en sus PRs respectivos.
 */
export function matchearFlujos(
  evento: CambioEstado,
  flujosActivos: readonly Flujo[],
): Flujo[] {
  return flujosActivos.filter((flujo) => {
    if (!flujo.activo) return false
    if (flujo.empresa_id !== evento.empresa_id) return false

    if (!esDisparadorEntidadEstadoCambio(flujo.disparador)) return false

    const cfg = flujo.disparador.configuracion
    if (cfg.entidad_tipo !== evento.entidad_tipo) return false
    if (cfg.hasta_clave !== evento.estado_nuevo) return false

    // desde_clave es opcional. Si está seteado, tiene que matchear.
    if (cfg.desde_clave !== undefined && cfg.desde_clave !== null) {
      if (cfg.desde_clave !== evento.estado_anterior) return false
    }

    return true
  })
}
