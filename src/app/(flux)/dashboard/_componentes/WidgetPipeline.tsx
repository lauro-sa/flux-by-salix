'use client'

/**
 * WidgetPipeline — Embudo comercial estándar de CRM.
 *
 * Convención (Pipedrive/HubSpot/Salesforce):
 *  - Tres KPIs al tope: Pipeline activo · Ganado · Perdido
 *  - Win Rate = Ganado / (Ganado + Perdido), solo sobre cerrados
 *  - Vista Embudo: lista plana de estados con barras
 *  - Vista Detalle: tabla agrupada por categoría con subtotales
 */

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { InfoBoton } from '@/componentes/ui/InfoBoton'
import { formatoCompacto } from './compartidos'

type Categoria = 'abierto' | 'ganado' | 'perdido'

interface MetaEstado {
  clave: string
  etiqueta: string
  subtitulo: string
}

const ESTADOS_POR_CATEGORIA: Record<Categoria, MetaEstado[]> = {
  abierto: [
    { clave: 'borrador', etiqueta: 'Borrador', subtitulo: 'sin enviar' },
    { clave: 'enviado', etiqueta: 'Enviado', subtitulo: 'esperando respuesta' },
    { clave: 'confirmado_cliente', etiqueta: 'Confirmado', subtitulo: 'esperando firma' },
  ],
  ganado: [
    { clave: 'orden_venta', etiqueta: 'Orden de venta', subtitulo: 'en producción' },
    { clave: 'completado', etiqueta: 'Completado', subtitulo: 'entregado y cobrado' },
  ],
  perdido: [
    { clave: 'rechazado', etiqueta: 'Rechazado', subtitulo: 'cerrado negativo' },
    { clave: 'vencido', etiqueta: 'Vencido', subtitulo: 'cerrado negativo' },
    { clave: 'cancelado', etiqueta: 'Cancelado', subtitulo: 'cerrado negativo' },
  ],
}

const COLOR_TEXTO: Record<string, string> = {
  borrador: 'text-texto-secundario',
  enviado: 'text-insignia-violeta-texto',
  confirmado_cliente: 'text-insignia-info-texto',
  orden_venta: 'text-insignia-exito-texto',
  completado: 'text-insignia-exito-texto',
  rechazado: 'text-insignia-peligro-texto',
  vencido: 'text-insignia-naranja-texto',
  cancelado: 'text-insignia-peligro-texto',
}

const COLOR_BARRA: Record<string, string> = {
  borrador: 'bg-texto-terciario/40',
  enviado: 'bg-insignia-violeta-texto',
  confirmado_cliente: 'bg-insignia-info-texto',
  orden_venta: 'bg-insignia-exito-texto',
  completado: 'bg-insignia-exito-texto/80',
  rechazado: 'bg-insignia-peligro-texto',
  vencido: 'bg-insignia-naranja-texto',
  cancelado: 'bg-insignia-peligro-texto/80',
}

const META_CATEGORIA: Record<Categoria, { etiqueta: string; color: string; punto: string }> = {
  abierto: { etiqueta: 'En juego', color: 'text-texto-marca', punto: 'bg-texto-marca' },
  ganado: { etiqueta: 'Ganado', color: 'text-insignia-exito-texto', punto: 'bg-insignia-exito' },
  perdido: { etiqueta: 'Perdido', color: 'text-insignia-peligro-texto', punto: 'bg-insignia-peligro' },
}

interface Props {
  porEstado: Record<string, number>
  pipelineMontos: Record<string, number>
  formatoMoneda: (n: number) => string
}

function sumarCantidades(porEstado: Record<string, number>, categoria: Categoria): number {
  return ESTADOS_POR_CATEGORIA[categoria].reduce((s, e) => s + (porEstado[e.clave] || 0), 0)
}

function sumarMontos(pipelineMontos: Record<string, number>, categoria: Categoria): number {
  return ESTADOS_POR_CATEGORIA[categoria].reduce((s, e) => s + (pipelineMontos[e.clave] || 0), 0)
}

