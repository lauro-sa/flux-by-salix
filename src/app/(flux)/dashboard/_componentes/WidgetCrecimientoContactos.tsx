'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { Boton } from '@/componentes/ui/Boton'
import { useFormato } from '@/hooks/useFormato'

/**
 * WidgetCrecimientoContactos — Mini gráfico de barras con contactos nuevos por semana.
 * Muestra las últimas 12 semanas y la tendencia vs semana anterior.
 */

interface Props {
  crecimientoSemanal: Array<{ semana: string; cantidad: number }>
}

export function WidgetCrecimientoContactos({ crecimientoSemanal }: Props) {
  const router = useRouter()
  const formato = useFormato()
  const max = Math.max(...crecimientoSemanal.map(s => s.cantidad), 1)
  const totalPeriodo = crecimientoSemanal.reduce((s, w) => s + w.cantidad, 0)

  // Tendencia: comparar última semana con la anterior
  const ultimaSemana = crecimientoSemanal[crecimientoSemanal.length - 1]?.cantidad ?? 0
  const semanaAnterior = crecimientoSemanal[crecimientoSemanal.length - 2]?.cantidad ?? 0
  const diferencia = ultimaSemana - semanaAnterior

  return (
    <Tarjeta
      titulo="Nuevos contactos"
      subtitulo="Últimas 12 semanas"
      acciones={
        <Boton variante="fantasma" tamano="xs" iconoDerecho={<ArrowRight size={12} />} onClick={() => router.push('/contactos')}>
          Ver todo
        </Boton>
      }
    >
      <div className="space-y-4">
        {/* KPI + Tendencia */}
        <div className="flex items-end justify-between">
          <div>
            <span className="text-2xl font-bold text-texto-primario">{totalPeriodo}</span>
            <span className="text-xs text-texto-terciario ml-2">en 12 semanas</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            {diferencia > 0 ? (
              <>
                <TrendingUp size={14} className="text-insignia-exito-texto" />
                <span className="text-insignia-exito-texto font-medium">+{diferencia}</span>
              </>
            ) : diferencia < 0 ? (
              <>
                <TrendingDown size={14} className="text-insignia-peligro-texto" />
                <span className="text-insignia-peligro-texto font-medium">{diferencia}</span>
              </>
            ) : (
              <>
                <Minus size={14} className="text-texto-terciario" />
                <span className="text-texto-terciario font-medium">0</span>
              </>
            )}
            <span className="text-texto-terciario">vs anterior</span>
          </div>
        </div>

        {/* Gráfico de barras */}
        <div className="flex items-end gap-1 h-20">
          {crecimientoSemanal.map((semana, i) => {
            const altura = max > 0 ? (semana.cantidad / max) * 100 : 0
            const esUltima = i === crecimientoSemanal.length - 1
            return (
              <div
                key={semana.semana}
                className="flex-1 flex flex-col items-center justify-end h-full group relative"
              >
                {/* Tooltip */}
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[var(--superficie-tarjeta)] border border-borde-fuerte rounded px-1.5 py-0.5 text-xxs text-texto-primario font-medium opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-sm z-10">
                  {semana.cantidad}
                </div>
                <motion.div
                  className={`w-full rounded-t-sm ${esUltima ? 'bg-texto-marca' : 'bg-texto-marca/30'}`}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(altura, 3)}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut', delay: i * 0.03 }}
                />
              </div>
            )
          })}
        </div>

        {/* Eje X simplificado */}
        <div className="flex justify-between text-xxs text-texto-terciario">
          <span>
            {formato.fecha(crecimientoSemanal[0]?.semana, { corta: true })}
          </span>
          <span>
            {formato.fecha(crecimientoSemanal[crecimientoSemanal.length - 1]?.semana, { corta: true })}
          </span>
        </div>
      </div>
    </Tarjeta>
  )
}
