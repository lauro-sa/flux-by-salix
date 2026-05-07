/**
 * Tipos compartidos del panel inferior tipo consola del editor de flujos
 * (sub-PR 19.5).
 *
 * El response del endpoint POST /api/flujos/[id]/probar matchea el shape
 * `RespuestaDryRun` — la consola lo consume tal cual sin transformaciones.
 */

import type { ContextoVariables } from '@/lib/workflows/resolver-variables'
import type {
  PasoLogDryRun,
  ResumenDryRun,
} from '@/lib/workflows/correr-ejecucion-dryrun'
import type { EstadoEjecucion } from '@/tipos/workflow'

export type TabConsola = 'preview' | 'dryrun'

export interface EventoSimuladoApi {
  tipo_entidad: string | null
  id: string
  resumen: string
}

export interface RespuestaDryRun {
  log: PasoLogDryRun[]
  contexto_usado: ContextoVariables
  flujo_evaluado: {
    disparador: unknown
    acciones: unknown[]
    es_borrador_interno: boolean
  }
  evento_simulado: EventoSimuladoApi | null
  duracion_total_ms: number
  estado_final: EstadoEjecucion
  resumen: ResumenDryRun
}
