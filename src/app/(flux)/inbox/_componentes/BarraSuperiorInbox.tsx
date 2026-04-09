'use client'

import { Tabs } from '@/componentes/ui/Tabs'
import { Boton } from '@/componentes/ui/Boton'
import {
  Settings, PanelRightOpen, PanelRightClose,
  RefreshCw, Rows2, KanbanSquare,
} from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import { Mail, Hash } from 'lucide-react'
import type { TipoCanal } from '@/tipos/inbox'

/**
 * Barra superior del Inbox — tabs de canales + botones de acción.
 * Se usa en la página principal para navegar entre WhatsApp, Correo e Interno.
 */

// Tabs del inbox según módulos activos
function generarTabs(modulosActivos: Set<string>, t: (clave: string) => string) {
  const tabs = []
  if (modulosActivos.has('inbox_whatsapp')) {
    tabs.push({ clave: 'whatsapp', etiqueta: t('inbox.canales.whatsapp'), icono: <IconoWhatsApp size={14} /> })
  }
  if (modulosActivos.has('inbox_correo')) {
    tabs.push({ clave: 'correo', etiqueta: t('inbox.canales.correo'), icono: <Mail size={14} /> })
  }
  if (modulosActivos.has('inbox_interno')) {
    tabs.push({ clave: 'interno', etiqueta: t('inbox.canales.interno'), icono: <Hash size={14} /> })
  }
  return tabs
}

interface PropsBarraSuperiorInbox {
  tabActivo: TipoCanal
  onCambiarTab: (tab: TipoCanal) => void
  modulosActivos: Set<string>
  t: (clave: string) => string
  // WhatsApp
  vistaWA: 'conversaciones' | 'pipeline'
  onCambiarVistaWA: (vista: 'conversaciones' | 'pipeline') => void
  panelInfoAbierto: boolean
  onTogglePanelInfo: () => void
  esMovil: boolean
  // Correo
  sincronizando: boolean
  onSincronizarCorreos: () => void
  // Navegación
  onIrConfiguracion: () => void
}

export function BarraSuperiorInbox({
  tabActivo,
  onCambiarTab,
  modulosActivos,
  t,
  vistaWA,
  onCambiarVistaWA,
  panelInfoAbierto,
  onTogglePanelInfo,
  esMovil,
  sincronizando,
  onSincronizarCorreos,
  onIrConfiguracion,
}: PropsBarraSuperiorInbox) {
  const tabs = generarTabs(modulosActivos, t)

  return (
    <div
      className="flex items-center justify-between px-4 py-1.5 flex-shrink-0"
      style={{
        borderBottom: '1px solid var(--borde-sutil)',
        background: 'var(--superficie-tarjeta)',
      }}
    >
      <Tabs
        tabs={tabs.map(t => ({
          clave: t.clave,
          etiqueta: t.etiqueta,
          icono: t.icono,
        }))}
        activo={tabActivo}
        onChange={(clave) => onCambiarTab(clave as TipoCanal)}
      />

      <div className="flex items-center gap-1">
        {/* Toggle vista WhatsApp: conversaciones / pipeline (solo desktop) */}
        {tabActivo === 'whatsapp' && !esMovil && (
          <div className="flex items-center border border-borde-sutil rounded-lg overflow-hidden mr-1">
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
        )}
        {/* Toggle panel info (solo WhatsApp tiene panel lateral de info) */}
        {tabActivo === 'whatsapp' && (
          <Boton
            variante="fantasma"
            tamano="xs"
            soloIcono
            titulo="Alternar panel de info"
            icono={panelInfoAbierto ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            onClick={onTogglePanelInfo}
          />
        )}
        {/* Sincronizar correos manualmente */}
        {tabActivo === 'correo' && (
          <Boton
            variante="fantasma"
            tamano="xs"
            soloIcono
            titulo={sincronizando ? 'Sincronizando...' : 'Sincronizar correos'}
            icono={<RefreshCw size={16} className={sincronizando ? 'animate-spin' : ''} />}
            onClick={onSincronizarCorreos}
            disabled={sincronizando}
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
