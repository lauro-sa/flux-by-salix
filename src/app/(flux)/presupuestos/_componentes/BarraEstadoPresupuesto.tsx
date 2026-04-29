'use client'

import { useState, useEffect, useRef } from 'react'
import type { EstadoPresupuesto } from '@/tipos/presupuesto'
import {
  ETIQUETAS_ESTADO, ETIQUETAS_ESTADO_CORTA,
  FLUJO_ESTADO, ESTADOS_TERMINALES, TRANSICIONES_ESTADO,
} from '@/tipos/presupuesto'
import { ChevronDown, Check } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'

/**
 * BarraEstadoPresupuesto — Stepper de chevrones inteligente.
 *
 * - El paso activo muestra la etiqueta completa.
 * - Los demás muestran etiqueta corta (abreviada).
 * - Al hover se expande y muestra la etiqueta completa.
 * - Clickeable para cambiar estado (solo transiciones válidas).
 * - Estados terminales (cancelado, rechazado, vencido) como badge aparte.
 * - Mobile: pill compacta con dropdown.
 */

const FLECHA = 12

// Colores RGB por estado
const COLOR_RGB: Record<EstadoPresupuesto, string> = {
  borrador: '100, 116, 139',
  enviado: '59, 130, 246',          // azul correo (#3b82f6)
  confirmado_cliente: '245, 158, 11', // ámbar (sigue, ahora único)
  orden_venta: '16, 185, 129',      // verde
  completado: '91, 91, 214',        // color de marca Flux (#5b5bd6)
  rechazado: '239, 68, 68',
  cancelado: '113, 113, 122',
  vencido: '245, 158, 11',
}

function clipPathChevron(esPrimero: boolean, esUltimo: boolean) {
  if (esPrimero && esUltimo) return 'none'
  const F = FLECHA
  if (esPrimero) return `polygon(0 0, calc(100% - ${F}px) 0, 100% 50%, calc(100% - ${F}px) 100%, 0 100%)`
  if (esUltimo) return `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${F}px 50%)`
  return `polygon(0 0, calc(100% - ${F}px) 0, 100% 50%, calc(100% - ${F}px) 100%, 0 100%, ${F}px 50%)`
}

interface PropiedadesBarraEstado {
  estadoActual: EstadoPresupuesto
  onCambiarEstado?: (estado: EstadoPresupuesto) => void
}

export default function BarraEstadoPresupuesto({ estadoActual, onCambiarEstado }: PropiedadesBarraEstado) {
  const esTerminal = ESTADOS_TERMINALES.includes(estadoActual)
  const idxActual = FLUJO_ESTADO.indexOf(estadoActual)
  const idxEfectivo = esTerminal ? -1 : (idxActual === -1 ? FLUJO_ESTADO.length - 1 : idxActual)
  const transicionesValidas = TRANSICIONES_ESTADO[estadoActual] || []

  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  function handleClick(estado: EstadoPresupuesto) {
    if (!onCambiarEstado || estado === estadoActual || !transicionesValidas.includes(estado)) return
    onCambiarEstado(estado)
  }

  return (
    <>
      {/* Mobile: pill compacta */}
      <div className="sm:hidden">
        <PillMobile
          estadoActual={estadoActual}
          idxEfectivo={idxEfectivo}
          esTerminal={esTerminal}
          transicionesValidas={transicionesValidas}
          onCambiarEstado={onCambiarEstado}
        />
      </div>

      {/* Desktop: chevrones */}
      <div className="hidden sm:inline-flex items-center gap-2">
        <div
          className="inline-flex items-stretch"
          onMouseLeave={() => setHoverIdx(null)}
        >
          {FLUJO_ESTADO.map((estado, i) => {
            const esPrimero = i === 0
            const esUltimo = i === FLUJO_ESTADO.length - 1
            const esActual = i === idxEfectivo
            const esPasado = esTerminal ? true : i < idxEfectivo
            const rgb = COLOR_RGB[estado]
            const esClickeable = !!onCambiarEstado && !esActual && transicionesValidas.includes(estado)
            const enHover = hoverIdx === i

            // El actual siempre expandido, el hover también se expande, los demás comprimidos
            const etiqueta = (esActual || enHover)
              ? (ETIQUETAS_ESTADO[estado] || estado)
              : (ETIQUETAS_ESTADO_CORTA[estado] || estado.slice(0, 4))

            return (
              <div
                key={estado}
                role="button"
                tabIndex={0}
                onClick={() => esClickeable && handleClick(estado)}
                onKeyDown={(e) => { if (e.key === 'Enter' && esClickeable) handleClick(estado) }}
                onMouseEnter={() => setHoverIdx(i)}
                style={{
                  clipPath: clipPathChevron(esPrimero, esUltimo),
                  // Solapamiento reducido para que se vea el fondo detrás
                  // entre chevrones (estilo segmentado como los botones).
                  marginLeft: esPrimero ? 0 : -FLECHA + 4,
                  paddingLeft: esPrimero ? 14 : FLECHA + 8,
                  paddingRight: esUltimo ? 14 : FLECHA + 8,
                  zIndex: enHover ? FLUJO_ESTADO.length + 1 : FLUJO_ESTADO.length - i,
                  backgroundColor: esActual
                    ? `rgba(${rgb}, 0.75)`
                    : enHover
                      ? `rgba(${rgb}, ${esClickeable ? 0.30 : 0.15})`
                      : esPasado
                        ? `rgba(${rgb}, 0.10)`
                        : 'var(--superficie-app)',
                  color: esActual
                    ? 'white'
                    : enHover
                      ? 'var(--texto-primario)'
                      : undefined,
                }}
                className={`relative flex items-center justify-center gap-1 py-2 text-xs font-semibold whitespace-nowrap transition-colors duration-200 select-none focus-visible:outline-2 focus-visible:outline-texto-marca focus-visible:-outline-offset-2 ${
                  esActual
                    ? ''
                    : enHover
                      ? ''
                      : esPasado
                        ? 'text-texto-secundario'
                        : 'text-texto-terciario'
                } ${esClickeable ? 'cursor-pointer' : esActual ? '' : 'cursor-default'}`}
              >
                {esPasado && !esActual && <Check size={12} />}
                <span>{etiqueta}</span>
              </div>
            )
          })}
        </div>

        {esTerminal && (
          <BadgeTerminal
            estado={estadoActual}
            onCambiarEstado={onCambiarEstado}
            transicionesValidas={transicionesValidas}
          />
        )}
      </div>
    </>
  )
}

