'use client'

import { useEffect, useState } from 'react'
import { PaginaEditorTipoActividad } from '@/componentes/entidad/_editor_tipo_actividad/PaginaEditorTipoActividad'
import { useMiembrosAsignables } from '@/hooks/useMiembrosAsignables'
import type { TipoActividad } from '../../_tipos'
import { MODULOS_DISPONIBLES } from '../../_tipos'

export default function PaginaNuevoTipoActividad() {
  const [tipos, setTipos] = useState<TipoActividad[]>([])
  const { data: miembros = [] } = useMiembrosAsignables()
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    const cargar = async () => {
      try {
        const res = await fetch('/api/actividades/config')
        const data = await res.json()
        setTipos(data.tipos || [])
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [])

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-texto-terciario">Cargando...</p>
      </div>
    )
  }

  return (
    <PaginaEditorTipoActividad
      tipo={null}
      tipos={tipos}
      miembros={miembros}
      modulosDisponibles={MODULOS_DISPONIBLES}
      rutaVolver="/actividades/configuracion/tipos"
      textoVolver="Tipos de actividad"
    />
  )
}
