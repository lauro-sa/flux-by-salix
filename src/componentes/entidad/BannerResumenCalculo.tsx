'use client'

import { type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'

/* ─── Tipos ─── */

/** Un término de la fórmula (ej: Bruto, Adelanto, Neto). */
export interface TerminoFormula {
  etiqueta: string
  valor: string
  /** Operador que PRECEDE a este término. Ignorado en el primero. Se muestra el "-" como "−" automáticamente. */
  operador?: '+' | '-' | '−' | '×' | '÷' | '='
  /** Color semántico del valor (default: heredado) */
  tono?: 'neutro' | 'exito' | 'advertencia' | 'peligro' | 'info' | 'marca'
  /** Si es el resultado final (se remarca más) */
  esResultado?: boolean
}

/** Estado del banner: controla color + icono */
export type TonoBanner = 'advertencia' | 'exito' | 'info' | 'peligro' | 'neutro'

interface PropiedadesBannerResumenCalculo {
  /** Tono general del banner (define color de borde, fondo y badge) */
  tono?: TonoBanner
  /** Etiqueta/badge a la izquierda arriba (ej: "A favor de la empresa") */
  etiquetaEstado?: string
  /** Texto chico al lado del badge (ej: "Pendiente de cierre") */
  subEstado?: string
  /** Ícono custom que reemplaza al default del tono */
  icono?: ReactNode
  /** Título grande de la situación (ej: "Este período no corresponde pago") */
  titulo: string
  /** Descripción más larga. Puede incluir montos resaltados con <strong> */
  descripcion?: ReactNode
  /** Términos de la fórmula en orden (mínimo 2) */
  formula?: TerminoFormula[]
  /** Acción a la derecha (ej: botón "Cerrar sin pago") */
  accion?: ReactNode
  className?: string
}

/**
 * Estilos por tono. `glowVar` es el color CSS crudo que usamos para el
 * gradiente radial de fondo (glow suave). Los demás son clases Tailwind.
 */
const toneStyles: Record<TonoBanner, {
  border: string
  bg: string
  glowVar: string
  badgeBg: string
  badgeText: string
  iconDefault: ReactNode
}> = {
  advertencia: {
    border: 'border-insignia-advertencia/30',
    bg: 'bg-insignia-advertencia/[0.03]',
    glowVar: 'var(--insignia-advertencia)',
    badgeBg: 'bg-insignia-advertencia/15 border-insignia-advertencia/25',
    badgeText: 'text-insignia-advertencia',
    iconDefault: <AlertTriangle size={14} />,
  },
  exito: {
    border: 'border-insignia-exito/30',
    bg: 'bg-insignia-exito/[0.03]',
    glowVar: 'var(--insignia-exito)',
    badgeBg: 'bg-insignia-exito/15 border-insignia-exito/25',
    badgeText: 'text-insignia-exito',
    iconDefault: <CheckCircle2 size={14} />,
  },
  info: {
    border: 'border-insignia-info/30',
    bg: 'bg-insignia-info/[0.03]',
    glowVar: 'var(--insignia-info)',
    badgeBg: 'bg-insignia-info/15 border-insignia-info/25',
    badgeText: 'text-insignia-info',
    iconDefault: <Info size={14} />,
  },
  peligro: {
    border: 'border-insignia-peligro/30',
    bg: 'bg-insignia-peligro/[0.03]',
    glowVar: 'var(--insignia-peligro)',
    badgeBg: 'bg-insignia-peligro/15 border-insignia-peligro/25',
    badgeText: 'text-insignia-peligro',
    iconDefault: <AlertTriangle size={14} />,
  },
  neutro: {
    border: 'border-borde-sutil',
    bg: 'bg-superficie-tarjeta',
    glowVar: 'transparent',
    badgeBg: 'bg-superficie-elevada border-borde-sutil',
    badgeText: 'text-texto-secundario',
    iconDefault: <Info size={14} />,
  },
}

const tonoToText: Record<NonNullable<TerminoFormula['tono']>, string> = {
  neutro: 'text-texto-primario',
  exito: 'text-insignia-exito',
  advertencia: 'text-insignia-advertencia',
  peligro: 'text-insignia-peligro',
  info: 'text-insignia-info',
  marca: 'text-texto-marca',
}

/**
 * BannerResumenCalculo — Banner colorido con badge de estado + título +
 * descripción y una fórmula visual (A − B − C = Total).
 * Se usa en: nómina (Bruto − Adelanto − Saldo = Neto), presupuestos
 * (Subtotal + IVA = Total), órdenes, cierres de caja, etc.
 */
function BannerResumenCalculo({
  tono = 'neutro',
  etiquetaEstado,
  subEstado,
  icono,
  titulo,
  descripcion,
  formula = [],
  accion,
  className = '',
}: PropiedadesBannerResumenCalculo) {
  const styles = toneStyles[tono]

  // Glow radial suave en la esquina superior izquierda del banner — da la
  // sensación de "resplandor" del color del estado sin saturar toda la caja.
  const glowStyle = styles.glowVar !== 'transparent'
    ? { backgroundImage: `radial-gradient(ellipse 600px 280px at 8% 0%, color-mix(in oklab, ${styles.glowVar} 14%, transparent) 0%, transparent 70%)` }
    : undefined

  return (
    <div
      className={`relative overflow-hidden rounded-card border ${styles.border} ${styles.bg} p-5 sm:p-7 ${className}`}
      style={glowStyle}
    >
      {/* Cabecera: badge + sub estado */}
      {(etiquetaEstado || subEstado) && (
        <div className="flex items-center gap-2 mb-3">
          {etiquetaEstado && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium ${styles.badgeBg} ${styles.badgeText}`}>
              {icono ?? styles.iconDefault}
              {etiquetaEstado}
            </span>
          )}
          {subEstado && (
            <span className="text-[11px] text-texto-terciario">{subEstado}</span>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-bold text-texto-primario leading-tight">{titulo}</h2>
          {descripcion && (
            <p className="text-sm text-texto-secundario mt-1.5 leading-relaxed max-w-3xl">{descripcion}</p>
          )}
        </div>
        {accion && <div className="shrink-0">{accion}</div>}
      </div>

      {/* Fórmula */}
      {formula.length > 0 && (
        <div className="mt-6 flex items-end gap-x-4 gap-y-4 sm:gap-x-6 flex-wrap">
          {formula.map((t, idx) => {
            const claseValor = `${tonoToText[t.tono ?? 'neutro']} ${t.esResultado ? 'text-3xl sm:text-4xl font-bold' : 'text-2xl sm:text-3xl font-semibold'}`
            return (
              <div key={idx} className="flex items-end gap-x-4 sm:gap-x-6">
                {idx > 0 && (
                  <span className="text-texto-terciario/70 text-xl sm:text-2xl font-light pb-1.5 select-none">
                    {t.operador === '-' ? '−' : (t.operador ?? '−')}
                  </span>
                )}
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium text-texto-terciario uppercase tracking-wider mb-1">
                    {t.etiqueta}
                  </span>
                  <span className={`${claseValor} leading-none`}>
                    {t.valor}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export { BannerResumenCalculo, type PropiedadesBannerResumenCalculo }
