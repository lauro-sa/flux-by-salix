'use client'

import { useState, useEffect } from 'react'
import { Repeat } from 'lucide-react'
import { Select } from '@/componentes/ui/Select'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * SelectorRecurrencia — Selector de recurrencia avanzada.
 * Modo normal: 6 botones de frecuencia + sub-opciones expandibles.
 * Modo compacto: Select dropdown + panel de detalle con AnimatePresence.
 * Soporta: diario, semanal (con días), mensual (día fijo o semana+día),
 * cada X meses, anual.
 * Se usa en: RecordatoriosHeader (compacto), Vitrina (normal).
 */

/* ─── Tipos ─── */

export type Frecuencia = 'ninguno' | 'diario' | 'semanal' | 'mensual' | 'personalizado' | 'anual'

export interface ConfigRecurrencia {
  frecuencia: Frecuencia
  diasSemana?: number[]
  diaMes?: number | null
  semanaDelMes?: number | null
  diaSemanaDelMes?: number | null
  cadaMeses?: number
}

export const RECURRENCIA_DEFAULT: ConfigRecurrencia = {
  frecuencia: 'ninguno',
}

interface PropiedadesSelectorRecurrencia {
  valor: ConfigRecurrencia
  onChange: (valor: ConfigRecurrencia) => void
  fechaReferencia?: string | null
  /** Modo compacto: Select dropdown en vez de botones */
  compacto?: boolean
}

/* ─── Constantes ─── */

const DIAS_SEMANA = [
  { valor: 1, etiqueta: 'L', nombre: 'Lunes' },
  { valor: 2, etiqueta: 'M', nombre: 'Martes' },
  { valor: 3, etiqueta: 'X', nombre: 'Miércoles' },
  { valor: 4, etiqueta: 'J', nombre: 'Jueves' },
  { valor: 5, etiqueta: 'V', nombre: 'Viernes' },
  { valor: 6, etiqueta: 'S', nombre: 'Sábado' },
  { valor: 0, etiqueta: 'D', nombre: 'Domingo' },
]

const OPCIONES_SELECT = [
  { valor: 'ninguno', etiqueta: 'No repetir' },
  { valor: 'diario', etiqueta: 'Todos los días' },
  { valor: 'semanal', etiqueta: 'Cada semana' },
  { valor: 'mensual', etiqueta: 'Cada mes' },
  { valor: 'personalizado', etiqueta: 'Cada X meses' },
  { valor: 'anual', etiqueta: 'Cada año' },
]

const OPCIONES_MESES = [2, 3, 4, 6]

const SEMANAS = [
  { valor: 1, etiqueta: 'Primer' },
  { valor: 2, etiqueta: 'Segundo' },
  { valor: 3, etiqueta: 'Tercer' },
  { valor: 4, etiqueta: 'Cuarto' },
  { valor: -1, etiqueta: 'Último' },
]

/* ─── Helpers ─── */

function obtenerDiaDelMes(fecha: string | null): number {
  if (!fecha) return new Date().getDate()
  return new Date(fecha + 'T00:00:00').getDate()
}

function obtenerDiaSemana(fecha: string | null): number {
  if (!fecha) return new Date().getDay()
  return new Date(fecha + 'T00:00:00').getDay()
}

export function textoRecurrencia(config: ConfigRecurrencia): string {
  if (config.frecuencia === 'ninguno') return 'No se repite'
  if (config.frecuencia === 'diario') return 'Todos los días'
  if (config.frecuencia === 'anual') return 'Cada año'

  if (config.frecuencia === 'semanal') {
    if (!config.diasSemana || config.diasSemana.length === 0) return 'Cada semana'
    if (config.diasSemana.length === 7) return 'Todos los días'
    if (config.diasSemana.length === 5 && [1, 2, 3, 4, 5].every((d) => config.diasSemana!.includes(d))) return 'Días hábiles'
    const nombres = config.diasSemana.map((d) => DIAS_SEMANA.find((ds) => ds.valor === d)?.nombre || '').filter(Boolean)
    return `Cada ${nombres.join(', ')}`
  }

  if (config.frecuencia === 'mensual' || config.frecuencia === 'personalizado') {
    const cadaMeses = config.cadaMeses || 1
    const prefijo = cadaMeses === 1 ? 'Cada mes' : `Cada ${cadaMeses} meses`
    if (config.diaMes) return `${prefijo}, día ${config.diaMes}`
    if (config.semanaDelMes != null && config.diaSemanaDelMes != null) {
      const semana = SEMANAS.find((s) => s.valor === config.semanaDelMes)?.etiqueta || ''
      const dia = DIAS_SEMANA.find((d) => d.valor === config.diaSemanaDelMes)?.nombre || ''
      return `${prefijo}, ${semana.toLowerCase()} ${dia.toLowerCase()}`
    }
    return prefijo
  }

  return 'Personalizado'
}

