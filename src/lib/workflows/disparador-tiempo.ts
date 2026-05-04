/**
 * Disparadores time-driven del motor de workflows (PR 17).
 *
 * Soporta dos formas de disparador:
 *
 *   1. `tiempo.cron`              → expresión cron clásica `0 9 * * *`
 *   2. `tiempo.relativo_a_campo`  → "entidades cuyo campo + delta = hoy"
 *
 * Componentes principales:
 *   - parsearCron / matcheaCron: parser y evaluador de expresiones cron
 *     (5 campos: minuto, hora, día_mes, mes, día_semana). Operadores
 *     soportados: *, *​/N, N-M, N,M,O.
 *   - proximaEjecucion(expresion, ultima):
 *     Calcula el próximo timestamp en que la expresión matchea, partiendo
 *     de `ultima` (excluyendo ese minuto). **Si `ultima` es null, parte
 *     de `now()`** — esto es CRÍTICO para flujos recién creados:
 *     no deben disparar retroactivamente para ventanas que ya pasaron
 *     en el día actual. Caso: usuario crea flujo `0 9 * * *` a las 9:00:30
 *     → primer disparo es mañana 9am, no hoy mismo en el tick de 9:01.
 *   - cargarMatchsRelativoACampo: ejecuta el SELECT contra la tabla de la
 *     entidad para encontrar entidades cuyo `campo_fecha + delta_dias`
 *     cae en la ventana actual (con tolerancia opcional).
 *
 * El cron `/api/cron/disparar-workflows-tiempo` orquesta: itera flujos
 * activos con disparador.tipo LIKE 'tiempo.%' y consume estas funciones
 * para decidir qué disparar.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DisparadorTiempoCron,
  DisparadorTiempoRelativoACampo,
} from '@/tipos/workflow'
import { TABLA_PRINCIPAL_POR_ENTIDAD } from '@/lib/estados/mapeo'

// =============================================================
// Parser de expresiones cron
// =============================================================
// Cron de 5 campos: minuto (0-59), hora (0-23), día_mes (1-31),
// mes (1-12), día_semana (0-6, 0=domingo).

interface CronParsed {
  minutos: Set<number>
  horas: Set<number>
  diasMes: Set<number>
  meses: Set<number>
  diasSemana: Set<number>
}

const RANGOS: Record<keyof CronParsed, [number, number]> = {
  minutos: [0, 59],
  horas: [0, 23],
  diasMes: [1, 31],
  meses: [1, 12],
  diasSemana: [0, 6],
}

export class CronInvalidoError extends Error {
  constructor(public readonly expresion: string, public readonly detalle: string) {
    super(`Expresión cron inválida "${expresion}": ${detalle}`)
    this.name = 'CronInvalidoError'
  }
}

/**
 * Parsea una expresión cron de 5 campos. Operadores soportados por
 * campo: `*`, `*\/N`, `N-M`, `N,M,O`, `N` (literal).
 *
 * @throws CronInvalidoError si el formato es incorrecto o algún valor
 *         está fuera del rango permitido para su campo.
 */
export function parsearCron(expresion: string): CronParsed {
  const partes = expresion.trim().split(/\s+/)
  if (partes.length !== 5) {
    throw new CronInvalidoError(
      expresion,
      `se esperaban 5 campos separados por espacio, llegaron ${partes.length}`,
    )
  }
  const [m, h, dm, mes, ds] = partes
  return {
    minutos: parsearCampo(m, RANGOS.minutos, expresion),
    horas: parsearCampo(h, RANGOS.horas, expresion),
    diasMes: parsearCampo(dm, RANGOS.diasMes, expresion),
    meses: parsearCampo(mes, RANGOS.meses, expresion),
    diasSemana: parsearCampo(ds, RANGOS.diasSemana, expresion),
  }
}

function parsearCampo(
  campo: string,
  [min, max]: [number, number],
  expresionCompleta: string,
): Set<number> {
  const result = new Set<number>()
  // Soporta lista separada por coma: "1,3,5"
  for (const sub of campo.split(',')) {
    if (sub === '*') {
      for (let i = min; i <= max; i++) result.add(i)
      continue
    }
    // step: "*/N" o "N-M/S"
    const stepMatch = sub.match(/^(.+)\/(\d+)$/)
    if (stepMatch) {
      const base = stepMatch[1]
      const step = parseInt(stepMatch[2], 10)
      if (step <= 0) throw new CronInvalidoError(expresionCompleta, `step ${step} debe ser > 0`)
      let from = min
      let to = max
      if (base !== '*') {
        const r = parsearRango(base, [min, max], expresionCompleta)
        from = r[0]
        to = r[1]
      }
      for (let i = from; i <= to; i += step) result.add(i)
      continue
    }
    const [from, to] = parsearRango(sub, [min, max], expresionCompleta)
    for (let i = from; i <= to; i++) result.add(i)
  }
  return result
}

