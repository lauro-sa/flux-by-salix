'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Clock } from 'lucide-react'
import { Insignia } from '@/componentes/ui/Insignia'
import { TarjetaAccion } from './TarjetaAccion'

/**
 * WidgetMiRecorrido — Visitas del día asignadas al usuario, ordenadas por hora.
 * Para roles que hacen recorridos (visitador, supervisor, gerente operativo).
 * Muestra: hora + cliente + dirección + estado.
 */

interface VisitaCompacta {
  id: string
  fecha_programada: string | null
  hora_programada: string | null
  contacto_nombre: string | null
  direccion_texto: string | null
  estado: string
  prioridad: string | null
  temperatura: string | null
}

const COLOR_ESTADO: Record<string, 'info' | 'exito' | 'advertencia' | 'neutro' | 'primario'> = {
  programada: 'info',
  en_camino: 'primario',
  en_sitio: 'exito',
  completada: 'neutro',
  reprogramada: 'advertencia',
}

const ETIQUETA_ESTADO: Record<string, string> = {
  programada: 'Programada',
  en_camino: 'En camino',
  en_sitio: 'En sitio',
  completada: 'Completada',
  reprogramada: 'Reprogramada',
}

function fmtHora(v: VisitaCompacta): string {
  if (v.hora_programada) return v.hora_programada.slice(0, 5)
  if (v.fecha_programada) {
    const d = new Date(v.fecha_programada)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return '--:--'
}

export function WidgetMiRecorrido() {
  const router = useRouter()
  const [visitas, setVisitas] = useState<VisitaCompacta[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    fetch('/api/visitas?vista=mias&fecha=hoy&por_pagina=10&orden_campo=fecha_programada&orden_dir=asc')
      .then(r => r.ok ? r.json() : { visitas: [], total: 0 })
      .then(d => { setVisitas(d.visitas || []); setTotal(d.total || 0) })
      .catch(() => { setVisitas([]); setTotal(0) })
      .finally(() => setCargando(false))
  }, [])

  if (!cargando && total === 0) return null

  return (
    <TarjetaAccion
      titulo="Mi recorrido de hoy"
      subtitulo={total === 1 ? '1 visita programada' : `${total} visitas programadas`}
      icono={<MapPin size={16} strokeWidth={1.5} />}
      colorFondo="bg-insignia-primario-fondo"
      colorIcono="text-insignia-primario-texto"
      contador={total}
      verTodoHref="/recorrido"
    >
      {cargando ? (
        <div className="space-y-1.5 py-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 bg-superficie-hover/40 rounded-boton animate-pulse" />
          ))}
        </div>
      ) : (
        visitas.map(v => (
          <div
            key={v.id}
            onClick={() => router.push(`/visitas/${v.id}`)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/visitas/${v.id}`) } }}
            role="button"
            tabIndex={0}
            className="flex items-start gap-2.5 py-2 px-1.5 rounded-boton hover:bg-superficie-hover/60 cursor-pointer transition-colors"
          >
            <div className="flex flex-col items-center shrink-0 pt-0.5">
              <span className="flex items-center gap-0.5 text-xs font-semibold text-texto-primario tabular-nums">
                <Clock size={10} className="text-texto-terciario" />
                {fmtHora(v)}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-medium text-texto-primario truncate">
                  {v.contacto_nombre || 'Sin contacto'}
                </span>
                <Insignia color={COLOR_ESTADO[v.estado] || 'neutro'}>{ETIQUETA_ESTADO[v.estado] || v.estado}</Insignia>
              </div>
              {v.direccion_texto && (
                <p className="text-xxs text-texto-terciario truncate mt-0.5">{v.direccion_texto}</p>
              )}
            </div>
          </div>
        ))
      )}
    </TarjetaAccion>
  )
}
