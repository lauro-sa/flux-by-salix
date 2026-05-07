/**
 * Validación de "publicabilidad" de un flujo (PR 18.1).
 *
 * Antes de que un flujo pueda activarse o publicarse, su disparador y
 * sus acciones tienen que matchear los shapes que el motor sabe
 * ejecutar. La definición libremente editable en estado 'borrador'
 * (e incluso en `borrador_jsonb` mientras se está editando un activo)
 * puede tener la forma `{}` o estar incompleta — eso es OK durante el
 * diseño, pero NO se puede activar.
 *
 * Esta función NO modifica nada y NO toca BD. Solo valida formas.
 * Devuelve un array de errores legibles, que el endpoint sirve como
 * 422 al usuario para que la UI los muestre tipo "no podés activar
 * porque: …, …".
 *
 * Reusa los type guards existentes en src/tipos/workflow.ts (PR 13-17),
 * así no se duplica la lista de shapes ni la lógica.
 */

import {
  esDisparadorEntidadEstadoCambio,
  esDisparadorTiempoCron,
  esDisparadorTiempoRelativoACampo,
  esAccionConocida,
  esAccionEnviarWhatsappPlantilla,
  esAccionCrearActividad,
  esAccionCambiarEstadoEntidad,
  esAccionNotificarUsuario,
  esAccionEsperar,
  esAccionCondicionBranch,
  esAccionTerminarFlujo,
  esTipoDisparador,
  type AccionWorkflow,
} from '@/tipos/workflow'

export interface ResultadoValidacion {
  ok: boolean
  /** Mensajes legibles. Siempre vacío si ok=true. */
  errores: string[]
}

/**
 * Error de validación enriquecido para el editor visual (sub-PR 19.4).
 *
 * A diferencia de `ResultadoValidacion.errores` (lista plana de strings
 * usada por los endpoints), este shape correlaciona cada error con el
 * paso o el disparador concreto que lo origina. La UI lo usa para:
 *
 *   - Pintar marker rojo en la tarjeta correspondiente del canvas.
 *   - Hacer scroll-to-paso desde el banner de "Ver errores".
 *
 * `pasoId` es el UUID estable cliente-side asignado por `darIdAAccion`
 * (ver `lib/workflows/ids-pasos.ts`). Para errores en pasos dentro de
 * un branch (acciones_si / acciones_no), `pasoId` apunta al paso interno
 * — no al branch padre — para que el scroll vaya directo al problema.
 */
export type ErrorValidacion =
  | { ruta: { tipo: 'disparador' }; mensaje: string }
  | { ruta: { tipo: 'paso'; pasoId: string }; mensaje: string }

export interface ResultadoValidacionConPasos {
  ok: boolean
  errores: ErrorValidacion[]
}

/**
 * Tipos de disparador que el motor (PRs 13-17) ejecuta hoy. Los demás
 * están declarados en el catálogo TS pero todavía no tienen
 * dispatcher/handler. Si un usuario configura uno de esos, la
 * validación lo rechaza con un mensaje claro.
 */
const DISPARADORES_SOPORTADOS = new Set<string>([
  'entidad.estado_cambio',
  'tiempo.cron',
  'tiempo.relativo_a_campo',
])

/**
 * Tipos de acción con shape específico ya implementado por el
 * executor (sub-PR 15.1 + 15.2). Las demás acciones del catálogo
 * (enviar_correo_*, asignar_usuario, etc.) están reservadas pero
 * todavía no se ejecutan, así que rechazamos su uso al activar.
 */
const ACCIONES_SOPORTADAS = new Set<string>([
  'enviar_whatsapp_plantilla',
  'crear_actividad',
  'cambiar_estado_entidad',
  'notificar_usuario',
  'esperar',
  'condicion_branch',
  'terminar_flujo',
])

/**
 * Valida que el par (disparador, acciones) sea publicable. Los
 * argumentos son `unknown` porque vienen del jsonb crudo; los type
 * guards los narrowean adentro.
 */
export function validarPublicable(
  disparador: unknown,
  acciones: unknown,
): ResultadoValidacion {
  const errores: string[] = []
  errores.push(...validarDisparador(disparador))
  errores.push(...validarListaAcciones(acciones, 'acciones'))
  return { ok: errores.length === 0, errores }
}

