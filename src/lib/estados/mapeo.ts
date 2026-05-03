/**
 * Mapeos centrales de la infraestructura genérica de estados.
 *
 * Cada `EntidadConEstado` está conectada a:
 *   - una tabla principal (donde vive la fila con `estado_clave`)
 *   - una tabla de catálogo (`estados_<entidad>`) con sus estados configurables
 *
 * Mantener las dos como mapeos hardcodeados (no como parámetros dinámicos)
 * porque previene inyección SQL y deja explícito qué entidades están migradas.
 */

import type { EntidadConEstado } from '@/tipos/estados'

/**
 * Tabla principal de cada entidad (donde se hace el UPDATE de estado_clave).
 * A medida que las entidades se migran al sistema genérico, se agregan acá.
 */
export const TABLA_PRINCIPAL_POR_ENTIDAD: Partial<Record<EntidadConEstado, string>> = {
  cuota:        'presupuesto_cuotas',
  conversacion: 'conversaciones',
  actividad:    'actividades',
  visita:       'visitas',
  orden:        'ordenes_trabajo',
  presupuesto:      'presupuestos',
  asistencia:       'asistencias',
  adelanto_nomina:  'adelantos_nomina',
  pago_nomina:      'pagos_nomina',
}

/**
 * Tabla de catálogo de estados por entidad (donde están las claves
 * configurables, etiquetas, colores, grupos).
 */
export const TABLA_ESTADOS_POR_ENTIDAD: Partial<Record<EntidadConEstado, string>> = {
  cuota:            'estados_cuota',
  conversacion:     'estados_conversacion',
  actividad:        'estados_actividad',
  visita:           'estados_visita',
  orden:            'estados_orden',
  presupuesto:      'estados_presupuesto',
  asistencia:       'estados_asistencia',
  adelanto_nomina:  'estados_adelanto_nomina',
  pago_nomina:      'estados_pago_nomina',
}

/**
 * Devuelve true si la entidad ya está conectada al sistema genérico.
 * Si false, los hooks/helpers deberían hacer un fallback graceful (devolver
 * lista vacía, no crashear).
 */
export function entidadSoportada(entidad: EntidadConEstado): boolean {
  return entidad in TABLA_PRINCIPAL_POR_ENTIDAD
}
