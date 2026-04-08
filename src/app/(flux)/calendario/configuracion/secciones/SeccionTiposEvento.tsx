'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  Plus, Pencil, GripVertical, RotateCcw, Trash2, Check, Pipette,
} from 'lucide-react'
import { obtenerIcono, SelectorIcono } from '@/componentes/ui/SelectorIcono'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Boton } from '@/componentes/ui/Boton'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Input } from '@/componentes/ui/Input'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import { PALETA_COLORES_TIPO_ACTIVIDAD, COLOR_MARCA_DEFECTO } from '@/lib/colores_entidad'

/**
 * SeccionTiposEvento — Lista de tipos de evento del calendario con drag-and-drop, toggle, editar.
 * Muestra icono con fondo de color, nombre, badge de duración, toggle activo y botón editar.
 */

export interface TipoEventoCalendario {
  id: string
  clave: string
  etiqueta: string
  icono: string
  color: string
  duracion_default: number
  todo_el_dia_default: boolean
  orden: number
  activo: boolean
  es_predefinido: boolean
}

interface PropiedadesSeccionTipos {
  tipos: TipoEventoCalendario[]
  cargando: boolean
  onActualizar: (tipos: TipoEventoCalendario[]) => void
  onAccionAPI: (accion: string, datos: Record<string, unknown>) => Promise<unknown>
}

// Colores predefinidos (reutilizamos la paleta de tipos de actividad)
const COLORES_TIPO = PALETA_COLORES_TIPO_ACTIVIDAD

