/**
 * Transiciones de estado de un flujo (PR 18.2).
 *
 * Función pura — recibe `(estadoActual, tieneBorrador, transicion)` y
 * devuelve si la transición es legal, qué error devolver si no, y si
 * la operación implica además publicar el borrador (caso "activar"
 * con borrador presente — decisión B.1 del plan de scope).
 *
 * Vive separada de los endpoints porque la matriz completa
 * (4 transiciones × 3 estados × con/sin borrador = 24 combinaciones)
 * es chica, crítica y se testea unit sin tocar BD.
 *
 * Las transiciones cubiertas:
 *   - publicar           — exige tener borrador. No cambia estado.
 *   - descartar_borrador — exige tener borrador. No cambia estado.
 *   - activar            — desde borrador o pausado. Si hay borrador,
 *                          la implementación del endpoint debe
 *                          publicarlo en el mismo UPDATE atómico
 *                          (`requierePublicar: true`).
 *   - pausar             — solo desde activo.
 */

import type { EstadoFlujo } from '@/tipos/workflow'

export type TransicionFlujo =
  | 'publicar'
  | 'descartar_borrador'
  | 'activar'
  | 'pausar'

export type CodigoErrorTransicion =
  | 'ya_activo'
  | 'ya_pausado'
  | 'no_se_puede_pausar_borrador'
  | 'sin_borrador'

export interface ResultadoTransicion {
  permitida: boolean
  error?: { codigo: CodigoErrorTransicion; mensaje: string }
  /**
   * Solo true cuando `transicion === 'activar'` y el flujo tiene
   * borrador. El endpoint usa este flag para decidir entre llamar
   * a la función SQL `publicar_borrador_flujo(..., p_activar=true)`
   * vs hacer el UPDATE simple `SET estado='activo'`.
   */
  requierePublicar?: boolean
}

const MENSAJES: Record<CodigoErrorTransicion, string> = {
  ya_activo: 'El flujo ya está activo.',
  ya_pausado: 'El flujo ya está pausado.',
  no_se_puede_pausar_borrador:
    'Este flujo nunca se activó. Activalo primero o descartalo si no lo necesitás.',
  sin_borrador: 'No hay borrador en curso para esta operación.',
}

export function evaluarTransicion(
  estadoActual: EstadoFlujo,
  tieneBorrador: boolean,
  transicion: TransicionFlujo,
): ResultadoTransicion {
  switch (transicion) {
    case 'publicar':
    case 'descartar_borrador': {
      if (!tieneBorrador) {
        return {
          permitida: false,
          error: { codigo: 'sin_borrador', mensaje: MENSAJES.sin_borrador },
        }
      }
      return { permitida: true }
    }

    case 'activar': {
      if (estadoActual === 'activo') {
        return {
          permitida: false,
          error: { codigo: 'ya_activo', mensaje: MENSAJES.ya_activo },
        }
      }
      // Tanto desde 'borrador' como desde 'pausado' es legal.
      // La diferencia operativa es si hay borrador: ese caso
      // empuja la publicación dentro del mismo UPDATE atómico.
      return { permitida: true, requierePublicar: tieneBorrador }
    }

    case 'pausar': {
      if (estadoActual === 'borrador') {
        return {
          permitida: false,
          error: {
            codigo: 'no_se_puede_pausar_borrador',
            mensaje: MENSAJES.no_se_puede_pausar_borrador,
          },
        }
      }
      if (estadoActual === 'pausado') {
        return {
          permitida: false,
          error: { codigo: 'ya_pausado', mensaje: MENSAJES.ya_pausado },
        }
      }
      return { permitida: true }
    }
  }
}
