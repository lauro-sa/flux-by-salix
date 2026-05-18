'use client'

/**
 * BarraFiltrosNomina — Toolbar de búsqueda y filtros del listado.
 *
 * Aparece entre los KPIs y la lista de empleados. Permite filtrar por:
 *   - Texto libre (nombre del empleado, normalizado sin acentos).
 *   - Estado de liquidación (todos / sin liquidar / liquidado / enviado / pagado).
 *   - Adelanto (todos / con adelanto activo / sin adelanto).
 *   - Vista compacta on/off (oculta sub-texto de cada fila; útil con 15+).
 *
 * Referencia visual: Linear filter popovers (compactos, sin label "Filter
 * by:", solo el valor activo).
 */

import { useMemo } from 'react'
import { Search, X, LayoutList, LayoutGrid } from 'lucide-react'

export type FiltroEstado = 'todos' | 'sin-liquidar' | 'liquidado' | 'enviado' | 'pagado'
export type FiltroAdelanto = 'todos' | 'con-adelanto' | 'sin-adelanto'

interface Props {
  busqueda: string
  onBusquedaChange: (v: string) => void
  filtroEstado: FiltroEstado
  onFiltroEstadoChange: (v: FiltroEstado) => void
  filtroAdelanto: FiltroAdelanto
  onFiltroAdelantoChange: (v: FiltroAdelanto) => void
  vistaCompacta: boolean
  onVistaCompactaToggle: () => void
  /** Cantidad total de resultados para activar/ocultar el toggle compacto. */
  totalResultados: number
  /** Conteo por estado para mostrar dentro de cada pill (ej: "Pagado (3)"). */
  conteo: Record<FiltroEstado, number>
}

const OPCIONES_ESTADO: { valor: FiltroEstado; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'sin-liquidar', etiqueta: 'Sin liquidar' },
  { valor: 'liquidado', etiqueta: 'Liquidado' },
  { valor: 'enviado', etiqueta: 'Enviado' },
  { valor: 'pagado', etiqueta: 'Pagado' },
]

const OPCIONES_ADELANTO: { valor: FiltroAdelanto; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Cualquiera' },
  { valor: 'con-adelanto', etiqueta: 'Con adelanto' },
  { valor: 'sin-adelanto', etiqueta: 'Sin adelanto' },
]

export function BarraFiltrosNomina({
  busqueda, onBusquedaChange,
  filtroEstado, onFiltroEstadoChange,
  filtroAdelanto, onFiltroAdelantoChange,
  vistaCompacta, onVistaCompactaToggle,
  totalResultados,
  conteo,
}: Props) {
  const mostrarToggleCompacto = totalResultados >= 15
  const hayBusqueda = busqueda.trim().length > 0

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* ── Búsqueda ── */}
      <div className="relative flex-1 min-w-[200px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-texto-terciario pointer-events-none" />
        <input
          type="text"
          value={busqueda}
          onChange={e => onBusquedaChange(e.target.value)}
          placeholder="Buscar empleado..."
          className="w-full h-9 pl-9 pr-9 rounded-lg text-sm bg-white/[0.02] border border-white/[0.06] text-texto-primario placeholder:text-texto-terciario/60 focus:outline-none focus:border-texto-marca/40 focus:bg-white/[0.04] transition-colors"
        />
        {hayBusqueda && (
          <button
            type="button"
            onClick={() => onBusquedaChange('')}
            title="Limpiar búsqueda"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-texto-terciario hover:text-texto-primario hover:bg-white/[0.05]"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* ── Filtro Estado (segmented) ── */}
      <SegmentedFiltro
        opciones={OPCIONES_ESTADO}
        valor={filtroEstado}
        onChange={onFiltroEstadoChange}
        conteo={conteo}
      />

      {/* ── Filtro Adelanto (segmented sin conteo) ── */}
      <SegmentedFiltro
        opciones={OPCIONES_ADELANTO}
        valor={filtroAdelanto}
        onChange={onFiltroAdelantoChange}
      />

      {/* ── Toggle vista compacta (solo con 15+ empleados) ── */}
      {mostrarToggleCompacto && (
        <button
          type="button"
          onClick={onVistaCompactaToggle}
          title={vistaCompacta ? 'Vista expandida' : 'Vista compacta'}
          className="size-9 flex items-center justify-center rounded-lg border border-white/[0.06] text-texto-secundario hover:bg-white/[0.05] hover:text-texto-primario transition-colors"
        >
          {vistaCompacta ? <LayoutGrid size={14} /> : <LayoutList size={14} />}
        </button>
      )}
    </div>
  )
}

