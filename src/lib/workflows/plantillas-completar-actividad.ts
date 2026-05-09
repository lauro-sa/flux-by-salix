/**
 * Plantillas curadas para preconfigurar la acción `completar_actividad`
 * desde el panel del editor (sub-PR 20.4).
 *
 * Patrón espejo de `flujos-sistema.ts` (sub-PR 20.3): catálogo
 * declarativo TS, sin side-effects, importable desde el panel UI.
 *
 * Cuándo se usan:
 *   - El panel `PanelCompletarActividad` muestra una sección
 *     "PLANTILLAS" con 4 cards. Click en una llena `criterio` con el
 *     shape correspondiente, dejando que el usuario edite después si
 *     quiere ajustar.
 *   - Las plantillas 1 y 2 son IDÉNTICAS al criterio de los flujos del
 *     sistema sembrados en 20.3 (pausados por defecto). Audiencias
 *     distintas: las plantillas son starter para flujos custom; los
 *     flujos del sistema son globales por empresa. La duplicidad es
 *     intencional (complementariedad, voto del coordinador).
 *
 * Las strings legibles (titulo + descripcion) NO viven acá — viven en
 * i18n bajo `flujos.editor.panel.completar_actividad.plantilla.<id>.*`.
 * Acá guardamos solo el shape JSON del criterio + el id estable.
 */

import type { AccionCompletarActividad } from '@/tipos/workflow'

export interface PlantillaCompletarActividad {
  /** Id estable, slug. Se usa como clave de React y para i18n keys. */
  id: string
  /**
   * Criterio pre-rellenado. Falta `tipo_actividad_id` cuando la plantilla
   * lo deja explícitamente al usuario (placeholder visible en UI con
   * texto "elegí un tipo"). El validador del editor exigirá completarlo
   * antes de publicar.
   */
  criterio: AccionCompletarActividad['criterio']
  /**
   * Si la plantilla deja `tipo_actividad_id` para que el usuario lo
   * elija, este flag es true. La UI puede destacar el campo después de
   * aplicar la plantilla.
   */
  requiere_tipo_actividad: boolean
}

export const PLANTILLAS_COMPLETAR_ACTIVIDAD: readonly PlantillaCompletarActividad[] = [
  // 1) Cierre por presupuesto enviado — espejo del flujo del sistema
  //    `autocompletar_al_enviar_presupuesto` (20.3). Útil si el usuario
  //    quiere su propia versión activa del autocierre o con tweaks.
  {
    id: 'cerrar_al_enviar_presupuesto',
    criterio: {
      relacionada_a: {
        entidad_tipo: 'presupuesto',
        entidad_id: '{{entidad.id}}',
      },
      si_multiple: 'todas',
      si_no_encuentra: 'continuar',
    },
    requiere_tipo_actividad: false,
  },

  // 2) Cierre por visita completada — espejo del flujo del sistema
  //    `autocompletar_al_finalizar_visita` (20.3).
  {
    id: 'cerrar_al_completar_visita',
    criterio: {
      relacionada_a: {
        entidad_tipo: 'visita',
        entidad_id: '{{entidad.id}}',
      },
      si_multiple: 'todas',
      si_no_encuentra: 'continuar',
    },
    requiere_tipo_actividad: false,
  },

  // 3) Cierre granular: actividad más antigua de un tipo específico
  //    para el contacto del flujo. El user elige el tipo en el panel.
  {
    id: 'cerrar_mas_antigua_del_contacto',
    criterio: {
      contacto_id: '{{contacto.id}}',
      si_multiple: 'mas_antigua',
      si_no_encuentra: 'continuar',
    },
    requiere_tipo_actividad: true,
  },

  // 4) Cierre granular: todas las actividades de un tipo asignadas al
   //   actor del flujo (ej: "cerrar mis pendientes de tipo X").
  {
    id: 'cerrar_todas_mias_del_tipo',
    criterio: {
      asignado_id: '{{actor.usuario_id}}',
      si_multiple: 'todas',
      si_no_encuentra: 'continuar',
    },
    requiere_tipo_actividad: true,
  },
] as const

export function plantillaCompletarActividadPorId(
  id: string,
): PlantillaCompletarActividad | null {
  return PLANTILLAS_COMPLETAR_ACTIVIDAD.find((p) => p.id === id) ?? null
}
