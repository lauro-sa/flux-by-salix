/**
 * Tipos centralizados del módulo de visitas.
 * Se usa en: ModalVisita, ContenidoVisitas, DetalleVisita, useModalVisita,
 * ModalDetalleVisita, PanelPlanificacion, API routes de visitas.
 */

// ── Estados y prioridades ──

export type EstadoVisita = 'provisoria' | 'programada' | 'en_camino' | 'en_sitio' | 'completada' | 'cancelada' | 'reprogramada'

export type PrioridadVisita = 'baja' | 'normal' | 'alta' | 'urgente'

// ── Checklist ──

export interface ItemChecklist {
  id: string
  texto: string
  completado: boolean
}

// ── Visita completa ──

export interface Visita {
  id: string
  contacto_id: string
  contacto_nombre: string
  direccion_id: string | null
  direccion_texto: string | null
  direccion_lat: number | null
  direccion_lng: number | null
  asignado_a: string | null
  asignado_nombre: string | null
  fecha_programada: string
  // Si false, la hora dentro de fecha_programada es placeholder y la UI muestra
  // "sin hora específica". Si true, la hora se eligió a propósito y se muestra.
  tiene_hora_especifica: boolean
  fecha_inicio: string | null
  fecha_llegada: string | null
  fecha_completada: string | null
  duracion_estimada_min: number
  duracion_real_min: number | null
  estado: EstadoVisita | string
  motivo: string | null
  resultado: string | null
  notas: string | null
  notas_registro: string | null
  temperatura: string | null
  prioridad: PrioridadVisita | string
  checklist: ItemChecklist[]
  registro_lat: number | null
  registro_lng: number | null
  registro_precision_m: number | null
  actividad_id: string | null
  vinculos: { tipo: string; id: string; nombre: string }[]
  recibe_nombre: string | null
  recibe_telefono: string | null
  recibe_contacto_id: string | null
  archivada: boolean
  archivada_en: string | null
  en_papelera: boolean
  creado_por: string | null
  creado_por_nombre: string | null
  editado_por: string | null
  editado_por_nombre: string | null
  creado_en: string | null
  actualizado_en: string | null
}

// ── Miembro visitador ──

export interface MiembroVisitador {
  usuario_id: string
  nombre: string
  apellido: string
}

// ── Config de visitas ──

export interface ConfigVisitas {
  checklist_predeterminado?: ItemChecklist[]
  motivos_predefinidos?: string[]
  resultados_predefinidos?: string[]
  duracion_estimada_default?: number
  requiere_geolocalizacion?: boolean
  // Si true, el flujo de recorrido envía avisos por WhatsApp (en camino + llegada)
  // al receptor de la visita. Cuando está apagado, los modales no se abren y la
  // sección "Quién recibe el aviso" se oculta del modal de creación/edición.
  enviar_avisos_whatsapp?: boolean
}
