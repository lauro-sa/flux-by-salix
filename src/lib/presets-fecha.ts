/**
 * Presets de fecha compartidos entre módulos.
 *
 * Convierte una clave de preset (ej: 'hoy', '7d', 'este_mes') en un rango
 * { desde, hasta } que los endpoints usan para filtrar registros por fecha.
 *
 * Todos los módulos con filtros de fecha (contactos, actividades, visitas,
 * productos, presupuestos, órdenes, asistencias) usan este helper para
 * mantener consistencia en el comportamiento.
 */

/** Claves de preset válidas para filtros de rango de fecha */
export type PresetFecha =
  | 'hoy'
  | 'ayer'
  | '7d'         // últimos 7 días (inclusive hoy)
  | '30d'        // últimos 30 días
  | '90d'        // últimos 90 días
  | 'esta_semana'
  | 'semana_pasada'
  | 'este_mes'
  | 'mes_pasado'
  | 'este_anio'

/** Resultado con fechas de inicio y fin del rango (en UTC ISO). */
export interface RangoFecha {
  desde: Date | null
  hasta: Date | null
}

/**
 * Resuelve un preset de fecha a un rango concreto.
 * - "desde" es inclusive (gte)
 * - "hasta" es inclusive (lte) — para timestamps, usar `lt` con el inicio del día siguiente
 *
 * IMPORTANTE: Si se llama desde server-side, pasar `zonaHoraria` (de `empresas.zona_horaria`).
 * Sin zona, usa la del servidor (UTC en Vercel) y el corte "hoy" queda desfasado después
 * de las 21 hs Argentina.
 *
 * @param preset  Clave del preset.
 * @param ahora   Fecha de referencia (default: new Date()). Útil para tests.
 * @param zonaHoraria  IANA (ej: 'America/Argentina/Buenos_Aires'). Si se omite, usa la zona del runtime.
 */
