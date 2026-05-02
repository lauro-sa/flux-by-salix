'use client'

/**
 * useHistorialEstados — Hook que devuelve el historial de cambios de estado
 * de una entidad (presupuesto, conversación, cuota, etc.), enriquecido con
 * la etiqueta + color + icono de cada estado vía join contra estados_<entidad>.
 *
 * Se usa en el componente <HistorialEstados /> para renderizar el timeline
 * en el chatter de cualquier módulo.
 */

import { useQuery } from '@tanstack/react-query'
import type { EntidadConEstado, GrupoEstado, OrigenCambioEstado } from '@/tipos/estados'

export interface ItemHistorialEstado {
  id: string
  creado_en: string
  estado_anterior: string | null
  estado_nuevo: string
  etiqueta_anterior: string | null
  etiqueta_nuevo: string
  color_anterior: string | null
  color_nuevo: string | null
  icono_anterior: string | null
  icono_nuevo: string | null
  grupo_anterior: GrupoEstado | null
  grupo_nuevo: GrupoEstado | null
  origen: OrigenCambioEstado
  usuario_id: string | null
  usuario_nombre: string | null
  motivo: string | null
  metadatos: Record<string, unknown>
}

interface RespuestaApi {
  historial?: ItemHistorialEstado[]
  error?: string
}

export function useHistorialEstados(
  entidadTipo: EntidadConEstado | null | undefined,
  entidadId: string | null | undefined,
) {
  return useQuery<ItemHistorialEstado[]>({
    queryKey: ['historial-estados', entidadTipo, entidadId],
    enabled: !!entidadTipo && !!entidadId,
    queryFn: async () => {
      if (!entidadTipo || !entidadId) return []
      const url = `/api/estados/historial?entidad_tipo=${entidadTipo}&entidad_id=${encodeURIComponent(entidadId)}`
      const res = await fetch(url)
      if (!res.ok) return []
      const data: RespuestaApi = await res.json()
      return data.historial ?? []
    },
    // Historial cambia cuando hay transiciones — cache moderado.
    staleTime: 30_000,
  })
}
