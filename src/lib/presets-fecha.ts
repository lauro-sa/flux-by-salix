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
 * @param preset  Clave del preset.
 * @param ahora   Fecha de referencia (default: new Date()). Útil para tests.
 */
export function resolverRangoFecha(preset: string, ahora: Date = new Date()): RangoFecha {
  // Fecha "hoy" normalizada a las 00:00 local — base para todos los cálculos.
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())

  switch (preset) {
    case 'hoy':
      return { desde: hoy, hasta: finDelDia(hoy) }

    case 'ayer': {
      const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1)
      return { desde: ayer, hasta: finDelDia(ayer) }
    }

    case '7d': {
      const inicio = new Date(hoy); inicio.setDate(inicio.getDate() - 6)
      return { desde: inicio, hasta: finDelDia(hoy) }
    }

    case '30d': {
      const inicio = new Date(hoy); inicio.setDate(inicio.getDate() - 29)
      return { desde: inicio, hasta: finDelDia(hoy) }
    }

    case '90d': {
      const inicio = new Date(hoy); inicio.setDate(inicio.getDate() - 89)
      return { desde: inicio, hasta: finDelDia(hoy) }
    }

    case 'esta_semana': {
      // Lunes = inicio de semana (locale AR/ES)
      const dow = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1
      const lun = new Date(hoy); lun.setDate(lun.getDate() - dow)
      const dom = new Date(lun); dom.setDate(dom.getDate() + 6)
      return { desde: lun, hasta: finDelDia(dom) }
    }

    case 'semana_pasada': {
      const dow = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1
      const lun = new Date(hoy); lun.setDate(lun.getDate() - dow - 7)
      const dom = new Date(lun); dom.setDate(dom.getDate() + 6)
      return { desde: lun, hasta: finDelDia(dom) }
    }

    case 'este_mes': {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
      const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
      return { desde: inicio, hasta: finDelDia(fin) }
    }

    case 'mes_pasado': {
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
      const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0)
      return { desde: inicio, hasta: finDelDia(fin) }
    }

    case 'este_anio': {
      const inicio = new Date(hoy.getFullYear(), 0, 1)
      const fin = new Date(hoy.getFullYear(), 11, 31)
      return { desde: inicio, hasta: finDelDia(fin) }
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
export function inicioRangoFechaISO(preset: string, ahora: Date = new Date()): string | null {
  const { desde } = resolverRangoFecha(preset, ahora)
  return desde ? desde.toISOString() : null
}

/**
 * Devuelve ISO del final del día dado (23:59:59.999).
 * Útil para filtros `lte` en campos timestamp.
 */
function finDelDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59, 999)
}