export function resolverRangoFecha(preset: string, ahora: Date = new Date(), zonaHoraria?: string): RangoFecha {
  // Componentes de la fecha de referencia en la zona pedida.
  const { anio, mes, dia } = zonaHoraria
    ? componentesEnZona(ahora, zonaHoraria)
    : { anio: ahora.getFullYear(), mes: ahora.getMonth() + 1, dia: ahora.getDate() }

  // Crea un Date representando la medianoche local (en la zona pedida) expresada como UTC.
  // De esta forma `.toISOString()` devuelve el instante correcto (ej: 00:00 AR = 03:00 UTC).
  const fechaLocal = (a: number, m: number, d: number): Date => {
    if (zonaHoraria) {
      const offsetMin = offsetEnZona(zonaHoraria, new Date(Date.UTC(a, m - 1, d, 12, 0, 0)))
      return new Date(Date.UTC(a, m - 1, d, 0, 0, 0) - offsetMin * 60_000)
    }
    return new Date(a, m - 1, d)
  }
  const finDelDiaLocal = (a: number, m: number, d: number): Date => {
    if (zonaHoraria) {
      const offsetMin = offsetEnZona(zonaHoraria, new Date(Date.UTC(a, m - 1, d, 12, 0, 0)))
      return new Date(Date.UTC(a, m - 1, d, 23, 59, 59, 999) - offsetMin * 60_000)
    }
    return new Date(a, m - 1, d, 23, 59, 59, 999)
  }

  // "Hoy" como Date (medianoche local) — referencia para aritmética de días.
  const hoy = fechaLocal(anio, mes, dia)
  const sumarDias = (base: Date, dias: number): Date => {
    const r = new Date(base); r.setUTCDate(r.getUTCDate() + dias); return r
  }
  const componentesDe = (d: Date) => {
    if (zonaHoraria) return componentesEnZona(d, zonaHoraria)
    return { anio: d.getFullYear(), mes: d.getMonth() + 1, dia: d.getDate() }
  }

  switch (preset) {
    case 'hoy':
      return { desde: hoy, hasta: finDelDiaLocal(anio, mes, dia) }

    case 'ayer': {
      const a = sumarDias(hoy, -1)
      const c = componentesDe(a)
      return { desde: a, hasta: finDelDiaLocal(c.anio, c.mes, c.dia) }
    }

    case '7d': {
      const inicio = sumarDias(hoy, -6)
      return { desde: inicio, hasta: finDelDiaLocal(anio, mes, dia) }
    }

    case '30d': {
      const inicio = sumarDias(hoy, -29)
      return { desde: inicio, hasta: finDelDiaLocal(anio, mes, dia) }
    }

    case '90d': {
      const inicio = sumarDias(hoy, -89)
      return { desde: inicio, hasta: finDelDiaLocal(anio, mes, dia) }
    }

    case 'esta_semana': {
      // Lunes = inicio de semana (locale AR/ES). Calculado sobre día-de-semana local.
      const diaSemana = zonaHoraria ? componentesEnZonaDiaSem(ahora, zonaHoraria) : hoy.getDay()
      const dow = diaSemana === 0 ? 6 : diaSemana - 1
      const lun = sumarDias(hoy, -dow)
      const dom = sumarDias(lun, 6)
      const cf = componentesDe(dom)
      return { desde: lun, hasta: finDelDiaLocal(cf.anio, cf.mes, cf.dia) }
    }

    case 'semana_pasada': {
      const diaSemana = zonaHoraria ? componentesEnZonaDiaSem(ahora, zonaHoraria) : hoy.getDay()
      const dow = diaSemana === 0 ? 6 : diaSemana - 1
      const lun = sumarDias(hoy, -dow - 7)
      const dom = sumarDias(lun, 6)
      const cf = componentesDe(dom)
      return { desde: lun, hasta: finDelDiaLocal(cf.anio, cf.mes, cf.dia) }
    }

    case 'este_mes': {
      const inicio = fechaLocal(anio, mes, 1)
      const ultDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
      return { desde: inicio, hasta: finDelDiaLocal(anio, mes, ultDia) }
    }

    case 'mes_pasado': {
      const mesAnterior = mes === 1 ? 12 : mes - 1
      const anioMesAnt = mes === 1 ? anio - 1 : anio
      const inicio = fechaLocal(anioMesAnt, mesAnterior, 1)
      const ultDia = new Date(Date.UTC(anioMesAnt, mesAnterior, 0)).getUTCDate()
      return { desde: inicio, hasta: finDelDiaLocal(anioMesAnt, mesAnterior, ultDia) }
    }

    case 'este_anio': {
      const inicio = fechaLocal(anio, 1, 1)
      return { desde: inicio, hasta: finDelDiaLocal(anio, 12, 31) }
    }

    default:
      return { desde: null, hasta: null }
  }
}

/**
 * Variante que devuelve solo el "desde" como ISO string (el caso más común
 * en los módulos: "creado_en >= X"). El "hasta" se ignora porque para "hoy"
 * o rangos que llegan hasta el presente no se necesita tope superior.
 *
 * @returns ISO string del inicio del rango, o null si el preset no aplica.
 */
export function inicioRangoFechaISO(preset: string, ahora: Date = new Date(), zonaHoraria?: string): string | null {
  const { desde } = resolverRangoFecha(preset, ahora, zonaHoraria)
  return desde ? desde.toISOString() : null
}

// ─── Helpers internos para cálculos en zona horaria ───

function componentesEnZona(fecha: Date, zona: string): { anio: number; mes: number; dia: number } {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit', hour12: false,
  }).formatToParts(fecha)
  const pick = (t: string) => parseInt(partes.find(p => p.type === t)?.value || '0', 10)
  return { anio: pick('year'), mes: pick('month'), dia: pick('day') }
}

function componentesEnZonaDiaSem(fecha: Date, zona: string): number {
  const partes = new Intl.DateTimeFormat('en-GB', { timeZone: zona, weekday: 'short' }).formatToParts(fecha)
  const wd = partes.find(p => p.type === 'weekday')?.value || 'Sun'
  const mapa: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return mapa[wd] ?? 0
}

function offsetEnZona(zona: string, instante: Date): number {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(instante)
  const pick = (t: string) => parseInt(partes.find(p => p.type === t)?.value || '0', 10)
  const localMs = Date.UTC(pick('year'), pick('month') - 1, pick('day'), pick('hour') % 24, pick('minute'), pick('second'))
  return Math.round((localMs - instante.getTime()) / 60_000)
}
