'use client'

import { Boton } from '@/componentes/ui/Boton'
import {
  Settings, PanelRightOpen, PanelRightClose,
  Rows2, KanbanSquare,
} from 'lucide-react'

/**
 * Barra superior de WhatsApp — toggle vista + acciones.
 * No muestra título (ya lo tiene PlantillaApp arriba).
 */

interface PropsBarraSuperiorWhatsApp {
  vistaWA: 'conversaciones' | 'pipeline'
  onCambiarVistaWA: (vista: 'conversaciones' | 'pipeline') => void
  panelInfoAbierto: boolean
  onTogglePanelInfo: () => void
  esMovil: boolean
  onIrConfiguracion: () => void
}

export function BarraSuperiorWhatsApp({
  vistaWA,
  onCambiarVistaWA,
  panelInfoAbierto,
  onTogglePanelInfo,
  esMovil,
  onIrConfiguracion,
}: PropsBarraSuperiorWhatsApp) {
  return (
    <div
      className="flex items-center justify-between px-4 py-1.5 flex-shrink-0"
      style={{
        borderBottom: '1px solid var(--borde-sutil)',
        background: 'var(--superficie-tarjeta)',
      }}
    >
      {/* Toggle vista: conversaciones / pipeline */}
      {!esMovil ? (
        <div className="flex items-center border border-borde-sutil rounded-card overflow-hidden">
          <Boton
            variante={vistaWA === 'conversaciones' ? 'primario' : 'fantasma'}
            tamano="xs"
            soloIcono
            titulo="Vista conversaciones"
            icono={<Rows2 size={14} />}
            onClick={() => onCambiarVistaWA('conversaciones')}
            className="!rounded-none !rounded-l-lg"
          />
          <Boton
            variante={vistaWA === 'pipeline' ? 'primario' : 'fantasma'}
            tamano="xs"
            soloIcono
            titulo="Vista pipeline"
            icono={<KanbanSquare size={14} />}
            onClick={() => onCambiarVistaWA('pipeline')}
            className="!rounded-none !rounded-r-lg"
          />
        </div>
      ) : (
        <div />
      )}

      <div className="flex items-center gap-1">
        {/* Toggle panel info (solo en vista conversaciones desktop) */}
        {!esMovil && vistaWA === 'conversaciones' && (
          <Boton
            variante="fantasma"
            tamano="xs"
            soloIcono
            titulo="Alternar panel de info"
            icono={panelInfoAbierto ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            onClick={onTogglePanelInfo}
          />
        )}
        {/* Configuración */}
        <Boton
          variante="fantasma"
          tamano="xs"
          soloIcono
          titulo="Configuración"
          icono={<Settings size={16} />}
          onClick={onIrConfiguracion}
        />
      </div>
    </div>
  )
}
