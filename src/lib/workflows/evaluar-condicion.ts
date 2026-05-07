/**
 * Evaluador de condiciones del motor de workflows (sub-PR 15.2).
 *
 * `evaluarCondicion(condicion, contexto)` resuelve una expresión
 * lógica contra un objeto de contexto plano, devolviendo `true` o
 * `false`. Soporta:
 *
 *   - **Hojas**: `{ campo, operador, valor }` con operadores del
 *     catálogo §4.3 del plan (igual, mayor, contiene, existe, etc.).
 *   - **Compuestas**: `{ operador: 'y' | 'o', condiciones: [...] }`
 *     con anidamiento ilimitado en estructura, limitado a una
 *     profundidad máxima en runtime para evitar recursión maliciosa.
 *
 * Acceso al contexto por dot notation: `entidad.estado_nuevo`,
 * `actor.usuario_id`, `cambio.estado_anterior`.
 *
 * Función pura sin side effects, totalmente testeable con vitest.
 *
 * Para errores estructurales (operador desconocido, profundidad
 * excedida, valor mal tipado para el operador), devuelve `false` y
 * loggea con `console.warn`. Esto asegura que un flujo con condición
 * rota se ejecute predeciblemente (rama "no" toma el control), sin
 * romper el orquestador.
 */

import type {
  CondicionWorkflow,
  CondicionHoja,
  CondicionCompuesta,
  OperadorComparacion,
} from '@/tipos/workflow'

const PROFUNDIDAD_MAX = 5

/**
 * Evalúa una condición contra el contexto. Devuelve true/false.
 * Falla cerrada (false) si la estructura está rota.
 */
export function evaluarCondicion(
  condicion: CondicionWorkflow,
  contexto: Record<string, unknown>,
): boolean {
  return evaluarRecursivo(condicion, contexto, 0)
}

function evaluarRecursivo(
  condicion: CondicionWorkflow,
  contexto: Record<string, unknown>,
  profundidad: number,
): boolean {
  if (profundidad > PROFUNDIDAD_MAX) {
    console.warn(`evaluar-condicion: profundidad ${profundidad} excede el máximo ${PROFUNDIDAD_MAX}`)
    return false
  }

  // Compuesta: si tiene `condiciones` array.
  if ('condiciones' in condicion && Array.isArray(condicion.condiciones)) {
    return evaluarCompuesta(condicion as CondicionCompuesta, contexto, profundidad)
  }

  // Hoja: tiene `campo`.
  if ('campo' in condicion && typeof condicion.campo === 'string') {
    return evaluarHoja(condicion as CondicionHoja, contexto)
  }

  console.warn('evaluar-condicion: condición sin forma reconocida', condicion)
  return false
}

function evaluarCompuesta(
  c: CondicionCompuesta,
  contexto: Record<string, unknown>,
  profundidad: number,
): boolean {
  if (c.condiciones.length === 0) {
    // Sin sub-condiciones: 'y' (vacuously true) vs 'o' (vacuously false).
    return c.operador === 'y'
  }
  if (c.operador === 'y') {
    return c.condiciones.every((sub) =>
      evaluarRecursivo(sub, contexto, profundidad + 1),
    )
  }
  if (c.operador === 'o') {
    return c.condiciones.some((sub) =>
      evaluarRecursivo(sub, contexto, profundidad + 1),
    )
  }
  console.warn(`evaluar-condicion: operador compuesto desconocido "${c.operador}"`)
  return false
}

function evaluarHoja(
  c: CondicionHoja,
  contexto: Record<string, unknown>,
): boolean {
  const valorContexto = leerCampo(c.campo, contexto)
  return aplicarOperador(c.operador, valorContexto, c.valor)
}

/**
 * Lee un campo del contexto usando dot notation. Devuelve undefined
 * si algún tramo del path no existe.
 *
 *   leerCampo('entidad.estado_nuevo', { entidad: { estado_nuevo: 'aceptado' } })
 *   → 'aceptado'
 */