// ── Badge para estados terminales ──
function BadgeTerminal({
  estado, onCambiarEstado, transicionesValidas,
}: {
  estado: EstadoPresupuesto
  onCambiarEstado?: (estado: EstadoPresupuesto) => void
  transicionesValidas: EstadoPresupuesto[]
}) {
  const rgb = COLOR_RGB[estado]
  const esClickeable = !!onCambiarEstado && transicionesValidas.length > 0
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => esClickeable && setAbierto(v => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white transition-all focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2 ${
          esClickeable ? 'cursor-pointer active:scale-95' : 'cursor-default'
        }`}
        style={{ backgroundColor: `rgba(${rgb}, 0.75)` }}
      >
        {ETIQUETAS_ESTADO[estado] || estado}
        {esClickeable && <ChevronDown size={14} className={`transition-transform ${abierto ? 'rotate-180' : ''}`} />}
      </button>

      {abierto && (
        <div className="absolute top-full mt-2 right-0 z-50 min-w-40 bg-superficie-elevada border border-borde-sutil rounded-card shadow-lg overflow-hidden py-1">
          {transicionesValidas.map(est => (
            <Boton
              key={est}
              variante="fantasma"
              tamano="sm"
              onClick={() => { onCambiarEstado?.(est); setAbierto(false) }}
              className="w-full h-auto px-3 py-2 text-left"
            >
              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: `rgba(${COLOR_RGB[est]}, 0.8)` }} />
              <span className="text-texto-secundario">{ETIQUETAS_ESTADO[est] || est}</span>
            </Boton>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Pill mobile ──
function PillMobile({
  estadoActual, idxEfectivo, esTerminal, transicionesValidas, onCambiarEstado,
}: {
  estadoActual: EstadoPresupuesto
  idxEfectivo: number
  esTerminal: boolean
  transicionesValidas: EstadoPresupuesto[]
  onCambiarEstado?: (estado: EstadoPresupuesto) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const rgb = COLOR_RGB[estadoActual]
  const progreso = esTerminal ? 100 : FLUJO_ESTADO.length > 1 ? Math.round((idxEfectivo / (FLUJO_ESTADO.length - 1)) * 100) : 100
  const tieneTransiciones = !!onCambiarEstado && transicionesValidas.length > 0

  useEffect(() => {
    if (!abierto) return
    const cerrar = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [abierto])

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        type="button"
        onClick={() => tieneTransiciones && setAbierto(v => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-white transition-all ${
          tieneTransiciones ? 'cursor-pointer active:scale-95' : 'cursor-default'
        }`}
        style={{ backgroundColor: `rgba(${rgb}, 0.75)` }}
      >
        {ETIQUETAS_ESTADO[estadoActual] || estadoActual}
        {!esTerminal && <span className="text-xxs opacity-70">{idxEfectivo + 1}/{FLUJO_ESTADO.length}</span>}
        {tieneTransiciones && <ChevronDown size={14} className={`transition-transform ${abierto ? 'rotate-180' : ''}`} />}
      </button>

      <div className="absolute -bottom-2 left-3 right-3 h-[3px] rounded-full bg-white/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progreso}%`, backgroundColor: `rgba(${rgb}, 0.6)` }} />
      </div>

      {abierto && (
        <div className="absolute top-full mt-3 right-0 z-50 min-w-44 max-w-[calc(100vw-1.5rem)] bg-superficie-elevada border border-borde-sutil rounded-card shadow-lg overflow-hidden py-1">
          {[...FLUJO_ESTADO, ...(esTerminal ? [estadoActual] : [])].map((estado, i) => {
            const esActual = estado === estadoActual
            const esPasado = esTerminal ? (i < FLUJO_ESTADO.length) : (i < idxEfectivo)
            const esClickeable = !esActual && transicionesValidas.includes(estado)
            return (
              <Boton
                key={estado}
                variante="fantasma"
                tamano="sm"
                disabled={!esClickeable}
                onClick={() => { if (esClickeable) { onCambiarEstado?.(estado); setAbierto(false) } }}
                className={`w-full h-auto px-3 py-2 text-left ${
                  esActual ? 'font-semibold' : ''
                } ${!esClickeable ? 'opacity-50 cursor-default' : ''}`}
              >
                <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: `rgba(${COLOR_RGB[estado]}, ${esActual || esPasado ? 0.8 : 0.25})` }} />
                <span className={esActual ? 'text-texto-primario' : 'text-texto-secundario'}>{ETIQUETAS_ESTADO[estado] || estado}</span>
                {esActual && <Check size={14} className="text-texto-marca ml-auto" />}
                {esPasado && !esActual && <Check size={12} className="text-texto-terciario ml-auto" />}
              </Boton>
            )
          })}
        </div>
      )}
    </div>
  )
}
