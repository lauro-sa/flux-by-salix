'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowRight, MessagesSquare, Send, CheckCircle2, Clock } from 'lucide-react'
import { TarjetaConPestanas } from '@/componentes/ui/TarjetaConPestanas'
import { Insignia } from '@/componentes/ui/Insignia'
import { Boton } from '@/componentes/ui/Boton'

/**
 * WidgetInbox — Métricas de inbox mejorado con pestañas:
 * Pestaña 1 "Volumen": mensajes recibidos/enviados, conversaciones nuevas/resueltas
 * Pestaña 2 "SLA & Agentes": SLA compliance + desglose por agente
 */

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

function MiniMetrica({ etiqueta, valor, icono }: { etiqueta: string; valor: number | string; icono: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 py-2.5 px-3 rounded-card bg-superficie-hover/50">
      <div className="text-texto-terciario">{icono}</div>
      <div>
        <p className="text-lg font-bold text-texto-primario leading-tight">{valor}</p>
        <p className="text-xxs text-texto-terciario">{etiqueta}</p>
      </div>
    </div>
  )
}

export function WidgetInbox({ resumen, porAgente }: Props) {
  const router = useRouter()

  const contenidoVolumen = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MiniMetrica etiqueta="Recibidos" valor={resumen.mensajes_recibidos} icono={<MessagesSquare size={14} />} />
        <MiniMetrica etiqueta="Enviados" valor={resumen.mensajes_enviados} icono={<Send size={14} />} />
        <MiniMetrica etiqueta="Resueltas" valor={resumen.conversaciones_resueltas} icono={<CheckCircle2 size={14} />} />
        <MiniMetrica etiqueta="Tiempo resp." valor={`${resumen.tiempo_respuesta_promedio_min}m`} icono={<Clock size={14} />} />
      </div>

      {/* Ratio recibidos vs enviados */}
      {(resumen.mensajes_recibidos + resumen.mensajes_enviados) > 0 && (
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-texto-terciario">Recibidos vs Enviados</span>
          </div>
          <div className="h-2.5 rounded-full bg-superficie-hover overflow-hidden flex">
            <div
              className="h-full bg-texto-marca/60 transition-all duration-500"
              style={{
                width: `${(resumen.mensajes_recibidos / (resumen.mensajes_recibidos + resumen.mensajes_enviados)) * 100}%`,
              }}
            />
            <div
              className="h-full bg-insignia-exito-texto/60 transition-all duration-500"
              style={{
                width: `${(resumen.mensajes_enviados / (resumen.mensajes_recibidos + resumen.mensajes_enviados)) * 100}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-xxs text-texto-terciario mt-1">
            <span>{resumen.mensajes_recibidos} recibidos</span>
            <span>{resumen.mensajes_enviados} enviados</span>
          </div>
        </div>
      )}
    </div>
  )

  const contenidoSla = (
    <div className="space-y-4">
      {/* Barra de SLA principal */}
      <div>
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-texto-secundario">SLA cumplido</span>
          <span className={`font-semibold ${resumen.sla_cumplido_pct >= 80 ? 'text-insignia-exito-texto' : resumen.sla_cumplido_pct >= 50 ? 'text-insignia-advertencia-texto' : 'text-insignia-peligro-texto'}`}>
            {resumen.sla_cumplido_pct}%
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-superficie-hover overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${resumen.sla_cumplido_pct >= 80 ? 'bg-insignia-exito-texto' : resumen.sla_cumplido_pct >= 50 ? 'bg-insignia-advertencia-texto' : 'bg-insignia-peligro-texto'}`}
            initial={{ width: 0 }}
            animate={{ width: `${resumen.sla_cumplido_pct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
          />
        </div>
      </div>

      {/* Tiempos promedio */}
      <div className="grid grid-cols-2 gap-3">
        <div className="py-2.5 px-3 rounded-card bg-superficie-hover/50 text-center">
          <span className="text-lg font-bold text-texto-primario">{resumen.tiempo_respuesta_promedio_min}m</span>
          <p className="text-xxs text-texto-terciario">Resp. promedio</p>
        </div>
        <div className="py-2.5 px-3 rounded-card bg-superficie-hover/50 text-center">
          <span className="text-lg font-bold text-texto-primario">{resumen.tiempo_resolucion_promedio_hrs}h</span>
          <p className="text-xxs text-texto-terciario">Resolución prom.</p>
        </div>
      </div>

      {/* Agentes */}
      {porAgente.length > 0 && (
        <div className="pt-2 border-t border-borde-sutil">
          <p className="text-xs text-texto-terciario mb-2">Por agente</p>
          <div className="space-y-1.5">
            {porAgente.slice(0, 5).map(agente => {
              const pctSla = agente.sla_total > 0 ? Math.round((agente.sla_cumplido / agente.sla_total) * 100) : 0
              return (
                <div key={agente.nombre} className="flex items-center justify-between text-xs">
                  <span className="text-texto-secundario truncate">{agente.nombre}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-texto-primario font-medium tabular-nums">{agente.resueltas}/{agente.asignadas}</span>
                    {agente.sla_total > 0 && (
                      <Insignia color={pctSla >= 80 ? 'exito' : pctSla >= 50 ? 'advertencia' : 'peligro'}>
                        {pctSla}%
                      </Insignia>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <TarjetaConPestanas
      titulo="Inbox — Últimos 30 días"
      subtitulo="Mensajes y rendimiento de atención"
      pestanas={[
        { etiqueta: 'Volumen', contenido: contenidoVolumen },
        { etiqueta: 'SLA & Agentes', contenido: contenidoSla },
      ]}
      acciones={
        <Boton variante="fantasma" tamano="xs" iconoDerecho={<ArrowRight size={12} />} onClick={() => router.push('/inbox')}>
          Ver todo
        </Boton>
      }
    />
  )
}
