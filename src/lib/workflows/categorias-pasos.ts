/**
 * Mapeo centralizado de `TipoDisparador` y `TipoAccion` a categorías
 * de UX, usado por el modal `CatalogoPasos` del editor visual de flujos
 * (sub-PR 19.2).
 *
 * Las categorías son una decisión de UX (agrupación legible para el
 * usuario), no del motor. El motor solo conoce `TipoDisparador` y
 * `TipoAccion` raw — esta capa es solo para que el catálogo agrupe
 * "Acciones de envío", "Cambios de datos", etc.
 *
 * Reglas para mantener este archivo:
 *   • Cada `TipoDisparador` aparece exactamente en `MAPA_DISPARADOR`.
 *   • Cada `TipoAccion`     aparece exactamente en `MAPA_ACCION`.
 *   • Toda categoría tiene una clave i18n alcanzable (`flujos.catalogo.categoria.*`).
 *   • Los tests del archivo unit garantizan que el mapeo cubre el
 *     catálogo completo (patrón "claves alcanzables" replicado de 19.1).
 *
 * Modos del modal:
 *   - `'disparador'` → muestra solo CategoriaDisparador.
 *   - `'accion'`     → muestra solo CategoriaAccion.
 */

import type { TipoAccion, TipoDisparador } from '@/tipos/workflow'

// =============================================================
// Categorías
// =============================================================

export type CategoriaDisparador = 'eventos' | 'tiempo'

export const CATEGORIAS_DISPARADOR: readonly CategoriaDisparador[] = [
  'eventos',
  'tiempo',
] as const

export type CategoriaAccion =
  | 'envios'
  | 'creaciones'
  | 'cambios'
  | 'notificaciones'
  | 'control'
  | 'terminar'

export const CATEGORIAS_ACCION: readonly CategoriaAccion[] = [
  'envios',
  'creaciones',
  'cambios',
  'notificaciones',
  'control',
  'terminar',
] as const

// =============================================================
// Mapas raw → categoría
// =============================================================
// Si TS no se queja al agregar un `TipoDisparador` o `TipoAccion`
// nuevo, el test de claves alcanzables sí lo va a hacer al levantar
// el catálogo y preguntar por su categoría.

export const MAPA_DISPARADOR: Record<TipoDisparador, CategoriaDisparador> = {
  'entidad.estado_cambio': 'eventos',
  'entidad.creada': 'eventos',
  'entidad.campo_cambia': 'eventos',
  'actividad.completada': 'eventos',
  'inbox.mensaje_recibido': 'eventos',
  'inbox.conversacion_sin_respuesta': 'eventos',
  'webhook.entrante': 'eventos',
  'tiempo.cron': 'tiempo',
  'tiempo.relativo_a_campo': 'tiempo',
}

export const MAPA_ACCION: Record<TipoAccion, CategoriaAccion> = {
  // Envíos: WhatsApp y correo en sus 4 variantes (plantilla / texto).
  enviar_whatsapp_plantilla: 'envios',
  enviar_whatsapp_texto: 'envios',
  enviar_correo_plantilla: 'envios',
  enviar_correo_texto: 'envios',
  // Creaciones: nuevas entidades en otros módulos.
  crear_actividad: 'creaciones',
  crear_orden_trabajo: 'creaciones',
  crear_visita: 'creaciones',
  // Cambios sobre la entidad disparadora o relacionada.
  cambiar_estado_entidad: 'cambios',
  asignar_usuario: 'cambios',
  agregar_etiqueta: 'cambios',
  quitar_etiqueta: 'cambios',
  // Notificaciones internas (al usuario o grupo, no al cliente).
  notificar_usuario: 'notificaciones',
  notificar_grupo: 'notificaciones',
  // Control de flujo: tiempo, ramificaciones, salidas.
  esperar: 'control',
  esperar_evento: 'control',
  condicion_branch: 'control',
  webhook_saliente: 'control',
  // Terminar el flujo explícitamente.
  terminar_flujo: 'terminar',
}

// =============================================================
// Lookup helpers — preferí estos sobre los mapas crudos (devuelven
// undefined para tipos desconocidos en lugar de tirar excepción).
// =============================================================

export function categoriaDeDisparador(
  tipo: TipoDisparador | string | null | undefined,
): CategoriaDisparador | undefined {
  if (!tipo) return undefined
  return MAPA_DISPARADOR[tipo as TipoDisparador]
}

export function categoriaDeAccion(
  tipo: TipoAccion | string | null | undefined,
): CategoriaAccion | undefined {
  if (!tipo) return undefined
  return MAPA_ACCION[tipo as TipoAccion]
}

/**
 * Devuelve los disparadores agrupados por categoría, en el mismo orden
 * que `CATEGORIAS_DISPARADOR`. Útil para iterar el modal en su orden
 * canónico sin que el orden dependa de cómo TS resuelve `Object.entries`.
 */
export function disparadoresPorCategoria(): Array<{
  categoria: CategoriaDisparador
  tipos: TipoDisparador[]
}> {
  return CATEGORIAS_DISPARADOR.map((cat) => ({
    categoria: cat,
    tipos: (Object.entries(MAPA_DISPARADOR) as Array<[TipoDisparador, CategoriaDisparador]>)
      .filter(([, c]) => c === cat)
      .map(([tipo]) => tipo),
  }))
}

export function accionesPorCategoria(): Array<{
  categoria: CategoriaAccion
  tipos: TipoAccion[]
}> {
  return CATEGORIAS_ACCION.map((cat) => ({
    categoria: cat,
    tipos: (Object.entries(MAPA_ACCION) as Array<[TipoAccion, CategoriaAccion]>)
      .filter(([, c]) => c === cat)
      .map(([tipo]) => tipo),
  }))
}

// =============================================================
// Claves i18n
// =============================================================
// Esquema:
//   flujos.catalogo.categoria.<categoria>          → Título de la sección
//   flujos.catalogo.categoria.<categoria>_desc     → Descripción corta
//   flujos.paso.<tipo>.titulo                      → Nombre legible del paso
//   flujos.paso.<tipo>.descripcion                 → 1 línea explicativa

export function claveI18nCategoriaDisparador(cat: CategoriaDisparador): string {
  return `flujos.catalogo.categoria.${cat}`
}

export function claveI18nCategoriaAccion(cat: CategoriaAccion): string {
  return `flujos.catalogo.categoria.${cat}`
}

export function claveI18nTituloPaso(tipo: TipoAccion | TipoDisparador): string {
  return `flujos.paso.${tipo}.titulo`
}

export function claveI18nDescripcionPaso(tipo: TipoAccion | TipoDisparador): string {
  return `flujos.paso.${tipo}.descripcion`
}
