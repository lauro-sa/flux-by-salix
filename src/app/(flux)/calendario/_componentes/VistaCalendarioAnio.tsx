'use client'

/**
 * VistaCalendarioAnio — Vista anual del calendario con 12 mini-meses en cuadrícula.
 * Muestra todos los meses del año como mini-calendarios compactos estilo Google Calendar.
 * Se usa en: página principal del calendario (vista año).
 */

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useTraduccion } from '@/lib/i18n'
import {
  NOMBRES_MESES,
  CABECERAS_DIAS,
  mismoDia,
  esHoy,
  generarCuadriculaMes,
  claveDelDia,
} from './constantes'
import type { EventoCalendario, OnClickEvento } from './tipos'

/** Máximo de puntos de color por día */
const MAX_PUNTOS = 3

// --- Tipos de indicador por día ---

interface IndicadorDia {
  colores: string[]
  cantidad: number
}

// --- Props ---

interface PropiedadesVistaAnio {
  fechaActual: Date
  eventos: EventoCalendario[]
  onClickDia: (fecha: Date) => void
  onClickEvento: OnClickEvento
}

// --- Componente ---

function VistaCalendarioAnio({
  fechaActual,
  eventos,
  onClickDia,
}: PropiedadesVistaAnio) {
  const { t } = useTraduccion()
  const anio = fechaActual.getFullYear()
  const mesActual = new Date().getMonth()
  const anioActual = new Date().getFullYear()

  /** Cuadrículas de los 12 meses pre-calculadas */
  const cuadriculasMeses = useMemo(() => {
    return Array.from({ length: 12 }, (_, mes) => generarCuadriculaMes(anio, mes))
  }, [anio])

  /** Mapa de indicadores por día */
  const indicadoresPorDia = useMemo(() => {
    const mapa = new Map<string, IndicadorDia>()

    for (const evento of eventos) {
      const inicio = new Date(evento.fecha_inicio)
      const fin = new Date(evento.fecha_fin)
      const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())
      const finDia = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate())

      while (cursor <= finDia) {
        const clave = claveDelDia(cursor)
        const existente = mapa.get(clave) || { colores: [], cantidad: 0 }
        existente.cantidad++
        if (evento.color && !existente.colores.includes(evento.color)) {
          existente.colores.push(evento.color)
        }
        mapa.set(clave, existente)
        cursor.setDate(cursor.getDate() + 1)
      }
    }

    return mapa
  }, [eventos])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5 p-3 sm:p-4 overflow-y-auto h-full"
      role="grid"
      aria-label={t('calendario.a11y.calendario_anual')}
    >
      {cuadriculasMeses.map((semanas, indiceMes) => {
        const esMesActual = indiceMes === mesActual && anio === anioActual

        return (
          <div key={indiceMes} className="flex flex-col">
            {/* Nombre del mes */}
            <button
              type="button"
              onClick={() => onClickDia(new Date(anio, indiceMes, 1))}
              className={[
                'text-left text-xs mb-1.5 px-0.5 transition-colors hover:text-texto-marca',
                esMesActual
                  ? 'font-bold text-texto-marca'
                  : 'font-medium text-texto-primario',
              ].join(' ')}
            >
              {NOMBRES_MESES[indiceMes]}
            </button>

            {/* Cabeceras de días */}
            <div className="grid grid-cols-7 mb-0.5" role="row">
              {CABECERAS_DIAS.map(nombre => (
                <div
                  key={nombre}
                  role="columnheader"
                  className="text-center text-[9px] sm:text-[8px] font-medium text-texto-terciario leading-tight py-0.5"
                >
                  {nombre}
                </div>
              ))}
            </div>

            {/* Cuadrícula de días */}
            <div className="flex flex-col">
              {semanas.map((semana, indiceSemana) => (
                <div key={indiceSemana} className="grid grid-cols-7" role="row">
                  {semana.map(dia => {
                    const esDelMes = dia.getMonth() === indiceMes
                    const esDiaHoy = esHoy(dia)
                    const esSeleccionado = mismoDia(dia, fechaActual)
                    const clave = claveDelDia(dia)
                    const indicador = indicadoresPorDia.get(clave)

                    return (
                      <button
                        key={dia.toISOString()}
                        type="button"
                        role="gridcell"
                        aria-current={esDiaHoy ? 'date' : undefined}
                        aria-selected={esSeleccionado}
                        onClick={() => onClickDia(dia)}
                        className={[
                          'relative flex flex-col items-center text-[11px] sm:text-[10px] leading-none py-[2px] sm:py-[1.5px] transition-colors',
                          !esDelMes ? 'text-texto-terciario/25' : '',
                          esDelMes && !esDiaHoy && !esSeleccionado
                            ? 'text-texto-primario hover:text-texto-marca'
                            : '',
                        ].join(' ')}
                      >
                        <span
                          className={[
                            'flex items-center justify-center size-[26px] sm:size-[22px] rounded-full transition-colors text-[11px] sm:text-[10px]',
                            esDiaHoy ? 'bg-texto-marca text-white font-bold' : '',
                            esSeleccionado && !esDiaHoy ? 'ring-1 ring-texto-marca font-semibold text-texto-marca' : '',
                            !esDiaHoy && !esSeleccionado ? 'hover:bg-superficie-hover' : '',
                          ].join(' ')}
                        >
                          {dia.getDate()}
                        </span>

                        {/* Puntos indicadores de eventos */}
                        {indicador && esDelMes && (
                          <div className="flex gap-px mt-px">
                            {indicador.colores.slice(0, MAX_PUNTOS).map((color, idx) => (
                              <span
                                key={idx}
                                className="size-[3px] rounded-full"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                            {indicador.colores.length === 0 && indicador.cantidad > 0 && (
                              <span className="size-[3px] rounded-full bg-texto-marca" />
                            )}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </motion.div>
  )
}

export { VistaCalendarioAnio }
