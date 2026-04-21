'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Wrench } from 'lucide-react'
import { Insignia } from '@/componentes/ui/Insignia'
import { TarjetaAccion } from './TarjetaAccion'

/**
 * WidgetOrdenesPorGestionar — Para admin/gestor/propietario. Órdenes en estado
 * `abierta`: creadas desde un presupuesto aceptado pero que todavía no fueron
 * trabajadas (no pasaron a `en_progreso`). Son las que el admin tiene que
 * preparar: asignar responsable, agregar notas y publicar para que el asignado
 * las vea en su software.
 *
 * Una vez que el asignado las toma y arranca → pasan a `en_progreso` y salen
 * de acá. Las completadas/canceladas tampoco aparecen (ya están resueltas).
 */

interface OrdenCompacta {
  id: string
  numero: string
  titulo: string
  prioridad: string
  publicada: boolean
  asignado_a: string | null
  asignado_nombre: string | null
  contacto_nombre: string | null
  presupuesto_numero: string | null
  creado_en: string
}

function diasDesde(iso: string): string {
  const d = new Date(iso)
  const hoy = new Date()
  const diff = Math.floor((hoy.getTime() - d.getTime()) / 86400000)
  if (diff === 0) return 'Hoy'
  if (diff === 1) return 'Ayer'
  if (diff < 7) return `Hace ${diff}d`
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function WidgetOrdenesPorGestionar() {
  const router = useRouter()
  const [ordenes, setOrdenes] = useState<OrdenCompacta[]>([])
  const [total, setTotal] = useState(0)
  const [sinAsignar, setSinAsignar] = useState(0)
  const [sinPublicar, setSinPublicar] = useState(0)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    // Todas las abiertas (las que el admin tiene que preparar). Traigo las más
    // viejas primero — son las que llevan más tiempo sin atención.
    fetch('/api/ordenes?estado=abierta&por_pagina=5&orden_campo=creado_en&orden_dir=asc')
      .then(r => r.ok ? r.json() : { ordenes: [], total: 0 })
      .then(d => {
        const lista: OrdenCompacta[] = d.ordenes || []
        setOrdenes(lista)
        setTotal(d.total || 0)
        // Contadores derivados: ayudan al admin a saber qué tipo de acción toca
        setSinAsignar(lista.filter(o => !o.asignado_a).length)
        setSinPublicar(lista.filter(o => !o.publicada).length)
      })
      .catch(() => { setOrdenes([]); setTotal(0); setSinAsignar(0); setSinPublicar(0) })
      .finally(() => setCargando(false))
  }, [])

  if (!cargando && total === 0) return null

  // Subtítulo dinámico: refleja las acciones pendientes sobre lo traído
  const partes: string[] = []
  if (sinAsignar > 0) partes.push(`${sinAsignar} sin asignar`)
  if (sinPublicar > 0) partes.push(`${sinPublicar} sin publicar`)
  const subtitulo = partes.length > 0 ? partes.join(' · ') : `${total} abiertas`

  return (
    <TarjetaAccion
      titulo="Órdenes por gestionar"
      subtitulo={subtitulo}
      icono={<Wrench size={16} strokeWidth={1.5} />}
      colorFondo="bg-insignia-advertencia-fondo"
      colorIcono="text-insignia-advertencia-texto"
      contador={total}
      verTodoHref="/ordenes?estado=abierta"
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
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs font-medium text-texto-primario">{o.numero}</span>
                {o.presupuesto_numero && (
                  <span className="text-xxs text-texto-terciario">· {o.presupuesto_numero}</span>
                )}
                {!o.asignado_a && <Insignia color="advertencia">Sin asignar</Insignia>}
                {!o.publicada && <Insignia color="naranja">Sin publicar</Insignia>}
                {(o.prioridad === 'alta' || o.prioridad === 'urgente') && <Insignia color="peligro">!</Insignia>}
              </div>
              <p className="text-xxs text-texto-terciario truncate mt-0.5">
                {o.titulo}{o.contacto_nombre ? ` · ${o.contacto_nombre}` : ''}
              </p>
            </div>
            <span className="text-xxs text-texto-terciario shrink-0 tabular-nums">{diasDesde(o.creado_en)}</span>
          </div>
        ))
      )}
    </TarjetaAccion>
  )
}
