'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock, Sun, Calendar, CalendarClock, X, AlertCircle,
} from 'lucide-react'
import { Popover } from '@/componentes/ui/Popover'
import { Tooltip } from '@/componentes/ui/Tooltip'
import { Boton } from '@/componentes/ui/Boton'
import { useFormato } from '@/hooks/useFormato'

/**
 * PopoverProgramar — Permite programar el envío de un mensaje de WhatsApp
 * para una fecha y hora futura. Ofrece presets rápidos y selector personalizado.
 * Se usa en: CompositorMensaje (junto al botón de enviar).
 */

interface ProgramadoPendiente {
  id: string
  enviar_en: string
  texto: string | null
}

interface PropiedadesPopoverProgramar {
  /** Callback al seleccionar fecha/hora. Recibe ISO string */
  onProgramar: (fechaHora: string) => void
  /** Callback para cancelar un mensaje programado pendiente */
  onCancelar?: () => void
  /** Mensaje programado pendiente (si existe) */
  programadoPendiente?: ProgramadoPendiente | null
  /** Trigger personalizado — si se pasa, reemplaza el botón default */
  children?: React.ReactNode
  /** Clase CSS para el wrapper del trigger en el Popover interno */
  claseTrigger?: string
  /** Si true, renderiza el contenido inline sin Popover wrapper */
  renderInline?: boolean
}

// Funciones de formateo que reciben el locale de la empresa
function formatearFechaCompleta(fecha: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha)
}

function formatearHoraCorta(fecha: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha)
}

function formatearDiaHora(fecha: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(fecha)
}

/** Calcula el próximo lunes a las 9:00 desde la fecha actual */
function proximoLunes(): Date {
  const ahora = new Date()
  const dia = ahora.getDay() // 0=dom, 1=lun, ..., 6=sab
  // Días hasta el próximo lunes
  const diasHastaLunes = dia === 0 ? 1 : dia === 1 ? 7 : 8 - dia
  const fecha = new Date(ahora)
  fecha.setDate(fecha.getDate() + diasHastaLunes)
  fecha.setHours(9, 0, 0, 0)
  return fecha
}

/** Calcula mañana a las 9:00 */
function manana9am(): Date {
  const fecha = new Date()
  fecha.setDate(fecha.getDate() + 1)
  fecha.setHours(9, 0, 0, 0)
  return fecha
}

/** Convierte fecha local a string válido para datetime-local input */
function fechaAInputLocal(fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  const hora = String(fecha.getHours()).padStart(2, '0')
  const minuto = String(fecha.getMinutes()).padStart(2, '0')
  return `${anio}-${mes}-${dia}T${hora}:${minuto}`
}

/** Verifica si una fecha es hoy */
function esHoy(fecha: Date): boolean {
  const ahora = new Date()
  return fecha.toDateString() === ahora.toDateString()
}

/** Texto descriptivo de la hora calculada para cada preset */
function textoHoraPreset(fecha: Date, locale: string): string {
  if (esHoy(fecha)) {
    return `hoy ${formatearHoraCorta(fecha, locale)}`
  }
  return formatearDiaHora(fecha, locale)
}

interface PresetProgramacion {
  etiqueta: string
  descripcion: string
  icono: React.ReactNode
  calcularFecha: () => Date
}

