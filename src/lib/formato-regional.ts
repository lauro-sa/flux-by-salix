/**
 * Utilidad server-side para formatear fechas, horas, moneda y números
 * según la configuración regional de la empresa.
 * Se usa en: API routes, crons, PDFs — cualquier lugar sin acceso a hooks de React.
 *
 * Es el equivalente server-side de useFormato().
 */

interface ConfigRegional {
  moneda?: string
  formato_fecha?: string
  formato_hora?: string
  zona_horaria?: string
}

interface FormatoRegional {
  moneda: (monto: number) => string
  numero: (n: number, decimales?: number) => string
  fecha: (fecha: Date | string, opciones?: { conHora?: boolean; corta?: boolean }) => string
  hora: (fecha: Date | string) => string
  locale: string
  zonaHoraria: string
  formatoHora: string
}

/**
 * Crea un formateador regional a partir de la config de empresa.
 * Uso: const fmt = crearFormato(empresa); fmt.fecha(new Date());
 */
function crearFormato(config: ConfigRegional = {}): FormatoRegional {
  const monedaCodigo = config.moneda || 'ARS'
  const formatoFecha = config.formato_fecha || 'DD/MM/YYYY'
  const fmtHora = config.formato_hora || '24h'
  const zona = config.zona_horaria || 'America/Argentina/Buenos_Aires'

  const locale = zona.startsWith('America/Argentina') ? 'es-AR'
    : zona.startsWith('America') ? 'es-MX'
    : 'es'

  const moneda = (monto: number): string => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: monedaCodigo,
      minimumFractionDigits: 0,
      maximumFractionDigits: monto % 1 === 0 ? 0 : 2,
    }).format(monto)
  }

  const numero = (n: number, decimales?: number): string => {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimales ?? 0,
      maximumFractionDigits: decimales ?? (n % 1 === 0 ? 0 : 2),
    }).format(n)
  }

  const fecha = (input: Date | string, opciones?: { conHora?: boolean; corta?: boolean }): string => {
    const d = typeof input === 'string' ? new Date(input + (input.length === 10 ? 'T12:00:00' : '')) : input
    if (isNaN(d.getTime())) return '—'

    if (opciones?.corta) {
      return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
    }

    const dia = String(d.getDate()).padStart(2, '0')
    const mes = String(d.getMonth() + 1).padStart(2, '0')
    const anio = d.getFullYear()

    let resultado = ''
    switch (formatoFecha) {
      case 'MM/DD/YYYY': resultado = `${mes}/${dia}/${anio}`; break
      case 'YYYY-MM-DD': resultado = `${anio}-${mes}-${dia}`; break
      case 'DD/MM/YYYY':
      default: resultado = `${dia}/${mes}/${anio}`; break
    }

    if (opciones?.conHora) {
      resultado += ' ' + hora(d)
    }

    return resultado
  }

  const hora = (input: Date | string): string => {
    const d = typeof input === 'string' ? new Date(input) : input
    if (isNaN(d.getTime())) return '—'
    const horas = d.getHours()
    const minutos = String(d.getMinutes()).padStart(2, '0')
    if (fmtHora === '12h') {
      const h12 = horas % 12 || 12
      const ampm = horas < 12 ? 'AM' : 'PM'
      return `${h12}:${minutos} ${ampm}`
    }
    return `${String(horas).padStart(2, '0')}:${minutos}`
  }

  return { moneda, numero, fecha, hora, locale, zonaHoraria: zona, formatoHora: fmtHora }
}

export { crearFormato, type ConfigRegional, type FormatoRegional }
