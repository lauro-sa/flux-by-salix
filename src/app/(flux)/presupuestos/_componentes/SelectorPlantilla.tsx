'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Star, Save, Trash2, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * SelectorPlantilla — Dropdown para cargar/guardar plantillas de presupuesto.
 *
 * - Lista plantillas con estrella para predeterminada
 * - Guardar como nueva plantilla
 * - Guardar cambios en plantilla existente
 * - Fijar/quitar predeterminada (por usuario)
 * - Eliminar (solo creador o admin)
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
  onCargar,
  onGuardarComo,
  onGuardarCambios,
  onEliminar,
  onTogglePredeterminada,
  onLimpiar,
}: PropiedadesSelectorPlantilla) {
  const [abierto, setAbierto] = useState(false)
  const [modalGuardar, setModalGuardar] = useState(false)
  const [nombreNueva, setNombreNueva] = useState('')
  const [guardando, setGuardando] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const plantillaCargada = plantillaActual
    ? plantillas.find(p => p.id === plantillaActual)
    : null

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])

  const handleGuardarComo = async () => {
    if (!nombreNueva.trim()) return
    setGuardando(true)
    await onGuardarComo(nombreNueva.trim())
    setGuardando(false)
    setModalGuardar(false)
    setNombreNueva('')
  }

  return (
    <div ref={ref} className="relative inline-flex items-center gap-1.5">
      {/* Botón trigger */}
      <button
        onClick={() => setAbierto(!abierto)}
        className="flex items-center gap-1 text-sm text-texto-primario hover:text-texto-marca transition-colors"
      >
        <span className="truncate max-w-[160px]">
          {plantillaCargada?.nombre || 'Sin plantilla'}
        </span>
        <ChevronDown size={14} className={`text-texto-terciario transition-transform ${abierto ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute right-0 top-full mt-2 w-72 bg-superficie-elevada border border-borde-sutil rounded-lg shadow-xl z-50 overflow-hidden"
          >
            {/* Acciones */}
            <div className="p-2 border-b border-borde-sutil flex gap-1">
              <button
                onClick={() => { setAbierto(false); setModalGuardar(true) }}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-texto-secundario hover:bg-superficie-tarjeta rounded transition-colors"
              >
                <Save size={12} />
                Guardar como
              </button>
              {plantillaCargada && (
                <button
                  onClick={async () => { await onGuardarCambios(); setAbierto(false) }}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-texto-marca hover:bg-marca-500/10 rounded transition-colors"
                >
                  <Save size={12} />
                  Guardar cambios
                </button>
              )}
              {plantillaCargada && (
                <button
                  onClick={() => { onLimpiar(); setAbierto(false) }}
                  className="px-2 py-1.5 text-xs text-texto-terciario hover:text-estado-error hover:bg-estado-error/10 rounded transition-colors"
                  title="Quitar plantilla"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Lista de plantillas */}
            <div className="max-h-[240px] overflow-y-auto py-1">
              {plantillas.length === 0 ? (
                <p className="text-xs text-texto-terciario px-3 py-4 text-center">
                  No hay plantillas guardadas
                </p>
              ) : (
                plantillas.map(p => {
                  const esActual = p.id === plantillaActual
                  const esPredeterminada = p.id === predeterminadaId
                  const esMia = p.creado_por === usuarioId

                  return (
                    <div
                      key={p.id}
                      className={`flex items-center gap-2 px-3 py-2 hover:bg-superficie-tarjeta transition-colors ${esActual ? 'bg-marca-500/5' : ''}`}
                    >
                      {/* Estrella predeterminada */}
                      <button
                        onClick={() => onTogglePredeterminada(p.id)}
                        className={`shrink-0 transition-colors ${esPredeterminada ? 'text-insignia-advertencia' : 'text-texto-terciario/30 hover:text-insignia-advertencia/60'}`}
                        title={esPredeterminada ? 'Quitar predeterminada' : 'Fijar como predeterminada'}
                      >
                        <Star size={14} fill={esPredeterminada ? 'currentColor' : 'none'} />
                      </button>

                      {/* Nombre clickeable */}
                      <button
                        onClick={() => { onCargar(p); setAbierto(false) }}
                        className="flex-1 text-left text-sm text-texto-primario truncate"
                      >
                        {p.nombre}
                      </button>

                      {/* Eliminar (solo creador) */}
                      {esMia && (
                        <button
                          onClick={() => onEliminar(p.id)}
                          className="shrink-0 text-texto-terciario/30 hover:text-estado-error transition-colors"
                          title="Eliminar plantilla"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal guardar como */}
      <AnimatePresence>
        {modalGuardar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
            onClick={() => setModalGuardar(false)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-superficie-elevada border border-borde-sutil rounded-xl shadow-2xl w-full max-w-sm p-5"
            >
              <h3 className="text-sm font-semibold text-texto-primario mb-3">Guardar como plantilla</h3>
              <p className="text-xs text-texto-terciario mb-3">
                Se guardarán las líneas, condiciones de pago, moneda, notas y descuento actuales.
              </p>
              <input
                type="text"
                value={nombreNueva}
                onChange={(e) => setNombreNueva(e.target.value)}
                placeholder="Ej: Presupuesto Portones"
                autoFocus
                className="w-full bg-superficie-app border border-borde-sutil rounded-lg p-2.5 text-sm text-texto-primario placeholder:text-texto-terciario outline-none focus:border-marca-500 transition-colors mb-4"
                onKeyDown={(e) => { if (e.key === 'Enter') handleGuardarComo() }}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setModalGuardar(false); setNombreNueva('') }}
                  className="px-3 py-1.5 text-sm text-texto-secundario hover:bg-superficie-tarjeta rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleGuardarComo}
                  disabled={!nombreNueva.trim() || guardando}
                  className="px-3 py-1.5 text-sm bg-marca-500 text-white rounded-lg hover:bg-marca-600 transition-colors disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
