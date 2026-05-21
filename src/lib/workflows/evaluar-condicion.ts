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
  CondicionHorario,
  DiaSemana,
  OperadorComparacion,
} from '@/tipos/workflow'

const PROFUNDIDAD_MAX = 5

/**
 * Evalúa una condición contra el contexto. Devuelve true/false.
 * Falla cerrada (false) si la estructura está rota.
 *
 * `ahora` opcional: permite inyectar un Date determinístico para tests.
 * En producción se usa Date.now() (default).
 */
export function evaluarCondicion(
  condicion: CondicionWorkflow,
  contexto: Record<string, unknown>,
  ahora: Date = new Date(),
): boolean {
  return evaluarRecursivo(condicion, contexto, 0, ahora)
}

function evaluarRecursivo(
  condicion: CondicionWorkflow,
  contexto: Record<string, unknown>,
  profundidad: number,
  ahora: Date,
): boolean {
  if (profundidad > PROFUNDIDAD_MAX) {
    console.warn(`evaluar-condicion: profundidad ${profundidad} excede el máximo ${PROFUNDIDAD_MAX}`)
    return false
  }

  // Horaria: discriminada por `tipo === 'horario'`.
  if (
    'tipo' in condicion &&
    (condicion as { tipo?: unknown }).tipo === 'horario'
  ) {
    return evaluarHorario(condicion as CondicionHorario, ahora)
  }

  // Compuesta: si tiene `condiciones` array.
  if ('condiciones' in condicion && Array.isArray(condicion.condiciones)) {
    return evaluarCompuesta(condicion as CondicionCompuesta, contexto, profundidad, ahora)
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
  ahora: Date,
): boolean {
  if (c.condiciones.length === 0) {
    // Sin sub-condiciones: 'y' (vacuously true) vs 'o' (vacuously false).
    return c.operador === 'y'
  }
  if (c.operador === 'y') {
    return c.condiciones.every((sub) =>
      evaluarRecursivo(sub, contexto, profundidad + 1, ahora),
    )
  }
  if (c.operador === 'o') {
    return c.condiciones.some((sub) =>
      evaluarRecursivo(sub, contexto, profundidad + 1, ahora),
    )
  }
  console.warn(`evaluar-condicion: operador compuesto desconocido "${c.operador}"`)
  return false
}

/**
 * Mapeo del `weekday` corto en inglés (lo único que `Intl.DateTimeFormat`
 * devuelve de forma estable cross-engine) al código interno de Flux.
 *
 * NO usamos `getDay()` porque devuelve el día en la zona horaria LOCAL
 * del servidor, no la zona horaria del flujo. En Vercel el server corre
 * en UTC (memoria feedback_timezone_server.md), así que `getDay()` para
 * un correo recibido a las 23:30 hora argentina devolvería el día
 * SIGUIENTE en UTC (02:30 UTC). `Intl.DateTimeFormat` con timeZone
 * explícito resuelve esto correctamente.
 */
const WEEKDAY_EN_A_DIA: Readonly<Record<string, DiaSemana>> = {
  Mon: 'lun',
  Tue: 'mar',
  Wed: 'mie',
  Thu: 'jue',
  Fri: 'vie',
  Sat: 'sab',
  Sun: 'dom',
}

function partesFechaEnZona(
  ahora: Date,
  zonaHoraria: string,
): { dia: DiaSemana; horaMinutos: number } | null {
  try {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: zonaHoraria,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(ahora)
    const get = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? ''
    const dia = WEEKDAY_EN_A_DIA[get('weekday')]
    const hh = Number(get('hour'))
    const mm = Number(get('minute'))
    if (!dia || Number.isNaN(hh) || Number.isNaN(mm)) return null
    // Intl.DateTimeFormat con hour12:false devuelve "24" para medianoche
    // en algunos engines; normalizamos a 0 para consistencia.
    const horaNormalizada = hh === 24 ? 0 : hh
    return { dia, horaMinutos: horaNormalizada * 60 + mm }
  } catch (e) {
    // Zona horaria inválida (IANA desconocida). Loggeamos y fallamos
    // cerrada — el evaluador devuelve false, lo que para una condición
    // "modo: fuera" se traduce en "no está fuera de horario" → flujo
    // no actúa. Más conservador que asumir cualquier cosa.
    console.warn(`evaluar-condicion: zona_horaria inválida "${zonaHoraria}"`, e)
    return null
  }
}

function aMinutos(hhmm: string): number | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm)
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

function evaluarHorario(c: CondicionHorario, ahora: Date): boolean {
  // Semántica: la condición SÓLO aplica los días marcados. Si el día
  // de hoy no está en `dias`, la condición evalúa false (no matchea)
  // independientemente del modo. Esto le da control explícito al
  // usuario: lo que marca es lo que cuenta. Si quiere cubrir más días,
  // los marca o agrega otro rango. Versión previa hacía "días no
  // marcados = fuera de horario automático", confuso e impredecible
  // (modificado 2026-05-20 a pedido de Sal).
  if (!Array.isArray(c.dias) || c.dias.length === 0) {
    return false
  }

  const partes = partesFechaEnZona(ahora, c.zona_horaria)
  if (partes === null) return false

  // Día no marcado → no aplica.
  if (!c.dias.includes(partes.dia)) return false

  // Rango "todo el día": el día completo cuenta como matcheado para
  // este rango. El modo del rango se ignora porque "fuera de las 24
  // horas" no tiene sentido lógico. Útil para "Sáb-Dom son fuera de
  // horario todo el día" combinado con OR de varios rangos.
  if (c.todo_el_dia === true) {
    return true
  }

  const desde = aMinutos(c.hora_desde)
  const hasta = aMinutos(c.hora_hasta)
  if (desde === null || hasta === null) return false

  // Rango cross-medianoche (ej: 22:00 → 06:00). Si desde > hasta, el
  // intervalo "dentro" abarca [desde, 1440) ∪ [0, hasta).
  let horaDentroDeRango: boolean
  if (desde <= hasta) {
    // Rango normal: [desde, hasta). Hasta es exclusivo (08:00-18:00
    // significa "hasta las 18:00 sin incluirlas", que es lo intuitivo
    // para "horario laboral hasta las 18hs").
    horaDentroDeRango = partes.horaMinutos >= desde && partes.horaMinutos < hasta
  } else {
    horaDentroDeRango = partes.horaMinutos >= desde || partes.horaMinutos < hasta
  }

  return c.modo === 'dentro' ? horaDentroDeRango : !horaDentroDeRango
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
