'use client'

import { useState, useEffect } from 'react'
import { Boton } from '@/componentes/ui/Boton'
import {
  Settings, RefreshCw, Mail, Hash, Columns2, Rows2,
} from 'lucide-react'
import type { TipoCanal } from '@/tipos/inbox'
import type { ModoVista } from './useEstadoInbox'

/**
 * Barra superior del Inbox — tabs (izq) + sync + vista + configuración (der).
 * Mismo patrón visual que BarraSuperiorWhatsApp: full-width, padding consistente,
 * configuración con tamaño "sm" alineado al header global. Los controles globales
 * del módulo (vista columna/fila) viven acá para que los cabezales internos
 * (sidebar y lista de conversaciones) tengan altura uniforme y solo carguen
 * acciones propias de su columna.
 */

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
  modoVista: ModoVista
  onCambiarModoVista: (modo: ModoVista) => void
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
  modoVista,
  onCambiarModoVista,
}: PropsBarraSuperiorInbox) {
  // Tick para que el texto "hace X min" se actualice solo
  const [, forceUpdate] = useState(0)
  useEffect(() => {
    if (!ultimoSync) return
    const intervalo = setInterval(() => forceUpdate(n => n + 1), 30000)
    return () => clearInterval(intervalo)
  }, [ultimoSync])

  const mostrarTabCorreo = modulosActivos.has('inbox_correo')
  const mostrarTabInterno = modulosActivos.has('inbox_interno')
  // Toggle vista columna/fila solo aplica a correo en desktop.
  const mostrarToggleVista = !esMovil && tabActivo === 'correo'

  return (
    <div
      className="flex items-center justify-between px-2 sm:px-6 flex-shrink-0"
      style={{
        borderBottom: '1px solid var(--borde-sutil)',
        background: 'var(--superficie-tarjeta)',
      }}
    >
      {/* Tabs estilo Notion/Linear: texto + underline cuando activo. Espejo del
          patrón de BarraSuperiorWhatsApp para mantener consistencia entre módulos. */}
      <div className="flex items-center gap-1">
        {mostrarTabCorreo && (
          <TabInbox
            activo={tabActivo === 'correo'}
            onClick={() => onCambiarTab('correo')}
            icono={<Mail size={14} />}
            etiqueta={t('inbox.canales.correo')}
          />
        )}
        {mostrarTabInterno && (
          <TabInbox
            activo={tabActivo === 'interno'}
            onClick={() => onCambiarTab('interno')}
            icono={<Hash size={14} />}
            etiqueta={t('inbox.canales.interno')}
          />
        )}
      </div>

      <div className="flex items-center gap-2 py-1.5">
        {/* Sync de correos: solo tab correo. Compacto, con tiempo relativo. */}
        {tabActivo === 'correo' && (
          <button
            type="button"
            onClick={onSincronizarCorreos}
            disabled={sincronizando}
            title={sincronizando ? 'Sincronizando...' : 'Sincronizar correos'}
            className="flex items-center gap-1.5 px-2 py-1 rounded-boton transition-colors cursor-pointer disabled:cursor-default text-xxs"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--texto-terciario)',
            }}
            onMouseEnter={(e) => { if (!sincronizando) e.currentTarget.style.background = 'var(--superficie-hover)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <RefreshCw size={14} className={sincronizando ? 'animate-spin' : ''} />
            {!esMovil && (
              <span className="whitespace-nowrap">
                {sincronizando
                  ? 'Sincronizando...'
                  : ultimoSync
                    ? tiempoDesdeSync(ultimoSync)
                    : 'Sin sincronizar'}
              </span>
            )}
          </button>
        )}

        {/* Toggle vista columna/fila — mismo segmented que el de WhatsApp. */}
        {mostrarToggleVista && (
          <div className="flex items-center border border-borde-sutil rounded-card overflow-hidden">
            <Boton
              variante={modoVista === 'columna' ? 'primario' : 'fantasma'}
              tamano="xs"
              soloIcono
              titulo="Vista columna"
              icono={<Columns2 size={14} />}
              onClick={() => onCambiarModoVista('columna')}
              className="!rounded-none"
            />
            <Boton
              variante={modoVista === 'fila' ? 'primario' : 'fantasma'}
              tamano="xs"
              soloIcono
              titulo="Vista fila"
              icono={<Rows2 size={14} />}
              onClick={() => onCambiarModoVista('fila')}
              className="!rounded-none"
            />
          </div>
        )}

        {/* Configuración. tamano="sm" alineado con el header global y con WhatsApp. */}
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

/** Tab de canal estilo Notion/Linear — clon del TabAudiencia de WhatsApp. */
function TabInbox({
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
      {activo && (
        <span
          className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full"
          style={{ background: 'var(--texto-marca)' }}
        />
      )}
    </button>
  )
}