export function PopoverProgramar({
  onProgramar,
  onCancelar,
  programadoPendiente,
  children,
  claseTrigger,
  renderInline,
}: PropiedadesPopoverProgramar) {
  const formato = useFormato()
  const [mostrarPersonalizado, setMostrarPersonalizado] = useState(false)
  const [fechaPersonalizada, setFechaPersonalizada] = useState('')
  const [abierto, setAbierto] = useState(false)

  // Presets de programación con sus cálculos
  const presets: PresetProgramacion[] = useMemo(() => [
    {
      etiqueta: 'En 30 minutos',
      descripcion: 'Enviar pronto, con un pequeño retraso',
      icono: <Clock size={16} />,
      calcularFecha: () => new Date(Date.now() + 30 * 60 * 1000),
    },
    {
      etiqueta: 'En 1 hora',
      descripcion: 'Dar tiempo antes de enviar',
      icono: <Clock size={16} />,
      calcularFecha: () => new Date(Date.now() + 60 * 60 * 1000),
    },
    {
      etiqueta: 'En 3 horas',
      descripcion: 'Enviar más tarde hoy',
      icono: <Clock size={16} />,
      calcularFecha: () => new Date(Date.now() + 3 * 60 * 60 * 1000),
    },
    {
      etiqueta: 'Mañana a las 9:00',
      descripcion: 'Enviar al inicio del próximo día laboral',
      icono: <Sun size={16} />,
      calcularFecha: manana9am,
    },
    {
      etiqueta: 'Próximo lunes 9:00',
      descripcion: 'Enviar al inicio de la próxima semana',
      icono: <Calendar size={16} />,
      calcularFecha: proximoLunes,
    },
  ], [])

  // Mínimo para el input datetime-local: ahora + 5 minutos
  const minimoFecha = useMemo(() => {
    const min = new Date(Date.now() + 5 * 60 * 1000)
    return fechaAInputLocal(min)
  }, [])

  const handleSeleccionarPreset = useCallback((preset: PresetProgramacion) => {
    const fecha = preset.calcularFecha()
    onProgramar(fecha.toISOString())
    setAbierto(false)
    setMostrarPersonalizado(false)
  }, [onProgramar])

  const handleFechaPersonalizada = useCallback(() => {
    if (!fechaPersonalizada) return
    const fecha = new Date(fechaPersonalizada)
    // Validar que sea futura
    if (fecha.getTime() <= Date.now()) return
    onProgramar(fecha.toISOString())
    setAbierto(false)
    setMostrarPersonalizado(false)
    setFechaPersonalizada('')
  }, [fechaPersonalizada, onProgramar])

  const handleCancelar = useCallback(() => {
    onCancelar?.()
    setAbierto(false)
  }, [onCancelar])

  // Contenido del popover
  const contenido = (
    <div className="flex flex-col" style={{ minWidth: 280 }}>
      {/* Encabezado con texto de ayuda */}
      <div className="px-4 pt-3 pb-2">
        <p
          className="text-sm font-semibold"
          style={{ color: 'var(--texto-primario)' }}
        >
          Programar envío
        </p>
        <p
          className="text-xs mt-0.5 leading-relaxed"
          style={{ color: 'var(--texto-terciario)' }}
        >
          El mensaje se enviará automáticamente en la fecha y hora que elijas
        </p>
      </div>

      {/* Banner de mensaje programado pendiente */}
      <AnimatePresence>
        {programadoPendiente && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3"
          >
            <div
              className="rounded-xl p-3 mb-2 flex flex-col gap-2"
              style={{
                background: 'color-mix(in srgb, var(--texto-marca) 8%, transparent)',
                border: '1px solid color-mix(in srgb, var(--texto-marca) 20%, transparent)',
              }}
            >
              {/* Info del mensaje programado */}
              <div className="flex items-start gap-2">
                <AlertCircle
                  size={14}
                  className="flex-shrink-0 mt-0.5"
                  style={{ color: 'var(--texto-marca)' }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-medium"
                    style={{ color: 'var(--texto-marca)' }}
                  >
                    Mensaje programado para{' '}
                    {formatearFechaCompleta(new Date(programadoPendiente.enviar_en), formato.locale)}
                  </p>
                  {programadoPendiente.texto && (
                    <p
                      className="text-xs mt-1 truncate"
                      style={{ color: 'var(--texto-secundario)' }}
                    >
                      {programadoPendiente.texto}
                    </p>
                  )}
                </div>
              </div>

              {/* Botón cancelar envío */}
              <button
                onClick={handleCancelar}
                className="text-xs font-medium py-1.5 px-3 rounded-lg transition-colors self-start"
                style={{
                  color: 'var(--insignia-peligro)',
                  background: 'color-mix(in srgb, var(--insignia-peligro) 10%, transparent)',
                  minHeight: 44,
                }}
              >
                Cancelar envío
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Separador si hay mensaje pendiente */}
      {programadoPendiente && (
        <div
          className="mx-3 mb-1"
          style={{ borderBottom: '1px solid var(--borde-sutil)' }}
        />
      )}

      {/* Lista de presets */}
      <div className="px-2 py-1">
        {presets.map((preset) => {
          const fechaCalculada = preset.calcularFecha()
          return (
            <button
              key={preset.etiqueta}
              onClick={() => handleSeleccionarPreset(preset)}
              className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-colors text-left hover:bg-superficie-hover"
              style={{ minHeight: 44 }}
            >
              <span
                className="flex-shrink-0"
                style={{ color: 'var(--texto-secundario)' }}
              >
                {preset.icono}
              </span>
              <div className="flex-1 min-w-0">
                <p
                  className="text-sm font-medium"
                  style={{ color: 'var(--texto-primario)' }}
                >
                  {preset.etiqueta}
                </p>
                <p
                  className="text-xs"
                  style={{ color: 'var(--texto-terciario)' }}
                >
                  {preset.descripcion}
                </p>
              </div>
              <span
                className="text-xs flex-shrink-0 tabular-nums"
                style={{ color: 'var(--texto-terciario)' }}
              >
                {textoHoraPreset(fechaCalculada, formato.locale)}
              </span>
            </button>
          )
        })}

        {/* Opción personalizada */}
        <AnimatePresence mode="wait">
          {!mostrarPersonalizado ? (
            <motion.button
              key="boton-personalizado"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMostrarPersonalizado(true)}
              className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-colors text-left hover:bg-superficie-hover"
              style={{ minHeight: 44 }}
            >
              <span style={{ color: 'var(--texto-secundario)' }}>
                <CalendarClock size={16} />
              </span>
              <div className="flex-1">
                <p
                  className="text-sm font-medium"
                  style={{ color: 'var(--texto-primario)' }}
                >
                  Fecha y hora...
                </p>
                <p
                  className="text-xs"
                  style={{ color: 'var(--texto-terciario)' }}
                >
                  Elegir un momento exacto para enviar
                </p>
              </div>
            </motion.button>
          ) : (
            <motion.div
              key="input-personalizado"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-2.5 py-2"
            >
              <div className="flex flex-col gap-2">
                <label
                  className="text-xs font-medium"
                  style={{ color: 'var(--texto-secundario)' }}
                >
                  Seleccionar fecha y hora
                </label>
                <input
                  type="datetime-local"
                  value={fechaPersonalizada}
                  onChange={(e) => setFechaPersonalizada(e.target.value)}
                  min={minimoFecha}
                  className="w-full px-3 py-2.5 rounded-xl text-sm transition-colors outline-none"
                  style={{
                    background: 'var(--superficie-elevada)',
                    border: '1px solid var(--borde-sutil)',
                    color: 'var(--texto-primario)',
                    minHeight: 44,
                  }}
                />
                <div className="flex items-center gap-2 mt-1">
                  <Boton
                    variante="primario"
                    tamano="sm"
                    onClick={handleFechaPersonalizada}
                    disabled={!fechaPersonalizada}
                    className="flex-1"
                  >
                    Programar
                  </Boton>
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    onClick={() => {
                      setMostrarPersonalizado(false)
                      setFechaPersonalizada('')
                    }}
                  >
                    Cancelar
                  </Boton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pie con nota informativa */}
      <div
        className="px-4 py-2.5 mt-1"
        style={{ borderTop: '1px solid var(--borde-sutil)' }}
      >
        <p
          className="text-xxs leading-relaxed"
          style={{ color: 'var(--texto-terciario)' }}
        >
          Los mensajes programados se envían automáticamente. Puedes cancelarlos antes de la hora de envío.
        </p>
      </div>
    </div>
  )

  // Modo inline: renderizar contenido directamente sin Popover wrapper
  if (renderInline) return contenido

  return (
    <Popover
      contenido={contenido}
      abierto={abierto}
      onCambio={setAbierto}
      alineacion="fin"
      lado="arriba"
      ancho={320}
      claseTrigger={claseTrigger}
    >
      {children || (
        <Tooltip contenido="Programar envío">
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="p-2 rounded-lg flex-shrink-0 transition-colors hover:bg-superficie-hover relative"
            style={{
              color: programadoPendiente
                ? 'var(--texto-marca)'
                : 'var(--texto-terciario)',
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={18} />
            {programadoPendiente && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
                style={{ background: 'var(--texto-marca)' }}
              />
            )}
          </motion.button>
        </Tooltip>
      )}
    </Popover>
  )
}

export type { PropiedadesPopoverProgramar, ProgramadoPendiente }
