'use client'

/**
 * VistaCalendarioAgenda — Vista de agenda cronológica del calendario.
 * Muestra eventos agrupados por día en una lista vertical ideal para móvil.
 * Cubre 14 días desde la fecha actual.
 * Se usa en: página principal del calendario (vista agenda).
 */

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import type { EventoCalendario, OnClickEvento } from './tipos'

// --- Constantes ---

/** Cantidad de días a mostrar en la agenda */
const DIAS_AGENDA = 14

/** Nombres de días de la semana en español */
const NOMBRES_DIA = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
]

/** Nombres de meses en español */
const NOMBRES_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// --- Utilidades de fecha ---

/** Compara si dos fechas son el mismo día */
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

/** Comprueba si la fecha es mañana */
function esManiana(fecha: Date): boolean {
  const maniana = new Date()
  maniana.setDate(maniana.getDate() + 1)
  return mismoDia(fecha, maniana)
}

/** Etiqueta relativa del día: "Hoy", "Mañana" o null */
function etiquetaRelativa(fecha: Date): string | null {
  if (esHoy(fecha)) return 'Hoy'
  if (esManiana(fecha)) return 'Mañana'
  return null
}

/** Formatea fecha como "martes 8 de abril" */
function formatearFechaDia(fecha: Date): string {
  const diaSemana = NOMBRES_DIA[fecha.getDay()]
  const dia = fecha.getDate()
  const mes = NOMBRES_MES[fecha.getMonth()]
  return `${diaSemana} ${dia} de ${mes}`
}

/** Genera un array de N días consecutivos desde una fecha */
function generarDias(desde: Date, cantidad: number): Date[] {
  const dias: Date[] = []
  for (let i = 0; i < cantidad; i++) {
    const d = new Date(desde)
    d.setDate(desde.getDate() + i)
    d.setHours(0, 0, 0, 0)
    dias.push(d)
  }
  return dias
}

/** Formatea hora desde ISO string como "09:00" */
function formatearHoraISO(isoStr: string): string {
  const fecha = new Date(isoStr)
  if (isNaN(fecha.getTime())) return ''
  return fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Formatea rango de horas: "09:00 - 10:00" o "Todo el día" */
function formatearRangoHora(evento: EventoCalendario): string {
  if (evento.todo_el_dia) return 'Todo el día'
  return `${formatearHoraISO(evento.fecha_inicio)} - ${formatearHoraISO(evento.fecha_fin)}`
}

// --- Tipos internos ---

interface GrupoDia {
  fecha: Date
  etiqueta: string | null
  fechaFormateada: string
  eventos: EventoCalendario[]
}

// --- Componente ---

interface PropiedadesVistaAgenda {
  fechaActual: Date
  eventos: EventoCalendario[]
  onClickEvento: OnClickEvento
}

function VistaCalendarioAgenda({
  fechaActual,
  eventos,
  onClickEvento,
}: PropiedadesVistaAgenda) {
  /** Agrupar eventos por día para los próximos 14 días */
  const gruposPorDia = useMemo<GrupoDia[]>(() => {
    const dias = generarDias(fechaActual, DIAS_AGENDA)

    return dias.map((dia: Date) => {
      // Filtrar eventos que caen en este día
      const eventosDelDia = eventos
        .filter((evento) => {
          const inicio = new Date(evento.fecha_inicio)
          const fin = new Date(evento.fecha_fin)
          const inicioDia = new Date(dia)
          inicioDia.setHours(0, 0, 0, 0)
          const finDia = new Date(dia)
          finDia.setHours(23, 59, 59, 999)
          return inicio <= finDia && fin >= inicioDia
        })
        // Ordenar: todo el día primero, luego por hora de inicio
        .sort((a, b) => {
          if (a.todo_el_dia && !b.todo_el_dia) return -1
          if (!a.todo_el_dia && b.todo_el_dia) return 1
          return new Date(a.fecha_inicio).getTime() - new Date(b.fecha_inicio).getTime()
        })

      return {
        fecha: dia,
        etiqueta: etiquetaRelativa(dia),
        fechaFormateada: formatearFechaDia(dia),
        eventos: eventosDelDia,
      }
    })
  }, [fechaActual, eventos])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full overflow-y-auto px-2 sm:px-4 py-3 gap-3"
    >
      {gruposPorDia.map((grupo, indiceGrupo) => (
        <motion.div
          key={grupo.fecha.toISOString()}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.15, delay: indiceGrupo * 0.03 }}
          className="flex flex-col"
        >
          {/* Encabezado del día — sticky */}
          <div
            className="sticky top-0 z-10 flex items-baseline gap-2 p-3 rounded-lg mb-1"
            style={{ backgroundColor: 'color-mix(in srgb, var(--superficie-hover) 50%, transparent)' }}
          >
            {grupo.etiqueta && (
              <span
                className={[
                  'text-sm font-bold',
                  esHoy(grupo.fecha) ? 'text-texto-marca' : 'text-texto-primario',
                ].join(' ')}
              >
                {grupo.etiqueta}
              </span>
            )}
            {grupo.etiqueta && (
              <span className="text-texto-terciario text-sm">—</span>
            )}
            <span className="text-sm text-texto-secundario capitalize">
              {grupo.fechaFormateada}
            </span>
          </div>

          {/* Lista de eventos o mensaje vacío */}
          {grupo.eventos.length === 0 ? (
            <div className="pl-4 py-2">
              <span className="text-sm text-texto-terciario italic">Sin eventos</span>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {grupo.eventos.map((evento, indiceEvento) => (
                <motion.button
                  key={evento.id}
                  type="button"
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.12, delay: indiceGrupo * 0.02 + indiceEvento * 0.02 }}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-superficie-hover w-full group"
                  onClick={(e) => onClickEvento(evento, { x: e.clientX, y: e.clientY })}
                >
                  {/* Columna izquierda: hora */}
                  <div className="w-28 shrink-0 pt-0.5">
                    <span className="text-sm text-texto-terciario whitespace-nowrap">
                      {formatearRangoHora(evento)}
                    </span>
                  </div>

                  {/* Columna central: contenido */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-texto-primario truncate">
                        {evento.titulo}
                      </span>
                    </div>

                    {/* Descripción (preview truncado) */}
                    {evento.descripcion && (
                      <p className="text-sm text-texto-terciario truncate mt-0.5 leading-tight">
                        {evento.descripcion}
                      </p>
                    )}

                    {/* Asignados como avatares pequeños */}
                    {evento.asignados.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5">
                        {evento.asignados.slice(0, 4).map((asignado) => (
                          <span
                            key={asignado.id}
                            className="inline-flex items-center justify-center size-5 rounded-full bg-superficie-elevada text-[10px] font-medium text-texto-secundario"
                            title={asignado.nombre}
                          >
                            {asignado.nombre.charAt(0).toUpperCase()}
                          </span>
                        ))}
                        {evento.asignados.length > 4 && (
                          <span className="text-[10px] text-texto-terciario">
                            +{evento.asignados.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Columna derecha: tipo con punto de color */}
                  <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                    <span
                      className="size-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: evento.color || 'var(--texto-terciario)',
                      }}
                    />
                    {evento.tipo_clave && (
                      <span className="text-xs text-texto-terciario capitalize hidden sm:inline">
                        {evento.tipo_clave}
                      </span>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </motion.div>
  )
}

export { VistaCalendarioAgenda }
