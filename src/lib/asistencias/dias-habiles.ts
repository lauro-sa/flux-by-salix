/**
 * Cálculo de días hábiles para una empresa.
 *
 * Centraliza la lógica que hasta ahora vivía inline en `/api/asistencias/nomina`:
 * combina los feriados oficiales del país (vía `date-holidays`) con la tabla
 * `feriados` de la empresa (que el admin puede editar). El resultado es un set
 * de strings YYYY-MM-DD listo para chequeos rápidos.
 *
 * Lo usan: cálculo de nómina, helpers de "próximo pago" de Salix IA, calendario.
 */

import Holidays from 'date-holidays'
import type { SupabaseAdmin } from '@/tipos/salix-ia'

/** Convierte una fecha a string YYYY-MM-DD usando UTC para evitar saltos de día por timezone. */
function aISO(fecha: Date): string {
  return fecha.toISOString().split('T')[0]
}

/**
 * Carga el set de fechas YYYY-MM-DD que son feriado para la empresa entre `desde` y `hasta`.
 * Combina:
 *  - Feriados oficiales del país de la empresa (date-holidays, type=public)
 *  - Feriados custom de la tabla `feriados` (activos)
 *
 * Si la empresa no tiene país configurado, default 'AR'.
 */
export async function cargarFeriados(
  admin: SupabaseAdmin,
  empresaId: string,
  desde: Date,
  hasta: Date,
): Promise<Set<string>> {
  const set = new Set<string>()

  const { data: empresaData } = await admin
    .from('empresas')
    .select('pais')
    .eq('id', empresaId)
    .single()

  const pais = (empresaData?.pais as string) || 'AR'
  const hd = new Holidays(pais)
  const anioDesde = desde.getUTCFullYear()
  const anioHasta = hasta.getUTCFullYear()

  for (let anio = anioDesde; anio <= anioHasta; anio++) {
    for (const h of hd.getHolidays(anio)) {
      if (h.type === 'public') {
        set.add(h.date.split(' ')[0])
      }
    }
  }

  // Feriados custom de la empresa (sobreescriben/complementan los oficiales).
  const { data: feriadosCustom } = await admin
    .from('feriados')
    .select('fecha')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .gte('fecha', aISO(desde))
    .lte('fecha', aISO(hasta))

  for (const f of (feriadosCustom || []) as { fecha: string }[]) {
    set.add(f.fecha)
  }

  return set
}

/** Verifica si una fecha es día hábil: lunes a viernes y no está en el set de feriados. */
export function esDiaHabil(fecha: Date, feriadosSet: Set<string>): boolean {
  const dow = fecha.getUTCDay() // 0=domingo, 6=sábado
  if (dow === 0 || dow === 6) return false
  return !feriadosSet.has(aISO(fecha))
}

/**
 * Devuelve el array de las próximas N fechas hábiles a partir de `desde` (exclusivo).
 * Útil para responder "¿cuándo cobro?" — el rango de pago suele ser los primeros N
 * días hábiles después del cierre del periodo.
 *
 * Ejemplo: si el periodo cierra jueves 15 y N=3, devuelve [viernes 16, lunes 19, martes 20]
 * (saltando sábado 17 y domingo 18).
 */
export function proximasFechasHabiles(
  desde: Date,
  n: number,
  feriadosSet: Set<string>,
): Date[] {
  if (n <= 0) return []
  const resultado: Date[] = []
  const cursor = new Date(Date.UTC(
    desde.getUTCFullYear(),
    desde.getUTCMonth(),
    desde.getUTCDate(),
  ))

  // Avanzar 1 día desde la fecha base (exclusivo).
  cursor.setUTCDate(cursor.getUTCDate() + 1)

  // Tope de seguridad: no más de 30 días calendario hacia adelante.
  let intentos = 0
  while (resultado.length < n && intentos < 30) {
    if (esDiaHabil(cursor, feriadosSet)) {
      resultado.push(new Date(cursor))
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    intentos++
  }

  return resultado
}

/**
 * Helper de alto nivel: dada una empresa + fecha base + N, devuelve el rango de
 * fechas hábiles disponible para pagar. Carga los feriados internamente.
 *
 * Devuelve `{ desde, hasta, fechas }` donde `fechas` es el array completo de N días.
 */
export async function calcularRangoPagoHabiles(
  admin: SupabaseAdmin,
  empresaId: string,
  fechaCierre: Date,
  diasHabilesPago: number = 3,
): Promise<{ desde: string; hasta: string; fechas: string[] }> {
  // Cargamos un margen de 14 días naturales hacia adelante para cubrir feriados.
  const fin = new Date(fechaCierre)
  fin.setUTCDate(fin.getUTCDate() + 14)

  const feriados = await cargarFeriados(admin, empresaId, fechaCierre, fin)
  const fechas = proximasFechasHabiles(fechaCierre, diasHabilesPago, feriados)

  return {
    desde: aISO(fechas[0] ?? fechaCierre),
    hasta: aISO(fechas[fechas.length - 1] ?? fechaCierre),
    fechas: fechas.map(aISO),
  }
}
