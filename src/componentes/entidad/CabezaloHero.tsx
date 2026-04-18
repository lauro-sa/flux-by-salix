'use client'

import { type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { GrupoBotones } from '@/componentes/ui/GrupoBotones'

/**
 * CabezaloHero — Cabecera editorial reutilizable para vistas con navegación de período.
 *
 * Estructura visual:
 *   ┌────────────────────────────────────────────────────────┐
 *   │ <titulo>                         [‹] [Hoy] [›]         │   ← fila hero
 *   ├────────────────────────────────────────────────────────┤
 *   │ <slotTabs>  (opcional — con border-b propio del Tabs)  │
 *   │  — o —                                                  │
 *   │ ── separador sutil ──                                   │
 *   ├────────────────────────────────────────────────────────┤
 *   │ <slotControles>  (segmented, toggles, acciones)        │   ← fila controles
 *   └────────────────────────────────────────────────────────┘
 *
 * Se usa en: Matriz asistencias, Nómina, Calendario, y cualquier vista
 * con navegación temporal prominente.
 *
 * Para el título, usar el helper `<HeroRango>` si es un rango de fechas,
 * o componer el propio (ej. "Año 2026", "Agenda completa", etc.).
 */

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']
const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/** Número de semana ISO 8601 — calcula qué semana del año es */
export function numeroSemanaISO(fecha: Date): number {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()))
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const inicioAno = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - inicioAno.getTime()) / 86400000) + 1) / 7)
}

/* ═══════════════════════════════════════════════════════════
   HeroRango — helper para el título editorial
   ═══════════════════════════════════════════════════════════ */

type PeriodoHero = 'dia' | 'semana' | 'quincena' | 'mes' | 'ano'

interface PropiedadesHeroRango {
  /** Fecha inicio del rango */
  desde: Date
  /** Fecha fin del rango (puede ser igual a `desde` si es un solo día) */
  hasta: Date
  /** Tipo de período — afecta el subtítulo auto-generado ("Semana N", "Quincena 1|2") */
  periodo?: PeriodoHero
  /** Subtítulo custom — si se pasa, reemplaza el auto-generado (ej. "Hoy", "Abierto") */
  subtitulo?: ReactNode
  /** Etiqueta principal custom — si se pasa, reemplaza el mes auto-detectado (ej. "AGENDA") */
  etiqueta?: ReactNode
}

/**
 * HeroRango — Bloque editorial de presentación de un rango de fechas.
 * Renderiza "X — Y" en grande + mes (color marca) + año/semana.
 * Si desde === hasta, solo muestra "X" sin separador.
 */
