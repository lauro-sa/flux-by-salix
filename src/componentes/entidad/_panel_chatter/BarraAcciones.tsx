'use client'

/**
 * BarraAcciones — Chips de acción del chatter.
 * Cada chip tiene borde sutil + ícono coloreado permanente para que se
 * lea como botón a primera vista (también en mobile sin hover).
 * Se usa en: PanelChatter (parte superior, debajo del header).
 */

import { Mail, StickyNote, Zap, MapPin, CreditCard } from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import type { PropsBarraAcciones } from './tipos'

const ICONOS: Record<string, React.ReactNode> = {
  correo: <Mail size={14} />,
  whatsapp: <IconoWhatsApp size={14} />,
  nota: <StickyNote size={14} />,
  actividad: <Zap size={14} />,
  visita: <MapPin size={14} />,
  pago: <CreditCard size={14} />,
}

interface ConfigAccion {
  clave: string
  etiqueta: string
  colorVar: string
  onClick?: () => void
  disponible: boolean
}

export function BarraAcciones({
  onCorreo,
  onWhatsApp,
  onNota,
  onActividad,
  onVisita,
  onPago,
  tieneCorreo,
  tieneWhatsApp,
  tieneActividad,
  tieneVisita = false,
  tienePago = false,
}: PropsBarraAcciones) {
  const acciones: ConfigAccion[] = [
    { clave: 'correo', etiqueta: 'Correo', colorVar: '--canal-correo', onClick: onCorreo, disponible: tieneCorreo },
    { clave: 'whatsapp', etiqueta: 'WhatsApp', colorVar: '--canal-whatsapp', onClick: onWhatsApp, disponible: tieneWhatsApp },
    { clave: 'nota', etiqueta: 'Nota', colorVar: '--insignia-advertencia', onClick: onNota, disponible: true },
    { clave: 'actividad', etiqueta: 'Actividad', colorVar: '--insignia-info', onClick: onActividad, disponible: tieneActividad },
    ...(tieneVisita ? [{ clave: 'visita', etiqueta: 'Visita', colorVar: '--texto-marca', onClick: onVisita, disponible: true }] : []),
    ...(tienePago ? [{ clave: 'pago', etiqueta: 'Pago', colorVar: '--insignia-exito', onClick: onPago, disponible: true }] : []),
  ]

  return (
    <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-borde-sutil overflow-x-auto scrollbar-none">
      {acciones.map(a => (
        <button
          key={a.clave}
          onClick={a.disponible ? a.onClick : undefined}
          disabled={!a.disponible}
          data-chatter-accion
          className={`group flex items-center gap-1.5 px-2.5 py-1.5 rounded-card text-xs font-medium border transition-all duration-150 shrink-0 ${
            a.disponible
              ? 'text-texto-primario border-borde-sutil bg-superficie-app/60 cursor-pointer'
              : 'text-texto-terciario/40 border-borde-sutil/50 cursor-not-allowed'
          }`}
          style={a.disponible ? {
            '--_accion-color': `var(${a.colorVar})`,
          } as React.CSSProperties : undefined}
          title={!a.disponible ? `${a.etiqueta} no configurado` : a.etiqueta}
        >
          <span
            className="shrink-0"
            style={a.disponible ? { color: `var(${a.colorVar})` } : undefined}
          >
            {ICONOS[a.clave]}
          </span>
          <span className="hidden sm:inline">{a.etiqueta}</span>
        </button>
      ))}

      {/* Hover: borde y fondo del color del canal, texto coloreado */}
      <style>{`
        [data-chatter-accion]:not(:disabled):hover {
          background-color: color-mix(in srgb, var(--_accion-color, transparent) 12%, transparent);
          border-color: color-mix(in srgb, var(--_accion-color, transparent) 35%, transparent);
          color: var(--_accion-color);
        }
      `}</style>
    </div>
  )
}