export function WidgetPipeline({ porEstado, pipelineMontos, formatoMoneda }: Props) {
  const router = useRouter()
  const [vista, setVista] = useState<'embudo' | 'detalle'>('embudo')

  const cantAbierto = sumarCantidades(porEstado, 'abierto')
  const cantGanado = sumarCantidades(porEstado, 'ganado')
  const cantPerdido = sumarCantidades(porEstado, 'perdido')
  const cantTotal = cantAbierto + cantGanado + cantPerdido

  const montoAbierto = sumarMontos(pipelineMontos, 'abierto')
  const montoGanado = sumarMontos(pipelineMontos, 'ganado')
  const montoPerdido = sumarMontos(pipelineMontos, 'perdido')

  const cantCerrados = cantGanado + cantPerdido
  const winRate = cantCerrados > 0 ? Math.round((cantGanado / cantCerrados) * 100) : 0

  const montoMax = Math.max(...Object.values(pipelineMontos), 1)

  const estadosConDatos = (
    [...ESTADOS_POR_CATEGORIA.abierto, ...ESTADOS_POR_CATEGORIA.ganado, ...ESTADOS_POR_CATEGORIA.perdido]
      .filter((e) => (porEstado[e.clave] || 0) > 0 || (pipelineMontos[e.clave] || 0) > 0)
  )

  return (
    <div className="rounded-card border border-borde-sutil bg-superficie-tarjeta overflow-hidden">
      {/* ─── Header con tabs ─── */}
      <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-borde-sutil">
        <div className="flex items-center gap-1.5 min-w-0">
          <h3 className="text-sm font-semibold text-texto-primario truncate">Pipeline de presupuestos</h3>
          <InfoBoton
            titulo="Pipeline de presupuestos"
            secciones={[
              {
                titulo: 'Para qué sirve',
                contenido: (
                  <p>
                    Te muestra <strong className="text-texto-primario">cómo viene tu negocio</strong>:
                    cuánta plata tenés en juego, cuánto ya vendiste y cuánto no se concretó. Es la foto
                    del estado de tus presupuestos hoy.
                  </p>
                ),
              },
              {
                titulo: 'Las tres situaciones',
                contenido: (
                  <ul className="space-y-1.5 list-none">
                    <li>
                      <strong className="text-texto-marca">Activo:</strong> presupuestos que todavía no
                      se definieron. El cliente puede aceptar o rechazar. Es la plata que está &quot;en juego&quot;.
                    </li>
                    <li>
                      <strong className="text-insignia-exito-texto">Ganado:</strong> presupuestos que el
                      cliente aceptó. Ya son ventas firmes (algunos en producción, otros ya entregados y cobrados).
                    </li>
                    <li>
                      <strong className="text-insignia-peligro-texto">Perdido:</strong> presupuestos que
                      no se concretaron porque el cliente los rechazó, vencieron sin respuesta o se cancelaron.
                    </li>
                  </ul>
                ),
              },
              {
                titulo: 'Qué es el win rate',
                contenido: (
                  <p>
                    Es el <strong className="text-texto-primario">porcentaje de presupuestos cerrados que
                    terminaron en venta</strong>. Por ejemplo: si cerraste 10 presupuestos y 7 los ganaste,
                    tu win rate es 70%. <span className="text-texto-terciario">No incluye los que están
                    todavía abiertos —solo los que ya se definieron.</span>
                  </p>
                ),
              },
              {
                titulo: 'Cómo interpretarlo',
                contenido: (
                  <ul className="space-y-1.5 list-none">
                    <li>
                      <span className="text-insignia-exito-texto">●</span>{' '}
                      <strong className="text-texto-primario">Win rate sobre 50%</strong>: tu negocio está
                      vendiendo bien lo que cotiza.
                    </li>
                    <li>
                      <span className="text-insignia-advertencia-texto">●</span>{' '}
                      <strong className="text-texto-primario">Entre 25% y 50%</strong>: aceptable, pero hay
                      margen para mejorar el cierre.
                    </li>
                    <li>
                      <span className="text-insignia-peligro-texto">●</span>{' '}
                      <strong className="text-texto-primario">Menos de 25%</strong>: estás perdiendo muchas
                      oportunidades. Revisá precios, tiempos de respuesta o si los leads están bien calificados.
                    </li>
                  </ul>
                ),
              },
              {
                titulo: 'El flujo del pipeline',
                contenido: (
                  <p>
                    Las barras de abajo muestran <strong className="text-texto-primario">cuánta plata
                    representa cada estado</strong>. Te ayuda a ver dónde está el grueso del dinero —si
                    tenés mucho en &quot;Enviado&quot; quiere decir que estás esperando muchas respuestas.
                  </p>
                ),
              },
              {
                titulo: 'Cruzá esta info con otros widgets',
                contenido: (
                  <ul className="space-y-2 list-none">
                    <li>
                      <strong className="text-texto-primario">Con &quot;Cobros del año&quot;:</strong>{' '}
                      <span className="text-texto-terciario">si vendiste mucho pero la tasa de cobro
                      es baja, ganaste pero todavía no entró la plata. Restar Vendido − Cobrado te dice
                      qué tenés por cobrar.</span>
                    </li>
                    <li>
                      <strong className="text-texto-primario">Con &quot;Comparativa interanual&quot;:</strong>{' '}
                      <span className="text-texto-terciario">mirá si estás generando más presupuestos
                      que el año anterior. Más volumen + buen win rate = crecimiento real.</span>
                    </li>
                    <li>
                      <strong className="text-texto-primario">Con &quot;Clientes&quot;:</strong>{' '}
                      <span className="text-texto-terciario">cruzá el pipeline con el tipo de cliente
                      principal. Si tu segmento top genera poca venta, tenés que diversificar.</span>
                    </li>
                    <li>
                      <strong className="text-texto-primario">Proyección rápida:</strong>{' '}
                      <span className="text-texto-terciario">de los $X que tenés en &quot;Activo&quot;,
                      si tu win rate se mantiene, esperá ganar aproximadamente X × win rate.</span>
                    </li>
                  </ul>
                ),
              },
            ]}
          />
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setVista('embudo')}
            className={`px-2.5 py-1 rounded-full text-xxs font-medium transition-colors ${
              vista === 'embudo'
                ? 'bg-texto-marca/[0.1] text-texto-marca'
                : 'text-texto-terciario hover:text-texto-secundario'
            }`}
          >
            Embudo
          </button>
          <button
            type="button"
            onClick={() => setVista('detalle')}
            className={`px-2.5 py-1 rounded-full text-xxs font-medium transition-colors ${
              vista === 'detalle'
                ? 'bg-texto-marca/[0.1] text-texto-marca'
                : 'text-texto-terciario hover:text-texto-secundario'
            }`}
          >
            Detalle
          </button>
        </div>
      </div>

      {/* ─── Tres KPIs al tope ───
          Usamos formato compacto ($939M en lugar de $939.392.712) para que
          quepa siempre, sin importar el ancho disponible. El monto exacto va
          en el title attr para hover. */}
      <div className="px-4 sm:px-5 pt-5 grid grid-cols-3 gap-2">
        <KpiCard
          label="Activo"
          monto={montoAbierto}
          montoTitle={formatoMoneda(montoAbierto)}
          formatoCompacto={(n) => formatoCompacto(n, formatoMoneda)}
          subtitulo={
            <>
              <span className="font-medium tabular-nums text-texto-secundario">{cantAbierto}</span>
              {' '}{cantAbierto === 1 ? 'abierto' : 'abiertos'}
            </>
          }
          colorBorde="border-texto-marca/25"
          colorFondo="bg-texto-marca/[0.03]"
          colorLabel="text-texto-marca"
          colorMonto="text-texto-primario"
        />
        <KpiCard
          label="Ganado"
          monto={montoGanado}
          montoTitle={formatoMoneda(montoGanado)}
          formatoCompacto={(n) => formatoCompacto(n, formatoMoneda)}
          subtitulo={
            <>
              <span className="font-medium tabular-nums text-texto-secundario">{cantGanado}</span>
              {cantCerrados > 0 && (
                <>
                  {' '}· win rate{' '}
                  <span className="font-semibold text-insignia-exito-texto tabular-nums">{winRate}%</span>
                </>
              )}
            </>
          }
          colorBorde="border-insignia-exito/25"
          colorFondo="bg-insignia-exito/[0.04]"
          colorLabel="text-insignia-exito-texto"
          colorMonto="text-insignia-exito-texto"
        />
        <KpiCard
          label="Perdido"
          monto={montoPerdido}
          montoTitle={formatoMoneda(montoPerdido)}
          formatoCompacto={(n) => formatoCompacto(n, formatoMoneda)}
          subtitulo={
            <>
              <span className="font-medium tabular-nums text-texto-secundario">{cantPerdido}</span>
              {' '}{cantPerdido === 1 ? 'cerrado' : 'cerrados'}
            </>
          }
          colorBorde="border-insignia-peligro/25"
          colorFondo="bg-insignia-peligro/[0.04]"
          colorLabel="text-insignia-peligro-texto"
          colorMonto="text-insignia-peligro-texto"
        />
      </div>

      {/* ─── Vista Embudo: lista plana de estados ─── */}
      {vista === 'embudo' && (
        <div className="px-4 sm:px-5 pt-6 pb-5">
          <p className="text-xxs uppercase tracking-widest text-texto-terciario mb-3">
            Flujo del pipeline
            {' · '}
            <span className="text-texto-secundario font-medium tabular-nums">{cantTotal}</span>
            {' '}{cantTotal === 1 ? 'presupuesto' : 'presupuestos'}
          </p>

          {estadosConDatos.length > 0 ? (
            <div className="space-y-2.5">
              {estadosConDatos.map((e) => {
                const monto = pipelineMontos[e.clave] || 0
                const cant = porEstado[e.clave] || 0
                const porcentaje = montoMax > 0 ? (monto / montoMax) * 100 : 0

                return (
                  <div key={e.clave} className="space-y-1.5">
                    {/* Línea 1: etiqueta · subtítulo · cant · monto */}
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0 flex-1 leading-tight">
                        <p className={`text-sm font-medium ${COLOR_TEXTO[e.clave] || 'text-texto-primario'} truncate`}>
                          {e.etiqueta}
                          <span className="ml-2 text-xxs text-texto-terciario font-normal">{e.subtitulo}</span>
                        </p>
                      </div>
                      <span className="text-xs text-texto-terciario tabular-nums shrink-0">
                        {cant}
                      </span>
                      <span
                        className={`text-sm font-semibold text-right tabular-nums shrink-0 ${COLOR_TEXTO[e.clave] || 'text-texto-primario'}`}
                        title={formatoMoneda(monto)}
                      >
                        {formatoMoneda(monto)}
                      </span>
                    </div>

                    {/* Línea 2: barra horizontal full width */}
                    <div className="h-2 rounded-full bg-superficie-hover/60 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${COLOR_BARRA[e.clave] || 'bg-texto-marca/50'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(porcentaje, 1)}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-texto-terciario text-center py-6">Sin presupuestos registrados</p>
          )}
        </div>
      )}

      {/* ─── Vista Detalle: tabla agrupada por categoría ─── */}
      {vista === 'detalle' && (
        <div className="px-4 sm:px-5 pt-6 pb-5">
          <div className="grid grid-cols-[1fr_56px_auto] gap-4 px-3 pb-2 border-b border-borde-sutil/60 text-xxs uppercase tracking-widest text-texto-terciario">
            <span>Estado</span>
            <span className="text-right">Cant.</span>
            <span className="text-right">Monto</span>
          </div>

          <div>
            {(['abierto', 'ganado', 'perdido'] as const).map((cat) => {
              const estados = ESTADOS_POR_CATEGORIA[cat].filter((e) => (porEstado[e.clave] || 0) > 0)
              if (estados.length === 0) return null

              const meta = META_CATEGORIA[cat]
              const cantCat = sumarCantidades(porEstado, cat)
              const montoCat = sumarMontos(pipelineMontos, cat)

              return (
                <div key={cat}>
                  <div className={`grid grid-cols-[1fr_56px_auto] gap-4 px-3 py-2 mt-3 rounded-md ${
                    cat === 'abierto' ? 'bg-texto-marca/[0.06]'
                    : cat === 'ganado' ? 'bg-insignia-exito/[0.06]'
                    : 'bg-insignia-peligro/[0.06]'
                  }`}>
                    <span className="inline-flex items-center gap-2 text-xxs uppercase tracking-widest font-medium">
                      <span className={`size-1.5 rounded-full ${meta.punto}`} />
                      <span className={meta.color}>{meta.etiqueta}</span>
                    </span>
                    <span className={`text-right tabular-nums font-semibold text-sm ${meta.color}`}>
                      {cantCat}
                    </span>
                    <span className={`text-right tabular-nums font-semibold text-sm ${meta.color} whitespace-nowrap`}>
                      {formatoMoneda(montoCat)}
                    </span>
                  </div>

                  {estados.map((e) => (
                    <div
                      key={e.clave}
                      className="grid grid-cols-[1fr_56px_auto] gap-4 px-3 py-2 items-center text-sm border-b border-borde-sutil/30 last:border-b-0"
                    >
                      <span className="text-texto-secundario pl-4 truncate">{e.etiqueta}</span>
                      <span className="text-texto-primario text-right tabular-nums">
                        {porEstado[e.clave] || 0}
                      </span>
                      <span className="text-texto-primario font-medium text-right tabular-nums whitespace-nowrap">
                        {formatoMoneda(pipelineMontos[e.clave] || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )
            })}
          </div>

          {cantTotal === 0 && (
            <p className="text-xs text-texto-terciario text-center py-6">Sin presupuestos registrados</p>
          )}
        </div>
      )}

      {/* Footer */}
      <button
        type="button"
        onClick={() => router.push('/presupuestos')}
        className="w-full px-4 sm:px-5 py-3 border-t border-borde-sutil/60 text-xs text-texto-marca hover:text-texto-marca/80 transition-colors inline-flex items-center justify-center gap-1.5 font-medium"
      >
        Ver todos los presupuestos <ArrowRight className="size-3.5" />
      </button>
    </div>
  )
}

// ─── Card de KPI con monto compacto + monto exacto en hover ───────────────
function KpiCard({
  label, monto, montoTitle, formatoCompacto, subtitulo,
  colorBorde, colorFondo, colorLabel, colorMonto,
}: {
  label: string
  monto: number
  montoTitle: string
  formatoCompacto: (n: number) => string
  subtitulo: React.ReactNode
  colorBorde: string
  colorFondo: string
  colorLabel: string
  colorMonto: string
}) {
  return (
    <div className={`rounded-lg border ${colorBorde} ${colorFondo} px-3 py-2.5 min-w-0`}>
      <p className={`text-[10px] uppercase tracking-wider ${colorLabel} mb-1 font-medium truncate`}>
        {label}
      </p>
      <p
        className={`text-base sm:text-lg font-semibold tabular-nums ${colorMonto} leading-tight whitespace-nowrap`}
        title={montoTitle}
      >
        {formatoCompacto(monto)}
      </p>
      <p className="text-[10px] text-texto-terciario mt-1 truncate">
        {subtitulo}
      </p>
    </div>
  )
}