export function HeroRango({ desde, hasta, periodo, subtitulo, etiqueta }: PropiedadesHeroRango) {
  const mismoMes = desde.getMonth() === hasta.getMonth() && desde.getFullYear() === hasta.getFullYear()
  const mismoDia = desde.toDateString() === hasta.toDateString()

  return (
    <div className="flex items-stretch gap-3 sm:gap-4 min-w-0">
      {/* Números grandes del rango */}
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="text-4xl sm:text-5xl font-bold text-texto-primario leading-none tracking-tight">
          {desde.getDate()}
        </span>
        {!mismoDia && (
          <>
            <span className="text-2xl sm:text-3xl text-texto-terciario leading-none">—</span>
            <span className="text-4xl sm:text-5xl font-bold text-texto-primario leading-none tracking-tight">
              {hasta.getDate()}
            </span>
          </>
        )}
      </div>
      {/* Mes/etiqueta + subtítulo — misma altura que los números, centrado */}
      <div className="flex flex-col justify-center gap-1 min-w-0 py-1">
        <span className="text-sm sm:text-base font-semibold text-texto-marca uppercase tracking-[0.15em] leading-none">
          {etiqueta ?? (mismoMes
            ? MESES[desde.getMonth()]
            : `${MESES_CORTOS[desde.getMonth()]} — ${MESES_CORTOS[hasta.getMonth()]}`)}
        </span>
        <span className="text-xs sm:text-[13px] text-texto-terciario uppercase tracking-wider leading-none truncate">
          {subtitulo ?? (
            <>
              {hasta.getFullYear()}
              {periodo === 'semana' && <> · Semana {numeroSemanaISO(desde)}</>}
              {periodo === 'quincena' && <> · Quincena {desde.getDate() <= 15 ? 1 : 2}</>}
            </>
          )}
        </span>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════
   CabezaloHero — contenedor completo
   ═══════════════════════════════════════════════════════════ */

interface PropiedadesCabezaloHero {
  /** Contenido del hero — típicamente <HeroRango ... /> o composición libre */
  titulo: ReactNode
  /** Navegación: período anterior */
  onAnterior?: () => void
  /** Navegación: período siguiente */
  onSiguiente?: () => void
  /** Navegación: volver a "hoy" (el período actual) */
  onHoy?: () => void
  /** Deshabilitar "Hoy" cuando ya estamos en el período actual */
  hoyDeshabilitado?: boolean
  /** Acciones rápidas a la izquierda de la navegación ‹ Hoy › (ej. iconos de vista, toggles) */
  slotAcciones?: ReactNode
  /** Tabs opcionales — aparecen entre hero y controles (aprovecha su propio border-b) */
  slotTabs?: ReactNode
  /** Fila de controles secundarios (segmented, toggles, acciones) */
  slotControles?: ReactNode
  /** Clase extra para el contenedor raíz (ej. padding-top mayor) */
  className?: string
}

export function CabezaloHero({
  titulo,
  onAnterior,
  onSiguiente,
  onHoy,
  hoyDeshabilitado = false,
  slotAcciones,
  slotTabs,
  slotControles,
  className = '',
}: PropiedadesCabezaloHero) {
  const mostrarNavegacion = onAnterior || onSiguiente || onHoy

  return (
    <div className={`flex flex-col shrink-0 ${className}`}>
      {/* Fila hero */}
      <div className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 flex items-center justify-between gap-4">
        {titulo}
        <div className="flex items-center gap-2 shrink-0">
          {mostrarNavegacion && (
          <GrupoBotones className="shrink-0">
            {onAnterior && (
              <button
                type="button"
                onClick={onAnterior}
                title="Período anterior"
                className="size-9 flex items-center justify-center rounded-boton border border-borde-sutil text-texto-secundario hover:bg-superficie-hover hover:text-texto-primario transition-colors"
              >
                <ChevronLeft size={18} />
              </button>
            )}
            {onHoy && (
              <button
                type="button"
                onClick={onHoy}
                disabled={hoyDeshabilitado}
                title="Volver a hoy"
                className={`h-9 px-4 rounded-boton border text-sm font-medium transition-colors ${
                  hoyDeshabilitado
                    ? 'border-borde-sutil text-texto-terciario/50 cursor-default'
                    : 'border-texto-marca/40 text-texto-marca hover:bg-texto-marca/10'
                }`}
              >
                Hoy
              </button>
            )}
            {onSiguiente && (
              <button
                type="button"
                onClick={onSiguiente}
                title="Período siguiente"
                className="size-9 flex items-center justify-center rounded-boton border border-borde-sutil text-texto-secundario hover:bg-superficie-hover hover:text-texto-primario transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            )}
          </GrupoBotones>
          )}
          {slotAcciones}
        </div>
      </div>

      {/* Tabs (o separador si no hay tabs pero sí controles) */}
      {slotTabs ? (
        <div className="px-1 sm:px-3 pb-2">{slotTabs}</div>
      ) : slotControles ? (
        <div className="h-px bg-borde-sutil/60 mx-4 sm:mx-6" />
      ) : null}

      {/* Controles secundarios */}
      {slotControles && (
        <div className="px-3 sm:px-6 py-2.5 sm:py-3 flex items-center flex-wrap gap-3">
          {slotControles}
        </div>
      )}
    </div>
  )
}

export type { PropiedadesCabezaloHero, PropiedadesHeroRango, PeriodoHero }
