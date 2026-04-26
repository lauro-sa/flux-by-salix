'use client'

/**
 * WidgetPorVencer — Stat card pequeña con alerta de presupuestos enviados
 * que vencen en los próximos 7 días. Diseño compacto para grid de pequeños.
 */

import { useRouter } from 'next/navigation'
import { ArrowRight, AlertTriangle, Clock, Check } from 'lucide-react'
import { InfoBoton } from '@/componentes/ui/InfoBoton'

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
  const vacio = presupuestos.length === 0

  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  // Mostrar máximo 3 en la lista; el resto va a "+N más"
  const visibles = presupuestos.slice(0, 3)
  const ocultos = presupuestos.length - visibles.length

  // Cantidad urgente (vence hoy o mañana) para destacar el header
  const urgentes = presupuestos.filter((p) => {
    const v = new Date(p.fecha_vencimiento); v.setHours(0, 0, 0, 0)
    return Math.ceil((v.getTime() - hoy.getTime()) / 86400000) <= 1
  }).length

  // Suma del monto total en juego
  const montoTotal = presupuestos.reduce((s, p) => s + (p.total || 0), 0)

  // Color según estado: vacío = sutil, con urgentes = rojo, con datos = ámbar
  const colorAlerta = vacio
    ? 'border-borde-sutil bg-superficie-tarjeta'
    : urgentes > 0
      ? 'border-insignia-peligro/30 bg-insignia-peligro/[0.04]'
      : 'border-insignia-advertencia/25 bg-insignia-advertencia/[0.04]'
  const colorIcono = vacio
    ? 'text-texto-terciario'
    : urgentes > 0
      ? 'text-insignia-peligro-texto'
      : 'text-insignia-advertencia-texto'

  return (
    <div className={`h-full rounded-card border ${colorAlerta} overflow-hidden flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-borde-sutil/40">
        <div className="flex items-center gap-1.5 min-w-0">
          {urgentes > 0
            ? <AlertTriangle size={14} className={colorIcono} />
            : <Clock size={14} className={colorIcono} />
          }
          <h3 className="text-xs font-semibold text-texto-primario truncate">Por vencer</h3>
          <InfoBoton
            titulo="Presupuestos por vencer"
            tamano={12}
            secciones={[
              {
                titulo: 'Para qué sirve',
                contenido: (
                  <p>
                    Es una <strong className="text-texto-primario">alerta de urgencia</strong>: muestra los
                    presupuestos enviados que vencen en los próximos 7 días. Si no respondes el cliente, se
                    pierden y pasan al estado &quot;vencido&quot;.
                  </p>
                ),
              },
              {
                titulo: 'Cómo se calcula',
                contenido: (
                  <p>
                    Toma todos los presupuestos en estado <strong>Enviado</strong> con{' '}
                    <strong>fecha_vencimiento</strong> entre hoy y +7 días. Los ordena por urgencia.
                  </p>
                ),
              },
              {
                titulo: 'Cómo leerlo',
                contenido: (
                  <ul className="space-y-1 list-disc pl-4">
                    <li><strong className="text-insignia-peligro-texto">Hoy / Mañana</strong>: contactá al cliente ya, o pedí extensión</li>
                    <li><strong className="text-insignia-advertencia-texto">3-7 días</strong>: agendá seguimiento esta semana</li>
                    <li>Click en una fila abre el presupuesto</li>
                  </ul>
                ),
              },
              {
                titulo: 'Cruzá con otros widgets',
                contenido: (
                  <p>
                    En el <strong>Pipeline</strong>, todos estos presupuestos están en la categoría{' '}
                    <strong className="text-texto-marca">Activo</strong>. Si vencen sin respuesta, pasan a{' '}
                    <strong className="text-insignia-peligro-texto">Perdido</strong> y bajan tu win rate.
                  </p>
                ),
              },
            ]}
          />
        </div>
        <button
          type="button"
          onClick={() => router.push('/presupuestos?filtro=por_vencer')}
          className="text-xxs text-texto-terciario hover:text-texto-marca transition-colors inline-flex items-center gap-0.5 shrink-0"
          aria-label="Ver todos"
        >
          <ArrowRight size={11} />
        </button>
      </div>

      {/* KPI principal */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-light tabular-nums leading-none ${vacio ? 'text-texto-terciario' : 'text-texto-primario'}`}>
            {presupuestos.length}
          </span>
          <span className="text-xxs text-texto-terciario">
            por vencer
          </span>
        </div>
        {!vacio && montoTotal > 0 && (
          <p className="text-xxs text-texto-terciario mt-1 tabular-nums">
            {formatoMoneda(montoTotal)} en juego
          </p>
        )}
        {vacio && (
          <p className="text-xxs text-texto-terciario mt-1">
            Próximos 7 días
          </p>
        )}
      </div>

      {/* Lista compacta o estado vacío */}
      {vacio ? (
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 text-center">
          <div className="size-9 rounded-full bg-insignia-exito/[0.08] flex items-center justify-center mb-2">
            <Check size={16} className="text-insignia-exito-texto" strokeWidth={2.5} />
          </div>
          <p className="text-xs font-medium text-texto-secundario">Todo al día</p>
          <p className="text-xxs text-texto-terciario mt-0.5">Sin vencimientos próximos</p>
        </div>
      ) : (
        <div className="px-2 pb-2 space-y-0.5 flex-1">
          {visibles.map((p) => {
            const vence = new Date(p.fecha_vencimiento); vence.setHours(0, 0, 0, 0)
            const dias = Math.ceil((vence.getTime() - hoy.getTime()) / 86400000)
            const urgente = dias <= 1
            const etiqueta = dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `${dias}d`
            const colorEtiqueta = urgente ? 'text-insignia-peligro-texto' : 'text-texto-terciario'

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => router.push(`/presupuestos/${p.id}`)}
                className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-boton hover:bg-superficie-hover/40 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-texto-primario truncate">{p.numero}</p>
                  <p className="text-xxs text-texto-terciario truncate">
                    {[p.contacto_nombre, p.contacto_apellido].filter(Boolean).join(' ') || 'Sin contacto'}
                  </p>
                </div>
                <span className={`text-xxs font-medium tabular-nums shrink-0 ${colorEtiqueta}`}>
                  {etiqueta}
                </span>
              </button>
            )
          })}
          {ocultos > 0 && (
            <button
              type="button"
              onClick={() => router.push('/presupuestos?filtro=por_vencer')}
              className="w-full text-center px-2 py-1.5 text-xxs text-texto-terciario hover:text-texto-marca transition-colors"
            >
              + {ocultos} {ocultos === 1 ? 'más' : 'más'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
