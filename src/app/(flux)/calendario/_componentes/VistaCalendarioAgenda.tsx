'use client'

/**
 * VistaCalendarioAgenda — Vista de agenda cronológica del calendario.
 * Muestra eventos agrupados por día en una lista vertical ideal para móvil.
 * Cubre 14 días desde la fecha actual.
 * Se usa en: página principal del calendario (vista agenda).
 */

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useFormato } from '@/hooks/useFormato'
import { useTraduccion } from '@/lib/i18n'
import { useMovimientoReducido } from '@/hooks/useMovimientoReducido'
import {
  NOMBRES_DIAS_COMPLETOS,
  NOMBRES_MESES,
  mismoDia,
  esHoy,
  esManiana,
  formatearHoraISO,
} from './constantes'
import type { EventoCalendario, OnClickEvento } from './tipos'

// --- Constantes ---

const DIAS_AGENDA = 14

// --- Utilidades de fecha ---

function formatearFechaDia(fecha: Date): string {
  const diaSemana = NOMBRES_DIAS_COMPLETOS[fecha.getDay()].toLowerCase()
  const dia = fecha.getDate()
  const mes = NOMBRES_MESES[fecha.getMonth()].toLowerCase()
  return `${diaSemana} ${dia} de ${mes}`
}

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
  const { formatoHora } = useFormato()
  const { t } = useTraduccion()
  const es24h = formatoHora !== '12h'
  const reducirMovimiento = useMovimientoReducido()

  /** Formatea rango de horas */
  function formatearRangoHora(evento: EventoCalendario): string {
    if (evento.todo_el_dia) return t('calendario.todo_el_dia')
    return `${formatearHoraISO(evento.fecha_inicio, es24h)} - ${formatearHoraISO(evento.fecha_fin, es24h)}`
  }

  /** Etiqueta relativa del día */
  function etiquetaRelativa(fecha: Date): string | null {
    if (esHoy(fecha)) return t('calendario.hoy')
    if (esManiana(fecha)) return t('calendario.maniana')
    return null
  }

  const gruposPorDia = useMemo<GrupoDia[]>(() => {
    const dias = generarDias(fechaActual, DIAS_AGENDA)

    return dias.map((dia: Date) => {
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaActual, eventos, es24h])

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col h-full overflow-y-auto px-2 sm:px-4 py-3 gap-3"
      role="list"
      aria-label={t('calendario.a11y.calendario_agenda')}
    >
      {gruposPorDia.map((grupo, indiceGrupo) => (
        <motion.div
          key={grupo.fecha.toISOString()}
          initial={reducirMovimiento ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reducirMovimiento ? { duration: 0 } : { duration: 0.15, delay: indiceGrupo * 0.03 }}
          className="flex flex-col"
          role="listitem"
        >
          {/* Encabezado del día */}
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
              <span className="text-sm text-texto-terciario italic">{t('calendario.sin_eventos')}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {grupo.eventos.map((evento, indiceEvento) => (
                <motion.button
                  key={evento.id}
                  type="button"
                  initial={reducirMovimiento ? false : { opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={reducirMovimiento ? { duration: 0 } : { duration: 0.12, delay: indiceGrupo * 0.02 + indiceEvento * 0.02 }}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-superficie-hover w-full group"
                  onClick={(e) => onClickEvento(evento, { x: e.clientX, y: e.clientY })}
                  aria-label={`${evento.titulo}, ${formatearRangoHora(evento)}`}
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

                    {evento.descripcion && (
                      <p className="text-sm text-texto-terciario truncate mt-0.5 leading-tight">
                        {evento.descripcion}
                      </p>
                    )}

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
