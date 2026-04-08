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

    case 'equipo': {
      const diaSemana = DIAS_SEMANA[fecha.getDay()]
      const diaNum = fecha.getDate()
      const mesNombre = MESES[fecha.getMonth()].toLowerCase()
      return `${diaSemana} ${diaNum} de ${mesNombre} — Equipo`
    }

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
  { valor: 'equipo', etiqueta: 'Equipo' },
]

/** Tipo de evento con color para los filtros */
interface TipoFiltro {
  id: string
  clave: string
  etiqueta: string
  color: string
}

interface PropiedadesBarraHerramientas {
  vistaActiva: VistaCalendario
  fechaActual: Date
  onCambiarVista: (vista: VistaCalendario) => void
  onNavegar: (direccion: 'anterior' | 'siguiente' | 'hoy') => void
  /** Tipos de evento disponibles para filtrar */
  tipos?: TipoFiltro[]
  /** Clave del tipo de evento seleccionado ('' = todos) */
  filtroTipo?: string
  /** Callback al cambiar el filtro de tipo */
  onCambiarFiltroTipo?: (tipo: string) => void
  /** Vista de eventos: 'todos' o 'mios' */
  filtroVista?: string
  /** Callback al cambiar la vista de eventos */
  onCambiarFiltroVista?: (vista: string) => void
}

function BarraHerramientasCalendario({
  vistaActiva,
  fechaActual,
  onCambiarVista,
  onNavegar,
  tipos,
  filtroTipo = '',
  onCambiarFiltroTipo,
  filtroVista = 'todos',
  onCambiarFiltroVista,
}: PropiedadesBarraHerramientas) {
  const etiqueta = obtenerEtiqueta(vistaActiva, fechaActual)
  const hayFiltros = tipos && tipos.length > 0

  return (
    <div className="flex flex-col gap-2 mb-4">
      {/* Fila principal: navegación + selector de vista */}
      <div className="flex flex-wrap items-center justify-between gap-3">
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

      {/* Fila de filtros — solo visible si hay tipos disponibles */}
      {hayFiltros && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por tipo de evento (píldoras con punto de color) */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => onCambiarFiltroTipo?.('')}
              className={[
                'px-2.5 py-1 text-xs rounded-full border transition-colors font-medium',
                filtroTipo === ''
                  ? 'bg-superficie-elevada text-texto-primario border-borde-fuerte shadow-sm'
                  : 'text-texto-terciario border-borde-sutil hover:text-texto-secundario hover:border-borde-fuerte',
              ].join(' ')}
            >
              Todos
            </button>
            {tipos!.map((tipo) => (
              <button
                key={tipo.id}
                type="button"
                onClick={() => onCambiarFiltroTipo?.(filtroTipo === tipo.clave ? '' : tipo.clave)}
                className={[
                  'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full border transition-colors font-medium',
                  filtroTipo === tipo.clave
                    ? 'bg-superficie-elevada text-texto-primario border-borde-fuerte shadow-sm'
                    : 'text-texto-terciario border-borde-sutil hover:text-texto-secundario hover:border-borde-fuerte',
                ].join(' ')}
              >
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: tipo.color }}
                />
                {tipo.etiqueta}
              </button>
            ))}
          </div>

          {/* Separador vertical */}
          <div className="w-px h-5 bg-borde-sutil mx-1" />

          {/* Toggle Todos / Mis eventos */}
          <div className="flex items-center bg-superficie-tarjeta border border-borde-sutil rounded-full p-0.5">
            {[
              { valor: 'todos', etiqueta: 'Todos' },
              { valor: 'mios', etiqueta: 'Mis eventos' },
            ].map((opcion) => (
              <button
                key={opcion.valor}
                type="button"
                onClick={() => onCambiarFiltroVista?.(opcion.valor)}
                className={[
                  'px-2.5 py-1 text-xs rounded-full transition-colors font-medium',
                  filtroVista === opcion.valor
                    ? 'bg-superficie-elevada text-texto-primario shadow-sm'
                    : 'text-texto-terciario hover:text-texto-secundario',
                ].join(' ')}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export { BarraHerramientasCalendario }
