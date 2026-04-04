'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { TarjetaConPestanas } from '@/componentes/ui/TarjetaConPestanas'
import { Insignia } from '@/componentes/ui/Insignia'
import { Boton } from '@/componentes/ui/Boton'

/**
 * WidgetActividades — Resumen de actividades con dos vistas:
 * Pestaña 1 "Resumen": pendientes, completadas hoy, vencidas + lista
 * Pestaña 2 "Por persona": carga de trabajo por asignado
 */

interface Actividad {
  id: string
  titulo: string
  tipo_clave: string
  estado_clave: string
  prioridad: string
  fecha_vencimiento: string | null
  asignado_nombre: string | null
}

interface PersonaActividades {
  nombre: string
  pendientes: number
  completadas: number
}

interface Props {
  pendientes: Actividad[]
  totalPendientes: number
  completadasHoy: number
  porPersona: PersonaActividades[]
}

export function WidgetActividades({ pendientes, totalPendientes, completadasHoy, porPersona }: Props) {
  const router = useRouter()
  const vencidas = pendientes.filter(a => a.fecha_vencimiento && new Date(a.fecha_vencimiento) < new Date()).length

  const contenidoResumen = (
    <div className="space-y-4">
      {/* Mini KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center py-3 px-2 rounded-lg bg-superficie-hover/50">
          <Clock size={14} className="text-insignia-advertencia-texto mb-1" />
          <span className="text-lg font-bold text-texto-primario leading-tight">{totalPendientes}</span>
          <span className="text-xxs text-texto-terciario">Pendientes</span>
        </div>
        <div className="flex flex-col items-center py-3 px-2 rounded-lg bg-superficie-hover/50">
          <CheckCircle2 size={14} className="text-insignia-exito-texto mb-1" />
          <span className="text-lg font-bold text-texto-primario leading-tight">{completadasHoy}</span>
          <span className="text-xxs text-texto-terciario">Hoy</span>
        </div>
        <div className="flex flex-col items-center py-3 px-2 rounded-lg bg-superficie-hover/50">
          <AlertCircle size={14} className="text-insignia-peligro-texto mb-1" />
          <span className="text-lg font-bold text-texto-primario leading-tight">{vencidas}</span>
          <span className="text-xxs text-texto-terciario">Vencidas</span>
        </div>
      </div>

      {/* Lista de pendientes */}
      {pendientes.length > 0 ? (
        <div className="space-y-1">
          {pendientes.slice(0, 6).map(act => {
            const estaVencida = act.fecha_vencimiento && new Date(act.fecha_vencimiento) < new Date()
            return (
              <div
                key={act.id}
                className="flex items-center justify-between py-2 px-1 rounded-md hover:bg-superficie-hover cursor-pointer transition-colors"
                onClick={() => router.push('/actividades')}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-texto-primario truncate">{act.titulo}</span>
                    {act.prioridad === 'alta' && <Insignia color="peligro">Alta</Insignia>}
                  </div>
                  {act.asignado_nombre && (
                    <p className="text-xs text-texto-terciario truncate mt-0.5">{act.asignado_nombre}</p>
                  )}
                </div>
                {act.fecha_vencimiento && (
                  <span className={`text-xs shrink-0 ml-2 ${estaVencida ? 'text-insignia-peligro-texto font-semibold' : 'text-texto-terciario'}`}>
                    {new Date(act.fecha_vencimiento).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-texto-terciario text-center py-4">Sin actividades pendientes</p>
      )}
    </div>
  )

  const contenidoPorPersona = (
    <div className="space-y-2">
      {porPersona.length > 0 ? (
        <>
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 text-xs text-texto-terciario font-medium pb-1 border-b border-borde-sutil">
            <span>Persona</span>
            <span className="text-right">Pend.</span>
            <span className="text-right">Compl.</span>
          </div>

          {porPersona.map(p => {
            const total = p.pendientes + p.completadas
            const pctCompletadas = total > 0 ? Math.round((p.completadas / total) * 100) : 0
            return (
              <div key={p.nombre}>
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 items-center text-xs py-1">
                  <span className="text-texto-primario truncate">{p.nombre}</span>
                  <span className="text-texto-primario font-medium text-right tabular-nums">{p.pendientes}</span>
                  <span className="text-insignia-exito-texto font-medium text-right tabular-nums">{p.completadas}</span>
                </div>
                {/* Mini barra de progreso */}
                <div className="h-1 rounded-full bg-superficie-hover overflow-hidden">
                  <div
                    className="h-full rounded-full bg-insignia-exito-texto/60 transition-all duration-500"
                    style={{ width: `${pctCompletadas}%` }}
                  />
                </div>
              </div>
            )
          })}
        </>
      ) : (
        <p className="text-sm text-texto-terciario text-center py-4">Sin datos de asignación</p>
      )}
    </div>
  )

  return (
    <TarjetaConPestanas
      titulo="Actividades"
      subtitulo="Tareas pendientes y carga de trabajo"
      pestanas={[
        { etiqueta: 'Resumen', contenido: contenidoResumen },
        { etiqueta: 'Por persona', contenido: contenidoPorPersona },
      ]}
      acciones={
        <Boton variante="fantasma" tamano="xs" iconoDerecho={<ArrowRight size={12} />} onClick={() => router.push('/actividades')}>
          Ver todo
        </Boton>
      }
    />
  )
}
