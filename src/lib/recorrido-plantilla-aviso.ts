/**
 * Resuelve qué plantilla Meta de WhatsApp usar para los avisos del
 * recorrido (en camino / llegada) en función de la configuración de la
 * empresa.
 *
 * Estrategia:
 *   1. Leer `config_visitas` de la empresa y buscar la plantilla que la
 *      empresa eligió manualmente (campo `plantilla_aviso_<tipo>_id`).
 *   2. Si el id existe y la plantilla pertenece a la empresa, devolverla
 *      junto con su `nombre_api` (que puede ser custom).
 *   3. Si no hay configuración o la plantilla configurada ya no existe,
 *      fallback al seed por `nombre_api` (`aviso_en_camino_default` /
 *      `aviso_llegada_default`). Es la plantilla del seed que el
 *      provisionamiento inicial deja a todas las empresas.
 *   4. Si ni siquiera el seed está presente devuelve `null` — los callers
 *      ya saben qué hacer: reportan `plantilla_estado='FALTANTE'` y
 *      bloquean el envío.
 *
 * El estado Meta (`APPROVED` / `PENDING` / etc.) lo verifican los callers
 * cuando deciden si enviar el WhatsApp; este helper solo resuelve el
 * registro de la plantilla.
 */

import type { crearClienteAdmin } from '@/lib/supabase/admin'

export type TipoAviso = 'llegada' | 'en_camino'

/** Forma esperada de la plantilla resuelta (subset de la tabla plantillas_whatsapp). */
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

type ClienteAdmin = ReturnType<typeof crearClienteAdmin>

export async function resolverPlantillaAviso(
  admin: ClienteAdmin,
  empresaId: string,
  tipo: TipoAviso,
): Promise<PlantillaAvisoResuelta | null> {
  const campoConfig =
    tipo === 'llegada' ? 'plantilla_aviso_llegada_id' : 'plantilla_aviso_en_camino_id'
  const nombreDefault = nombreApiDefault(tipo)

  // 1. Configuración de la empresa: ¿eligió una plantilla custom?
  const { data: config, error: errorConfig } = await admin
    .from('config_visitas')
    .select(`${campoConfig}`)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (errorConfig) {
    console.error('[resolverPlantillaAviso] error leyendo config_visitas:', errorConfig)
  }

  const plantillaIdConfigurada = config
    ? ((config as Record<string, unknown>)[campoConfig] as string | null | undefined)
    : null

  // 2. Si hay id configurado, resolver por id. Si no existe (ej. fue
  //    eliminada después de configurarse), caemos al fallback.
  if (plantillaIdConfigurada) {
    const { data: plantilla } = await admin
      .from('plantillas_whatsapp')
      .select('*')
      .eq('id', plantillaIdConfigurada)
      .eq('empresa_id', empresaId)
      .maybeSingle()

    if (plantilla) {
      const nombreApi = ((plantilla as Record<string, unknown>).nombre_api as string | null) ?? nombreDefault
      return { plantilla: plantilla as PlantillaAvisoBase, nombreApi }
    }
  }

  // 3. Fallback al seed por nombre_api default.
  const { data: porDefault } = await admin
    .from('plantillas_whatsapp')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('nombre_api', nombreDefault)
    .maybeSingle()

  if (porDefault) {
    return { plantilla: porDefault as PlantillaAvisoBase, nombreApi: nombreDefault }
  }

  return null
}

export function nombreApiDefault(tipo: TipoAviso): string {
  return tipo === 'llegada' ? 'aviso_llegada_default' : 'aviso_en_camino_default'
}
