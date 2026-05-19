'use client'

import { Wrench, PlusCircle, Sparkles, Zap } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * EstadoVacioSalix — Pantalla cuando el usuario abrió el panel y no
 * escribió nada todavía. Muestra 4 cards de "templates" clickeables
 * con ejemplos de qué tipo de trabajo puede presupuestar.
 *
 * Al clickear un template, su descripción se vuelca al input.
 * Las cards flotan con un bob sutil con stagger para que el ojo
 * no las perciba sincronizadas (delays 0 / 0.7 / 1.4 / 2.1s).
 */

interface PlantillaEjemplo {
  id: string
  titulo: string
  bajada: string
  ejemplo: string
  icono: ReactNode
}

const PLANTILLAS: PlantillaEjemplo[] = [
  {
    id: 'reparacion',
    titulo: 'Reparación de portón',
    bajada: 'cambio de piezas + ajustes',
    ejemplo: 'Reparación de portón abatible: cambio de zócalo inferior, ajuste de bisagras y nivelación de hoja izquierda. Calibración del cierre.',
    icono: <Wrench size={16} />,
  },
  {
    id: 'instalacion',
    titulo: 'Instalación nueva',
    bajada: 'portón desde cero',
    ejemplo: 'Instalación de portón corredizo nuevo de 4 metros, con riel superior, motor con placa electrónica y dos controles remoto.',
    icono: <PlusCircle size={16} />,
  },
  {
    id: 'mantenimiento',
    titulo: 'Mantenimiento',
    bajada: 'preventivo programado',
    ejemplo: 'Mantenimiento preventivo: lubricación de rieles y bisagras, ajuste de tornillería, revisión del motor y calibración del cierre.',
    icono: <Sparkles size={16} />,
  },
  {
    id: 'automatizacion',
    titulo: 'Automatización',
    bajada: 'motor + placa eléctrica',
    ejemplo: 'Automatización de portón abatible de una hoja: motor lineal, instalación eléctrica, placa de control y dos controles.',
    icono: <Zap size={16} />,
  },
]

interface PropsEstadoVacioSalix {
  onElegirPlantilla: (ejemplo: string) => void
}

export function EstadoVacioSalix({ onElegirPlantilla }: PropsEstadoVacioSalix) {
  return (
    <div className="px-5 py-4 space-y-3">
      <p className="text-[11px] font-medium text-texto-terciario uppercase tracking-wider text-center">
        Probá con un ejemplo
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PLANTILLAS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onElegirPlantilla(p.ejemplo)}
            className="
              group relative text-left p-3 rounded-card
              border border-borde-sutil bg-superficie-app/40
              hover:border-insignia-primario/40 hover:bg-superficie-hover
              transition-all
            "
            style={{
              animation: 'flux-flotar 4.5s ease-in-out infinite',
              animationDelay: `${i * 0.7}s`,
            }}
          >
            <div className="size-7 rounded-boton flex items-center justify-center mb-2 bg-superficie-elevada text-texto-secundario group-hover:text-insignia-primario-texto transition-colors">
              {p.icono}
            </div>
            <p className="text-xs font-semibold text-texto-primario leading-tight">{p.titulo}</p>
            <p className="text-[10px] text-texto-terciario mt-0.5">{p.bajada}</p>
          </button>
        ))}
      </div>
    </div>
  )
}
