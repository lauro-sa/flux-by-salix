/**
 * Constantes visuales del chatter: íconos, colores y etiquetas por acción.
 * Se usa en: EntradaTimeline para renderizar cada tipo de entrada.
 */

import {
  FileText, ArrowRightLeft, Globe, Eye, CheckCircle2, XCircle,
  CreditCard, Clock, ClipboardList, RotateCcw, Mail, MailOpen,
  Pencil,
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
}

// Formatear fecha relativa
export function fechaRelativa(fecha: string): string {
  const ahora = new Date()
  const d = new Date(fecha)
  const diff = ahora.getTime() - d.getTime()
  const minutos = Math.floor(diff / 60000)
  const horas = Math.floor(diff / 3600000)
  const dias = Math.floor(diff / 86400000)

  if (minutos < 1) return 'Ahora'
  if (minutos < 60) return `Hace ${minutos}m`
  if (horas < 24) return `Hace ${horas}h`
  if (dias < 7) return `Hace ${dias}d`
  return d.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: dias > 365 ? 'numeric' : undefined,
  })
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
export function fechaCompleta(fecha: string): string {
  return new Date(fecha).toLocaleString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
