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
import { Pencil, Trash2, MapPin, Users, Link2, CalendarDays } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { useFormato } from '@/hooks/useFormato'
import type { EventoCalendario } from './tipos'

// --- Utilidades de formato ---

/** Nombres de meses en español (abreviados) */
const MESES_CORTOS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

/** Nombres de días de la semana (abreviados) */
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** Formatea hora desde ISO respetando formato de empresa (12h/24h) */
function formatearHora(iso: string, formatoHora: string = '24h'): string {
  const fecha = new Date(iso)
  if (isNaN(fecha.getTime())) return ''
  return fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: formatoHora === '12h' })
}

/** Formatea fecha corta: "Mar 8 Abr" */
function formatearFechaCorta(iso: string): string {
  const fecha = new Date(iso)
  if (isNaN(fecha.getTime())) return ''
  const dia = DIAS_CORTOS[fecha.getDay()]
  const num = fecha.getDate()
  const mes = MESES_CORTOS[fecha.getMonth()]
  return `${dia} ${num} ${mes}`
}

/** Formatea el rango de fecha/hora para mostrar en el popover */
function formatearRangoEvento(evento: EventoCalendario, formatoHora: string = '24h'): string {
  if (evento.todo_el_dia) {
    return `${formatearFechaCorta(evento.fecha_inicio)} · Todo el día`
  }
  const horaInicio = formatearHora(evento.fecha_inicio, formatoHora)
  const horaFin = formatearHora(evento.fecha_fin, formatoHora)
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
/** Ancho máximo del popover */
const ANCHO_POPOVER = 300

function PopoverEvento({
  evento,
  posicion,
  onEditar,
  onEliminar,
  onCerrar,
}: PropiedadesPopoverEvento) {
  const refPanel = useRef<HTMLDivElement>(null)
  const [montado, setMontado] = useState(false)
  const { formatoHora } = useFormato()
  const [estiloPos, setEstiloPos] = useState<React.CSSProperties>({})

  // Montar solo en cliente (necesario para createPortal)
  useEffect(() => { setMontado(true) }, [])

  // Calcular posición ajustada al viewport cuando cambian evento/posición
  useEffect(() => {
    if (!evento || !posicion) return

    // Esperar un frame para que el panel se renderice y poder medir su alto
    requestAnimationFrame(() => {
      const altoPanel = refPanel.current?.offsetHeight || 220
      const anchoPanel = ANCHO_POPOVER

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
            <span className="text-xs">{formatearRangoEvento(evento, formatoHora)}</span>
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
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

export { PopoverEvento }
export type { PropiedadesPopoverEvento }
