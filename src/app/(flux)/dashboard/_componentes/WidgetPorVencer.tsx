'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, AlertTriangle } from 'lucide-react'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { Insignia } from '@/componentes/ui/Insignia'
import { Boton } from '@/componentes/ui/Boton'

/**
 * WidgetPorVencer — Presupuestos enviados que vencen en los próximos 7 días.
 * Lista urgente para que el usuario actúe rápido.
 */

interface PresupuestoPorVencer {
  id: string
  numero: string
  estado: string
  contacto_nombre?: string
  contacto_apellido?: string
  total?: number
  fecha_vencimiento: string
}

interface Props {
  presupuestos: PresupuestoPorVencer[]
  formatoMoneda: (n: number) => string
}

export function WidgetPorVencer({ presupuestos, formatoMoneda }: Props) {
  const router = useRouter()

  if (presupuestos.length === 0) return null

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  return (
    <Tarjeta
      titulo="Por vencer"
      subtitulo="Presupuestos enviados — próximos 7 días"
      acciones={
        <Boton variante="fantasma" tamano="xs" iconoDerecho={<ArrowRight size={12} />} onClick={() => router.push('/presupuestos')}>
          Ver todo
        </Boton>
      }
    >
      <div className="space-y-1">
        {presupuestos.map(p => {
          const vence = new Date(p.fecha_vencimiento)
          vence.setHours(0, 0, 0, 0)
          const diasRestantes = Math.ceil((vence.getTime() - hoy.getTime()) / 86400000)
          const esUrgente = diasRestantes <= 2

          return (
            <div
              key={p.id}
              className="flex items-center justify-between py-2 px-1 rounded-boton hover:bg-superficie-hover cursor-pointer transition-colors"
              onClick={() => router.push(`/presupuestos/${p.id}`)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {esUrgente && <AlertTriangle size={12} className="text-insignia-peligro-texto shrink-0" />}
                  <span className="text-sm font-medium text-texto-primario">{p.numero}</span>
                </div>
                <p className="text-xs text-texto-terciario truncate mt-0.5">
                  {[p.contacto_nombre, p.contacto_apellido].filter(Boolean).join(' ') || 'Sin contacto'}
                </p>
              </div>
              <div className="text-right shrink-0 ml-3">
                {p.total != null && (
                  <p className="text-sm font-semibold text-texto-primario tabular-nums">{formatoMoneda(p.total)}</p>
                )}
                <Insignia color={esUrgente ? 'peligro' : 'advertencia'}>
                  {diasRestantes === 0 ? 'Hoy' : diasRestantes === 1 ? 'Mañana' : `${diasRestantes}d`}
                </Insignia>
              </div>
            </div>
          )
        })}
      </div>
    </Tarjeta>
  )
}
