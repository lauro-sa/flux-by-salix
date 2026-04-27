/**
 * Tipos compartidos de la configuración de actividades.
 * Separado del componente para evitar que los imports de tipos arrastren UI.
 */

export interface TipoActividad {
  id: string
  clave: string
  etiqueta: string
  abreviacion: string | null
  icono: string
  color: string
  modulos_disponibles: string[]
  dias_vencimiento: number
  campo_fecha: boolean
  campo_descripcion: boolean
  campo_responsable: boolean
  campo_prioridad: boolean
  campo_checklist: boolean
  campo_calendario: boolean
  /** Qué módulo/documento crea este tipo al ejecutarlo. null = sin acción (solo edita). */
  accion_destino: 'presupuesto' | 'visita' | 'correo' | null
  /** Cuándo se autocompleta la actividad. null = manual. */
  evento_auto_completar: 'al_crear' | 'al_enviar' | 'al_finalizar' | null
  resumen_predeterminado: string | null
  nota_predeterminada: string | null
  usuario_predeterminado: string | null
  siguiente_tipo_id: string | null
  tipo_encadenamiento: 'sugerir' | 'activar'
  orden: number
  activo: boolean
  es_predefinido: boolean
  es_sistema: boolean
}

/** Módulos y sub-módulos donde un tipo de actividad puede estar disponible */
export const MODULOS_DISPONIBLES = [
  { clave: 'contactos', etiqueta: 'Contactos', grupo: 'Principal' },
  { clave: 'inbox', etiqueta: 'Inbox', grupo: 'Principal' },
  { clave: 'visitas', etiqueta: 'Visitas', grupo: 'Principal' },
  { clave: 'calendario', etiqueta: 'Calendario', grupo: 'Principal' },
  { clave: 'presupuestos', etiqueta: 'Presupuestos', grupo: 'Documentos' },
  { clave: 'facturas', etiqueta: 'Facturas', grupo: 'Documentos' },
  { clave: 'ordenes', etiqueta: 'Órdenes de trabajo', grupo: 'Documentos' },
  { clave: 'informes', etiqueta: 'Informes', grupo: 'Documentos' },
  { clave: 'notas_credito', etiqueta: 'Notas de crédito', grupo: 'Documentos' },
  { clave: 'recibos', etiqueta: 'Recibos', grupo: 'Documentos' },
]
