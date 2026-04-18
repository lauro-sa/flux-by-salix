'use client'

/**
 * BarraHerramientasCalendario — Barra de navegación y controles del calendario.
 * Usa el patrón <CabezaloHero> reutilizable (mismo que Matriz asistencias y Nómina):
 *   - Fila hero: título editorial del período + navegación ‹ Hoy ›
 *   - Fila controles: selector de vista + filtros (Todos/Míos + Filtrar)
 * Se usa en: página principal del calendario.
 */

import { useState, useRef, useEffect, type ReactNode } from 'react'
import { Filter } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import { GrupoBotones } from '@/componentes/ui/GrupoBotones'
import { CabezaloHero, HeroRango, type PeriodoHero } from '@/componentes/entidad/CabezaloHero'
import { useTraduccion } from '@/lib/i18n'
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

const DIAS_SEMANA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/* ─── Helpers de rango para el hero ─── */

/** Calcula el rango [desde, hasta] representativo del período según la vista */
function obtenerRangoHero(vista: VistaCalendario, fecha: Date): { desde: Date; hasta: Date } {
  const anio = fecha.getFullYear()
  const mes = fecha.getMonth()

  switch (vista) {
    case 'mes':
      return { desde: new Date(anio, mes, 1), hasta: new Date(anio, mes + 1, 0) }
    case 'semana': {
      const d = fecha.getDay()
      const diffLunes = d === 0 ? -6 : 1 - d
      const desde = new Date(fecha); desde.setDate(fecha.getDate() + diffLunes); desde.setHours(0, 0, 0, 0)
      const hasta = new Date(desde); hasta.setDate(desde.getDate() + 6)
      return { desde, hasta }
    }
    case 'quincenal': {
      const d = fecha.getDay()
      const diffLunes = d === 0 ? -6 : 1 - d
      const desde = new Date(fecha); desde.setDate(fecha.getDate() + diffLunes); desde.setHours(0, 0, 0, 0)
      const hasta = new Date(desde); hasta.setDate(desde.getDate() + 13)
      return { desde, hasta }
    }
    case 'agenda': {
      const hasta = new Date(fecha); hasta.setDate(fecha.getDate() + 30)
      return { desde: fecha, hasta }
    }
    case 'dia':
    case 'equipo':
    default:
      return { desde: fecha, hasta: fecha }
  }
}

/** Construye el contenido del hero según la vista activa */
function construirHero(vista: VistaCalendario, fecha: Date): ReactNode {
  // Vista año: no es un rango, solo mostrar "2026 · AÑO · Vista anual"
  if (vista === 'anio') {
    return (
      <div className="flex items-stretch gap-3 sm:gap-4 min-w-0">
        <span className="text-4xl sm:text-5xl font-bold text-texto-primario leading-none tracking-tight">
          {fecha.getFullYear()}
        </span>
        <div className="flex flex-col justify-center gap-1 min-w-0 py-1">
          <span className="text-sm sm:text-base font-semibold text-texto-marca uppercase tracking-[0.15em] leading-none">Año</span>
          <span className="text-xs sm:text-[13px] text-texto-terciario uppercase tracking-wider leading-none">Vista anual</span>
        </div>
      </div>
    )
  }

  const { desde, hasta } = obtenerRangoHero(vista, fecha)
  const periodo: PeriodoHero | undefined =
    vista === 'semana' ? 'semana' :
    vista === 'mes' ? 'mes' :
    vista === 'quincenal' ? 'quincena' :
    undefined

  // Para agenda: etiqueta custom "Agenda" + subtítulo "Próximos 30 días"
  if (vista === 'agenda') {
    return <HeroRango desde={desde} hasta={hasta} etiqueta="Agenda" subtitulo="Próximos 30 días" />
  }

  // Día / Equipo: un solo día — subtítulo con día de la semana
  if (vista === 'dia' || vista === 'equipo') {
    const diaSemana = DIAS_SEMANA_CORTO[fecha.getDay()]
    return <HeroRango desde={desde} hasta={hasta} subtitulo={<>{fecha.getFullYear()} · {diaSemana}</>} />
  }

  // Mes, semana, quincenal
  return <HeroRango desde={desde} hasta={hasta} periodo={periodo} />
}

