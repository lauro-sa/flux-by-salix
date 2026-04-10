'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  Plus, Pencil, GripVertical, RotateCcw, Trash2,
} from 'lucide-react'
import { obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Boton } from '@/componentes/ui/Boton'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import { ModalTipoActividad } from './ModalTipoActividad'

/**
 * SeccionTipos — Lista de tipos de actividad con drag-and-drop, toggle, editar.
 * Replica la UI del software anterior: icono con fondo de color, nombre,
 * badges de módulos, toggle activo, botón editar, handle de drag.
 */

// Módulos y sub-módulos donde un tipo de actividad puede estar disponible
const MODULOS_DISPONIBLES = [
  // Módulos principales
  { clave: 'contactos', etiqueta: 'Contactos', grupo: 'Principal' },
  { clave: 'inbox', etiqueta: 'Inbox', grupo: 'Principal' },
  { clave: 'visitas', etiqueta: 'Visitas', grupo: 'Principal' },
  { clave: 'calendario', etiqueta: 'Calendario', grupo: 'Principal' },
  // Documentos (granular por tipo)
  { clave: 'presupuestos', etiqueta: 'Presupuestos', grupo: 'Documentos' },
  { clave: 'facturas', etiqueta: 'Facturas', grupo: 'Documentos' },
  { clave: 'ordenes', etiqueta: 'Órdenes de trabajo', grupo: 'Documentos' },
  { clave: 'informes', etiqueta: 'Informes', grupo: 'Documentos' },
  { clave: 'notas_credito', etiqueta: 'Notas de crédito', grupo: 'Documentos' },
  { clave: 'recibos', etiqueta: 'Recibos', grupo: 'Documentos' },
]

export interface TipoActividad {
  id: string
  clave: string
  etiqueta: string
  icono: string
  color: string
  modulos_disponibles: string[]
  dias_vencimiento: number
  campo_fecha: boolean
  campo_descripcion: boolean
  campo_responsable: boolean
  campo_prioridad: boolean
  campo_checklist: boolean
  campo_calendario: boolean
  auto_completar: boolean
  resumen_predeterminado: string | null
  nota_predeterminada: string | null
  usuario_predeterminado: string | null
  siguiente_tipo_id: string | null
  tipo_encadenamiento: 'sugerir' | 'activar'
  orden: number
  activo: boolean
  es_predefinido: boolean
}

interface PropiedadesSeccionTipos {
  tipos: TipoActividad[]
  miembros: { usuario_id: string; nombre: string; apellido: string }[]
  cargando: boolean
  onActualizar: (tipos: TipoActividad[]) => void
  onAccionAPI: (accion: string, datos: Record<string, unknown>) => Promise<unknown>
}

function SeccionTipos({ tipos, miembros, cargando, onActualizar, onAccionAPI }: PropiedadesSeccionTipos) {
  const [orden, setOrden] = useState<TipoActividad[]>(tipos)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [tipoEditando, setTipoEditando] = useState<TipoActividad | null>(null)
  const [confirmarRestablecer, setConfirmarRestablecer] = useState(false)
  const [guardando, setGuardando] = useState(false)

  // Sincronizar orden local con props
  useEffect(() => { setOrden(tipos) }, [tipos])

  // Toggle activo/inactivo
  const toggleActivo = useCallback(async (tipo: TipoActividad) => {
    const nuevoEstado = !tipo.activo
    // Optimistic update
    const nuevos = orden.map(t => t.id === tipo.id ? { ...t, activo: nuevoEstado } : t)
    onActualizar(nuevos)
    await onAccionAPI('editar_tipo', { id: tipo.id, activo: nuevoEstado })
  }, [orden, onActualizar, onAccionAPI])

  // Reordenar con drag-and-drop
  const manejarReorden = useCallback(async (nuevosItems: TipoActividad[]) => {
    setOrden(nuevosItems)
    onActualizar(nuevosItems)
    await onAccionAPI('reordenar_tipos', { orden: nuevosItems.map(t => t.id) })
  }, [onActualizar, onAccionAPI])

  // Crear tipo nuevo
  const crearTipo = useCallback(async (datos: Record<string, unknown>) => {
    setGuardando(true)
    try {
      const nuevo = await onAccionAPI('crear_tipo', datos) as TipoActividad
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
      const actualizado = await onAccionAPI('editar_tipo', datos) as TipoActividad
      onActualizar(orden.map(t => t.id === actualizado.id ? actualizado : t))
      setTipoEditando(null)
      setModalAbierto(false)
    } finally {
      setGuardando(false)
    }
  }, [orden, onActualizar, onAccionAPI])

  // Eliminar tipo custom
  const eliminarTipo = useCallback(async (id: string) => {
    await onAccionAPI('eliminar_tipo', { id })
    onActualizar(orden.filter(t => t.id !== id))
  }, [orden, onActualizar, onAccionAPI])

  // Restablecer valores de fábrica
  const restablecer = useCallback(async () => {
    setGuardando(true)
    try {
      const res = await onAccionAPI('restablecer', {}) as { tipos: TipoActividad[] }
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
            <h3 className="text-base font-semibold text-texto-primario">Tipos de actividad</h3>
            <p className="text-sm text-texto-terciario mt-0.5">
              Agrega, edita o desactiva tipos. Solo los tipos activos aparecen en formularios y filtros.
            </p>
          </div>
          <Boton
            variante="fantasma"
            tamano="sm"
            soloIcono
            titulo="Agregar tipo"
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
              <FilaTipo
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

      {/* Modal crear/editar tipo */}
      <ModalTipoActividad
        abierto={modalAbierto}
        tipo={tipoEditando}
        tipos={tipos}
        miembros={miembros}
        modulosDisponibles={MODULOS_DISPONIBLES}
        guardando={guardando}
        onGuardar={tipoEditando ? editarTipo : crearTipo}
        onCerrar={() => { setModalAbierto(false); setTipoEditando(null) }}
        onEliminar={tipoEditando && !tipoEditando.es_predefinido ? () => eliminarTipo(tipoEditando.id) : undefined}
      />

      {/* Confirmar restablecer */}
      <ModalConfirmacion
        abierto={confirmarRestablecer}
        titulo="Restablecer tipos de actividad"
        descripcion="Se eliminarán los tipos personalizados y se reactivarán los predefinidos. Las actividades existentes no se verán afectadas."
        etiquetaConfirmar="Restablecer"
        tipo="peligro"
        cargando={guardando}
        onConfirmar={restablecer}
        onCerrar={() => setConfirmarRestablecer(false)}
      />
    </div>
  )
}

// ── Fila individual de tipo ──

function FilaTipo({
  tipo,
  onToggle,
  onEditar,
  onEliminar,
}: {
  tipo: TipoActividad
  onToggle: () => void
  onEditar: () => void
  onEliminar?: () => void
}) {
  const Icono = obtenerIcono(tipo.icono)

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

      {/* Nombre y badges de módulos */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${tipo.activo ? 'text-texto-primario' : 'text-texto-terciario'}`}>
          {tipo.etiqueta}
        </p>
        <div className="flex flex-wrap gap-1 mt-1">
          {tipo.modulos_disponibles.map(mod => (
            <span
              key={mod}
              className="text-xs px-2 py-0.5 rounded-full bg-superficie-hover text-texto-terciario capitalize"
            >
              {mod}
            </span>
          ))}
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

export { SeccionTipos, MODULOS_DISPONIBLES }
