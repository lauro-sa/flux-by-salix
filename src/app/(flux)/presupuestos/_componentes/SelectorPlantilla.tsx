'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Star, Plus, Save, Trash2, Check } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { OpcionMenu } from '@/componentes/ui/OpcionMenu'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * SelectorPlantilla — Menú para gestionar plantillas de presupuesto.
 * Estilo integrado tipo menú contextual: las plantillas y acciones
 * fluyen como un solo listado.
 */

interface Plantilla {
  id: string
  nombre: string
  creado_por: string
  moneda?: string
  condicion_pago_id?: string
  condicion_pago_label?: string
  condicion_pago_tipo?: string
  dias_vencimiento?: number
  lineas?: unknown[]
  notas_html?: string
  condiciones_html?: string
}

interface PropiedadesSelectorPlantilla {
  plantillas: Plantilla[]
  plantillaActual: string | null
  predeterminadaId: string | null
  usuarioId: string
  puedeEliminarTodas?: boolean
  onCargar: (plantilla: Plantilla) => void
  onGuardarComo: (nombre: string) => Promise<void>
  onGuardarCambios: () => Promise<void>
  onEliminar: (id: string) => Promise<void>
  onTogglePredeterminada: (id: string) => Promise<void>
  onLimpiar: () => void
}

