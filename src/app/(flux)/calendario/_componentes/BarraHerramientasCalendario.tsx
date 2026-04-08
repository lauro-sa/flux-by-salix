'use client'

/**
 * BarraHerramientasCalendario — Barra de navegación y selector de vista del calendario.
 * Incluye: botón Hoy, flechas prev/next, etiqueta de fecha, y selector de vista segmentado.
 * Se usa en: página principal del calendario.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import type { VistaCalendario } from './tipos'

/** Nombres de meses en español */
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/** Nombres de días en español */
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

/** Genera la etiqueta visible según la vista activa y la fecha actual */
function obtenerEtiqueta(vista: VistaCalendario, fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = MESES[fecha.getMonth()]

  switch (vista) {
    case 'mes':
      return `${mes} ${anio}`

    case 'semana': {
      // Calcular inicio (lunes) y fin (domingo) de la semana
      const dia = fecha.getDay()
      const diffLunes = dia === 0 ? -6 : 1 - dia
      const lunes = new Date(fecha)
      lunes.setDate(fecha.getDate() + diffLunes)
      const domingo = new Date(lunes)
      domingo.setDate(lunes.getDate() + 6)

      const mesInicio = MESES[lunes.getMonth()].slice(0, 3)
      const mesFin = MESES[domingo.getMonth()].slice(0, 3)

      if (lunes.getMonth() === domingo.getMonth()) {
        return `${lunes.getDate()} - ${domingo.getDate()} ${mesInicio} ${lunes.getFullYear()}`
      }
      return `${lunes.getDate()} ${mesInicio} - ${domingo.getDate()} ${mesFin} ${domingo.getFullYear()}`
    }

    case 'dia': {
      const diaSemana = DIAS_SEMANA[fecha.getDay()]
      const diaNum = fecha.getDate()
      const mesNombre = MESES[fecha.getMonth()].toLowerCase()
      return `${diaSemana} ${diaNum} de ${mesNombre}`
    }

    case 'agenda':
      return `${mes} ${anio}`

    default:
      return `${mes} ${anio}`
  }
}

/** Opciones del selector de vista */
const OPCIONES_VISTA: { valor: VistaCalendario; etiqueta: string }[] = [
  { valor: 'mes', etiqueta: 'Mes' },
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'dia', etiqueta: 'Día' },
  { valor: 'agenda', etiqueta: 'Agenda' },
]

interface PropiedadesBarraHerramientas {
  vistaActiva: VistaCalendario
  fechaActual: Date
  onCambiarVista: (vista: VistaCalendario) => void
  onNavegar: (direccion: 'anterior' | 'siguiente' | 'hoy') => void
}

function BarraHerramientasCalendario({
  vistaActiva,
  fechaActual,
  onCambiarVista,
  onNavegar,
}: PropiedadesBarraHerramientas) {
  const etiqueta = obtenerEtiqueta(vistaActiva, fechaActual)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      {/* Navegación izquierda */}
      <div className="flex items-center gap-2">
        <Boton
          variante="secundario"
          tamano="sm"
          onClick={() => onNavegar('hoy')}
        >
          Hoy
        </Boton>
        <Boton
          variante="fantasma"
          tamano="sm"
          soloIcono
          icono={<ChevronLeft size={16} />}
          onClick={() => onNavegar('anterior')}
          titulo="Anterior"
        />
        <Boton
          variante="fantasma"
          tamano="sm"
          soloIcono
          icono={<ChevronRight size={16} />}
          onClick={() => onNavegar('siguiente')}
          titulo="Siguiente"
        />
        {/* Etiqueta de fecha */}
        <span className="text-base font-semibold text-texto-primario ml-1 whitespace-nowrap">
          {etiqueta}
        </span>
      </div>

      {/* Selector de vista (segmentado) */}
      <div className="flex items-center bg-superficie-tarjeta border border-borde-sutil rounded-lg p-0.5">
        {OPCIONES_VISTA.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            onClick={() => onCambiarVista(opcion.valor)}
            className={[
              'px-3 py-1.5 text-sm rounded-md transition-colors font-medium',
              vistaActiva === opcion.valor
                ? 'bg-superficie-elevada text-texto-primario shadow-sm'
                : 'text-texto-terciario hover:text-texto-secundario',
            ].join(' ')}
          >
            {opcion.etiqueta}
          </button>
        ))}
      </div>
    </div>
  )
}

export { BarraHerramientasCalendario }