/** ¿La fecha actual cae dentro del período que engloba a "hoy"? */
function esPeriodoDeHoy(vista: VistaCalendario, fecha: Date): boolean {
  const hoy = new Date()
  const { desde, hasta } = obtenerRangoHero(vista, fecha)
  const hoyMs = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()
  const desdeMs = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate()).getTime()
  const hastaMs = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate()).getTime()
  return hoyMs >= desdeMs && hoyMs <= hastaMs
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
  const hoyDeshabilitado = esPeriodoDeHoy(vistaActiva, fechaActual)

  return (
    <CabezaloHero
      titulo={construirHero(vistaActiva, fechaActual)}
      onAnterior={() => onNavegar('anterior')}
      onSiguiente={() => onNavegar('siguiente')}
      onHoy={() => onNavegar('hoy')}
      hoyDeshabilitado={hoyDeshabilitado}
      slotControles={<>
        {/* Selector de vista — segmented */}
        <GrupoBotones>
          {OPCIONES_VISTA.map((opcion) => (
            <Boton
              key={opcion.valor}
              variante="secundario"
              tamano="sm"
              onClick={() => onCambiarVista(opcion.valor)}
              className={vistaActiva === opcion.valor ? 'bg-superficie-hover text-texto-primario font-semibold' : 'text-texto-terciario'}
              titulo={opcion.etiqueta}
            >
              <span className="hidden sm:inline">{opcion.etiqueta}</span>
              <span className="sm:hidden">{opcion.etiquetaCorta}</span>
            </Boton>
          ))}
        </GrupoBotones>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Todos / Míos */}
        <FiltroVista
          filtroVista={filtroVista}
          onCambiarFiltroVista={onCambiarFiltroVista}
        />

        {/* Filtrar por tipo */}
        <FiltroTipo
          tipos={tipos}
          filtroTipo={filtroTipo}
          onCambiarFiltroTipo={onCambiarFiltroTipo}
          hayFiltroActivo={hayFiltroActivo}
          filtrosAbiertos={filtrosAbiertos}
          setFiltrosAbiertos={setFiltrosAbiertos}
          filtrosRef={filtrosRef}
        />
        {/* Oculto pero referenciado: a11y labels */}
        <span className="sr-only">{t('calendario.a11y.vista_calendario')}</span>
      </>}
    />
  )
}

/* ─── Sub-componentes internos ─── */

/** Toggle Todos / Míos — estilo GrupoBotones alineado con el resto */
function FiltroVista({
  filtroVista,
  onCambiarFiltroVista,
}: {
  filtroVista: string
  onCambiarFiltroVista?: (vista: string) => void
}) {
  if (!onCambiarFiltroVista) return null

  return (
    <GrupoBotones>
      {[
        { valor: 'todos', etiqueta: 'Todos' },
        { valor: 'mios', etiqueta: 'Míos' },
      ].map((op) => (
        <Boton
          key={op.valor}
          variante="secundario"
          tamano="sm"
          onClick={() => onCambiarFiltroVista(op.valor)}
          className={filtroVista === op.valor ? 'bg-superficie-hover text-texto-primario font-semibold' : 'text-texto-terciario'}
        >
          {op.etiqueta}
        </Boton>
      ))}
    </GrupoBotones>
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
      <Boton
        variante="secundario"
        tamano="sm"
        icono={<Filter size={13} />}
        onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
        className={hayFiltroActivo || filtrosAbiertos ? 'text-texto-marca bg-texto-marca/10 border-texto-marca/30' : ''}
      >
        Filtrar
        {hayFiltroActivo && <span className="ml-1.5 size-1.5 rounded-full bg-texto-marca inline-block" />}
      </Boton>

      {/* Dropdown */}
      {filtrosAbiertos && (
        <div className="absolute right-0 top-full mt-1.5 z-[var(--z-dropdown)] bg-superficie-elevada border border-borde-sutil rounded-card shadow-xl p-3 min-w-[220px]">
          <p className="text-xs font-medium text-texto-terciario mb-2">Tipo de evento</p>
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => { onCambiarFiltroTipo?.(''); setFiltrosAbiertos(false) }}
              className={[
                'flex items-center gap-2 px-2.5 py-1.5 rounded-card text-sm transition-colors text-left',
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
                  'flex items-center gap-2 px-2.5 py-1.5 rounded-card text-sm transition-colors text-left',
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
