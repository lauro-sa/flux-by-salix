/**
 * Tipos del módulo Inbox de Flux.
 * Se usa en: inbox (WhatsApp, Email, Interno), configuración, API routes, notificaciones.
 */

// ─── Módulos activos por empresa ───

export interface ModuloEmpresa {
  id: string
  empresa_id: string
  modulo: string
  activo: boolean
  activado_en: string | null
  desactivado_en: string | null
  config: Record<string, unknown>
}

export type ModuloInbox = 'inbox_whatsapp' | 'inbox_correo' | 'inbox_interno'

// ─── Vistas móviles por canal ───
export type VistaMovilWA = 'lista' | 'chat' | 'info'
export type VistaMovilCorreo = 'sidebar' | 'lista' | 'correo'
export type VistaMovilInterno = 'canales' | 'chat'

// ─── Canales de inbox ───

export type TipoCanal = 'whatsapp' | 'correo' | 'interno'

export type ProveedorCanal =
  | 'meta_api'        // WhatsApp Meta Business API
  | 'twilio'          // WhatsApp Twilio
  | 'imap'            // Correo IMAP/SMTP
  | 'gmail_oauth'     // Correo Gmail OAuth
  | 'outlook_oauth'   // Correo Microsoft 365 / Outlook
  | null               // Interno (sin proveedor externo)

export type EstadoConexion = 'conectado' | 'desconectado' | 'error' | 'reconectando'

export interface CanalMensajeria {
  id: string
  empresa_id: string
  tipo: TipoCanal
  nombre: string
  proveedor: ProveedorCanal
  activo: boolean
  config_conexion: Record<string, unknown>
  estado_conexion: EstadoConexion
  ultimo_error: string | null
  ultima_sincronizacion: string | null
  modulos_disponibles: string[]
  es_principal: boolean
  creado_por: string
  creado_en: string
  actualizado_en: string
}

export interface CanalAgenteAsignado {
  canal_id: string
  usuario_id: string
  rol_canal: 'admin' | 'agente'
  asignado_en: string
  // JOINs
  nombre?: string
  apellido?: string
  avatar_url?: string | null
}

// Regla de correo predeterminado por tipo de contacto
export interface CorreoPorTipoContacto {
  id: string
  empresa_id: string
  tipo_contacto_id: string
  canal_id: string
  creado_en: string
  // JOINs opcionales
  tipo_contacto_etiqueta?: string
  tipo_contacto_icono?: string
  canal_nombre?: string
  canal_email?: string
}

// ─── Config IMAP ───

export interface ConfigIMAP {
  host: string
  puerto: number
  usuario: string
  password_cifrada: string
  ssl: boolean
  smtp_host?: string
  smtp_puerto?: number
}

// ─── Config Gmail OAuth ───

export interface ConfigGmailOAuth {
  email: string
  refresh_token: string
  access_token: string
  token_expira_en: string
}

// ─── Config WhatsApp Meta API ───

export interface ConfigWhatsAppMeta {
  phone_number_id: string
  access_token: string
  waba_id: string
  verify_token: string
  numero_telefono: string
}

// ─── Config WhatsApp Twilio ───

export interface ConfigWhatsAppTwilio {
  account_sid: string
  auth_token: string
  from_number: string
}

// ─── Conversaciones ───

export type EstadoConversacion = 'abierta' | 'en_espera' | 'resuelta' | 'spam' | 'snooze'
export type PrioridadConversacion = 'baja' | 'normal' | 'alta' | 'urgente'

