/**
 * STUB temporal — la implementación real está en construcción en otro chat.
 *
 * Maneja la clasificación de plantillas Meta de WhatsApp por módulo
 * de la app (presupuestos, órdenes, asistencias, etc) para filtrar el
 * selector según el contexto desde donde se abre el chatter.
 *
 * Mientras no se commitee la versión real:
 *  - `MODULOS_PLANTILLA_WA` es un array vacío → el selector de módulos
 *    aparece vacío en la config de plantillas, pero la página carga.
 *  - `plantillaDisponibleEnModulo` retorna `true` → no filtra; el
 *    selector muestra todas las plantillas aprobadas (mismo comportamiento
 *    que antes de la funcionalidad de filtrado por módulo).
 *  - `moduloDesdeEntidadTipo` retorna `null` → el chatter no infiere
 *    contexto pero sigue funcionando.
 *  - `etiquetaModuloWA` devuelve el `valor` tal cual.
 */

export interface ModuloPlantillaWA {
  valor: string
  etiqueta: string
  entidad?: string
}

export const MODULOS_PLANTILLA_WA: ModuloPlantillaWA[] = []

export function etiquetaModuloWA(m: ModuloPlantillaWA | string): string {
  if (typeof m === 'string') return m
  return m?.etiqueta ?? m?.valor ?? ''
}

export function plantillaDisponibleEnModulo(
  _plantilla: unknown,
  _contexto: unknown,
): boolean {
  return true
}

export function moduloDesdeEntidadTipo(_entidadTipo: string | null | undefined): string | null {
  return null
}
