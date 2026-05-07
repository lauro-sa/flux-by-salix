/**
 * Helpers compartidos por las tools personales de Salix IA.
 *
 * Las tools personales operan siempre sobre `ctx.miembro.id`: ningún parámetro
 * acepta otro miembro_id. Estos helpers centralizan:
 *  - Carga del miembro completo (frecuencia, monto, días de trabajo)
 *  - Resolución del periodo solicitado ('actual' | 'anterior' | 'antepasado')
 *    contra la ventana histórica máxima permitida
 */

import type { ContextoSalixIA } from '@/tipos/salix-ia'
import {
  rangoVentanaHistorica,
} from '@/lib/asistencias/ventana-historica'
import type { RangoPeriodo } from '@/lib/asistencias/periodo-actual'

export interface MiembroPersonal {
  id: string
  empresa_id: string
  compensacion_tipo: string | null
  compensacion_monto: number | null
  compensacion_frecuencia: string | null
  dias_trabajo: number | null
  turno_id: string | null
}

/** Carga los datos del miembro autenticado relevantes para tools personales. */
export async function obtenerMiembroPersonal(ctx: ContextoSalixIA): Promise<MiembroPersonal | null> {
  const { data } = await ctx.admin
    .from('miembros')
    .select('id, empresa_id, compensacion_tipo, compensacion_monto, compensacion_frecuencia, dias_trabajo, turno_id')
    .eq('id', ctx.miembro.id)
    .eq('empresa_id', ctx.empresa_id)
    .eq('activo', true)
    .maybeSingle()

  return (data as MiembroPersonal | null) ?? null
}

/** Mapea el alias 'actual'/'anterior'/'antepasado' a un índice 0/1/2 sobre la ventana histórica. */
const INDICE_ALIAS: Record<string, number> = {
  actual: 0,
  anterior: 1,
  antepasado: 2,
}

/**
 * Resuelve el periodo solicitado por la herramienta. Si el alias está fuera de
 * la ventana histórica permitida (default 3 periodos), devuelve null para que
 * la tool pueda responder con la sugerencia de consultar al administrador.
 *
 * Default: 'actual'.
 */
export function resolverPeriodoSolicitado(
  miembro: MiembroPersonal,
  alias: string | undefined,
  fechaRef: Date = new Date(),
): RangoPeriodo | null {
  const idx = INDICE_ALIAS[alias ?? 'actual']
  if (idx === undefined) return null
  const ventana = rangoVentanaHistorica(miembro.compensacion_frecuencia, 3, fechaRef)
  return ventana[idx] ?? null
}

/** Mensaje estándar cuando una consulta cae fuera de la ventana o de la capacidad de la tool. */
export const MENSAJE_FUERA_DE_ALCANCE =
  'No tengo esa información disponible. Para periodos anteriores o consultas más detalladas, comunicate con tu administrador.'
