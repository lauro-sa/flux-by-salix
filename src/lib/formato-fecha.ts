/**
 * Utilidades de formato de fecha ISO.
 * Reemplaza el patrón toLocaleDateString('en-CA') para obtener YYYY-MM-DD.
 */

/**
 * Formatea una fecha como string ISO (YYYY-MM-DD).
 * Alternativa semántica a toLocaleDateString('en-CA').
 * Si se pasa zonaHoraria, convierte a esa zona antes de extraer la fecha.
 */
export function formatearFechaISO(fecha: Date | string, zonaHoraria?: string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  if (zonaHoraria) {
    // Usar toLocaleDateString con 'en-CA' internamente para respetar la zona horaria
    return d.toLocaleDateString('en-CA', { timeZone: zonaHoraria })
  }
  const anio = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/**
 * Formatea una fecha+hora como string ISO (YYYY-MM-DDTHH:mm:ss).
 */
export function formatearFechaHoraISO(fecha: Date | string): string {
  const d = typeof fecha === 'string' ? new Date(fecha) : fecha
  return d.toISOString().slice(0, 19)
}

/**
 * Devuelve los componentes de una fecha (año, mes, día, hora, minuto, día-de-semana) calculados
 * en la zona horaria indicada. En Vercel el server corre en UTC, por eso `getDate()`/`getHours()`
 * directos dan componentes UTC — para crons o lógica "hoy/ayer/mañana" hay que usar esta helper
 * y pasar la zona de la empresa (`empresas.zona_horaria`).
 *
 * @param fecha Fecha de referencia (default: ahora)
 * @param zonaHoraria IANA (ej: 'America/Argentina/Buenos_Aires')
 */
export function obtenerComponentesFecha(
  fecha: Date = new Date(),
  zonaHoraria: string = 'America/Argentina/Buenos_Aires',
): { anio: number; mes: number; dia: number; hora: number; minuto: number; diaSemana: number } {
  // `en-GB` con hour12=false nos devuelve partes 24h estables en la zona pedida.
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: zonaHoraria,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    weekday: 'short',
    hour12: false,
  }).formatToParts(fecha)

  const tomar = (tipo: string) => partes.find(p => p.type === tipo)?.value || '0'
  const mapaDia: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return {
    anio: parseInt(tomar('year'), 10),
    mes: parseInt(tomar('month'), 10),
    dia: parseInt(tomar('day'), 10),
    // `Intl` devuelve "24" para medianoche; normalizamos a 0.
    hora: parseInt(tomar('hour'), 10) % 24,
    minuto: parseInt(tomar('minute'), 10),
    diaSemana: mapaDia[tomar('weekday') as string] ?? 0,
  }
}

/**
 * Devuelve el inicio y fin (timestamps ISO en UTC) del día "hoy" en la zona horaria indicada.
 * Útil para queries `gte('fecha', inicio).lt('fecha', fin)` que filtren por el día local del
 * usuario/empresa, incluso cuando el server corre en UTC.
 */
export function obtenerInicioFinDiaEnZona(
  zonaHoraria: string,
  fecha: Date = new Date(),
): { inicio: string; fin: string; hoyISO: string } {
  const { anio, mes, dia } = obtenerComponentesFecha(fecha, zonaHoraria)
  const hoyISO = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
  // Para convertir medianoche local a UTC usamos el offset de la zona en ese instante.
  const offsetMinutos = obtenerOffsetMinutos(zonaHoraria, fecha)
  // UTC = local - offset. Si zona es -03 (offset -180), medianoche local 00:00 = 03:00 UTC.
  const inicioLocalMs = Date.UTC(anio, mes - 1, dia, 0, 0, 0) - offsetMinutos * 60_000
  const finLocalMs = inicioLocalMs + 24 * 60 * 60 * 1000
  return {
    hoyISO,
    inicio: new Date(inicioLocalMs).toISOString(),
    fin: new Date(finLocalMs).toISOString(),
  }
}

/** Offset (en minutos) entre la zona indicada y UTC, para un instante dado. */
function obtenerOffsetMinutos(zonaHoraria: string, fecha: Date): number {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: zonaHoraria,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(fecha)
  const pick = (tipo: string) => parseInt(partes.find(p => p.type === tipo)?.value || '0', 10)
  const localMs = Date.UTC(pick('year'), pick('month') - 1, pick('day'), pick('hour') % 24, pick('minute'), pick('second'))
  return Math.round((localMs - fecha.getTime()) / 60_000)
}
