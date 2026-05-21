/**
 * Resumen breve (1 línea) de una `CondicionWorkflow` para mostrar en
 * la tarjeta del branch del canvas. Sin esto, la tarjeta solo muestra
 * "Sí: X · No: Y" pero no qué condición evalúa — el usuario tiene que
 * abrir el panel para recordar la lógica.
 *
 * Soporta los tres shapes del motor:
 *   • `CondicionHorario`  → "Fuera de Lun–Vie 09:00–17:00"
 *   • `CondicionHoja`     → "variable es igual a valor"
 *   • `CondicionCompuesta` → "3 condiciones (todas)" / "2 condiciones (alguna)"
 *
 * Devuelve `null` si la condición está vacía / inválida (la tarjeta
 * cae al texto default "Sin condición configurada").
 */

import type {
  CondicionHoja,
  CondicionHorario,
  CondicionCompuesta,
  CondicionWorkflow,
  DiaSemana,
} from '@/tipos/workflow'

type TFn = (clave: string) => string

const ETIQUETAS_DIA_CORTAS: Record<DiaSemana, string> = {
  lun: 'Lun',
  mar: 'Mar',
  mie: 'Mié',
  jue: 'Jue',
  vie: 'Vie',
  sab: 'Sáb',
  dom: 'Dom',
}

const ORDEN_DIAS: DiaSemana[] = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom']

/**
 * Compactar lista de días contiguos: ['lun','mar','mie','jue','vie']
 * → 'Lun–Vie'. ['lun','mie','vie'] → 'Lun, Mié, Vie' (no contiguos).
 */
function resumirDias(dias: DiaSemana[]): string {
  if (dias.length === 0) return ''
  if (dias.length === 7) return 'Todos los días'
  // Sólo compactamos si son contiguos en el orden canónico.
  const indices = dias.map((d) => ORDEN_DIAS.indexOf(d)).sort((a, b) => a - b)
  const esContiguo = indices.every((idx, i) => i === 0 || idx === indices[i - 1] + 1)
  if (esContiguo && indices.length >= 2) {
    const primero = ORDEN_DIAS[indices[0]]
    const ultimo = ORDEN_DIAS[indices[indices.length - 1]]
    return `${ETIQUETAS_DIA_CORTAS[primero]}–${ETIQUETAS_DIA_CORTAS[ultimo]}`
  }
  return dias.map((d) => ETIQUETAS_DIA_CORTAS[d]).join(', ')
}

export function resumirCondicionHorario(c: CondicionHorario): string {
  const prefijo = c.modo === 'fuera' ? 'Fuera de ' : 'Dentro de '
  const dias = resumirDias(c.dias)
  // "Todo el día" tiene prioridad sobre el rango horario.
  if (c.todo_el_dia === true) {
    return `${dias} todo el día`
  }
  const horario =
    c.hora_desde && c.hora_hasta ? `${c.hora_desde}–${c.hora_hasta}` : ''
  return [prefijo + dias, horario].filter(Boolean).join(' ')
}

export function resumirCondicionHoja(c: CondicionHoja, t: TFn): string {
  const campo = c.campo?.trim() || '(campo vacío)'
  const op = t(`flujos.editor.panel.branch.op.${c.operador}`)
  const valorTexto = (() => {
    if (c.valor === undefined || c.valor === null) return ''
    return String(c.valor).slice(0, 30)
  })()
  if (!valorTexto) return `${campo} ${op}`
  return `${campo} ${op} ${valorTexto}`
}

export function resumirCondicionCompuesta(c: CondicionCompuesta, t: TFn): string {
  const n = c.condiciones.length
  if (n === 0) return ''
  if (n === 1) {
    const primera = c.condiciones[0]
    if (esCondicionHorarioShape(primera)) return resumirCondicionHorario(primera)
    if (esHojaShape(primera)) return resumirCondicionHoja(primera, t)
    return '1 condición'
  }
  // Caso especial: si TODAS son CondicionHorario (rangos múltiples),
  // generamos un resumen compacto. Como cada rango tiene su propio
  // modo (post-2026-05-20), cada rango se resume por separado y se
  // concatenan con " · ". Ej: "Fuera de Lun–Vie 09:00–17:00 · Sáb–Dom
  // todo el día".
  if (c.condiciones.every(esCondicionHorarioShape)) {
    const horarios = c.condiciones as CondicionHorario[]
    return horarios.map(resumirCondicionHorario).join(' · ')
  }
  const conector = c.operador === 'y'
    ? t('flujos.editor.panel.branch.operador_y')
    : t('flujos.editor.panel.branch.operador_o')
  return `${n} condiciones (${conector})`
}

function esCondicionHorarioShape(c: unknown): c is CondicionHorario {
  return (
    typeof c === 'object' &&
    c !== null &&
    (c as { tipo?: unknown }).tipo === 'horario'
  )
}

function esHojaShape(c: unknown): c is CondicionHoja {
  return (
    typeof c === 'object' &&
    c !== null &&
    typeof (c as { campo?: unknown }).campo === 'string'
  )
}

/**
 * Punto de entrada principal. Recibe la `condicion` cruda del paso
 * `condicion_branch` y devuelve un string corto o `null`.
 */
export function resumirCondicion(c: CondicionWorkflow | null | undefined, t: TFn): string | null {
  if (!c || typeof c !== 'object') return null
  if (esCondicionHorarioShape(c)) {
    const r = resumirCondicionHorario(c)
    return r.length > 0 ? r : null
  }
  if (Array.isArray((c as CondicionCompuesta).condiciones)) {
    const r = resumirCondicionCompuesta(c as CondicionCompuesta, t)
    return r.length > 0 ? r : null
  }
  if (esHojaShape(c)) {
    return resumirCondicionHoja(c, t)
  }
  return null
}