export interface Conversacion {
  id: string
  empresa_id: string
  canal_id: string
  tipo_canal: TipoCanal
  identificador_externo: string | null
  hilo_externo_id: string | null
  contacto_id: string | null
  contacto_nombre: string | null
  estado: EstadoConversacion
  prioridad: PrioridadConversacion
  asignado_a: string | null
  asignado_a_nombre: string | null
  asunto: string | null
  canal_interno_id: string | null
  ultimo_mensaje_texto: string | null
  ultimo_mensaje_en: string | null
  ultimo_mensaje_es_entrante: boolean
  mensajes_sin_leer: number
  primera_respuesta_en: string | null
  tiempo_sin_respuesta_desde: string | null
  etiquetas: string[]
  resumen_ia: string | null
  sentimiento: string | null
  idioma_detectado: string | null
  creado_en: string
  actualizado_en: string
  cerrado_en: string | null
  cerrado_por: string | null
  // Pipeline
  etapa_id: string | null
  etapa_etiqueta?: string | null
  etapa_color?: string | null
  // Sector asignado
  sector_id: string | null
  sector_nombre: string | null
  sector_color: string | null
  // Bloqueo, pipeline, papelera
  bloqueada: boolean
  en_pipeline: boolean
  en_papelera: boolean
  papelera_en: string | null
  // Bot / IA
  chatbot_activo: boolean
  agente_ia_activo: boolean
  chatbot_pausado_hasta: string | null
  ia_pausado_hasta: string | null
  // Snooze / recordatorio
  snooze_hasta: string | null
  snooze_nota: string | null
  snooze_por: string | null
}

/** Flags per-user que vienen del JOIN con pins/silencios/seguidores */
export interface FlagsUsuarioConversacion {
  _fijada?: boolean
  _silenciada?: boolean
  _seguida?: boolean
}

/** Estados de bot y agente IA */
export type EstadoBot = 'activo' | 'pausado_1h' | 'pausado_24h' | 'inactivo'
export type EstadoAgente = 'activo' | 'pausado_1h' | 'pausado_8h' | 'inactivo'

/** Requisito de validación para una etapa del pipeline */
export type CampoRequisito = 'contacto_vinculado' | 'agente_asignado' | 'sector' | 'direccion' | 'email' | 'telefono'

export interface RequisitoEtapa {
  campo: CampoRequisito
  estricto: boolean // true = bloquea, false = solo advierte
}

export interface AccionAutoEtapa {
  tipo: 'crear_actividad' | 'crear_visita' | 'crear_presupuesto' | 'pedir_motivo'
  config?: Record<string, unknown>
}

/** Conversación con datos expandidos para la lista */
export interface ConversacionConDetalles extends Conversacion, FlagsUsuarioConversacion {
  canal?: CanalMensajeria
  contacto?: {
    id: string
    nombre?: string
    apellido?: string | null
    correo?: string | null
    telefono?: string | null
    whatsapp?: string | null
    avatar_url?: string | null
    es_provisorio?: boolean
  } | null
}

// ─── Mensajes ───

export type TipoContenido =
  | 'texto'
  | 'imagen'
  | 'audio'
  | 'video'
  | 'documento'
  | 'sticker'
  | 'ubicacion'
  | 'contacto_compartido'
  | 'email_html'

export type TipoRemitente = 'contacto' | 'agente' | 'sistema' | 'bot'

export type EstadoMensaje = 'enviado' | 'entregado' | 'leido' | 'fallido' | 'eliminado'

export interface Mensaje {
  id: string
  empresa_id: string
  conversacion_id: string
  es_entrante: boolean
  remitente_tipo: TipoRemitente
  remitente_id: string | null
  remitente_nombre: string | null
  tipo_contenido: TipoContenido
  texto: string | null
  html: string | null

  // Correo
  correo_de: string | null
  correo_para: string[] | null
  correo_cc: string[] | null
  correo_cco: string[] | null
  correo_asunto: string | null
  correo_message_id: string | null
  correo_in_reply_to: string | null
  correo_references: string[] | null

  // WhatsApp
  wa_message_id: string | null
  wa_status: string | null
  wa_tipo_mensaje: string | null

  // Hilos internos
  respuesta_a_id: string | null
  hilo_raiz_id: string | null
  cantidad_respuestas: number

  // Reacciones
  reacciones: Record<string, string[]>

  // Notas internas (solo visibles para agentes)
  es_nota_interna: boolean

  metadata: Record<string, unknown>
  estado: EstadoMensaje
  error_envio: string | null
  plantilla_id: string | null
  creado_en: string
  editado_en: string | null
  eliminado_en: string | null
}

