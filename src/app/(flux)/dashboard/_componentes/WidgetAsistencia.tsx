'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, UserCheck, UserX, Clock } from 'lucide-react'
import { TarjetaConPestanas } from '@/componentes/ui/TarjetaConPestanas'
import { Boton } from '@/componentes/ui/Boton'

/**
 * WidgetAsistencia — Resumen de asistencia del equipo.
 * Pestaña 1 "Hoy": presentes, ausentes, tardanzas
 * Pestaña 2 "Semana": resumen acumulado de la semana
 */

interface AsistenciaHoy {
  presentes: number
  ausentes: number
  tardanzas: number
  total: number
}

interface Props {
  hoy: AsistenciaHoy
  semana: Record<string, { presentes: number; ausentes: number; tardanzas: number }>
}

export function WidgetAsistencia({ hoy, semana }: Props) {
  const router = useRouter()

  // Si no hay datos de asistencia, no mostrar
  if (hoy.total === 0 && Object.keys(semana).length === 0) return null

  const pctPresentes = hoy.total > 0 ? Math.round((hoy.presentes / hoy.total) * 100) : 0

  const contenidoHoy = (
    <div className="space-y-4">
      {/* Ring visual simplificado */}
      <div className="flex items-center justify-center gap-8">
        <div className="relative size-24 flex items-center justify-center">
          {/* SVG ring */}
          <svg className="size-24 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--superficie-hover)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.5" fill="none"
              stroke="var(--insignia-exito-texto)"
              strokeWidth="3"
              strokeDasharray={`${pctPresentes} ${100 - pctPresentes}`}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-texto-primario">{pctPresentes}%</span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <UserCheck size={14} className="text-insignia-exito-texto" />
            <span className="text-xs text-texto-secundario">Presentes</span>
            <span className="text-sm font-bold text-texto-primario ml-auto">{hoy.presentes}</span>
          </div>
          <div className="flex items-center gap-2">
            <UserX size={14} className="text-insignia-peligro-texto" />
            <span className="text-xs text-texto-secundario">Ausentes</span>
            <span className="text-sm font-bold text-texto-primario ml-auto">{hoy.ausentes}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-insignia-advertencia-texto" />
            <span className="text-xs text-texto-secundario">Tardanzas</span>
            <span className="text-sm font-bold text-texto-primario ml-auto">{hoy.tardanzas}</span>
          </div>
        </div>
      </div>
    </div>
  )

  // Semana: agregar totales
  const totalSemana = Object.values(semana).reduce(
    (acc, m) => ({
      presentes: acc.presentes + m.presentes,
      ausentes: acc.ausentes + m.ausentes,
      tardanzas: acc.tardanzas + m.tardanzas,
    }),
    { presentes: 0, ausentes: 0, tardanzas: 0 }
  )
  const totalRegistrosSemana = totalSemana.presentes + totalSemana.ausentes + totalSemana.tardanzas
  const pctPresentesSemana = totalRegistrosSemana > 0 ? Math.round((totalSemana.presentes / totalRegistrosSemana) * 100) : 0

  const contenidoSemana = (
    <div className="space-y-4">
      {/* Barra horizontal apilada */}
      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-texto-secundario">Asistencia semanal</span>
          <span className="text-texto-primario font-semibold">{pctPresentesSemana}% presencia</span>
        </div>
        <div className="h-3 rounded-full bg-superficie-hover overflow-hidden flex">
          {totalRegistrosSemana > 0 && (
            <>
              <div
                className="h-full bg-insignia-exito-texto transition-all duration-500"
                style={{ width: `${(totalSemana.presentes / totalRegistrosSemana) * 100}%` }}
              />
              <div
                className="h-full bg-insignia-advertencia-texto transition-all duration-500"
                style={{ width: `${(totalSemana.tardanzas / totalRegistrosSemana) * 100}%` }}
              />
              <div
                className="h-full bg-insignia-peligro-texto/60 transition-all duration-500"
                style={{ width: `${(totalSemana.ausentes / totalRegistrosSemana) * 100}%` }}
              />
            </>
          )}
        </div>
      </div>

      {/* Leyenda */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
        <div className="py-2 px-2 rounded-lg bg-superficie-hover/50">
          <span className="text-lg font-bold text-insignia-exito-texto">{totalSemana.presentes}</span>
          <p className="text-xxs text-texto-terciario">Presentes</p>
        </div>
        <div className="py-2 px-2 rounded-lg bg-superficie-hover/50">
          <span className="text-lg font-bold text-insignia-advertencia-texto">{totalSemana.tardanzas}</span>
          <p className="text-xxs text-texto-terciario">Tardanzas</p>
        </div>
        <div className="py-2 px-2 rounded-lg bg-superficie-hover/50">
          <span className="text-lg font-bold text-insignia-peligro-texto">{totalSemana.ausentes}</span>
          <p className="text-xxs text-texto-terciario">Ausentes</p>
        </div>
      </div>

      <p className="text-xxs text-texto-terciario text-center">
        {Object.keys(semana).length} miembros registrados esta semana
      </p>
    </div>
  )

  return (
    <TarjetaConPestanas
      titulo="Asistencia del equipo"
      pestanas={[
        { etiqueta: 'Hoy', contenido: contenidoHoy },
        { etiqueta: 'Semana', contenido: contenidoSemana },
      ]}
      acciones={
        <Boton variante="fantasma" tamano="xs" iconoDerecho={<ArrowRight size={12} />} onClick={() => router.push('/asistencias')}>
          Ver todo
        </Boton>
      }
    />
  )
}
