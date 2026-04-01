'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Reorder, AnimatePresence } from 'framer-motion'
import { Plus, Pencil, GripVertical, Check, RotateCcw, Pipette } from 'lucide-react'
import { SelectorIcono, obtenerIcono } from '@/componentes/ui/SelectorIcono'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Boton } from '@/componentes/ui/Boton'
import { Modal } from '@/componentes/ui/Modal'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Input } from '@/componentes/ui/Input'
import { CargadorSeccion } from '@/componentes/ui/Cargador'

/**
 * SeccionEstados — Lista de estados de actividad con drag-and-drop, toggle, editar.
 * Cada estado tiene un grupo de comportamiento: activo, completado, cancelado.
 */

export interface EstadoActividad {
  id: string
  clave: string
  etiqueta: string
  icono: string
  color: string
  grupo: 'activo' | 'completado' | 'cancelado'
  orden: number
  activo: boolean
  es_predefinido: boolean
}

interface PropiedadesSeccionEstados {
  estados: EstadoActividad[]
  cargando: boolean
  onActualizar: (estados: EstadoActividad[]) => void
  onAccionAPI: (accion: string, datos: Record<string, unknown>) => Promise<unknown>
}

const GRUPOS = [
  { valor: 'activo', etiqueta: 'Activo', descripcion: 'Visible en chatter, se puede posponer' },
  { valor: 'completado', etiqueta: 'Completado', descripcion: 'Pasa al timeline, acción terminada' },
  { valor: 'cancelado', etiqueta: 'Cancelado', descripcion: 'Estado terminal, sin acciones' },
]

const COLORES_ESTADO = [
  '#f5a623', '#e5484d', '#46a758', '#3b82f6',
  '#8e4ec6', '#889096', '#0f766e', '#ec4899',
]

