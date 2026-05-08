/**
 * Catálogo de flujos preconfigurados del sistema (sub-PR 20.3).
 *
 * Espejo TS del seed de `sql/067_flujos_sistema_autocompletar.sql`. Sirve
 * como FUENTE DE VERDAD del shape esperado de cada flujo del sistema:
 *
 *   1. El test `flujos-sistema.test.ts` valida que cada definición pasa
 *      `validarPublicable` (el mismo gate que el endpoint /activar usa).
 *      Si el shape de `AccionCompletarActividad` cambia en TS, este test
 *      pinta el síntoma y la migración del seed queda alineada.
 *
 *   2. Sub-PRs futuros (20.5 cuando active los flujos sembrados,
 *      sub-PR posterior cuando agregue seed-on-empresa-create) leen este
 *      catálogo en lugar de duplicar literales JSON. Si la lista crece,
 *      se suma acá.
 *
 * El módulo NO inserta filas en BD por sí mismo — es solo definición
 * declarativa. El INSERT real lo hace la migración SQL (manual one-time
 * sobre empresas existentes) o el seed-on-empresa-create del futuro.
 */

import type { AccionWorkflow, DisparadorWorkflow } from '@/tipos/workflow'

export interface FlujoSistema {
  /** Identificador estable, matchea `flujos.clave_sistema` en BD. */
  clave: string
  /** Nombre legible del flujo (visible al admin en el listado y editor). */
  nombre: string
  /**
   * Descripción legible al admin. Sigue tono de Flux (voseo argentino:
   * "activalo", "configurá"). Aparece en el panel del editor.
   */
  descripcion: string
  /**
   * Estado inicial al sembrar. Siempre 'pausado' para flujos del sistema:
   * el admin los activa explícitamente desde el editor cuando esté listo
   * (criterio del coordinador en sub-PR 20.3 — evita doble-disparo con
   * el helper legacy todavía vivo).
   */
  estado_inicial: 'pausado'
  disparador: DisparadorWorkflow
  acciones: AccionWorkflow[]
}

export const FLUJOS_SISTEMA: readonly FlujoSistema[] = [
  {
    clave: 'autocompletar_al_enviar_presupuesto',
    nombre: 'Cerrar actividades al enviar presupuesto',
    descripcion:
      'Flujo configurado por el sistema. Cierra automáticamente las actividades vinculadas al presupuesto cuando pasa a estado «Enviado». Pausado por defecto — activalo desde el editor cuando estés listo.',
    estado_inicial: 'pausado',
    disparador: {
      tipo: 'entidad.estado_cambio',
      configuracion: {
        entidad_tipo: 'presupuesto',
        hasta_clave: 'enviado',
      },
      etiqueta: 'Presupuesto enviado',
    },
    acciones: [
      {
        tipo: 'completar_actividad',
        etiqueta: 'Cerrar actividades vinculadas',
        criterio: {
          relacionada_a: {
            entidad_tipo: 'presupuesto',
            entidad_id: '{{entidad.id}}',
          },
          si_multiple: 'todas',
          si_no_encuentra: 'continuar',
        },
      },
    ],
  },
  {
    clave: 'autocompletar_al_finalizar_visita',
    nombre: 'Cerrar actividades al finalizar visita',
    descripcion:
      'Flujo configurado por el sistema. Cierra automáticamente las actividades vinculadas a la visita cuando pasa a estado «Completada». Pausado por defecto — activalo desde el editor cuando estés listo.',
    estado_inicial: 'pausado',
    disparador: {
      tipo: 'entidad.estado_cambio',
      configuracion: {
        entidad_tipo: 'visita',
        hasta_clave: 'completada',
      },
      etiqueta: 'Visita completada',
    },
    acciones: [
      {
        tipo: 'completar_actividad',
        etiqueta: 'Cerrar actividades vinculadas',
        criterio: {
          relacionada_a: {
            entidad_tipo: 'visita',
            entidad_id: '{{entidad.id}}',
          },
          si_multiple: 'todas',
          si_no_encuentra: 'continuar',
        },
      },
    ],
  },
] as const

export function flujoSistemaPorClave(clave: string): FlujoSistema | null {
  return FLUJOS_SISTEMA.find((f) => f.clave === clave) ?? null
}
