'use client'

/**
 * useConfigActividades — Hook que carga la configuración necesaria para que el
 * PanelChatter pueda crear/editar actividades sin renunciar a ningún campo
 * que sí está disponible en el módulo /actividades:
 *   • tipos        (con todos los flags campo_X, accion_destino, evento_auto_completar)
 *   • estados
 *   • miembros     (perfiles, FILTRANDO los kiosco que no tienen usuario_id)
 *   • presetsPosposicion (para los botones "Posponer" del modal en edición)
 *
 * Carga lazy (solo cuando el usuario abre el modal por primera vez) para no
 * pagar este costo en cada apertura del panel.
 */

import { useState, useCallback, useRef } from 'react'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import type { TipoActividad } from '@/app/(flux)/actividades/configuracion/_tipos'
import type { EstadoActividad } from '@/app/(flux)/actividades/configuracion/secciones/SeccionEstados'
import type { Miembro } from '@/app/(flux)/actividades/_componentes/ModalActividad'

interface PresetPosposicion {
  id: string
  etiqueta: string
  dias: number
}

interface DatosConfig {
  tipos: TipoActividad[]
  estados: EstadoActividad[]
  miembros: Miembro[]
  presetsPosposicion: PresetPosposicion[]
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
          if (!user) return [] as Miembro[]
          const empresaId = user.app_metadata?.empresa_activa_id
          if (!empresaId) return [] as Miembro[]

          const { data: mRes } = await supabase
            .from('miembros')
            .select('usuario_id')
            .eq('empresa_id', empresaId)
            .eq('activo', true)

          // Excluir kioscos (usuario_id nulo): pasarlos al .in('id', [...]) rompe
          // la query de perfiles y devuelve vacío, lo que dejaba el selector de
          // responsable sin opciones aunque la empresa tuviera miembros reales.
          const ids = (mRes || []).map(m => m.usuario_id).filter((id): id is string => !!id)
          if (!ids.length) return [] as Miembro[]

          const { data: perfiles } = await supabase
            .from('perfiles')
            .select('id, nombre, apellido')
            .in('id', ids)

          return (perfiles || []).map(p => ({
            usuario_id: p.id as string,
            nombre: (p.nombre as string) || '',
            apellido: (p.apellido as string) || '',
          }))
        })(),
      ])

      const presets = (configRes.config?.presets_posposicion as PresetPosposicion[] | undefined) ?? []

      setDatos({
        tipos: (configRes.tipos || []) as TipoActividad[],
        estados: (configRes.estados || []) as EstadoActividad[],
        miembros: miembrosData,
        presetsPosposicion: presets,
      })
      cargadoRef.current = true
    } catch {
      // Silencioso — el modal mostrará vacío
    }
    setCargando(false)
  }, [])

  return { datos, cargando, cargar }
}
