'use client'

/**
 * SelectorPlantillaCorreo — Menú desplegable para plantillas de correo en el modal de envío.
 * Separa plantillas del sistema (admin) vs personales. Permite guardar cambios,
 * guardar como nueva, marcar predeterminada y eliminar.
 * Se usa en: ModalEnviarDocumento.tsx
 */

import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Star, Plus, Save, Trash2, Check, FileText, Building2, User, Loader2, BookmarkPlus, Shield } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boton } from '@/componentes/ui/Boton'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { OpcionMenu } from '@/componentes/ui/OpcionMenu'

export interface PlantillaCorreoCompleta {
  id: string
  nombre: string
  asunto: string
  contenido_html: string
  canal_id?: string | null
  creado_por: string
  disponible_para?: 'todos' | 'roles' | 'usuarios'
  es_sistema?: boolean
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
  /** Guardar como nueva plantilla con nombre y visibilidad */
  onGuardarComo?: (nombre: string, paraTodos?: boolean) => Promise<void>
  /** Eliminar plantilla */
  onEliminar?: (id: string) => Promise<void>
  /** Cambiar predeterminada (solo admins) */
  onTogglePredeterminada?: (id: string | null) => void | Promise<void>
  /** Indica si el contenido actual difiere de la plantilla cargada */
  tieneModificaciones?: boolean
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
  tieneModificaciones,
}: PropiedadesSelectorPlantillaCorreo) {
  const [abierto, setAbierto] = useState(false)
  const [creando, setCreando] = useState(false)
  const [nombreNueva, setNombreNueva] = useState('')
  const [nuevaParaTodos, setNuevaParaTodos] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [eliminando, setEliminando] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const botonRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [posMenu, setPosMenu] = useState({ top: 0, left: 0 })

  const plantillaCargada = plantillaActualId
    ? plantillas.find(p => p.id === plantillaActualId)
    : null

  // Verificar si hay cambios y el usuario puede guardar
  const puedeGuardarCambios = !!(tieneModificaciones && plantillaCargada && onGuardarCambios && (plantillaCargada.creado_por === usuarioId || esAdmin))

  // Separar plantillas: empresa (sistema + disponibles para todos) vs personales
  const plantillasEmpresa = plantillas.filter(p => p.es_sistema || p.disponible_para === 'todos' || (!p.disponible_para && p.creado_por !== usuarioId))
  const plantillasPersonales = plantillas.filter(p => !p.es_sistema && p.disponible_para !== 'todos' && p.disponible_para !== undefined && p.creado_por === usuarioId)

  useLayoutEffect(() => {
    if (!abierto || !botonRef.current) return
    const rect = botonRef.current.getBoundingClientRect()
    setPosMenu({ top: rect.bottom + 6, left: rect.left })
  }, [abierto])

  // Cerrar al click fuera
  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      if (dropdownRef.current?.contains(target)) return
      setAbierto(false)
      setCreando(false)
      setEliminando(null)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])

  useEffect(() => {
    if (!abierto) return
    const handler = () => {
      if (botonRef.current) {
        const rect = botonRef.current.getBoundingClientRect()
        setPosMenu({ top: rect.bottom + 6, left: rect.left })
      }
    }
    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
    }
  }, [abierto])

  useEffect(() => {
    if (creando) setTimeout(() => inputRef.current?.focus(), 50)
  }, [creando])

  const handleGuardarComo = async () => {
    if (!nombreNueva.trim() || !onGuardarComo) return
    setGuardando(true)
    await onGuardarComo(nombreNueva.trim(), nuevaParaTodos)
    setGuardando(false)
    setCreando(false)
    setNombreNueva('')
    setNuevaParaTodos(false)
  }

  const itemClase = 'flex items-center gap-2.5 w-full px-3 py-2 text-left text-sm transition-colors rounded-boton'

  const renderPlantilla = (p: PlantillaCorreoCompleta) => {
    const esActual = p.id === plantillaActualId
    const esPredeterminada = p.id === predeterminadaId
    const esDeEmpresa = p.disponible_para === 'todos'
    const puedeEditar = p.creado_por === usuarioId || esAdmin
    const puedeEliminar = !p.es_sistema && (p.creado_por === usuarioId || esAdmin)

    return (
      <div key={p.id} className="group flex items-center">
        <button
          onClick={() => { onSeleccionar(p.id); setAbierto(false) }}
          className={`${itemClase} flex-1 min-w-0 focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${esActual ? 'bg-marca-500/8 text-texto-marca' : 'text-texto-primario hover:bg-superficie-tarjeta'}`}
        >
          {esActual ? (
            <Check size={14} className="shrink-0 text-texto-marca" />
          ) : esPredeterminada ? (
            <Star size={14} className="shrink-0 text-insignia-advertencia" fill="currentColor" />
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span className="truncate">{p.nombre}</span>
          {p.es_sistema && (
            <Shield size={10} className="shrink-0 text-texto-terciario/50" />
          )}
        </button>

        <div className="shrink-0 flex items-center gap-0.5 pr-1.5">
          {/* Estrella predeterminada (solo admins) */}
          {onTogglePredeterminada && esAdmin && (
            <Tooltip contenido={esPredeterminada ? 'Quitar predeterminada' : 'Fijar como predeterminada'}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onTogglePredeterminada(esPredeterminada ? null : p.id)
                }}
                className={`size-6 flex items-center justify-center rounded-boton transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${esPredeterminada ? 'text-insignia-advertencia' : 'text-texto-terciario/30 hover:text-insignia-advertencia'}`}
              >
                <Star size={12} fill={esPredeterminada ? 'currentColor' : 'none'} />
              </button>
            </Tooltip>
          )}
          {/* Eliminar */}
          {puedeEliminar && onEliminar && (
            <Tooltip contenido="Eliminar">
              <button
                onClick={(e) => { e.stopPropagation(); setEliminando(p.id) }}
                className="size-6 flex items-center justify-center rounded-boton text-texto-terciario/30 hover:text-estado-error transition-colors focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
              >
                <Trash2 size={12} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative inline-flex items-center gap-1">
      {/* Trigger */}
      <button
        ref={botonRef}
        onClick={() => { setAbierto(!abierto); setCreando(false); setEliminando(null) }}
        className="flex items-center gap-1.5 text-sm transition-colors cursor-pointer rounded focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
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

      {/* Botón guardar cambios — visible cuando hay modificaciones */}
      {puedeGuardarCambios && plantillaCargada && (
        <Tooltip contenido={`Guardar cambios en "${plantillaCargada.nombre}"`}>
          <button
            onClick={async (e) => {
              e.stopPropagation()
              setGuardando(true)
              await onGuardarCambios!(plantillaCargada.id)
              setGuardando(false)
            }}
            disabled={guardando}
            className="size-7 flex items-center justify-center rounded-boton transition-all focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2"
            style={{
              color: 'var(--insignia-advertencia)',
              background: 'rgba(234, 179, 8, 0.1)',
            }}
          >
            {guardando ? <Loader2 size={14} className="animate-spin" /> : <BookmarkPlus size={14} />}
          </button>
        </Tooltip>
      )}

      {/* Menú desplegable — portal para evitar clipping */}
      {typeof window !== 'undefined' && createPortal(
      <AnimatePresence>
        {abierto && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="fixed w-80 rounded-card shadow-lg py-1.5 bg-superficie-elevada border border-borde-sutil"
            style={{ top: posMenu.top, left: posMenu.left, zIndex: 'var(--z-popover)' as unknown as number }}
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
                {plantillasEmpresa.length > 0 && (
                  <div className="px-1.5 mb-1">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 mb-0.5">
                      <Building2 size={11} style={{ color: 'var(--texto-terciario)' }} />
                      <span className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
                        De la empresa
                      </span>
                    </div>
                    {plantillasEmpresa.map(renderPlantilla)}
                  </div>
                )}

                {/* Separador si hay ambas secciones */}
                {plantillasEmpresa.length > 0 && plantillasPersonales.length > 0 && (
                  <div className="my-1" style={{ borderTop: '1px solid var(--borde-sutil)' }} />
                )}

                {/* Mis plantillas */}
                {plantillasPersonales.length > 0 && (
                  <div className="px-1.5 mb-1">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 mb-0.5">
                      <User size={11} style={{ color: 'var(--texto-terciario)' }} />
                      <span className="text-xxs font-semibold uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
                        Mis plantillas
                      </span>
                    </div>
                    {plantillasPersonales.map(renderPlantilla)}
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
                  <div className="px-3 py-2 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={inputRef}
                        type="text"
                        value={nombreNueva}
                        onChange={(e) => setNombreNueva(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleGuardarComo()
                          if (e.key === 'Escape') { setCreando(false); setNombreNueva(''); setNuevaParaTodos(false) }
                        }}
                        placeholder="Nombre de la plantilla"
                        className="flex-1 min-w-0 rounded-card px-2.5 py-1.5 text-sm outline-none transition-colors"
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
                    {esAdmin && (
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={nuevaParaTodos}
                          onChange={(e) => setNuevaParaTodos(e.target.checked)}
                          className="accent-[var(--texto-marca)]"
                        />
                        <span className="text-xs" style={{ color: 'var(--texto-secundario)' }}>
                          Disponible para todos los usuarios
                        </span>
                      </label>
                    )}
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
      </AnimatePresence>,
      document.body
      )}

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
                className="w-full max-w-sm p-5 rounded-card shadow-elevada bg-superficie-elevada border border-borde-sutil"
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
