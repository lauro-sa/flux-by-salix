'use client'

/**
 * VistaCalendarioAnio — Vista anual del calendario con 12 mini-meses en cuadrícula.
 * Muestra todos los meses del año como mini-calendarios compactos estilo Google Calendar.
 * Se usa en: página principal del calendario (vista año).
 */

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { EventoCalendario, OnClickEvento } from './tipos'

// --- Constantes ---

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/** Cabeceras cortas de días (lunes primero) */
const CABECERAS_DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

/** Máximo de puntos de color por día */
const MAX_PUNTOS = 3

// --- Utilidades de fecha ---

/** Compara si dos fechas son el mismo día */
function mismoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

/** Comprueba si la fecha es hoy */
function esHoy(fecha: Date): boolean {
  return mismoDia(fecha, new Date())
}

/**
 * Genera la cuadrícula de semanas para un mes dado.
 * Incluye días de meses adyacentes para completar las semanas.
 */
function generarCuadriculaMes(anio: number, mes: number): Date[][] {
  const primerDia = new Date(anio, mes, 1)
  const ultimoDia = new Date(anio, mes + 1, 0)
  const diaInicio = primerDia.getDay()
  // Ajustar para que lunes sea el primer día de la semana
  const offsetInicio = diaInicio === 0 ? 6 : diaInicio - 1
  const dias: Date[] = []

  // Días del mes anterior para completar la primera semana
  for (let i = offsetInicio - 1; i >= 0; i--) dias.push(new Date(anio, mes, -i))
  // Días del mes actual
  for (let i = 1; i <= ultimoDia.getDate(); i++) dias.push(new Date(anio, mes, i))
  // Días del mes siguiente para completar la última semana
  const restante = 7 - (dias.length % 7)
  if (restante < 7) {
    for (let i = 1; i <= restante; i++) dias.push(new Date(anio, mes + 1, i))
  }

  // Agrupar en semanas de 7 días
  const semanas: Date[][] = []
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7))
  return semanas
}

/**
 * Genera clave YYYY-MM-DD para una fecha (sin depender de timezone de toISOString).
 */
function claveFecha(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`
}

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
  onClickEvento,
}: PropiedadesVistaAnio) {
  const anio = fechaActual.getFullYear()
  const mesActual = new Date().getMonth()
  const anioActual = new Date().getFullYear()

  /** Cuadrículas de los 12 meses pre-calculadas */
  const cuadriculasMeses = useMemo(() => {
    return Array.from({ length: 12 }, (_, mes) => generarCuadriculaMes(anio, mes))
  }, [anio])

  /** Mapa de indicadores por día: clave YYYY-MM-DD → { colores, cantidad } */
  const indicadoresPorDia = useMemo(() => {
    const mapa = new Map<string, IndicadorDia>()

    for (const evento of eventos) {
      const inicio = new Date(evento.fecha_inicio)
      const fin = new Date(evento.fecha_fin)
      // Iterar por cada día que cubre el evento
      const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())
      const finDia = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate())

      while (cursor <= finDia) {
        const clave = claveFecha(cursor)
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
    >
      {cuadriculasMeses.map((semanas, indiceMes) => {
        const esMesActual = indiceMes === mesActual && anio === anioActual

        return (
          <div key={indiceMes} className="flex flex-col">
            {/* Nombre del mes — clic navega al primer día del mes */}
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

            {/* Cabeceras de días de la semana */}
            <div className="grid grid-cols-7 mb-0.5">
              {CABECERAS_DIAS.map(nombre => (
                <div
                  key={nombre}
                  className="text-center text-[8px] font-medium text-texto-terciario leading-tight py-0.5"
                >
                  {nombre}
                </div>
              ))}
            </div>

            {/* Cuadrícula de días */}
            <div className="flex flex-col">
              {semanas.map((semana, indiceSemana) => (
                <div key={indiceSemana} className="grid grid-cols-7">
                  {semana.map(dia => {
                    const esDelMes = dia.getMonth() === indiceMes
                    const esDiaHoy = esHoy(dia)
                    const esSeleccionado = mismoDia(dia, fechaActual)
                    const clave = claveFecha(dia)
                    const indicador = indicadoresPorDia.get(clave)

                    return (
                      <button
                        key={dia.toISOString()}
                        type="button"
                        onClick={() => onClickDia(dia)}
                        className={[
                          'relative flex flex-col items-center text-[10px] leading-none py-[1.5px] transition-colors',
                          !esDelMes ? 'text-texto-terciario/25' : '',
                          esDelMes && !esDiaHoy && !esSeleccionado
                            ? 'text-texto-primario hover:text-texto-marca'
                            : '',
                        ].join(' ')}
                      >
                        {/* Número del día */}
                        <span
                          className={[
                            'flex items-center justify-center size-[22px] rounded-full transition-colors text-[10px]',
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
                            {/* Si no hay colores pero sí hay eventos, mostrar punto de color marca */}
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
