'use client'

/**
 * PopoverEvento — Tarjeta flotante que muestra un resumen del evento al hacer clic.
 * Aparece como portal en el body, posicionada cerca del clic del usuario.
 * Incluye: título con punto de color, fecha/hora, ubicación, asignados, vínculos,
 * y botones de acción (editar, eliminar).
 * Se usa en: página principal del calendario al hacer clic en un evento.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, MapPin, Users, Link2, CalendarDays, Route, CheckCircle, Circle, ExternalLink } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import {
  NOMBRES_MESES_CORTOS,
  NOMBRES_DIAS_CORTOS,
  formatearHoraISO,
} from './constantes'
import type { EventoCalendario } from './tipos'

// --- Utilidades de formato ---

/** Formatea fecha corta: "Mar 8 Abr" */
function formatearFechaCorta(iso: string): string {
  const fecha = new Date(iso)
  if (isNaN(fecha.getTime())) return ''
  const dia = NOMBRES_DIAS_CORTOS[fecha.getDay()]
  const num = fecha.getDate()
  const mes = NOMBRES_MESES_CORTOS[fecha.getMonth()]
  return `${dia} ${num} ${mes}`
}

/** Formatea el rango de fecha/hora para mostrar en el popover */
function formatearRangoEvento(evento: EventoCalendario, es24h: boolean, todoElDiaLabel: string): string {
  if (evento.todo_el_dia) {
    return `${formatearFechaCorta(evento.fecha_inicio)} · ${todoElDiaLabel}`
  }
  const horaInicio = formatearHoraISO(evento.fecha_inicio, es24h)
  const horaFin = formatearHoraISO(evento.fecha_fin, es24h)
  return `${formatearFechaCorta(evento.fecha_inicio)} · ${horaInicio}–${horaFin}`
}

// --- Props ---

interface PropiedadesPopoverEvento {
  evento: EventoCalendario | null
  /** Posición relativa al viewport donde se hizo clic */
  posicion: { x: number; y: number } | null
  onEditar: () => void
  onEliminar: () => void
  onCerrar: () => void
}

/** Margen mínimo desde los bordes del viewport */
const MARGEN_VIEWPORT = 12
/** Ancho máximo del popover — limitado en móvil para no tapar la pantalla */
const ANCHO_POPOVER = 300
const ANCHO_POPOVER_MOVIL = 260