function validarDisparador(d: unknown): string[] {
  if (typeof d !== 'object' || d === null) {
    return ['El disparador no está configurado.']
  }
  const r = d as Record<string, unknown>
  if (typeof r.tipo !== 'string') {
    return ['El disparador no tiene un tipo válido.']
  }
  if (!esTipoDisparador(r.tipo)) {
    return [`El disparador "${r.tipo}" no existe en el catálogo.`]
  }
  if (!DISPARADORES_SOPORTADOS.has(r.tipo)) {
    return [
      `El disparador "${r.tipo}" todavía no lo ejecuta el motor. ` +
      'Disponibles: cambio de estado de entidad, tiempo (cron) y tiempo (relativo a un campo).',
    ]
  }
  // Shape específico por tipo.
  if (r.tipo === 'entidad.estado_cambio') {
    return esDisparadorEntidadEstadoCambio(d)
      ? []
      : ['El disparador de cambio de estado está incompleto: requiere entidad y estado destino.']
  }
  if (r.tipo === 'tiempo.cron') {
    return esDisparadorTiempoCron(d)
      ? []
      : ['El disparador de tiempo (cron) requiere una expresión válida.']
  }
  if (r.tipo === 'tiempo.relativo_a_campo') {
    return esDisparadorTiempoRelativoACampo(d)
      ? []
      : ['El disparador relativo a campo requiere entidad, campo de fecha y desplazamiento en días.']
  }
  return [`El disparador "${r.tipo}" no se puede validar todavía.`]
}

/**
 * Valida un array de acciones. Recursivo para condicion_branch
 * (acciones_si y acciones_no son a su vez listas de acciones).
 *
 * `ruta` es una pista para los mensajes de error: en el primer
 * llamado es 'acciones', y al recursar pasa 'acciones[2].acciones_si'
 * para que el usuario sepa exactamente dónde está el problema.
 */
function validarListaAcciones(lista: unknown, ruta: string): string[] {
  if (!Array.isArray(lista)) {
    return [`${ruta}: debe ser una lista de acciones.`]
  }
  if (lista.length === 0) {
    return [`${ruta}: el flujo debe tener al menos una acción.`]
  }
  const errores: string[] = []
  lista.forEach((accion, i) => {
    errores.push(...validarAccion(accion, `${ruta}[${i}]`))
  })
  return errores
}

function validarAccion(a: unknown, ruta: string): string[] {
  if (!esAccionConocida(a)) {
    const tipo = (a as { tipo?: unknown })?.tipo
    return [`${ruta}: tipo de acción "${String(tipo)}" no reconocido.`]
  }
  const tipo = (a as AccionWorkflow).tipo
  if (!ACCIONES_SOPORTADAS.has(tipo)) {
    return [
      `${ruta}: la acción "${tipo}" todavía no la ejecuta el motor. ` +
      'Disponibles: WhatsApp con plantilla, crear actividad, cambiar estado, notificar usuario, esperar, condición y terminar flujo.',
    ]
  }
  // Validar shape específico de cada tipo soportado.
  switch (tipo) {
    case 'enviar_whatsapp_plantilla':
      return esAccionEnviarWhatsappPlantilla(a)
        ? []
        : [`${ruta}: WhatsApp con plantilla requiere canal, teléfono, plantilla e idioma.`]
    case 'crear_actividad':
      return esAccionCrearActividad(a)
        ? []
        : [`${ruta}: crear actividad requiere tipo de actividad y título.`]
    case 'cambiar_estado_entidad':
      return esAccionCambiarEstadoEntidad(a)
        ? []
        : [`${ruta}: cambiar estado requiere entidad, ID y estado destino.`]
    case 'notificar_usuario':
      return esAccionNotificarUsuario(a)
        ? []
        : [`${ruta}: notificar usuario requiere usuario destino y título.`]
    case 'esperar':
      return esAccionEsperar(a)
        ? []
        : [`${ruta}: esperar requiere duración (entre 1s y 30 días) o fecha absoluta, exactamente uno.`]
    case 'condicion_branch': {
      if (!esAccionCondicionBranch(a)) {
        return [`${ruta}: la condición no tiene una expresión válida.`]
      }
      // Recursar a las dos sub-listas. Si están vacías la validación
      // de validarListaAcciones devuelve el mensaje "debe tener al
      // menos una acción", lo que tiene sentido (un branch con rama
      // vacía es probablemente un error de diseño).
      const errores: string[] = []
      errores.push(...validarListaAcciones(a.acciones_si, `${ruta}.acciones_si`))
      errores.push(...validarListaAcciones(a.acciones_no, `${ruta}.acciones_no`))
      return errores
    }
    case 'terminar_flujo':
      return esAccionTerminarFlujo(a)
        ? []
        : [`${ruta}: terminar flujo solo acepta un motivo opcional.`]
  }
  return [`${ruta}: la acción "${tipo}" no se puede validar todavía.`]
}

// =====================================================================
// Validación con pasos identificados (sub-PR 19.4)
// =====================================================================

