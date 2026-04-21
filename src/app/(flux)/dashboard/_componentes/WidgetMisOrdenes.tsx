'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wrench } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { Insignia } from '@/componentes/ui/Insignia'
import { TarjetaAccion } from './TarjetaAccion'

/**
 * WidgetMisOrdenes — Órdenes de trabajo asignadas al usuario actual en estado
 * abierta o en_progreso (pendientes). Para técnicos/empleados/cualquier rol
 * con órdenes asignadas.
 */

interface OrdenCompacta {
  id: string
  numero: string
  titulo: string
  estado: string
  prioridad: string
  contacto_nombre: string | null
  fecha_fin_estimada: string | null
}

const COLOR_ESTADO: Record<string, 'info' | 'exito' | 'advertencia' | 'naranja'> = {
  abierta: 'info',
  en_progreso: 'exito',
  esperando: 'advertencia',
}

const ETIQUETA_ESTADO: Record<string, string> = {
  abierta: 'Abierta',
  en_progreso: 'En progreso',
  esperando: 'Esperando',
}

function fmtFecha(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const hoy = new Date()
  const diff = Math.floor((d.getTime() - hoy.setHours(0, 0, 0, 0)) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Mañana'
  if (diff < 0) return 'Vencida'
  if (diff < 7) return `En ${diff}d`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function WidgetMisOrdenes() {
  const router = useRouter()
  const { usuario } = useAuth()
  const [ordenes, setOrdenes] = useState<OrdenCompacta[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!usuario?.id) return
    fetch(`/api/ordenes?estado=abierta,en_progreso,esperando&asignado_a=${usuario.id}&por_pagina=5&orden_campo=fecha_fin_estimada&orden_dir=asc`)
      .then(r => r.ok ? r.json() : { ordenes: [], total: 0 })
      .then(d => { setOrdenes(d.ordenes || []); setTotal(d.total || 0) })
      .catch(() => { setOrdenes([]); setTotal(0) })
      .finally(() => setCargando(false))
  }, [usuario?.id])

  // No renderizar si terminó de cargar y no hay nada (no ensuciar dashboard)
  if (!cargando && total === 0) return null

  return (
    <TarjetaAccion
      titulo="Mis órdenes pendientes"
      subtitulo={total === 1 ? '1 orden a mi cargo' : `${total} órdenes a mi cargo`}
      icono={<Wrench size={16} strokeWidth={1.5} />}
      colorFondo="bg-insignia-exito-fondo"
      colorIcono="text-insignia-exito-texto"
      contador={total}
      verTodoHref={`/ordenes?asignado_a=${usuario?.id}&estado=abierta,en_progreso,esperando`}
    >
      {cargando ? (
        <div className="space-y-1.5 py-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 bg-superficie-hover/40 rounded-boton animate-pulse" />
          ))}
        </div>
      ) : (
        ordenes.map(o => (
          <div
            key={o.id}
            onClick={() => router.push(`/ordenes/${o.id}`)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/ordenes/${o.id}`) } }}
            role="button"
            tabIndex={0}
            className="flex items-center justify-between gap-2 py-2 px-1.5 rounded-boton hover:bg-superficie-hover/60 cursor-pointer transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-texto-primario">{o.numero}</span>
                <Insignia color={COLOR_ESTADO[o.estado] || 'neutro'}>{ETIQUETA_ESTADO[o.estado] || o.estado}</Insignia>
                {o.prioridad === 'alta' || o.prioridad === 'urgente' ? <Insignia color="peligro">!</Insignia> : null}
              </div>
              <p className="text-xxs text-texto-terciario truncate mt-0.5">
                {o.titulo}{o.contacto_nombre ? ` · ${o.contacto_nombre}` : ''}
              </p>
            </div>
            {o.fecha_fin_estimada && (
              <span className={`text-xxs shrink-0 tabular-nums ${
                new Date(o.fecha_fin_estimada) < new Date() ? 'text-insignia-peligro-texto font-medium' : 'text-texto-terciario'
              }`}>
                {fmtFecha(o.fecha_fin_estimada)}
              </span>
            )}
          </div>
        ))
      )}
    </TarjetaAccion>
  )
}