/** Mensaje con adjuntos cargados */
export interface MensajeConAdjuntos extends Mensaje {
  adjuntos: MensajeAdjunto[]
  // Para hilos
  respuestas?: Mensaje[]
}

// ─── Adjuntos ───

export interface MensajeAdjunto {
  id: string
  mensaje_id: string
  empresa_id: string
  nombre_archivo: string
  tipo_mime: string
  tamano_bytes: number | null
  url: string
  storage_path: string
  miniatura_url: string | null
  duracion_segundos: number | null
  es_sticker: boolean
  es_animado: boolean
  creado_en: string
}

// ─── Canales internos (estilo Slack) ───

export type TipoCanalInterno = 'publico' | 'privado' | 'directo' | 'grupo'

export interface CanalInterno {
  id: string
  empresa_id: string
  nombre: string
  descripcion: string | null
  tipo: TipoCanalInterno
  icono: string | null
  color: string | null
  participantes_dm: string[] | null
  archivado: boolean
  ultimo_mensaje_texto: string | null
  ultimo_mensaje_en: string | null
  ultimo_mensaje_por: string | null
  creado_por: string
  creado_en: string
  actualizado_en: string
  /** Estado de silenciado para el usuario actual (viene del JOIN con canal_interno_miembros) */
  silenciado?: boolean
}

/** Lectura de un mensaje (read receipt) */
export interface MensajeLectura {
  mensaje_id: string
  usuario_id: string
  nombre?: string
  apellido?: string
  leido_en: string
}

export interface CanalInternoMiembro {
  canal_id: string
  usuario_id: string
  rol: 'admin' | 'miembro'
  silenciado: boolean
  ultimo_leido_en: string | null
  unido_en: string
  // JOINs
  nombre?: string
  apellido?: string
  avatar_url?: string | null
}

// ─── Plantillas de respuesta rápida ───

export interface VariablePlantilla {
  clave: string
  etiqueta: string
  origen: string // 'contacto.nombre', 'empresa.nombre', etc.
}

export interface PlantillaRespuesta {
  id: string
  empresa_id: string
  nombre: string
  categoria: string | null
  canal: TipoCanal | 'todos'
  asunto: string | null
  contenido: string
  contenido_html: string | null
  variables: VariablePlantilla[]
  modulos: string[]
  disponible_para: 'todos' | 'roles' | 'usuarios'
  roles_permitidos: string[]
  usuarios_permitidos: string[]
  activo: boolean
  orden: number
  // Auditoría
  creado_por: string
  creado_por_nombre?: string | null
  editado_por?: string | null
  editado_por_nombre?: string | null
  creado_en: string
  actualizado_en: string
  // Plantillas de sistema
  es_sistema?: boolean
  clave_sistema?: string | null
  contenido_original_html?: string | null
  asunto_original?: string | null
}

// ─── Asignaciones ───

export type TipoAsignacion = 'manual' | 'automatica' | 'transferencia'

export interface AsignacionInbox {
  id: string
  empresa_id: string
  conversacion_id: string
  usuario_id: string
  usuario_nombre: string | null
  tipo: TipoAsignacion
  asignado_por: string | null
  asignado_por_nombre: string | null
  notas: string | null
  asignado_en: string
  desasignado_en: string | null
}

// ─── Configuración del inbox ───

export interface HorarioAtencion {
  inicio: string // "09:00"
  fin: string    // "18:00"
}

export interface ConfigMensajeria {
  empresa_id: string
  asignacion_automatica: boolean
  algoritmo_asignacion: 'round_robin' | 'por_carga' | 'manual'
  sla_primera_respuesta_minutos: number | null
  sla_resolucion_horas: number | null
  horario_atencion: Record<string, HorarioAtencion>
  zona_horaria: string
  respuesta_fuera_horario: boolean
  mensaje_fuera_horario: string | null
  notificar_nuevo_mensaje: boolean
  notificar_asignacion: boolean
  notificar_sla_vencido: boolean
  sonido_notificacion: boolean
  // IA por empresa
  ia_habilitada: boolean
  ia_proveedor: 'anthropic' | 'openai'
  ia_api_key_cifrada: string | null
  ia_modelo: string
  actualizado_en: string
}

