'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Reorder, AnimatePresence, motion } from 'framer-motion'
import {
  Plus, GripVertical, Trash2, RotateCcw, Check, Pencil, Pipette,
} from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { Interruptor } from '@/componentes/ui/Interruptor'
import { Input } from '@/componentes/ui/Input'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Popover } from '@/componentes/ui/Popover'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import { useToast } from '@/componentes/feedback/Toast'
import type { EtapaConversacion } from '@/tipos/inbox'

/**
 * SeccionEtapas — Configuración de etapas del pipeline de conversaciones.
 * Permite crear, editar, reordenar, activar/desactivar y eliminar etapas.
 * Cada canal (whatsapp, correo) tiene sus propias etapas.
 * Se usa en: /inbox/configuracion (dentro de la sección del canal correspondiente).
 */

interface PropiedadesSeccionEtapas {
  tipoCanal: 'whatsapp' | 'correo'
}

// Paleta de colores predefinida para las etapas
const COLORES_ETAPA = [
  '#6b7280', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
]

// Emojis sugeridos para las etapas
const EMOJIS_SUGERIDOS = [
  '🆕', '📞', '⭐', '📋', '✅', '❌', '📥', '🔄',
  '✉️', '👁️', '🔒', '🎯', '🤝', '💬', '⏳', '🚀',
]

