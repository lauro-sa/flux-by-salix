'use client'

import { useEffect, useState } from 'react'
import { PaginaEditorTurnoLaboral } from '@/componentes/entidad/_editor_turno_laboral/PaginaEditorTurnoLaboral'

interface Sector {
  id: string
  nombre: string
  turno_id: string | null
}

export default function PaginaNuevoTurno() {
  const [sectores, setSectores] = useState<Sector[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    fetch('/api/asistencias/config')
      .then(r => r.json())
      .then(d => setSectores(d.sectores || []))
      .catch(() => {})
      .finally(() => setCargando(false))
  }, [])

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-texto-terciario">Cargando...</p>
      </div>
    )
  }

  return (
    <PaginaEditorTurnoLaboral
      turno={null}
      sectores={sectores}
      rutaVolver="/asistencias/configuracion/turnos"
      textoVolver="Turnos laborales"
    />
  )
}
