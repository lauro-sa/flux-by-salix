'use client'

/**
 * useMiembrosAsignables — Hook único para obtener la lista de miembros que
 * pueden recibir asignaciones (actividades, visitas, eventos, mensajes, etc.).
 *
 * Por qué existe: la tabla `miembros` admite registros sin `usuario_id` (los
 * empleados "solo kiosco"). Cuando el código consume esa tabla y arma queries
 * tipo `.in('id', miembros.map(m => m.usuario_id))`, el null en el array hace
 * que la query de perfiles devuelva vacío silenciosamente — y el selector de
 * responsable termina sin opciones aunque la empresa tenga miembros reales.
 *
 * El endpoint `/api/miembros` ya filtra los kioscos por defecto (ver comentario
 * en src/app/api/miembros/route.ts). Este hook lo envuelve con React Query
 * para cache compartido entre componentes y query directa idéntica desde toda
 * la app.
 *
 * Uso: const { data: miembros = [] } = useMiembrosAsignables()
 */

import { useQuery } from '@tanstack/react-query'

export interface MiembroAsignable {
  usuario_id: string
  nombre: string
  apellido: string
  avatar_url: string | null
  puesto: string | null
  sector: string | null
  rol: string | null
  /** Permisos custom por módulo (`{ recorrido: ['ver_propio', 'registrar'], ... }`).
   *  Útil para consumidores que filtran por capacidad (ej. visitadores). */
  permisos_custom: Record<string, string[]> | null
}

interface RespuestaApi {
  miembros?: Array<{
    usuario_id: string | null
    activo: boolean
    rol: string | null
    nombre: string | null
    apellido: string | null
    puesto: string | null
    sector: string | null
    perfil: { avatar_url: string | null } | null
    permisos_custom: Record<string, string[]> | null
  }>
}

export function useMiembrosAsignables() {
  return useQuery<MiembroAsignable[]>({
    queryKey: ['miembros-asignables'],
    queryFn: async () => {
      const res = await fetch('/api/miembros')
      if (!res.ok) return []
      const data: RespuestaApi = await res.json()
      // Defensa adicional: aunque el endpoint ya excluye usuario_id null e inactivos,
      // filtramos acá también por si en el futuro alguien pasa flags que los incluyan.
      return (data.miembros || [])
        .filter(m => !!m.usuario_id && m.activo)
        .map(m => ({
          usuario_id: m.usuario_id as string,
          nombre: m.nombre || '',
          apellido: m.apellido || '',
          avatar_url: m.perfil?.avatar_url ?? null,
          puesto: m.puesto ?? null,
          sector: m.sector ?? null,
          rol: m.rol ?? null,
          permisos_custom: m.permisos_custom ?? null,
        }))
    },
    staleTime: 5 * 60_000,
  })
}
