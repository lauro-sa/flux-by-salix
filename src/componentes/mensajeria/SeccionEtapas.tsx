'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Check, Pipette } from 'lucide-react'
import { ModalConfirmacion } from '@/componentes/ui/ModalConfirmacion'
import { Popover } from '@/componentes/ui/Popover'
import { CargadorSeccion } from '@/componentes/ui/Cargador'
import { ListaConfiguracion, type ItemLista } from '@/componentes/ui/ListaConfiguracion'
import { ModalItemConfiguracion } from '@/componentes/ui/ModalItemConfiguracion'
import { useToast } from '@/componentes/feedback/Toast'
import type { EtapaConversacion } from '@/tipos/inbox'

/**
 * SeccionEtapas — Configuración de etapas del pipeline usando ListaConfiguracion unificada.
 * Cada canal (whatsapp, correo) tiene sus propias etapas.
 */

interface PropiedadesSeccionEtapas {
  tipoCanal: 'whatsapp' | 'correo'
}

const COLORES_ETAPA = [
  'var(--insignia-neutro)', 'var(--insignia-info)', 'var(--insignia-exito)', 'var(--insignia-advertencia)', 'var(--insignia-peligro)',
  'var(--insignia-violeta)', 'var(--insignia-rosa)', 'var(--insignia-cyan)', 'var(--insignia-naranja)', 'var(--texto-marca)',
]

const EMOJIS_SUGERIDOS = [
  '🆕', '📞', '⭐', '📋', '✅', '❌', '📥', '🔄',
  '✉️', '👁️', '🔒', '🎯', '🤝', '💬', '⏳', '🚀',
]

