'use client'

/**
 * SelectorPlantillaCorreo — Menú desplegable para plantillas de correo en el modal de envío.
 * Separa plantillas del sistema (admin) vs personales. Permite guardar cambios,
 * guardar como nueva, marcar predeterminada y eliminar.
 * Se usa en: ModalEnviarDocumento.tsx
 */

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Star, Plus, Save, Trash2, Check, FileText, Building2, User } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boton } from '@/componentes/ui/Boton'
import { OpcionMenu } from '@/componentes/ui/OpcionMenu'

export interface PlantillaCorreoCompleta {
  id: string
  nombre: string
  asunto: string
  contenido_html: string
  canal_id?: string | null
  creado_por: string
}

interface PropiedadesSelectorPlantillaCorreo {
  plantillas: PlantillaCorreoCompleta[]
  plantillaActualId: string
  predeterminadaId: string | null
  usuarioId: string
  esAdmin: boolean
  onSeleccionar: (id: string) => void
  onLimpiar: () => void
  /** Guardar cambios del asunto+html actual sobre la plantilla seleccionada */
  onGuardarCambios?: (id: string) => Promise<void>
  /** Guardar como nueva plantilla con nombre */
  onGuardarComo?: (nombre: string) => Promise<void>
  /** Eliminar plantilla */
  onEliminar?: (id: string) => Promise<void>
  /** Cambiar predeterminada (solo admins) */
  onTogglePredeterminada?: (id: string | null) => void | Promise<void>
}

