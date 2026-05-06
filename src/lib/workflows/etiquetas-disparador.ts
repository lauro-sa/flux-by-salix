/**
 * Etiquetas legibles para tipos de disparador de flujos.
 *
 * Mapeo único `TipoDisparador → string` que consume la UI (listado,
 * editor, sandbox, historial). La fuente real de los strings vive en
 * `lib/i18n/{es,en,pt}.ts → flujos.disparador.*` para cumplir la regla
 * de cero hardcodeo i18n desde el inicio (memoria:
 * `feedback_documentacion.md`). Este helper solo es el adaptador entre
 * el backend (que devuelve `disparador.tipo` raw) y la traducción.
 *
 * Uso:
 *   const { t } = useTraduccion()
 *   etiquetaDisparador(t, 'entidad.estado_cambio') // → "Cambio de estado"
 *   descripcionDisparador(t, 'tiempo.cron')        // → "En horarios definidos por…"
 *
 * Reusable a futuro (PR 19.2 editor, 19.5 sandbox, 19.6 historial).
 */

import type { TipoDisparador } from '@/tipos/workflow'

/**
 * Firma de la función `t` que devuelve `useTraduccion`. La declaramos
 * inline para no acoplar este helper al hook (es server-safe).
 */
type TFn = (clave: string) => string

/**
 * Devuelve la etiqueta corta de un disparador (ej: "Cambio de estado").
 * Si el tipo no es reconocido, devuelve el raw para evitar `undefined`
 * en la UI — sirve también para detectar disparadores nuevos del
 * backend que aún no tienen traducción.
 */
export function etiquetaDisparador(t: TFn, tipo: TipoDisparador | string | null | undefined): string {
  if (!tipo) return t('flujos.disparador.sin_disparador')
  const clave = `flujos.disparador.${tipo}`
  const traducido = t(clave)
  // useTraduccion devuelve la clave si no existe — fallback al raw.
  return traducido === clave ? tipo : traducido
}

/**
 * Devuelve la descripción larga del disparador (1 línea de microcopy).
 * Pensada para tooltips, descripciones de filtros y panel del editor.
 */
export function descripcionDisparador(t: TFn, tipo: TipoDisparador | string | null | undefined): string {
  if (!tipo) return ''
  const clave = `flujos.disparador_descripcion.${tipo}`
  const traducido = t(clave)
  return traducido === clave ? '' : traducido
}

/**
 * Devuelve el nombre a mostrar para el disparador. Si el flujo tiene un
 * `etiqueta?: string` propio en su disparador, ese gana; si no, fallback
 * a `etiquetaDisparador`. Helper único para que header del panel y card
 * del canvas siempre coincidan (caveat del coordinador en sub-PR 19.3b).
 */
export function nombreMostrableDisparador(
  t: TFn,
  disparador: { etiqueta?: string | null; tipo?: string | null } | null | undefined,
): string {
  const etiqueta = disparador?.etiqueta?.trim()
  if (etiqueta && etiqueta.length > 0) return etiqueta
  return etiquetaDisparador(t, disparador?.tipo ?? null)
}