/**
 * Mismos shape checks que `validarPublicable`, pero correlacionando
 * cada error con el `pasoId` del paso (o con el disparador) que lo
 * origina. Pensado para el editor visual: el banner rojo y los markers
 * por-paso necesitan saber a qué tarjeta pertenece cada error.
 *
 * `pasosConId` debe venir hidratado con UUIDs estables (ver
 * `lib/workflows/ids-pasos.ts`). Acá leemos el `id` de cada paso para
 * armar la `ruta` del error. Para `condicion_branch` recursamos en
 * `acciones_si` y `acciones_no`, asumiendo que también traen `id`
 * (lo garantiza `asignarIdsAcciones` desde el editor).
 *
 * Caso especial — array vacío:
 *   La regla "el flujo debe tener al menos una acción" no se puede
 *   atribuir a un paso (no hay paso). En ese caso devolvemos el error
 *   con `ruta = disparador` para que el "Ver errores" abra el panel
 *   del disparador, que es el lugar más coherente desde donde el
 *   usuario puede empezar a agregar acciones (el botón "+ Agregar
 *   paso" del canvas ya está visible al lado).
 *
 * Caso especial — branch con rama vacía:
 *   Atribuimos el error al branch en sí (no a un paso interno, porque
 *   no existe). Mismo criterio que arriba.
 */
export function validarFlujoConPasos(
  disparador: unknown,
  pasosConId: unknown,
): ResultadoValidacionConPasos {
  const errores: ErrorValidacion[] = []

  for (const m of validarDisparador(disparador)) {
    errores.push({ ruta: { tipo: 'disparador' }, mensaje: m })
  }

  errores.push(...validarListaConPasos(pasosConId, null))

  return { ok: errores.length === 0, errores }
}

/**
 * Recursivo. `branchPadreId` es el id del branch al que pertenece esta
 * lista (rama si/no), o `null` si es la lista raíz. Sirve para atribuir
 * el error de "rama vacía" al branch padre cuando corresponda.
 */
function validarListaConPasos(
  lista: unknown,
  branchPadreId: string | null,
): ErrorValidacion[] {
  if (!Array.isArray(lista)) {
    return [
      branchPadreId
        ? { ruta: { tipo: 'paso', pasoId: branchPadreId }, mensaje: 'Una rama del branch no es una lista válida de acciones.' }
        : { ruta: { tipo: 'disparador' }, mensaje: 'El flujo no tiene una lista de acciones válida.' },
    ]
  }
  if (lista.length === 0) {
    return [
      branchPadreId
        ? { ruta: { tipo: 'paso', pasoId: branchPadreId }, mensaje: 'Una rama del branch está vacía. Agregá al menos una acción.' }
        : { ruta: { tipo: 'disparador' }, mensaje: 'El flujo debe tener al menos una acción.' },
    ]
  }

  const errores: ErrorValidacion[] = []
  for (const accion of lista) {
    errores.push(...validarAccionConPaso(accion))
  }
  return errores
}

function validarAccionConPaso(a: unknown): ErrorValidacion[] {
  // El paso debe traer `id` cliente-side. Si no lo trae (caso defensivo
  // — no debería pasar porque el editor hidrata con `asignarIdsAcciones`),
  // atribuimos el error al disparador para que el "Ver errores" abra al
  // menos un panel coherente.
  const pasoId =
    a && typeof a === 'object' && 'id' in a && typeof (a as { id: unknown }).id === 'string'
      ? (a as { id: string }).id
      : null

  const enPaso = (mensaje: string): ErrorValidacion =>
    pasoId
      ? { ruta: { tipo: 'paso', pasoId }, mensaje }
      : { ruta: { tipo: 'disparador' }, mensaje }

  // Para branches NO usamos `validarAccion` directo: ese helper recursa
  // en `acciones_si`/`acciones_no` con la ruta textual y duplicaría la
  // recursión que hace `validarListaConPasos`. Hacemos shape-check del
  // branch acá y delegamos las ramas a la recursión correcta.
  const tipo = (a as { tipo?: unknown } | null)?.tipo
  if (tipo === 'condicion_branch') {
    if (!esAccionCondicionBranch(a)) {
      return [enPaso('La condición no tiene una expresión válida.')]
    }
    const branch = a as {
      acciones_si?: unknown
      acciones_no?: unknown
    }
    const subErrores: ErrorValidacion[] = []
    subErrores.push(...validarListaConPasos(branch.acciones_si, pasoId))
    subErrores.push(...validarListaConPasos(branch.acciones_no, pasoId))
    return subErrores
  }

  // Resto de tipos: reusar `validarAccion` (no recursa para no-branches)
  // y limpiar el prefijo textual "paso: " — la ruta ya la lleva el
  // `ErrorValidacion` discriminado.
  const mensajesShape = validarAccion(a, 'paso')
  return mensajesShape.map((m) => enPaso(m.replace(/^paso[^:]*:\s*/, '')))
}