// ─── Notificaciones ───

export type TipoNotificacion =
  | 'nuevo_mensaje'
  | 'asignacion'
  | 'mencion'
  | 'sla_vencido'
  | 'actividad'

export interface Notificacion {
  id: string
  empresa_id: string
  usuario_id: string
  tipo: TipoNotificacion
  titulo: string
  cuerpo: string | null
  icono: string | null
  color: string | null
  url: string | null
  leida: boolean
  referencia_tipo: string | null
  referencia_id: string | null
  creada_en: string
}

// ─── Suscripciones push (PWA) ───

export interface SuscripcionPush {
  id: string
  usuario_id: string
  empresa_id: string
  endpoint: string          // Token FCM (antes era web-push endpoint)
  p256dh: string            // 'fcm' para tokens FCM, clave pública para legacy web-push
  auth: string              // 'fcm' para tokens FCM, clave auth para legacy web-push
  user_agent: string | null
  activa: boolean
  creada_en: string
  ultima_notificacion_en: string | null
}

// ─── Filtros y payloads para API ───

export interface FiltrosConversacion {
  tipo_canal?: TipoCanal
  estado?: EstadoConversacion
  asignado_a?: string | 'sin_asignar'
  prioridad?: PrioridadConversacion
  canal_id?: string
  busqueda?: string
  etiqueta?: string
  contacto_id?: string
}

export interface CrearMensajePayload {
  conversacion_id: string
  tipo_contenido: TipoContenido
  texto?: string
  html?: string
  // Correo
  correo_para?: string[]
  correo_cc?: string[]
  correo_cco?: string[]
  correo_asunto?: string
  // Plantilla
  plantilla_id?: string
  // Hilo interno
  respuesta_a_id?: string
  // Nota interna
  es_nota_interna?: boolean
}

export interface CrearCanalPayload {
  tipo: TipoCanal
  nombre: string
  proveedor?: ProveedorCanal
  config_conexion?: Record<string, unknown>
}

export interface CrearCanalInternoPayload {
  nombre: string
  descripcion?: string
  tipo: TipoCanalInterno
  icono?: string
  color?: string
  miembros?: string[] // usuario_ids
  sector_ids?: string[] // se expanden a usuario_ids al crear
}

export interface CrearPlantillaPayload {
  nombre: string
  categoria?: string
  canal: TipoCanal | 'todos'
  asunto?: string
  contenido: string
  contenido_html?: string
  variables?: VariablePlantilla[]
  modulos?: string[]
  disponible_para?: 'todos' | 'roles' | 'usuarios'
  roles_permitidos?: string[]
  usuarios_permitidos?: string[]
}

// ─── Etiquetas de correo ───

export interface EtiquetaInbox {
  id: string
  empresa_id: string
  nombre: string
  color: string
  icono: string | null
  orden: number
  es_default: boolean
  clave_default: string | null
  creado_en: string
}

/** @deprecated Usar EtiquetaInbox */
export type EtiquetaCorreo = EtiquetaInbox

// ─── Etapas de conversación (pipeline) ───

export interface EtapaConversacion {
  id: string
  empresa_id: string
  tipo_canal: TipoCanal
  clave: string
  etiqueta: string
  color: string
  icono: string | null
  orden: number
  es_predefinida: boolean
  activa: boolean
  // Validaciones del pipeline (opcionales, default [])
  requisitos?: RequisitoEtapa[]
  sectores_permitidos?: string[]
  acciones_auto?: AccionAutoEtapa[]
  creado_en: string
}

