'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PaginaEditorTurnoLaboral } from '@/componentes/entidad/_editor_turno_laboral/PaginaEditorTurnoLaboral'
import { useToast } from '@/componentes/feedback/Toast'
import type { TurnoLaboral } from '@/componentes/entidad/_editor_turno_laboral/PaginaEditorTurnoLaboral'

interface Sector {
  id: string
  nombre: string
  turno_id: string | null
}

export default function PaginaEditarTurno() {
  const params = useParams()
  const router = useRouter()
  const { mostrar } = useToast()
  const id = String(params?.id || '')

  const [turno, setTurno] = useState<TurnoLaboral | null>(null)
  const [sectores, setSectores] = useState<Sector[]>([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let cancelado = false
    const cargar = async () => {
      setCargando(true)
      try {
        const [resT, resC] = await Promise.all([
          fetch('/api/asistencias/turnos'),
          fetch('/api/asistencias/config'),
        ])
        const [dataT, dataC] = await Promise.all([resT.json(), resC.json()])
        if (cancelado) return

        const encontrado: TurnoLaboral | undefined = (dataT.turnos || []).find((t: TurnoLaboral) => t.id === id)
        if (!encontrado) {
          mostrar('error', 'Turno no encontrado')
          router.replace('/asistencias/configuracion/turnos')
          return
        }
        setTurno(encontrado)
        setSectores(dataC.sectores || [])
      } catch {
        if (!cancelado) mostrar('error', 'Error al cargar')
      } finally {
        if (!cancelado) setCargando(false)
      }
    }
    if (id) cargar()
    return () => { cancelado = true }
  }, [id, mostrar, router])

  if (cargando || !turno) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-texto-terciario">Cargando...</p>
      </div>
    )
  }

  return (
    <PaginaEditorTurnoLaboral
      turno={turno}
      sectores={sectores}
      rutaVolver="/asistencias/configuracion/turnos"
      textoVolver="Turnos laborales"
    />
  )
}