export function leerCampo(
  path: string,
  contexto: Record<string, unknown>,
): unknown {
  const partes = path.split('.')
  let actual: unknown = contexto
  for (const parte of partes) {
    if (actual === null || actual === undefined) return undefined
    if (typeof actual !== 'object') return undefined
    actual = (actual as Record<string, unknown>)[parte]
  }
  return actual
}

/**
 * Aplica el operador a los valores. Devuelve true/false. Falla cerrada
 * en errores de tipo.
 */
function aplicarOperador(
  operador: OperadorComparacion,
  valorContexto: unknown,
  valorEsperado: unknown,
): boolean {
  switch (operador) {
    case 'igual':
      return valoresIguales(valorContexto, valorEsperado)
    case 'distinto':
      return !valoresIguales(valorContexto, valorEsperado)

    case 'mayor':
    case 'menor':
    case 'mayor_o_igual':
    case 'menor_o_igual': {
      const a = aNumeroOFecha(valorContexto)
      const b = aNumeroOFecha(valorEsperado)
      if (a === null || b === null) return false
      if (operador === 'mayor') return a > b
      if (operador === 'menor') return a < b
      if (operador === 'mayor_o_igual') return a >= b
      return a <= b
    }

    case 'contiene':
    case 'no_contiene': {
      if (typeof valorContexto !== 'string' || typeof valorEsperado !== 'string') return false
      const incluye = valorContexto.includes(valorEsperado)
      return operador === 'contiene' ? incluye : !incluye
    }

    case 'existe':
      return valorContexto !== null && valorContexto !== undefined
    case 'no_existe':
      return valorContexto === null || valorContexto === undefined

    case 'en_lista':
    case 'no_en_lista': {
      if (!Array.isArray(valorEsperado)) return false
      const esta = valorEsperado.some((v) => valoresIguales(v, valorContexto))
      return operador === 'en_lista' ? esta : !esta
    }

    case 'entre': {
      if (!Array.isArray(valorEsperado) || valorEsperado.length !== 2) return false
      const v = aNumeroOFecha(valorContexto)
      const min = aNumeroOFecha(valorEsperado[0])
      const max = aNumeroOFecha(valorEsperado[1])
      if (v === null || min === null || max === null) return false
      return v >= min && v <= max
    }

    case 'dias_desde':
    case 'dias_hasta': {
      // valorContexto: fecha (ISO string). valorEsperado: número de días.
      if (typeof valorContexto !== 'string') return false
      if (typeof valorEsperado !== 'number') return false
      const fecha = Date.parse(valorContexto)
      if (Number.isNaN(fecha)) return false
      const ahora = Date.now()
      const diffMs = operador === 'dias_desde' ? ahora - fecha : fecha - ahora
      const diffDias = diffMs / (1000 * 60 * 60 * 24)
      return diffDias >= valorEsperado
    }

    default: {
      // exhaustivo: si TypeScript pasó es porque agregaron operador y
      // se olvidaron de implementar acá. Falla cerrada.
      const _exhaustive: never = operador
      console.warn(`evaluar-condicion: operador no implementado "${_exhaustive as string}"`)
      return false
    }
  }
}

/**
 * Igualdad por valor para tipos primitivos. Para arrays/objetos, es
 * referencial (no profunda). Acepta string === number cuando ambos
 * representan el mismo número (ej: '5' === 5 → true), porque los
 * datos del contexto pueden venir tipados de jsonb.
 */
function valoresIguales(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a === null || b === null) return false
  if (a === undefined || b === undefined) return false
  // Cross-type number coercion para casos jsonb (ej: 100000 vs "100000").
  if (typeof a === 'number' && typeof b === 'string') return a === Number(b)
  if (typeof a === 'string' && typeof b === 'number') return Number(a) === b
  return false
}

/**
 * Convierte string ISO o number a number (timestamp ms para fechas).
 * Devuelve null si no es comparable como número/fecha.
 */
function aNumeroOFecha(v: unknown): number | null {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string') {
    const n = Number(v)
    if (!Number.isNaN(n) && v.trim() !== '') return n
    const t = Date.parse(v)
    if (!Number.isNaN(t)) return t
  }
  return null
}
