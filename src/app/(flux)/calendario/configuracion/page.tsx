'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, Bell, Tag, Zap, Briefcase, LayoutGrid } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { SeccionTiposEvento, type TipoEventoCalendario } from './secciones/SeccionTiposEvento'
import { SeccionHorarioCalendario } from './secciones/SeccionHorarioCalendario'
import { SeccionVistaDefault } from './secciones/SeccionVistaDefault'

/**
 * Página de configuración del Calendario.
 * Secciones: Tipos de evento, Horario laboral, Vista predeterminada, Notificaciones, Automatizaciones.
 */
export default function PaginaConfiguracionCalendario() {
  const router = useRouter()
  const [seccionActiva, setSeccionActiva] = useState('tipos')
  const [cargando, setCargando] = useState(true)
  const [tipos, setTipos] = useState<TipoEventoCalendario[]>([])
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)

  const secciones: SeccionConfig[] = [
    { id: 'tipos', etiqueta: 'Tipos de evento', icono: <Tag size={16} />, grupo: 'Personalización' },
    { id: 'horario', etiqueta: 'Horario laboral', icono: <Briefcase size={16} />, grupo: 'Personalización' },
    { id: 'vista', etiqueta: 'Vista predeterminada', icono: <LayoutGrid size={16} />, grupo: 'Personalización' },
    { id: 'notificaciones', etiqueta: 'Notificaciones', icono: <Bell size={16} />, deshabilitada: true },
    { id: 'automatizaciones', etiqueta: 'Automatizaciones', icono: <Zap size={16} />, deshabilitada: true },
  ]

  const cargar = useCallback(async () => {
    try {
      const res = await fetch('/api/calendario/config')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTipos(data.tipos || [])
      setConfig(data.config || null)
    } catch {
      console.error('Error al cargar config del calendario')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const ejecutarAccion = useCallback(async (accion: string, datos: Record<string, unknown>) => {
    const res = await fetch('/api/calendario/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, datos }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || 'Error en operación')
    }
    const resultado = await res.json()
    // Si la acción devolvió config actualizada, sincronizar
    if (accion === 'actualizar_config') setConfig(resultado)
    return resultado
  }, [])

  return (
    <PlantillaConfiguracion
      titulo="Configuración del calendario"
      descripcion="Personaliza los tipos de evento, horarios y vista predeterminada"
      iconoHeader={<Settings2 size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto="Calendario"
      onVolver={() => router.push('/calendario')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={setSeccionActiva}
    >
      {seccionActiva === 'tipos' && (
        <SeccionTiposEvento
          tipos={tipos}
          cargando={cargando}
          onActualizar={setTipos}
          onAccionAPI={ejecutarAccion}
        />
      )}
      {seccionActiva === 'horario' && (
        <SeccionHorarioCalendario
          config={config as {
            hora_inicio_laboral?: string
            hora_fin_laboral?: string
            dias_laborales?: number[]
            intervalo_slot?: number
            mostrar_fines_semana?: boolean
          } | null}
          cargando={cargando}
          onAccionAPI={ejecutarAccion}
        />
      )}
      {seccionActiva === 'vista' && (
        <SeccionVistaDefault
          config={config as { vista_default?: 'dia' | 'semana' | 'mes' | 'agenda' } | null}
          cargando={cargando}
          onAccionAPI={ejecutarAccion}
        />
      )}
      {seccionActiva === 'notificaciones' && (
        <EstadoVacio
          icono={<Bell />}
          titulo="Próximamente"
          descripcion="Configura recordatorios y alertas inteligentes para tus eventos del calendario. Impulsado por Salix IA."
        />
      )}
      {seccionActiva === 'automatizaciones' && (
        <EstadoVacio
          icono={<Zap />}
          titulo="Próximamente"
          descripcion="Crea automatizaciones inteligentes: al crear un evento, Salix IA puede enviar invitaciones, crear actividades de seguimiento y más."
        />
      )}
    </PlantillaConfiguracion>
  )
}