export default function SelectorPlantilla({
  plantillas,
  plantillaActual,
  predeterminadaId,
  usuarioId,
  puedeEliminarTodas = false,
  onCargar,
  onGuardarComo,
  onGuardarCambios,
  onEliminar,
  onTogglePredeterminada,
  onLimpiar,
}: PropiedadesSelectorPlantilla) {
  const [abierto, setAbierto] = useState(false)
  const [creando, setCreando] = useState(false)
  const [nombreNueva, setNombreNueva] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const plantillaCargada = plantillaActual
    ? plantillas.find(p => p.id === plantillaActual)
    : null

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false)
        setCreando(false)
        setEliminando(null)
      }
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])

  // Autofocus al input cuando se activa el modo creación
  useEffect(() => {
    if (creando) setTimeout(() => inputRef.current?.focus(), 50)
  }, [creando])

  const handleGuardarComo = async () => {
    if (!nombreNueva.trim()) return
    setGuardando(true)
    await onGuardarComo(nombreNueva.trim())
    setGuardando(false)
    setCreando(false)
    setNombreNueva('')
  }

  const itemClase = "flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm transition-colors rounded-md"

  return (
    <div ref={ref} className="relative inline-flex items-center">
      {/* Trigger */}
      <Boton
        variante="fantasma"
        tamano="sm"
        iconoDerecho={<ChevronDown size={14} className={`text-texto-terciario transition-transform duration-200 ${abierto ? 'rotate-180' : ''}`} />}
        onClick={() => { setAbierto(!abierto); setCreando(false); setEliminando(null) }}
      >
        <span className="truncate max-w-[160px]">
          {plantillaCargada?.nombre || 'Sin plantilla'}
        </span>
      </Boton>

      {/* Menú */}
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 w-72 bg-superficie-elevada border border-borde-sutil rounded-xl shadow-lg z-50 py-1.5"
          >
            {/* ── Plantillas guardadas ── */}
            {plantillas.length > 0 && (
              <div className="px-1.5 mb-1">
                {plantillas.map(p => {
                  const esActual = p.id === plantillaActual
                  const esPredeterminada = p.id === predeterminadaId
                  const esMia = p.creado_por === usuarioId

                  return (
                    <div key={p.id} className="group flex items-center">
                      <Boton
                        variante="fantasma"
                        tamano="sm"
                        onClick={() => { onCargar(p); setAbierto(false) }}
                        className={`${itemClase} flex-1 min-w-0 h-auto ${esActual ? 'bg-marca-500/8 text-texto-marca' : 'text-texto-primario'}`}
                      >
                        {/* Check o estrella */}
                        {esActual ? (
                          <Check size={14} className="shrink-0 text-texto-marca" />
                        ) : esPredeterminada ? (
                          <Star size={14} className="shrink-0 text-insignia-advertencia" fill="currentColor" />
                        ) : (
                          <span className="w-3.5 shrink-0" />
                        )}
                        <span className="truncate">{p.nombre}</span>
                      </Boton>

                      {/* Acciones siempre visibles */}
                      <div className="shrink-0 flex items-center gap-0.5 pr-1.5">
                        <Boton variante="fantasma" tamano="xs" soloIcono icono={<Star size={12} fill={esPredeterminada ? 'currentColor' : 'none'} />} onClick={(e) => { e.stopPropagation(); onTogglePredeterminada(p.id) }} titulo={esPredeterminada ? 'Quitar predeterminada' : 'Fijar como predeterminada'} className={esPredeterminada ? 'text-insignia-advertencia' : 'text-texto-terciario/30 hover:text-insignia-advertencia'} />
                        {(esMia || puedeEliminarTodas) && (
                          <Boton variante="fantasma" tamano="xs" soloIcono icono={<Trash2 size={12} />} onClick={(e) => { e.stopPropagation(); setEliminando(p.id) }} titulo="Eliminar" className="text-texto-terciario/30 hover:text-estado-error" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {plantillas.length > 0 && <div className="border-t border-borde-sutil/50 my-1" />}

            {/* ── Acciones ── */}
            <div className="px-1.5">
              {/* Guardar cambios (solo si hay plantilla cargada) */}
              {plantillaCargada && (
                <OpcionMenu icono={<Save size={14} />} onClick={async () => { await onGuardarCambios(); setAbierto(false) }}>
                  Actualizar &ldquo;{plantillaCargada.nombre}&rdquo;
                </OpcionMenu>
              )}

              {/* Guardar como nueva */}
              {creando ? (
                <div className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={inputRef}
                      type="text"
                      value={nombreNueva}
                      onChange={(e) => setNombreNueva(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleGuardarComo()
                        if (e.key === 'Escape') { setCreando(false); setNombreNueva('') }
                      }}
                      placeholder="Nombre de la plantilla"
                      className="flex-1 min-w-0 bg-superficie-app border border-borde-sutil rounded-lg px-2.5 py-1.5 text-sm text-texto-primario placeholder:text-texto-placeholder outline-none focus:border-marca-500 transition-colors"
                    />
                    <Boton variante="primario" tamano="xs" onClick={handleGuardarComo} disabled={!nombreNueva.trim() || guardando}>
                      {guardando ? '...' : 'Guardar'}
                    </Boton>
                  </div>
                </div>
              ) : (
                <OpcionMenu icono={<Plus size={14} />} onClick={() => setCreando(true)}>
                  Guardar como nueva plantilla
                </OpcionMenu>
              )}

              {/* Quitar plantilla */}
              {plantillaCargada && (
                <OpcionMenu onClick={() => { onLimpiar(); setAbierto(false) }}>
                  Sin plantilla
                </OpcionMenu>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal confirmación eliminar */}
      <AnimatePresence>
        {eliminando && (() => {
          const plantillaEliminar = plantillas.find(p => p.id === eliminando)
          if (!plantillaEliminar) return null
          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
              onClick={() => setEliminando(null)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-superficie-elevada border border-borde-sutil rounded-xl shadow-elevada w-full max-w-sm p-5"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="size-9 rounded-full bg-estado-error/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Trash2 size={16} className="text-estado-error" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-texto-primario mb-1">Eliminar plantilla</h3>
                    <p className="text-xs text-texto-terciario">
                      La plantilla &ldquo;{plantillaEliminar.nombre}&rdquo; se eliminará permanentemente. Esta acción no se puede deshacer.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Boton variante="secundario" tamano="sm" onClick={() => setEliminando(null)}>Cancelar</Boton>
                  <Boton variante="peligro" tamano="sm" onClick={async () => { await onEliminar(eliminando); setEliminando(null) }}>Eliminar</Boton>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