function SeccionEstados({ estados, cargando, onActualizar, onAccionAPI }: PropiedadesSeccionEstados) {
  const [orden, setOrden] = useState<EstadoActividad[]>(estados)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [estadoEditando, setEstadoEditando] = useState<EstadoActividad | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [confirmarRestablecer, setConfirmarRestablecer] = useState(false)

  // Form state para modal
  const [etiqueta, setEtiqueta] = useState('')
  const [clave, setClave] = useState('')
  const [icono, setIcono] = useState('Circle')
  const [color, setColor] = useState('#6b7280')
  const [grupo, setGrupo] = useState<string>('activo')

  useEffect(() => { setOrden(estados) }, [estados])

  // Abrir modal
  const abrirModal = (estado?: EstadoActividad) => {
    if (estado) {
      setEstadoEditando(estado)
      setEtiqueta(estado.etiqueta)
      setClave(estado.clave)
      setIcono(estado.icono)
      setColor(estado.color)
      setGrupo(estado.grupo)
    } else {
      setEstadoEditando(null)
      setEtiqueta('')
      setClave('')
      setIcono('Circle')
      setColor('#6b7280')
      setGrupo('activo')
    }
    setModalAbierto(true)
  }

  const toggleActivo = useCallback(async (estado: EstadoActividad) => {
    const nuevoEstado = !estado.activo
    const nuevos = orden.map(e => e.id === estado.id ? { ...e, activo: nuevoEstado } : e)
    onActualizar(nuevos)
    await onAccionAPI('editar_estado', { id: estado.id, activo: nuevoEstado })
  }, [orden, onActualizar, onAccionAPI])

  const manejarReorden = useCallback(async (nuevos: EstadoActividad[]) => {
    setOrden(nuevos)
    onActualizar(nuevos)
    await onAccionAPI('reordenar_estados', { orden: nuevos.map(e => e.id) })
  }, [onActualizar, onAccionAPI])

  const guardar = async () => {
    if (!etiqueta.trim()) return
    setGuardando(true)
    try {
      if (estadoEditando) {
        const actualizado = await onAccionAPI('editar_estado', {
          id: estadoEditando.id, etiqueta: etiqueta.trim(), icono, color, grupo,
        }) as EstadoActividad
        onActualizar(orden.map(e => e.id === actualizado.id ? actualizado : e))
      } else {
        const claveGen = etiqueta.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        const nuevo = await onAccionAPI('crear_estado', {
          clave: claveGen, etiqueta: etiqueta.trim(), icono, color, grupo,
        }) as EstadoActividad
        onActualizar([...orden, nuevo])
      }
      setModalAbierto(false)
    } finally {
      setGuardando(false)
    }
  }

  if (cargando) return <CargadorSeccion />

  return (
    <div className="space-y-4">
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <h3 className="text-base font-semibold text-texto-primario">Estados de actividad</h3>
            <p className="text-sm text-texto-terciario mt-0.5">
              Define los estados posibles y su comportamiento. Cada estado pertenece a un grupo.
            </p>
          </div>
          <Boton
            variante="fantasma"
            tamano="sm"
            soloIcono
            icono={<Plus size={16} />}
            onClick={() => abrirModal()}
          />
        </div>

        {/* Agrupados por grupo */}
        {GRUPOS.map(g => {
          const estadosGrupo = orden.filter(e => e.grupo === g.valor)
          if (estadosGrupo.length === 0) return null
          return (
            <div key={g.valor}>
              <div className="px-5 py-1.5 bg-superficie-hover/40">
                <span className="text-[11px] font-semibold text-texto-terciario uppercase tracking-wider">
                  {g.etiqueta}
                </span>
                <span className="text-[10px] text-texto-terciario ml-2">— {g.descripcion}</span>
              </div>
              <Reorder.Group
                axis="y"
                values={estadosGrupo}
                onReorder={(nuevos) => {
                  // Reemplazar solo los del grupo
                  const otros = orden.filter(e => e.grupo !== g.valor)
                  manejarReorden([...otros, ...nuevos].sort((a, b) => {
                    const grupoOrden = { activo: 0, completado: 1, cancelado: 2 }
                    if (a.grupo !== b.grupo) return (grupoOrden[a.grupo] || 0) - (grupoOrden[b.grupo] || 0)
                    return nuevos.indexOf(a) - nuevos.indexOf(b)
                  }))
                }}
                className="divide-y divide-borde-sutil"
              >
                {estadosGrupo.map(estado => {
                  const Icono = obtenerIcono(estado.icono)
                  return (
                    <Reorder.Item
                      key={estado.id}
                      value={estado}
                      className="flex items-center gap-3 px-5 py-3 bg-superficie-tarjeta"
                      whileDrag={{ scale: 1.01, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 10 }}
                    >
                      <div className="text-texto-terciario cursor-grab active:cursor-grabbing shrink-0 touch-none">
                        <GripVertical size={14} />
                      </div>
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: estado.color + '18', color: estado.color }}
                      >
                        {Icono && <Icono size={15} />}
                      </div>
                      <p className={`flex-1 text-sm font-medium ${estado.activo ? 'text-texto-primario' : 'text-texto-terciario'}`}>
                        {estado.etiqueta}
                      </p>
                      <Interruptor activo={estado.activo} onChange={() => toggleActivo(estado)} />
                      <button
                        onClick={() => abrirModal(estado)}
                        className="flex items-center justify-center size-7 rounded-md bg-transparent border-none text-texto-terciario cursor-pointer hover:bg-superficie-hover hover:text-texto-secundario transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                    </Reorder.Item>
                  )
                })}
              </Reorder.Group>
            </div>
          )
        })}

        {/* Footer: restablecer */}
        <div className="flex justify-end px-5 py-3 border-t border-borde-sutil bg-superficie-hover/30">
          <button
            onClick={() => setConfirmarRestablecer(true)}
            className="flex items-center gap-1.5 text-xs text-texto-terciario hover:text-texto-secundario transition-colors cursor-pointer bg-transparent border-none"
          >
            <RotateCcw size={13} />
            Restablecer
          </button>
        </div>
      </div>

      {/* Confirmar restablecer */}
      <ModalConfirmacion
        abierto={confirmarRestablecer}
        titulo="Restablecer estados de actividad"
        descripcion="Se eliminarán los estados personalizados y se reactivarán los predefinidos. Las actividades existentes no se verán afectadas."
        etiquetaConfirmar="Restablecer"
        tipo="peligro"
        cargando={guardando}
        onConfirmar={async () => {
          setGuardando(true)
          try {
            const res = await onAccionAPI('restablecer', {}) as { estados: EstadoActividad[] }
            onActualizar(res.estados)
            setConfirmarRestablecer(false)
          } finally {
            setGuardando(false)
          }
        }}
        onCerrar={() => setConfirmarRestablecer(false)}
      />

      {/* Modal crear/editar estado */}
      <Modal
        abierto={modalAbierto}
        onCerrar={() => setModalAbierto(false)}
        titulo={estadoEditando ? `Editar: ${estadoEditando.etiqueta}` : 'Nuevo estado'}
        tamano="md"
        acciones={
          <>
            <Boton variante="secundario" tamano="sm" onClick={() => setModalAbierto(false)}>Cancelar</Boton>
            <Boton tamano="sm" onClick={guardar} cargando={guardando} disabled={!etiqueta.trim()}>
              {estadoEditando ? 'Guardar' : 'Crear estado'}
            </Boton>
          </>
        }
      >
        <div className="space-y-5">
          {/* Preview */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-superficie-hover/50">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: color + '18', color }}
            >
              {(() => { const I = obtenerIcono(icono); return I ? <I size={18} /> : null })()}
            </div>
            <span className="text-sm font-semibold text-texto-primario">{etiqueta || 'Nuevo estado'}</span>
          </div>

          <Input
            tipo="text"
            etiqueta="Nombre"
            value={etiqueta}
            onChange={(e) => setEtiqueta(e.target.value)}
            placeholder="Ej: En progreso, Pausada..."
            autoFocus
          />

          <SelectorIcono valor={icono} onChange={setIcono} etiqueta="Icono" />

          {/* Color */}
          <SelectorColorDots
            valor={color}
            onChange={setColor}
            colores={COLORES_ESTADO}
          />

          {/* Grupo de comportamiento */}
          <div>
            <label className="text-sm font-medium text-texto-secundario block mb-2">Grupo de comportamiento</label>
            <div className="space-y-1.5">
              {GRUPOS.map(g => (
                <button
                  key={g.valor}
                  onClick={() => setGrupo(g.valor)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left cursor-pointer border transition-colors ${
                    grupo === g.valor
                      ? 'bg-texto-marca/8 border-texto-marca/25 text-texto-primario'
                      : 'bg-transparent border-transparent text-texto-secundario hover:bg-superficie-hover'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${
                    g.valor === 'activo' ? 'bg-insignia-advertencia' : g.valor === 'completado' ? 'bg-insignia-exito' : 'bg-texto-terciario'
                  }`} />
                  <div>
                    <p className="text-sm font-medium">{g.etiqueta}</p>
                    <p className="text-xs text-texto-terciario">{g.descripcion}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Selector de color con dots + gotero nativo ──

function SelectorColorDots({ valor, onChange, colores }: { valor: string; onChange: (c: string) => void; colores: string[] }) {
  const colorInputRef = useRef<HTMLInputElement>(null)
  const esCustom = !colores.some(c => c.toLowerCase() === valor.toLowerCase())

  return (
    <div>
      <label className="text-sm font-medium text-texto-secundario block mb-2">Color</label>
      <div className="flex flex-wrap gap-2.5 items-center">
        {colores.map(c => {
          const sel = valor.toLowerCase() === c.toLowerCase()
          return (
            <button
              key={c}
              onClick={() => onChange(c)}
              className={`relative size-8 rounded-full transition-all duration-150 cursor-pointer hover:scale-110 ${
                sel ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110' : ''
              }`}
              style={{ backgroundColor: c }}
            >
              {sel && <Check size={14} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
            </button>
          )
        })}
        {/* Gotero */}
        <button
          onClick={() => colorInputRef.current?.click()}
          className={`relative size-8 rounded-full border-2 border-dashed transition-all duration-150 cursor-pointer hover:scale-110 flex items-center justify-center ${
            esCustom
              ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110 border-transparent'
              : 'border-borde-fuerte'
          }`}
          style={esCustom ? { backgroundColor: valor } : undefined}
          title="Elegir color personalizado"
        >
          {esCustom ? (
            <Check size={14} className="text-white drop-shadow-sm" />
          ) : (
            <Pipette size={14} className="text-texto-terciario" />
          )}
        </button>
        <input
          ref={colorInputRef}
          type="color"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="sr-only"
          tabIndex={-1}
        />
      </div>
    </div>
  )
}

export { SeccionEstados }
