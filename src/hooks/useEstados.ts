'use client'

/**
 * useEstados — Hook que devuelve los estados configurables disponibles
 * para una entidad (cuotas, conversaciones, presupuestos, etc.).
 *
 * Combina los estados del sistema (visibles a todas las empresas) con los
 * propios de la empresa actual. Se usa para alimentar selectores, badges
 * con etiquetas/colores correctas y ordenar listados por estado.
 *
 * Uso típico:
 *   const { data: estados = [] } = useEstados('conversacion')
 *   const estadoActual = estados.find(e => e.clave === conv.estado_clave)
 *
 * Si la entidad todavía no fue migrada al sistema genérico, devuelve [].
 * El consumidor puede caer a etiquetas hardcodeadas como fallback.
 */

import { useQuery } from '@tanstack/react-query'
import type { EntidadConEstado, GrupoEstado } from '@/tipos/estados'

export interface EstadoConfig {
  id: string
  empresa_id: string | null
  clave: string
  etiqueta: string
  grupo: GrupoEstado
  icono: string
  color: string
  orden: number
  activo: boolean
  es_sistema: boolean
  creado_en: string
  actualizado_en: string
}

interface RespuestaApi {
  estados?: EstadoConfig[]
  error?: string
}

export function useEstados(entidadTipo: EntidadConEstado | null | undefined) {
  return useQuery<EstadoConfig[]>({
    queryKey: ['estados', entidadTipo],
    enabled: !!entidadTipo,
    queryFn: async () => {
      if (!entidadTipo) return []
      const res = await fetch(`/api/estados?entidad_tipo=${entidadTipo}`)
      if (!res.ok) return []
      const data: RespuestaApi = await res.json()
      return data.estados ?? []
    },
    // Estados rara vez cambian — cache amplio.
    staleTime: 10 * 60_000,
  })
}
