'use client'

/**
 * MiniCalendario — Calendario compacto tipo Google Calendar sidebar.
 * Muestra una vista de mes con navegacion independiente del calendario principal.
 * Se usa en: sidebar izquierdo de la pagina de calendario (vistas dia, semana, quincenal, equipo).
 */

import { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

// --- Constantes ---

const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/** Cabeceras de dias de la semana (lunes primero) */
const CABECERAS_DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

// --- Utilidades ---

/** Compara si dos fechas son el mismo dia */
function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Comprueba si la fecha es hoy */
function esHoy(fecha: Date): boolean {
  return mismoDia(fecha, new Date())
}

/**
 * Genera la cuadricula de dias visibles para un mes dado.
 * Incluye dias del mes anterior y siguiente para completar las semanas.
 * Devuelve un array de arrays (semanas), cada uno con 7 fechas.
 */
function generarCuadriculaMes(anio: number, mes: number): Date[][] {
  const primerDia = new Date(anio, mes, 1)
  const ultimoDia = new Date(anio, mes + 1, 0)

  // Dia de la semana del primer dia del mes (0=dom, ajustar para lun=0)
  const diaInicio = primerDia.getDay()
  const offsetInicio = diaInicio === 0 ? 6 : diaInicio - 1

  // Generar todos los dias visibles
  const dias: Date[] = []

  // Dias del mes anterior
  for (let i = offsetInicio - 1; i >= 0; i--) {
    const d = new Date(anio, mes, -i)
    dias.push(d)
  }

  // Dias del mes actual
  for (let i = 1; i <= ultimoDia.getDate(); i++) {
    dias.push(new Date(anio, mes, i))
  }

  // Dias del mes siguiente para completar la ultima semana
  const restante = 7 - (dias.length % 7)
  if (restante < 7) {
    for (let i = 1; i <= restante; i++) {
      dias.push(new Date(anio, mes + 1, i))
    }
  }

  // Agrupar en semanas de 7
  const semanas: Date[][] = []
  for (let i = 0; i < dias.length; i += 7) {
    semanas.push(dias.slice(i, i + 7))
  }

  return semanas
}

// --- Props ---

interface PropiedadesMiniCalendario {
  /** Fecha actualmente seleccionada/visible en el calendario principal */
  fechaActual: Date
  /** Callback cuando el usuario hace click en un dia */
  onSeleccionarDia: (fecha: Date) => void
  /** Callback para cambiar de mes en el mini calendario */
  onCambiarMes?: (fecha: Date) => void
}

// --- Componente ---

function MiniCalendario({
  fechaActual,
  onSeleccionarDia,
  onCambiarMes,
}: PropiedadesMiniCalendario) {
  // Estado propio del mes visible en el mini calendario (independiente del principal)
  const [mesVisible, setMesVisible] = useState<Date>(() => {
    return new Date(fechaActual.getFullYear(), fechaActual.getMonth(), 1)
  })

  const anio = mesVisible.getFullYear()
  const mes = mesVisible.getMonth()

  // Cuadricula de semanas para el mes visible
  const semanas = useMemo(() => generarCuadriculaMes(anio, mes), [anio, mes])

  /** Navegar al mes anterior */
  const irMesAnterior = useCallback(() => {
    setMesVisible((prev) => {
      const nuevo = new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
      onCambiarMes?.(nuevo)
      return nuevo
    })
  }, [onCambiarMes])

  /** Navegar al mes siguiente */
  const irMesSiguiente = useCallback(() => {
    setMesVisible((prev) => {
      const nuevo = new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
      onCambiarMes?.(nuevo)
      return nuevo
    })
  }, [onCambiarMes])

  /** Manejar click en un dia */
  const manejarClickDia = useCallback(
    (fecha: Date) => {
      onSeleccionarDia(fecha)
    },
    [onSeleccionarDia],
  )

  return (
    <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-3 select-none">
      {/* Cabecera: navegacion de mes */}
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={irMesAnterior}
          className="p-0.5 rounded text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover transition-colors"
          aria-label="Mes anterior"
        >
          <ChevronLeft size={14} />
        </button>

        <span className="text-xs font-semibold text-texto-primario">
          {NOMBRES_MESES[mes]} {anio}
        </span>

        <button
          type="button"
          onClick={irMesSiguiente}
          className="p-0.5 rounded text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover transition-colors"
          aria-label="Mes siguiente"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Cabeceras de dias de la semana */}
      <div className="grid grid-cols-7 mb-1">
        {CABECERAS_DIAS.map((nombre) => (
          <div
            key={nombre}
            className="text-center text-[10px] font-medium text-texto-terciario leading-tight py-0.5"
          >
            {nombre}
          </div>
        ))}
      </div>

      {/* Cuadricula de dias */}
      <div className="flex flex-col gap-0">
        {semanas.map((semana, indiceSemana) => (
          <div key={indiceSemana} className="grid grid-cols-7">
            {semana.map((dia) => {
              const esDelMesActual = dia.getMonth() === mes
              const esDiaHoy = esHoy(dia)
              const esSeleccionado = mismoDia(dia, fechaActual)

              return (
                <button
                  key={dia.toISOString()}
                  type="button"
                  onClick={() => manejarClickDia(dia)}
                  className={[
                    'relative flex items-center justify-center text-xs leading-none py-1 transition-colors',
                    // Dia de hoy: fondo marca con texto blanco
                    esDiaHoy
                      ? 'font-bold'
                      : '',
                    // Dia seleccionado (fecha activa del calendario principal)
                    esSeleccionado && !esDiaHoy
                      ? 'font-semibold'
                      : '',
                    // Dias de otro mes: opacidad baja
                    !esDelMesActual
                      ? 'text-texto-terciario/40'
                      : esDiaHoy
                        ? ''
                        : esSeleccionado
                          ? 'text-texto-marca'
                          : 'text-texto-primario hover:text-texto-marca',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'flex items-center justify-center size-6 rounded-full transition-colors',
                      esDiaHoy
                        ? 'bg-texto-marca text-white'
                        : esSeleccionado
                          ? 'ring-1.5 ring-texto-marca text-texto-marca'
                          : 'hover:bg-superficie-hover',
                    ].join(' ')}
                  >
                    {dia.getDate()}
                  </span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export { MiniCalendario }
