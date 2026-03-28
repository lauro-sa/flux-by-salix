'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boton } from '@/componentes/ui/Boton'
import {
  Inbox, Send as SendIcon, ShieldBan, Archive,
  ChevronDown, ChevronRight, Mail, Pen,
} from 'lucide-react'
import type { CanalInbox } from '@/tipos/inbox'

/**
 * Sidebar de correo estilo cliente de email.
 * Muestra cuentas con carpetas, contadores totales y sin leer.
 * Estado expandido de cuentas se persiste en localStorage.
 */

export type CarpetaCorreo = 'entrada' | 'enviados' | 'borradores' | 'spam' | 'archivado' | 'papelera'

interface ContadorCarpeta {
  entrada: number
  entrada_total: number
  enviados_total: number
  spam: number
  spam_total: number
  archivado_total: number
}

interface PropiedadesSidebarCorreo {
  canales: CanalInbox[]
  canalActivo: string
  carpetaActiva: CarpetaCorreo
  onSeleccionarCanal: (canalId: string) => void
  onSeleccionarCarpeta: (carpeta: CarpetaCorreo) => void
  onRedactar: () => void
  contadores: Record<string, ContadorCarpeta | { entrada: number; spam: number }>
  mostrarTodas?: boolean
  canalTodas?: boolean
  onSeleccionarTodas?: () => void
  colapsado?: boolean
}

const CARPETAS: { clave: CarpetaCorreo; etiqueta: string; icono: React.ReactNode }[] = [
  { clave: 'entrada', etiqueta: 'Entrada', icono: <Inbox size={14} /> },
  { clave: 'enviados', etiqueta: 'Enviados', icono: <SendIcon size={14} /> },
  { clave: 'spam', etiqueta: 'No deseado', icono: <ShieldBan size={14} /> },
  { clave: 'archivado', etiqueta: 'Archivado', icono: <Archive size={14} /> },
]

const STORAGE_KEY = 'flux_inbox_cuentas_expandidas'