function SeccionTiposEvento({ tipos, cargando, onActualizar, onAccionAPI }: PropiedadesSeccionTipos) {
  const [orden, setOrden] = useState<TipoEventoCalendario[]>(tipos)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [tipoEditando, setTipoEditando] = useState<TipoEventoCalendario | null>(null)
  const [confirmarRestablecer, setConfirmarRestablecer] = useState(false)
  const [guardando, setGuardando] = useState(false)

  // Sincronizar orden local con props
  useEffect(() => { setOrden(tipos) }, [tipos])

  // Toggle activo/inactivo
  const toggleActivo = useCallback(async (tipo: TipoEventoCalendario) => {
    const nuevoEstado = !tipo.activo
    // Actualización optimista
    const nuevos = orden.map(t => t.id === tipo.id ? { ...t, activo: nuevoEstado } : t)
    onActualizar(nuevos)
    await onAccionAPI('editar_tipo_evento', { id: tipo.id, activo: nuevoEstado })
  }, [orden, onActualizar, onAccionAPI])

  // Reordenar con drag-and-drop
  const manejarReorden = useCallback(async (nuevosItems: TipoEventoCalendario[]) => {
    setOrden(nuevosItems)
    onActualizar(nuevosItems)
    await onAccionAPI('reordenar_tipos_evento', { orden: nuevosItems.map(t => t.id) })
  }, [onActualizar, onAccionAPI])

  // Crear tipo nuevo
  const crearTipo = useCallback(async (datos: Record<string, unknown>) => {
    setGuardando(true)
    try {
      const nuevo = await onAccionAPI('crear_tipo_evento', datos) as TipoEventoCalendario
      onActualizar([...orden, nuevo])
      setModalAbierto(false)
    } finally {
      setGuardando(false)
    }
  }, [orden, onActualizar, onAccionAPI])

  // Editar tipo existente
  const editarTipo = useCallback(async (datos: Record<string, unknown>) => {
    setGuardando(true)
    try {
      const actualizado = await onAccionAPI('editar_tipo_evento', datos) as TipoEventoCalendario
      onActualizar(orden.map(t => t.id === actualizado.id ? actualizado : t))
      setTipoEditando(null)
      setModalAbierto(false)
    } finally {
      setGuardando(false)
    }
  }, [orden, onActualizar, onAccionAPI])

  // Eliminar tipo personalizado
  const eliminarTipo = useCallback(async (id: string) => {
    await onAccionAPI('eliminar_tipo_evento', { id })
    onActualizar(orden.filter(t => t.id !== id))
  }, [orden, onActualizar, onAccionAPI])

  // Restablecer valores de fábrica
  const restablecer = useCallback(async () => {
    setGuardando(true)
    try {
      const res = await onAccionAPI('restablecer', {}) as { tipos: TipoEventoCalendario[] }
      onActualizar(res.tipos)
      setConfirmarRestablecer(false)
    } finally {
      setGuardando(false)
    }
  }, [onActualizar, onAccionAPI])

  if (cargando) return <CargadorSeccion />

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <h3 className="text-base font-semibold text-texto-primario">Tipos de evento</h3>
            <p className="text-sm text-texto-terciario mt-0.5">
              Agrega, edita o desactiva tipos de evento. Solo los tipos activos aparecen en formularios y filtros.
            </p>
          </div>
          <Boton
            variante="fantasma"
            tamano="sm"
            soloIcono
            titulo="Agregar tipo de evento"
            icono={<Plus size={16} />}
            onClick={() => { setTipoEditando(null); setModalAbierto(true) }}
          />
        </div>

        {/* Lista con drag-and-drop */}
        <Reorder.Group
          axis="y"
          values={orden}
          onReorder={manejarReorden}
          className="divide-y divide-borde-sutil"
        >
          <AnimatePresence initial={false}>
            {orden.map(tipo => (
              <FilaTipoEvento
                key={tipo.id}
                tipo={tipo}
                onToggle={() => toggleActivo(tipo)}
                onEditar={() => { setTipoEditando(tipo); setModalAbierto(true) }}
                onEliminar={!tipo.es_predefinido ? () => eliminarTipo(tipo.id) : undefined}
              />
            ))}
          </AnimatePresence>
        </Reorder.Group>

        {/* Footer: restablecer */}
        <div className="flex justify-end px-5 py-3 border-t border-borde-sutil bg-superficie-hover/30">
          <Boton variante="fantasma" tamano="xs" icono={<RotateCcw size={13} />} onClick={() => setConfirmarRestablecer(true)}>
            Restablecer
          </Boton>
        </div>
      </div>

      {/* Modal crear/editar tipo de evento */}
      <ModalTipoEvento
        abierto={modalAbierto}
        tipo={tipoEditando}
        guardando={guardando}
        onGuardar={tipoEditando ? editarTipo : crearTipo}
        onCerrar={() => { setModalAbierto(false); setTipoEditando(null) }}
        onEliminar={tipoEditando && !tipoEditando.es_predefinido ? () => eliminarTipo(tipoEditando.id) : undefined}
      />

      {/* Confirmar restablecer */}
      <ModalConfirmacion
        abierto={confirmarRestablecer}
        titulo="Restablecer tipos de evento"
        descripcion="Se eliminarán los tipos personalizados y se reactivarán los predefinidos. Los eventos existentes no se verán afectados."
        etiquetaConfirmar="Restablecer"
        tipo="peligro"
        cargando={guardando}
        onConfirmar={restablecer}
        onCerrar={() => setConfirmarRestablecer(false)}
      />
    </div>
  )
}

// ── Fila individual de tipo de evento ──

