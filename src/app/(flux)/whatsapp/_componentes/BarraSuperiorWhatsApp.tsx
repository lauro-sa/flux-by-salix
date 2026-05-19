'use client'

import { Boton } from '@/componentes/ui/Boton'
import {
  Settings,
  Rows2, KanbanSquare, Users, Briefcase,
} from 'lucide-react'

/**
 * Barra superior de WhatsApp — switch de audiencia (izq) + toggle vista y acciones (der).
 * Unifica en un único cabezal full-width el switch Clientes/Empleados y los controles
 * globales (vista conversaciones/pipeline, configuración). El toggle del panel de info
 * del contacto vive dentro del header del chat (PanelWhatsApp) porque pertenece a la
 * conversación abierta, no a la vista global.
 */

interface PropsBarraSuperiorWhatsApp {
  audiencia: 'clientes' | 'empleados'
  onCambiarAudiencia: (a: 'clientes' | 'empleados') => void
  vistaWA: 'conversaciones' | 'pipeline'
  onCambiarVistaWA: (vista: 'conversaciones' | 'pipeline') => void
  esMovil: boolean
  onIrConfiguracion: () => void
}

export function BarraSuperiorWhatsApp({
  audiencia,
  onCambiarAudiencia,
  vistaWA,
  onCambiarVistaWA,
  esMovil,
  onIrConfiguracion,
}: PropsBarraSuperiorWhatsApp) {
  // El toggle de vista (Lista/Pipeline) solo aplica a conversaciones con clientes:
  // empleados nunca pasan por pipeline comercial, así que en esa audiencia se oculta.
  const mostrarToggleVista = !esMovil && audiencia === 'clientes'

  return (
    <div
      className="flex items-center justify-between px-2 sm:px-6 flex-shrink-0"
      style={{
        borderBottom: '1px solid var(--borde-sutil)',
        background: 'var(--superficie-tarjeta)',
      }}
    >
      {/* Tabs de audiencia — estilo Notion/Linear: texto + underline color marca cuando activo.
          Más liviano visualmente que un segmented con caja, ideal para barra principal. */}
      <div className="flex items-center gap-1">
        <TabAudiencia
          activo={audiencia === 'clientes'}
          onClick={() => onCambiarAudiencia('clientes')}
          icono={<Users size={14} />}
          etiqueta="Clientes"
        />
        <TabAudiencia
          activo={audiencia === 'empleados'}
          onClick={() => onCambiarAudiencia('empleados')}
          icono={<Briefcase size={14} />}
          etiqueta="Empleados"
        />
      </div>

      <div className="flex items-center gap-2 py-1.5">
        {/* Toggle vista (Lista/Pipeline) — compacto, solo iconos. Va a la derecha como control
            secundario. Solo audiencia clientes; pipeline no aplica a empleados. */}
        {mostrarToggleVista && (
          <div className="flex items-center border border-borde-sutil rounded-card overflow-hidden">
            <Boton
              variante={vistaWA === 'conversaciones' ? 'primario' : 'fantasma'}
              tamano="xs"
              soloIcono
              titulo="Vista lista"
              icono={<Rows2 size={14} />}
              onClick={() => onCambiarVistaWA('conversaciones')}
              className="!rounded-none"
            />
            <Boton
              variante={vistaWA === 'pipeline' ? 'primario' : 'fantasma'}
              tamano="xs"
              soloIcono
              titulo="Vista pipeline"
              icono={<KanbanSquare size={14} />}
              onClick={() => onCambiarVistaWA('pipeline')}
              className="!rounded-none"
            />
          </div>
        )}

        {/* Configuración. tamano="sm" igual al botón "Flux" del Header global y al patrón
            establecido en PlantillaListado (contactos, presupuestos, etc.) → centros
            alineados verticalmente entre header y barra del módulo. */}
        <Boton
          variante="fantasma"
          tamano="sm"
          soloIcono
          titulo="Configuración"
          icono={<Settings size={16} />}
          onClick={onIrConfiguracion}
        />
      </div>
    </div>
  )
}

/** Tab de audiencia estilo Notion/Linear: texto + icono, underline cuando activo.
    Padding vertical generoso para que el underline tenga espacio de respiro. */
function TabAudiencia({
  activo, onClick, icono, etiqueta,
}: {
  activo: boolean
  onClick: () => void
  icono: React.ReactNode
  etiqueta: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-2 px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
        activo ? 'text-texto-primario' : 'text-texto-terciario hover:text-texto-secundario'
      }`}
    >
      <span style={{ color: activo ? 'var(--texto-marca)' : undefined }}>{icono}</span>
      {etiqueta}
      {/* Underline color marca debajo del tab activo. -bottom-px solapa el border-bottom
          del contenedor para que la línea quede pegada al borde inferior. */}
      {activo && (
        <span
          className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full"
          style={{ background: 'var(--texto-marca)' }}
        />
      )}
    </button>
  )
}
