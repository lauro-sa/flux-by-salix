'use client'

/**
 * BarraHerramientasCalendario — Barra de navegación y controles del calendario.
 * Diseño responsive de 2 filas (desktop) o 3 filas (móvil):
 *   Desktop: [Hoy ‹ › Etiqueta | Todos/Míos + Filtrar] + [selector de vista centrado]
 *   Móvil:   [Hoy ‹ › Etiqueta corta] + [Todos/Míos + Filtrar] + [selector abreviado]
 * Se usa en: página principal del calendario.
 */

import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { useTraduccion } from '@/lib/i18n'
import {
  NOMBRES_MESES,
  NOMBRES_MESES_CORTOS,
  NOMBRES_DIAS_COMPLETOS,
} from './constantes'
import type { VistaCalendario } from './tipos'

const OPCIONES_VISTA: { valor: VistaCalendario; etiqueta: string; etiquetaCorta: string }[] = [
  { valor: 'dia', etiqueta: 'Día', etiquetaCorta: 'D' },
  { valor: 'semana', etiqueta: 'Semana', etiquetaCorta: 'S' },
  { valor: 'quincenal', etiqueta: 'Quincenal', etiquetaCorta: 'Q' },
  { valor: 'mes', etiqueta: 'Mes', etiquetaCorta: 'M' },
  { valor: 'anio', etiqueta: 'Año', etiquetaCorta: 'A' },
  { valor: 'agenda', etiqueta: 'Agenda', etiquetaCorta: 'Ag' },
  { valor: 'equipo', etiqueta: 'Equipo', etiquetaCorta: 'Eq' },
]

/* ─── Funciones de etiqueta de fecha ─── */

/** Etiqueta completa para desktop: "Martes 8 de abril", "Marzo 2026", etc. */
function obtenerEtiqueta(vista: VistaCalendario, fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = NOMBRES_MESES[fecha.getMonth()]

  switch (vista) {
    case 'mes':
      return `${mes} ${anio}`
    case 'semana':
      return etiquetaRangoSemana(fecha, 6)
    case 'quincenal':
      return etiquetaRangoSemana(fecha, 13)
    case 'dia':
    case 'equipo': {
      const diaSemana = NOMBRES_DIAS_COMPLETOS[fecha.getDay()]
      const diaNum = fecha.getDate()
      const mesNombre = NOMBRES_MESES[fecha.getMonth()].toLowerCase()
      return `${diaSemana} ${diaNum} de ${mesNombre}`
    }
    case 'anio':
      return `${anio}`
    default:
      return `${mes} ${anio}`
  }
}

/** Etiqueta compacta para móvil: "8 Abr 2026", "Mar 2026", etc. */
function obtenerEtiquetaCorta(vista: VistaCalendario, fecha: Date): string {
  const anio = fecha.getFullYear()
  const mesCorto = NOMBRES_MESES_CORTOS[fecha.getMonth()]

  switch (vista) {
    case 'mes':
      return `${mesCorto} ${anio}`
    case 'semana':
      return etiquetaRangoSemanaCorta(fecha, 6)
    case 'quincenal':
      return etiquetaRangoSemanaCorta(fecha, 13)
    case 'dia':
    case 'equipo': {
      const diaNum = fecha.getDate()
      return `${diaNum} ${mesCorto} ${anio}`
    }
    case 'anio':
      return `${anio}`
    default:
      return `${mesCorto} ${anio}`
  }
}

/** Helper: rango semanal completo (ej. "3 – 9 Mar 2026" o "28 Mar – 3 Abr 2026") */
function etiquetaRangoSemana(fecha: Date, diasOffset: number): string {
  const dia = fecha.getDay()
  const diffLunes = dia === 0 ? -6 : 1 - dia
  const lunes = new Date(fecha)
  lunes.setDate(fecha.getDate() + diffLunes)
  const fin = new Date(lunes)
  fin.setDate(lunes.getDate() + diasOffset)
  const mesInicio = NOMBRES_MESES[lunes.getMonth()].slice(0, 3)
  const mesFin = NOMBRES_MESES[fin.getMonth()].slice(0, 3)
  if (lunes.getMonth() === fin.getMonth()) {
    return `${lunes.getDate()} – ${fin.getDate()} ${mesInicio} ${lunes.getFullYear()}`
  }
  return `${lunes.getDate()} ${mesInicio} – ${fin.getDate()} ${mesFin} ${fin.getFullYear()}`
}