function FilaTipoEvento({
  tipo,
  onToggle,
  onEditar,
  onEliminar,
}: {
  tipo: TipoEventoCalendario
  onToggle: () => void
  onEditar: () => void
  onEliminar?: () => void
}) {
  const Icono = obtenerIcono(tipo.icono)

  // Badge de duración: "Todo el día" o "X min"
  const etiquetaDuracion = tipo.todo_el_dia_default
    ? 'Todo el día'
    : `${tipo.duracion_default} min`

  return (
    <Reorder.Item
      value={tipo}
      className="flex items-center gap-3 px-5 py-3.5 bg-superficie-tarjeta cursor-default"
      whileDrag={{ scale: 1.01, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 10 }}
    >
      {/* Handle drag */}
      <div className="text-texto-terciario cursor-grab active:cursor-grabbing shrink-0 touch-none">
        <GripVertical size={16} />
      </div>

      {/* Icono con fondo de color */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: tipo.color + '18', color: tipo.color }}
      >
        {Icono && <Icono size={20} />}
      </div>

      {/* Nombre y badge de duración */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${tipo.activo ? 'text-texto-primario' : 'text-texto-terciario'}`}>
          {tipo.etiqueta}
        </p>
        <div className="flex flex-wrap gap-1 mt-1">
          <span className="text-xs px-2 py-0.5 rounded-full bg-superficie-hover text-texto-terciario">
            {etiquetaDuracion}
          </span>
        </div>
      </div>

      {/* Toggle activo */}
      <Interruptor activo={tipo.activo} onChange={onToggle} />

      {/* Botón editar */}
      <Boton
        variante="fantasma"
        tamano="xs"
        soloIcono
        icono={<Pencil size={15} />}
        onClick={onEditar}
        titulo="Editar"
      />
    </Reorder.Item>
  )
}

// ── Modal para crear/editar tipo de evento ──

interface PropiedadesModalTipoEvento {
  abierto: boolean
  tipo: TipoEventoCalendario | null
  guardando: boolean
  onGuardar: (datos: Record<string, unknown>) => void
  onCerrar: () => void
  onEliminar?: () => void
}

function ModalTipoEvento({ abierto, tipo, guardando, onGuardar, onCerrar, onEliminar }: PropiedadesModalTipoEvento) {
  const esEdicion = !!tipo

  // Estado del formulario
  const [etiqueta, setEtiqueta] = useState('')
  const [clave, setClave] = useState('')
  const [icono, setIcono] = useState('Calendar')
  const [color, setColor] = useState(COLOR_MARCA_DEFECTO)
  const [duracionDefault, setDuracionDefault] = useState(60)
  const [todoElDiaDefault, setTodoElDiaDefault] = useState(false)
  // Ref para el input color nativo (gotero)
  const colorInputRef = useRef<HTMLInputElement>(null)

  // Inicializar al abrir
  useEffect(() => {
    if (!abierto) return
    if (tipo) {
      setEtiqueta(tipo.etiqueta)
      setClave(tipo.clave)
      setIcono(tipo.icono)
      setColor(tipo.color)
      setDuracionDefault(tipo.duracion_default)
      setTodoElDiaDefault(tipo.todo_el_dia_default)
    } else {
      setEtiqueta('')
      setClave('')
      setIcono('Calendar')
      setColor(COLOR_MARCA_DEFECTO)
      setDuracionDefault(60)
      setTodoElDiaDefault(false)
    }
  }, [abierto, tipo])

  // Auto-generar clave desde etiqueta (solo al crear)
  const manejarEtiqueta = (valor: string) => {
    setEtiqueta(valor)
    if (!esEdicion) {
      setClave(valor.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''))
    }
  }

  // Guardar
  const manejarGuardar = () => {
    if (!etiqueta.trim()) return
    const datos: Record<string, unknown> = {
      etiqueta: etiqueta.trim(),
      icono,
      color,
      duracion_default: duracionDefault,
      todo_el_dia_default: todoElDiaDefault,
    }
    if (esEdicion) datos.id = tipo!.id
    else datos.clave = clave
    onGuardar(datos)
  }

  const IconoPreview = obtenerIcono(icono)

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={esEdicion ? `Editar: ${tipo!.etiqueta}` : 'Nuevo tipo de evento'}
      tamano="lg"
      acciones={
        <div className="flex items-center gap-2 w-full">
          {onEliminar && (
            <Boton
              variante="fantasma"
              tamano="sm"
              icono={<Trash2 size={14} />}
              onClick={onEliminar}
              className="text-insignia-peligro-texto mr-auto"
            >
              Eliminar
            </Boton>
          )}
          <div className="ml-auto flex gap-2">
            <Boton variante="secundario" tamano="sm" onClick={onCerrar}>Cancelar</Boton>
            <Boton tamano="sm" onClick={manejarGuardar} cargando={guardando} disabled={!etiqueta.trim()}>
              {esEdicion ? 'Guardar' : 'Crear tipo'}
            </Boton>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* ── Preview + Nombre ── */}
        <div className="flex items-start gap-4">
          {/* Preview del icono con color */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: color + '18', color }}
          >
            {IconoPreview && <IconoPreview size={28} />}
          </div>
          <div className="flex-1">
            <Input
              tipo="text"
              etiqueta="Nombre del tipo"
              value={etiqueta}
              onChange={(e) => manejarEtiqueta(e.target.value)}
              placeholder="Ej: Reunión, Llamada, Bloqueo..."
              autoFocus
            />
          </div>
        </div>

        {/* ── Icono ── */}
        <SelectorIcono
          valor={icono}
          onChange={setIcono}
          etiqueta="Icono"
        />

        {/* ── Color ── */}
        <div>
          <label className="text-sm font-medium text-texto-secundario block mb-2">Color</label>
          <div className="flex flex-wrap gap-2.5 items-center">
            {COLORES_TIPO.map(preset => {
              const seleccionado = color.toLowerCase() === preset.color.toLowerCase()
              return (
                <Tooltip key={preset.color} contenido={preset.nombre}>
                  <button
                    onClick={() => setColor(preset.color)}
                    className={`relative size-8 rounded-full transition-all duration-150 cursor-pointer hover:scale-110 ${
                      seleccionado ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110' : ''
                    }`}
                    style={{ backgroundColor: preset.color }}
                  >
                    {seleccionado && (
                      <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow-sm" />
                    )}
                  </button>
                </Tooltip>
              )
            })}

            {/* Gotero — abre el color picker nativo del navegador */}
            <button
              onClick={() => colorInputRef.current?.click()}
              className={`relative size-8 rounded-full border-2 border-dashed transition-all duration-150 cursor-pointer hover:scale-110 flex items-center justify-center ${
                !COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase())
                  ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110 border-transparent'
                  : 'border-borde-fuerte'
              }`}
              style={
                !COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase())
                  ? { backgroundColor: color }
                  : undefined
              }
              title="Elegir color personalizado"
            >
              {COLORES_TIPO.some(p => p.color.toLowerCase() === color.toLowerCase()) ? (
                <Pipette size={14} className="text-texto-terciario" />
              ) : (
                <Check size={14} className="text-white drop-shadow-sm" />
              )}
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="sr-only"
              tabIndex={-1}
            />
          </div>
        </div>

        {/* ── Duración por defecto ── */}
        <div>
          <label className="text-sm font-medium text-texto-secundario block mb-2">Duración por defecto</label>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-borde-fuerte overflow-hidden">
              {[15, 30, 45, 60, 90, 120].map(d => (
                <button
                  key={d}
                  onClick={() => { setDuracionDefault(d); setTodoElDiaDefault(false) }}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer border-none ${
                    !todoElDiaDefault && duracionDefault === d
                      ? 'bg-texto-marca text-white'
                      : 'bg-superficie-tarjeta text-texto-secundario hover:bg-superficie-hover'
                  }`}
                >
                  {d >= 60 ? `${d / 60}h` : `${d}m`}
                </button>
              ))}
            </div>
            <span className="text-xs text-texto-terciario">
              {todoElDiaDefault
                ? 'Todo el día'
                : duracionDefault >= 60
                  ? `${duracionDefault / 60} hora${duracionDefault > 60 ? 's' : ''}`
                  : `${duracionDefault} minutos`}
            </span>
          </div>
        </div>

        {/* ── Todo el día por defecto ── */}
        <div className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-superficie-hover/50 transition-colors">
          <div>
            <p className="text-sm text-texto-primario">Todo el día por defecto</p>
            <p className="text-xs text-texto-terciario">Los eventos de este tipo se crearán como eventos de día completo</p>
          </div>
          <Interruptor
            activo={todoElDiaDefault}
            onChange={(v) => setTodoElDiaDefault(v)}
          />
        </div>
      </div>
    </Modal>
  )
}

export { SeccionTiposEvento }
