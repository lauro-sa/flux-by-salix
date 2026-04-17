'use client'

import { useState, useEffect } from 'react'
import { Tabs } from '@/componentes/ui/Tabs'
import { Boton } from '@/componentes/ui/Boton'
import { Settings, RefreshCw } from 'lucide-react'
import { Mail, Hash } from 'lucide-react'
import type { TipoCanal } from '@/tipos/inbox'

/**
 * Barra superior del Inbox — tabs de canales (Correo, Interno) + botones de acción.
 * Muestra indicador de última sincronización para que el usuario sepa si los correos están al día.
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

/** Formatea el tiempo relativo desde la última sincronización */
function tiempoDesdeSync(fecha: Date): string {
  const diffSeg = Math.floor((Date.now() - fecha.getTime()) / 1000)
  if (diffSeg < 10) return 'ahora'
  if (diffSeg < 60) return `hace ${diffSeg}s`
  const diffMin = Math.floor(diffSeg / 60)
  if (diffMin < 60) return `hace ${diffMin} min`
  const diffHoras = Math.floor(diffMin / 60)
  return `hace ${diffHoras}h`
}

interface PropsBarraSuperiorInbox {
  tabActivo: TipoCanal
  onCambiarTab: (tab: TipoCanal) => void
  modulosActivos: Set<string>
  t: (clave: string) => string
  esMovil: boolean
  sincronizando: boolean
  ultimoSync: Date | null
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
  ultimoSync,
  onSincronizarCorreos,
  onIrConfiguracion,
}: PropsBarraSuperiorInbox) {
  const tabs = generarTabs(modulosActivos, t)

  // Actualizar el texto de tiempo relativo cada 30 segundos
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    if (!ultimoSync) return
    const intervalo = setInterval(() => forceUpdate(n => n + 1), 30000)
    return () => clearInterval(intervalo)
  }, [ultimoSync])

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

      <div className="flex items-center gap-1.5">
        {/* Indicador de última sincronización + botón sync */}
        {tabActivo === 'correo' && (
          <button
            onClick={onSincronizarCorreos}
            disabled={sincronizando}
            title={sincronizando ? 'Sincronizando...' : 'Sincronizar correos'}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors cursor-pointer disabled:cursor-default"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--texto-terciario)',
            }}
            onMouseEnter={(e) => { if (!sincronizando) e.currentTarget.style.background = 'var(--superficie-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <RefreshCw size={14} className={sincronizando ? 'animate-spin' : ''} />
            <span className="text-xxs whitespace-nowrap">
              {sincronizando
                ? 'Sincronizando...'
                : ultimoSync
                  ? tiempoDesdeSync(ultimoSync)
                  : 'Sin sincronizar'}
            </span>
          </button>
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