function SeccionEtapas({ tipoCanal }: PropiedadesSeccionEtapas) {
  const { mostrar } = useToast()

  // Estado principal
  const [etapas, setEtapas] = useState<EtapaConversacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  // Edición inline
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [textoEditando, setTextoEditando] = useState('')
  const inputEditarRef = useRef<HTMLInputElement>(null)

  // Formulario nueva etapa
  const [creando, setCreando] = useState(false)
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('')
  const [nuevoColor, setNuevoColor] = useState(COLORES_ETAPA[1])
  const [nuevoIcono, setNuevoIcono] = useState('🆕')
  const inputCrearRef = useRef<HTMLInputElement>(null)

  // Popover de color (para editar etapas existentes)
  const [colorEditandoId, setColorEditandoId] = useState<string | null>(null)

  // Popover de emoji (para editar etapas existentes)
  const [emojiEditandoId, setEmojiEditandoId] = useState<string | null>(null)

  // Modal de confirmación para restablecer
  const [confirmarRestablecer, setConfirmarRestablecer] = useState(false)

  // ── Cargar etapas ──

  const cargarEtapas = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch(`/api/inbox/etapas?tipo_canal=${tipoCanal}`)
      if (!res.ok) throw new Error('Error al cargar etapas')
      const data = await res.json()
      setEtapas(data.etapas || data || [])
    } catch {
      mostrar('error', 'Error al cargar las etapas')
    } finally {
      setCargando(false)
    }
  }, [tipoCanal, mostrar])

  useEffect(() => { cargarEtapas() }, [cargarEtapas])

  // ── Auto-focus al editar inline ──

  useEffect(() => {
    if (editandoId && inputEditarRef.current) {
      inputEditarRef.current.focus()
      inputEditarRef.current.select()
    }
  }, [editandoId])

  // ── Auto-focus al crear ──

  useEffect(() => {
    if (creando && inputCrearRef.current) {
      inputCrearRef.current.focus()
    }
  }, [creando])

  // ── Guardar cambio individual (PATCH) ──

  const guardarCambio = useCallback(async (
    id: string,
    cambios: Partial<Pick<EtapaConversacion, 'etiqueta' | 'color' | 'icono' | 'orden' | 'activa'>>,
  ) => {
    try {
      const res = await fetch('/api/inbox/etapas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...cambios }),
      })
      if (!res.ok) throw new Error('Error al guardar')
    } catch {
      mostrar('error', 'Error al guardar el cambio')
      // Recargar para revertir el estado optimista
      cargarEtapas()
    }
  }, [mostrar, cargarEtapas])

  // ── Editar nombre inline ──

  const iniciarEdicion = (etapa: EtapaConversacion) => {
    setEditandoId(etapa.id)
    setTextoEditando(etapa.etiqueta)
  }

  const confirmarEdicion = async () => {
    if (!editandoId || !textoEditando.trim()) {
      setEditandoId(null)
      return
    }
    // Actualización optimista
    setEtapas(prev => prev.map(e =>
      e.id === editandoId ? { ...e, etiqueta: textoEditando.trim() } : e,
    ))
    await guardarCambio(editandoId, { etiqueta: textoEditando.trim() })
    setEditandoId(null)
  }

  // ── Toggle activa ──

  const toggleActiva = async (etapa: EtapaConversacion) => {
    const nuevoValor = !etapa.activa
    // Actualización optimista
    setEtapas(prev => prev.map(e =>
      e.id === etapa.id ? { ...e, activa: nuevoValor } : e,
    ))
    await guardarCambio(etapa.id, { activa: nuevoValor })
  }

  // ── Cambiar color ──

  const cambiarColor = async (etapa: EtapaConversacion, color: string) => {
    setEtapas(prev => prev.map(e =>
      e.id === etapa.id ? { ...e, color } : e,
    ))
    setColorEditandoId(null)
    await guardarCambio(etapa.id, { color })
  }

  // ── Cambiar emoji/ícono ──

  const cambiarIcono = async (etapa: EtapaConversacion, icono: string) => {
    setEtapas(prev => prev.map(e =>
      e.id === etapa.id ? { ...e, icono } : e,
    ))
    setEmojiEditandoId(null)
    await guardarCambio(etapa.id, { icono })
  }

  // ── Reordenar con drag ──

  const manejarReorden = useCallback(async (nuevas: EtapaConversacion[]) => {
    // Asignar nuevos órdenes
    const conOrden = nuevas.map((e, i) => ({ ...e, orden: i }))
    setEtapas(conOrden)
    // Guardar cada cambio de orden
    for (const etapa of conOrden) {
      await guardarCambio(etapa.id, { orden: etapa.orden })
    }
  }, [guardarCambio])

  // ── Crear nueva etapa ──

  const crearEtapa = async () => {
    if (!nuevaEtiqueta.trim()) return
    setGuardando(true)
    try {
      const clave = nuevaEtiqueta.toLowerCase().trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_áéíóúñü]/g, '')
      const res = await fetch('/api/inbox/etapas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo_canal: tipoCanal,
          clave,
          etiqueta: nuevaEtiqueta.trim(),
          color: nuevoColor,
          icono: nuevoIcono,
          orden: etapas.length,
        }),
      })
      if (!res.ok) throw new Error('Error al crear')
      const data = await res.json()
      setEtapas(prev => [...prev, data.etapa || data])
      // Limpiar formulario
      setCreando(false)
      setNuevaEtiqueta('')
      setNuevoColor(COLORES_ETAPA[1])
      setNuevoIcono('🆕')
      mostrar('exito', 'Etapa creada')
    } catch {
      mostrar('error', 'Error al crear la etapa')
    } finally {
      setGuardando(false)
    }
  }

  // ── Eliminar etapa ──

  const eliminarEtapa = async (etapa: EtapaConversacion) => {
    // Solo etapas personalizadas (no predefinidas)
    if (etapa.es_predefinida) return
    // Actualización optimista
    setEtapas(prev => prev.filter(e => e.id !== etapa.id))
    try {
      const res = await fetch(`/api/inbox/etapas?id=${etapa.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      mostrar('exito', 'Etapa eliminada')
    } catch {
      mostrar('error', 'Error al eliminar la etapa')
      cargarEtapas()
    }
  }

  // ── Restablecer predefinidos ──

  const restablecer = async () => {
    setGuardando(true)
    try {
      const res = await fetch('/api/inbox/etapas/restablecer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo_canal: tipoCanal }),
      })
      if (!res.ok) throw new Error('Error al restablecer')
      const data = await res.json()
      setEtapas(data.etapas || data || [])
      setConfirmarRestablecer(false)
      mostrar('exito', 'Etapas restablecidas')
    } catch {
      mostrar('error', 'Error al restablecer las etapas')
    } finally {
      setGuardando(false)
    }
  }

  // ── Renderizado ──

  if (cargando) return <CargadorSeccion />

  return (
    <div className="space-y-4">
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <h3 className="text-base font-semibold text-texto-primario">
              Etapas del pipeline
            </h3>
            <p className="text-sm text-texto-terciario mt-0.5">
              Define las etapas por las que pasan tus conversaciones. Puedes personalizar nombres, colores e iconos. Arrastra para reordenar.
            </p>
          </div>
        </div>

        {/* Lista de etapas con drag-and-drop */}
        {etapas.length > 0 ? (
          <Reorder.Group
            axis="y"
            values={etapas}
            onReorder={manejarReorden}
            className="divide-y divide-borde-sutil"
          >
            <AnimatePresence initial={false}>
              {etapas.map(etapa => (
                <Reorder.Item
                  key={etapa.id}
                  value={etapa}
                  className="flex items-center gap-3 px-5 py-3 bg-superficie-tarjeta group"
                  whileDrag={{ scale: 1.01, boxShadow: '0 4px 20px rgba(0,0,0,0.1)', zIndex: 10 }}
                >
                  {/* Handle para arrastrar */}
                  <div className="text-texto-terciario cursor-grab active:cursor-grabbing shrink-0 touch-none">
                    <GripVertical size={14} />
                  </div>

                  {/* Color dot — clickeable para cambiar color */}
                  <Popover
                    abierto={colorEditandoId === etapa.id}
                    onCambio={(abierto) => setColorEditandoId(abierto ? etapa.id : null)}
                    alineacion="inicio"
                    ancho={220}
                    contenido={
                      <SelectorColorInline
                        valor={etapa.color}
                        onChange={(c) => cambiarColor(etapa, c)}
                        colores={COLORES_ETAPA}
                      />
                    }
                  >
                    <button
                      className="size-5 rounded-full shrink-0 cursor-pointer transition-transform hover:scale-125 border-2 border-transparent hover:border-borde-fuerte"
                      style={{ backgroundColor: etapa.color }}
                      title="Cambiar color"
                    />
                  </Popover>

                  {/* Emoji — clickeable para cambiar */}
                  <Popover
                    abierto={emojiEditandoId === etapa.id}
                    onCambio={(abierto) => setEmojiEditandoId(abierto ? etapa.id : null)}
                    alineacion="inicio"
                    ancho={240}
                    contenido={
                      <SelectorEmojiInline
                        valor={etapa.icono}
                        onChange={(emoji) => cambiarIcono(etapa, emoji)}
                      />
                    }
                  >
                    <button
                      className="text-base cursor-pointer shrink-0 transition-transform hover:scale-125"
                      title="Cambiar icono"
                    >
                      {etapa.icono || '📌'}
                    </button>
                  </Popover>

                  {/* Nombre — editable inline */}
                  {editandoId === etapa.id ? (
                    <input
                      ref={inputEditarRef}
                      type="text"
                      value={textoEditando}
                      onChange={(e) => setTextoEditando(e.target.value)}
                      onBlur={confirmarEdicion}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmarEdicion()
                        if (e.key === 'Escape') setEditandoId(null)
                      }}
                      className="flex-1 text-sm font-medium bg-transparent border-b border-texto-marca outline-none py-0.5 text-texto-primario"
                    />
                  ) : (
                    <button
                      onClick={() => iniciarEdicion(etapa)}
                      className={`flex-1 text-left text-sm font-medium cursor-text transition-colors ${
                        etapa.activa ? 'text-texto-primario' : 'text-texto-terciario line-through'
                      }`}
                      title="Click para editar nombre"
                    >
                      {etapa.etiqueta}
                    </button>
                  )}

                  {/* Insignia predefinida */}
                  {etapa.es_predefinida && (
                    <span
                      className="text-xxs px-1.5 py-0.5 rounded-full shrink-0 hidden sm:inline"
                      style={{
                        backgroundColor: 'var(--superficie-hover)',
                        color: 'var(--texto-terciario)',
                      }}
                      title="Predefinida — No se puede eliminar, pero puedes renombrarla o desactivarla."
                    >
                      Predefinida
                    </span>
                  )}

                  {/* Toggle activa/inactiva */}
                  <div className="shrink-0" title="Las etapas inactivas no aparecen en el selector pero se mantienen en el historial.">
                    <Interruptor activo={etapa.activa} onChange={() => toggleActiva(etapa)} />
                  </div>

                  {/* Botón editar (mobile) */}
                  <Boton
                    variante="fantasma"
                    tamano="xs"
                    soloIcono
                    titulo="Editar nombre"
                    icono={<Pencil size={13} />}
                    onClick={() => iniciarEdicion(etapa)}
                    className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  />

                  {/* Botón eliminar — solo etapas personalizadas */}
                  {!etapa.es_predefinida && (
                    <Boton
                      variante="fantasma"
                      tamano="xs"
                      soloIcono
                      titulo="Eliminar etapa"
                      icono={<Trash2 size={13} />}
                      onClick={() => eliminarEtapa(etapa)}
                      className="sm:opacity-0 sm:group-hover:opacity-100 transition-opacity text-insignia-peligro"
                    />
                  )}
                </Reorder.Item>
              ))}
            </AnimatePresence>
          </Reorder.Group>
        ) : (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-texto-terciario">
              No hay etapas configuradas. Agrega una o restablece las predefinidas.
            </p>
          </div>
        )}

        {/* Formulario agregar etapa */}
        <AnimatePresence>
          {creando && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div
                className="px-5 py-4 space-y-3"
                style={{ borderTop: '1px solid var(--borde-sutil)' }}
              >
                {/* Preview en vivo */}
                <div className="flex items-center gap-3 p-2.5 rounded-lg bg-superficie-hover/50">
                  <div
                    className="size-5 rounded-full shrink-0"
                    style={{ backgroundColor: nuevoColor }}
                  />
                  <span className="text-base">{nuevoIcono}</span>
                  <span className="text-sm font-medium text-texto-primario">
                    {nuevaEtiqueta || 'Nueva etapa'}
                  </span>
                </div>

                <Input
                  ref={inputCrearRef}
                  tipo="text"
                  etiqueta="Nombre de la etapa"
                  value={nuevaEtiqueta}
                  onChange={(e) => setNuevaEtiqueta(e.target.value)}
                  placeholder="Ej: Negociación, Cotizado..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && nuevaEtiqueta.trim()) crearEtapa()
                    if (e.key === 'Escape') setCreando(false)
                  }}
                />

                {/* Color */}
                <SelectorColorInline
                  valor={nuevoColor}
                  onChange={setNuevoColor}
                  colores={COLORES_ETAPA}
                />

                {/* Emoji */}
                <SelectorEmojiInline
                  valor={nuevoIcono}
                  onChange={setNuevoIcono}
                />

                {/* Acciones */}
                <div className="flex gap-2 justify-end pt-1">
                  <Boton
                    variante="secundario"
                    tamano="sm"
                    onClick={() => setCreando(false)}
                  >
                    Cancelar
                  </Boton>
                  <Boton
                    tamano="sm"
                    onClick={crearEtapa}
                    cargando={guardando}
                    disabled={!nuevaEtiqueta.trim()}
                  >
                    Crear etapa
                  </Boton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer: agregar + restablecer */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid var(--borde-sutil)', background: 'var(--superficie-hover-sutil, var(--superficie-tarjeta))' }}
        >
          {!creando && (
            <Boton
              variante="fantasma"
              tamano="sm"
              icono={<Plus size={14} />}
              onClick={() => setCreando(true)}
              className="border border-dashed border-borde-sutil text-texto-secundario"
            >
              Agregar etapa
            </Boton>
          )}
          <div className={!creando ? '' : 'ml-auto'}>
            <Boton
              variante="fantasma"
              tamano="xs"
              icono={<RotateCcw size={13} />}
              onClick={() => setConfirmarRestablecer(true)}
            >
              Restablecer
            </Boton>
          </div>
        </div>
      </div>

      {/* Texto ayuda para restablecer */}
      <p className="text-xs text-texto-terciario px-1">
        Las etapas inactivas no aparecen en el selector pero se mantienen en el historial de las conversaciones.
      </p>

      {/* Modal confirmar restablecer */}
      <ModalConfirmacion
        abierto={confirmarRestablecer}
        titulo="Restablecer etapas predefinidas"
        descripcion="Volver a las etapas originales. Las etapas personalizadas se eliminarán y las conversaciones quedarán sin etapa asignada."
        etiquetaConfirmar="Restablecer"
        tipo="peligro"
        cargando={guardando}
        onConfirmar={restablecer}
        onCerrar={() => setConfirmarRestablecer(false)}
      />
    </div>
  )
}

// ── Selector de color inline (dots) ──

function SelectorColorInline({
  valor,
  onChange,
  colores,
}: {
  valor: string
  onChange: (c: string) => void
  colores: string[]
}) {
  const colorInputRef = useRef<HTMLInputElement>(null)
  const esCustom = !colores.some(c => c.toLowerCase() === valor.toLowerCase())

  return (
    <div className="p-3">
      <label className="text-xs font-medium text-texto-secundario block mb-2">Color</label>
      <div className="flex flex-wrap gap-2 items-center">
        {colores.map(c => {
          const sel = valor.toLowerCase() === c.toLowerCase()
          return (
            <button
              key={c}
              onClick={() => onChange(c)}
              className={`relative size-6 rounded-full transition-all duration-150 cursor-pointer hover:scale-110 focus-visible:outline-2 focus-visible:outline-texto-marca ${
                sel ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110' : ''
              }`}
              style={{ backgroundColor: c }}
            >
              {sel && <Check size={12} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
            </button>
          )
        })}
        {/* Gotero para color personalizado */}
        <button
          onClick={() => colorInputRef.current?.click()}
          className={`relative size-6 rounded-full border-2 border-dashed transition-all duration-150 cursor-pointer hover:scale-110 flex items-center justify-center ${
            esCustom
              ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110 border-transparent'
              : 'border-borde-fuerte'
          }`}
          style={esCustom ? { backgroundColor: valor } : undefined}
          title="Elegir color personalizado"
        >
          {esCustom ? (
            <Check size={10} className="text-white drop-shadow-sm" />
          ) : (
            <Pipette size={10} className="text-texto-terciario" />
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

// ── Selector de emoji inline ──

function SelectorEmojiInline({
  valor,
  onChange,
}: {
  valor: string | null
  onChange: (emoji: string) => void
}) {
  return (
    <div className="p-3">
      <label className="text-xs font-medium text-texto-secundario block mb-2">Icono</label>
      <div className="flex flex-wrap gap-1.5">
        {EMOJIS_SUGERIDOS.map(emoji => {
          const sel = valor === emoji
          return (
            <button
              key={emoji}
              onClick={() => onChange(emoji)}
              className={`size-8 rounded-lg text-base flex items-center justify-center cursor-pointer transition-all duration-150 hover:scale-110 hover:bg-superficie-hover ${
                sel ? 'bg-texto-marca/10 ring-2 ring-texto-marca scale-110' : ''
              }`}
            >
              {emoji}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export { SeccionEtapas }
export type { PropiedadesSeccionEtapas }
