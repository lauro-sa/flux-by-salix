/**
 * STUB temporal — la implementación real está en construcción en otro chat.
 *
 * Resuelve qué plantilla Meta de WhatsApp usar para los avisos del
 * recorrido (en camino / llegada) según la configuración de la empresa.
 *
 * Mientras no se commitee la versión real:
 *  - `resolverPlantillaAviso` devuelve `null` → los endpoints reportan
 *    plantilla FALTANTE y NO envían el WhatsApp (comportamiento seguro:
 *    nada se manda hasta que la versión real esté lista).
 *  - `nombreApiDefault` devuelve un nombre canónico fijo.
 */

export type TipoAviso = 'llegada' | 'en_camino'

/** Forma esperada de la plantilla resuelta (subset de la tabla plantillas_wa). */
export interface PlantillaAvisoBase {
  id?: string
  canal_id?: string | null
  idioma?: string | null
  estado_meta?: string | null
  componentes?: unknown
  [k: string]: unknown
}

export interface PlantillaAvisoResuelta {
  plantilla: PlantillaAvisoBase | null
  nombreApi: string
}

export async function resolverPlantillaAviso(
  _admin: unknown,
  _empresaId: string,
  _tipo: TipoAviso,
): Promise<PlantillaAvisoResuelta | null> {
  return null
}

export function nombreApiDefault(tipo: TipoAviso): string {
  return tipo === 'llegada' ? 'aviso_llegada_default' : 'aviso_en_camino_default'
}
