/**
 * Constantes visuales del chatter: íconos, colores y etiquetas por acción.
 * Se usa en: EntradaTimeline para renderizar cada tipo de entrada.
 */

import {
  FileText, ArrowRightLeft, Globe, Eye, CheckCircle2, XCircle,
  CreditCard, Clock, ClipboardList, RotateCcw, Mail, MailOpen,
  Pencil, RefreshCw, CalendarClock, Ban,
} from 'lucide-react'
import { IconoWhatsApp } from '@/componentes/iconos/IconoWhatsApp'
import type { AccionSistema } from '@/tipos/chatter'
import type { ConfigIconoAccion } from './tipos'

export const ICONOS_ACCION: Record<AccionSistema, ConfigIconoAccion> = {
  creado: {
    icono: <FileText size={14} />,
    color: 'bg-texto-marca/10 text-texto-marca',
    etiqueta: 'Creado',
  },
  estado_cambiado: {
    icono: <ArrowRightLeft size={14} />,
    color: 'bg-estado-pendiente/10 text-estado-pendiente',
    etiqueta: 'Cambio de estado',
  },
  portal_enviado: {
    icono: <Globe size={14} />,
    color: 'bg-canal-correo/10 text-canal-correo',
    etiqueta: 'Enviado al portal',
  },
  portal_visto: {
    icono: <Eye size={14} />,
    color: 'bg-insignia-info/10 text-insignia-info',
    etiqueta: 'Visto en portal',
  },
  portal_aceptado: {
    icono: <CheckCircle2 size={14} />,
    color: 'bg-insignia-exito/10 text-insignia-exito',
    etiqueta: 'Aceptado',
  },
  portal_rechazado: {
    icono: <XCircle size={14} />,
    color: 'bg-insignia-peligro/10 text-insignia-peligro',
    etiqueta: 'Rechazado',
  },
  portal_comprobante: {
    icono: <CreditCard size={14} />,
    color: 'bg-insignia-advertencia/10 text-insignia-advertencia',
    etiqueta: 'Comprobante recibido',
  },
  pago_confirmado: {
    icono: <CheckCircle2 size={14} />,
    color: 'bg-insignia-exito/10 text-insignia-exito',
    etiqueta: 'Pago confirmado',
  },
  pago_rechazado: {
    icono: <XCircle size={14} />,
    color: 'bg-insignia-peligro/10 text-insignia-peligro',
    etiqueta: 'Pago rechazado',
  },
  pdf_generado: {
    icono: <FileText size={14} />,
    color: 'bg-texto-terciario/10 text-texto-terciario',
    etiqueta: 'PDF generado',
  },
  campo_editado: {
    icono: <Pencil size={14} />,
    color: 'bg-texto-terciario/10 text-texto-terciario',
    etiqueta: 'Campo editado',
  },
  actividad_creada: {
    icono: <ClipboardList size={14} />,
    color: 'bg-insignia-info/10 text-insignia-info',
    etiqueta: 'Actividad creada',
  },
  actividad_completada: {
    icono: <CheckCircle2 size={14} />,
    color: 'bg-insignia-exito/10 text-insignia-exito',
    etiqueta: 'Actividad completada',
  },
  actividad_pospuesta: {
    icono: <CalendarClock size={14} />,
    color: 'bg-insignia-advertencia/10 text-insignia-advertencia',
    etiqueta: 'Actividad pospuesta',
  },
  actividad_cancelada: {
    icono: <Ban size={14} />,
    color: 'bg-insignia-peligro/10 text-insignia-peligro',
    etiqueta: 'Actividad cancelada',
  },
  actividad_reactivada: {
    icono: <RotateCcw size={14} />,
    color: 'bg-insignia-advertencia/10 text-insignia-advertencia',
    etiqueta: 'Actividad reactivada',
  },
  correo_enviado: {
    icono: <Mail size={14} />,
    color: 'bg-canal-correo/10 text-canal-correo',
    etiqueta: 'Correo enviado',
  },
  correo_recibido: {
    icono: <MailOpen size={14} />,
    color: 'bg-canal-correo/10 text-canal-correo',
    etiqueta: 'Correo recibido',
  },
  whatsapp_enviado: {
    icono: <IconoWhatsApp size={14} />,
    color: 'bg-canal-whatsapp/10 text-canal-whatsapp',
    etiqueta: 'WhatsApp enviado',
  },
  re_emision: {
    icono: <RefreshCw size={14} />,
    color: 'bg-insignia-info/10 text-insignia-info',
    etiqueta: 'Re-emitido',
  },
}

// Nombres de días para "el martes", "el jueves", etc.
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

// Formatear hora según config de empresa (24h o 12h)
function formatearHora(d: Date, formato: string = '24h'): string {
  if (formato === '12h') {
    const h = d.getHours() % 12 || 12
    const m = String(d.getMinutes()).padStart(2, '0')
    const ampm = d.getHours() < 12 ? 'AM' : 'PM'
    return `${h}:${m} ${ampm}`
  }
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Formatear fecha contextual:
// Hoy → "14:30"
// Ayer → "Ayer 14:30"
// Esta semana → "Martes 14:30"
// Más de una semana → "21 mar 14:30" (o con año si no es el actual)
export function fechaRelativa(fecha: string, formatoHora: string = '24h', locale: string = 'es-AR'): string {
  const ahora = new Date()
  const d = new Date(fecha)

  const hoyInicio = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const fechaInicio = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diasDiff = Math.floor((hoyInicio.getTime() - fechaInicio.getTime()) / 86400000)

  const hora = formatearHora(d, formatoHora)

  if (diasDiff === 0) return hora
  if (diasDiff === 1) return `Ayer ${hora}`
  if (diasDiff < 7) {
    const dia = DIAS[d.getDay()]
    return `${dia.charAt(0).toUpperCase() + dia.slice(1)} ${hora}`
  }

  const mismoAnio = d.getFullYear() === ahora.getFullYear()
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(mismoAnio ? {} : { year: 'numeric' }),
  }) + ` ${hora}`
}

// Formatear texto con sintaxis de WhatsApp (*negrita*, _itálica_, ~tachado~, ```mono```)
export function formatearTextoWA(texto: string): string {
  let html = texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  html = html.replace(/```([\s\S]*?)```/g, '<code style="background:var(--superficie-hover);padding:1px 4px;border-radius:3px;font-size:12px">$1</code>')
  html = html.replace(/\*(.*?)\*/g, '<strong>$1</strong>')
  html = html.replace(/_(.*?)_/g, '<em>$1</em>')
  html = html.replace(/~(.*?)~/g, '<del>$1</del>')

  return html
}

// Formatear fecha completa para tooltip
export function fechaCompleta(fecha: string, formatoHora: string = '24h', locale: string = 'es-AR'): string {
  const d = new Date(fecha)
  const fechaParte = d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
  return `${fechaParte} ${formatearHora(d, formatoHora)}`
}