export function SidebarCorreo({
  canales,
  canalActivo,
  carpetaActiva,
  onSeleccionarCanal,
  onSeleccionarCarpeta,
  onRedactar,
  contadores,
  mostrarTodas = true,
  canalTodas = false,
  onSeleccionarTodas,
  colapsado = false,
}: PropiedadesSidebarCorreo) {
  // Persistir estado expandido de cuentas
  const [cuentasExpandidas, setCuentasExpandidas] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set(canales.map(c => c.id))
    try {
      const guardado = localStorage.getItem(STORAGE_KEY)
      if (guardado) return new Set(JSON.parse(guardado))
    } catch { /* fallback */ }
    return new Set(canales.map(c => c.id))
  })

  // Agregar canales nuevos al set
  useEffect(() => {
    setCuentasExpandidas(prev => {
      const next = new Set(prev)
      let cambio = false
      for (const c of canales) {
        if (!next.has(c.id) && prev.size === 0) {
          next.add(c.id)
          cambio = true
        }
      }
      return cambio ? next : prev
    })
  }, [canales])

  const toggleCuenta = useCallback((id: string) => {
    setCuentasExpandidas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      return next
    })
  }, [])

  // Totales
  const totales = useMemo(() => {
    let sinLeer = 0
    let entrada = 0
    let enviados = 0
    let spam = 0
    let archivado = 0
    for (const c of Object.values(contadores)) {
      sinLeer += c.entrada || 0
      entrada += (c as ContadorCarpeta).entrada_total || 0
      enviados += (c as ContadorCarpeta).enviados_total || 0
      spam += (c as ContadorCarpeta).spam_total || 0
      archivado += (c as ContadorCarpeta).archivado_total || 0
    }
    return { sinLeer, entrada, enviados, spam, archivado }
  }, [contadores])

  /** Obtiene el conteo para una carpeta de un canal */
  const contarCarpeta = (canalId: string, carpeta: CarpetaCorreo): { sinLeer: number; total: number } => {
    const c = (contadores[canalId] || {}) as ContadorCarpeta
    switch (carpeta) {
      case 'entrada': return { sinLeer: c.entrada || 0, total: c.entrada_total || 0 }
      case 'enviados': return { sinLeer: 0, total: c.enviados_total || 0 }
      case 'spam': return { sinLeer: c.spam || 0, total: c.spam_total || 0 }
      case 'archivado': return { sinLeer: 0, total: c.archivado_total || 0 }
      default: return { sinLeer: 0, total: 0 }
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Redactar */}
      <div className={`${colapsado ? 'p-1.5 flex flex-col items-center' : 'p-3'}`}>
        {colapsado ? (
          <button
            onClick={onRedactar}
            className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--texto-marca)', color: '#fff' }}
          >
            <Pen size={16} />
          </button>
        ) : (
          <Boton variante="primario" tamano="sm" icono={<Pen size={14} />} onClick={onRedactar} className="w-full">
            Redactar
          </Boton>
        )}
      </div>

      {/* Carpetas */}
      <div className={`flex-1 overflow-y-auto ${colapsado ? 'px-1' : 'px-1.5'} pb-3`}>
        {colapsado ? (
          /* Modo colapsado: solo iconos */
          <div className="space-y-0.5">
            {CARPETAS.map((carpeta) => {
              const activa = carpetaActiva === carpeta.clave
              return (
                <button
                  key={carpeta.clave}
                  onClick={() => onSeleccionarCarpeta(carpeta.clave)}
                  className="flex items-center justify-center w-9 h-9 mx-auto rounded-lg transition-colors"
                  style={{
                    color: activa ? 'var(--texto-marca)' : 'var(--texto-terciario)',
                    background: activa ? 'var(--superficie-seleccionada)' : 'transparent',
                  }}
                  title={carpeta.etiqueta}
                >
                  {carpeta.icono}
                </button>
              )
            })}
          </div>
        ) : (
          <>
            {/* Todas las cuentas */}
            {mostrarTodas && canales.length > 1 && (
              <div className="mb-2">
                <button
                  onClick={onSeleccionarTodas}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-colors"
                  style={{
                    color: canalTodas ? 'var(--texto-marca)' : 'var(--texto-secundario)',
                    background: canalTodas ? 'var(--superficie-seleccionada)' : 'transparent',
                  }}
                >
                  <Mail size={14} />
                  <span className="flex-1 text-left">Todas las cuentas</span>
                  {totales.sinLeer > 0 && (
                    <span className="text-xxs font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--insignia-peligro)', color: '#fff' }}>
                      {totales.sinLeer}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Cuentas */}
            {canales.map((canal) => {
              const expandida = cuentasExpandidas.has(canal.id)
              const estaActiva = canalActivo === canal.id && !canalTodas

              return (
                <div key={canal.id} className="mb-1">
                  <button
                    onClick={() => {
                      toggleCuenta(canal.id)
                      onSeleccionarCanal(canal.id)
                    }}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-colors"
                  >
                    {expandida ? (
                      <ChevronDown size={10} style={{ color: 'var(--texto-terciario)' }} />
                    ) : (
                      <ChevronRight size={10} style={{ color: 'var(--texto-terciario)' }} />
                    )}
                    <span className="flex-1 text-left font-semibold truncate text-xxs uppercase tracking-wider" style={{ color: 'var(--texto-terciario)' }}>
                      {canal.nombre}
                    </span>
                  </button>

                  <AnimatePresence>
                    {expandida && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        {CARPETAS.map((carpeta) => {
                          const activa = estaActiva && carpetaActiva === carpeta.clave
                          const { sinLeer, total } = contarCarpeta(canal.id, carpeta.clave)

                          return (
                            <button
                              key={carpeta.clave}
                              onClick={() => {
                                onSeleccionarCanal(canal.id)
                                onSeleccionarCarpeta(carpeta.clave)
                              }}
                              className="w-full flex items-center gap-2 pl-6 pr-2.5 py-1.5 rounded-md text-xs transition-colors"
                              style={{
                                color: activa ? 'var(--texto-marca)' : 'var(--texto-secundario)',
                                background: activa ? 'var(--superficie-seleccionada)' : 'transparent',
                                fontWeight: activa ? 600 : 400,
                              }}
                            >
                              <span style={{ color: activa ? 'var(--texto-marca)' : 'var(--texto-terciario)' }}>
                                {carpeta.icono}
                              </span>
                              <span className="flex-1 text-left">{carpeta.etiqueta}</span>
                              {/* Mostrar total de la carpeta + sin leer si hay */}
                              {total > 0 && (
                                <span
                                  className="text-xxs px-1.5 py-0.5 rounded-full font-medium"
                                  style={{
                                    background: sinLeer > 0
                                      ? (carpeta.clave === 'spam' ? 'var(--insignia-advertencia-fondo, rgba(234, 179, 8, 0.15))' : 'var(--insignia-peligro)')
                                      : 'var(--superficie-hover)',
                                    color: sinLeer > 0
                                      ? (carpeta.clave === 'spam' ? 'var(--insignia-advertencia)' : '#fff')
                                      : 'var(--texto-terciario)',
                                  }}
                                >
                                  {sinLeer > 0 ? sinLeer : total}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
