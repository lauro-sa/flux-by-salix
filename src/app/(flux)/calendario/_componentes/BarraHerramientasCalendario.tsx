'use client'

/**
 * BarraHerramientasCalendario — Barra de navegación y controles del calendario.
 * Fila 1: Hoy + flechas + etiqueta fecha | filtros compactos | selector de vista
 * Se usa en: página principal del calendario.
 */

import { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import { Boton } from '@/componentes/ui/Boton'
import type { VistaCalendario } from './tipos'

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function obtenerEtiqueta(vista: VistaCalendario, fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = MESES[fecha.getMonth()]

  switch (vista) {
    case 'mes':
      return `${mes} ${anio}`
    case 'semana': {
      const dia = fecha.getDay()
      const diffLunes = dia === 0 ? -6 : 1 - dia
      const lunes = new Date(fecha)
      lunes.setDate(fecha.getDate() + diffLunes)
      const domingo = new Date(lunes)
      domingo.setDate(lunes.getDate() + 6)
      const mesInicio = MESES[lunes.getMonth()].slice(0, 3)
      const mesFin = MESES[domingo.getMonth()].slice(0, 3)
      if (lunes.getMonth() === domingo.getMonth()) {
        return `${lunes.getDate()} – ${domingo.getDate()} ${mesInicio} ${lunes.getFullYear()}`
      }
      return `${lunes.getDate()} ${mesInicio} – ${domingo.getDate()} ${mesFin} ${domingo.getFullYear()}`
    }
    case 'dia': {
      const diaSemana = DIAS_SEMANA[fecha.getDay()]
      const diaNum = fecha.getDate()
      const mesNombre = MESES[fecha.getMonth()].toLowerCase()
      return `${diaSemana} ${diaNum} de ${mesNombre}`
    }
    case 'equipo': {
      const diaSemana = DIAS_SEMANA[fecha.getDay()]
      const diaNum = fecha.getDate()
      const mesNombre = MESES[fecha.getMonth()].toLowerCase()
      return `${diaSemana} ${diaNum} de ${mesNombre}`
    }
    default:
      return `${mes} ${anio}`
  }
}

const OPCIONES_VISTA: { valor: VistaCalendario; etiqueta: string }[] = [
  { valor: 'mes', etiqueta: 'Mes' },
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'dia', etiqueta: 'Día' },
  { valor: 'agenda', etiqueta: 'Agenda' },
  { valor: 'equipo', etiqueta: 'Equipo' },
]

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
  tipos?: TipoFiltro[]
  filtroTipo?: string
  onCambiarFiltroTipo?: (tipo: string) => void
  filtroVista?: string
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
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const filtrosRef = useRef<HTMLDivElement>(null)

  // Cerrar filtros al hacer click fuera
  useEffect(() => {
    if (!filtrosAbiertos) return
    const manejarClick = (e: MouseEvent) => {
      if (filtrosRef.current && !filtrosRef.current.contains(e.target as Node)) {
        setFiltrosAbiertos(false)
      }
    }
    document.addEventListener('mousedown', manejarClick)
    return () => document.removeEventListener('mousedown', manejarClick)
  }, [filtrosAbiertos])

  const hayFiltroActivo = filtroTipo !== '' || filtroVista !== 'todos'

  return (
    <div className="flex flex-col gap-0 mb-3">
      {/* Fila única: navegación + filtros + vistas */}
      <div className="flex items-center justify-between gap-2 py-2">

        {/* Izquierda: navegación */}
        <div className="flex items-center gap-1.5">
          <Boton variante="secundario" tamano="xs" onClick={() => onNavegar('hoy')}>
            Hoy
          </Boton>
          <div className="flex items-center">
            <button
              type="button"
              onClick={() => onNavegar('anterior')}
              className="p-1 rounded-md text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => onNavegar('siguiente')}
              className="p-1 rounded-md text-texto-terciario hover:text-texto-primario hover:bg-superficie-hover transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <span className="text-sm font-semibold text-texto-primario whitespace-nowrap">
            {etiqueta}
          </span>
        </div>

        {/* Centro: filtro rápido Todos/Mis eventos + botón filtros */}
        <div className="flex items-center gap-2">
          {/* Toggle Todos / Mis eventos */}
          {onCambiarFiltroVista && (
            <div className="hidden sm:flex items-center bg-superficie-tarjeta border border-borde-sutil rounded-lg p-0.5">
              {[
                { valor: 'todos', etiqueta: 'Todos' },
                { valor: 'mios', etiqueta: 'Míos' },
              ].map((op) => (
                <button
                  key={op.valor}
                  type="button"
                  onClick={() => onCambiarFiltroVista(op.valor)}
                  className={[
                    'px-2 py-1 text-xs rounded-md transition-colors font-medium',
                    filtroVista === op.valor
                      ? 'bg-superficie-elevada text-texto-primario shadow-sm'
                      : 'text-texto-terciario hover:text-texto-secundario',
                  ].join(' ')}
                >
                  {op.etiqueta}
                </button>
              ))}
            </div>
          )}

          {/* Botón filtros por tipo (dropdown) */}
          {tipos && tipos.length > 0 && (
            <div className="relative" ref={filtrosRef}>
              <button
                type="button"
                onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
                className={[
                  'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border transition-colors font-medium',
                  hayFiltroActivo || filtrosAbiertos
                    ? 'bg-superficie-elevada text-texto-primario border-borde-fuerte'
                    : 'text-texto-terciario border-borde-sutil hover:border-borde-fuerte hover:text-texto-secundario',
                ].join(' ')}
              >
                <Filter size={13} />
                <span className="hidden sm:inline">Filtrar</span>
                {hayFiltroActivo && (
                  <span className="size-1.5 rounded-full bg-texto-marca" />
                )}
              </button>

              {/* Dropdown de filtros */}
              {filtrosAbiertos && (
                <div className="absolute right-0 top-full mt-1.5 z-50 bg-superficie-elevada border border-borde-sutil rounded-xl shadow-lg p-3 min-w-[220px]">
                  <p className="text-xs font-medium text-texto-terciario mb-2">Tipo de evento</p>
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => { onCambiarFiltroTipo?.(''); setFiltrosAbiertos(false) }}
                      className={[
                        'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left',
                        filtroTipo === ''
                          ? 'bg-superficie-hover text-texto-primario font-medium'
                          : 'text-texto-secundario hover:bg-superficie-hover',
                      ].join(' ')}
                    >
                      Todos los tipos
                    </button>
                    {tipos.map((tipo) => (
                      <button
                        key={tipo.id}
                        type="button"
                        onClick={() => {
                          onCambiarFiltroTipo?.(filtroTipo === tipo.clave ? '' : tipo.clave)
                          setFiltrosAbiertos(false)
                        }}
                        className={[
                          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm transition-colors text-left',
                          filtroTipo === tipo.clave
                            ? 'bg-superficie-hover text-texto-primario font-medium'
                            : 'text-texto-secundario hover:bg-superficie-hover',
                        ].join(' ')}
                      >
                        <span
                          className="size-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: tipo.color }}
                        />
                        {tipo.etiqueta}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Derecha: selector de vista */}
        <div className="flex items-center bg-superficie-tarjeta border border-borde-sutil rounded-lg p-0.5">
          {OPCIONES_VISTA.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              onClick={() => onCambiarVista(opcion.valor)}
              className={[
                'px-2.5 py-1 text-xs rounded-md transition-colors font-medium',
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
    </div>
  )
}

export { BarraHerramientasCalendario }
