'use client'

/**
 * ModalEvento — Modal para crear y editar eventos del calendario.
 * Usa ModalAdaptable para ser responsivo (modal en desktop, bottom sheet en movil).
 * Incluye: asignados (multi-select), vinculaciones (busqueda de contactos),
 * y recurrencia (SelectorRecurrencia compacto).
 * Se usa en: pagina principal del calendario.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Trash2, X, Search, UserPlus, Link2, Users } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { ModalAdaptable } from '@/componentes/ui/ModalAdaptable'
import { Input } from '@/componentes/ui/Input'
import { TextArea } from '@/componentes/ui/TextArea'
import { Select } from '@/componentes/ui/Select'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Boton } from '@/componentes/ui/Boton'
import { SelectorRecurrencia, type ConfigRecurrencia, RECURRENCIA_DEFAULT } from '@/componentes/ui/SelectorRecurrencia'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import type { EventoCalendario, TipoEventoCalendario } from './tipos'
import { DEBOUNCE_BUSQUEDA } from '@/lib/constantes/timeouts'

interface PropiedadesModalEvento {
  abierto: boolean
  /** null = modo crear, con datos = modo editar */
  evento: EventoCalendario | null
  tipos: TipoEventoCalendario[]
  /** Fecha preseleccionada al hacer clic en un dia vacio */
  fechaPreseleccionada: Date | null
  /** Fecha fin preseleccionada al arrastrar un rango horario (drag-to-select) */
  fechaFinPreseleccionada?: Date | null
  onGuardar: (datos: Record<string, unknown>) => Promise<void>
  onEliminar?: () => Promise<void>
  onCerrar: () => void
}

/** Tipo interno para miembros del equipo */
interface MiembroEquipo {
  usuario_id: string
  nombre: string
  apellido: string
}

/** Tipo interno para vinculos */
interface Vinculo {
  tipo: string
  id: string
  nombre: string
}

/** Opciones de visibilidad del evento */
const OPCIONES_VISIBILIDAD = [
  { valor: 'publica', etiqueta: 'Pública', descripcion: 'Tu equipo ve todos los detalles', color: '#4CAF50' },
  { valor: 'ocupado', etiqueta: 'Ocupado', descripcion: 'Los demás ven solo un bloque sin detalles', color: '#F0923A' },
  { valor: 'privada', etiqueta: 'Privada', descripcion: 'Solo vos y los asignados', color: '#90A4AE' },
]

/** Convierte Date a formato ISO fecha "YYYY-MM-DD" */
function fechaAISO(fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/** Convierte Date a formato hora "HH:mm" */
function fechaAHora(fecha: Date): string {
  return `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`
}

/** Redondea la hora actual al siguiente intervalo de 30 minutos */
function horaRedondeada(): Date {
  const ahora = new Date()
  const minutos = ahora.getMinutes()
  ahora.setMinutes(minutos < 30 ? 30 : 60, 0, 0)
  return ahora
}

/** Suma minutos a una fecha */
function sumarMinutos(fecha: Date, minutos: number): Date {
  return new Date(fecha.getTime() + minutos * 60000)
}

/* ─── Sub-componente: Chip removible ─── */

function ChipRemovible({
  etiqueta,
  onRemover,
  icono,
}: {
  etiqueta: string
  onRemover: () => void
  icono?: React.ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-superficie-elevada border border-borde-sutil text-texto-secundario">
      {icono}
      <span className="max-w-[120px] truncate">{etiqueta}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemover()
        }}
        className="ml-0.5 rounded-full p-0.5 hover:bg-superficie-app transition-colors cursor-pointer"
      >
        <X size={10} className="text-texto-terciario" />
      </button>
    </span>
  )
}

/* ─── Sub-componente: Selector de asignados ─── */

