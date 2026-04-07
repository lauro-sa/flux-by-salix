'use client'

/**
 * BarraAcciones — Barra con 4 botones de acción del chatter.
 * Botones: Correo, WhatsApp, Registrar nota, Actividad.
 * Texto neutral por defecto, ícono y fondo se colorean en hover.
 * Se usa en: PanelChatter (parte superior, debajo del header).
 */

import { Mail, StickyNote, CalendarPlus } from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import type { PropsBarraAcciones } from './tipos'

const ICONOS: Record<string, React.ReactNode> = {
  correo: <Mail size={14} />,
  whatsapp: <IconoWhatsApp size={14} />,
  nota: <StickyNote size={14} />,
  actividad: <CalendarPlus size={14} />,
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
  tieneCorreo,
  tieneWhatsApp,
  tieneActividad,
}: PropsBarraAcciones) {
  const acciones: ConfigAccion[] = [
    { clave: 'correo', etiqueta: 'Correo', colorVar: '--canal-correo', onClick: onCorreo, disponible: tieneCorreo },
    { clave: 'whatsapp', etiqueta: 'WhatsApp', colorVar: '--canal-whatsapp', onClick: onWhatsApp, disponible: tieneWhatsApp },
    { clave: 'nota', etiqueta: 'Nota', colorVar: '--insignia-advertencia', onClick: onNota, disponible: true },
    { clave: 'actividad', etiqueta: 'Actividad', colorVar: '--insignia-info', onClick: onActividad, disponible: tieneActividad },
  ]

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-borde-sutil overflow-x-auto scrollbar-none">
      {acciones.map(a => (
        <button
          key={a.clave}
          onClick={a.disponible ? a.onClick : undefined}
          disabled={!a.disponible}
          data-chatter-accion
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 shrink-0 ${
            a.disponible
              ? 'text-texto-secundario cursor-pointer'
              : 'text-texto-terciario/40 cursor-not-allowed'
          }`}
          style={a.disponible ? {
            '--_accion-color': `var(${a.colorVar})`,
          } as React.CSSProperties : undefined}
          title={!a.disponible ? `${a.etiqueta} no configurado` : a.etiqueta}
        >
          {ICONOS[a.clave]}
          <span className="hidden sm:inline">{a.etiqueta}</span>
        </button>
      ))}

      {/* Hover: fondo suave + ícono coloreado */}
      <style>{`
        [data-chatter-accion]:hover {
          background-color: color-mix(in srgb, var(--_accion-color, transparent) 10%, transparent);
          color: var(--_accion-color);
        }
      `}</style>
    </div>
  )
}
