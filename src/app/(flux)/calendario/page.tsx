'use client'

/**
 * PaginaCalendario — Página principal del módulo Calendario.
 * Muestra una vista de calendario con barra de herramientas, navegación por fechas,
 * y vistas intercambiables (mes, semana, día, agenda).
 * Se usa como: /calendario
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Calendar, Plus, Settings2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { BarraHerramientasCalendario } from './_componentes/BarraHerramientasCalendario'
import { VistaCalendarioMes } from './_componentes/VistaCalendarioMes'
import { VistaCalendarioSemana } from './_componentes/VistaCalendarioSemana'
import { VistaCalendarioDia } from './_componentes/VistaCalendarioDia'
import { VistaCalendarioAgenda } from './_componentes/VistaCalendarioAgenda'
import { ModalEvento } from './_componentes/ModalEvento'
import { Boton } from '@/componentes/ui/Boton'
import { useToast } from '@/componentes/feedback/Toast'
import type { EventoCalendario, TipoEventoCalendario, VistaCalendario } from './_componentes/tipos'

// --- Utilidades de rango de fechas ---

/** Obtiene el rango de fechas a consultar según la vista activa */
function obtenerRangoFechas(vista: VistaCalendario, fecha: Date): { desde: string; hasta: string } {
  const anio = fecha.getFullYear()
  const mes = fecha.getMonth()

  switch (vista) {
    case 'mes': {
      // Del primer día visible (puede ser del mes anterior) al último visible
      const primerDiaMes = new Date(anio, mes, 1)
      const ultimoDiaMes = new Date(anio, mes + 1, 0)
      // Inicio de semana del primer día
      const diaInicio = primerDiaMes.getDay()
      const diffInicio = diaInicio === 0 ? 6 : diaInicio - 1
      const desde = new Date(primerDiaMes)
      desde.setDate(desde.getDate() - diffInicio)
      // Fin de semana del último día
      const diaFin = ultimoDiaMes.getDay()
      const diffFin = diaFin === 0 ? 0 : 7 - diaFin
      const hasta = new Date(ultimoDiaMes)
      hasta.setDate(hasta.getDate() + diffFin)
      return {
        desde: formatearFechaISO(desde),
        hasta: formatearFechaISO(hasta),
      }
    }

    case 'semana': {
      const dia = fecha.getDay()
      const diffLunes = dia === 0 ? -6 : 1 - dia
      const lunes = new Date(fecha)
      lunes.setDate(fecha.getDate() + diffLunes)
      const domingo = new Date(lunes)
      domingo.setDate(lunes.getDate() + 6)
      return {
        desde: formatearFechaISO(lunes),
        hasta: formatearFechaISO(domingo),
      }
    }

    case 'dia':
      return {
        desde: formatearFechaISO(fecha),
        hasta: formatearFechaISO(fecha),
      }

    case 'agenda': {
      // Agenda muestra 30 días desde la fecha actual
      const hasta = new Date(fecha)
      hasta.setDate(hasta.getDate() + 30)
      return {
        desde: formatearFechaISO(fecha),
        hasta: formatearFechaISO(hasta),
      }
    }

    default:
      return { desde: formatearFechaISO(fecha), hasta: formatearFechaISO(fecha) }
  }
}

/** Formatea fecha como YYYY-MM-DD */
function formatearFechaISO(fecha: Date): string {
  const a = fecha.getFullYear()
  const m = String(fecha.getMonth() + 1).padStart(2, '0')
  const d = String(fecha.getDate()).padStart(2, '0')
  return `${a}-${m}-${d}`
}

