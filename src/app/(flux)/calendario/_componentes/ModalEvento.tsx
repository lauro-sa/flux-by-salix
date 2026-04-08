'use client'

/**
 * ModalEvento — Modal para crear y editar eventos del calendario.
 * Usa ModalAdaptable para ser responsivo (modal en desktop, bottom sheet en móvil).
 * Se usa en: página principal del calendario.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { ModalAdaptable } from '@/componentes/ui/ModalAdaptable'
import { Input } from '@/componentes/ui/Input'
import { TextArea } from '@/componentes/ui/TextArea'
import { Select } from '@/componentes/ui/Select'
import { SelectorFecha } from '@/componentes/ui/SelectorFecha'
import { SelectorHora } from '@/componentes/ui/SelectorHora'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Boton } from '@/componentes/ui/Boton'
import type { EventoCalendario, TipoEventoCalendario } from './tipos'

interface PropiedadesModalEvento {
  abierto: boolean
  /** null = modo crear, con datos = modo editar */
  evento: EventoCalendario | null
  tipos: TipoEventoCalendario[]
  /** Fecha preseleccionada al hacer clic en un día vacío */
  fechaPreseleccionada: Date | null
  onGuardar: (datos: Record<string, unknown>) => Promise<void>
  onEliminar?: () => Promise<void>
  onCerrar: () => void
}

/** Opciones de visibilidad del evento */
const OPCIONES_VISIBILIDAD = [
  { valor: 'publica', etiqueta: 'Pública' },
  { valor: 'ocupado', etiqueta: 'Ocupado' },
  { valor: 'privada', etiqueta: 'Privada' },
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

function ModalEvento({
  abierto,
  evento,
  tipos,
  fechaPreseleccionada,
  onGuardar,
  onEliminar,
  onCerrar,
}: PropiedadesModalEvento) {
  const esEdicion = !!evento

  // Estado del formulario
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

  // Inicializar formulario cuando se abre el modal
  useEffect(() => {
    if (!abierto) return

    if (evento) {
      // Modo edición: cargar datos del evento
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
    } else {
      // Modo crear: valores por defecto
      const inicio = fechaPreseleccionada ? new Date(fechaPreseleccionada) : horaRedondeada()
      const duracion = tipoSeleccionado?.duracion_default || 60
      const fin = sumarMinutos(inicio, duracion)

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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, evento])

  // Cuando cambia el tipo, actualizar duración y todo_el_dia
  useEffect(() => {
    if (!tipoSeleccionado || esEdicion) return
    setTodoElDia(tipoSeleccionado.todo_el_dia_default)

    // Recalcular hora fin basándose en la duración del tipo
    if (fechaInicio && horaInicio) {
      const [h, m] = horaInicio.split(':').map(Number)
      const inicio = new Date(`${fechaInicio}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`)
      const fin = sumarMinutos(inicio, tipoSeleccionado.duracion_default)
      setFechaFin(fechaAISO(fin))
      setHoraFin(fechaAHora(fin))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoId])

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
      })
      onCerrar()
    } finally {
      setGuardando(false)
    }
  }, [titulo, fechaInicio, fechaFin, horaInicio, horaFin, todoElDia, visibilidad, descripcion, ubicacion, notas, tipoId, evento, onGuardar, onCerrar])

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
      {/* Botón eliminar (solo en edición) */}
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
      tamano="lg"
      acciones={acciones}
      alturaMovil="completo"
    >
      <div className="flex flex-col gap-4">
        {/* Título */}
        <Input
          etiqueta="Título"
          placeholder="Nombre del evento"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          autoFocus
          formato={null}
        />

        {/* Tipo de evento */}
        {opcionesTipo.length > 0 && (
          <Select
            etiqueta="Tipo de evento"
            opciones={opcionesTipo}
            valor={tipoId}
            onChange={setTipoId}
            placeholder="Seleccionar tipo..."
          />
        )}

        {/* Fechas y horas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SelectorFecha
            etiqueta="Fecha inicio"
            valor={fechaInicio}
            onChange={setFechaInicio}
          />
          {!todoElDia && (
            <SelectorHora
              etiqueta="Hora inicio"
              valor={horaInicio}
              onChange={setHoraInicio}
            />
          )}
          <SelectorFecha
            etiqueta="Fecha fin"
            valor={fechaFin}
            onChange={setFechaFin}
          />
          {!todoElDia && (
            <SelectorHora
              etiqueta="Hora fin"
              valor={horaFin}
              onChange={setHoraFin}
            />
          )}
        </div>

        {/* Todo el día */}
        <Interruptor
          activo={todoElDia}
          onChange={setTodoElDia}
          etiqueta="Todo el día"
        />

        {/* Visibilidad */}
        <Select
          etiqueta="Visibilidad"
          opciones={OPCIONES_VISIBILIDAD}
          valor={visibilidad}
          onChange={setVisibilidad}
        />

        {/* Descripción */}
        <TextArea
          etiqueta="Descripción"
          placeholder="Descripción del evento (opcional)"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          rows={3}
        />

        {/* Ubicación */}
        <Input
          etiqueta="Ubicación"
          placeholder="Lugar del evento (opcional)"
          value={ubicacion}
          onChange={(e) => setUbicacion(e.target.value)}
          formato={null}
        />

        {/* Notas */}
        <TextArea
          etiqueta="Notas"
          placeholder="Notas internas (opcional)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          rows={2}
        />
      </div>
    </ModalAdaptable>
  )
}

export { ModalEvento }
