'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Boton } from '@/componentes/ui/Boton'
import { Select } from '@/componentes/ui/Select'
import {
  Mail, Send, MessageSquare, CheckCircle, ShieldBan,
  TrendingUp, Clock, ArrowUp, ArrowDown, Minus,
} from 'lucide-react'

/**
 * Panel de métricas de correo.
 * Muestra estadísticas del período seleccionado: recibidos, enviados, resueltos, spam, tiempos.
 * Se usa en: configuración del inbox o como widget en el dashboard.
 */

interface Resumen {
  correos_recibidos: number
  correos_enviados: number
  conversaciones_nuevas: number
  conversaciones_resueltas: number
  correos_spam: number
}

export function PanelMetricas() {
  const [periodo, setPeriodo] = useState('30')
  const [resumen, setResumen] = useState<Resumen | null>(null)
  const [cargando, setCargando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const desde = new Date(Date.now() - parseInt(periodo) * 86400000).toISOString().split('T')[0]
      const hasta = new Date().toISOString().split('T')[0]
      const res = await fetch(`/api/inbox/metricas?desde=${desde}&hasta=${hasta}`)
      const data = await res.json()
      setResumen(data.resumen || null)
    } catch {
      setResumen(null)
    }
    setCargando(false)
  }, [periodo])

  useEffect(() => { cargar() }, [cargar])

  if (!resumen) {
    return (
      <div className="py-8 text-center">
        <TrendingUp size={24} className="mx-auto mb-2" style={{ color: 'var(--texto-terciario)' }} />
        <p className="text-sm" style={{ color: 'var(--texto-secundario)' }}>
          {cargando ? 'Cargando métricas...' : 'Sin datos de métricas'}
        </p>
      </div>
    )
  }

  const tarjetas = [
    {
      etiqueta: 'Recibidos',
      valor: resumen.correos_recibidos,
      icono: <Mail size={16} />,
      color: 'var(--canal-correo)',
    },
    {
      etiqueta: 'Enviados',
      valor: resumen.correos_enviados,
      icono: <Send size={16} />,
      color: 'var(--insignia-info)',
    },
    {
      etiqueta: 'Conversaciones nuevas',
      valor: resumen.conversaciones_nuevas,
      icono: <MessageSquare size={16} />,
      color: 'var(--texto-marca)',
    },
    {
      etiqueta: 'Resueltas',
      valor: resumen.conversaciones_resueltas,
      icono: <CheckCircle size={16} />,
      color: 'var(--insignia-exito)',
    },
    {
      etiqueta: 'Spam',
      valor: resumen.correos_spam,
      icono: <ShieldBan size={16} />,
      color: 'var(--insignia-peligro)',
    },
  ]

  // Tasa de resolución
  const tasaResolucion = resumen.conversaciones_nuevas > 0
    ? Math.round((resumen.conversaciones_resueltas / resumen.conversaciones_nuevas) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* Selector de período */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--texto-primario)' }}>
          Métricas de correo
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

      {/* Grid de tarjetas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
              <span className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
                {t.etiqueta}
              </span>
            </div>
            <p className="text-xl font-bold" style={{ color: 'var(--texto-primario)' }}>
              {t.valor.toLocaleString()}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Tasa de resolución */}
      <div
        className="p-3 rounded-lg flex items-center justify-between"
        style={{ background: 'var(--superficie-hover)' }}
      >
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--texto-secundario)' }}>
            Tasa de resolución
          </p>
          <p className="text-xxs" style={{ color: 'var(--texto-terciario)' }}>
            Conversaciones resueltas / nuevas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold" style={{ color: 'var(--texto-primario)' }}>
            {tasaResolucion}%
          </span>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              background: tasaResolucion >= 70 ? 'rgba(34, 197, 94, 0.1)'
                : tasaResolucion >= 40 ? 'rgba(234, 179, 8, 0.1)'
                : 'rgba(239, 68, 68, 0.1)',
            }}
          >
            {tasaResolucion >= 70 ? (
              <ArrowUp size={14} style={{ color: 'var(--insignia-exito)' }} />
            ) : tasaResolucion >= 40 ? (
              <Minus size={14} style={{ color: 'var(--insignia-advertencia)' }} />
            ) : (
              <ArrowDown size={14} style={{ color: 'var(--insignia-peligro)' }} />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
