'use client'

/**
 * KpiHeroAccionPrincipal — Card hero del dashboard de Liquidaciones.
 *
 * Es el "mojón visual" de la pantalla. Muestra LA acción más urgente del
 * período con CTA contextual derivado del estado agregado de los empleados
 * + estado del período completo:
 *
 *   estado_periodo='cerrado'                         → modo 'al-dia'    (verde celebratorio)
 *   ≥1 borrador                                       → modo 'liquidar' (ámbar, CTA "Liquidar (N)")
 *   todos liquidados, envío_obligatorio, ≥1 sin enviar → modo 'enviar' (ámbar, CTA "Enviar (N)")
 *   ≥1 liquidado/enviado sin pagar                    → modo 'pagar'    (ámbar, CTA "Pagar (N)")
 *   todos pagados, período abierto                    → modo 'cerrar'   (verde, CTA "Cerrar período")
 *   no hay empleados con neto > 0                     → modo 'al-dia'   (verde, sin CTA)
 *
 * Diseño (referencias Apple Card + Vision OS):
 *   - Gradiente metalizado (ámbar→bronce o verde-bosque según modo)
 *   - Highlight radial en esquina superior-izquierda (reflejo físico)
 *   - Cifra grande tabular-nums
 *   - CTA con peso físico (sombra inset + color cálido contrastante)
 */

import { useMemo } from 'react'
import { Banknote, Send, FileCheck, Lock, CheckCircle2 } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'

export type ModoAccionPrincipal = 'liquidar' | 'enviar' | 'pagar' | 'cerrar' | 'al-dia'

interface EmpleadoEstado {
  miembro_id: string
  estado_liquidacion?: 'borrador' | 'liquidado' | 'enviado' | 'pagado'
  monto_neto: number
}

interface Props {
  resultados: EmpleadoEstado[]
  estadoPeriodo: 'abierto' | 'cerrado' | string
  envioObligatorio: boolean
  /** Handlers — la pantalla los conecta a sus endpoints */
  onLiquidar?: (miembrosIds: string[]) => void
  onEnviar?: (miembrosIds: string[]) => void
  onPagar?: (miembrosIds: string[]) => void
  onCerrarPeriodo?: () => void
}

interface InfoHero {
  modo: ModoAccionPrincipal
  titulo: string
  subtitulo: string
  cifra: string | null
  ctaEtiqueta: string | null
  ctaIcono: React.ReactNode
  miembrosTarget: string[]
  /** Variante visual: 'urgente' (ámbar) o 'al-dia' (verde) */
  variante: 'urgente' | 'al-dia'
}

