/**
 * Parser de filtros del listado de ejecuciones (PR 18.3).
 *
 * Función pura: recibe `URLSearchParams` y devuelve un objeto tipado
 * con los filtros validados. Los valores inválidos se ignoran (la
 * UI no debería mandarlos pero si pasa, no rompemos el endpoint).
 *
 * Esto vive separado del endpoint para poder testear unit la matriz
 * de validación sin tocar BD.
 *
 * Filtros soportados (referencia: §1.9.4 del plan UX):
 *   - flujo_id            uuid simple
 *   - estado              CSV de EstadoEjecucion
 *   - desde / hasta       ISO date sobre creado_en
 *   - creado_rango        preset de fecha ('hoy', '7d', etc.)
 *   - disparado_por_tipo  CSV: cambios_estado | cron | manual | webhook
 *   - entidad_tipo        single (matchea contexto_inicial.entidad.tipo)
 *   - entidad_id          single (matchea contexto_inicial.entidad.id)
 *   - error_raw_class     CSV de raw_class del log (helpers de PR 16:
 *                         VariableFaltante, HelperTipoInvalido, etc.)
 *   - pagina, por_pagina  paginación
 */

import {
  ESTADOS_EJECUCION,
  type EstadoEjecucion,
} from '@/tipos/workflow'

const TIPOS_DISPARADO_POR = ['cambios_estado', 'cron', 'manual', 'webhook'] as const
export type TipoDisparadoPor = (typeof TIPOS_DISPARADO_POR)[number]

export interface FiltrosEjecuciones {
  flujo_id: string | null
  estados: EstadoEjecucion[]
  desde: string | null
  hasta: string | null
  creado_rango: string | null
  disparado_por_tipos: TipoDisparadoPor[]
  entidad_tipo: string | null
  entidad_id: string | null
  error_raw_class: string[]
  pagina: number
  por_pagina: number
}

const POR_PAGINA_DEFAULT = 50
const POR_PAGINA_MAX = 200

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function csvLimpio(s: string | null): string[] {
  if (!s) return []
  return s
    .split(',')
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
}

export function parsearFiltrosEjecuciones(params: URLSearchParams): FiltrosEjecuciones {
  // flujo_id: solo UUIDs válidos pasan; cualquier otra cosa se descarta.
  const flujoIdRaw = (params.get('flujo_id') ?? '').trim()
  const flujo_id = REGEX_UUID.test(flujoIdRaw) ? flujoIdRaw : null

  // estado: CSV filtrado contra el catálogo TS.
  const estadosCrudos = csvLimpio(params.get('estado'))
  const estados = estadosCrudos.filter(
    (s): s is EstadoEjecucion =>
      (ESTADOS_EJECUCION as readonly string[]).includes(s),
  )

  // disparado_por_tipo: CSV whitelisted.
  const dispCrudos = csvLimpio(params.get('disparado_por_tipo'))
  const disparado_por_tipos = dispCrudos.filter(
    (s): s is TipoDisparadoPor => (TIPOS_DISPARADO_POR as readonly string[]).includes(s),
  )

  // desde / hasta: cualquier string no vacío. La validación dura
  // (formato ISO) la hace Postgres al recibir el filtro `gte/lte`.
  const desde = (params.get('desde') ?? '').trim() || null
  const hasta = (params.get('hasta') ?? '').trim() || null

  // creado_rango: preset string crudo. Lo resuelve el endpoint
  // contra inicioRangoFechaISO + zona horaria de empresa.
  const creado_rango = (params.get('creado_rango') ?? '').trim() || null

  // entidad_tipo / entidad_id: opcionales. Sin validar shape acá —
  // si entidad_id no es UUID, el filtro Postgres simplemente no
  // matchea. La UI manda valores correctos.
  const entidad_tipo = (params.get('entidad_tipo') ?? '').trim() || null
  const entidad_id = (params.get('entidad_id') ?? '').trim() || null

  // error_raw_class: CSV libre. La lista de raw_class válidos vive
  // en el motor (resolver-variables.ts del PR 16) y puede crecer;
  // no mantenemos whitelist acá para evitar acoplamiento.
  const error_raw_class = csvLimpio(params.get('error_raw_class'))

  // Paginación. Cuidado con `Number('0') || default`: 0 es falsy en JS,
  // así que un `por_pagina=0` clampearía al default en vez de a 1.
  // Validamos NaN explícito antes de aplicar el clamp.
  const paginaRaw = Number(params.get('pagina'))
  const pagina = Number.isFinite(paginaRaw) ? Math.max(1, paginaRaw) : 1

  const porPaginaParam = params.get('por_pagina')
  const porPaginaRaw = porPaginaParam === null ? POR_PAGINA_DEFAULT : Number(porPaginaParam)
  const por_pagina = Number.isFinite(porPaginaRaw)
    ? Math.min(POR_PAGINA_MAX, Math.max(1, porPaginaRaw))
    : POR_PAGINA_DEFAULT

  return {
    flujo_id,
    estados,
    desde,
    hasta,
    creado_rango,
    disparado_por_tipos,
    entidad_tipo,
    entidad_id,
    error_raw_class,
    pagina,
    por_pagina,
  }
}
