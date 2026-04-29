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
      // Los miembros vienen de /api/miembros que ya excluye los kioscos sin
      // usuario_id (ver src/app/api/miembros/route.ts). Antes se hacía la query
      // directa a Supabase y el null en los kioscos rompía el .in('id', [...]).
      const [configRes, miembrosRes] = await Promise.all([
        fetch('/api/actividades/config').then(r => r.json()),
        fetch('/api/miembros').then(r => r.json()).catch(() => ({ miembros: [] })),
      ])

      const miembrosData: Miembro[] = (miembrosRes.miembros || [])
        .filter((m: { usuario_id: string | null; activo: boolean }) => !!m.usuario_id && m.activo)
        .map((m: { usuario_id: string; nombre: string | null; apellido: string | null }) => ({
          usuario_id: m.usuario_id,
          nombre: m.nombre || '',
          apellido: m.apellido || '',
        }))

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
