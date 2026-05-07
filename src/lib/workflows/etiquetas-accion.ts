/**
 * Etiquetas legibles para tipos de acción de flujos (sub-PR 19.3b).
 *
 * Paralelo a `etiquetas-disparador.ts` — ambos helpers son el único punto
 * que mapea el `tipo` raw a un texto legible. Los strings viven en el
 * paquete i18n bajo `flujos.paso.<tipo>.titulo` (esquema definido en
 * `categorias-pasos.ts → claveI18nTituloPaso`).
 *
 * Uso:
 *   const { t } = useTraduccion()
 *   etiquetaAccion(t, 'enviar_whatsapp_plantilla') // → "Enviar WhatsApp"
 *
 * Lo introducimos ahora porque el panel lateral del editor empieza a
 * editar pasos cuyo nombre (campo `etiqueta?: string`) es opcional. El
 * fallback cuando `etiqueta` está vacío es justamente este helper —
 * NUNCA mostrar el `tipo` crudo (caveat del coordinador).
 */

import type { TipoAccion } from '@/tipos/workflow'
import { claveI18nTituloPaso } from '@/lib/workflows/categorias-pasos'

type TFn = (clave: string) => string

/**
 * Devuelve la etiqueta legible de una acción (ej: "Enviar WhatsApp").
 * Si el tipo no se conoce, devuelve un texto neutral (no el raw del tipo
 * — eso filtraría detalles técnicos a usuarios finales).
 */
export function etiquetaAccion(
  t: TFn,
  tipo: TipoAccion | string | null | undefined,
): string {
  if (!tipo) return t('flujos.accion.sin_tipo')
  const clave = claveI18nTituloPaso(tipo as TipoAccion)
  const traducido = t(clave)
  // useTraduccion devuelve la clave si no existe — el fallback acá usa
  // un texto neutral en lugar del raw, para que un tipo nuevo del
  // backend nunca llegue a usuarios sin estar traducido (a diferencia
  // de etiquetaDisparador, que sí muestra el raw — ese caso es más
  // tolerable porque los disparadores son menos visibles a usuarios
  // finales que las acciones, que aparecen en cada card).
  return traducido === clave ? t('flujos.accion.sin_tipo') : traducido
}

/**
 * Devuelve el nombre a mostrar para un paso (acción). Si el paso tiene
 * un `etiqueta?: string` propio, ese gana; si no, fallback a la
 * etiqueta legible del tipo. Helper único para que el header del panel
 * y el card del canvas siempre coincidan (caveat del coordinador).
 */
export function nombreMostrablePaso(
  t: TFn,
  paso: { etiqueta?: string | null; tipo?: string | null } | null | undefined,
): string {
  const etiqueta = paso?.etiqueta?.trim()
  if (etiqueta && etiqueta.length > 0) return etiqueta
  return etiquetaAccion(t, paso?.tipo ?? null)
}