/* ─── Sub-componente: Detalle de recurrencia ─── */

function DetalleRecurrencia({
  valor,
  onChange,
  fechaReferencia,
}: {
  valor: ConfigRecurrencia
  onChange: (v: ConfigRecurrencia) => void
  fechaReferencia: string | null
}) {
  const diaRef = obtenerDiaDelMes(fechaReferencia)
  const diaSemanaRef = obtenerDiaSemana(fechaReferencia)

  const toggleDiaSemana = (dia: number) => {
    const actuales = valor.diasSemana || []
    const nuevos = actuales.includes(dia)
      ? actuales.filter((d) => d !== dia)
      : [...actuales, dia].sort((a, b) => a - b)
    onChange({ ...valor, diasSemana: nuevos.length > 0 ? nuevos : [diaSemanaRef] })
  }

  if (valor.frecuencia === 'semanal') {
    return (
      <div className="flex gap-1">
        {DIAS_SEMANA.map((d) => (
          <button
            key={d.valor}
            onClick={() => toggleDiaSemana(d.valor)}
            className={[
              'size-7 rounded-md text-xxs font-semibold border cursor-pointer transition-all flex items-center justify-center',
              (valor.diasSemana || []).includes(d.valor)
                ? 'bg-texto-marca text-white border-texto-marca'
                : 'bg-transparent border-borde-sutil text-texto-terciario hover:text-texto-secundario',
            ].join(' ')}
            title={d.nombre}
          >
            {d.etiqueta}
          </button>
        ))}
      </div>
    )
  }

  if (valor.frecuencia === 'mensual' || valor.frecuencia === 'personalizado') {
    return (
      <div className="flex flex-col gap-2">
        {valor.frecuencia === 'personalizado' && (
          <div className="flex items-center gap-1.5">
            <span className="text-xxs text-texto-terciario">Cada</span>
            {OPCIONES_MESES.map((m) => (
              <button
                key={m}
                onClick={() => onChange({ ...valor, cadaMeses: m })}
                className={[
                  'px-2 py-1 rounded-md text-xxs font-medium border cursor-pointer transition-all',
                  (valor.cadaMeses || 2) === m
                    ? 'bg-texto-marca/10 border-texto-marca/30 text-texto-marca'
                    : 'bg-transparent border-borde-sutil text-texto-terciario',
                ].join(' ')}
              >
                {m}
              </button>
            ))}
            <span className="text-xxs text-texto-terciario">meses</span>
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => onChange({ ...valor, diaMes: valor.diaMes || diaRef, semanaDelMes: null, diaSemanaDelMes: null })}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-all text-left',
              valor.diaMes
                ? 'bg-texto-marca/5 border-texto-marca/25 text-texto-marca'
                : 'bg-transparent border-borde-sutil text-texto-secundario hover:border-borde-fuerte',
            ].join(' ')}
          >
            Día
            {valor.diaMes ? (
              <select
                value={valor.diaMes}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onChange({ ...valor, diaMes: parseInt(e.target.value), semanaDelMes: null, diaSemanaDelMes: null })}
                className="bg-transparent border-none text-xs font-semibold cursor-pointer focus:outline-none text-current"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            ) : (
              <span className="font-semibold">{diaRef}</span>
            )}
            <span className="text-texto-terciario">de cada {valor.frecuencia === 'personalizado' ? `${valor.cadaMeses || 2} meses` : 'mes'}</span>
          </button>

          <button
            onClick={() => onChange({ ...valor, diaMes: null, semanaDelMes: valor.semanaDelMes ?? 1, diaSemanaDelMes: valor.diaSemanaDelMes ?? diaSemanaRef })}
            className={[
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-all text-left',
              valor.semanaDelMes != null
                ? 'bg-texto-marca/5 border-texto-marca/25 text-texto-marca'
                : 'bg-transparent border-borde-sutil text-texto-secundario hover:border-borde-fuerte',
            ].join(' ')}
          >
            El
            {valor.semanaDelMes != null ? (
              <>
                <select
                  value={valor.semanaDelMes}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onChange({ ...valor, semanaDelMes: parseInt(e.target.value), diaMes: null })}
                  className="bg-transparent border-none text-xs font-semibold cursor-pointer focus:outline-none text-current"
                >
                  {SEMANAS.map((s) => (
                    <option key={s.valor} value={s.valor}>{s.etiqueta.toLowerCase()}</option>
                  ))}
                </select>
                <select
                  value={valor.diaSemanaDelMes ?? diaSemanaRef}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onChange({ ...valor, diaSemanaDelMes: parseInt(e.target.value), diaMes: null })}
                  className="bg-transparent border-none text-xs font-semibold cursor-pointer focus:outline-none text-current"
                >
                  {DIAS_SEMANA.map((d) => (
                    <option key={d.valor} value={d.valor}>{d.nombre.toLowerCase()}</option>
                  ))}
                </select>
              </>
            ) : (
              <span>primer {DIAS_SEMANA.find((d) => d.valor === diaSemanaRef)?.nombre?.toLowerCase()}</span>
            )}
          </button>
        </div>
      </div>
    )
  }

  return null
}

