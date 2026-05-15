'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Settings2, Bell, Tag, Zap, Briefcase, LayoutGrid, CalendarDays } from 'lucide-react'
import { PlantillaConfiguracion } from '@/componentes/entidad/PlantillaConfiguracion'
import type { SeccionConfig } from '@/componentes/entidad/PlantillaConfiguracion'
import { EstadoVacio } from '@/componentes/feedback/EstadoVacio'
import { SinPermiso } from '@/componentes/feedback/SinPermiso'
import { useRol } from '@/hooks/useRol'
import { useEmpresa } from '@/hooks/useEmpresa'
import { PreviewSeccionExterna, type ItemPreview } from '@/componentes/entidad/PreviewSeccionExterna'
import { SeccionHorarioCalendario } from './secciones/SeccionHorarioCalendario'
import { SeccionVistaDefault } from './secciones/SeccionVistaDefault'
import { SeccionFeriados } from './secciones/SeccionFeriados'

// Shape mínima de un feriado tal como lo devuelve /api/calendario/feriados.
// Mantenemos el tipo local porque SeccionFeriados ya tiene su propia
// definición; los campos coinciden.
interface FeriadoBD {
  id: string
  nombre: string
  fecha: string
  tipo: string
  pais_codigo: string | null
  recurrente: boolean
  origen: string
  activo: boolean
}

interface TipoEventoCalendario {
  id: string
  clave: string
  etiqueta: string
  icono: string
  color: string
  duracion_default?: number | null
  todo_el_dia_default?: boolean
  orden: number
  activo: boolean
  es_predefinido: boolean
}

// Definida fuera del componente para que la referencia sea estable
// y el useEffect del PreviewSeccionExterna no se dispare en cada render.
function extraerTiposEvento(data: unknown): ItemPreview[] {
  const tipos = ((data as { tipos?: TipoEventoCalendario[] })?.tipos) || []
  return tipos
    .filter(t => t.activo)
    .sort((a, b) => a.orden - b.orden)
    .map(t => {
      const badges: { texto: string }[] = []
      if (t.todo_el_dia_default) badges.push({ texto: 'Todo el día' })
      else if (t.duracion_default) badges.push({ texto: `${t.duracion_default} min` })
      return {
        id: t.id,
        icono: t.icono,
        color: t.color,
        etiqueta: t.etiqueta,
        subEtiqueta: t.clave,
        badges,
        origen: t.es_predefinido
          ? { texto: 'Predefinido', tono: 'predefinido' as const }
          : { texto: 'Personalizado', tono: 'personalizado' as const },
      }
    })
}

/**
 * Página de configuración del Calendario.
 * Secciones: Tipos de evento, Horario laboral, Vista predeterminada, Notificaciones, Automatizaciones.
 */
export default function PaginaConfiguracionCalendario() {
  const router = useRouter()
  const { esPropietario, tienePermiso, cargando: cargandoPermisos } = useRol()
  const { empresa } = useEmpresa()
  const puedeVer = esPropietario || tienePermiso('config_calendario', 'ver')
  const [seccionActiva, setSeccionActiva] = useState('tipos')
  const [cargando, setCargando] = useState(true)
  const [config, setConfig] = useState<Record<string, unknown> | null>(null)
  // Feriados: se cargan a demanda (cuando se entra a la sección) y se
  // mantienen en estado de la página para que las acciones (crear,
  // borrar, generar con IA, importar) puedan actualizar la lista
  // optimistamente sin recargar todo.
  const [feriados, setFeriados] = useState<FeriadoBD[]>([])
  const [cargandoFeriados, setCargandoFeriados] = useState(false)

  const secciones: SeccionConfig[] = [
    { id: 'tipos', etiqueta: 'Tipos de evento', icono: <Tag size={16} />, grupo: 'Personalización' },
    { id: 'horario', etiqueta: 'Horario laboral', icono: <Briefcase size={16} />, grupo: 'Personalización' },
    { id: 'vista', etiqueta: 'Vista predeterminada', icono: <LayoutGrid size={16} />, grupo: 'Personalización' },
    { id: 'feriados', etiqueta: 'Feriados', icono: <CalendarDays size={16} />, grupo: 'Personalización' },
    { id: 'notificaciones', etiqueta: 'Notificaciones', icono: <Bell size={16} />, deshabilitada: true },
    { id: 'automatizaciones', etiqueta: 'Automatizaciones', icono: <Zap size={16} />, deshabilitada: true },
  ]

  const cargar = useCallback(async () => {
    if (!puedeVer) { setCargando(false); return }
    try {
      const res = await fetch('/api/calendario/config')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setConfig(data.config || null)
    } catch {
      console.error('Error al cargar config del calendario')
    } finally {
      setCargando(false)
    }
  }, [puedeVer])

  useEffect(() => { cargar() }, [cargar])

  // Cargar feriados la primera vez que se entra a la sección. El
  // spinner solo aparece en esta primera carga; SeccionFeriados
  // actualiza la lista en su lugar después de cada acción.
  useEffect(() => {
    if (seccionActiva !== 'feriados') return
    if (feriados.length > 0) return
    setCargandoFeriados(true)
    fetch('/api/calendario/feriados')
      .then(r => r.json())
      .then(data => setFeriados((data.feriados ?? []) as FeriadoBD[]))
      .catch(() => { /* el componente muestra el error si hay */ })
      .finally(() => setCargandoFeriados(false))
  }, [seccionActiva, feriados.length])

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

  // Guard de acceso: después de todos los hooks.
  if (cargandoPermisos) return null
  if (!puedeVer) return <SinPermiso onVolver={() => router.push('/calendario')} />

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
        <PreviewSeccionExterna
          titulo="Tipos de evento"
          descripcion="Personalizá los tipos de evento del calendario, con su ícono, color y duración predeterminada."
          endpoint="/api/calendario/config"
          extraerItems={extraerTiposEvento}
          hrefDestino="/calendario/configuracion/tipos"
          textoBoton="Gestionar tipos"
          etiquetaItem={{ singular: 'tipo', plural: 'tipos' }}
          textoVacio={{
            titulo: 'No hay tipos de evento',
            descripcion: 'Creá el primer tipo desde la página de gestión.',
          }}
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
      {seccionActiva === 'feriados' && (
        <SeccionFeriados
          feriados={feriados}
          cargando={cargandoFeriados}
          onActualizar={(lista) => setFeriados(lista as FeriadoBD[])}
          paisEmpresa={(empresa?.pais as string) || 'AR'}
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