export const ETAPAS_DEFAULT_WHATSAPP: Omit<EtapaConversacion, 'id' | 'empresa_id' | 'creado_en'>[] = [
  { tipo_canal: 'whatsapp', clave: 'nuevo', etiqueta: 'Nuevo', color: '#6b7280', icono: '🆕', orden: 0, es_predefinida: true, activa: true },
  { tipo_canal: 'whatsapp', clave: 'contactado', etiqueta: 'Contactado', color: '#3b82f6', icono: '📞', orden: 1, es_predefinida: true, activa: true },
  { tipo_canal: 'whatsapp', clave: 'calificado', etiqueta: 'Calificado', color: '#f59e0b', icono: '⭐', orden: 2, es_predefinida: true, activa: true },
  { tipo_canal: 'whatsapp', clave: 'propuesta', etiqueta: 'Propuesta', color: '#8b5cf6', icono: '📋', orden: 3, es_predefinida: true, activa: true },
  { tipo_canal: 'whatsapp', clave: 'ganado', etiqueta: 'Ganado', color: '#22c55e', icono: '✅', orden: 4, es_predefinida: true, activa: true },
  { tipo_canal: 'whatsapp', clave: 'perdido', etiqueta: 'Perdido', color: '#ef4444', icono: '❌', orden: 5, es_predefinida: true, activa: true },
]

export const ETAPAS_DEFAULT_CORREO: Omit<EtapaConversacion, 'id' | 'empresa_id' | 'creado_en'>[] = [
  { tipo_canal: 'correo', clave: 'recibido', etiqueta: 'Recibido', color: '#6b7280', icono: '📥', orden: 0, es_predefinida: true, activa: true },
  { tipo_canal: 'correo', clave: 'en_proceso', etiqueta: 'En proceso', color: '#3b82f6', icono: '🔄', orden: 1, es_predefinida: true, activa: true },
  { tipo_canal: 'correo', clave: 'respondido', etiqueta: 'Respondido', color: '#22c55e', icono: '✉️', orden: 2, es_predefinida: true, activa: true },
  { tipo_canal: 'correo', clave: 'seguimiento', etiqueta: 'Seguimiento', color: '#f59e0b', icono: '👁️', orden: 3, es_predefinida: true, activa: true },
  { tipo_canal: 'correo', clave: 'cerrado', etiqueta: 'Cerrado', color: '#8b5cf6', icono: '🔒', orden: 4, es_predefinida: true, activa: true },
]

// Tipos de WhatsApp movidos a '@/tipos/whatsapp' para mantener modularidad
// (inbox puede instalarse sin WhatsApp).

// ─── Correo programado ───

export type EstadoProgramado = 'pendiente' | 'enviado' | 'cancelado' | 'error'

export interface CorreoProgramado {
  id: string
  empresa_id: string
  canal_id: string
  conversacion_id: string | null
  creado_por: string
  correo_para: string[]
  correo_cc: string[] | null
  correo_cco: string[] | null
  correo_asunto: string
  texto: string | null
  html: string | null
  correo_in_reply_to: string | null
  correo_references: string[] | null
  adjuntos_ids: string[] | null
  enviar_en: string
  estado: EstadoProgramado
  enviado_en: string | null
  error: string | null
  creado_en: string
}

// ─── Reglas automáticas de correo ───

export interface CondicionRegla {
  campo: 'correo_de' | 'asunto' | 'texto' | 'correo_para'
  operador: 'contiene' | 'es' | 'empieza' | 'termina' | 'dominio'
  valor: string
}

export interface AccionRegla {
  tipo: 'etiquetar' | 'asignar' | 'marcar_spam' | 'archivar' | 'responder'
  valor: string // etiqueta_id, usuario_id, o texto de respuesta
}

export interface ReglaCorreo {
  id: string
  empresa_id: string
  nombre: string
  activa: boolean
  orden: number
  condiciones: CondicionRegla[]
  acciones: AccionRegla[]
  creado_por: string | null
  creado_en: string
  actualizado_en: string
}

// ─── Métricas de correo ───

export interface MetricaCorreo {
  id: string
  empresa_id: string
  canal_id: string | null
  fecha: string
  correos_recibidos: number
  correos_enviados: number
  conversaciones_nuevas: number
  conversaciones_resueltas: number
  correos_spam: number
  tiempo_primera_respuesta_promedio: number | null
  tiempo_resolucion_promedio: number | null
}

// ─── Config Outlook OAuth ───

export interface ConfigOutlookOAuth {
  email: string
  refresh_token: string
  access_token: string
  token_expira_en: string
}

