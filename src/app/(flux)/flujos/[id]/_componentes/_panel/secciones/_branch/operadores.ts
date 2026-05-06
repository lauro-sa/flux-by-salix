/**
 * Mapping entre etiquetas UI y operadores del motor de condiciones
 * (sub-PR 19.3c, plan §1.7.3).
 *
 * El motor (`evaluar-condicion.ts`) acepta el set de operadores
 * declarados en `OperadorComparacion`. Para el constructor visual del
 * Branch usamos un subset accesible al usuario final, alineado con el
 * plan §1.7.3:
 *
 *   UI                          OperadorComparacion (motor)
 *   `=`                         igual
 *   `≠`                         distinto
 *   `>`                         mayor
 *   `<`                         menor
 *   `≥`                         mayor_o_igual
 *   `≤`                         menor_o_igual
 *   contiene                    contiene
 *   no contiene                 no_contiene
 *   está vacío                  no_existe
 *   no está vacío               existe
 *
 * Notas:
 *   • "está vacío" → mapeo a `no_existe` (semántica equivalente para
 *     ausencia de valor / null / undefined / string vacío en el
 *     resolver del motor).
 *   • Los demás operadores del motor (`en_lista`, `entre`, `dias_desde`,
 *     `dias_hasta`) NO se exponen en el primer release del builder —
 *     son edge cases que requieren UI adicional (multi-input, range
 *     picker, etc) y no entraron al voto de 19.3c.
 *
 * Este archivo es PURO — solo data. Sin React. Testeable aislado.
 */

import type { OperadorComparacion } from '@/tipos/workflow'

/** Subset de operadores expuestos por el builder visual. */
export type OperadorBuilder = OperadorComparacion

/**
 * Operadores en el orden en que se muestran en el dropdown de la UI.
 * Cada entrada incluye su mapping al operador del motor + flag
 * `requiereValor` para que la fila sepa si pinta el input de valor.
 */
export interface DefinicionOperador {
  motor: OperadorComparacion
  /** Símbolo / etiqueta corta para el botón del select. */
  simbolo: string
  /** Clave i18n del label legible (descripción larga). */
  claveI18nEtiqueta: string
  /**
   * Si false, la fila NO muestra el input de valor (operadores unarios
   * como "está vacío"). El valor del JSON va vacío / undefined.
   */
  requiereValor: boolean
}

export const OPERADORES_BUILDER: readonly DefinicionOperador[] = [
  {
    motor: 'igual',
    simbolo: '=',
    claveI18nEtiqueta: 'flujos.editor.panel.branch.op.igual',
    requiereValor: true,
  },
  {
    motor: 'distinto',
    simbolo: '≠',
    claveI18nEtiqueta: 'flujos.editor.panel.branch.op.distinto',
    requiereValor: true,
  },
  {
    motor: 'mayor',
    simbolo: '>',
    claveI18nEtiqueta: 'flujos.editor.panel.branch.op.mayor',
    requiereValor: true,
  },
  {
    motor: 'menor',
    simbolo: '<',
    claveI18nEtiqueta: 'flujos.editor.panel.branch.op.menor',
    requiereValor: true,
  },
  {
    motor: 'mayor_o_igual',
    simbolo: '≥',
    claveI18nEtiqueta: 'flujos.editor.panel.branch.op.mayor_o_igual',
    requiereValor: true,
  },
  {
    motor: 'menor_o_igual',
    simbolo: '≤',
    claveI18nEtiqueta: 'flujos.editor.panel.branch.op.menor_o_igual',
    requiereValor: true,
  },
  {
    motor: 'contiene',
    simbolo: '∋',
    claveI18nEtiqueta: 'flujos.editor.panel.branch.op.contiene',
    requiereValor: true,
  },
  {
    motor: 'no_contiene',
    simbolo: '∌',
    claveI18nEtiqueta: 'flujos.editor.panel.branch.op.no_contiene',
    requiereValor: true,
  },
  {
    motor: 'no_existe',
    simbolo: '∅',
    claveI18nEtiqueta: 'flujos.editor.panel.branch.op.esta_vacio',
    requiereValor: false,
  },
  {
    motor: 'existe',
    simbolo: '*',
    claveI18nEtiqueta: 'flujos.editor.panel.branch.op.no_esta_vacio',
    requiereValor: false,
  },
] as const

/** Lookup por operador del motor. Devuelve `igual` como fallback seguro. */
export function definicionDeOperador(motor: OperadorComparacion): DefinicionOperador {
  return OPERADORES_BUILDER.find((o) => o.motor === motor) ?? OPERADORES_BUILDER[0]
}
