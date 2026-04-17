'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
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
  /** Modo móvil: items más grandes para zona táctil */
  esMovil?: boolean
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
  esMovil = false,
}: PropiedadesSidebarCorreo) {
  const { t } = useTraduccion()
  const { preferencias, guardar: guardarPreferencia } = usePreferencias()

  // Leer config de inbox desde preferencias (BD)
  const configInbox = (preferencias.config_tablas?.[CLAVE_CONFIG_INBOX] || {}) as {
    orden_cuentas?: string[]
    cuentas_expandidas?: string[]
  }
  // Ref para evitar que el effect de canales sobreescriba el orden de BD
  const ordenCargadoDeBDRef = useRef(false)

  // Orden personalizado de cuentas (persistido en BD via preferencias)
  const [ordenCanales, setOrdenCanales] = useState<string[]>(() => {
    return configInbox.orden_cuentas || canales.map(c => c.id)
  })

  // Sincronizar con preferencias cuando se cargan desde BD
  useEffect(() => {
    if (configInbox.orden_cuentas?.length) {
      ordenCargadoDeBDRef.current = true
      // Mergear: mantener orden de BD, agregar canales nuevos al final
      const idsGuardados = new Set(configInbox.orden_cuentas)
      const idsActuales = new Set(canales.map(c => c.id))
      const ordenFinal = configInbox.orden_cuentas.filter(id => idsActuales.has(id))
      for (const c of canales) {
        if (!idsGuardados.has(c.id)) ordenFinal.push(c.id)
      }
      setOrdenCanales(ordenFinal)
    }
  }, [JSON.stringify(configInbox.orden_cuentas), canales])

  // Actualizar orden cuando cambian los canales (solo si BD no cargó todavía)
  useEffect(() => {
    if (ordenCargadoDeBDRef.current) return
    setOrdenCanales(prev => {
      const idsActuales = new Set(canales.map(c => c.id))
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
  const guardarConfigInbox = useCallback((cambios: Record<string, unknown>) => {
    guardarPreferencia({
      config_tablas: {
        ...preferencias.config_tablas,
        [CLAVE_CONFIG_INBOX]: {
          ...configInbox,
          ...cambios,
        },
      },
    })
  }, [JSON.stringify(configInbox), preferencias.config_tablas, guardarPreferencia])

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

  // Agregar canales nuevos al set de expandidos
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

  // Tamaños adaptativos según móvil o desktop
  const tamanoBtn = esMovil ? 'md' as const : 'sm' as const
  const claseTexto = esMovil ? 'text-sm' : 'text-xs'
  const claseTextoChico = esMovil ? 'text-xs' : 'text-xxs'

  return (
    <div className="flex flex-col h-full">
      {/* Redactar */}
      <div className={`${colapsado ? 'p-1.5 flex flex-col items-center' : esMovil ? 'p-4' : 'p-3'}`}>
        {colapsado ? (
          <Boton variante="primario" tamano="sm" soloIcono titulo="Redactar" icono={<Pen size={16} />} onClick={onRedactar} />
        ) : (
          <Boton variante="primario" tamano={tamanoBtn} icono={<Pen size={esMovil ? 16 : 14} />} onClick={onRedactar} className="w-full">
            {t('inbox.redactar')}
          </Boton>
        )}
      </div>

      {/* Carpetas */}
      <div className={`flex-1 overflow-y-auto ${colapsado ? 'px-1' : 'px-1.5'} pb-3`} style={{ overscrollBehaviorY: 'contain' }}>
        {colapsado ? (
          /* Modo colapsado: solo iconos */
          <div className="space-y-0.5">
            {CARPETAS.map((carpeta) => {
              const activa = carpetaActiva === carpeta.clave
              return (
                <Boton
                  key={carpeta.clave}
                  variante="fantasma"
                  tamano="sm"
                  soloIcono
                  icono={carpeta.icono}
                  onClick={() => onSeleccionarCarpeta(carpeta.clave)}
                  titulo={t(carpeta.claveI18n)}
                  style={{
                    color: activa ? 'var(--texto-marca)' : 'var(--texto-terciario)',
                    background: activa ? 'var(--superficie-seleccionada)' : 'transparent',
                  }}
                  className="mx-auto"
                />
              )
            })}
          </div>
        ) : (
          <>
            {/* Estado vacío: sin cuentas conectadas */}
            {canales.length === 0 && (
              <div className={`${esMovil ? 'p-4' : 'p-3'} text-center`}>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2"
                  style={{ background: 'var(--superficie-hover)' }}
                >
                  <Mail size={18} style={{ color: 'var(--texto-terciario)' }} />
                </div>
                <p className="text-xs mb-1" style={{ color: 'var(--texto-secundario)' }}>
                  Sin cuentas conectadas
                </p>
                <p className="text-xxs mb-3" style={{ color: 'var(--texto-terciario)' }}>
                  Conectá tu correo desde configuración para empezar a recibir y enviar emails.
                </p>
              </div>
            )}

            {/* Todas las cuentas */}
            {mostrarTodas && canales.length > 1 && (
              <div className={esMovil ? 'mb-3' : 'mb-2'}>
                <Boton
                  variante="fantasma"
                  tamano={tamanoBtn}
                  anchoCompleto
                  icono={<Mail size={esMovil ? 18 : 14} />}
                  onClick={onSeleccionarTodas}
                  className={`${claseTexto} font-semibold`}
                  style={{
                    color: canalTodas ? 'var(--texto-marca)' : 'var(--texto-secundario)',
                    background: canalTodas ? 'var(--superficie-seleccionada)' : 'transparent',
                  }}
                >
                  <span className="flex items-center gap-2 w-full">
                    <span className="flex-1 text-left">Todas las cuentas</span>
                    {totales.sinLeer > 0 && (
                      <span className="text-xxs font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--insignia-peligro)', color: 'var(--texto-inverso)' }}>
                        {totales.sinLeer}
                      </span>
                    )}
                  </span>
                </Boton>
              </div>
            )}

            {/* Cuentas (reordenables con drag) */}
            <Reorder.Group axis="y" values={ordenCanales} onReorder={handleReorder} className="space-y-0">
            {canalesOrdenados.map((canal) => {
              const expandida = cuentasExpandidas.has(canal.id)
              const estaActiva = canalActivo === canal.id && !canalTodas

              return (
                <Reorder.Item key={canal.id} value={canal.id} className={`${esMovil ? 'mb-2' : 'mb-1'} list-none`}>
                  <Boton
                    variante="fantasma"
                    tamano={tamanoBtn}
                    anchoCompleto
                    onClick={() => {
                      toggleCuenta(canal.id)
                      onSeleccionarCanal(canal.id)
                    }}
                    className={`${claseTexto} group`}
                  >
                    <span className={`flex items-center ${esMovil ? 'gap-2.5' : 'gap-1.5'} w-full`}>
                      {!esMovil && <GripVertical size={10} className="cursor-grab opacity-30 sm:opacity-0 group-hover:opacity-50 transition-opacity" style={{ color: 'var(--texto-terciario)' }} />}
                      {expandida ? (
                        <ChevronDown size={esMovil ? 14 : 10} style={{ color: 'var(--texto-terciario)' }} />
                      ) : (
                        <ChevronRight size={esMovil ? 14 : 10} style={{ color: 'var(--texto-terciario)' }} />
                      )}
                      <span className={`flex-1 text-left font-semibold truncate ${esMovil ? 'text-xs' : 'text-xxs'} tracking-wide`} style={{ color: 'var(--texto-secundario)' }}>
                        {canal.nombre}
                      </span>
                    </span>
                  </Boton>

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
                            <Boton
                              key={carpeta.clave}
                              variante="fantasma"
                              tamano={tamanoBtn}
                              anchoCompleto
                              onClick={() => {
                                onSeleccionarCanal(canal.id)
                                onSeleccionarCarpeta(carpeta.clave)
                              }}
                              className={`${esMovil ? 'pl-8 pr-3' : 'pl-6 pr-2.5'} ${claseTexto}`}
                              style={{
                                color: activa ? 'var(--texto-marca)' : 'var(--texto-secundario)',
                                background: activa ? 'var(--superficie-seleccionada)' : 'transparent',
                                fontWeight: activa ? 600 : 400,
                              }}
                            >
                              <span className="flex items-center gap-2 w-full">
                                <span style={{ color: activa ? 'var(--texto-marca)' : 'var(--texto-terciario)' }}>
                                  {carpeta.icono}
                                </span>
                                <span className="flex-1 text-left">{t(carpeta.claveI18n)}</span>
                                {/* Mostrar total de la carpeta + sin leer si hay */}
                                {total > 0 && (
                                  <span
                                    className={`${claseTextoChico} px-1.5 py-0.5 rounded-full font-medium`}
                                    style={{
                                      background: sinLeer > 0
                                        ? (carpeta.clave === 'spam' ? 'var(--insignia-advertencia-fondo, rgba(234, 179, 8, 0.15))' : 'var(--insignia-peligro)')
                                        : 'var(--superficie-hover)',
                                      color: sinLeer > 0
                                        ? (carpeta.clave === 'spam' ? 'var(--insignia-advertencia)' : 'var(--texto-inverso)')
                                        : 'var(--texto-terciario)',
                                    }}
                                  >
                                    {sinLeer > 0 ? sinLeer : total}
                                  </span>
                                )}
                              </span>
                            </Boton>
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
