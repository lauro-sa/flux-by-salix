/**
 * Cálculo del período de nómina actual a partir de una fecha de referencia
 * y la frecuencia de compensación del empleado. Reutilizado por:
 *  - VistaNomina y editor de nómina (paginación interactiva)
 *  - Editor de plantillas WhatsApp (preview con datos reales por empleado)
 */

export type TipoPeriodo = 'semana' | 'quincena' | 'mes'

export interface RangoPeriodo {
  desde: string
  hasta: string
  etiqueta: string
  tipo: TipoPeriodo
}

/** Mapea la frecuencia de compensación al tipo de período natural. */
export function tipoPeriodoPorFrecuencia(freq?: string | null): TipoPeriodo {
  if (freq === 'semanal') return 'semana'
  if (freq === 'quincenal') return 'quincena'
  return 'mes'
}

/** Calcula el rango del período que contiene la fecha indicada. */
export function calcularPeriodo(
  fechaRef: Date,
  tipo: TipoPeriodo,
  locale = 'es-AR',
): RangoPeriodo {
  const d = new Date(fechaRef)
  const mes = d.getMonth()
  const anio = d.getFullYear()

  if (tipo === 'semana') {
    const dia = d.getDay()
    const lunes = new Date(d)
    lunes.setDate(d.getDate() - (dia === 0 ? 6 : dia - 1))
    const domingo = new Date(lunes)
    domingo.setDate(lunes.getDate() + 6)
    return {
      desde: lunes.toISOString().split('T')[0],
      hasta: domingo.toISOString().split('T')[0],
      etiqueta: `Semana ${lunes.getDate()}-${domingo.getDate()} de ${lunes.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}`,
      tipo,
    }
  }

  if (tipo === 'quincena') {
    if (d.getDate() <= 15) {
      return {
        desde: `${anio}-${String(mes + 1).padStart(2, '0')}-01`,
        hasta: `${anio}-${String(mes + 1).padStart(2, '0')}-15`,
        etiqueta: `Quincena 1-15 ${d.toLocaleDateString(locale, { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}`,
        tipo,
      }
    }
    const ultimoQ = new Date(anio, mes + 1, 0).getDate()
    return {
      desde: `${anio}-${String(mes + 1).padStart(2, '0')}-16`,
      hasta: `${anio}-${String(mes + 1).padStart(2, '0')}-${ultimoQ}`,
      etiqueta: `Quincena 16-${ultimoQ} ${d.toLocaleDateString(locale, { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}`,
      tipo,
    }
  }

  const ultimo = new Date(anio, mes + 1, 0).getDate()
  return {
    desde: `${anio}-${String(mes + 1).padStart(2, '0')}-01`,
    hasta: `${anio}-${String(mes + 1).padStart(2, '0')}-${ultimo}`,
    etiqueta: d.toLocaleDateString(locale, { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase()),
    tipo,
  }
}

/** Atajo: período actual basado en hoy y la frecuencia del empleado. */
export function periodoActual(frecuencia?: string | null, locale = 'es-AR'): RangoPeriodo {
  return calcularPeriodo(new Date(), tipoPeriodoPorFrecuencia(frecuencia), locale)
}

/** Formatea una fecha ISO (YYYY-MM-DD) como "29 abr". Usado en detalle de descuentos. */
export function formatoFechaCortaPeriodo(iso: string, locale = 'es-AR'): string {
  if (!iso) return ''
  const d = new Date(iso + 'T12:00:00')
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short' }).replace('.', '')
}
