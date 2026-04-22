'use client'

import { useMemo, type ReactNode } from 'react'

/* ─── Tipos ─── */

/** Clave semántica del estado de un día. Permite tematizar colores/leyenda */
export type EstadoDiaMini = string

/** Configuración visual de un estado (color del fondo/borde + etiqueta de leyenda) */
export interface DefinicionEstado {
  clave: EstadoDiaMini
  etiqueta: string
  /** Clase Tailwind para el fondo (modo sólido). Ej: "bg-insignia-exito" */
  claseFondo: string
  /** Clase Tailwind del texto (default: 'text-white' sobre fondo, 'text-texto-terciario' en modo borde) */
  claseTexto?: string
  /** Si true, pinta sólo el borde (para estados "suaves" como feriado no trabajado) */
  soloBorde?: boolean
}

/** Mapa de fecha ISO (YYYY-MM-DD) → clave del estado */
export type MapaEstadosDia = Record<string, EstadoDiaMini>

/** Controla si se muestran los días alineados por semana o como una fila continua */
export type LayoutCalendarioMini = 'auto' | 'fila' | 'grilla'

interface PropiedadesCalendarioPeriodoMini {
  /** Fecha inicio del período (YYYY-MM-DD) */
  desde: string
  /** Fecha fin del período (YYYY-MM-DD, inclusive) */
  hasta: string
  /** Estados de cada día (claves que deben existir en `estados`). Días sin clave se dejan neutros */
  diasEstado: MapaEstadosDia
  /** Catálogo de estados con su estilo y etiqueta de leyenda */
  estados: DefinicionEstado[]
  /**
   * Layout del calendario.
   * - 'auto' (default): fila si son ≤14 días, grilla 7-col con cabecera L-D si son más.
   * - 'fila': siempre fila única.
   * - 'grilla': siempre grilla 7 columnas alineadas por día de semana.
   */
  layout?: LayoutCalendarioMini
  /** Mostrar leyenda debajo del calendario. Default: true */
  mostrarLeyenda?: boolean
  /**
   * Fecha de "hoy" a resaltar (YYYY-MM-DD). Si no se pasa, usa la fecha local del navegador.
   * El caller puede pasarla para respetar la zona horaria de la empresa.
   * Pasar `null` para desactivar el destaque.
   */
  fechaHoy?: string | null
  /** Callback al click de un día — útil para abrir detalle */
  onClickDia?: (fechaISO: string) => void
  /** Slot extra después del grid (ej: texto de ayuda) */
  pie?: ReactNode
  className?: string
}

/* ─── Helpers ─── */

/** Construye la lista de fechas ISO entre desde y hasta (inclusive) */
function rangoFechas(desde: string, hasta: string): string[] {
  const out: string[] = []
  const d = new Date(desde + 'T12:00:00')
  const fin = new Date(hasta + 'T12:00:00')
  while (d <= fin) {
    out.push(d.toISOString().split('T')[0])
    d.setDate(d.getDate() + 1)
  }
  return out
}

/** Día de la semana empezando en lunes (0 = lunes, 6 = domingo) */
function diaSemanaLunes(fechaISO: string): number {
  const d = new Date(fechaISO + 'T12:00:00').getDay() // 0 = dom, 1 = lun, ..., 6 = sab
  return (d + 6) % 7 // 0 = lun, 6 = dom
}

const ETIQUETAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

/**
 * CalendarioPeriodoMini — Visualiza los días del período coloreados según su estado.
 * Se usa en: detalle de nómina, seguimiento de visitas por día, progreso diario, etc.
 *
 * Estructura:
 *  - Fila con los N días (layout 'fila') o grilla semanal (layout 'grilla').
 *  - Leyenda opcional debajo con los estados definidos.
 */