function PopoverEvento({
  evento,
  posicion,
  onEditar,
  onEliminar,
  onCerrar,
}: PropiedadesPopoverEvento) {
  const router = useRouter()
  const refPanel = useRef<HTMLDivElement>(null)
  const [montado, setMontado] = useState(false)
  const { formatoHora } = useFormato()
  const { t } = useTraduccion()
  const es24h = formatoHora !== '12h'
  const [estiloPos, setEstiloPos] = useState<React.CSSProperties>({})

  // Montar solo en cliente (necesario para createPortal)
  useEffect(() => { setMontado(true) }, [])

  // Calcular posición ajustada al viewport cuando cambian evento/posición
  useEffect(() => {
    if (!evento || !posicion) return

    // Esperar un frame para que el panel se renderice y poder medir su alto
    requestAnimationFrame(() => {
      const altoPanel = refPanel.current?.offsetHeight || 220
      // En móvil usar ancho reducido para no tapar toda la pantalla
      const anchoPanel = window.innerWidth < 640 ? Math.min(ANCHO_POPOVER_MOVIL, window.innerWidth - MARGEN_VIEWPORT * 2) : ANCHO_POPOVER

      let izquierda = posicion.x + 8
      let arriba = posicion.y + 8

      // Ajustar horizontalmente si se sale del viewport
      if (izquierda + anchoPanel > window.innerWidth - MARGEN_VIEWPORT) {
        izquierda = posicion.x - anchoPanel - 8
      }
      if (izquierda < MARGEN_VIEWPORT) {
        izquierda = MARGEN_VIEWPORT
      }

      // Ajustar verticalmente si se sale del viewport
      if (arriba + altoPanel > window.innerHeight - MARGEN_VIEWPORT) {
        arriba = posicion.y - altoPanel - 8
      }
      if (arriba < MARGEN_VIEWPORT) {
        arriba = MARGEN_VIEWPORT
      }

      setEstiloPos({
        position: 'fixed',
        left: izquierda,
        top: arriba,
        width: anchoPanel,
        zIndex: 9999,
      })
    })
  }, [evento, posicion])

  // Cerrar al hacer clic fuera del popover
  const manejarClickFuera = useCallback((e: MouseEvent) => {
    if (refPanel.current && !refPanel.current.contains(e.target as Node)) {
      onCerrar()
    }
  }, [onCerrar])

  useEffect(() => {
    if (!evento) return
    // Usar setTimeout breve para no capturar el mismo clic que abrió el popover
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', manejarClickFuera)
    }, 10)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', manejarClickFuera)
    }
  }, [evento, manejarClickFuera])

  // Cerrar con Escape
  useEffect(() => {
    if (!evento) return
    const manejar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', manejar)
    return () => document.removeEventListener('keydown', manejar)
  }, [evento, onCerrar])

  const visible = !!evento && !!posicion

  if (!montado) return null

  return createPortal(
    <AnimatePresence>
      {visible && evento && (
        <motion.div
          ref={refPanel}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 400 }}
          className="bg-superficie-elevada border border-borde-sutil rounded-xl shadow-xl max-w-xs p-4 flex flex-col gap-2.5"
          style={estiloPos}
        >
          {evento._es_recorrido ? (
            /* ── Popover de RECORRIDO ── */
            <>
              {/* Título */}
              <div className="flex items-start gap-2">
                <Route size={16} className="shrink-0 mt-0.5 text-[#8b5cf6]" />
                <span className="text-sm font-semibold text-texto-primario leading-tight">
                  {evento.titulo}
                </span>
              </div>

              {/* Fecha */}
              <div className="flex items-center gap-2 text-texto-secundario">
                <CalendarDays size={14} className="shrink-0 text-texto-terciario" />
                <span className="text-xs">{formatearRangoEvento(evento, es24h, t('calendario.todo_el_dia'))}</span>
              </div>

              {/* Asignado */}
              {evento.asignados.length > 0 && (
                <div className="flex items-center gap-2 text-texto-secundario">
                  <Users size={14} className="shrink-0 text-texto-terciario" />
                  <span className="text-xs">{evento.asignados.map(a => a.nombre).join(', ')}</span>
                </div>
              )}

              {/* Barra de progreso */}
              {evento._recorrido_meta && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-texto-terciario">
                    <span>{evento._recorrido_meta.visitas_completadas} de {evento._recorrido_meta.total_visitas} completadas</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#8b5cf6] transition-all"
                      style={{ width: `${evento._recorrido_meta.total_visitas > 0 ? (evento._recorrido_meta.visitas_completadas / evento._recorrido_meta.total_visitas) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Lista de visitas del recorrido */}
              {evento._recorrido_visitas && evento._recorrido_visitas.length > 0 && (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {evento._recorrido_visitas.map((v, i) => {
                    const completada = v.estado === 'completada'
                    return (
                      <div key={v.id} className="flex items-start gap-2 py-1">
                        <span className="text-xxs text-texto-terciario w-4 text-right shrink-0 mt-0.5">{i + 1}</span>
                        {completada
                          ? <CheckCircle size={13} className="shrink-0 mt-0.5 text-insignia-exito" />
                          : <Circle size={13} className="shrink-0 mt-0.5 text-texto-terciario" />
                        }
                        <div className="min-w-0 flex-1">
                          <span className={`text-xs leading-tight ${completada ? 'text-texto-terciario line-through' : 'text-texto-primario'}`}>
                            {v.contacto_nombre}
                          </span>
                          {v.direccion_texto && (
                            <p className="text-xxs text-texto-terciario truncate">{v.direccion_texto}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="border-t border-borde-sutil" />
              <Boton
                variante="secundario"
                tamano="sm"
                icono={<ExternalLink size={14} />}
                onClick={() => { router.push('/recorrido'); onCerrar() }}
              >
                Ver recorrido
              </Boton>
            </>
          ) : evento._es_visita ? (
            /* ── Popover de VISITA SUELTA ── */
            <>
              {/* Título */}
              <div className="flex items-start gap-2">
                <MapPin size={16} className="shrink-0 mt-0.5" style={{ color: evento.color || 'var(--texto-marca)' }} />
                <span className="text-sm font-semibold text-texto-primario leading-tight line-clamp-2">
                  {evento.titulo}
                </span>
              </div>

              {/* Fecha y hora */}
              <div className="flex items-center gap-2 text-texto-secundario">
                <CalendarDays size={14} className="shrink-0 text-texto-terciario" />
                <span className="text-xs">{formatearRangoEvento(evento, es24h, t('calendario.todo_el_dia'))}</span>
              </div>

              {/* Ubicación */}
              {evento.ubicacion && (
                <div className="flex items-center gap-2 text-texto-secundario">
                  <MapPin size={14} className="shrink-0 text-texto-terciario" />
                  <span className="text-xs truncate">{evento.ubicacion}</span>
                </div>
              )}

              {/* Asignado */}
              {evento.asignados.length > 0 && (
                <div className="flex items-center gap-2 text-texto-secundario">
                  <Users size={14} className="shrink-0 text-texto-terciario" />
                  <span className="text-xs">{evento.asignados.map(a => a.nombre).join(', ')}</span>
                </div>
              )}

              {/* Motivo */}
              {evento.descripcion && (
                <p className="text-xs text-texto-terciario">
                  Motivo: {evento.descripcion}
                </p>
              )}

              {/* Estado */}
              <div className="flex items-center gap-1.5">
                <span className={`text-xxs px-1.5 py-0.5 rounded-full font-medium ${
                  evento.estado === 'completada' ? 'bg-insignia-exito/15 text-insignia-exito' :
                  evento.estado === 'en_sitio' ? 'bg-texto-marca/15 text-texto-marca' :
                  evento.estado === 'en_camino' ? 'bg-insignia-advertencia/15 text-insignia-advertencia' :
                  'bg-white/[0.06] text-texto-terciario'
                }`}>
                  {evento.estado === 'programada' ? 'Programada' :
                   evento.estado === 'en_camino' ? 'En camino' :
                   evento.estado === 'en_sitio' ? 'En sitio' :
                   evento.estado === 'completada' ? 'Completada' :
                   evento.estado}
                </span>
              </div>

              <div className="border-t border-borde-sutil" />
              <div className="flex items-center gap-2">
                <Boton
                  variante="secundario"
                  tamano="sm"
                  icono={<Pencil size={14} />}
                  onClick={onEditar}
                >
                  Editar visita
                </Boton>
                <Boton
                  variante="fantasma"
                  tamano="sm"
                  icono={<ExternalLink size={14} />}
                  onClick={() => { router.push(`/visitas/${evento.visita_id || evento.id}`); onCerrar() }}
                >
                  Ir a visitas
                </Boton>
              </div>
            </>
          ) : (
            /* ── Popover de EVENTO NORMAL ── */
            <>
              {/* Título con punto de color */}
              <div className="flex items-start gap-2">
                <span
                  className="size-2.5 rounded-full shrink-0 mt-1.5"
                  style={{ backgroundColor: evento.color || 'var(--texto-marca)' }}
                />
                <span className="text-sm font-semibold text-texto-primario leading-tight line-clamp-2">
                  {evento.titulo}
                </span>
              </div>

              {/* Fecha y hora */}
              <div className="flex items-center gap-2 text-texto-secundario">
                <CalendarDays size={14} className="shrink-0 text-texto-terciario" />
                <span className="text-xs">{formatearRangoEvento(evento, es24h, t('calendario.todo_el_dia'))}</span>
              </div>

              {/* Ubicación (si existe) */}
              {evento.ubicacion && (
                <div className="flex items-center gap-2 text-texto-secundario">
                  <MapPin size={14} className="shrink-0 text-texto-terciario" />
                  <span className="text-xs truncate">{evento.ubicacion}</span>
                </div>
              )}

              {/* Asignados (si existen) */}
              {evento.asignados.length > 0 && (
                <div className="flex items-center gap-2 text-texto-secundario">
                  <Users size={14} className="shrink-0 text-texto-terciario" />
                  <span className="text-xs truncate">
                    {evento.asignados.map((a) => a.nombre).join(', ')}
                  </span>
                </div>
              )}

              {/* Vínculos (si existen) */}
              {evento.vinculos.length > 0 && (
                <div className="flex items-center gap-2 text-texto-secundario">
                  <Link2 size={14} className="shrink-0 text-texto-terciario" />
                  <span className="text-xs truncate">
                    {evento.vinculos.map((v) => `${v.tipo}: ${v.nombre}`).join(', ')}
                  </span>
                </div>
              )}

              {/* Descripción (preview breve, si existe) */}
              {evento.descripcion && (
                <p className="text-xs text-texto-terciario line-clamp-2 leading-relaxed">
                  {evento.descripcion}
                </p>
              )}

              {/* Separador */}
              <div className="border-t border-borde-sutil" />

              {/* Acciones */}
              <div className="flex items-center gap-2">
                <Boton
                  variante="secundario"
                  tamano="sm"
                  icono={<Pencil size={14} />}
                  onClick={onEditar}
                >
                  Editar
                </Boton>
                <Boton
                  variante="fantasma"
                  tamano="sm"
                  icono={<Trash2 size={14} />}
                  onClick={onEliminar}
                  className="text-estado-error hover:text-estado-error"
                >
                  Eliminar
                </Boton>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export { PopoverEvento }
export type { PropiedadesPopoverEvento }