/** Helper: rango semanal corto para móvil */
function etiquetaRangoSemanaCorta(fecha: Date, diasOffset: number): string {
  const dia = fecha.getDay()
  const diffLunes = dia === 0 ? -6 : 1 - dia
  const lunes = new Date(fecha)
  lunes.setDate(fecha.getDate() + diffLunes)
  const fin = new Date(lunes)
  fin.setDate(lunes.getDate() + diasOffset)
  const mesInicio = NOMBRES_MESES_CORTOS[lunes.getMonth()]
  const mesFin = NOMBRES_MESES_CORTOS[fin.getMonth()]
  if (lunes.getMonth() === fin.getMonth()) {
    return `${lunes.getDate()}–${fin.getDate()} ${mesInicio}`
  }
  return `${lunes.getDate()} ${mesInicio} – ${fin.getDate()} ${mesFin}`
}

/* ─── Tipos ─── */

interface TipoFiltro {
  id: string
  clave: string
  etiqueta: string
  color: string
}

interface PropiedadesBarraHerramientas {
  vistaActiva: VistaCalendario
  fechaActual: Date
  onCambiarVista: (vista: VistaCalendario) => void
  onNavegar: (direccion: 'anterior' | 'siguiente' | 'hoy') => void
  tipos?: TipoFiltro[]
  filtroTipo?: string
  onCambiarFiltroTipo?: (tipo: string) => void
  filtroVista?: string
  onCambiarFiltroVista?: (vista: string) => void
}

/* ─── Componente ─── */

