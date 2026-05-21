/**
 * Resumen breve (1 línea) del estado configurado de un disparador,
 * usado como 3ra línea de TarjetaDisparador para que el usuario vea
 * "qué hay configurado" sin abrir el panel.
 *
 * El shape de cada disparador es discriminado por `tipo`. Para los
 * que requieren resolver IDs a nombres (ej: `canal_ids` →
 * "Info HE, Recursos Humanos"), el caller pasa el mapa de opciones
 * cargado vía useAutocompleteRemoto. Si todavía no llegó la respuesta
 * (`opciones` vacío) devolvemos null y la tarjeta omite la línea
 * (evita mostrar IDs crudos durante el primer render).
 */

import type { DisparadorWorkflow } from '@/tipos/workflow'

type TFn = (clave: string) => string

interface OpcionConNombre {
  id: string
  nombre: string
}

interface OpcionesResumen {
  /** Canales de correo cargados (`/api/correo/canales`). */
  canalesCorreo?: OpcionConNombre[]
}

/**
 * Devuelve un string breve para resumir el estado configurado del
 * disparador, o null si no hay nada útil que mostrar todavía.
 *
 * Por ahora solo `inbox.correo_recibido` tiene resumen real porque es
 * el único disparador funcional del módulo de inbox (los otros 2
 * están "próximamente"). Los demás tipos retornan null hasta que se
 * agreguen acá — la tarjeta sigue mostrando título + descripción.
 */
export function resumirDisparador(
  t: TFn,
  disparador: { tipo?: string; configuracion?: Record<string, unknown> } | null | undefined,
  opciones: OpcionesResumen = {},
): string | null {
  if (!disparador?.tipo) return null

  switch (disparador.tipo) {
    case 'inbox.correo_recibido': {
      const ids = leerIdsCanal(disparador.configuracion)
      if (ids.length === 0) {
        return t('flujos.editor.disparador.resumen.todas_cuentas')
      }
      const canales = opciones.canalesCorreo ?? []
      if (canales.length === 0) return null // todavía cargando
      const nombres = ids
        .map((id) => canales.find((c) => c.id === id)?.nombre)
        .filter((n): n is string => Boolean(n))
      if (nombres.length === 0) return null
      return nombres.join(', ')
    }
    default:
      return null
  }
}

/** Acceso defensivo a `configuracion.canal_ids` sin asumir el shape. */
function leerIdsCanal(cfg: unknown): string[] {
  if (!cfg || typeof cfg !== 'object') return []
  const raw = (cfg as { canal_ids?: unknown }).canal_ids
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string')
}

/**
 * Wrapper conveniente cuando el caller tiene el tipado fuerte de
 * `DisparadorWorkflow`. Solo reusa `resumirDisparador` debajo.
 */
export function resumirDisparadorTipado(
  t: TFn,
  disparador: DisparadorWorkflow | null | undefined,
  opciones: OpcionesResumen = {},
): string | null {
  return resumirDisparador(t, disparador as { tipo?: string; configuracion?: Record<string, unknown> } | null, opciones)
}
