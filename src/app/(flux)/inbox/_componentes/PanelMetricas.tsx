'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  MessageSquare, Send, CheckCircle, TrendingUp,
  Clock, ArrowUp, ArrowDown, Minus, User, Inbox,
  Timer, Target,
} from 'lucide-react'

/**
 * Panel de métricas del inbox — funciona para WhatsApp, correo o todos.
 * Muestra: volumen, tiempos de respuesta, resolución, SLA, métricas por agente.
 * Se usa en: configuración del inbox (sección métricas).
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

interface MetricaAgente {
  nombre: string
  asignadas: number
  resueltas: number
  sla_cumplido: number
  sla_total: number
}

interface PropiedadesPanelMetricas {
  tipoCanal?: 'whatsapp' | 'correo' | null
}

export function PanelMetricas({ tipoCanal }: PropiedadesPanelMetricas = {}) {
  const [periodo, setPeriodo] = useState('30')
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [porAgente, setPorAgente] = useState<MetricaAgente[]>([])
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const desde = new Date(Date.now() - parseInt(periodo) * 86400000).toISOString().split('T')[0]
      const hasta = new Date().toISOString().split('T')[0]
      const params = new URLSearchParams({ desde, hasta })
      if (tipoCanal) params.set('tipo_canal', tipoCanal)

      const res = await fetch(`/api/inbox/metricas?${params}`)
      const data = await res.json()
      setResumen(data.resumen || null)
      setPorAgente(data.por_agente || [])
    } catch {
      setResumen(null)
      setPorAgente([])
    }
    setCargando(false)
  }, [periodo, tipoCanal])

  useEffect(() => { cargar() }, [cargar])

  if (!resumen) {
    return (
      <div className="py-8 text-center">
        <TrendingUp size={24} className="mx-auto mb-2" style={{ color: 'var(--texto-terciario)' }} />
        <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
          {cargando ? 'Cargando métricas...' : 'Sin datos de métricas para este período'}
        </p>
      </div>
    )
  }

  const tarjetas = [
    { etiqueta: 'Recibidos', valor: resumen.mensajes_recibidos, icono: <Inbox size={16} />, color: 'var(--canal-whatsapp)' },
    { etiqueta: 'Enviados', valor: resumen.mensajes_enviados, icono: <Send size={16} />, color: 'var(--insignia-info)' },
    { etiqueta: 'Conversaciones', valor: resumen.conversaciones_nuevas, icono: <MessageSquare size={16} />, color: 'var(--texto-marca)' },
    { etiqueta: 'Resueltas', valor: resumen.conversaciones_resueltas, icono: <CheckCircle size={16} />, color: 'var(--insignia-exito)' },
  ]

  const tasaResolucion = resumen.conversaciones_nuevas > 0
    ? Math.round((resumen.conversaciones_resueltas / resumen.conversaciones_nuevas) * 100)
    : 0

  return (
    <div className="space-y-5">
      {/* Header + selector período */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
          Métricas {tipoCanal === 'whatsapp' ? 'WhatsApp' : tipoCanal === 'correo' ? 'Correo' : 'del inbox'}
        </h3>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          className="text-xs rounded-lg px-2 py-1"
          style={{ background: 'var(--superficie-hover)', color: 'var(--texto-primario)', border: '1px solid var(--borde-sutil)' }}
        >
          <option value="7">Últimos 7 días</option>
          <option value="30">Últimos 30 días</option>
          <option value="90">Últimos 90 días</option>
        </select>
      </div>

      {/* Grid de tarjetas de volumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {tarjetas.map((t, i) => (
          <motion.div
            key={t.etiqueta}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-3 rounded-lg"
            style={{ background: 'var(--superficie-hover)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div style={{ color: t.color }}>{t.icono}</div>
              <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>{t.etiqueta}</span>
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--texto-primario)' }}>
              {t.valor.toLocaleString()}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Métricas de rendimiento: resolución, SLA, tiempos */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Tasa de resolución */}
        <div className="p-3 rounded-lg flex items-center justify-between" style={{ background: 'var(--superficie-hover)' }}>
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--texto-secundario)' }}>Tasa de resolución</p>
            <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>Resueltas / nuevas</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{ color: 'var(--texto-primario)' }}>{tasaResolucion}%</span>
            <IndicadorTendencia valor={tasaResolucion} umbrales={[40, 70]} />
          </div>
        </div>

        {/* SLA cumplido */}
        <div className="p-3 rounded-lg flex items-center justify-between" style={{ background: 'var(--superficie-hover)' }}>
          <div>
            <div className="flex items-center gap-1.5">
              <Target size={12} style={{ color: 'var(--texto-terciario)' }} />
              <p className="text-xs font-medium" style={{ color: 'var(--texto-secundario)' }}>SLA cumplido</p>
            </div>
            <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>Primera respuesta a tiempo</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold" style={{ color: 'var(--texto-primario)' }}>{resumen.sla_cumplido_pct}%</span>
            <IndicadorTendencia valor={resumen.sla_cumplido_pct} umbrales={[50, 80]} />
          </div>
        </div>

        {/* Tiempo promedio de respuesta */}
        <div className="p-3 rounded-lg flex items-center justify-between" style={{ background: 'var(--superficie-hover)' }}>
          <div>
            <div className="flex items-center gap-1.5">
              <Timer size={12} style={{ color: 'var(--texto-terciario)' }} />
              <p className="text-xs font-medium" style={{ color: 'var(--texto-secundario)' }}>Tiempo de respuesta</p>
            </div>
            <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>Primera respuesta promedio</p>
          </div>
          <span className="text-2xl font-bold" style={{ color: 'var(--texto-primario)' }}>
            {resumen.tiempo_respuesta_promedio_min < 60
              ? `${resumen.tiempo_respuesta_promedio_min}m`
              : `${Math.round(resumen.tiempo_respuesta_promedio_min / 60 * 10) / 10}h`
            }
          </span>
        </div>
      </div>

      {/* Tiempo de resolución */}
      {resumen.tiempo_resolucion_promedio_hrs > 0 && (
        <div className="p-3 rounded-lg flex items-center justify-between" style={{ background: 'var(--superficie-hover)' }}>
          <div>
            <div className="flex items-center gap-1.5">
              <Clock size={12} style={{ color: 'var(--texto-terciario)' }} />
              <p className="text-xs font-medium" style={{ color: 'var(--texto-secundario)' }}>Tiempo promedio de resolución</p>
            </div>
            <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>Desde que se crea hasta que se cierra</p>
          </div>
          <span className="text-2xl font-bold" style={{ color: 'var(--texto-primario)' }}>
            {resumen.tiempo_resolucion_promedio_hrs < 24
              ? `${resumen.tiempo_resolucion_promedio_hrs}h`
              : `${Math.round(resumen.tiempo_resolucion_promedio_hrs / 24 * 10) / 10}d`
            }
          </span>
        </div>
      )}

      {/* Métricas por agente */}
      {porAgente.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold mb-2" style={{ color: 'var(--texto-secundario)' }}>
            Por agente
          </h4>
          <div className="space-y-1.5">
            {porAgente.map((ag, i) => {
              const tasaAg = ag.asignadas > 0 ? Math.round((ag.resueltas / ag.asignadas) * 100) : 0
              const slaPctAg = ag.sla_total > 0 ? Math.round((ag.sla_cumplido / ag.sla_total) * 100) : 0
              return (
                <motion.div
                  key={ag.nombre}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-2.5 rounded-lg"
                  style={{ background: 'var(--superficie-hover)' }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'var(--superficie-elevada)' }}
                  >
                    <User size={12} style={{ color: 'var(--texto-terciario)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--texto-primario)' }}>
                      {ag.nombre}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xxs flex-shrink-0" style={{ color: 'var(--texto-terciario)' }}>
                    <span title="Asignadas">{ag.asignadas} conv</span>
                    <span title="Tasa de resolución" style={{ color: tasaAg >= 70 ? 'var(--insignia-exito)' : 'var(--texto-terciario)' }}>
                      {tasaAg}% resueltas
                    </span>
                    {ag.sla_total > 0 && (
                      <span title="SLA cumplido" style={{ color: slaPctAg >= 80 ? 'var(--insignia-exito)' : 'var(--insignia-advertencia)' }}>
                        SLA {slaPctAg}%
                      </span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Indicador visual de tendencia (verde/amarillo/rojo)
function IndicadorTendencia({ valor, umbrales }: { valor: number; umbrales: [number, number] }) {
  const [bajo, alto] = umbrales
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center"
      style={{
        background: valor >= alto ? 'rgba(34, 197, 94, 0.1)'
          : valor >= bajo ? 'rgba(234, 179, 8, 0.1)'
          : 'rgba(239, 68, 68, 0.1)',
      }}
    >
      {valor >= alto ? (
        <ArrowUp size={14} style={{ color: 'var(--insignia-exito)' }} />
      ) : valor >= bajo ? (
        <Minus size={14} style={{ color: 'var(--insignia-advertencia)' }} />
      ) : (
        <ArrowDown size={14} style={{ color: 'var(--insignia-peligro)' }} />
      )}
    </div>
  )
}
