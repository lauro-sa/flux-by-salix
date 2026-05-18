'use client'

/**
 * KpisSoporteNomina — 3 cards informativos secundarios del dashboard.
 *
 * Conviven en grid debajo del KpiHeroAccionPrincipal. Glass uniforme,
 * cifras tabulares, peso visual neutro (no compiten con el hero).
 *
 * Cards:
 *   1. Costo empresa → suma del bruto del período (lo que sale del bolsillo
 *      del patrón antes de descontar adelantos).
 *   2. Adelantos del período → suma de cuotas de adelantos descontadas en
 *      este período. Cuántas cuotas activas hay.
 *   3. Progreso → mini-bar segmentado (●●○○○) + leyenda "N pagados · N
 *      enviados · N sin liquidar". Escaneabilidad inmediata.
 *
 * Referencia: Raycast Pro (glass uniforme, cifras tabulares limpias,
 * sparkline gris).
 */

import { Wallet, Building2, BarChart3 } from 'lucide-react'

interface EmpleadoEstado {
  miembro_id: string
  estado_liquidacion?: 'borrador' | 'liquidado' | 'enviado' | 'pagado'
  monto_pagar: number
  descuento_adelanto: number
  cuotas_adelanto: number
  monto_neto: number
}

interface Props {
  resultados: EmpleadoEstado[]
}

function fmtMonto(v: number): string {
  return `$${v.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function KpisSoporteNomina({ resultados }: Props) {
  const empleadosConNeto = resultados.filter(r => r.monto_neto > 0)
  const total = empleadosConNeto.length

  // Card 1: Costo empresa (bruto total)
  const totalBruto = resultados.reduce((s, r) => s + r.monto_pagar, 0)

  // Card 2: Adelantos
  const totalAdelantos = resultados.reduce((s, r) => s + r.descuento_adelanto, 0)
  const cuotasActivas = resultados.reduce((s, r) => s + (r.cuotas_adelanto > 0 ? 1 : 0), 0)

  // Card 3: Progreso (conteo por estado)
  const conteo = {
    borrador: 0,
    liquidado: 0,
    enviado: 0,
    pagado: 0,
  }
  for (const r of empleadosConNeto) {
    const e = (r.estado_liquidacion ?? 'borrador') as keyof typeof conteo
    conteo[e] = (conteo[e] ?? 0) + 1
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 auto-rows-fr">
      {/* ── KPI: Costo empresa ── */}
      <article className="rounded-xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-md px-4 py-3.5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-texto-terciario">
            Costo empresa
          </p>
          <Building2 size={13} className="text-texto-terciario/60 shrink-0" />
        </div>
        <p className="text-2xl font-semibold text-texto-primario tabular-nums leading-none">
          {fmtMonto(totalBruto)}
        </p>
        <p className="text-[11px] text-texto-terciario mt-1.5">
          {resultados.length} empleado{resultados.length !== 1 ? 's' : ''} · bruto del período
        </p>
      </article>

      {/* ── KPI: Adelantos ── */}
      <article className="rounded-xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-md px-4 py-3.5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-texto-terciario">
            Adelantos
          </p>
          <Wallet size={13} className="text-texto-terciario/60 shrink-0" />
        </div>
        <p className={`text-2xl font-semibold tabular-nums leading-none ${
          totalAdelantos > 0 ? 'text-insignia-advertencia' : 'text-texto-primario'
        }`}>
          {totalAdelantos > 0 ? '−' : ''}{fmtMonto(totalAdelantos)}
        </p>
        <p className="text-[11px] text-texto-terciario mt-1.5">
          {cuotasActivas === 0
            ? 'Sin descuentos en el período'
            : `${cuotasActivas} cuota${cuotasActivas === 1 ? '' : 's'} activa${cuotasActivas === 1 ? '' : 's'}`}
        </p>
      </article>

      {/* ── KPI: Progreso ── */}
      <article className="rounded-xl border border-white/[0.06] bg-white/[0.025] backdrop-blur-md px-4 py-3.5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-texto-terciario">
            Progreso
          </p>
          <BarChart3 size={13} className="text-texto-terciario/60 shrink-0" />
        </div>
        {/* Mini-bar segmentado — un dot por empleado, color según estado.
            Si hay más de 12 empleados, se compacta a barra horizontal
            con segmentos proporcionales. */}
        {total === 0 ? (
          <p className="text-2xl font-semibold text-texto-terciario tabular-nums leading-none">—</p>
        ) : total <= 12 ? (
          <BarSegmentadaDots conteo={conteo} total={total} resultados={empleadosConNeto} />
        ) : (
          <BarSegmentadaProporcional conteo={conteo} total={total} />
        )}
        <p className="text-[11px] text-texto-terciario mt-1.5">
          {conteo.pagado} pagado{conteo.pagado === 1 ? '' : 's'}
          {conteo.enviado > 0 && ` · ${conteo.enviado} enviado${conteo.enviado === 1 ? '' : 's'}`}
          {(conteo.borrador + conteo.liquidado) > 0 && ` · ${conteo.borrador + conteo.liquidado} pendiente${(conteo.borrador + conteo.liquidado) === 1 ? '' : 's'}`}
        </p>
      </article>
    </div>
  )
}

// ─── Variantes de mini-bar ───

/** Hasta 12 empleados: un dot por cada uno con el color de su estado. */
function BarSegmentadaDots({
  resultados,
}: {
  conteo: Record<string, number>
  total: number
  resultados: EmpleadoEstado[]
}) {
  return (
    <div className="flex items-center gap-1 h-7">
      {resultados.map(r => {
        const estado = r.estado_liquidacion ?? 'borrador'
        const colorClase =
          estado === 'pagado' ? 'bg-insignia-exito'
          : estado === 'enviado' ? 'bg-insignia-info'
          : estado === 'liquidado' ? 'bg-insignia-info/50'
          : 'bg-white/[0.15]' // borrador
        return (
          <span
            key={r.miembro_id}
            className={`block size-2.5 rounded-full ${colorClase}`}
            aria-hidden
          />
        )
      })}
    </div>
  )
}

/** Más de 12 empleados: barra horizontal proporcional. */
function BarSegmentadaProporcional({
  conteo, total,
}: {
  conteo: Record<string, number>
  total: number
}) {
  const pct = (n: number) => (n / total) * 100
  return (
    <div className="flex items-center h-2.5 rounded-full overflow-hidden bg-white/[0.05]">
      {conteo.pagado > 0 && (
        <span className="h-full bg-insignia-exito" style={{ width: `${pct(conteo.pagado)}%` }} />
      )}
      {conteo.enviado > 0 && (
        <span className="h-full bg-insignia-info" style={{ width: `${pct(conteo.enviado)}%` }} />
      )}
      {conteo.liquidado > 0 && (
        <span className="h-full bg-insignia-info/50" style={{ width: `${pct(conteo.liquidado)}%` }} />
      )}
    </div>
  )
}