function formatearMonto(v: number): string {
  return `$${v.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

/**
 * Determina el modo y los datos a mostrar a partir de la composición de
 * estados por empleado.
 */
function calcularInfoHero(
  resultados: EmpleadoEstado[],
  estadoPeriodo: string,
  envioObligatorio: boolean,
): InfoHero {
  const empleadosConNeto = resultados.filter(r => r.monto_neto > 0)
  // Caso 0: sin empleados con neto → "nada que hacer" celebratorio
  if (empleadosConNeto.length === 0) {
    return {
      modo: 'al-dia',
      titulo: 'Sin liquidaciones pendientes',
      subtitulo: 'No hay empleados con neto a pagar en este período',
      cifra: null,
      ctaEtiqueta: null,
      ctaIcono: <CheckCircle2 size={18} />,
      miembrosTarget: [],
      variante: 'al-dia',
    }
  }

  // Caso 1: período cerrado → celebratorio con total transferido
  if (estadoPeriodo === 'cerrado') {
    const totalPagado = empleadosConNeto
      .filter(e => e.estado_liquidacion === 'pagado')
      .reduce((s, e) => s + e.monto_neto, 0)
    return {
      modo: 'al-dia',
      titulo: '✓ Período al día',
      subtitulo: `${empleadosConNeto.length} de ${empleadosConNeto.length} empleados pagados · ${formatearMonto(totalPagado)} transferidos`,
      cifra: null,
      ctaEtiqueta: null,
      ctaIcono: <Lock size={18} />,
      miembrosTarget: [],
      variante: 'al-dia',
    }
  }

  // Caso 2: hay borradores → modo Liquidar
  const enBorrador = empleadosConNeto.filter(e => (e.estado_liquidacion ?? 'borrador') === 'borrador')
  if (enBorrador.length > 0) {
    const monto = enBorrador.reduce((s, e) => s + e.monto_neto, 0)
    return {
      modo: 'liquidar',
      titulo: `${formatearMonto(monto)}`,
      subtitulo: `${enBorrador.length} ${enBorrador.length === 1 ? 'liquidación' : 'liquidaciones'} sin congelar`,
      cifra: null,
      ctaEtiqueta: `Liquidar (${enBorrador.length})`,
      ctaIcono: <FileCheck size={18} />,
      miembrosTarget: enBorrador.map(e => e.miembro_id),
      variante: 'urgente',
    }
  }

  // Caso 3: todos liquidados; si envío obligatorio, hay que enviar primero
  const sinEnviar = empleadosConNeto.filter(e => e.estado_liquidacion === 'liquidado')
  if (envioObligatorio && sinEnviar.length > 0) {
    const monto = sinEnviar.reduce((s, e) => s + e.monto_neto, 0)
    return {
      modo: 'enviar',
      titulo: `${formatearMonto(monto)}`,
      subtitulo: `${sinEnviar.length} ${sinEnviar.length === 1 ? 'recibo pendiente' : 'recibos pendientes'} de envío`,
      cifra: null,
      ctaEtiqueta: `Enviar (${sinEnviar.length})`,
      ctaIcono: <Send size={18} />,
      miembrosTarget: sinEnviar.map(e => e.miembro_id),
      variante: 'urgente',
    }
  }

  // Caso 4: hay liquidados o enviados sin pagar → modo Pagar
  const sinPagar = empleadosConNeto.filter(e =>
    e.estado_liquidacion === 'liquidado' || e.estado_liquidacion === 'enviado',
  )
  if (sinPagar.length > 0) {
    const monto = sinPagar.reduce((s, e) => s + e.monto_neto, 0)
    return {
      modo: 'pagar',
      titulo: `${formatearMonto(monto)}`,
      subtitulo: `${sinPagar.length} ${sinPagar.length === 1 ? 'pago pendiente' : 'pagos pendientes'}`,
      cifra: null,
      ctaEtiqueta: `Pagar (${sinPagar.length})`,
      ctaIcono: <Banknote size={18} />,
      miembrosTarget: sinPagar.map(e => e.miembro_id),
      variante: 'urgente',
    }
  }

  // Caso 5: todos pagados, período abierto → ofrecer cerrar
  return {
    modo: 'cerrar',
    titulo: '✓ Listo para cerrar',
    subtitulo: `${empleadosConNeto.length} de ${empleadosConNeto.length} empleados pagados`,
    cifra: null,
    ctaEtiqueta: 'Cerrar período',
    ctaIcono: <Lock size={18} />,
    miembrosTarget: [],
    variante: 'al-dia',
  }
}

export function KpiHeroAccionPrincipal({
  resultados,
  estadoPeriodo,
  envioObligatorio,
  onLiquidar,
  onEnviar,
  onPagar,
  onCerrarPeriodo,
}: Props) {
  const info = useMemo(
    () => calcularInfoHero(resultados, estadoPeriodo, envioObligatorio),
    [resultados, estadoPeriodo, envioObligatorio],
  )

  // Gradiente metalizado según variante. Apple Card vibe para 'urgente',
  // verde bosque para 'al-dia'.
  const gradiente = info.variante === 'urgente'
    ? 'linear-gradient(135deg, #2a1b0e 0%, #3d2a16 50%, #1f1408 100%)'
    : 'linear-gradient(135deg, #0e2a1b 0%, #163d2a 50%, #081f14 100%)'

  // Highlight radial superior-izquierdo para reflejo físico tipo metal.
  const overlayClase = info.variante === 'urgente'
    ? 'before:bg-[radial-gradient(circle_at_20%_15%,rgba(245,158,11,0.10),transparent_55%)]'
    : 'before:bg-[radial-gradient(circle_at_20%_15%,rgba(34,197,94,0.10),transparent_55%)]'

  const colorBorder = info.variante === 'urgente'
    ? 'border-amber-400/20'
    : 'border-emerald-400/20'

  const handleCta = () => {
    if (info.modo === 'liquidar') onLiquidar?.(info.miembrosTarget)
    else if (info.modo === 'enviar') onEnviar?.(info.miembrosTarget)
    else if (info.modo === 'pagar') onPagar?.(info.miembrosTarget)
    else if (info.modo === 'cerrar') onCerrarPeriodo?.()
  }

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border ${colorBorder} px-6 py-5 sm:px-7 sm:py-6 before:absolute before:inset-0 before:pointer-events-none ${overlayClase}`}
      style={{ background: gradiente }}
    >
      {/* Capa de contenido por encima del overlay */}
      <div className="relative flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-amber-200/60">
            {info.variante === 'urgente' ? 'Acción principal' : info.modo === 'cerrar' ? 'Próximo paso' : 'Estado'}
          </p>
          <h2 className="mt-1.5 text-3xl sm:text-5xl font-bold tabular-nums text-amber-50 leading-none tracking-tight">
            {info.titulo}
          </h2>
          <p className="mt-2 text-sm text-amber-100/70">
            {info.subtitulo}
          </p>
        </div>

        {info.ctaEtiqueta && (
          <div className="shrink-0 self-end">
            <Boton
              tamano="md"
              variante="primario"
              icono={info.ctaIcono}
              onClick={handleCta}
              className={info.variante === 'urgente'
                ? '!bg-amber-300 !text-amber-950 hover:!bg-amber-200 shadow-[0_2px_0_rgba(0,0,0,0.15)_inset,0_4px_12px_rgba(245,158,11,0.25)]'
                : '!bg-emerald-300 !text-emerald-950 hover:!bg-emerald-200 shadow-[0_2px_0_rgba(0,0,0,0.15)_inset,0_4px_12px_rgba(34,197,94,0.25)]'
              }
            >
              {info.ctaEtiqueta}
            </Boton>
          </div>
        )}

        {!info.ctaEtiqueta && info.modo === 'al-dia' && (
          <div className="shrink-0 self-end text-emerald-300/80">
            <CheckCircle2 size={32} strokeWidth={1.5} />
          </div>
        )}
      </div>
    </article>
  )
}
