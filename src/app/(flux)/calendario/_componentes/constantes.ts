/**
 * constantes.ts — Constantes y utilidades compartidas del módulo Calendario.
 * Centraliza nombres de meses/días, funciones de fecha y formateadores
 * que antes se duplicaban en 8+ archivos.
 * Se usa en: todas las vistas, MiniCalendario, BarraHerramientas, PopoverEvento.
 */

// --- Nombres de meses y días ---

/** Nombres completos de meses en español */
export const NOMBRES_MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/** Nombres cortos de meses (3 letras) */
export const NOMBRES_MESES_CORTOS = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

/** Nombres cortos de meses en minúscula (para etiquetas compactas) */
export const NOMBRES_MESES_CORTOS_MIN = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
]

/** Nombres completos de días de la semana (domingo = 0) */
export const NOMBRES_DIAS_COMPLETOS = [
  'Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado',
]

/** Nombres cortos de días (domingo = 0) */
export const NOMBRES_DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

/** Nombres mínimos de días en minúscula, lunes primero (para vistas con columnas) */
export const NOMBRES_DIAS_SEMANA = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom']

/** Cabeceras de 2 letras para mini-calendarios (lunes primero) */
export const CABECERAS_DIAS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do']

/** Encabezados de 3 letras para cuadrícula mensual (lunes primero) */
export const DIAS_ENCABEZADO = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

// --- Utilidades de fecha ---

/** Compara si dos fechas son el mismo día */
export function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** Comprueba si la fecha es hoy */
export function esHoy(fecha: Date): boolean {
  return mismoDia(fecha, new Date())
}

/** Comprueba si la fecha es mañana */
export function esManiana(fecha: Date): boolean {
  const maniana = new Date()
  maniana.setDate(maniana.getDate() + 1)
  return mismoDia(fecha, maniana)
}

/** Formatea fecha como YYYY-MM-DD para usar como clave de mapa */
export function claveDelDia(fecha: Date): string {
  const anio = fecha.getFullYear()
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

/** Inicio de semana (lunes) para una fecha dada */
export function inicioSemana(fecha: Date): Date {
  const d = new Date(fecha)
  d.setHours(0, 0, 0, 0)
  const dia = d.getDay()
  const diff = dia === 0 ? 6 : dia - 1
  d.setDate(d.getDate() - diff)
  return d
}

/** Genera los 7 días de la semana que contiene la fecha dada (lun–dom) */
export function diasDeLaSemana(fecha: Date): Date[] {
  const lunes = inicioSemana(fecha)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes)
    d.setDate(lunes.getDate() + i)
    return d
  })
}

/** Obtiene índice del día en la semana (0=lun, 6=dom) */
export function indiceDiaSemana(fecha: Date): number {
  const dia = fecha.getDay()
  return dia === 0 ? 6 : dia - 1
}

/**
 * Genera la cuadrícula de semanas para un mes dado.
 * Incluye días de meses adyacentes para completar las semanas.
 */
export function generarCuadriculaMes(anio: number, mes: number): Date[][] {
  const primerDia = new Date(anio, mes, 1)
  const ultimoDia = new Date(anio, mes + 1, 0)
  const diaInicio = primerDia.getDay()
  const offsetInicio = diaInicio === 0 ? 6 : diaInicio - 1
  const dias: Date[] = []

  for (let i = offsetInicio - 1; i >= 0; i--) dias.push(new Date(anio, mes, -i))
  for (let i = 1; i <= ultimoDia.getDate(); i++) dias.push(new Date(anio, mes, i))
  const restante = 7 - (dias.length % 7)
  if (restante < 7) {
    for (let i = 1; i <= restante; i++) dias.push(new Date(anio, mes + 1, i))
  }

  const semanas: Date[][] = []
  for (let i = 0; i < dias.length; i += 7) semanas.push(dias.slice(i, i + 7))
  return semanas
}

/** Parsea un string ISO a Date */
export function parsearFecha(iso: string): Date {
  return new Date(iso)
}

// --- Formateadores de hora ---

/**
 * Formatea hora corta desde un Date respetando formato 12h/24h.
 * @param fecha - Fecha a formatear
 * @param formato24h - true para 24h (default), false para 12h AM/PM
 */
export function formatearHoraCorta(fecha: Date, formato24h = true): string {
  const h = fecha.getHours()
  const m = fecha.getMinutes()
  if (!formato24h) {
    const periodo = h >= 12 ? 'PM' : 'AM'
    const h12 = h % 12 || 12
    return `${h12}:${String(m).padStart(2, '0')} ${periodo}`
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Formatea hora desde ISO string respetando formato.
 * @param isoStr - Fecha ISO
 * @param formato24h - true para 24h, false para 12h
 */
export function formatearHoraISO(isoStr: string, formato24h = true): string {
  const fecha = new Date(isoStr)
  if (isNaN(fecha.getTime())) return ''
  return formatearHoraCorta(fecha, formato24h)
}

/**
 * Formatea una etiqueta de hora entera (para el eje de la cuadrícula).
 * @param hora - Hora entera (0-23)
 * @param formato24h - true para "08:00", false para "8 AM"
 */
export function formatearEtiquetaHora(hora: number, formato24h = true): string {
  if (!formato24h) {
    if (hora === 0) return '12 AM'
    if (hora === 12) return '12 PM'
    const periodo = hora >= 12 ? 'PM' : 'AM'
    const h12 = hora % 12
    return `${h12} ${periodo}`
  }
  return `${String(hora).padStart(2, '0')}:00`
}

// --- Formateadores de duración ---

/** Formatea duración en horas legibles: "1hs", "2.5hs", "30min" */
export function formatearDuracion(inicioStr: string | Date, finStr: string | Date): string {
  const inicio = typeof inicioStr === 'string' ? new Date(inicioStr) : inicioStr
  const fin = typeof finStr === 'string' ? new Date(finStr) : finStr
  const minutos = Math.round((fin.getTime() - inicio.getTime()) / 60000)
  if (minutos < 60) return `${minutos}min`
  const horas = minutos / 60
  return horas % 1 === 0 ? `${horas}hs` : `${horas.toFixed(1)}hs`
}

/** Formatea duración a partir de dos posiciones Y (px) en la cuadrícula */
export function formatearDuracionDesdeY(y1: number, y2: number, alturaFila: number): string {
  const minutos = Math.round(Math.abs(y2 - y1) / alturaFila * 60)
  if (minutos < 60) return `${minutos}min`
  const horas = minutos / 60
  return horas % 1 === 0 ? `${horas}hs` : `${horas.toFixed(1)}hs`
}

// --- Constantes de cuadrícula ---

/** Hora de inicio por defecto de la cuadrícula (se puede sobreescribir con config) */
export const HORA_INICIO_DEFAULT = 6
/** Hora de fin por defecto de la cuadrícula */
export const HORA_FIN_DEFAULT = 22
/** Altura en px de cada fila de 1 hora */
export const ALTURA_FILA = 60
