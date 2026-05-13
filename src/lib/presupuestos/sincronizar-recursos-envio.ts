/**
 * STUB temporal — la implementación real está en construcción en otro chat.
 *
 * `sincronizarRecursosEnvio` regenera los recursos asociados al envío
 * de un presupuesto (PDF, PDF congelado, link público del portal)
 * cuando el contenido del presupuesto cambió respecto al último envío.
 *
 * Mientras no se commitee la versión real: devuelve estado `ok` sin
 * regenerar nada. El editor de presupuesto recibe URLs nulas y un
 * mensaje vacío — el botón de envío sigue disponible pero las URLs
 * actuales del presupuesto se mantienen sin cambios.
 */

export type EstadoSincronizacionEnvio = 'ok' | 'sincronizando' | 'desactualizado' | 'error'

export interface ResultadoSincronizacionEnvio {
  estado: EstadoSincronizacionEnvio
  pdfUrl?: string | null
  pdfCongeladoUrl?: string | null
  portalUrl?: string | null
  mensaje?: string | null
}

interface ArgsSincronizarRecursosEnvio {
  presupuestoId: string
  documentoDesactualizado?: boolean
  [k: string]: unknown
}

export async function sincronizarRecursosEnvio(
  _args: ArgsSincronizarRecursosEnvio,
): Promise<ResultadoSincronizacionEnvio> {
  return { estado: 'ok' }
}
