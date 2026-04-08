'use client'

import { useState, useEffect, useCallback } from 'react'
import { Calendar, CalendarDays, LayoutGrid, List } from 'lucide-react'
import { CargadorSeccion } from '@/componentes/ui/Cargador'

/**
 * SeccionVistaDefault — Selector de vista predeterminada del calendario.
 * Opciones: día, semana, mes, agenda. Autoguardado al cambiar.
 */

type VistaCalendario = 'dia' | 'semana' | 'mes' | 'agenda'

const OPCIONES_VISTA: { valor: VistaCalendario; etiqueta: string; descripcion: string; icono: React.ReactNode }[] = [
  {
    valor: 'dia',
    etiqueta: 'Día',
    descripcion: 'Vista detallada de un solo día con slots de hora',
    icono: <Calendar size={20} />,
  },
  {
    valor: 'semana',
    etiqueta: 'Semana',
    descripcion: 'Vista de 7 días con columnas por día',
    icono: <CalendarDays size={20} />,
  },
  {
    valor: 'mes',
    etiqueta: 'Mes',
    descripcion: 'Vista general del mes completo con celdas por día',
    icono: <LayoutGrid size={20} />,
  },
  {
    valor: 'agenda',
    etiqueta: 'Agenda',
    descripcion: 'Lista cronológica de eventos próximos',
    icono: <List size={20} />,
  },
]

interface PropiedadesSeccionVista {
  config: { vista_default?: VistaCalendario } | null
  cargando: boolean
  onAccionAPI: (accion: string, datos: Record<string, unknown>) => Promise<unknown>
}

function SeccionVistaDefault({ config, cargando, onAccionAPI }: PropiedadesSeccionVista) {
  const [vistaActual, setVistaActual] = useState<VistaCalendario>('semana')
  const [guardando, setGuardando] = useState(false)

  // Sincronizar con config recibida
  useEffect(() => {
    if (config?.vista_default) setVistaActual(config.vista_default)
  }, [config])

  // Cambiar vista con autoguardado
  const cambiarVista = useCallback(async (vista: VistaCalendario) => {
    setVistaActual(vista)
    setGuardando(true)
    try {
      await onAccionAPI('actualizar_config', { vista_default: vista })
    } finally {
      setGuardando(false)
    }
  }, [onAccionAPI])

  if (cargando) return <CargadorSeccion />

  return (
    <div className="space-y-4">
      <div className="bg-superficie-tarjeta border border-borde-sutil rounded-xl p-5">
        <h3 className="text-base font-semibold text-texto-primario">Vista predeterminada</h3>
        <p className="text-sm text-texto-terciario mt-0.5 mb-5">
          Elige la vista que se mostrará al abrir el calendario. Cada usuario puede cambiarla temporalmente.
        </p>

        {/* Grid de opciones */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {OPCIONES_VISTA.map(opcion => {
            const seleccionada = vistaActual === opcion.valor
            return (
              <button
                key={opcion.valor}
                onClick={() => cambiarVista(opcion.valor)}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-150 cursor-pointer ${
                  seleccionada
                    ? 'border-texto-marca bg-texto-marca/5'
                    : 'border-borde-sutil bg-superficie-tarjeta hover:border-borde-fuerte hover:bg-superficie-hover/50'
                }`}
              >
                <div className={`shrink-0 mt-0.5 ${seleccionada ? 'text-texto-marca' : 'text-texto-terciario'}`}>
                  {opcion.icono}
                </div>
                <div>
                  <p className={`text-sm font-semibold ${seleccionada ? 'text-texto-marca' : 'text-texto-primario'}`}>
                    {opcion.etiqueta}
                  </p>
                  <p className="text-xs text-texto-terciario mt-0.5">
                    {opcion.descripcion}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Indicador de guardado */}
      {guardando && (
        <p className="text-xs text-texto-terciario text-right animate-pulse">Guardando...</p>
      )}
    </div>
  )
}

export { SeccionVistaDefault }
