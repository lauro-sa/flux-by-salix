/**
 * Resolver de íconos lucide-react para el editor visual de flujos
 * (sub-PR 19.2) y para el header del flujo (incluye los íconos del
 * listado y del catálogo de plantillas + los específicos por tipo de
 * disparador / acción).
 *
 * Patrón explícito: mapa estático en lugar de imports dinámicos por
 * nombre. Razón: tree-shaking real (Next solo trae los íconos que se
 * referencian) y autocompletado fiable en el catálogo.
 *
 * Cuando se agregue un `TipoAccion` o `TipoDisparador` nuevo y necesite
 * un ícono específico, se suma acá. El mapa principal `ICONOS_FLUJO`
 * está abierto a cualquier string para que el editor pueda recibir
 * íconos custom del usuario via `MiniSelectorIcono` (que devuelve
 * cualquier nombre de Lucide).
 */

import {
  AlarmClock,
  ArrowRightCircle,
  ArrowDown,
  Bell,
  BellRing,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit3,
  GitBranch,
  Hourglass,
  Inbox,
  Mail,
  MailCheck,
  MessageSquare,
  MessageSquareText,
  PenLine,
  Phone,
  Play,
  Plus,
  Repeat,
  Send,
  Sparkles,
  StopCircle,
  Tag,
  TagsIcon,
  Timer,
  User,
  UserPlus,
  Users,
  Webhook,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { TipoAccion, TipoDisparador } from '@/tipos/workflow'

// Mapa principal — incluye los íconos de plantillas (compat con
// `iconos-plantilla.tsx` del listado) + íconos visuales adicionales
// que usa el editor.
export const ICONOS_FLUJO: Record<string, LucideIcon> = {
  AlarmClock,
  ArrowRightCircle,
  ArrowDown,
  Bell,
  BellRing,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Edit3,
  GitBranch,
  Hourglass,
  Inbox,
  Mail,
  MailCheck,
  MessageSquare,
  MessageSquareText,
  PenLine,
  Phone,
  Play,
  Plus,
  Repeat,
  Send,
  Sparkles,
  StopCircle,
  Tag,
  Tags: TagsIcon,
  Timer,
  User,
  UserPlus,
  Users,
  Webhook,
  Workflow,
  Zap,
}

/**
 * Resolver tolerante: si la clave no está en el mapa, devuelve
 * `Workflow` como ícono fallback (es el del módulo).
 */
export function iconoLucideFlujo(nombre: string | null | undefined): LucideIcon {
  if (!nombre) return Workflow
  return ICONOS_FLUJO[nombre] ?? Workflow
}

// =============================================================
// Defaults por tipo de disparador / acción
// =============================================================
// Si el flujo todavía no tiene `icono` propio (columna NULL), el
// editor usa estos defaults para decorar la primera tarjeta y las
// opciones del catálogo. Son nombres de claves del mapa `ICONOS_FLUJO`
// para que el resolver los pueda mapear directo.

const ICONO_POR_DISPARADOR: Record<TipoDisparador, string> = {
  'entidad.estado_cambio': 'Repeat',
  'entidad.creada': 'Sparkles',
  'entidad.campo_cambia': 'Edit3',
  'actividad.completada': 'CheckCircle2',
  'tiempo.cron': 'Clock',
  'tiempo.relativo_a_campo': 'Calendar',
  'webhook.entrante': 'Webhook',
  'inbox.mensaje_recibido': 'Inbox',
  'inbox.conversacion_sin_respuesta': 'AlarmClock',
}

const ICONO_POR_ACCION: Record<TipoAccion, string> = {
  enviar_whatsapp_plantilla: 'MessageSquare',
  enviar_whatsapp_texto: 'MessageSquareText',
  enviar_correo_plantilla: 'MailCheck',
  enviar_correo_texto: 'Mail',
  crear_actividad: 'PenLine',
  cambiar_estado_entidad: 'Repeat',
  asignar_usuario: 'UserPlus',
  agregar_etiqueta: 'Tag',
  quitar_etiqueta: 'Tags',
  notificar_usuario: 'Bell',
  notificar_grupo: 'Users',
  crear_orden_trabajo: 'Plus',
  crear_visita: 'Calendar',
  webhook_saliente: 'Webhook',
  esperar: 'Hourglass',
  esperar_evento: 'Timer',
  condicion_branch: 'GitBranch',
  terminar_flujo: 'StopCircle',
}

export function iconoDefaultDisparador(tipo: TipoDisparador): LucideIcon {
  return iconoLucideFlujo(ICONO_POR_DISPARADOR[tipo])
}

export function iconoDefaultAccion(tipo: TipoAccion): LucideIcon {
  return iconoLucideFlujo(ICONO_POR_ACCION[tipo])
}

// Re-export del nombre crudo por si la UI necesita guardarlo en BD
// como `flujos.icono` cuando el usuario "elige el default".
export function nombreIconoDisparador(tipo: TipoDisparador): string {
  return ICONO_POR_DISPARADOR[tipo]
}
export function nombreIconoAccion(tipo: TipoAccion): string {
  return ICONO_POR_ACCION[tipo]
}
