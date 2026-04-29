'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPinned } from 'lucide-react'
import { Insignia } from '@/componentes/ui/Insignia'
import { TarjetaAccion } from './TarjetaAccion'

/**
 * WidgetVisitasPorPlanificar — Para admin/gestor/propietario/supervisor.
 * Visitas que requieren atención del responsable:
 *   - Provisorias: creadas por el agente IA de WhatsApp, hay que confirmar y asignar.
 *   - Sin asignar: programadas pero sin responsable elegido.
 *
 * Muestra ambos tipos en la misma lista con insignia distintiva.
 */

interface VisitaCompacta {
  id: string
  estado: string
  contacto_nombre: string | null
  direccion_texto: string | null
  fecha_programada: string | null
  tiene_hora_especifica?: boolean | null
  motivo: string | null
  creado_en: string
}

function fmtFechaCorta(iso: string | null, tieneHoraEspecifica?: boolean | null): string {
  if (!iso) return 'Sin fecha'
  const d = new Date(iso)
  const hoy = new Date()
  const diff = Math.floor((d.getTime() - hoy.setHours(0, 0, 0, 0)) / 86400000)
  // Solo mostramos hora si la visita la tiene puntual; si no, mostramos solo el día.
  const hora = tieneHoraEspecifica
    ? ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : ''
  if (diff === 0) return `Hoy${hora}`
  if (diff === 1) return `Mañana${hora}`
  if (diff < 7 && diff > 0) return `En ${diff}d`
  if (diff < 0) return 'Vencida'
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function WidgetVisitasPorPlanificar() {
  const router = useRouter()
  const [visitas, setVisitas] = useState<VisitaCompacta[]>([])
  const [total, setTotal] = useState(0)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    // Dos queries paralelas: provisorias (IA) + sin asignar
    Promise.all([
      fetch('/api/visitas?estado=provisoria&por_pagina=10&orden_campo=creado_en&orden_dir=desc')
        .then(r => r.ok ? r.json() : { visitas: [], total: 0 }),
      fetch('/api/visitas?sin_asignado=true&estado=programada&por_pagina=10&orden_campo=fecha_programada&orden_dir=asc')
        .then(r => r.ok ? r.json() : { visitas: [], total: 0 }),
    ])
      .then(([provisorias, sinAsignar]) => {
        // Combinar y deduplicar por id (una visita puede ser provisoria Y sin_asignar)
        const mapa = new Map<string, VisitaCompacta>()
        ;[...(provisorias.visitas || []), ...(sinAsignar.visitas || [])].forEach(v => {
          if (!mapa.has(v.id)) mapa.set(v.id, v)
        })
        const combinadas = Array.from(mapa.values()).slice(0, 5)
        setVisitas(combinadas)
        // Total accionable: las provisorias + las sin asignar que NO son provisorias
        // (para no contar dos veces)
        const idsProv = new Set((provisorias.visitas || []).map((v: { id: string }) => v.id))
        const totalCombinado = (provisorias.total || 0) +
          (sinAsignar.visitas || []).filter((v: { id: string }) => !idsProv.has(v.id)).length
        setTotal(totalCombinado)
      })
      .catch(() => { setVisitas([]); setTotal(0) })
      .finally(() => setCargando(false))
  }, [])

  if (!cargando && total === 0) return null

  return (
    <TarjetaAccion
      titulo="Visitas por planificar"
      subtitulo={total === 1 ? '1 visita requiere atención' : `${total} visitas requieren atención`}
      icono={<MapPinned size={16} strokeWidth={1.5} />}
      colorFondo="bg-insignia-info-fondo"
      colorIcono="text-insignia-info-texto"
      contador={total}
      verTodoHref="/visitas?estado=provisoria,programada&sin_asignado=true"
    >
      {cargando ? (
        <div className="space-y-1.5 py-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 bg-superficie-hover/40 rounded-boton animate-pulse" />
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
            className="flex items-center justify-between gap-2 py-2 px-1.5 rounded-boton hover:bg-superficie-hover/60 cursor-pointer transition-colors"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-medium text-texto-primario truncate">
                  {v.contacto_nombre || 'Sin contacto'}
                </span>
                {v.estado === 'provisoria'
                  ? <Insignia color="violeta">IA</Insignia>
                  : <Insignia color="advertencia">Sin asignar</Insignia>}
              </div>
              <p className="text-xxs text-texto-terciario truncate mt-0.5">
                {v.direccion_texto || v.motivo || '—'}
              </p>
            </div>
            <span className="text-xxs text-texto-terciario shrink-0 tabular-nums">
              {fmtFechaCorta(v.fecha_programada, v.tiene_hora_especifica)}
            </span>
          </div>
        ))
      )}
    </TarjetaAccion>
  )
}