export default function PaginaCalendario() {
  const router = useRouter()
  const { mostrar } = useToast()

  // Estado principal
  const [vistaActiva, setVistaActiva] = useState<VistaCalendario>('mes')
  const [fechaActual, setFechaActual] = useState<Date>(new Date())
  const [eventos, setEventos] = useState<EventoCalendario[]>([])
  const [tiposEvento, setTiposEvento] = useState<TipoEventoCalendario[]>([])
  const [cargando, setCargando] = useState(true)

  // Estado del modal
  const [modalAbierto, setModalAbierto] = useState(false)
  const [eventoEditando, setEventoEditando] = useState<EventoCalendario | null>(null)
  const [fechaPreseleccionada, setFechaPreseleccionada] = useState<Date | null>(null)

  // Ref para evitar doble-fetch en desarrollo (StrictMode)
  const fetchRef = useRef(false)

  // --- Carga de tipos de evento ---
  useEffect(() => {
    const cargarTipos = async () => {
      try {
        const res = await fetch('/api/calendario/config')
        if (res.ok) {
          const datos = await res.json()
          setTiposEvento(datos.tipos || [])
        }
      } catch {
        // Silenciar error — los tipos son opcionales
      }
    }
    cargarTipos()
  }, [])

  // --- Carga de eventos según vista y fecha ---
  const cargarEventos = useCallback(async () => {
    setCargando(true)
    try {
      const { desde, hasta } = obtenerRangoFechas(vistaActiva, fechaActual)
      const res = await fetch(`/api/calendario?desde=${desde}&hasta=${hasta}`)
      if (res.ok) {
        const datos = await res.json()
        setEventos(datos.eventos || datos || [])
      } else {
        setEventos([])
      }
    } catch {
      setEventos([])
    } finally {
      setCargando(false)
    }
  }, [vistaActiva, fechaActual])

  useEffect(() => {
    // Evitar doble-fetch en StrictMode
    if (fetchRef.current) {
      cargarEventos()
    }
    fetchRef.current = true
    cargarEventos()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargarEventos])

  // --- Navegación ---
  const navegar = useCallback((direccion: 'anterior' | 'siguiente' | 'hoy') => {
    if (direccion === 'hoy') {
      setFechaActual(new Date())
      return
    }

    setFechaActual((prev) => {
      const nueva = new Date(prev)
      const delta = direccion === 'siguiente' ? 1 : -1

      switch (vistaActiva) {
        case 'mes':
          nueva.setMonth(nueva.getMonth() + delta)
          break
        case 'semana':
          nueva.setDate(nueva.getDate() + 7 * delta)
          break
        case 'dia':
          nueva.setDate(nueva.getDate() + delta)
          break
        case 'agenda':
          nueva.setMonth(nueva.getMonth() + delta)
          break
      }

      return nueva
    })
  }, [vistaActiva])

  // --- Acciones del calendario ---
  const manejarClickDia = useCallback((fecha: Date) => {
    setEventoEditando(null)
    setFechaPreseleccionada(fecha)
    setModalAbierto(true)
  }, [])

  const manejarClickEvento = useCallback((evento: EventoCalendario) => {
    setEventoEditando(evento)
    setFechaPreseleccionada(null)
    setModalAbierto(true)
  }, [])

  const cerrarModal = useCallback(() => {
    setModalAbierto(false)
    setEventoEditando(null)
    setFechaPreseleccionada(null)
  }, [])

  // --- Guardar evento (crear o editar) ---
  const guardarEvento = useCallback(async (datos: Record<string, unknown>) => {
    const esEdicion = !!datos.id

    try {
      const url = esEdicion ? `/api/calendario/${datos.id}` : '/api/calendario'
      const metodo = esEdicion ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method: metodo,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Error al guardar evento')
      }

      mostrar('exito', esEdicion ? 'Evento actualizado' : 'Evento creado')
      // Recargar eventos
      await cargarEventos()
    } catch (err) {
      mostrar('error', err instanceof Error ? err.message : 'Error al guardar evento')
      throw err
    }
  }, [cargarEventos, mostrar])

  // --- Eliminar evento ---
  const eliminarEvento = useCallback(async () => {
    if (!eventoEditando) return

    try {
      const res = await fetch(`/api/calendario/${eventoEditando.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Error al eliminar evento')
      }

      mostrar('exito', 'Evento eliminado')
      await cargarEventos()
    } catch (err) {
      mostrar('error', err instanceof Error ? err.message : 'Error al eliminar evento')
      throw err
    }
  }, [eventoEditando, cargarEventos, mostrar])

  // --- Renderizado de vista activa ---
  const renderizarVista = () => {
    switch (vistaActiva) {
      case 'mes':
        return (
          <VistaCalendarioMes
            fechaActual={fechaActual}
            eventos={eventos}
            onClickDia={manejarClickDia}
            onClickEvento={manejarClickEvento}
          />
        )

      case 'semana':
        return (
          <VistaCalendarioSemana
            fechaActual={fechaActual}
            eventos={eventos}
            onClickHora={manejarClickDia}
            onClickEvento={manejarClickEvento}
          />
        )

      case 'dia':
        return (
          <VistaCalendarioDia
            fechaActual={fechaActual}
            eventos={eventos}
            onClickHora={manejarClickDia}
            onClickEvento={manejarClickEvento}
          />
        )

      case 'agenda':
        return (
          <VistaCalendarioAgenda
            fechaActual={fechaActual}
            eventos={eventos}
            onClickEvento={manejarClickEvento}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3 shrink-0 mb-4">
        <h1 className="text-xl font-bold text-texto-primario flex items-center gap-2">
          <span className="text-texto-terciario">
            <Calendar size={20} />
          </span>
          Calendario
        </h1>
        <div className="flex items-center gap-2">
          <Boton
            variante="fantasma"
            tamano="sm"
            soloIcono
            icono={<Settings2 size={16} />}
            onClick={() => router.push('/calendario/configuracion')}
            titulo="Configuración"
          />
          <Boton
            tamano="sm"
            icono={<Plus size={16} />}
            onClick={() => {
              setEventoEditando(null)
              setFechaPreseleccionada(new Date())
              setModalAbierto(true)
            }}
          >
            Evento
          </Boton>
        </div>
      </div>

      {/* Barra de herramientas */}
      <BarraHerramientasCalendario
        vistaActiva={vistaActiva}
        fechaActual={fechaActual}
        onCambiarVista={setVistaActiva}
        onNavegar={navegar}
      />

      {/* Vista activa */}
      <div className="flex-1 min-h-0">
        {renderizarVista()}
      </div>

      {/* Modal de evento */}
      <ModalEvento
        abierto={modalAbierto}
        evento={eventoEditando}
        tipos={tiposEvento}
        fechaPreseleccionada={fechaPreseleccionada}
        onGuardar={guardarEvento}
        onEliminar={eventoEditando ? eliminarEvento : undefined}
        onCerrar={cerrarModal}
      />
    </div>
  )
}
