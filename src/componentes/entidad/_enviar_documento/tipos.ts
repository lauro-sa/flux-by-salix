/**
 * Tipos compartidos del modal de envío de documentos.
 * Se usan en: ModalEnviarDocumento, useEnvioDocumento, sub-componentes internos.
 */

/** Canal de correo configurado para la empresa */
export interface CanalCorreoEmpresa {
  id: string
  nombre: string
  email: string
  /** Es el canal predeterminado para este tipo de documento */
  predeterminado?: boolean
}

/** Plantilla de correo disponible */
export interface PlantillaCorreo {
  id: string
  nombre: string
  asunto: string
  contenido_html: string
  /** Canal por el que se envía (null = cualquiera) */
  canal_id?: string | null
  /** UUID del creador (para separar sistema vs personales) */
  creado_por?: string
}

/** Adjunto del documento (PDF generado automáticamente) */
export interface AdjuntoDocumento {
  id: string
  nombre_archivo: string
  tipo_mime: string
  tamano_bytes: number
  url: string
  miniatura_url?: string | null
  /** Si es el PDF principal del documento (auto-adjuntado) */
  es_documento_principal?: boolean
}

/** Datos que emite el modal al enviar */
export interface DatosEnvioDocumento {
  canal_id: string
  correo_para: string[]
  correo_cc: string[]
  correo_cco: string[]
  asunto: string
  html: string
  texto: string
  adjuntos_ids: string[]
  incluir_enlace_portal: boolean
  /** Si es programado, la fecha ISO */
  programado_para?: string
  /** Snapshot del estado del modal para restaurar al deshacer — uso interno */
  _snapshot?: SnapshotCorreo
}

export interface ContactoSugerido {
  id: string
  nombre: string
  correo: string
}

/** Datos del borrador para guardar/restaurar */
export interface DatosBorradorCorreo {
  canal_id: string
  correo_para: string[]
  correo_cc: string[]
  correo_cco: string[]
  asunto: string
  html: string
  adjuntos_ids: string[]
  incluir_enlace_portal: boolean
}

/** Datos para guardar como plantilla */
export interface DatosPlantillaCorreo {
  nombre: string
  asunto: string
  contenido_html: string
  canal_id?: string
}

/** Snapshot completo del estado del modal para restaurar al deshacer envío */
export interface SnapshotCorreo {
  canal_id: string
  para: string[]
  cc: string[]
  cco: string[]
  mostrarCC: boolean
  mostrarCCO: boolean
  asunto: string
  html: string
  plantilla_id: string
  incluir_pdf: boolean
  incluir_enlace_portal: boolean
  adjuntos: AdjuntoDocumento[]
}

/** Props del componente principal ModalEnviarDocumento */
export interface PropiedadesModalEnviarDocumento {
  abierto: boolean
  onCerrar: () => void
  onEnviar: (datos: DatosEnvioDocumento) => void | Promise<void>
  canales: CanalCorreoEmpresa[]
  plantillas?: PlantillaCorreo[]
  correosDestinatario?: string[]
  nombreDestinatario?: string
  asuntoPredeterminado?: string
  htmlInicial?: string
  adjuntoDocumento?: AdjuntoDocumento | null
  urlPortal?: string | null
  enviando?: boolean
  tipoDocumento?: string
  /** Guardar como borrador (si no se pasa, el botón no aparece) */
  onGuardarBorrador?: (datos: DatosBorradorCorreo) => void | Promise<void>
  /** Guardar como plantilla (si no se pasa, el botón no aparece) */
  onGuardarPlantilla?: (datos: DatosPlantillaCorreo) => void | Promise<void>
  /** Datos reales para preview de variables (contacto, presupuesto, empresa, etc.) */
  contextoVariables?: Record<string, Record<string, unknown>>
  /** Snapshot para restaurar al deshacer envío (si se pasa, se usa en vez de los defaults) */
  snapshotRestaurar?: SnapshotCorreo | null
  /** ID de la plantilla marcada como predeterminada para este tipo de documento */
  plantillaPredeterminadaId?: string | null
  /** Callback para cambiar la plantilla predeterminada (solo admins). Si no se pasa, no se muestra el botón */
  onCambiarPredeterminada?: (plantillaId: string | null) => void | Promise<void>
  /** ID del usuario actual (para separar plantillas sistema vs personales) */
  usuarioId?: string
  /** Si el usuario es admin/propietario */
  esAdmin?: boolean
  /** Guardar cambios del asunto+html actual sobre la plantilla seleccionada */
  onGuardarCambiosPlantilla?: (id: string, datos: { asunto: string; contenido_html: string }) => Promise<void>
  /** Guardar el contenido actual como nueva plantilla */
  onCrearPlantilla?: (nombre: string, datos: { asunto: string; contenido_html: string; paraTodos?: boolean }) => Promise<void>
  /** Eliminar una plantilla */
  onEliminarPlantilla?: (id: string) => Promise<void>
  /** Si true, el PDF inicia desactivado (el usuario puede activarlo manualmente) */
  pdfDesactivadoInicial?: boolean
  /** Si true, el portal inicia desactivado (el usuario puede activarlo manualmente) */
  portalDesactivadoInicial?: boolean
}