// ─── Sub-componente: segmented genérico ─────────────────────────

function SegmentedFiltro<T extends string>({
  opciones, valor, onChange, conteo,
}: {
  opciones: { valor: T; etiqueta: string }[]
  valor: T
  onChange: (v: T) => void
  conteo?: Record<string, number>
}) {
  // Si el valor activo es 'todos' (default), mostrar versión compacta:
  // solo se ve el primer pill activo + "..." que abre dropdown. Por
  // ahora simplificado a render plano siempre — la UI lo soporta bien
  // con hasta 5-6 opciones.
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-lg bg-white/[0.02] border border-white/[0.06]">
      {opciones.map(o => {
        const activo = o.valor === valor
        const c = conteo?.[o.valor]
        const mostrarConteo = c !== undefined && c > 0 && o.valor !== 'todos'
        return (
          <button
            key={o.valor}
            type="button"
            onClick={() => onChange(o.valor)}
            className={`h-8 px-2.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              activo
                ? 'bg-texto-marca/15 text-texto-marca'
                : 'text-texto-terciario hover:text-texto-secundario hover:bg-white/[0.03]'
            }`}
          >
            {o.etiqueta}
            {mostrarConteo && (
              <span className={`ml-1.5 ${activo ? 'opacity-80' : 'opacity-50'}`}>
                {c}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Helpers de filtrado (puros, usables desde el componente padre) ────

/** Quita acentos y baja a minúscula para búsqueda tolerante. */
function normalizarTexto(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

interface ResultadoFiltrable {
  nombre: string
  estado_liquidacion?: 'borrador' | 'liquidado' | 'enviado' | 'pagado'
  descuento_adelanto: number
  cuotas_adelanto: number
}

/**
 * Aplica los filtros activos a la lista de resultados y devuelve los
 * que cumplen. Se llama desde VistaNomina con useMemo para evitar
 * recalcular en cada render.
 */
export function aplicarFiltros<T extends ResultadoFiltrable>(
  resultados: T[],
  filtros: {
    busqueda: string
    filtroEstado: FiltroEstado
    filtroAdelanto: FiltroAdelanto
  },
): T[] {
  const { busqueda, filtroEstado, filtroAdelanto } = filtros
  const q = normalizarTexto(busqueda.trim())

  return resultados.filter(r => {
    // Búsqueda por nombre.
    if (q && !normalizarTexto(r.nombre).includes(q)) return false

    // Estado de liquidación.
    if (filtroEstado !== 'todos') {
      const estadoR = r.estado_liquidacion ?? 'borrador'
      if (filtroEstado === 'sin-liquidar' && estadoR !== 'borrador') return false
      if (filtroEstado === 'liquidado' && estadoR !== 'liquidado') return false
      if (filtroEstado === 'enviado' && estadoR !== 'enviado') return false
      if (filtroEstado === 'pagado' && estadoR !== 'pagado') return false
    }

    // Adelanto.
    if (filtroAdelanto === 'con-adelanto' && r.descuento_adelanto <= 0) return false
    if (filtroAdelanto === 'sin-adelanto' && r.descuento_adelanto > 0) return false

    return true
  })
}

/** Calcula el conteo por estado para mostrar dentro de cada pill. */
export function contarPorEstado<T extends ResultadoFiltrable>(
  resultados: T[],
): Record<FiltroEstado, number> {
  const c: Record<FiltroEstado, number> = {
    todos: resultados.length,
    'sin-liquidar': 0,
    liquidado: 0,
    enviado: 0,
    pagado: 0,
  }
  for (const r of resultados) {
    const e = r.estado_liquidacion ?? 'borrador'
    if (e === 'borrador') c['sin-liquidar']++
    else if (e === 'liquidado') c.liquidado++
    else if (e === 'enviado') c.enviado++
    else if (e === 'pagado') c.pagado++
  }
  return c
}
