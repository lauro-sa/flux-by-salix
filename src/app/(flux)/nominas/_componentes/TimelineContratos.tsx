'use client'

/**
 * TimelineContratos — Historial vertical de contratos de un miembro.
 *
 * Renderiza una lista con el contrato vigente arriba y los históricos
 * abajo (orden cronológico inverso). Cada ítem muestra rango de
 * fechas, modalidad, monto, sector, turno y motivo del cambio. Click
 * en un ítem alterna el detalle expandido.
 *
 * Se usa en: src/app/(flux)/nominas/empleado/[miembro_id]/page.tsx
 * (tab "Historial").
 */

import { useState } from 'react'
import type { ContratoLaboral } from '@/tipos/nominas'
import { ChevronDown, Circle } from 'lucide-react'

interface Props {
  contratos: ContratoLaboral[]
  /** Mapa sector_id → nombre, resuelto en el padre. */
  sectoresMap: Map<string, string>
  /** Mapa turno_id → nombre. */
  turnosMap: Map<string, string>
  locale?: string
  monedaSimbolo?: string
}

const ETIQUETAS_MODALIDAD: Record<string, string> = {
  por_hora: 'Por hora',
  por_dia: 'Por día',
  fijo_semanal: 'Fijo semanal',
  fijo_quincenal: 'Fijo quincenal',
  fijo_mensual: 'Fijo mensual',
}
const ETIQUETAS_FRECUENCIA: Record<string, string> = {
  diaria: 'Diaria',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
}

function formatearMonto(v: number, locale = 'es-AR', simbolo = '$') {
  return `${simbolo} ${v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatearFecha(iso: string, locale = 'es-AR') {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function TimelineContratos({ contratos, sectoresMap, turnosMap, locale = 'es-AR', monedaSimbolo = '$' }: Props) {
  if (contratos.length === 0) {
    return (
      <div className="px-4 md:px-6 py-8 text-sm text-texto-terciario text-center">
        Todavía no hay contratos registrados para este empleado.
      </div>
    )
  }

  return (
    <div className="px-4 md:px-6 py-4">
      <ol className="relative">
        {/* Línea vertical que une los puntos */}
        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-borde-sutil" aria-hidden="true" />

        {contratos.map((c, idx) => (
          <ItemTimeline
            key={c.id}
            contrato={c}
            esVigente={c.vigente}
            esUltimo={idx === contratos.length - 1}
            sectorNombre={c.sector_id ? sectoresMap.get(c.sector_id) ?? null : null}
            turnoNombre={c.turno_id ? turnosMap.get(c.turno_id) ?? null : null}
            locale={locale}
            monedaSimbolo={monedaSimbolo}
          />
        ))}
      </ol>
    </div>
  )
}

function ItemTimeline({
  contrato, esVigente, sectorNombre, turnoNombre, locale, monedaSimbolo,
}: {
  contrato: ContratoLaboral
  esVigente: boolean
  esUltimo: boolean
  sectorNombre: string | null
  turnoNombre: string | null
  locale: string
  monedaSimbolo: string
}) {
  const [abierto, setAbierto] = useState(false)

  const rangoFechas = contrato.fecha_fin
    ? `${formatearFecha(contrato.fecha_inicio, locale)} → ${formatearFecha(contrato.fecha_fin, locale)}`
    : `Desde ${formatearFecha(contrato.fecha_inicio, locale)}`

  return (
    <li className="relative pl-7 pb-5 last:pb-0">
      {/* Punto del timeline */}
      <div
        className={`absolute left-0 top-1 w-3.5 h-3.5 rounded-full border-2 ${
          esVigente
            ? 'bg-insignia-exito border-insignia-exito'
            : 'bg-superficie-app border-borde-fuerte'
        }`}
        aria-hidden="true"
      >
        {esVigente && <Circle size={6} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 fill-white text-white" />}
      </div>

      {/* Card del contrato */}
      <button
        type="button"
        onClick={() => setAbierto(v => !v)}
        className="w-full text-left rounded-card border border-borde-sutil bg-superficie-tarjeta hover:bg-superficie-elevada transition-colors p-3"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-texto-primario">{rangoFechas}</span>
              {esVigente && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-insignia-exito/15 text-insignia-exito uppercase tracking-wide">
                  Vigente
                </span>
              )}
            </div>
            <div className="text-xs text-texto-terciario mt-1">
              {ETIQUETAS_MODALIDAD[contrato.modalidad_calculo] ?? contrato.modalidad_calculo}
              {' · '}
              {formatearMonto(contrato.monto_base, locale, monedaSimbolo)}
              {' · '}
              Frec. {ETIQUETAS_FRECUENCIA[contrato.frecuencia_pago] ?? contrato.frecuencia_pago}
            </div>
          </div>
          <ChevronDown
            size={16}
            className={`text-texto-terciario transition-transform shrink-0 ${abierto ? 'rotate-180' : ''}`}
          />
        </div>

        {abierto && (
          <div className="mt-3 pt-3 border-t border-borde-sutil grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <KV etiqueta="Sector" valor={sectorNombre ?? '—'} />
            <KV etiqueta="Turno" valor={turnoNombre ?? '—'} />
            <KV etiqueta="Condición" valor={contrato.condicion.replace(/_/g, ' ')} />
            <KV etiqueta="Régimen" valor={contrato.regimen.replace(/_/g, ' ')} />
            {contrato.motivo_cambio && (
              <div className="col-span-2"><KV etiqueta="Motivo del cambio" valor={contrato.motivo_cambio} /></div>
            )}
            {contrato.notas && (
              <div className="col-span-2"><KV etiqueta="Notas" valor={contrato.notas} multilinea /></div>
            )}
          </div>
        )}
      </button>
    </li>
  )
}

function KV({ etiqueta, valor, multilinea = false }: { etiqueta: string; valor: string; multilinea?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-texto-terciario">{etiqueta}</div>
      <div className={`text-texto-primario ${multilinea ? 'whitespace-pre-wrap' : ''}`}>{valor}</div>
    </div>
  )
}
