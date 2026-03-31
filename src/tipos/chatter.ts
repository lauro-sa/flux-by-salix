/**
 * Tipos del sistema de chatter de Flux.
 * Se usa en: PanelChatter, API chatter, eventos automáticos.
 * Diseño polimórfico: vincula a cualquier entidad (presupuesto, contacto, orden, etc.)
 */

// ─── Tipos de entrada ───
export type TipoChatter = 'mensaje' | 'sistema' | 'nota_interna'

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
  // Para comprobantes
  cuota_id?: string
  descripcion_pago?: string
  monto_pago?: string
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