// ─── Agente IA ───

export type ModoActivacionAgente = 'siempre' | 'despues_chatbot' | 'fuera_horario' | 'sin_asignar'
export type ModoRespuestaAgente = 'automatico' | 'sugerir' | 'borrador'
export type TonoAgente = 'profesional' | 'amigable' | 'formal' | 'casual'
export type LargoRespuesta = 'corto' | 'medio' | 'largo'

export type AccionAgente =
  | 'responder' | 'clasificar' | 'enrutar' | 'resumir'
  | 'sentimiento' | 'etiquetar' | 'escalar'
  | 'crear_actividad' | 'actualizar_contacto'

export interface ConfigAgenteIA {
  id: string
  empresa_id: string
  activo: boolean
  nombre: string
  apodo: string
  personalidad: string
  instrucciones: string
  idioma: string
  canales_activos: string[]
  modo_activacion: ModoActivacionAgente
  delay_segundos: number
  max_mensajes_auto: number
  puede_responder: boolean
  puede_clasificar: boolean
  puede_enrutar: boolean
  puede_resumir: boolean
  puede_sentimiento: boolean
  puede_crear_actividad: boolean
  puede_actualizar_contacto: boolean
  puede_etiquetar: boolean
  modo_respuesta: ModoRespuestaAgente
  tono: TonoAgente
  largo_respuesta: LargoRespuesta
  firmar_como: string
  usar_base_conocimiento: boolean
  escalar_si_negativo: boolean
  escalar_si_no_sabe: boolean
  escalar_palabras: string[]
  mensaje_escalamiento: string
  acciones_habilitadas: AccionNodo[]
  total_mensajes_enviados: number
  total_escalamientos: number
  // Campos v2: configuración estructurada por empresa
  zona_cobertura: string
  sitio_web: string
  horario_atencion: string
  correo_empresa: string
  servicios_si: string
  servicios_no: string
  tipos_contacto: TipoContactoConfig[]
  flujo_conversacion: PasoFlujoConfig[]
  reglas_agenda: string
  info_precios: string
  situaciones_especiales: string
  ejemplos_conversacion: EjemploConversacionConfig[]
  respuesta_si_bot: string
  vocabulario_natural: string
  ultimo_analisis_conversaciones: string | null
  total_conversaciones_analizadas: number
}

// ─── Tipos de contacto configurables por empresa ───

export interface TipoContactoConfig {
  tipo: string
  nombre: string
  icono: string
  formulario: string
  instrucciones: string
}

// ─── Pasos del flujo de conversación ───

export interface PasoFlujoConfig {
  paso: number
  titulo: string
  descripcion: string
  condicion_avance: string
}

// ─── Ejemplos de conversación (few-shot) ───

export interface EjemploConversacionConfig {
  titulo: string
  mensajes: { rol: 'cliente' | 'agente'; texto: string }[]
}

export interface AccionNodo {
  id: string
  tipo: AccionAgente
  config?: Record<string, unknown>
  activo?: boolean
}

export interface EntradaBaseConocimiento {
  id: string
  empresa_id: string
  titulo: string
  contenido: string
  categoria: string
  etiquetas: string[]
  activo: boolean
}

export interface LogAgenteIA {
  id: string
  empresa_id: string
  conversacion_id: string
  mensaje_id: string | null
  accion: AccionAgente
  entrada: Record<string, unknown>
  salida: Record<string, unknown>
  exito: boolean
  error: string | null
  proveedor: string
  modelo: string
  tokens_entrada: number
  tokens_salida: number
  latencia_ms: number
  creado_en: string
}

export interface ClasificacionIA {
  intencion: string
  tema: string
  urgencia: 'baja' | 'media' | 'alta' | 'critica'
  confianza: number
  idioma_detectado?: string
}

export interface ResultadoPipelineAgente {
  clasificacion?: ClasificacionIA
  sentimiento?: { valor: string; confianza: number }
  respuesta?: { texto: string; fuentes?: string[] }
  acciones_ejecutadas: AccionAgente[]
  escalado: boolean
  razon_escalamiento?: string
}