function parsearRango(
  s: string,
  [min, max]: [number, number],
  expresionCompleta: string,
): [number, number] {
  if (s.includes('-')) {
    const [a, b] = s.split('-').map((x) => parseInt(x, 10))
    if (Number.isNaN(a) || Number.isNaN(b)) {
      throw new CronInvalidoError(expresionCompleta, `rango inválido "${s}"`)
    }
    if (a < min || b > max || a > b) {
      throw new CronInvalidoError(expresionCompleta, `rango ${a}-${b} fuera de [${min},${max}]`)
    }
    return [a, b]
  }
  const n = parseInt(s, 10)
  if (Number.isNaN(n) || n < min || n > max) {
    throw new CronInvalidoError(expresionCompleta, `valor "${s}" fuera de [${min},${max}]`)
  }
  return [n, n]
}

/**
 * ¿La fecha matchea la expresión cron?
 * Compara minuto, hora, día_mes, mes y día_semana de la fecha contra
 * los conjuntos parseados. Trabajamos en UTC para evitar ambigüedad
 * de zona horaria — el cron del proyecto corre en UTC y los flujos
 * cron declaran sus tiempos en UTC también. Para horarios "locales"
 * de empresa, usar `tiempo.relativo_a_campo` que sí maneja zona
 * horaria, o programar la expresión cron equivalente UTC.
 */
export function matcheaCron(parsed: CronParsed, fecha: Date): boolean {
  return (
    parsed.minutos.has(fecha.getUTCMinutes()) &&
    parsed.horas.has(fecha.getUTCHours()) &&
    parsed.diasMes.has(fecha.getUTCDate()) &&
    parsed.meses.has(fecha.getUTCMonth() + 1) &&
    parsed.diasSemana.has(fecha.getUTCDay())
  )
}

/**
 * Devuelve el próximo Date (truncado al minuto) en que la expresión
 * matchea, partiendo de `ultima` (excluyendo ese minuto exacto).
 *
 * **REGLA CRÍTICA — ultima = null**:
 * Si `ultima` es null (flujo recién creado, nunca disparó), partimos
 * de `ahora` (truncado al minuto siguiente) en lugar de "infinitely
 * past". Esto evita el bug de "creé un flujo de noche y se disparó
 * retroactivamente" — un flujo `0 9 * * *` creado a las 9:00:30 NO
 * debe disparar en el tick de las 9:01:00 con la ventana de hoy ya
 * pasada. Su primer disparo es mañana 9am.
 *
 * Algoritmo: brute force minuto a minuto (max 7 días = 10080
 * iteraciones), barato en TS. Si nunca encuentra match en 7 días,
 * la expresión es "imposible" (ej: día_mes=31 + mes=2) y devolvemos
 * null para que el cron la skipee.
 *
 * @param expresion cron de 5 campos.
 * @param ultima ISO timestamp del último disparo, o null si nunca disparó.
 * @param ahora opcional para tests, default new Date().
 * @returns próxima fecha que matchea, o null si imposible/inválido.
 */
export function proximaEjecucion(
  expresion: string,
  ultima: string | Date | null,
  ahora: Date = new Date(),
): Date | null {
  let parsed: CronParsed
  try {
    parsed = parsearCron(expresion)
  } catch {
    return null
  }

  // Punto de partida del barrido depende de si el flujo ya disparó:
  //
  // - ultima === null  →  truncarAlMinuto(ahora) + 1 minuto.
  //   REGLA CRÍTICA NO RETROACTIVO: el primer minuto evaluado es
  //   estrictamente posterior al minuto en curso. Si el flujo se crea
  //   a las 09:00:30 con expresión `0 9 * * *`, el cursor parte de
  //   09:01 → próximo match es mañana 09:00, NO hoy 09:00 (que ya pasó).
  //
  // - ultima presente  →  truncarAlMinuto(ultima) + 1 minuto.
  //   Esto puede arrancar en el pasado si el cron se atrasó. El
  //   endpoint dispara cuando `proxima <= ahora`, recuperando ventanas
  //   perdidas (patrón Sidekiq/Quartz).
  let cursor: Date
  if (ultima === null) {
    cursor = new Date(truncarAlMinuto(ahora).getTime() + 60_000)
  } else {
    const ultimaDate = typeof ultima === 'string' ? new Date(ultima) : ultima
    cursor = new Date(truncarAlMinuto(ultimaDate).getTime() + 60_000)
  }

  // Brute force minuto a minuto, hasta 7 días.
  const limite = 7 * 24 * 60
  for (let i = 0; i < limite; i++) {
    if (matcheaCron(parsed, cursor)) return cursor
    cursor = new Date(cursor.getTime() + 60_000)
  }
  return null
}