export function SelectorPlantillaCorreo({
  plantillas,
  plantillaActualId,
  predeterminadaId,
  usuarioId,
  esAdmin,
  onSeleccionar,
  onLimpiar,
  onGuardarCambios,
  onGuardarComo,
  onEliminar,
  onTogglePredeterminada,
}: PropiedadesSelectorPlantillaCorreo) {
  const [abierto, setAbierto] = useState(false)
  const [creando, setCreando] = useState(false)
  const [nombreNueva, setNombreNueva] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const plantillaCargada = plantillaActualId
    ? plantillas.find(p => p.id === plantillaActualId)
    : null

  // Separar plantillas: sistema (creado por otro) vs mías
  const plantillasSistema = plantillas.filter(p => p.creado_por !== usuarioId)
  const plantillasMias = plantillas.filter(p => p.creado_por === usuarioId)

  // Cerrar al click fuera
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

  useEffect(() => {
    if (creando) setTimeout(() => inputRef.current?.focus(), 50)
  }, [creando])

  const handleGuardarComo = async () => {
    if (!nombreNueva.trim() || !onGuardarComo) return
    setGuardando(true)
    await onGuardarComo(nombreNueva.trim())
    setGuardando(false)
    setCreando(false)
    setNombreNueva('')
  }

  const itemClase = 'flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm transition-colors rounded-md'

  const renderPlantilla = (p: PlantillaCorreoCompleta) => {
    const esActual = p.id === plantillaActualId
    const esPredeterminada = p.id === predeterminadaId
    const esMia = p.creado_por === usuarioId
    const puedeEditar = esMia || esAdmin
    const puedeEliminar = esMia || esAdmin

    return (
      <div key={p.id} className="group flex items-center">
        <button
          onClick={() => { onSeleccionar(p.id); setAbierto(false) }}
          className={`${itemClase} flex-1 min-w-0 ${esActual ? 'bg-marca-500/8 text-texto-marca' : 'text-texto-primario hover:bg-superficie-tarjeta'}`}
        >
          {esActual ? (
            <Check size={14} className="shrink-0 text-texto-marca" />
          ) : esPredeterminada ? (
            <Star size={14} className="shrink-0 text-insignia-advertencia" fill="currentColor" />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span className="truncate">{p.nombre}</span>
        </button>

        <div className="shrink-0 flex items-center gap-0.5 pr-1.5">
          {/* Estrella predeterminada (solo admins) */}
          {onTogglePredeterminada && esAdmin && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTogglePredeterminada(esPredeterminada ? null : p.id)
              }}
              className={`size-6 flex items-center justify-center rounded-md transition-colors ${esPredeterminada ? 'text-insignia-advertencia' : 'text-texto-terciario/30 hover:text-insignia-advertencia'}`}
              title={esPredeterminada ? 'Quitar predeterminada' : 'Fijar como predeterminada'}
            >
              <Star size={12} fill={esPredeterminada ? 'currentColor' : 'none'} />
            </button>
          )}
          {/* Eliminar */}
          {puedeEliminar && onEliminar && (
            <button
              onClick={(e) => { e.stopPropagation(); setEliminando(p.id) }}
              className="size-6 flex items-center justify-center rounded-md text-texto-terciario/30 hover:text-estado-error transition-colors"
              title="Eliminar"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative inline-flex items-center">
      {/* Trigger */}
      <button
        onClick={() => { setAbierto(!abierto); setCreando(false); setEliminando(null) }}
        className="flex items-center gap-1.5 text-sm transition-colors cursor-pointer"
        style={{ color: plantillaCargada ? 'var(--texto-primario)' : 'var(--texto-terciario)' }}
      >
        <FileText size={15} style={{ color: 'var(--texto-terciario)' }} />
        <span className="truncate max-w-[200px]">
          {plantillaCargada?.nombre || 'Sin plantilla'}
        </span>
        <ChevronDown
          size={14}
          className="transition-transform duration-200"
          style={{
            color: 'var(--texto-terciario)',
            transform: abierto ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {/* Menú desplegable */}
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1.5 w-80 rounded-xl shadow-xl z-50 py-1.5"
            style={{
              background: 'var(--superficie-elevada)',
              border: '1px solid var(--borde-sutil)',
            }}
          >
            {plantillas.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <FileText size={24} className="mx-auto mb-2" style={{ color: 'var(--texto-terciario)' }} />
                <p className="text-sm" style={{ color: 'var(--texto-terciario)' }}>
                  Sin plantillas configuradas
                </p>
              </div>
            ) : (
              <>
                {/* Plantillas del sistema (admin) */}
                {plantillasSistema.length > 0 && (
                  <div className="px-1.5 mb-1">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 mb-0.5">
                      <Building2 size={11} style={{ color: 'var(--texto-terciario)' }} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
                        De la empresa
                      </span>
                    </div>
                    {plantillasSistema.map(renderPlantilla)}
                  </div>
                )}

                {/* Separador si hay ambas secciones */}
                {plantillasSistema.length > 0 && plantillasMias.length > 0 && (
                  <div className="my-1" style={{ borderTop: '1px solid var(--borde-sutil)' }} />
                )}

                {/* Mis plantillas */}
                {plantillasMias.length > 0 && (
                  <div className="px-1.5 mb-1">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 mb-0.5">
                      <User size={11} style={{ color: 'var(--texto-terciario)' }} />
                      <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
                        Mis plantillas
                      </span>
                    </div>
                    {plantillasMias.map(renderPlantilla)}
                  </div>
                )}
              </>
            )}

            {/* Separador antes de acciones */}
            {plantillas.length > 0 && (
              <div className="my-1" style={{ borderTop: '1px solid var(--borde-sutil)' }} />
            )}

            {/* Acciones */}
            <div className="px-1.5">
              {/* Guardar cambios a plantilla actual */}
              {plantillaCargada && onGuardarCambios && (plantillaCargada.creado_por === usuarioId || esAdmin) && (
                <OpcionMenu
                  icono={<Save size={14} />}
                  onClick={async () => {
                    setGuardando(true)
                    await onGuardarCambios(plantillaCargada.id)
                    setGuardando(false)
                    setAbierto(false)
                  }}
                  disabled={guardando}
                >
                  Guardar cambios en &ldquo;{plantillaCargada.nombre}&rdquo;
                </OpcionMenu>
              )}

              {/* Guardar como nueva */}
              {onGuardarComo && (
                creando ? (
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
                        className="flex-1 min-w-0 rounded-lg px-2.5 py-1.5 text-sm outline-none transition-colors"
                        style={{
                          background: 'var(--superficie-app)',
                          border: '1px solid var(--borde-sutil)',
                          color: 'var(--texto-primario)',
                        }}
                      />
                      <Boton
                        variante="primario"
                        tamano="xs"
                        onClick={handleGuardarComo}
                        disabled={!nombreNueva.trim() || guardando}
                        cargando={guardando}
                      >
                        Guardar
                      </Boton>
                    </div>
                  </div>
                ) : (
                  <OpcionMenu
                    icono={<Plus size={14} />}
                    onClick={() => setCreando(true)}
                  >
                    Guardar como nueva plantilla
                  </OpcionMenu>
                )
              )}

              {/* Sin plantilla */}
              {plantillaCargada && (
                <OpcionMenu
                  onClick={() => { onLimpiar(); setAbierto(false) }}
                >
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
              className="fixed inset-0 z-50 flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.5)' }}
              onClick={() => setEliminando(null)}
            >
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm p-5 rounded-xl shadow-2xl"
                style={{
                  background: 'var(--superficie-elevada)',
                  border: '1px solid var(--borde-sutil)',
                }}
              >
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className="size-9 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: 'rgba(239, 68, 68, 0.1)' }}
                  >
                    <Trash2 size={16} style={{ color: 'var(--insignia-peligro)' }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--texto-primario)' }}>
                      Eliminar plantilla
                    </h3>
                    <p className="text-xs" style={{ color: 'var(--texto-terciario)' }}>
                      La plantilla &ldquo;{plantillaEliminar.nombre}&rdquo; se eliminará permanentemente.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    onClick={() => setEliminando(null)}
                  >
                    Cancelar
                  </Boton>
                  <Boton
                    variante="peligro"
                    tamano="sm"
                    onClick={async () => {
                      if (onEliminar) await onEliminar(eliminando)
                      setEliminando(null)
                    }}
                  >
                    Eliminar
                  </Boton>
                </div>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>
    </div>
  )
}
