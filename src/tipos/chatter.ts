/**
 * Tipos del sistema de chatter de Flux.
 * Se usa en: PanelChatter, API chatter, eventos automáticos.
 * Diseño polimórfico: vincula a cualquier entidad (presupuesto, contacto, orden, etc.)
 */

// ─── Tipos de entrada ───
export type TipoChatter = 'mensaje' | 'sistema' | 'nota_interna' | 'correo' | 'whatsapp'

// ─── Acciones de sistema predefinidas ───
export type AccionSistema =
  | 'creado'
  | 'estado_cambiado'
  | 'portal_enviado'
  | 'portal_visto'
  | 'portal_aceptado'
  | 'portal_rechazado'
  | 'portal_comprobante'
  | 'pago_confirmado'
  | 'pago_rechazado'
  | 'pdf_generado'
  | 'campo_editado'
  | 'actividad_creada'
  | 'actividad_completada'
  | 'actividad_pospuesta'
  | 'actividad_cancelada'
  | 'actividad_reactivada'
  // Correo
  | 'correo_enviado'
  | 'correo_recibido'
  // WhatsApp (solo enviados — las respuestas viven en el inbox, no se vinculan al documento)
  | 'whatsapp_enviado'
  // Re-emisión
  | 're_emision'

// ─── Adjunto ───
export interface AdjuntoChatter {
  url: string
  nombre: string
  tipo: string // MIME type
  tamano?: number // bytes
}

// ─── Metadata de evento de sistema ───
export interface MetadataChatter {
  accion?: AccionSistema
  detalles?: Record<string, unknown>
  // Para cambios de estado
  estado_anterior?: string
  estado_nuevo?: string
  // Para portal
  portal?: boolean
  token?: string
  firma_nombre?: string
  firma_ip?: string
  firma_modo?: string
  // Para actividades
  actividad_id?: string
  tipo_actividad?: string
  titulo?: string
  vinculos_relacionados?: { tipo: string; id: string; nombre: string }[]
  // Para comprobantes
  cuota_id?: string
  descripcion_pago?: string
  monto_pago?: string
  // Para correos
  correo_asunto?: string
  correo_destinatario?: string
  correo_cc?: string
  correo_cco?: string
  correo_de?: string
  correo_message_id?: string
  correo_html?: string
  // Para WhatsApp
  whatsapp_numero?: string
  whatsapp_destinatario?: string
  whatsapp_plantilla?: string
  whatsapp_botones?: { tipo: string; texto: string; url?: string }[]
  wa_message_id?: string
  wa_status?: 'sent' | 'delivered' | 'read' | 'failed'
  // Para notas ricas
  contenido_html?: string
  // Para menciones
  menciones?: string[]
}

// ─── Entrada de chatter ───
export interface EntradaChatter {
  id: string
  empresa_id: string
  entidad_tipo: string
  entidad_id: string
  tipo: TipoChatter
  contenido: string
  autor_id: string | null
  autor_nombre: string
  autor_avatar_url: string | null
  adjuntos: AdjuntoChatter[]
  metadata: MetadataChatter
  creado_en: string
  editado_en: string | null
}

// ─── Payload para crear entrada ───
export interface CrearEntradaChatterPayload {
  entidad_tipo: string
  entidad_id: string
  tipo?: TipoChatter
  contenido: string
  adjuntos?: AdjuntoChatter[]
  metadata?: MetadataChatter
}

// ─── Filtros del chatter ───
export type FiltroChatter = 'todo' | 'correos' | 'whatsapp' | 'notas' | 'sistema'
