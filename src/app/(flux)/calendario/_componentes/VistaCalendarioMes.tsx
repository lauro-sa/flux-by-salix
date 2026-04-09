'use client'

/**
 * VistaCalendarioMes — Vista mensual del calendario con cuadrícula de 7 columnas.
 * Muestra días del mes con eventos como píldoras coloreadas.
 * Se usa en: página principal del calendario (vista mes).
 */

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import {
  DIAS_ENCABEZADO,
  mismoDia,
  esHoy,
  formatearHoraISO,
} from './constantes'
import type { EventoCalendario, OnClickEvento } from './tipos'

/** Máximo de eventos visibles por celda antes de mostrar "+N más" */
const MAX_EVENTOS_CELDA = 3

// --- Utilidades de fecha (locales a este componente) ---

function inicioMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1)
}

function finMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0)
}

function inicioSemana(fecha: Date): Date {
  const d = new Date(fecha)
  const dia = d.getDay()
  const diff = dia === 0 ? 6 : dia - 1
  d.setDate(d.getDate() - diff)
  return d
}

function finSemana(fecha: Date): Date {
  const d = new Date(fecha)
  const dia = d.getDay()
  const diff = dia === 0 ? 0 : 7 - dia
  d.setDate(d.getDate() + diff)
  return d
}

function diasEnIntervalo(inicio: Date, fin: Date): Date[] {
  const dias: Date[] = []
  const actual = new Date(inicio)
  actual.setHours(0, 0, 0, 0)
  const limite = new Date(fin)
  limite.setHours(23, 59, 59, 999)
  while (actual <= limite) {
    dias.push(new Date(actual))
    actual.setDate(actual.getDate() + 1)
  }
  return dias
}

function esMismoMes(fecha: Date, referencia: Date): boolean {
  return fecha.getFullYear() === referencia.getFullYear()
    && fecha.getMonth() === referencia.getMonth()
}

// --- Componente ---

interface PropiedadesVistaMes {
  fechaActual: Date
  eventos: EventoCalendario[]
  onClickDia: (fecha: Date) => void
  onClickEvento: OnClickEvento
}

function VistaCalendarioMes({
  fechaActual,
  eventos,
  onClickDia,
  onClickEvento,
}: PropiedadesVistaMes) {
  const { formatoHora } = useFormato()
  const { t } = useTraduccion()
  const es24h = formatoHora !== '12h'

  const diasCuadricula = useMemo(() => {
    const primerDiaMes = inicioMes(fechaActual)
    const ultimoDiaMes = finMes(fechaActual)
    const inicio = inicioSemana(primerDiaMes)
    const fin = finSemana(ultimoDiaMes)
    return diasEnIntervalo(inicio, fin)
  }, [fechaActual])

  const eventosPorDia = useMemo(() => {
    const mapa = new Map<string, EventoCalendario[]>()

    for (const evento of eventos) {
      const fechaInicio = new Date(evento.fecha_inicio)
      const fechaFin = new Date(evento.fecha_fin)

      const inicio = new Date(fechaInicio)
      inicio.setHours(0, 0, 0, 0)
      const fin = new Date(fechaFin)
      fin.setHours(0, 0, 0, 0)

      const actual = new Date(inicio)
      while (actual <= fin) {
        const clave = actual.toISOString().split('T')[0]
        if (!mapa.has(clave)) mapa.set(clave, [])
        mapa.get(clave)!.push(evento)
        actual.setDate(actual.getDate() + 1)
      }
    }

    return mapa
  }, [eventos])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full"
      role="grid"
      aria-label={t('calendario.a11y.calendario_mensual')}
    >
      {/* Encabezado de días de la semana */}
      <div className="grid grid-cols-7 border-b border-borde-sutil" role="row">
        {DIAS_ENCABEZADO.map((dia) => (
          <div
            key={dia}
            role="columnheader"
            className="py-2 text-center text-xs font-medium text-texto-terciario uppercase tracking-wider"
          >
            {dia}
          </div>
        ))}
      </div>

      {/* Cuadrícula de días */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr">
        {diasCuadricula.map((dia, indice) => {
          const clave = dia.toISOString().split('T')[0]
          const eventosDelDia = eventosPorDia.get(clave) || []
          const esDelMes = esMismoMes(dia, fechaActual)
          const esHoyFlag = esHoy(dia)
          const eventosVisibles = eventosDelDia.slice(0, MAX_EVENTOS_CELDA)
          const eventosRestantes = eventosDelDia.length - MAX_EVENTOS_CELDA

          return (
            <div
              key={indice}
              role="gridcell"
              aria-label={`${dia.getDate()}, ${eventosDelDia.length} ${t('calendario.a11y.eventos_en_dia')}`}
              className={[
                'min-h-[80px] sm:min-h-[100px] border-b border-r border-borde-sutil p-1.5 cursor-pointer transition-colors hover:bg-superficie-hover',
                indice % 7 === 0 ? 'border-l' : '',
                indice < 7 ? 'border-t' : '',
                !esDelMes ? 'bg-superficie-app/50' : '',
              ].join(' ')}
              onClick={() => onClickDia(dia)}
            >
              {/* Número del día */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={[
                    'text-sm leading-none',
                    esHoyFlag
                      ? 'text-texto-marca font-bold'
                      : esDelMes
                        ? 'text-texto-primario'
                        : 'text-texto-terciario/40',
                  ].join(' ')}
                >
                  <span className="inline-flex items-center gap-1">
                    {dia.getDate()}
                    {esHoyFlag && (
                      <span className="inline-block size-1.5 rounded-full bg-texto-marca" aria-label={t('calendario.hoy')} />
                    )}
                  </span>
                </span>
              </div>

              {/* Eventos del día */}
              <div className="flex flex-col gap-0.5 overflow-hidden min-w-0">
                {eventosVisibles.map((evento) => (
                  <button
                    key={evento.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onClickEvento(evento, { x: e.clientX, y: e.clientY })
                    }}
                    title={evento.titulo}
                    aria-label={`${evento.titulo}${!evento.todo_el_dia ? `, ${formatearHoraISO(evento.fecha_inicio, es24h)}` : ''}`}
                    className="w-full text-left truncate rounded px-1.5 py-1 sm:py-0.5 text-[11px] sm:text-xs leading-tight transition-opacity hover:opacity-80 block min-h-[28px] sm:min-h-0"
                    style={{
                      backgroundColor: evento.color
                        ? `${evento.color}20`
                        : 'var(--superficie-elevada)',
                      color: evento.color || 'var(--texto-primario)',
                      borderLeft: evento.color
                        ? `2px solid ${evento.color}`
                        : '2px solid var(--texto-marca)',
                    }}
                  >
                    {!evento.todo_el_dia && (
                      <span className="opacity-70 mr-1">
                        {formatearHoraISO(evento.fecha_inicio, es24h)}
                      </span>
                    )}
                    {evento.titulo}
                  </button>
                ))}

                {eventosRestantes > 0 && (
                  <span className="text-[10px] text-texto-terciario pl-1">
                    +{eventosRestantes} {t('calendario.mas_eventos')}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

export { VistaCalendarioMes }
