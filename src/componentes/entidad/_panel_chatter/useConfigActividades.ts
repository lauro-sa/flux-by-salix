'use client'

/**
 * useConfigActividades — Hook que carga tipos, estados y miembros
 * para el modal de actividades. Fetch lazy (solo cuando se necesita).
 * Se usa en: PanelChatter para abrir ModalActividad internamente.
 */

import { useState, useCallback, useRef } from 'react'
import { crearClienteNavegador } from '@/lib/supabase/cliente'

// Tipos mínimos necesarios (evitar importar desde la página de actividades)
export interface TipoActividadChatter {
  id: string
  clave: string
  nombre: string
  icono?: string
  color?: string
  dias_vencimiento?: number
  campos_visibles?: string[]
  orden?: number
}

export interface EstadoActividadChatter {
  id: string
  clave: string
  nombre: string
  color?: string
  orden?: number
}

export interface MiembroChatter {
  usuario_id: string
  nombre: string
  apellido: string
}

interface DatosConfig {
  tipos: TipoActividadChatter[]
  estados: EstadoActividadChatter[]
  miembros: MiembroChatter[]
}

export function useConfigActividades() {
  const [datos, setDatos] = useState<DatosConfig | null>(null)
  const [cargando, setCargando] = useState(false)
  const cargadoRef = useRef(false)

  const cargar = useCallback(async () => {
    if (cargadoRef.current) return
    setCargando(true)

    try {
      const [configRes, miembrosData] = await Promise.all([
        fetch('/api/actividades/config').then(r => r.json()),
        (async () => {
          const supabase = crearClienteNavegador()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return []
          const empresaId = user.app_metadata?.empresa_activa_id
          if (!empresaId) return []
          const { data: mRes } = await supabase
            .from('miembros')
            .select('usuario_id')
            .eq('empresa_id', empresaId)
            .eq('activo', true)
          if (!mRes?.length) return []
          const { data: perfiles } = await supabase
            .from('perfiles')
            .select('id, nombre, apellido')
            .in('id', mRes.map(m => m.usuario_id))
          return (perfiles || []).map(p => ({
            usuario_id: p.id,
            nombre: p.nombre || '',
            apellido: p.apellido || '',
          }))
        })(),
      ])

      setDatos({
        tipos: configRes.tipos || [],
        estados: configRes.estados || [],
        miembros: miembrosData,
      })
      cargadoRef.current = true
    } catch {
      // Silencioso — el modal mostrará vacío
    }
    setCargando(false)
  }, [])

  return { datos, cargando, cargar }
}