function SeccionEtapas({ tipoCanal }: PropiedadesSeccionEtapas) {
  const { mostrar } = useToast()

  const [etapas, setEtapas] = useState<EtapaConversacion[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)

  // Edición inline
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [textoEditando, setTextoEditando] = useState('')
  const inputEditarRef = useRef<HTMLInputElement>(null)

  // Modal crear/editar etapa
  const [creando, setCreando] = useState(false)
  const [editandoEtapa, setEditandoEtapa] = useState<EtapaConversacion | null>(null)

  // Popovers
  const [colorEditandoId, setColorEditandoId] = useState<string | null>(null)
  const [emojiEditandoId, setEmojiEditandoId] = useState<string | null>(null)

  // Modales confirmación
  const [confirmarRestablecer, setConfirmarRestablecer] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null)

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

  useEffect(() => {
    if (editandoId && inputEditarRef.current) {
      inputEditarRef.current.focus()
      inputEditarRef.current.select()
    }
  }, [editandoId])


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
    setEtapas(prev => prev.map(e =>
      e.id === editandoId ? { ...e, etiqueta: textoEditando.trim() } : e,
    ))
    await guardarCambio(editandoId, { etiqueta: textoEditando.trim() })
    setEditandoId(null)
  }

  // ── Toggle activa ──

  const toggleActiva = async (etapa: EtapaConversacion) => {
    const nuevoValor = !etapa.activa
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

  // ── Cambiar emoji ──

  const cambiarIcono = async (etapa: EtapaConversacion, icono: string) => {
    setEtapas(prev => prev.map(e =>
      e.id === etapa.id ? { ...e, icono } : e,
    ))
    setEmojiEditandoId(null)
    await guardarCambio(etapa.id, { icono })
  }

  // ── Reordenar ──

  const manejarReorden = useCallback(async (idsOrdenados: string[]) => {
    const mapa = new Map(etapas.map(e => [e.id, e]))
    const conOrden = idsOrdenados.map((id, i) => ({ ...mapa.get(id)!, orden: i }))
    setEtapas(conOrden)
    for (const etapa of conOrden) {
      await guardarCambio(etapa.id, { orden: etapa.orden })
    }
  }, [etapas, guardarCambio])

  // ── Crear nueva etapa ──



  // ── Eliminar etapa ──

  const eliminarEtapa = async (id: string) => {
    setEtapas(prev => prev.filter(e => e.id !== id))
    try {
      const res = await fetch(`/api/inbox/etapas?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error al eliminar')
      mostrar('exito', 'Etapa eliminada')
    } catch {
      mostrar('error', 'Error al eliminar la etapa')
      cargarEtapas()
    }
  }

  // ── Restablecer ──

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

  if (cargando) return <CargadorSeccion />

  // ─── Mapear EtapaConversacion → ItemLista ─────────────────────────
  const itemsLista: ItemLista[] = etapas.map(etapa => ({
    id: etapa.id,
    nombre: etapa.etiqueta,
    color: etapa.color,
    activo: etapa.activa,
    esPredefinido: etapa.es_predefinida,
    datos: { original: etapa },
  }))

  return (
    <div className="space-y-4">
      <ListaConfiguracion
        titulo="Etapas del pipeline"
        descripcion="Arrastrá para reordenar. Este orden se refleja en el pipeline y los selectores."
        items={itemsLista}
        controles="toggle-editar"
        ordenable
        acciones={[{
          tipo: 'fantasma',
          icono: <Plus size={16} />,
          soloIcono: true,
          titulo: 'Agregar etapa',
          onClick: () => { setEditandoEtapa(null); setCreando(true) },
        }]}
        onToggleActivo={(item) => {
          const etapa = etapas.find(e => e.id === item.id)
          if (etapa) toggleActiva(etapa)
        }}
        onEditar={(item) => {
          const etapa = etapas.find(e => e.id === item.id)
          if (etapa) { setEditandoEtapa(etapa); setCreando(true) }
        }}
        onEliminar={(item) => setConfirmarEliminar(item.id)}
        onReordenar={manejarReorden}
        restaurable
        onRestaurar={() => setConfirmarRestablecer(true)}
        renderContenido={(item) => {
          const etapa = etapas.find(e => e.id === item.id)
          if (!etapa) return null
          return (
            <div className="flex items-center gap-2.5">
              {/* Color dot — clickeable */}
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

              {/* Emoji — clickeable */}
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
                <span className={`text-sm font-medium ${etapa.activa ? 'text-texto-primario' : 'text-texto-terciario line-through'}`}>
                  {etapa.etiqueta}
                </span>
              )}

            </div>
          )
        }}
        renderControlesExtra={(item) => {
          const etapa = etapas.find(e => e.id === item.id)
          if (!etapa?.es_predefinida) return null
          return (
            <span className="text-xxs px-1.5 py-0.5 rounded-full bg-superficie-hover text-texto-terciario shrink-0 hidden sm:inline">
              Predefinida
            </span>
          )
        }}
      />

      {/* Modal crear/editar etapa */}
      <ModalItemConfiguracion
        abierto={creando}
        onCerrar={() => { setCreando(false); setEditandoEtapa(null) }}
        titulo={editandoEtapa ? `Editar: ${editandoEtapa.etiqueta}` : 'Nueva etapa'}
        campos={[
          { tipo: 'texto', clave: 'nombre', etiqueta: 'Nombre', placeholder: 'Ej: Negociación, Cotizado...' },
          { tipo: 'color', clave: 'color', etiqueta: 'Color', colores: COLORES_ETAPA.map(c => ({ valor: c })) },
          { tipo: 'emoji', clave: 'icono', etiqueta: 'Icono', emojis: EMOJIS_SUGERIDOS },
        ]}
        valores={editandoEtapa ? { nombre: editandoEtapa.etiqueta, color: editandoEtapa.color, icono: editandoEtapa.icono || '📌' } : undefined}
        cargando={guardando}
        onGuardar={async (valores) => {
          const nombre = String(valores.nombre || '').trim()
          if (!nombre) return
          const color = String(valores.color || COLORES_ETAPA[1])
          const icono = String(valores.icono || '📌')
          setGuardando(true)
          try {
            if (editandoEtapa) {
              // Editar existente
              setEtapas(prev => prev.map(e =>
                e.id === editandoEtapa.id ? { ...e, etiqueta: nombre, color, icono } : e
              ))
              await guardarCambio(editandoEtapa.id, { etiqueta: nombre, color, icono })
              mostrar('exito', 'Etapa actualizada')
            } else {
              // Crear nueva
              const clave = nombre.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_áéíóúñü]/g, '')
              const res = await fetch('/api/inbox/etapas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  tipo_canal: tipoCanal, clave,
                  etiqueta: nombre, color, icono,
                  orden: etapas.length,
                }),
              })
              if (!res.ok) throw new Error('Error al crear')
              const data = await res.json()
              setEtapas(prev => [...prev, data.etapa || data])
              mostrar('exito', 'Etapa creada')
            }
            setCreando(false)
            setEditandoEtapa(null)
          } catch { mostrar('error', editandoEtapa ? 'Error al editar' : 'Error al crear la etapa') }
          finally { setGuardando(false) }
        }}
      />

      {/* Confirmar eliminar */}
      <ModalConfirmacion
        abierto={!!confirmarEliminar}
        titulo="Eliminar etapa"
        descripcion={`Se eliminará "${etapas.find(e => e.id === confirmarEliminar)?.etiqueta || ''}". Las conversaciones en esta etapa quedarán sin etapa asignada.`}
        etiquetaConfirmar="Eliminar"
        tipo="peligro"
        onConfirmar={async () => {
          if (confirmarEliminar) {
            await eliminarEtapa(confirmarEliminar)
            setConfirmarEliminar(null)
          }
        }}
        onCerrar={() => setConfirmarEliminar(null)}
      />

      {/* Confirmar restablecer */}
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

      <p className="text-xs text-texto-terciario px-1">
        Las etapas inactivas no aparecen en el selector pero se mantienen en el historial de las conversaciones.
      </p>
    </div>
  )
}

// ── Selector de color inline (dots) ──

function SelectorColorInline({ valor, onChange, colores }: { valor: string; onChange: (c: string) => void; colores: string[] }) {
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
              className={`relative size-6 rounded-full transition-all duration-150 cursor-pointer hover:scale-110 ${
                sel ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110' : ''
              }`}
              style={{ backgroundColor: c }}
            >
              {sel && <Check size={12} className="absolute inset-0 m-auto text-white drop-shadow-sm" />}
            </button>
          )
        })}
        <button
          onClick={() => colorInputRef.current?.click()}
          className={`relative size-6 rounded-full border-2 border-dashed transition-all duration-150 cursor-pointer hover:scale-110 flex items-center justify-center ${
            esCustom ? 'ring-2 ring-offset-2 ring-texto-marca ring-offset-superficie-tarjeta scale-110 border-transparent' : 'border-borde-fuerte'
          }`}
          style={esCustom ? { backgroundColor: valor } : undefined}
          title="Elegir color personalizado"
        >
          {esCustom ? <Check size={10} className="text-white drop-shadow-sm" /> : <Pipette size={10} className="text-texto-terciario" />}
        </button>
        <input ref={colorInputRef} type="color" value={valor} onChange={(e) => onChange(e.target.value)} className="sr-only" tabIndex={-1} />
      </div>
    </div>
  )
}

// ── Selector de emoji inline ──

function SelectorEmojiInline({ valor, onChange }: { valor: string | null; onChange: (emoji: string) => void }) {
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
              className={`size-8 rounded-card text-base flex items-center justify-center cursor-pointer transition-all duration-150 hover:scale-110 hover:bg-superficie-hover ${
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
