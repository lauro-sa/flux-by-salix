'use client'

import { Tabs } from '@/componentes/ui/Tabs'
import { Boton } from '@/componentes/ui/Boton'
import { Settings, RefreshCw } from 'lucide-react'
import { Mail, Hash } from 'lucide-react'
import type { TipoCanal } from '@/tipos/inbox'

/**
 * Barra superior del Inbox — tabs de canales (Correo, Interno) + botones de acción.
 * WhatsApp se separó a su propia sección.
 */

function generarTabs(modulosActivos: Set<string>, t: (clave: string) => string) {
  const tabs = []
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
  esMovil: boolean
  sincronizando: boolean
  onSincronizarCorreos: () => void
  onIrConfiguracion: () => void
}

export function BarraSuperiorInbox({
  tabActivo,
  onCambiarTab,
  modulosActivos,
  t,
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
