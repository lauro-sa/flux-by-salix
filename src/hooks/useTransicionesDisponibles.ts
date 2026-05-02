'use client'

/**
 * useTransicionesDisponibles — Hook que devuelve las acciones de transición
 * de estado disponibles desde un estado actual de una entidad.
 *
 * Excluye transiciones automáticas (es_automatica=true) — esas las dispara
 * el sistema, no aparecen como botones de usuario. Lo que devuelve es
 * exactamente lo que un menú "Acciones" debería mostrar.
 *
 * Uso típico:
 *   const { data: acciones = [] } = useTransicionesDisponibles('conversacion', conv.estado_clave)
 *   acciones.map(a => <Boton onClick={() => aplicar(a.hasta_clave)}>{a.etiqueta}</Boton>)
 */

import { useQuery } from '@tanstack/react-query'
import type { EntidadConEstado } from '@/tipos/estados'

export interface TransicionDisponible {
  id: string
  hasta_clave: string
  etiqueta: string | null
  descripcion: string | null
  es_automatica: boolean
  requiere_motivo: boolean
  requiere_confirmacion: boolean
  orden: number
}

interface RespuestaApi {
  transiciones?: TransicionDisponible[]
  error?: string
}

export function useTransicionesDisponibles(
  entidadTipo: EntidadConEstado | null | undefined,
  desdeClave: string | null | undefined,
) {
  return useQuery<TransicionDisponible[]>({
    queryKey: ['transiciones-disponibles', entidadTipo, desdeClave],
    enabled: !!entidadTipo && !!desdeClave,
    queryFn: async () => {
      if (!entidadTipo || !desdeClave) return []
      const url = `/api/estados/transiciones-disponibles?entidad_tipo=${entidadTipo}&desde_clave=${encodeURIComponent(desdeClave)}`
      const res = await fetch(url)
      if (!res.ok) return []
      const data: RespuestaApi = await res.json()
      return data.transiciones ?? []
    },
    staleTime: 5 * 60_000,
  })
}