function SelectorAsignados({
  asignados,
  miembrosDisponibles,
  onAgregar,
  onRemover,
}: {
  asignados: { id: string; nombre: string }[]
  miembrosDisponibles: MiembroEquipo[]
  onAgregar: (miembro: MiembroEquipo) => void
  onRemover: (id: string) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const refContenedor = useRef<HTMLDivElement>(null)

  /** Miembros que aun no estan asignados */
  const disponibles = useMemo(
    () => miembrosDisponibles.filter((m) => !asignados.some((a) => a.id === m.usuario_id)),
    [miembrosDisponibles, asignados],
  )

  /* Cerrar dropdown al hacer clic fuera */
  useEffect(() => {
    if (!abierto) return
    const manejarClicFuera = (e: MouseEvent) => {
      if (refContenedor.current && !refContenedor.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', manejarClicFuera)
    return () => document.removeEventListener('mousedown', manejarClicFuera)
  }, [abierto])

  return (
    <div className="flex flex-col gap-1.5" ref={refContenedor}>
      <label className="text-xs font-medium text-texto-secundario flex items-center gap-1.5">
        <Users size={13} className="text-texto-terciario" />
        Asignados
      </label>

      {/* Chips de asignados actuales */}
      {asignados.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {asignados.map((a) => (
            <ChipRemovible
              key={a.id}
              etiqueta={a.nombre}
              onRemover={() => onRemover(a.id)}
            />
          ))}
        </div>
      )}

      {/* Boton para agregar + dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setAbierto(!abierto)}
          disabled={disponibles.length === 0}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-texto-terciario hover:text-texto-secundario hover:bg-superficie-elevada border border-dashed border-borde-sutil transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <UserPlus size={12} />
          {asignados.length === 0 ? 'Agregar asignado' : 'Agregar otro'}
        </button>

        <AnimatePresence>
          {abierto && disponibles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 top-full left-0 mt-1 w-56 max-h-40 overflow-y-auto rounded-lg border border-borde-sutil bg-superficie-tarjeta shadow-lg"
            >
              {disponibles.map((m) => (
                <button
                  key={m.usuario_id}
                  type="button"
                  onClick={() => {
                    onAgregar(m)
                    setAbierto(false)
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-texto-primario hover:bg-superficie-elevada transition-colors cursor-pointer"
                >
                  {m.nombre} {m.apellido}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ─── Sub-componente: Selector de vinculaciones ─── */

function SelectorVinculaciones({
  vinculos,
  onAgregar,
  onRemover,
}: {
  vinculos: Vinculo[]
  onAgregar: (vinculo: Vinculo) => void
  onRemover: (id: string) => void
}) {
  const [busqueda, setBusqueda] = useState('')
  const [resultados, setResultados] = useState<{ id: string; nombre: string }[]>([])
  const [buscando, setBuscando] = useState(false)
  const [mostrarBuscador, setMostrarBuscador] = useState(false)
  const refContenedor = useRef<HTMLDivElement>(null)
  const refTemporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Buscar contactos con debounce */
  useEffect(() => {
    if (busqueda.trim().length < 2) {
      setResultados([])
      return
    }

    if (refTemporizador.current) clearTimeout(refTemporizador.current)

    refTemporizador.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const resp = await fetch(`/api/contactos?busqueda=${encodeURIComponent(busqueda.trim())}&por_pagina=5`)
        if (resp.ok) {
          const datos = await resp.json()
          const contactos = datos.contactos || datos.data || datos || []
          setResultados(
            contactos
              .filter((c: Record<string, unknown>) => !vinculos.some((v) => v.id === c.id))
              .map((c: Record<string, unknown>) => ({
                id: c.id as string,
                nombre: [c.nombre, c.apellido].filter(Boolean).join(' ') || (c.empresa as string) || 'Sin nombre',
              })),
          )
        }
      } catch {
        /* silenciar errores de red */
      } finally {
        setBuscando(false)
      }
    }, DEBOUNCE_BUSQUEDA)

    return () => {
      if (refTemporizador.current) clearTimeout(refTemporizador.current)
    }
  }, [busqueda, vinculos])

  /* Cerrar al hacer clic fuera */
  useEffect(() => {
    if (!mostrarBuscador) return
    const manejarClicFuera = (e: MouseEvent) => {
      if (refContenedor.current && !refContenedor.current.contains(e.target as Node)) {
        setMostrarBuscador(false)
        setBusqueda('')
        setResultados([])
      }
    }
    document.addEventListener('mousedown', manejarClicFuera)
    return () => document.removeEventListener('mousedown', manejarClicFuera)
  }, [mostrarBuscador])

  return (
    <div className="flex flex-col gap-1.5" ref={refContenedor}>
      <label className="text-xs font-medium text-texto-secundario flex items-center gap-1.5">
        <Link2 size={13} className="text-texto-terciario" />
        Vinculaciones
      </label>

      {/* Chips de vinculos existentes */}
      {vinculos.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {vinculos.map((v) => (
            <ChipRemovible
              key={v.id}
              etiqueta={v.nombre}
              onRemover={() => onRemover(v.id)}
            />
          ))}
        </div>
      )}

      {/* Buscador de contactos */}
      <div className="relative">
        {!mostrarBuscador ? (
          <button
            type="button"
            onClick={() => setMostrarBuscador(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-texto-terciario hover:text-texto-secundario hover:bg-superficie-elevada border border-dashed border-borde-sutil transition-colors cursor-pointer"
          >
            <Search size={12} />
            Vincular contacto
          </button>
        ) : (
          <div className="flex items-center gap-1.5 border border-borde-sutil rounded-md px-2 py-1 bg-superficie-tarjeta">
            <Search size={12} className="text-texto-terciario shrink-0" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar contacto..."
              autoFocus
              className="flex-1 text-xs bg-transparent outline-none text-texto-primario placeholder:text-texto-terciario"
            />
            {buscando && (
              <span className="text-xxs text-texto-terciario animate-pulse">...</span>
            )}
          </div>
        )}

        {/* Resultados de busqueda */}
        <AnimatePresence>
          {resultados.length > 0 && mostrarBuscador && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute z-50 top-full left-0 mt-1 w-full max-h-36 overflow-y-auto rounded-lg border border-borde-sutil bg-superficie-tarjeta shadow-lg"
            >
              {resultados.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    onAgregar({ tipo: 'contacto', id: r.id, nombre: r.nombre })
                    setBusqueda('')
                    setResultados([])
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-texto-primario hover:bg-superficie-elevada transition-colors cursor-pointer"
                >
                  {r.nombre}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ─── Componente principal ─── */

function ModalEvento({
  abierto,
  evento,
  tipos,
  fechaPreseleccionada,
  fechaFinPreseleccionada,
  onGuardar,
  onEliminar,
  onCerrar,
}: PropiedadesModalEvento) {
  const esEdicion = !!evento

  // Estado del formulario — campos basicos
  const [titulo, setTitulo] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [fechaInicio, setFechaInicio] = useState<string | null>(null)
  const [horaInicio, setHoraInicio] = useState<string | null>(null)
  const [fechaFin, setFechaFin] = useState<string | null>(null)
  const [horaFin, setHoraFin] = useState<string | null>(null)
  const [todoElDia, setTodoElDia] = useState(false)
  const [visibilidad, setVisibilidad] = useState('publica')
  const [descripcion, setDescripcion] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [notas, setNotas] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  // Estado — asignados
  const [asignados, setAsignados] = useState<{ id: string; nombre: string }[]>([])
  const [miembrosDisponibles, setMiembrosDisponibles] = useState<MiembroEquipo[]>([])

  // Estado — vinculaciones
  const [vinculos, setVinculos] = useState<Vinculo[]>([])

  // Estado — recurrencia
  const [recurrencia, setRecurrencia] = useState<ConfigRecurrencia>(RECURRENCIA_DEFAULT)

  // Recordatorio
  const [recordatorio, setRecordatorio] = useState('15')

  /** Opciones de tipo formateadas para el Select */
  const opcionesTipo = useMemo(() =>
    tipos.filter(t => t.activo).map(t => ({
      valor: t.id,
      etiqueta: t.etiqueta,
    })),
    [tipos],
  )

  /** Tipo seleccionado actual */
  const tipoSeleccionado = useMemo(
    () => tipos.find(t => t.id === tipoId),
    [tipos, tipoId],
  )

  /* ── Cargar miembros del equipo al montar ── */
  useEffect(() => {
    const cargarMiembros = async () => {
      const supabase = crearClienteNavegador()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const empresaId = user.app_metadata?.empresa_activa_id
      if (!empresaId) return
      const { data } = await supabase
        .from('miembros')
        .select('usuario_id, perfiles!inner(nombre, apellido)')
        .eq('empresa_id', empresaId)
        .eq('activo', true)
      if (data) {
        setMiembrosDisponibles(
          data.map((m: Record<string, unknown>) => ({
            usuario_id: m.usuario_id as string,
            nombre: (m.perfiles as Record<string, unknown>).nombre as string,
            apellido: (m.perfiles as Record<string, unknown>).apellido as string,
          })),
        )
      }
    }
    cargarMiembros()
  }, [])

  // Inicializar formulario cuando se abre el modal
  useEffect(() => {
    if (!abierto) return

    if (evento) {
      // Modo edicion: cargar datos del evento
      setTitulo(evento.titulo)
      setTipoId(evento.tipo_id || '')
      setTodoElDia(evento.todo_el_dia)
      setVisibilidad(evento.visibilidad || 'publica')
      setDescripcion(evento.descripcion || '')
      setUbicacion(evento.ubicacion || '')
      setNotas(evento.notas || '')

      const fi = new Date(evento.fecha_inicio)
      const ff = new Date(evento.fecha_fin)
      setFechaInicio(fechaAISO(fi))
      setHoraInicio(evento.todo_el_dia ? null : fechaAHora(fi))
      setFechaFin(fechaAISO(ff))
      setHoraFin(evento.todo_el_dia ? null : fechaAHora(ff))

      // Inicializar asignados desde el evento
      setAsignados(evento.asignados || [])

      // Inicializar vinculos desde el evento
      setVinculos(evento.vinculos || [])

      // Inicializar recurrencia desde el evento
      setRecurrencia(
        evento.recurrencia
          ? (evento.recurrencia as ConfigRecurrencia)
          : RECURRENCIA_DEFAULT,
      )

      // Inicializar recordatorio (si existe en el evento)
      setRecordatorio((evento as unknown as Record<string, unknown>).recordatorio as string || '15')
    } else {
      // Modo crear: valores por defecto
      const inicio = fechaPreseleccionada ? new Date(fechaPreseleccionada) : horaRedondeada()
      // Si hay fecha fin preseleccionada (drag-to-select), usarla directamente;
      // si no, calcular a partir de la duración del tipo
      const fin = fechaFinPreseleccionada
        ? new Date(fechaFinPreseleccionada)
        : sumarMinutos(inicio, tipoSeleccionado?.duracion_default || 60)

      setTitulo('')
      setTipoId(tipos.find(t => t.activo)?.id || '')
      setTodoElDia(tipoSeleccionado?.todo_el_dia_default || false)
      setVisibilidad('publica')
      setDescripcion('')
      setUbicacion('')
      setNotas('')
      setFechaInicio(fechaAISO(inicio))
      setHoraInicio(fechaAHora(inicio.getHours() === 0 && inicio.getMinutes() === 0 ? horaRedondeada() : inicio))
      setFechaFin(fechaAISO(fin))
      setHoraFin(fechaAHora(fin))

      setAsignados([])
      setVinculos([])
      setRecurrencia(RECURRENCIA_DEFAULT)
      setRecordatorio('15')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, evento])

  // Cuando cambia el tipo, actualizar duracion y todo_el_dia
  useEffect(() => {
    if (!tipoSeleccionado || esEdicion) return
    setTodoElDia(tipoSeleccionado.todo_el_dia_default)

    // Recalcular hora fin basandose en la duracion del tipo
    if (fechaInicio && horaInicio) {
      const [h, m] = horaInicio.split(':').map(Number)
      const inicio = new Date(`${fechaInicio}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
      const fin = sumarMinutos(inicio, tipoSeleccionado.duracion_default)
      setFechaFin(fechaAISO(fin))
      setHoraFin(fechaAHora(fin))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoId])

  /* ── Handlers para asignados ── */
  const agregarAsignado = useCallback((miembro: MiembroEquipo) => {
    setAsignados((prev) => [
      ...prev,
      { id: miembro.usuario_id, nombre: `${miembro.nombre} ${miembro.apellido}`.trim() },
    ])
  }, [])

  const removerAsignado = useCallback((id: string) => {
    setAsignados((prev) => prev.filter((a) => a.id !== id))
  }, [])

  /* ── Handlers para vinculos ── */
  const agregarVinculo = useCallback((vinculo: Vinculo) => {
    setVinculos((prev) => [...prev, vinculo])
  }, [])

  const removerVinculo = useCallback((id: string) => {
    setVinculos((prev) => prev.filter((v) => v.id !== id))
  }, [])

  /** Manejar guardar */
  const manejarGuardar = useCallback(async () => {
    if (!titulo.trim() || !fechaInicio) return

    setGuardando(true)
    try {
      // Construir fecha/hora de inicio y fin completas
      const inicioISO = todoElDia
        ? `${fechaInicio}T00:00:00`
        : `${fechaInicio}T${horaInicio || '00:00'}:00`
      const finISO = todoElDia
        ? `${fechaFin || fechaInicio}T23:59:59`
        : `${fechaFin || fechaInicio}T${horaFin || '23:59'}:00`

      await onGuardar({
        ...(evento ? { id: evento.id } : {}),
        titulo: titulo.trim(),
        tipo_id: tipoId || null,
        fecha_inicio: inicioISO,
        fecha_fin: finISO,
        todo_el_dia: todoElDia,
        visibilidad,
        descripcion: descripcion.trim() || null,
        ubicacion: ubicacion.trim() || null,
        notas: notas.trim() || null,
        asignados,
        vinculos,
        vinculo_ids: vinculos.map((v) => v.id),
        recurrencia: recurrencia.frecuencia !== 'ninguno' ? recurrencia : null,
        recordatorio: recordatorio !== 'ninguno' ? Number(recordatorio) : null,
      })
      onCerrar()
    } finally {
      setGuardando(false)
    }
  }, [titulo, fechaInicio, fechaFin, horaInicio, horaFin, todoElDia, visibilidad, descripcion, ubicacion, notas, tipoId, evento, onGuardar, onCerrar, asignados, vinculos, recurrencia, recordatorio])

  /** Manejar eliminar */
  const manejarEliminar = useCallback(async () => {
    if (!onEliminar) return
    setEliminando(true)
    try {
      await onEliminar()
      onCerrar()
    } finally {
      setEliminando(false)
    }
  }, [onEliminar, onCerrar])

  /** Botones del footer del modal */
  const acciones = (
    <div className="flex items-center justify-between w-full gap-3">
      {/* Boton eliminar (solo en edicion) */}
      <div>
        {esEdicion && onEliminar && (
          <Boton
            variante="peligro"
            tamano="sm"
            icono={<Trash2 size={14} />}
            onClick={manejarEliminar}
            cargando={eliminando}
            disabled={guardando}
          >
            Eliminar
          </Boton>
        )}
      </div>

      {/* Botones cancelar y guardar */}
      <div className="flex items-center gap-2">
        <Boton
          variante="fantasma"
          tamano="sm"
          onClick={onCerrar}
          disabled={guardando || eliminando}
        >
          Cancelar
        </Boton>
        <Boton
          tamano="sm"
          onClick={manejarGuardar}
          cargando={guardando}
          disabled={!titulo.trim() || !fechaInicio || eliminando}
        >
          {esEdicion ? 'Guardar cambios' : 'Crear evento'}
        </Boton>
      </div>
    </div>
  )

  return (
    <ModalAdaptable
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={esEdicion ? 'Editar evento' : 'Nuevo evento'}
      tamano="5xl"
      sinPadding
      acciones={acciones}
      alturaMovil="completo"
    >
      {/* ══ Grid 2 columnas con divisor 1px ══ */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1px_1fr] gap-0 border-y border-white/[0.07]">

        {/* ── COL IZQUIERDA — datos del evento ── */}
        <div className="p-6 space-y-4">
          {/* Titulo */}
          <div>
            <p className="text-[11px] text-texto-terciario mb-1.5">Título</p>
            <Input placeholder="Nombre del evento..." value={titulo}
              onChange={(e) => setTitulo(e.target.value)} autoFocus formato={null} />
          </div>

          <div className="border-t border-white/[0.07]" />

          {/* Fechas y horas */}
          <div>
            <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">Fecha y hora</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] text-texto-terciario w-8 shrink-0">Inicio</span>
                <div className="flex-1">
                  <SelectorFecha valor={fechaInicio} onChange={setFechaInicio} />
                </div>
                {!todoElDia && (
                  <div className="w-28 shrink-0">
                    <SelectorHora valor={horaInicio} onChange={setHoraInicio} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] text-texto-terciario w-8 shrink-0">Fin</span>
                <div className="flex-1">
                  <SelectorFecha valor={fechaFin} onChange={setFechaFin} />
                </div>
                {!todoElDia && (
                  <div className="w-28 shrink-0">
                    <SelectorHora valor={horaFin} onChange={setHoraFin} />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <Interruptor activo={todoElDia} onChange={setTodoElDia} etiqueta="Todo el día" />
              <div className="w-px h-4 bg-white/[0.07]" />
              <div className="flex-1">
                <SelectorRecurrencia valor={recurrencia} onChange={setRecurrencia}
                  fechaReferencia={fechaInicio} compacto />
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.07]" />

          {/* Descripcion */}
          <div>
            <p className="text-[11px] text-texto-terciario mb-1.5">Descripción</p>
            <TextArea placeholder="Descripción del evento (opcional)" value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)} rows={3} />
          </div>

          {/* Ubicacion */}
          <div>
            <p className="text-[11px] text-texto-terciario mb-1.5">Ubicación</p>
            <Input placeholder="Lugar del evento (opcional)" value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)} formato={null} />
          </div>

          {/* Notas */}
          <div>
            <p className="text-[11px] text-texto-terciario mb-1.5">Notas internas</p>
            <TextArea placeholder="Notas privadas (opcional)" value={notas}
              onChange={(e) => setNotas(e.target.value)} rows={2} />
          </div>
        </div>

        {/* Divisor vertical */}
        <div className="hidden md:block bg-white/[0.07]" />

        {/* ── COL DERECHA — config y relaciones ── */}
        <div className="p-6 space-y-4">
          {/* Tipo de evento */}
          {opcionesTipo.length > 0 && (
            <div>
              <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">Tipo de evento</p>
              <Select opciones={opcionesTipo} valor={tipoId} onChange={setTipoId}
                placeholder="Seleccionar tipo..." />
            </div>
          )}

          <div className="border-t border-white/[0.07]" />

          {/* Visibilidad con dots de color */}
          <div>
            <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">Visibilidad</p>
            <div className="flex flex-col gap-1.5">
              {OPCIONES_VISIBILIDAD.map(op => (
                <button key={op.valor} type="button" onClick={() => setVisibilidad(op.valor)}
                  className={`flex items-center gap-2.5 text-left px-3 py-2 rounded-lg border transition-all cursor-pointer ${
                    visibilidad === op.valor
                      ? 'border-texto-marca/40 bg-texto-marca/8'
                      : 'border-white/[0.06] hover:border-white/[0.12] bg-white/[0.02]'
                  }`}>
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: op.color }} />
                  <div>
                    <span className={`text-xs font-medium block ${visibilidad === op.valor ? 'text-texto-marca' : 'text-texto-primario'}`}>
                      {op.etiqueta}
                    </span>
                    <span className="text-[10px] text-texto-terciario leading-tight">{op.descripcion}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-white/[0.07]" />

          {/* Asignados */}
          <div>
            <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">Asignados</p>
            <SelectorAsignados asignados={asignados} miembrosDisponibles={miembrosDisponibles}
              onAgregar={agregarAsignado} onRemover={removerAsignado} />
          </div>

          {/* Vinculaciones */}
          <div>
            <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">Vincular contacto</p>
            <SelectorVinculaciones vinculos={vinculos} onAgregar={agregarVinculo} onRemover={removerVinculo} />
          </div>

          {/* Recordatorio */}
          <div>
            <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider mb-2.5">Recordatorio</p>
            <Select opciones={[
              { valor: 'ninguno', etiqueta: 'Sin recordatorio' },
              { valor: '5', etiqueta: '5 minutos antes' },
              { valor: '15', etiqueta: '15 minutos antes' },
              { valor: '30', etiqueta: '30 minutos antes' },
              { valor: '60', etiqueta: '1 hora antes' },
              { valor: '1440', etiqueta: '1 día antes' },
            ]} valor={recordatorio} onChange={setRecordatorio} />
          </div>
        </div>
      </div>
    </ModalAdaptable>
  )
}

export { ModalEvento }