function BarraHerramientasCalendario({
  vistaActiva,
  fechaActual,
  onCambiarVista,
  onNavegar,
  tipos,
  filtroTipo = '',
  onCambiarFiltroTipo,
  filtroVista = 'todos',
  onCambiarFiltroVista,
}: PropiedadesBarraHerramientas) {
  const { t } = useTraduccion()
  const etiqueta = obtenerEtiqueta(vistaActiva, fechaActual)
  const etiquetaMovil = obtenerEtiquetaCorta(vistaActiva, fechaActual)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const filtrosRef = useRef<HTMLDivElement>(null)

  // Cerrar filtros al hacer click fuera
  useEffect(() => {
    if (!filtrosAbiertos) return
    const manejarClick = (e: MouseEvent) => {
      if (filtrosRef.current && !filtrosRef.current.contains(e.target as Node)) {
        setFiltrosAbiertos(false)
      }
    }
    document.addEventListener('mousedown', manejarClick)
    return () => document.removeEventListener('mousedown', manejarClick)
  }, [filtrosAbiertos])

  const hayFiltroActivo = filtroTipo !== '' || filtroVista !== 'todos'

  return (
    <div className="flex flex-col gap-1 mb-3">

      {/* ═══ Fila 1: Navegación (izquierda) + Filtros en desktop (derecha) ═══ */}
      <div className="flex items-center justify-between gap-2 py-1">

        {/* Navegación: Hoy + flechas + etiqueta */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Boton variante="secundario" tamano="xs" onClick={() => onNavegar('hoy')} aria-label={t('calendario.a11y.ir_a_hoy')}>
            {t('calendario.hoy')}
          </Boton>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => onNavegar('anterior')}
              aria-label={t('calendario.a11y.ir_dia_anterior')}
              className="p-1 rounded-md text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => onNavegar('siguiente')}
              aria-label={t('calendario.a11y.ir_dia_siguiente')}
              className="p-1 rounded-md text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          {/* Etiqueta completa en desktop, compacta en móvil */}
          <span className="text-sm font-semibold text-texto-primario whitespace-nowrap truncate hidden md:inline">
            {etiqueta}
          </span>
          <span className="text-sm font-semibold text-texto-primario whitespace-nowrap truncate md:hidden">
            {etiquetaMovil}
          </span>
        </div>

        {/* Filtros en desktop (Todos/Míos + Filtrar) — ocultos en móvil, van en fila 2 */}
        <div className="hidden md:flex items-center gap-2">
          <FiltroVista
            filtroVista={filtroVista}
            onCambiarFiltroVista={onCambiarFiltroVista}
          />
          <FiltroTipo
            tipos={tipos}
            filtroTipo={filtroTipo}
            onCambiarFiltroTipo={onCambiarFiltroTipo}
            hayFiltroActivo={hayFiltroActivo}
            filtrosAbiertos={filtrosAbiertos}
            setFiltrosAbiertos={setFiltrosAbiertos}
            filtrosRef={filtrosRef}
          />
        </div>
      </div>

      {/* ═══ Fila 2 (solo móvil): Filtros ═══ */}
      <div className="flex md:hidden items-center justify-between gap-2 py-1">
        <FiltroVista
          filtroVista={filtroVista}
          onCambiarFiltroVista={onCambiarFiltroVista}
        />
        <FiltroTipo
          tipos={tipos}
          filtroTipo={filtroTipo}
          onCambiarFiltroTipo={onCambiarFiltroTipo}
          hayFiltroActivo={hayFiltroActivo}
          filtrosAbiertos={filtrosAbiertos}
          setFiltrosAbiertos={setFiltrosAbiertos}
          filtrosRef={filtrosRef}
        />
      </div>

      {/* ═══ Fila final: Selector de vista — centrado ═══ */}
      <div className="flex items-center justify-center gap-0.5 py-0.5" role="tablist" aria-label={t('calendario.a11y.vista_calendario')}>
        {OPCIONES_VISTA.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            role="tab"
            aria-selected={vistaActiva === opcion.valor}
            onClick={() => onCambiarVista(opcion.valor)}
            className={[
              'px-2.5 md:px-3 py-1.5 text-xs rounded-md transition-all font-medium whitespace-nowrap',
              vistaActiva === opcion.valor
                ? 'bg-superficie-elevada text-texto-primario shadow-sm'
                : 'text-texto-terciario hover:text-texto-secundario hover:bg-superficie-hover/50',
            ].join(' ')}
          >
            <span className="hidden sm:inline">{opcion.etiqueta}</span>
            <span className="sm:hidden">{opcion.etiquetaCorta}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/* ─── Sub-componentes internos ─── */

/** Toggle Todos / Míos */
function FiltroVista({
  filtroVista,
  onCambiarFiltroVista,
}: {
  filtroVista: string
  onCambiarFiltroVista?: (vista: string) => void
}) {
  if (!onCambiarFiltroVista) return null

  return (
    <div className="flex items-center bg-superficie-tarjeta border border-borde-sutil rounded-lg p-0.5">
      {[
        { valor: 'todos', etiqueta: 'Todos' },
        { valor: 'mios', etiqueta: 'Míos' },
      ].map((op) => (
        <button
          key={op.valor}
          type="button"
          onClick={() => onCambiarFiltroVista(op.valor)}
          className={[
            'px-2.5 py-1 text-xs rounded-md transition-colors font-medium min-h-[32px] flex items-center',
            filtroVista === op.valor
              ? 'bg-superficie-elevada text-texto-primario shadow-sm'
              : 'text-texto-terciario hover:text-texto-secundario',
          ].join(' ')}
        >
          {op.etiqueta}
        </button>
      ))}
    </div>
  )
}

/** Botón + dropdown de filtros por tipo de evento */
function FiltroTipo({
  tipos,
  filtroTipo,
  onCambiarFiltroTipo,
  hayFiltroActivo,
  filtrosAbiertos,
  setFiltrosAbiertos,
  filtrosRef,
}: {
  tipos?: TipoFiltro[]
  filtroTipo: string
  onCambiarFiltroTipo?: (tipo: string) => void
  hayFiltroActivo: boolean
  filtrosAbiertos: boolean
  setFiltrosAbiertos: (abierto: boolean) => void
  filtrosRef: React.RefObject<HTMLDivElement | null>
}) {
  if (!tipos || tipos.length === 0) return null

  return (
    <div className="relative" ref={filtrosRef}>
      <button
        type="button"
        onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
        className={[
          'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors font-medium min-h-[32px]',
          hayFiltroActivo || filtrosAbiertos
            ? 'bg-superficie-elevada text-texto-primario border-borde-fuerte'
            : 'text-texto-terciario border-borde-sutil hover:border-borde-fuerte hover:text-texto-secundario',
        ].join(' ')}
      >
        <Filter size={13} />
        <span>Filtrar</span>
        {hayFiltroActivo && (
          <span className="size-1.5 rounded-full bg-texto-marca" />
        )}
      </button>

      {/* Dropdown — z-[60] con posición absoluta hacia abajo */}
      {filtrosAbiertos && (
        <div className="absolute right-0 top-full mt-1.5 z-[60] bg-superficie-elevada border border-borde-sutil rounded-xl shadow-xl p-3 min-w-[220px]">
          <p className="text-xs font-medium text-texto-terciario mb-2">Tipo de evento</p>
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => { onCambiarFiltroTipo?.(''); setFiltrosAbiertos(false) }}
              className={[
                'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left',
                filtroTipo === ''
                  ? 'bg-superficie-hover text-texto-primario font-medium'
                  : 'text-texto-secundario hover:bg-superficie-hover',
              ].join(' ')}
            >
              Todos los tipos
            </button>
            {tipos.map((tipo) => (
              <button
                key={tipo.id}
                type="button"
                onClick={() => {
                  onCambiarFiltroTipo?.(filtroTipo === tipo.clave ? '' : tipo.clave)
                  setFiltrosAbiertos(false)
                }}
                className={[
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left',
                  filtroTipo === tipo.clave
                    ? 'bg-superficie-hover text-texto-primario font-medium'
                    : 'text-texto-secundario hover:bg-superficie-hover',
                ].join(' ')}
              >
                <span
                  className="size-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: tipo.color }}
                />
                {tipo.etiqueta}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export { BarraHerramientasCalendario }
