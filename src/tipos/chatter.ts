/**
 * Tipos del sistema de chatter de Flux.
 * Se usa en: PanelChatter, API chatter, eventos automáticos.
 * Diseño polimórfico: vincula a cualquier entidad (presupuesto, contacto, orden, etc.)
 */

// ─── Tipos de entrada ───
export type TipoChatter = 'mensaje' | 'sistema' | 'nota_interna' | 'correo' | 'whatsapp' | 'visita'

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
  | 'pago_restaurado'
  | 'pdf_generado'
  | 'campo_editado'
  | 'actividad_creada'
  | 'actividad_completada'
  | 'actividad_pospuesta'
  | 'actividad_cancelada'
  | 'actividad_reactivada'
  // Órdenes de trabajo
  | 'cambio_estado'
  | 'orden_trabajo_generada'
  | 'publicar'
  | 'despublicar'
  | 'tarea_completada'
  | 'tarea_cancelada'
  // Galerías de OT (relevamiento sembrado desde visita + bitácora de obra)
  | 'relevamiento_sembrado'
  | 'relevamiento_resincronizado'
  | 'bitacora_creada'
  | 'bitacora_editada'
  // Correo
  | 'correo_enviado'
  | 'correo_recibido'
  // WhatsApp (solo enviados — las respuestas viven en el inbox, no se vinculan al documento)
  | 'whatsapp_enviado'
  // Re-emisión
  | 're_emision'
  // Visitas
  | 'visita_completada'

// ─── Adjunto ───
export interface AdjuntoChatter {
  /** URL del archivo. Vacío cuando el archivo vive en un bucket privado y se
   *  resuelve on-demand a través de `endpoint_descarga`. */
  url: string
  nombre: string
  tipo: string // MIME type
  tamano?: number // bytes
  /** Endpoint REST que retorna `{ url }` con una signed URL de corta duración.
   *  Usado para adjuntos en buckets privados (ej. comprobantes de pago) que
   *  no se sirven con URL pública. Si está presente, el frontend debe
   *  fetchear desde acá en lugar de usar `url`. */
  endpoint_descarga?: string
}

// ─── Sub-tipo de entrada — separa chatter "general" de las galerías ───
// Solo se usa en chatter de entidad_tipo='orden_trabajo' (por ahora).
// Las entradas sin subtipo viven en el timeline general (PanelChatter).
// Las entradas con subtipo viven en su propia sección dedicada y NO aparecen
// en el timeline para no duplicar la galería como "ruido".
//   - 'relevamiento': fotos/comentarios sembrados desde la visita de origen.
//     Editables por admin/creador/cabecilla con permiso editar.
//   - 'bitacora': fotos/notas que el cabecilla/asignados suben durante la obra.
//     Cada autor edita/borra lo suyo; admin/creador tocan todo.
export type SubtipoChatter = 'relevamiento' | 'bitacora'

// ─── Metadata de evento de sistema ───
export interface MetadataChatter {
  accion?: AccionSistema
  detalles?: Record<string, unknown>
  /** Sub-tipo para entradas de OT que viven en una galería dedicada en lugar
   *  del timeline general del chatter. Ver SubtipoChatter para la semántica. */
  subtipo?: SubtipoChatter
  /** Cuando subtipo='relevamiento' y el adjunto/comentario provino de un
   *  chatter de visita, guardamos el id original para detectar duplicados al
   *  re-sincronizar (no pisamos lo ya copiado). */
  origen_chatter_id?: string
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
  tipo_etiqueta?: string
  tipo_color?: string
  prioridad?: string
  fecha_vencimiento?: string | null
  asignados?: { id: string; nombre: string }[]
  descripcion?: string | null
  // Para tareas de órdenes de trabajo
  tarea_id?: string
  // Para órdenes de trabajo
  presupuesto_id?: string
  presupuesto_numero?: string
  orden_trabajo_id?: string
  orden_trabajo_numero?: string
  // Para visitas
  visita_id?: string
  estado?: string
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
  /** Otras entidades donde también está registrada esta entrada (chips "También en:") */
  relacionado_con?: { tipo: string; id: string; nombre: string }[]
  // Para WhatsApp
  whatsapp_numero?: string
  whatsapp_destinatario?: string
  whatsapp_plantilla?: string
  whatsapp_botones?: { tipo: string; texto: string; url?: string }[]
  wa_message_id?: string
  wa_status?: 'sent' | 'delivered' | 'read' | 'failed'
  // Para visitas completadas
  visita_resultado?: string
  visita_temperatura?: string
  visita_notas?: string
  visita_checklist?: { id: string; texto: string; completado: boolean }[]
  visita_direccion?: string
  visita_duracion_real?: number
  visita_duracion_estimada?: number
  visita_fecha_completada?: string
  visita_fecha_programada?: string
  visita_motivo?: string
  visita_contacto_nombre?: string
  visita_contacto_id?: string
  visita_registro_lat?: number
  visita_registro_lng?: number
  visita_registro_precision?: number
  // Para notas ricas
  contenido_html?: string
  // Para menciones
  menciones?: string[]
  /** Fecha real del evento cuando difiere de `creado_en` (ej. un pago
   *  cargado hoy pero con fecha_pago anterior). El timeline ordena por
   *  este campo si está presente. */
  fecha_evento?: string
  // Para pagos (extras para render específico)
  pago_id?: string
  pago_metodo?: string
  pago_moneda?: string
  pago_fecha?: string
  /** Número de cuota al que se imputa (1-indexed). Null = a cuenta. */
  cuota_numero?: number | null
  /** Total de cuotas del plan de pago (para mostrar "N de M"). */
  cuotas_total?: number | null
  /** Descripción de la cuota (ej: "Adelanto", "Al finalizar"). */
  cuota_descripcion?: string | null
  /** true = la entrada corresponde a un adicional fuera del presupuesto. */
  es_adicional?: boolean
  /** Concepto del adicional (ej: "Trabajo extra de electricidad"). */
  concepto_adicional?: string
  /** Monto de percepciones cobradas dentro del pago (string para preservar precisión). */
  monto_percepciones?: string
  /** Nombre de quien editó el pago por última vez (para mostrar "editado por X"). */
  editado_por_nombre?: string
  /** Cuándo se editó por última vez (timestamptz ISO). */
  editado_en?: string
  /** ID de la entrada de chatter que originó este pago (correo/WA/mensaje
   *  desde donde se hizo "Registrar como pago"). El frontend lo usa para
   *  cruzar contra la entrada original y mostrar chips bidireccionales. */
  mensaje_origen_chatter_id?: string
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
export type FiltroChatter = 'todo' | 'correos' | 'whatsapp' | 'notas' | 'visitas' | 'sistema' | 'pagos'