function truncarAlMinuto(d: Date): Date {
  return new Date(Math.floor(d.getTime() / 60_000) * 60_000)
}

// =============================================================
// Disparador tiempo.relativo_a_campo
// =============================================================

export interface MatchRelativoACampo {
  entidad_id: string
  /** Fecha de hoy (YYYY-MM-DD) usada en clave_idempotencia. */
  fecha_clave: string
}

/**
 * Calcula el rango de fechas a buscar y ejecuta SELECT contra la tabla
 * principal de la entidad. Devuelve los IDs de las filas que matchean.
 *
 * Lógica:
 *   "vence en delta_dias" significa: campo_fecha = (hoy - delta_dias).
 *   Ejemplo: si hoy=2026-05-04 y delta=-3, buscamos filas con
 *   campo_fecha = 2026-05-07 (que están a 3 días en el futuro).
 *   Con tolerancia_dias=2 ampliamos el rango hacia atrás:
 *   campo_fecha BETWEEN 2026-05-05 AND 2026-05-07.
 *
 * Zona horaria: el "hoy" se calcula en `zona_horaria_empresa`. Las
 * comparaciones contra `campo_fecha` (timestamptz) usan el mismo offset.
 */
export async function cargarMatchsRelativoACampo(
  flujo: { id: string; empresa_id: string; disparador: DisparadorTiempoRelativoACampo },
  zonaHoraria: string,
  ahora: Date,
  admin: SupabaseClient,
): Promise<MatchRelativoACampo[]> {
  const cfg = flujo.disparador.configuracion
  const tabla = TABLA_PRINCIPAL_POR_ENTIDAD[cfg.entidad_tipo]
  if (!tabla) return []

  const tolerancia = cfg.tolerancia_dias ?? 0

  // Fecha "hoy" en la zona horaria de la empresa, formato YYYY-MM-DD.
  const hoyLocal = formatearFechaEnZona(ahora, zonaHoraria)

  // Rango de fechas que buscamos en campo_fecha:
  //   inicio = hoy - delta_dias - tolerancia
  //   fin    = hoy - delta_dias
  // (campo_fecha >= inicio AND campo_fecha < fin + 1 día)
  const fechaFin = sumarDias(hoyLocal, -cfg.delta_dias)
  const fechaInicio = sumarDias(fechaFin, -tolerancia)

  let query = admin
    .from(tabla)
    .select('id')
    .eq('empresa_id', flujo.empresa_id)
    .gte(cfg.campo_fecha, fechaInicio)
    .lt(cfg.campo_fecha, sumarDias(fechaFin, 1))

  if (cfg.filtro_estado_clave && cfg.filtro_estado_clave.length > 0) {
    query = query.in('estado_clave', cfg.filtro_estado_clave)
  }

  const { data, error } = await query
  if (error) {
    console.warn(
      JSON.stringify({
        nivel: 'warn',
        mensaje: 'cargar_matchs_relativo_a_campo_error',
        flujo_id: flujo.id,
        detalle: error.message,
      }),
    )
    return []
  }
  return (data ?? []).map((row) => ({
    entidad_id: (row as { id: string }).id,
    fecha_clave: hoyLocal,
  }))
}

/** Devuelve YYYY-MM-DD del momento dado en la zona horaria especificada. */
function formatearFechaEnZona(d: Date, zona: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(d) // 'en-CA' devuelve YYYY-MM-DD ya formateado
}

/** Suma `n` días a una fecha YYYY-MM-DD y devuelve YYYY-MM-DD. */
function sumarDias(fecha: string, n: number): string {
  const [y, m, d] = fecha.split('-').map((x) => parseInt(x, 10))
  // Date en UTC para evitar drift por zona horaria local del runtime.
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}