function CalendarioPeriodoMini({
  desde,
  hasta,
  diasEstado,
  estados,
  layout = 'auto',
  mostrarLeyenda = true,
  fechaHoy,
  onClickDia,
  pie,
  className = '',
}: PropiedadesCalendarioPeriodoMini) {
  const fechas = useMemo(() => rangoFechas(desde, hasta), [desde, hasta])
  const mapaEstados = useMemo(() => new Map(estados.map(e => [e.clave, e])), [estados])

  // Hoy en ISO local. Si el caller pasa `null` explícitamente, se desactiva el destaque.
  const hoyISO = fechaHoy === null
    ? null
    : fechaHoy ?? new Date().toISOString().split('T')[0]

  // Decide modo: auto ⇒ fila si ≤14 días, grilla si son más (típicamente mes).
  const modo: Exclude<LayoutCalendarioMini, 'auto'> =
    layout !== 'auto' ? layout : fechas.length <= 14 ? 'fila' : 'grilla'

  // En modo grilla usamos celdas de altura fija (más compactas que aspect-square,
  // que con 7 columnas quedaban innecesariamente grandes).
  const compacto = modo === 'grilla'

  const interactivo = Boolean(onClickDia)

  /** Render de una celda de día (estilo cambia según modo compacto o no) */
  const renderCelda = (f: string) => {
    const clave = diasEstado[f]
    const def = clave ? mapaEstados.get(clave) : undefined
    const dia = new Date(f + 'T12:00:00').getDate()
    const esHoy = hoyISO === f

    const claseFondo = def?.soloBorde
      ? `border ${def.claseFondo} bg-transparent`
      : def?.claseFondo || 'bg-superficie-hover/50 border border-borde-sutil'
    const claseTexto = def?.claseTexto || (def && !def.soloBorde ? 'text-white' : 'text-texto-terciario')
    const claseTamano = compacto
      ? 'h-7 rounded-[5px] text-[10px]'
      : 'aspect-square rounded-[7px] text-[11px]'
    // Anillo para destacar HOY sin tapar el color del estado
    const claseHoy = esHoy
      ? 'ring-2 ring-offset-2 ring-offset-superficie-tarjeta ring-texto-marca'
      : ''

    return (
      <button
        key={f}
        type="button"
        onClick={interactivo ? () => onClickDia!(f) : undefined}
        disabled={!interactivo}
        className={`
          ${claseTamano} flex items-center justify-center
          font-semibold tabular-nums select-none
          ${claseFondo} ${claseTexto} ${claseHoy}
          ${interactivo ? 'cursor-pointer hover:ring-2 hover:ring-white/20 transition-all' : 'cursor-default'}
        `}
        title={def ? `${f} — ${def.etiqueta}${esHoy ? ' (hoy)' : ''}` : f}
      >
        {dia}
      </button>
    )
  }

  return (
    <div className={className}>
      {modo === 'fila' ? (
        <FilaCalendario fechas={fechas} renderCelda={renderCelda} />
      ) : (
        <GrillaCalendario fechas={fechas} renderCelda={renderCelda} />
      )}

      {/* Leyenda */}
      {mostrarLeyenda && estados.length > 0 && (
        <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap mt-3">
          {estados.map(e => {
            // Extrae la clase de color base (bg- o border-) sin modificadores
            const claseBase = e.claseFondo.split(' ')[0]
            const esBorde = e.soloBorde || claseBase.startsWith('border-')
            return (
              <div key={e.clave} className="flex items-center gap-1.5">
                <span
                  className={`size-2.5 rounded-[3px] ${
                    esBorde ? `border ${claseBase} bg-transparent` : claseBase
                  }`}
                />
                <span className="text-[11px] text-texto-terciario">{e.etiqueta}</span>
              </div>
            )
          })}
        </div>
      )}

      {pie && <div className="mt-2">{pie}</div>}
    </div>
  )
}

/* ─── Layouts internos ─── */

interface PropiedadesLayoutInterno {
  fechas: string[]
  renderCelda: (fecha: string) => ReactNode
}

/** Fila continua: ideal para semana o quincena (≤14 días). Con etiquetas de borde. */
function FilaCalendario({ fechas, renderCelda }: PropiedadesLayoutInterno) {
  if (fechas.length === 0) return null
  const inicio = new Date(fechas[0] + 'T12:00:00')
  const fin = new Date(fechas[fechas.length - 1] + 'T12:00:00')
  const mesAbrev = (d: Date) =>
    d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '').toUpperCase()

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className="text-[10px] text-texto-terciario uppercase tracking-wider">
          {inicio.getDate()} {mesAbrev(inicio)}
        </span>
        <span className="text-[10px] text-texto-terciario uppercase tracking-wider">
          {fin.getDate()} {mesAbrev(fin)}
        </span>
      </div>
      <div className="grid grid-flow-col auto-cols-fr gap-1">
        {fechas.map(renderCelda)}
      </div>
    </div>
  )
}

/** Grilla 7 columnas alineada por día de la semana. Ideal para mes completo. */
function GrillaCalendario({ fechas, renderCelda }: PropiedadesLayoutInterno) {
  if (fechas.length === 0) return null

  // Espacios vacíos al inicio para alinear el primer día con su día de semana
  const offsetInicio = diaSemanaLunes(fechas[0])
  // Espacios al final para completar la última semana (opcional, mejora prolijidad)
  const totalCeldas = offsetInicio + fechas.length
  const offsetFin = (7 - (totalCeldas % 7)) % 7

  const vacios = (cantidad: number, prefijo: string) =>
    Array.from({ length: cantidad }, (_, i) => (
      <div key={`${prefijo}-${i}`} className="h-7" />
    ))

  return (
    <div>
      {/* Cabecera L M X J V S D */}
      <div className="grid grid-cols-7 gap-1 mb-1.5">
        {ETIQUETAS_SEMANA.map((letra, i) => (
          <span
            key={i}
            className={`text-[10px] font-medium uppercase text-center tracking-wider ${
              i >= 5 ? 'text-texto-terciario/60' : 'text-texto-terciario'
            }`}
          >
            {letra}
          </span>
        ))}
      </div>
      {/* Días */}
      <div className="grid grid-cols-7 gap-1">
        {vacios(offsetInicio, 'ini')}
        {fechas.map(renderCelda)}
        {vacios(offsetFin, 'fin')}
      </div>
    </div>
  )
}

export { CalendarioPeriodoMini, type PropiedadesCalendarioPeriodoMini }
