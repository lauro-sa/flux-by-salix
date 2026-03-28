'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Boton } from '@/componentes/ui/Boton'
import {
  Inbox, Send as SendIcon, FileText, ShieldBan, Trash2, Archive,
  ChevronDown, ChevronRight, Mail, Pen, Plus,
} from 'lucide-react'
import type { CanalInbox } from '@/tipos/inbox'

/**
 * Sidebar de correo estilo cliente de email (Apple Mail / Outlook).
 * Muestra: cuentas conectadas con sus carpetas, contadores de no leídos.
 * Se usa en: page.tsx del inbox cuando tabActivo === 'correo'.
 */

// ─── Tipos ───

export type CarpetaCorreo = 'entrada' | 'enviados' | 'borradores' | 'spam' | 'archivado' | 'papelera'

interface PropiedadesSidebarCorreo {
  canales: CanalInbox[]
  canalActivo: string
  carpetaActiva: CarpetaCorreo
  onSeleccionarCanal: (canalId: string) => void
  onSeleccionarCarpeta: (carpeta: CarpetaCorreo) => void
  onRedactar: () => void
  /** Contadores de no leídos por canal */
  contadores: Record<string, { entrada: number; spam: number }>
  /** Mostrar "Todas las cuentas" como opción */
  mostrarTodas?: boolean
  canalTodas?: boolean
  onSeleccionarTodas?: () => void
}

// ─── Carpetas con iconos ───

const CARPETAS: { clave: CarpetaCorreo; etiqueta: string; icono: React.ReactNode }[] = [
  { clave: 'entrada', etiqueta: 'Entrada', icono: <Inbox size={14} /> },
  { clave: 'enviados', etiqueta: 'Enviados', icono: <SendIcon size={14} /> },
  { clave: 'spam', etiqueta: 'No deseado', icono: <ShieldBan size={14} /> },
  { clave: 'archivado', etiqueta: 'Archivado', icono: <Archive size={14} /> },
]

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
}: PropiedadesSidebarCorreo) {
  const [cuentasExpandidas, setCuentasExpandidas] = useState<Set<string>>(
    new Set(canales.map(c => c.id))
  )

  const toggleCuenta = (id: string) => {
    setCuentasExpandidas(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Total de no leídos
  const totalNoLeidos = useMemo(() => {
    return Object.values(contadores).reduce((sum, c) => sum + (c.entrada || 0), 0)
  }, [contadores])

  return (
    <div
      className="flex flex-col h-full w-56 flex-shrink-0"
      style={{
        borderRight: '1px solid var(--borde-sutil)',
        background: 'var(--superficie-sidebar, var(--superficie-tarjeta))',
      }}
    >
      {/* Botón Redactar */}
      <div className="p-3">
        <Boton
          variante="primario"
          tamano="sm"
          icono={<Pen size={14} />}
          onClick={onRedactar}
          className="w-full"
        >
          Redactar
        </Boton>
      </div>

      {/* Lista de cuentas + carpetas */}
      <div className="flex-1 overflow-y-auto px-1.5 pb-3">
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
              {totalNoLeidos > 0 && (
                <span
                  className="text-xxs font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: 'var(--insignia-peligro)',
                    color: '#fff',
                  }}
                >
                  {totalNoLeidos}
                </span>
              )}
            </button>
          </div>
        )}

        {/* Cuentas individuales */}
        {canales.map((canal) => {
          const expandida = cuentasExpandidas.has(canal.id)
          const estaActiva = canalActivo === canal.id && !canalTodas
          const config = canal.config_conexion as Record<string, unknown>
          const email = (config?.email || config?.usuario || canal.nombre) as string
          const contador = contadores[canal.id] || { entrada: 0, spam: 0 }

          return (
            <div key={canal.id} className="mb-1">
              {/* Header de cuenta */}
              <button
                onClick={() => {
                  toggleCuenta(canal.id)
                  onSeleccionarCanal(canal.id)
                }}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-colors group"
                style={{
                  color: 'var(--texto-secundario)',
                }}
              >
                {expandida ? (
                  <ChevronDown size={10} style={{ color: 'var(--texto-terciario)' }} />
                ) : (
                  <ChevronRight size={10} style={{ color: 'var(--texto-terciario)' }} />
                )}
                <span
                  className="flex-1 text-left font-semibold truncate text-xxs uppercase tracking-wider"
                  style={{ color: 'var(--texto-terciario)' }}
                >
                  {canal.nombre}
                </span>
              </button>

              {/* Carpetas de la cuenta */}
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
                      const count = carpeta.clave === 'entrada'
                        ? contador.entrada
                        : carpeta.clave === 'spam'
                          ? contador.spam
                          : 0

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
                          {count > 0 && (
                            <span
                              className="text-xxs font-bold px-1.5 py-0.5 rounded-full"
                              style={{
                                background: carpeta.clave === 'spam'
                                  ? 'var(--insignia-advertencia-fondo, rgba(234, 179, 8, 0.15))'
                                  : 'var(--insignia-peligro)',
                                color: carpeta.clave === 'spam'
                                  ? 'var(--insignia-advertencia)'
                                  : '#fff',
                              }}
                            >
                              {count}
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
      </div>
    </div>
  )
}
