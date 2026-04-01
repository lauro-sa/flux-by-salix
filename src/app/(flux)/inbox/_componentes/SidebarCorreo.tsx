'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { Boton } from '@/componentes/ui/Boton'
import {
  Inbox, Send as SendIcon, ShieldBan, Archive,
  ChevronDown, ChevronRight, Mail, Pen, GripVertical,
} from 'lucide-react'
import type { CanalInbox } from '@/tipos/inbox'
import { useTraduccion } from '@/lib/i18n'
import { usePreferencias } from '@/hooks/usePreferencias'

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

/** Claves i18n se resuelven en render con t() */
const CARPETAS: { clave: CarpetaCorreo; claveI18n: string; icono: React.ReactNode }[] = [
  { clave: 'entrada', claveI18n: 'inbox.bandeja_compartida', icono: <Inbox size={14} /> },
  { clave: 'enviados', claveI18n: 'inbox.enviados', icono: <SendIcon size={14} /> },
  { clave: 'spam', claveI18n: 'inbox.estado.spam', icono: <ShieldBan size={14} /> },
  { clave: 'archivado', claveI18n: 'inbox.archivar', icono: <Archive size={14} /> },
]

const CLAVE_CONFIG_INBOX = '__inbox_correo'

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
  const { t } = useTraduccion()
  const { preferencias, guardar: guardarPreferencia } = usePreferencias()

  // Leer config de inbox desde preferencias (BD)
  const configInbox = (preferencias.config_tablas?.[CLAVE_CONFIG_INBOX] || {}) as {
    orden_cuentas?: string[]
    cuentas_expandidas?: string[]
  }

  // Orden personalizado de cuentas (persistido en BD via preferencias)
  const [ordenCanales, setOrdenCanales] = useState<string[]>(() => {
    return configInbox.orden_cuentas || canales.map(c => c.id)
  })

  // Sincronizar con preferencias cuando se cargan desde BD
  useEffect(() => {
    if (configInbox.orden_cuentas?.length) {
      setOrdenCanales(configInbox.orden_cuentas)
    }
  }, [JSON.stringify(configInbox.orden_cuentas)])

  // Actualizar orden cuando cambian los canales
  useEffect(() => {
    setOrdenCanales(prev => {
      const idsActuales = new Set(canales.map(c => c.id))
      // Mantener orden existente, agregar nuevos al final
      const ordenFiltrado = prev.filter(id => idsActuales.has(id))
      for (const c of canales) {
        if (!ordenFiltrado.includes(c.id)) ordenFiltrado.push(c.id)
      }
      return ordenFiltrado
    })
  }, [canales])

  const canalesOrdenados = useMemo(() => {
    const mapa = new Map(canales.map(c => [c.id, c]))
    return ordenCanales.map(id => mapa.get(id)).filter(Boolean) as CanalInbox[]
  }, [canales, ordenCanales])

  /** Guarda la config del inbox en preferencias (BD + localStorage) */
  const guardarConfigInbox = useCallback((cambios: Partial<typeof configInbox>) => {
    const nuevaConfig = { ...configInbox, ...cambios }
    guardarPreferencia({
      config_tablas: {
        ...preferencias.config_tablas,
        [CLAVE_CONFIG_INBOX]: nuevaConfig as Record<string, unknown>,
      },
    })
  }, [configInbox, preferencias.config_tablas, guardarPreferencia])

  const handleReorder = useCallback((nuevoOrden: string[]) => {
    setOrdenCanales(nuevoOrden)
    guardarConfigInbox({ orden_cuentas: nuevoOrden })
  }, [guardarConfigInbox])

  // Estado expandido de cuentas (persistido en BD via preferencias)
  const [cuentasExpandidas, setCuentasExpandidas] = useState<Set<string>>(() => {
    return new Set(configInbox.cuentas_expandidas || canales.map(c => c.id))
  })

  // Sincronizar con preferencias cuando se cargan desde BD
  useEffect(() => {
    if (configInbox.cuentas_expandidas) {
      setCuentasExpandidas(new Set(configInbox.cuentas_expandidas))
    }
  }, [JSON.stringify(configInbox.cuentas_expandidas)])

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
      guardarConfigInbox({ cuentas_expandidas: [...next] })
      return next
    })
  }, [guardarConfigInbox])

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
            style={{ background: 'var(--texto-marca)', color: 'var(--texto-inverso)' }}
          >
            <Pen size={16} />
          </button>
        ) : (
          <Boton variante="primario" tamano="sm" icono={<Pen size={14} />} onClick={onRedactar} className="w-full">
            {t('inbox.redactar')}
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
                  title={t(carpeta.claveI18n)}
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
                    <span className="text-xxs font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--insignia-peligro)', color: 'var(--texto-inverso)' }}>
                      {totales.sinLeer}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* Cuentas (reordenables con drag) */}
            <Reorder.Group axis="y" values={ordenCanales} onReorder={handleReorder} className="space-y-0">
            {canalesOrdenados.map((canal) => {
              const expandida = cuentasExpandidas.has(canal.id)
              const estaActiva = canalActivo === canal.id && !canalTodas

              return (
                <Reorder.Item key={canal.id} value={canal.id} className="mb-1 list-none">
                  <button
                    onClick={() => {
                      toggleCuenta(canal.id)
                      onSeleccionarCanal(canal.id)
                    }}
                    className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs transition-colors group"
                  >
                    <GripVertical size={10} className="cursor-grab opacity-30 sm:opacity-0 group-hover:opacity-50 transition-opacity" style={{ color: 'var(--texto-terciario)' }} />
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
                              <span className="flex-1 text-left">{t(carpeta.claveI18n)}</span>
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
                </Reorder.Item>
              )
            })}
            </Reorder.Group>
          </>
        )}
      </div>
    </div>
  )
}
