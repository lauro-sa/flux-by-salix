'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Modal } from '@/componentes/ui/Modal'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { SelectorColor } from '@/componentes/ui/SelectorColor'
import {
  Plus, Trash2, Tag, Check, X, Pencil, GripVertical,
} from 'lucide-react'
import type { EtiquetaCorreo } from '@/tipos/inbox'

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
  onCambio?: () => void
}

export function ModalEtiquetas({
  abierto,
  onCerrar,
  conversacionId,
  etiquetasAsignadas = [],
  onCambio,
}: PropiedadesModalEtiquetas) {
  const [etiquetas, setEtiquetas] = useState<EtiquetaCorreo[]>([])
  const [cargando, setCargando] = useState(false)
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)

  // Campos para crear/editar
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState('#6b7280')

  // Etiquetas activas en esta conversación
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

  useEffect(() => {
    if (abierto) {
      cargar()
      setActivas(new Set(etiquetasAsignadas))
    }
  }, [abierto, cargar, etiquetasAsignadas.join(',')])

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

  // Toggle etiqueta en conversación
  const toggleEtiqueta = async (etiquetaId: string) => {
    if (!conversacionId) return

    const estaActiva = activas.has(etiquetaId)
    const nuevas = new Set(activas)

    try {
      if (estaActiva) {
        // Desasignar
        await fetch(`/api/inbox/conversaciones/${conversacionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            etiquetas: [...nuevas].filter(id => id !== etiquetaId),
          }),
        })
        nuevas.delete(etiquetaId)
      } else {
        // Asignar
        nuevas.add(etiquetaId)
        await fetch(`/api/inbox/conversaciones/${conversacionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            etiquetas: [...nuevas],
          }),
        })
      }
      setActivas(nuevas)
      onCambio?.()
    } catch { /* silenciar */ }
  }

  const modoAsignar = !!conversacionId

  return (
    <Modal
      abierto={abierto}
      onCerrar={onCerrar}
      titulo={modoAsignar ? 'Etiquetar conversación' : 'Gestionar etiquetas'}
      tamano="sm"
    >
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
              Creá etiquetas para organizar tus correos.
            </p>
          </div>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {etiquetas.map((et) => (
              <div
                key={et.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors group"
                style={{ background: modoAsignar && activas.has(et.id) ? 'var(--superficie-seleccionada)' : 'transparent' }}
              >
                {modoAsignar ? (
                  // Modo asignar: checkbox
                  <button
                    onClick={() => toggleEtiqueta(et.id)}
                    className="flex items-center gap-2 flex-1 text-left"
                  >
                    <div
                      className="w-3 h-3 rounded-sm flex items-center justify-center"
                      style={{
                        background: activas.has(et.id) ? et.color : 'transparent',
                        border: `2px solid ${et.color}`,
                      }}
                    >
                      {activas.has(et.id) && <Check size={8} color="#fff" />}
                    </div>
                    <span className="text-sm" style={{ color: 'var(--texto-primario)' }}>
                      {et.nombre}
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
                          {et.nombre}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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

        {/* Botón agregar */}
        {!creando && (
          <Boton
            variante="fantasma"
            tamano="xs"
            icono={<Plus size={12} />}
            onClick={() => { setCreando(true); setNombre(''); setColor('#6b7280') }}
          >
            Nueva etiqueta
          </Boton>
        )}
      </div>
    </Modal>
  )
}
