/**
 * Helpers para mostrar la hora de una visita respetando el flag
 * `tiene_hora_especifica`. Si es false, la hora dentro de fecha_programada
 * es placeholder (00:00) y no debe mostrarse: la visita está programada
 * solo por día.
 *
 * Estos helpers se usan en listado, tarjetas, dashboard, recorrido, etc.
 */

interface VisitaHora {
  fecha_programada: string | null
  tiene_hora_especifica?: boolean | null
  fecha_inicio?: string | null
  fecha_llegada?: string | null
}

/**
 * Devuelve la hora programada (string ISO) o null si la visita no tiene
 * hora específica. Útil para condicionar el render de un chip de hora
 * en tarjetas y listados.
 */
export function horaProgramadaVisible(v: VisitaHora): string | null {
  if (!v.fecha_programada) return null
  if (v.tiene_hora_especifica === true) return v.fecha_programada
  return null
}

/**
 * Devuelve la hora REAL de la visita: la primera marcada por el visitador
 * (en_camino → fecha_inicio, llegada → fecha_llegada). Null si nadie la
 * inició aún. Sirve para mostrar "hora real" en el detalle/chatter cuando
 * la visita ya pasó.
 */
export function horaRealVisible(v: VisitaHora): string | null {
  return v.fecha_inicio || v.fecha_llegada || null
}
