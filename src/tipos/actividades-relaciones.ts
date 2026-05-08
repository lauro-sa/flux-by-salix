/**
 * Set cerrado de tipos de entidad que pueden vincularse a una actividad
 * vía la tabla `actividades_relaciones` (sql/066, sub-PR 20.2).
 *
 * Paralelo a `EntidadConEstado` en `src/tipos/estados.ts`, pero suma
 * `'contacto'` que NO tiene estado configurable y por eso queda fuera
 * del set de estados — pero sí es entidad central a la que las
 * actividades suelen vincularse.
 *
 * El SQL guarda `actividades_relaciones.entidad_tipo` como `text` libre
 * (sin CHECK constraint). El narrowing al insertar/leer vive en TS,
 * misma convención que `cambios_estado.entidad_tipo` y
 * `notificaciones.referencia_tipo`. Si en el futuro hace falta sumar
 * un tipo (ej: 'pedido', 'factura'), se agrega acá y compila TS sin
 * tocar SQL.
 */

export type EntidadRelacionable =
  | 'contacto'
  | 'presupuesto'
  | 'orden'
  | 'visita'
  | 'conversacion'
  | 'asistencia'
  | 'cuota'
  | 'actividad'
  | 'adelanto_nomina'
  | 'pago_nomina'

export const ENTIDADES_RELACIONABLES: readonly EntidadRelacionable[] = [
  'contacto',
  'presupuesto',
  'orden',
  'visita',
  'conversacion',
  'asistencia',
  'cuota',
  'actividad',
  'adelanto_nomina',
  'pago_nomina',
] as const

export function esEntidadRelacionable(v: unknown): v is EntidadRelacionable {
  return (
    typeof v === 'string' &&
    (ENTIDADES_RELACIONABLES as readonly string[]).includes(v)
  )
}
