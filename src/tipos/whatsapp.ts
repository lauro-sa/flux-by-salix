/**
 * Tipos específicos del módulo WhatsApp.
 * Se movieron aquí desde tipos/inbox.ts para mantener modularidad —
 * estos tipos no deben vivir en inbox, porque el módulo inbox (correo)
 * puede instalarse sin WhatsApp.
 */

import type { TipoContenido } from './inbox'

// ─── WhatsApp programado ───

export type EstadoProgramadoWA = 'pendiente' | 'enviado' | 'cancelado' | 'error'

export interface WhatsAppProgramado {
  id: string
  empresa_id: string
  canal_id: string
  conversacion_id: string | null
  creado_por: string
  destinatario: string
  tipo_contenido: TipoContenido
  texto: string | null
  media_url: string | null
  media_nombre: string | null
  plantilla_nombre: string | null
  plantilla_idioma: string | null
  plantilla_componentes: Record<string, unknown> | null
  enviar_en: string
  estado: EstadoProgramadoWA
  enviado_en: string | null
  wa_message_id: string | null
  error: string | null
  creado_en: string
}

// ─── Plantillas de WhatsApp (Meta Business Templates) ───

export type CategoriaPlantillaWA = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
export type IdiomaPlantillaWA = 'es' | 'es_AR' | 'es_MX' | 'en' | 'en_US' | 'pt_BR' | 'fr' | 'it' | 'de'
export type EstadoMeta = 'BORRADOR' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED' | 'PAUSED' | 'ERROR'
export type TipoEncabezadoWA = 'NONE' | 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
export type TipoBotonWA = 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER'

export interface EncabezadoPlantillaWA {
  tipo: TipoEncabezadoWA
  texto?: string
  ejemplo?: string
}

export interface CuerpoPlantillaWA {
  texto: string
  ejemplos?: string[]
  mapeo_variables?: string[]
}

export interface PiePaginaPlantillaWA {
  texto: string
}

export interface BotonPlantillaWA {
  tipo: TipoBotonWA
  texto: string
  url?: string
  telefono?: string
}

export interface ComponentesPlantillaWA {
  encabezado?: EncabezadoPlantillaWA
  cuerpo: CuerpoPlantillaWA
  pie_pagina?: PiePaginaPlantillaWA
  botones?: BotonPlantillaWA[]
}

export interface PlantillaWhatsApp {
  id: string
  empresa_id: string
  canal_id: string | null
  nombre: string
  nombre_api: string
  categoria: CategoriaPlantillaWA
  idioma: IdiomaPlantillaWA
  componentes: ComponentesPlantillaWA
  estado_meta: EstadoMeta
  id_template_meta: string | null
  error_meta: string | null
  ultima_sincronizacion: string | null
  modulos: string[]
  es_por_defecto: boolean
  disponible_para: 'todos' | 'roles' | 'usuarios'
  roles_permitidos: string[]
  usuarios_permitidos: string[]
  activo: boolean
  orden: number
  creado_por: string | null
  creado_por_nombre?: string | null
  editado_por?: string | null
  editado_por_nombre?: string | null
  creado_en: string
  actualizado_en: string
}