/* ─── Componente principal ─── */

function SelectorRecurrencia({ valor, onChange, fechaReferencia, compacto = false }: PropiedadesSelectorRecurrencia) {
  const diaRef = obtenerDiaDelMes(fechaReferencia || null)
  const diaSemanaRef = obtenerDiaSemana(fechaReferencia || null)

  const cambiarFrecuencia = (f: Frecuencia) => {
    if (f === 'ninguno' || f === 'diario' || f === 'anual') {
      onChange({ frecuencia: f })
      return
    }
    if (f === 'semanal') {
      onChange({ frecuencia: 'semanal', diasSemana: [diaSemanaRef] })
      return
    }
    if (f === 'mensual') {
      onChange({ frecuencia: 'mensual', diaMes: diaRef })
      return
    }
    if (f === 'personalizado') {
      onChange({ frecuencia: 'personalizado', cadaMeses: 2, diaMes: diaRef })
      return
    }
  }

  const tieneDetalle = ['semanal', 'mensual', 'personalizado'].includes(valor.frecuencia)

  /* ── Modo compacto: Select + panel ── */
  if (compacto) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Repeat size={14} className="text-texto-terciario shrink-0" />
          <Select
            opciones={OPCIONES_SELECT}
            valor={valor.frecuencia}
            onChange={(v) => cambiarFrecuencia(v as Frecuencia)}
            placeholder="Repetir..."
          />
        </div>
        <AnimatePresence>
          {tieneDetalle && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pl-6">
                <DetalleRecurrencia valor={valor} onChange={onChange} fechaReferencia={fechaReferencia || null} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  /* ── Modo normal: botones + panel ── */
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-texto-secundario">Repetir</label>
        <span className="text-xxs text-texto-terciario">{textoRecurrencia(valor)}</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {OPCIONES_SELECT.map((f) => (
          <button
            key={f.valor}
            onClick={() => cambiarFrecuencia(f.valor as Frecuencia)}
            className={[
              'px-2 py-1.5 rounded-lg text-xs font-medium border cursor-pointer transition-all',
              valor.frecuencia === f.valor
                ? 'bg-texto-marca/10 border-texto-marca/30 text-texto-marca'
                : 'bg-transparent border-borde-sutil text-texto-terciario hover:text-texto-secundario',
            ].join(' ')}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {tieneDetalle && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <DetalleRecurrencia valor={valor} onChange={onChange} fechaReferencia={fechaReferencia || null} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export { SelectorRecurrencia }
