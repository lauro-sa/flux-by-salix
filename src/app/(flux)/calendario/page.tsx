'use client'

/**
 * PaginaCalendario — Página principal del módulo Calendario.
 * Muestra una vista de calendario con barra de herramientas, navegación por fechas,
 * y vistas intercambiables (mes, semana, día, agenda).
 * Se usa como: /calendario
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Calendar, PlusCircle } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { PlantillaListado } from '@/componentes/entidad/PlantillaListado'
import { BarraHerramientasCalendario } from './_componentes/BarraHerramientasCalendario'
import { VistaCalendarioMes } from './_componentes/VistaCalendarioMes'
import { VistaCalendarioSemana } from './_componentes/VistaCalendarioSemana'
import { VistaCalendarioDia } from './_componentes/VistaCalendarioDia'
import { VistaCalendarioAgenda } from './_componentes/VistaCalendarioAgenda'
import { VistaCalendarioAnio } from './_componentes/VistaCalendarioAnio'
import { VistaCalendarioEquipo } from './_componentes/VistaCalendarioEquipo'
import { VistaCalendarioQuincenal } from './_componentes/VistaCalendarioQuincenal'
import { MiniCalendario } from './_componentes/MiniCalendario'
import { ModalEvento } from './_componentes/ModalEvento'
import { PopoverEvento } from './_componentes/PopoverEvento'
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

    case 'quincenal': {
      // 14 dias desde el lunes de la semana actual
      const diaQ = fecha.getDay()
      const diffLunesQ = diaQ === 0 ? -6 : 1 - diaQ
      const lunesQ = new Date(fecha)
      lunesQ.setDate(fecha.getDate() + diffLunesQ)
      const finQ = new Date(lunesQ)
      finQ.setDate(lunesQ.getDate() + 13)
      return {
        desde: formatearFechaISO(lunesQ),
        hasta: formatearFechaISO(finQ),
      }
    }

    case 'dia':
    case 'equipo':
      return {
        desde: formatearFechaISO(fecha),
        hasta: formatearFechaISO(fecha),
      }

    case 'anio': {
      return {
        desde: `${anio}-01-01`,
        hasta: `${anio}-12-31`,
      }
    }

    case 'agenda': {
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
  const searchParams = useSearchParams()
  const { mostrar } = useToast()

  // Estado principal — vista inicial desde localStorage del usuario o 'mes' por defecto
  const [vistaActiva, setVistaActivaInterno] = useState<VistaCalendario>(() => {
    if (typeof window === 'undefined') return 'mes'
    const guardada = localStorage.getItem('flux_calendario_vista_usuario')
    return (guardada as VistaCalendario) || 'mes'
  })

  // Wrapper que guarda la vista elegida en localStorage
  const setVistaActiva = useCallback((vista: VistaCalendario) => {
    setVistaActivaInterno(vista)
    localStorage.setItem('flux_calendario_vista_usuario', vista)
  }, [])
  const [fechaActual, setFechaActual] = useState<Date>(new Date())
  const [eventos, setEventos] = useState<EventoCalendario[]>([])
  const [tiposEvento, setTiposEvento] = useState<TipoEventoCalendario[]>([])
  const [cargando, setCargando] = useState(true)

  // Estado del modal
  const [modalAbierto, setModalAbierto] = useState(false)
  const [eventoEditando, setEventoEditando] = useState<EventoCalendario | null>(null)
  const [fechaPreseleccionada, setFechaPreseleccionada] = useState<Date | null>(null)
  const [fechaFinPreseleccionada, setFechaFinPreseleccionada] = useState<Date | null>(null)

  // Abrir modal de creación si viene ?crear=true desde el dashboard
  const vieneDeDashboardRef = useRef(false)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('crear') === 'true') {
      window.history.replaceState({}, '', '/calendario')
      vieneDeDashboardRef.current = true
      setEventoEditando(null)
      setModalAbierto(true)
    }
  }, [])

  // Estado del popover de evento
  const [popoverEvento, setPopoverEvento] = useState<EventoCalendario | null>(null)
  const [popoverPosicion, setPopoverPosicion] = useState<{ x: number; y: number } | null>(null)

  // Estado de filtros
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroVista, setFiltroVista] = useState('todos')
  const [usuarioActualId, setUsuarioActualId] = useState<string | null>(null)

  // Estado de horario laboral desde configuración de empresa
  const [horaInicioLaboral, setHoraInicioLaboral] = useState<number>(8)
  const [horaFinLaboral, setHoraFinLaboral] = useState<number>(18)

  // --- Carga de config (tipos + vista default) y usuario actual ---
  useEffect(() => {
    const cargarConfig = async () => {
      try {
        const res = await fetch('/api/calendario/config')
        if (res.ok) {
          const datos = await res.json()
          setTiposEvento(datos.tipos || [])
          // Leer horario laboral desde config
          if (datos.config?.hora_inicio_laboral) {
            const [h] = datos.config.hora_inicio_laboral.split(':').map(Number)
            setHoraInicioLaboral(h)
          }
          if (datos.config?.hora_fin_laboral) {
            const [h] = datos.config.hora_fin_laboral.split(':').map(Number)
            setHoraFinLaboral(h)
          }
          // Solo aplicar vista de empresa si el usuario no tiene preferencia guardada
          const vistaUsuario = localStorage.getItem('flux_calendario_vista_usuario')
          if (!vistaUsuario && datos.config?.vista_default) {
            setVistaActiva(datos.config.vista_default as VistaCalendario)
          }
        }
      } catch {
        // Silenciar error — los tipos son opcionales
      }
    }
    cargarConfig()

    // Obtener ID del usuario actual para el filtro "Mis eventos"
    const cargarUsuario = async () => {
      try {
        const res = await fetch('/api/auth/yo')
        if (res.ok) {
          const datos = await res.json()
          setUsuarioActualId(datos.id || datos.usuario_id || null)
        }
      } catch {
        // Silenciar — filtro "Mis eventos" no funcionará sin ID
      }
    }
    cargarUsuario()
  }, [])

  // --- Abrir evento desde ?evento_id= (recientes del dashboard) ---
  const eventoIdParam = searchParams.get('evento_id')
  const eventoYaAbiertoRef = useRef<string | null>(null)
  useEffect(() => {
    if (!eventoIdParam || eventoIdParam === eventoYaAbiertoRef.current) return
    eventoYaAbiertoRef.current = eventoIdParam
    fetch(`/api/calendario/${eventoIdParam}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setEventoEditando(data)
          setModalAbierto(true)
        }
      })
      .catch(() => {})
    router.replace('/calendario', { scroll: false })
  }, [eventoIdParam, router])

  // --- Carga de eventos según vista y fecha ---
  const cargarEventos = useCallback(async () => {
    setCargando(true)
    try {
      const { desde, hasta } = obtenerRangoFechas(vistaActiva, fechaActual)

      // Cargar eventos y feriados en paralelo
      const [eventosRes, feriadosRes] = await Promise.all([
        fetch(`/api/calendario?desde=${desde}&hasta=${hasta}`),
        fetch(`/api/calendario/feriados?anio=${new Date(desde).getFullYear()}`),
      ])

      let eventosData: EventoCalendario[] = []
      if (eventosRes.ok) {
        const datos = await eventosRes.json()
        eventosData = datos.eventos || datos || []
      }

      // Inyectar feriados como eventos todo_el_dia
      if (feriadosRes.ok) {
        const feriadosData = await feriadosRes.json()
        const feriadosComoEventos: EventoCalendario[] = (feriadosData.feriados || []).map((f: { id: string; nombre: string; fecha: string; tipo: string }) => ({
          id: `feriado-${f.id}`,
          titulo: f.nombre,
          descripcion: null,
          ubicacion: null,
          tipo_id: null,
          tipo_clave: 'feriado',
          color: 'var(--insignia-advertencia)',
          fecha_inicio: `${f.fecha}T00:00:00`,
          fecha_fin: `${f.fecha}T23:59:59`,
          todo_el_dia: true,
          recurrencia: null,
          visibilidad: 'publica',
          asignados: [],
          asignado_ids: [],
          vinculos: [],
          vinculo_ids: [],
          actividad_id: null,
          estado: 'confirmado',
          notas: f.tipo,
          creado_por: '',
          creado_por_nombre: null,
          creado_en: '',
          _es_feriado: true,
        }))
        eventosData = [...feriadosComoEventos, ...eventosData]
      }

      setEventos(eventosData)
    } catch {
      setEventos([])
    } finally {
      setCargando(false)
    }
  }, [vistaActiva, fechaActual])

  useEffect(() => {
    cargarEventos()
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
        case 'quincenal':
          nueva.setDate(nueva.getDate() + 14 * delta)
          break
        case 'dia':
          nueva.setDate(nueva.getDate() + delta)
          break
        case 'anio':
          nueva.setFullYear(nueva.getFullYear() + delta)
          break
        case 'agenda':
          nueva.setMonth(nueva.getMonth() + delta)
          break
        case 'equipo':
          nueva.setDate(nueva.getDate() + delta)
          break
      }

      return nueva
    })
  }, [vistaActiva])

  // --- Filtrado de eventos ---
  const eventosFiltrados = useMemo(() => {
    let filtrados = eventos

    // Filtrar por tipo de evento
    if (filtroTipo) {
      filtrados = filtrados.filter((e) => e.tipo_clave === filtroTipo)
    }

    // Filtrar por "mis eventos" (donde el usuario actual está asignado o es creador)
    if (filtroVista === 'mios' && usuarioActualId) {
      filtrados = filtrados.filter(
        (e) =>
          e.creado_por === usuarioActualId ||
          e.asignado_ids.includes(usuarioActualId),
      )
    }

    return filtrados
  }, [eventos, filtroTipo, filtroVista, usuarioActualId])

  // --- Acciones del calendario ---
  const manejarClickDia = useCallback((fecha: Date, fechaFin?: Date) => {
    // Cerrar popover si está abierto
    setPopoverEvento(null)
    setPopoverPosicion(null)
    setEventoEditando(null)
    setFechaPreseleccionada(fecha)
    setFechaFinPreseleccionada(fechaFin || null)
    setModalAbierto(true)
  }, [])

  /** Muestra el popover de resumen al hacer clic en un evento */
  const manejarClickEvento = useCallback((evento: EventoCalendario, posicion?: { x: number; y: number }) => {
    if (posicion) {
      // Mostrar popover primero
      setPopoverEvento(evento)
      setPopoverPosicion(posicion)
    } else {
      // Sin posición (fallback): abrir modal directamente
      setEventoEditando(evento)
      setFechaPreseleccionada(null)
      setModalAbierto(true)
    }
  }, [])

  /** Cierra el popover de evento */
  const cerrarPopover = useCallback(() => {
    setPopoverEvento(null)
    setPopoverPosicion(null)
  }, [])

  /** Abre el modal de edición desde el popover */
  const editarDesdePopover = useCallback(() => {
    if (popoverEvento) {
      setEventoEditando(popoverEvento)
      setFechaPreseleccionada(null)
      setModalAbierto(true)
    }
    cerrarPopover()
  }, [popoverEvento, cerrarPopover])

  /** Elimina el evento mostrado en el popover */
  const eliminarDesdePopover = useCallback(async () => {
    if (!popoverEvento) return
    try {
      const res = await fetch(`/api/calendario/${popoverEvento.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Error al eliminar evento')
      }
      mostrar('exito', 'Evento eliminado')
      cerrarPopover()
      await cargarEventos()
    } catch (err) {
      mostrar('error', err instanceof Error ? err.message : 'Error al eliminar evento')
    }
  }, [popoverEvento, cerrarPopover, cargarEventos, mostrar])

  const cerrarModal = useCallback(() => {
    setModalAbierto(false)
    setEventoEditando(null)
    setFechaPreseleccionada(null)
    setFechaFinPreseleccionada(null)
    if (vieneDeDashboardRef.current) { vieneDeDashboardRef.current = false; router.push('/dashboard') }
  }, [router])

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

  // --- Mover evento por drag-and-drop ---
  const moverEvento = useCallback(async (id: string, nuevaInicio: string, nuevaFin: string) => {
    // Actualización optimista: aplicar cambio inmediatamente en la UI
    setEventos(prev => prev.map(e =>
      e.id === id ? { ...e, fecha_inicio: nuevaInicio, fecha_fin: nuevaFin } : e
    ))

    try {
      const res = await fetch(`/api/calendario/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accion: 'mover',
          fecha_inicio: nuevaInicio,
          fecha_fin: nuevaFin,
        }),
      })

      if (!res.ok) {
        // Revertir en caso de error del servidor
        await cargarEventos()
        mostrar('error', 'Error al mover evento')
      }
    } catch {
      // Recargar en caso de error de red
      await cargarEventos()
      mostrar('error', 'Error al mover evento')
    }
  }, [cargarEventos, mostrar])

  // --- Swipe para navegar en móvil ---
  const refSwipe = useRef<{ startX: number; startY: number } | null>(null)

  const manejarTouchStartSwipe = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    refSwipe.current = { startX: touch.clientX, startY: touch.clientY }
  }, [])

  const manejarTouchEndSwipe = useCallback((e: React.TouchEvent) => {
    if (!refSwipe.current) return
    const touch = e.changedTouches[0]
    const deltaX = touch.clientX - refSwipe.current.startX
    const deltaY = touch.clientY - refSwipe.current.startY
    refSwipe.current = null

    // Solo activar swipe si el movimiento horizontal es mayor que el vertical
    // y mayor que un umbral mínimo (70px)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 70) {
      navegar(deltaX > 0 ? 'anterior' : 'siguiente')
    }
  }, [navegar])

  // --- Renderizado de vista activa ---
  const renderizarVista = () => {
    switch (vistaActiva) {
      case 'mes':
        return (
          <VistaCalendarioMes
            fechaActual={fechaActual}
            eventos={eventosFiltrados}
            onClickDia={manejarClickDia}
            onClickEvento={manejarClickEvento}
          />
        )

      case 'semana':
        return (
          <VistaCalendarioSemana
            fechaActual={fechaActual}
            eventos={eventosFiltrados}
            onClickHora={manejarClickDia}
            onClickEvento={manejarClickEvento}
            onMoverEvento={moverEvento}
            horaInicioLaboral={horaInicioLaboral}
            horaFinLaboral={horaFinLaboral}
          />
        )

      case 'quincenal':
        return (
          <VistaCalendarioQuincenal
            fechaActual={fechaActual}
            eventos={eventosFiltrados}
            onClickHora={manejarClickDia}
            onClickEvento={manejarClickEvento}
            onMoverEvento={moverEvento}
            horaInicioLaboral={horaInicioLaboral}
            horaFinLaboral={horaFinLaboral}
          />
        )

      case 'dia':
        return (
          <VistaCalendarioDia
            fechaActual={fechaActual}
            eventos={eventosFiltrados}
            onClickHora={manejarClickDia}
            onClickEvento={manejarClickEvento}
            onMoverEvento={moverEvento}
            horaInicioLaboral={horaInicioLaboral}
            horaFinLaboral={horaFinLaboral}
          />
        )

      case 'anio':
        return (
          <VistaCalendarioAnio
            fechaActual={fechaActual}
            eventos={eventosFiltrados}
            onClickDia={manejarClickDia}
            onClickEvento={manejarClickEvento}
          />
        )

      case 'agenda':
        return (
          <VistaCalendarioAgenda
            fechaActual={fechaActual}
            eventos={eventosFiltrados}
            onClickEvento={manejarClickEvento}
          />
        )

      case 'equipo':
        return (
          <VistaCalendarioEquipo
            fechaActual={fechaActual}
            eventos={eventosFiltrados}
            miembros={[]}
            onClickHora={manejarClickDia}
            onClickEvento={manejarClickEvento}
            horaInicioLaboral={horaInicioLaboral}
            horaFinLaboral={horaFinLaboral}
          />
        )

      default:
        return null
    }
  }

  return (
    <PlantillaListado
      titulo="Calendario"
      icono={<Calendar size={20} />}
      accionPrincipal={{
        etiqueta: 'Nuevo evento',
        icono: <PlusCircle size={14} />,
        onClick: () => {
          setEventoEditando(null)
          setFechaPreseleccionada(new Date())
          setModalAbierto(true)
        },
      }}
      mostrarConfiguracion
      onConfiguracion={() => router.push('/calendario/configuracion')}
    >
      {/* Wrapper con márgenes laterales para la barra y contenido */}
      <div className="flex flex-col h-full px-2 sm:px-6">

      {/* Barra de herramientas */}
      <BarraHerramientasCalendario
        vistaActiva={vistaActiva}
        fechaActual={fechaActual}
        onCambiarVista={setVistaActiva}
        onNavegar={navegar}
        tipos={tiposEvento.filter((t) => t.activo).map((t) => ({
          id: t.id,
          clave: t.clave,
          etiqueta: t.etiqueta,
          color: t.color,
        }))}
        filtroTipo={filtroTipo}
        onCambiarFiltroTipo={setFiltroTipo}
        filtroVista={filtroVista}
        onCambiarFiltroVista={setFiltroVista}
      />

      {/* Vista activa — contenedor relativo para el mini calendario flotante + swipe navigation */}
      <div
        className="flex-1 min-h-0 -mx-2 sm:-mx-6 relative"
        onTouchStart={manejarTouchStartSwipe}
        onTouchEnd={manejarTouchEndSwipe}
      >
        {renderizarVista()}

        {/* Mini calendario flotante (solo en vistas que no son mes/agenda) */}
        {(['dia', 'semana', 'quincenal', 'equipo'] as VistaCalendario[]).includes(vistaActiva) && (
          <MiniCalendario
            fechaActual={fechaActual}
            onSeleccionarDia={(fecha) => setFechaActual(fecha)}
            eventos={eventos}
            vistaActiva={vistaActiva}
          />
        )}
      </div>

      </div>{/* cierre wrapper con márgenes */}

      {/* Popover de resumen del evento */}
      <PopoverEvento
        evento={popoverEvento}
        posicion={popoverPosicion}
        onEditar={editarDesdePopover}
        onEliminar={eliminarDesdePopover}
        onCerrar={cerrarPopover}
      />

      {/* Modal de evento */}
      <ModalEvento
        abierto={modalAbierto}
        evento={eventoEditando}
        tipos={tiposEvento}
        fechaPreseleccionada={fechaPreseleccionada}
        fechaFinPreseleccionada={fechaFinPreseleccionada}
        onGuardar={guardarEvento}
        onEliminar={eventoEditando ? eliminarEvento : undefined}
        onCerrar={cerrarModal}
      />
    </PlantillaListado>
  )
}
