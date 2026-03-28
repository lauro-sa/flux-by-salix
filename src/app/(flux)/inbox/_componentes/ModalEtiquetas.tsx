'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Modal } from '@/componentes/ui/Modal'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { SelectorColor } from '@/componentes/ui/SelectorColor'
import {
  Plus, Trash2, Tag, Check, X, Pencil, GripVertical, RotateCcw,
  ChevronUp, ChevronDown,
} from 'lucide-react'
import type { EtiquetaInbox } from '@/tipos/inbox'

/**
 * Modal para gestionar etiquetas de correo.
 * CRUD completo + asignar/desasignar de conversaciones.
 */

interface PropiedadesModalEtiquetas {
  abierto: boolean
  onCerrar: () => void
  /** Si se pasa, modo "asignar etiquetas a esta conversación" */
  conversacionId?: string
  /** Etiquetas ya asignadas a la conversación */
  etiquetasAsignadas?: string[]
  onCambio?: (etiquetas: string[]) => void
  /** Si true, renderiza sin wrapper de Modal (para embeber en config) */
  inline?: boolean
}

export function ModalEtiquetas({
  abierto,
  onCerrar,
  conversacionId,
  etiquetasAsignadas = [],
  onCambio,
  inline = false,
}: PropiedadesModalEtiquetas) {
  const [etiquetas, setEtiquetas] = useState<EtiquetaInbox[]>([])
  const [cargando, setCargando] = useState(false)
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [restaurando, setRestaurando] = useState(false)

  // Campos para crear/editar
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState('#6b7280')

  // Etiquetas activas en esta conversación (por nombre, no por ID)
  const [activas, setActivas] = useState<Set<string>>(new Set(etiquetasAsignadas))

  // Cargar etiquetas
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/inbox/etiquetas')
      const data = await res.json()
      setEtiquetas(data.etiquetas || [])
    } catch { /* silenciar */ }
    setCargando(false)
  }, [])

  // Solo cargar al abrir el modal (no en cada re-render por polling)
  const prevAbiertoRef = useRef(false)
  useEffect(() => {
    if (abierto && !prevAbiertoRef.current) {
      cargar()
      setActivas(new Set(etiquetasAsignadas))
    }
    prevAbiertoRef.current = abierto
  }, [abierto])

  // Crear etiqueta
  const handleCrear = async () => {
    if (!nombre.trim()) return
    try {
      const res = await fetch('/api/inbox/etiquetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), color }),
      })
      if (res.ok) {
        setNombre('')
        setColor('#6b7280')
        setCreando(false)
        cargar()
      }
    } catch { /* silenciar */ }
  }

  // Editar etiqueta
  const handleEditar = async (id: string) => {
    if (!nombre.trim()) return
    try {
      await fetch(`/api/inbox/etiquetas?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim(), color }),
      })
      setEditando(null)
      setNombre('')
      cargar()
    } catch { /* silenciar */ }
  }

  // Eliminar etiqueta
  const handleEliminar = async (id: string) => {
    try {
      await fetch(`/api/inbox/etiquetas?id=${id}`, { method: 'DELETE' })
      cargar()
    } catch { /* silenciar */ }
  }

  // Reordenar etiqueta (mover arriba/abajo)
  const handleReordenar = async (indice: number, direccion: 'arriba' | 'abajo') => {
    const nuevo = [...etiquetas]
    const destino = direccion === 'arriba' ? indice - 1 : indice + 1
    if (destino < 0 || destino >= nuevo.length) return

    // Swap
    ;[nuevo[indice], nuevo[destino]] = [nuevo[destino], nuevo[indice]]
    setEtiquetas(nuevo)

    // Persistir ambos órdenes
    try {
      await Promise.all([
        fetch(`/api/inbox/etiquetas?id=${nuevo[indice].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orden: indice }),
        }),
        fetch(`/api/inbox/etiquetas?id=${nuevo[destino].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orden: destino }),
        }),
      ])
    } catch { /* silenciar */ }
  }

  // Toggle etiqueta en conversación — guarda NOMBRES (no IDs) en el array
  const toggleEtiqueta = async (nombre: string) => {
    if (!conversacionId) return

    const estaActiva = activas.has(nombre)
    const nuevas = new Set(activas)

    if (estaActiva) {
      nuevas.delete(nombre)
    } else {
      nuevas.add(nombre)
    }

    // Optimistic update
    setActivas(nuevas)
    const arrayNuevas = [...nuevas]
    onCambio?.(arrayNuevas)

    try {
      await fetch(`/api/inbox/conversaciones/${conversacionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etiquetas: arrayNuevas }),
      })
    } catch {
      // Revertir
      setActivas(activas)
      onCambio?.([...activas])
    }
  }

  const modoAsignar = !!conversacionId

  const contenido = (
      <div className="space-y-3">
        {/* Lista de etiquetas */}
        {cargando ? (
          <div className="py-8 text-center">
            <span className="text-xs" style={{ color: 'var(--texto-terciario)' }}>Cargando...</span>
          </div>
        ) : etiquetas.length === 0 && !creando ? (
          <div className="py-8 text-center">
            <Tag size={24} className="mx-auto mb-2" style={{ color: 'var(--texto-terciario)' }} />
            <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>Sin etiquetas</p>
            <p className="text-xs mt-1" style={{ color: 'var(--texto-terciario)' }}>
              Creá etiquetas para clasificar conversaciones.
            </p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {etiquetas.map((et) => (
              <div
                key={et.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors group"
                style={{ background: modoAsignar && activas.has(et.nombre) ? 'var(--superficie-seleccionada)' : 'transparent' }}
              >
                {modoAsignar ? (
                  // Modo asignar: checkbox con cursor pointer y hover
                  <button
                    onClick={() => toggleEtiqueta(et.nombre)}
                    className="flex items-center gap-2 flex-1 text-left cursor-pointer rounded-md px-1 py-0.5 transition-colors hover:bg-[var(--superficie-hover)]"
                  >
                    <div
                      className="w-3 h-3 rounded-sm flex items-center justify-center"
                      style={{
                        background: activas.has(et.nombre) ? et.color : 'transparent',
                        border: `2px solid ${et.color}`,
                      }}
                    >
                      {activas.has(et.nombre) && <Check size={8} color="#fff" />}
                    </div>
                    <span className="text-sm" style={{ color: 'var(--texto-primario)' }}>
                      {et.icono && <span className="mr-1">{et.icono}</span>}{et.nombre}
                    </span>
                  </button>
                ) : (
                  // Modo gestión: editar/eliminar
                  <>
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: et.color }}
                    />
                    {editando === et.id ? (
                      <div className="flex-1 flex items-center gap-1">
                        <input
                          type="text"
                          value={nombre}
                          onChange={(e) => setNombre(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleEditar(et.id)}
                          className="flex-1 text-sm bg-transparent outline-none"
                          style={{ color: 'var(--texto-primario)' }}
                          autoFocus
                        />
                        <button onClick={() => handleEditar(et.id)}>
                          <Check size={12} style={{ color: 'var(--insignia-exito)' }} />
                        </button>
                        <button onClick={() => { setEditando(null); setNombre('') }}>
                          <X size={12} style={{ color: 'var(--texto-terciario)' }} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 text-sm" style={{ color: 'var(--texto-primario)' }}>
                          {et.icono && <span className="mr-1">{et.icono}</span>}{et.nombre}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {etiquetas.indexOf(et) > 0 && (
                            <button
                              onClick={() => handleReordenar(etiquetas.indexOf(et), 'arriba')}
                              className="p-1 rounded"
                              title="Mover arriba"
                            >
                              <ChevronUp size={10} style={{ color: 'var(--texto-terciario)' }} />
                            </button>
                          )}
                          {etiquetas.indexOf(et) < etiquetas.length - 1 && (
                            <button
                              onClick={() => handleReordenar(etiquetas.indexOf(et), 'abajo')}
                              className="p-1 rounded"
                              title="Mover abajo"
                            >
                              <ChevronDown size={10} style={{ color: 'var(--texto-terciario)' }} />
                            </button>
                          )}
                          <button
                            onClick={() => { setEditando(et.id); setNombre(et.nombre); setColor(et.color) }}
                            className="p-1 rounded"
                          >
                            <Pencil size={10} style={{ color: 'var(--texto-terciario)' }} />
                          </button>
                          <button onClick={() => handleEliminar(et.id)} className="p-1 rounded">
                            <Trash2 size={10} style={{ color: 'var(--insignia-peligro)' }} />
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Formulario crear etiqueta */}
        <AnimatePresence>
          {creando && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="space-y-2 pt-2"
              style={{ borderTop: '1px solid var(--borde-sutil)' }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-6 h-6 rounded-full flex-shrink-0 cursor-pointer"
                  style={{ background: color }}
                />
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCrear()}
                  className="flex-1 text-sm bg-transparent outline-none px-2 py-1 rounded"
                  style={{ color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)' }}
                  placeholder="Nombre de la etiqueta"
                  autoFocus
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#0ea5e9', '#14b8a6'].map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="w-5 h-5 rounded-full transition-transform"
                    style={{
                      background: c,
                      transform: color === c ? 'scale(1.3)' : 'scale(1)',
                      outline: color === c ? '2px solid var(--texto-marca)' : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Boton variante="primario" tamano="xs" onClick={handleCrear} disabled={!nombre.trim()}>
                  Crear
                </Boton>
                <Boton variante="fantasma" tamano="xs" onClick={() => { setCreando(false); setNombre(''); setColor('#6b7280') }}>
                  Cancelar
                </Boton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Botones: nueva + restablecer */}
        {!creando && (
          <div className="flex items-center justify-between">
            <Boton
              variante="fantasma"
              tamano="xs"
              icono={<Plus size={12} />}
              onClick={() => { setCreando(true); setNombre(''); setColor('#6b7280') }}
            >
              Nueva etiqueta
            </Boton>
            {!modoAsignar && (
              <Boton
                variante="fantasma"
                tamano="xs"
                icono={<RotateCcw size={12} />}
                disabled={restaurando}
                onClick={async () => {
                  setRestaurando(true)
                  try {
                    const res = await fetch('/api/inbox/etiquetas', { method: 'PUT' })
                    const data = await res.json()
                    if (data.etiquetas) setEtiquetas(data.etiquetas)
                  } catch { /* silenciar */ }
                  setRestaurando(false)
                }}
              >
                {restaurando ? 'Restaurando...' : 'Restablecer'}
              </Boton>
            )}
          </div>
        )}
      </div>
  )

  if (inline) return contenido

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={modoAsignar ? 'Etiquetar conversación' : 'Gestionar etiquetas'}
      tamano="sm"
    >
      {contenido}
    </Modal>
  )
}
