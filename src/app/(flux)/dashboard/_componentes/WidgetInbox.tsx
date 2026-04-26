'use client'

/**
 * WidgetInbox — Stat card pequeña con métricas clave del inbox últimos 30 días.
 * Muestra SLA cumplido como KPI principal + tiempo de respuesta promedio.
 * Diseño compacto para grid de pequeños.
 */

import { useRouter } from 'next/navigation'
import { ArrowRight, MessageSquare } from 'lucide-react'
import { InfoBoton } from '@/componentes/ui/InfoBoton'

interface Resumen {
  mensajes_recibidos: number
  mensajes_enviados: number
  conversaciones_nuevas: number
  conversaciones_resueltas: number
  sla_cumplido_pct: number
  tiempo_respuesta_promedio_min: number
  tiempo_resolucion_promedio_hrs: number
}

interface Agente {
  nombre: string
  asignadas: number
  resueltas: number
  sla_cumplido: number
  sla_total: number
}

interface Props {
  resumen: Resumen
  porAgente: Agente[]
}

export function WidgetInbox({ resumen, porAgente }: Props) {
  const router = useRouter()
  const sla = resumen.sla_cumplido_pct

  const colorSla = sla >= 80
    ? { texto: 'text-insignia-exito-texto', barra: 'bg-insignia-exito-texto', borde: 'border-insignia-exito/25', fondo: 'bg-insignia-exito/[0.04]' }
    : sla >= 50
      ? { texto: 'text-insignia-advertencia-texto', barra: 'bg-insignia-advertencia-texto', borde: 'border-insignia-advertencia/25', fondo: 'bg-insignia-advertencia/[0.04]' }
      : { texto: 'text-insignia-peligro-texto', barra: 'bg-insignia-peligro-texto', borde: 'border-insignia-peligro/25', fondo: 'bg-insignia-peligro/[0.04]' }

  // Top 2 agentes con más conversaciones asignadas
  const topAgentes = [...porAgente]
    .sort((a, b) => b.asignadas - a.asignadas)
    .slice(0, 2)

  return (
    <div className={`h-full rounded-card border ${colorSla.borde} ${colorSla.fondo} overflow-hidden flex flex-col`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-borde-sutil/40">
        <div className="flex items-center gap-1.5 min-w-0">
          <MessageSquare size={14} className={colorSla.texto} />
          <h3 className="text-xs font-semibold text-texto-primario truncate">Inbox 30 días</h3>
          <InfoBoton
            titulo="Inbox — últimos 30 días"
            tamano={12}
            secciones={[
              {
                titulo: 'Para qué sirve',
                contenido: (
                  <p>
                    Te muestra cómo está atendiendo tu equipo a los clientes:{' '}
                    <strong className="text-texto-primario">qué tan rápido respondés</strong> y si estás
                    cumpliendo los tiempos comprometidos.
                  </p>
                ),
              },
              {
                titulo: 'Qué es el SLA',
                contenido: (
                  <p>
                    SLA (Service Level Agreement) = <strong className="text-texto-primario">acuerdo de
                    nivel de servicio</strong>. Es el porcentaje de mensajes que respondiste dentro del
                    tiempo objetivo (configurable por canal). Si tu SLA es 90%, querés decir que 9 de
                    cada 10 mensajes los respondiste a tiempo.
                  </p>
                ),
              },
              {
                titulo: 'Cómo interpretarlo',
                contenido: (
                  <ul className="space-y-1.5 list-none">
                    <li>
                      <span className="text-insignia-exito-texto">●</span>{' '}
                      <strong className="text-texto-primario">SLA ≥ 80%:</strong> excelente atención.
                    </li>
                    <li>
                      <span className="text-insignia-advertencia-texto">●</span>{' '}
                      <strong className="text-texto-primario">50% – 80%:</strong> aceptable, hay margen.
                    </li>
                    <li>
                      <span className="text-insignia-peligro-texto">●</span>{' '}
                      <strong className="text-texto-primario">&lt; 50%:</strong> los clientes están
                      esperando demasiado. Revisá horarios de atención o falta de personal.
                    </li>
                  </ul>
                ),
              },
              {
                titulo: 'Tiempo de respuesta',
                contenido: (
                  <p>
                    Es el <strong className="text-texto-primario">promedio de minutos que tarda tu equipo
                    en contestar</strong> el primer mensaje de un cliente. Cuanto más bajo, mejor.
                  </p>
                ),
              },
              {
                titulo: 'Cruzá con otros widgets',
                contenido: (
                  <ul className="space-y-2 list-none">
                    <li>
                      <strong className="text-texto-primario">Con &quot;Por vencer&quot;:</strong>{' '}
                      <span className="text-texto-terciario">si los presupuestos vencen sin respuesta,
                      probablemente el cliente escribió por inbox y nadie respondió a tiempo.</span>
                    </li>
                    <li>
                      <strong className="text-texto-primario">Con &quot;Pipeline&quot;:</strong>{' '}
                      <span className="text-texto-terciario">si tu win rate baja, podría ser por mala
                      atención —los clientes se cansan de esperar respuesta.</span>
                    </li>
                  </ul>
                ),
              },
            ]}
          />
        </div>
        <button
          type="button"
          onClick={() => router.push('/inbox')}
          className="text-xxs text-texto-terciario hover:text-texto-marca transition-colors shrink-0"
          aria-label="Ver inbox"
        >
          <ArrowRight size={11} />
        </button>
      </div>

      {/* KPI principal: SLA */}
      <div className="px-4 pt-3 pb-2">
        <p className="text-[10px] uppercase tracking-widest text-texto-terciario mb-1">SLA cumplido</p>
        <div className="flex items-baseline gap-1.5">
          <span className={`text-2xl font-light tabular-nums leading-none ${colorSla.texto}`}>
            {sla}
          </span>
          <span className={`text-base font-light ${colorSla.texto}`}>%</span>
        </div>
        <div className="mt-2 h-1 rounded-full bg-white/[0.05] overflow-hidden">
          <div
            className={`h-full ${colorSla.barra} rounded-full transition-all duration-700`}
            style={{ width: `${Math.min(100, sla)}%` }}
          />
        </div>
      </div>

      {/* Stats secundarias */}
      <div className="px-4 pb-3 pt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xxs">
        <div className="flex items-baseline gap-1">
          <span className="font-semibold tabular-nums text-texto-primario">{resumen.tiempo_respuesta_promedio_min}m</span>
          <span className="text-texto-terciario">respuesta</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-semibold tabular-nums text-texto-primario">{resumen.conversaciones_resueltas}</span>
          <span className="text-texto-terciario">resueltas</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-semibold tabular-nums text-texto-primario">{resumen.mensajes_recibidos}</span>
          <span className="text-texto-terciario">recibidos</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-semibold tabular-nums text-texto-primario">{resumen.mensajes_enviados}</span>
          <span className="text-texto-terciario">enviados</span>
        </div>
      </div>

      {/* Top agentes (compacto) — pegado al fondo si hay espacio */}
      {topAgentes.length > 0 && (
        <div className="mt-auto border-t border-borde-sutil/40 px-4 py-2">
          <p className="text-[10px] uppercase tracking-widest text-texto-terciario mb-1.5">
            Top agentes
          </p>
          <div className="space-y-1">
            {topAgentes.map((a) => {
              const pct = a.sla_total > 0 ? Math.round((a.sla_cumplido / a.sla_total) * 100) : 0
              const colorAgente = pct >= 80 ? 'text-insignia-exito-texto' : pct >= 50 ? 'text-insignia-advertencia-texto' : 'text-insignia-peligro-texto'
              return (
                <div key={a.nombre} className="flex items-center justify-between text-xxs">
                  <span className="text-texto-secundario truncate flex-1">{a.nombre}</span>
                  <span className="text-texto-terciario tabular-nums shrink-0 ml-2">
                    {a.resueltas}/{a.asignadas}
                  </span>
                  {a.sla_total > 0 && (
                    <span className={`tabular-nums font-medium shrink-0 ml-2 ${colorAgente}`}>
                      {pct}%
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
