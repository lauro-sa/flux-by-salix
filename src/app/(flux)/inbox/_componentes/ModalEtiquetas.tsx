'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ModalAdaptable as Modal } from '@/componentes/ui/ModalAdaptable'
import { Boton } from '@/componentes/ui/Boton'
import { Input } from '@/componentes/ui/Input'
import { SelectorColor } from '@/componentes/ui/SelectorColor'
import {
  Plus, Trash2, Tag, Check, X, Pencil, GripVertical, RotateCcw,
  ChevronUp, ChevronDown,
} from 'lucide-react'
import type { EtiquetaInbox } from '@/tipos/inbox'
import { COLOR_ETIQUETA_DEFECTO, PALETA_COLORES_ETIQUETA } from '@/lib/colores_entidad'
import { useTraduccion } from '@/lib/i18n'
import { useToast } from '@/componentes/feedback/Toast'

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
  const { t } = useTraduccion()
  const { mostrar } = useToast()
  const [etiquetas, setEtiquetas] = useState<EtiquetaInbox[]>([])
  const [cargando, setCargando] = useState(false)
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<string | null>(null)
  const [restaurando, setRestaurando] = useState(false)

  // Campos para crear/editar
  const [nombre, setNombre] = useState('')
  const [color, setColor] = useState(COLOR_ETIQUETA_DEFECTO)

  // Etiquetas activas en esta conversación (por nombre, no por ID)
  const [activas, setActivas] = useState<Set<string>>(new Set(etiquetasAsignadas))

  // Cargar etiquetas
  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const res = await fetch('/api/inbox/etiquetas')
      const data = await res.json()
      setEtiquetas(data.etiquetas || [])
    } catch { mostrar('error', 'Error al cargar etiquetas') }
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
        setColor(COLOR_ETIQUETA_DEFECTO)
        setCreando(false)
        cargar()
        mostrar('exito', 'Etiqueta creada')
      }
    } catch { mostrar('error', 'Error al crear etiqueta') }
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
      mostrar('exito', 'Etiqueta actualizada')
    } catch { mostrar('error', 'Error al editar etiqueta') }
  }

  // Eliminar etiqueta
  const handleEliminar = async (id: string) => {
    try {
      await fetch(`/api/inbox/etiquetas?id=${id}`, { method: 'DELETE' })
      cargar()
      mostrar('exito', 'Etiqueta eliminada')
    } catch { mostrar('error', 'Error al eliminar etiqueta') }
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
    } catch { mostrar('error', 'Error al reordenar') }
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
      mostrar('error', 'Error al asignar etiqueta')
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
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    onClick={() => toggleEtiqueta(et.nombre)}
                    className="flex-1 text-left"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-sm flex items-center justify-center"
                        style={{
                          background: activas.has(et.nombre) ? et.color : 'transparent',
                          border: `2px solid ${et.color}`,
                        }}
                      >
                        {activas.has(et.nombre) && <Check size={8} color="var(--texto-inverso)" />}
                      </span>
                      <span className="text-sm" style={{ color: 'var(--texto-primario)' }}>
                        {et.icono && <span className="mr-1">{et.icono}</span>}{et.nombre}
                      </span>
                    </span>
                  </Boton>
                ) : (
                  // Modo gestión: editar/eliminar
                  <>
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ background: et.color }}
                    />
                    {editando === et.id ? (
                      <div className="flex-1 flex items-center gap-1">
                        <Input
                          value={nombre}
                          onChange={(e) => setNombre(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleEditar(et.id)}
                          formato={null}
                          variante="plano"
                          compacto
                          className="flex-1"
                          autoFocus
                        />
                        <Boton variante="fantasma" tamano="xs" soloIcono titulo="Confirmar" icono={<Check size={12} />} onClick={() => handleEditar(et.id)} className="text-insignia-exito" />
                        <Boton variante="fantasma" tamano="xs" soloIcono titulo="Cancelar" icono={<X size={12} />} onClick={() => { setEditando(null); setNombre('') }} />
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 text-sm" style={{ color: 'var(--texto-primario)' }}>
                          {et.icono && <span className="mr-1">{et.icono}</span>}{et.nombre}
                        </span>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          {etiquetas.indexOf(et) > 0 && (
                            <Boton variante="fantasma" tamano="xs" soloIcono icono={<ChevronUp size={10} />} onClick={() => handleReordenar(etiquetas.indexOf(et), 'arriba')} titulo="Mover arriba" />
                          )}
                          {etiquetas.indexOf(et) < etiquetas.length - 1 && (
                            <Boton variante="fantasma" tamano="xs" soloIcono icono={<ChevronDown size={10} />} onClick={() => handleReordenar(etiquetas.indexOf(et), 'abajo')} titulo="Mover abajo" />
                          )}
                          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Editar etiqueta" icono={<Pencil size={10} />} onClick={() => { setEditando(et.id); setNombre(et.nombre); setColor(et.color) }} />
                          <Boton variante="fantasma" tamano="xs" soloIcono titulo="Eliminar etiqueta" icono={<Trash2 size={10} />} onClick={() => handleEliminar(et.id)} className="text-insignia-peligro" />
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
                <Input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCrear()}
                  formato={null}
                  compacto
                  className="flex-1"
                  placeholder="Nombre de la etiqueta"
                  autoFocus
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PALETA_COLORES_ETIQUETA.map(c => (
                  <Boton
                    key={c}
                    variante="fantasma"
                    tamano="xs"
                    soloIcono
                    redondeado
                    onClick={() => setColor(c)}
                    titulo={c}
                    icono={<span className="w-5 h-5 rounded-full block" style={{ background: c }} />}
                    style={{
                      transform: color === c ? 'scale(1.3)' : 'scale(1)',
                      outline: color === c ? '2px solid var(--texto-marca)' : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Boton variante="primario" tamano="xs" onClick={handleCrear} disabled={!nombre.trim()}>
                  {t('comun.crear')}
                </Boton>
                <Boton variante="fantasma" tamano="xs" onClick={() => { setCreando(false); setNombre(''); setColor(COLOR_ETIQUETA_DEFECTO) }}>
                  {t('comun.cancelar')}
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
              onClick={() => { setCreando(true); setNombre(''); setColor(COLOR_ETIQUETA_DEFECTO) }}
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
                    if (data.etiquetas) {
                      setEtiquetas(data.etiquetas)
                      mostrar('exito', 'Etiquetas restablecidas')
                    }
                  } catch { mostrar('error', 'Error al restablecer') }
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
      titulo={modoAsignar ? t('inbox.etiquetar') : t('inbox.etiquetar')}
      tamano="sm"
    >
      {contenido}
    </Modal>
  )
}
