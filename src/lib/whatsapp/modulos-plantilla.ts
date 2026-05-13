/**
 * Catálogo único de módulos donde una plantilla de WhatsApp puede estar
 * disponible. Centraliza:
 *  - La lista de secciones marcables en el editor (chips "Disponible en").
 *  - Las opciones del filtro del listado de plantillas.
 *  - El mapeo `entidadTipo` (singular, como viaja por el chatter) → `modulo`
 *    (slug guardado en `plantillas_whatsapp.modulos`).
 *  - El predicado de visibilidad usado por el chatter y el selector del inbox
 *    para decidir si una plantilla aplica al contexto actual.
 *
 * Si una plantilla no tiene módulos asignados (`modulos = []`) significa que
 * está disponible en todos los módulos.
 */

import type { PlantillaWhatsApp } from '@/tipos/whatsapp'
import type { EntidadPlantillaWA } from '@/lib/whatsapp/variables'

export interface ModuloPlantillaWA {
  /** Slug que se persiste en `plantillas_whatsapp.modulos`. */
  valor: string
  /** Etiqueta visible en UI (editor, filtros, columna). */
  etiqueta: string
  /** Entidad asociada para previews y mapeo de variables. */
  entidad?: EntidadPlantillaWA
}

/** Catálogo completo. Cualquier sección donde se pueda enviar WhatsApp desde
 *  el chatter o desde un módulo nativo (inbox) debería aparecer aquí. */
export const MODULOS_PLANTILLA_WA: ModuloPlantillaWA[] = [
  { valor: 'inbox', etiqueta: 'Inbox' },
  { valor: 'contactos', etiqueta: 'Contactos', entidad: 'contacto' },
  { valor: 'presupuestos', etiqueta: 'Presupuestos', entidad: 'presupuesto' },
  { valor: 'ordenes', etiqueta: 'Órdenes de trabajo', entidad: 'orden' },
  { valor: 'actividades', etiqueta: 'Actividades', entidad: 'actividad' },
  { valor: 'visitas', etiqueta: 'Visitas', entidad: 'visita' },
  { valor: 'recorrido', etiqueta: 'Recorrido', entidad: 'visita' },
  { valor: 'asistencias', etiqueta: 'Asistencias', entidad: 'nomina' },
]

/** Etiqueta legible a partir del slug guardado en BD. Si el slug no está en
 *  el catálogo (plantilla antigua con un módulo retirado) devuelve el slug
 *  tal cual para no romper la UI. */
export function etiquetaModuloWA(valor: string): string {
  return MODULOS_PLANTILLA_WA.find(m => m.valor === valor)?.etiqueta || valor
}

/** Convierte el `entidadTipo` que viaja por el PanelChatter (en singular y a
 *  veces legacy como `orden_trabajo`) al slug de módulo correspondiente que
 *  se guarda en la plantilla. Devuelve `null` si no hay equivalencia. */
export function moduloDesdeEntidadTipo(entidadTipo: string | null | undefined): string | null {
  if (!entidadTipo) return null
  switch (entidadTipo) {
    case 'contacto': return 'contactos'
    case 'presupuesto': return 'presupuestos'
    case 'orden':
    case 'orden_trabajo': return 'ordenes'
    case 'actividad': return 'actividades'
    case 'visita': return 'visitas'
    case 'nomina':
    case 'asistencia':
    case 'adelanto_nomina':
    case 'pago_nomina': return 'asistencias'
    case 'conversacion': return 'inbox'
    default: return null
  }
}

/** Decide si una plantilla puede mostrarse en el contexto del módulo dado.
 *  Plantillas sin `modulos` asignados se consideran disponibles en todos. */
export function plantillaDisponibleEnModulo(
  plantilla: Pick<PlantillaWhatsApp, 'modulos'>,
  modulo: string | null | undefined,
): boolean {
  const modulosPlantilla = plantilla.modulos || []
  if (modulosPlantilla.length === 0) return true
  if (!modulo) return true
  return modulosPlantilla.includes(modulo)
}
