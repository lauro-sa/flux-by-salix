'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, Bell, Tag, Zap, ListChecks, Clock, Briefcase } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { SinPermiso } from '@/componentes/feedback/SinPermiso'
import { useRol } from '@/hooks/useRol'
import { SeccionEstados, type EstadoActividad } from './secciones/SeccionEstados'
import { SeccionPosposicion } from './secciones/SeccionPosposicion'
import { SeccionHorarioLaboral } from './secciones/SeccionHorarioLaboral'

/**
 * Página de configuración de Actividades.
 * Secciones: Tipos, Estados, Posposición, Horario laboral, Notificaciones, Automatizaciones.
 */
export default function PaginaConfiguracionActividades() {
  const router = useRouter()
  const { esPropietario, tienePermiso, cargando: cargandoPermisos } = useRol()
  const puedeVer = esPropietario || tienePermiso('config_actividades', 'ver')
  const [seccionActiva, setSeccionActiva] = useState('tipos')
  const [cargando, setCargando] = useState(true)
  const [estados, setEstados] = useState<EstadoActividad[]>([])
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)

  const secciones: SeccionConfig[] = [
    { id: 'tipos', etiqueta: 'Tipos de actividad', icono: <Tag size={16} />, grupo: 'Personalización' },
    { id: 'estados', etiqueta: 'Estados', icono: <ListChecks size={16} />, grupo: 'Personalización' },
    { id: 'posposicion', etiqueta: 'Posposición', icono: <Clock size={16} />, grupo: 'Personalización' },
    { id: 'horario', etiqueta: 'Horario laboral', icono: <Briefcase size={16} />, grupo: 'Personalización' },
    { id: 'notificaciones', etiqueta: 'Notificaciones', icono: <Bell size={16} />, deshabilitada: true },
    { id: 'automatizaciones', etiqueta: 'Automatizaciones', icono: <Zap size={16} />, deshabilitada: true },
  ]

  const cargar = useCallback(async () => {
    // No fetch si no tenemos permiso: evita 403 ruidoso y el error en consola.
    if (!puedeVer) { setCargando(false); return }
    try {
      const [configRes] = await Promise.all([
        fetch('/api/actividades/config'),
      ])
      if (!configRes.ok) throw new Error()
      const data = await configRes.json()
      setEstados(data.estados || [])
      setConfig(data.config || null)
    } catch {
      console.error('Error al cargar config de actividades')
    } finally {
      setCargando(false)
    }
  }, [puedeVer])

  useEffect(() => { cargar() }, [cargar])

  // Guard de acceso: después de todos los hooks para no romper Rules of Hooks.
  if (cargandoPermisos) return null
  if (!puedeVer) return <SinPermiso onVolver={() => router.push('/actividades')} />

  const ejecutarAccion = useCallback(async (accion: string, datos: Record<string, unknown>) => {
    const res = await fetch('/api/actividades/config', {
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
      titulo="Configuración de actividades"
      descripcion="Crea y personaliza los tipos de actividad disponibles para tu equipo"
      iconoHeader={<Settings2 size={22} style={{ color: 'var(--texto-marca)' }} />}
      volverTexto="Actividades"
      onVolver={() => router.push('/actividades')}
      secciones={secciones}
      seccionActiva={seccionActiva}
      onCambiarSeccion={(id) => {
        if (id === 'tipos') {
          router.push('/actividades/configuracion/tipos')
          return
        }
        setSeccionActiva(id)
      }}
    >
      {seccionActiva === 'estados' && (
        <SeccionEstados
          estados={estados}
          cargando={cargando}
          onActualizar={setEstados}
          onAccionAPI={ejecutarAccion}
        />
      )}
      {seccionActiva === 'posposicion' && (
        <SeccionPosposicion
          config={config as { presets_posposicion: { id: string; etiqueta: string; dias: number }[] } | null}
          cargando={cargando}
          onAccionAPI={ejecutarAccion}
        />
      )}
      {seccionActiva === 'horario' && (
        <SeccionHorarioLaboral
          config={config as { respetar_dias_laborales?: boolean } | null}
          cargando={cargando}
          onAccionAPI={ejecutarAccion}
        />
      )}
      {seccionActiva === 'notificaciones' && (
        <EstadoVacio
          icono={<Bell />}
          titulo="Próximamente"
          descripcion="Configura alertas inteligentes por vencimiento, asignación y cambios de estado. Impulsado por Salix IA."
        />
      )}
      {seccionActiva === 'automatizaciones' && (
        <EstadoVacio
          icono={<Zap />}
          titulo="Próximamente"
          descripcion="Crea automatizaciones inteligentes: al completar una actividad, Salix IA puede crear seguimientos, escalar prioridades y más."
        />
      )}
    </PlantillaConfiguracion>
  )
}
