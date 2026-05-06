// Catálogo hardcodeado de campos por entidad. Deuda explícita: cuando el módulo
// de entidades dinámicas exponga un endpoint de schema, migrar a introspección.
// Por ahora, agregar entradas manualmente acá cuando se sume una entidad nueva.

/**
 * Catálogo de variables disponibles para el `PickerVariables` del editor
 * de flujos (sub-PR 19.3b).
 *
 * Función pura: dado el `disparador` del flujo, devuelve un árbol de
 * "fuentes" (Entidad / Contacto / Empresa / Sistema / Cambio) con los
 * campos esperables en runtime. La UI pinta los tabs y los items
 * directo desde acá; cero round-trip al servidor.
 *
 * El árbol se deriva de la forma del `contexto` que `enriquecerContexto`
 * (PR 16) inyecta en el resolver al ejecutar el flujo:
 *
 *   {
 *     entidad:   { tipo, ...row de la tabla principal }     (si aplica)
 *     contacto:  { ...row de contactos }                    (si aplica)
 *     actor:     { id, nombre, email, ... }                  (si aplica)
 *     empresa:   { id, nombre, zona_horaria, moneda, ... }
 *     ahora:     ISO string
 *     cambio:    { desde, hasta, ... }                      (solo en eventos)
 *   }
 *
 * Reglas por tipo de disparador:
 *   • entidad.estado_cambio  → Entidad + Contacto + Empresa + Sistema + Cambio
 *   • entidad.creada         → Entidad + Contacto + Empresa + Sistema
 *   • entidad.campo_cambia   → Entidad + Contacto + Empresa + Sistema + Cambio
 *   • actividad.completada   → Entidad (actividad) + Contacto + Empresa + Sistema
 *   • tiempo.cron            → Empresa + Sistema (sin entidad ni contacto)
 *   • tiempo.relativo_a_campo → Entidad + Contacto + Empresa + Sistema (sin Cambio)
 *   • webhook.entrante       → Empresa + Sistema (payload entra en `cambio` libre)
 *   • inbox.mensaje_recibido → Empresa + Sistema + Cambio (sin contacto fijo)
 *   • inbox.conversacion_sin_respuesta → Empresa + Sistema + Cambio
 *
 * Los campos de cada entidad son los más usados de su shape principal.
 * No exponemos columnas internas (FK opacas, audit fields como
 * `actualizado_en`) — solo lo que tiene sentido renderizar en plantillas.
 */

import type { EntidadConEstado } from '@/tipos/estados'
import type { TipoDisparador } from '@/tipos/workflow'

// =============================================================
// Tipos públicos
// =============================================================

/** Una variable concreta que el usuario puede insertar. */
export interface VariableDisponible {
  /** Path técnico (lo que va dentro de `{{ ... }}`). */
  ruta: string
  /** Etiqueta legible en el dropdown (clave i18n). */
  claveI18nEtiqueta: string
  /** Descripción opcional para tooltip / search (clave i18n). */
  claveI18nDescripcion?: string
  /** Tipo del valor — el picker filtra helpers compatibles. */
  tipoValor: 'string' | 'number' | 'fecha' | 'boolean'
}

/** Una "fuente" agrupa variables (tab del picker). */
export interface FuenteVariables {
  clave: 'entidad' | 'contacto' | 'empresa' | 'sistema' | 'cambio' | 'actor'
  /** Clave i18n del label del tab. */
  claveI18nEtiqueta: string
  /** Variables de esta fuente. */
  variables: VariableDisponible[]
}

// =============================================================
// Catálogos por entidad (campos típicos de su tabla principal)
// =============================================================
// Las claves i18n viven en `lib/i18n/{es,en,pt}.ts → flujos.variables.*`.
// Mantener sincronizado con el shape real de cada tabla. Si se renombra
// una columna en SQL, hay que renombrar acá también.

const CAMPOS_PRESUPUESTO: VariableDisponible[] = [
  { ruta: 'entidad.numero', claveI18nEtiqueta: 'flujos.variables.presupuesto.numero', tipoValor: 'string' },
  { ruta: 'entidad.titulo', claveI18nEtiqueta: 'flujos.variables.presupuesto.titulo', tipoValor: 'string' },
  { ruta: 'entidad.total', claveI18nEtiqueta: 'flujos.variables.presupuesto.total', tipoValor: 'number' },
  { ruta: 'entidad.estado_clave', claveI18nEtiqueta: 'flujos.variables.presupuesto.estado_clave', tipoValor: 'string' },
  { ruta: 'entidad.fecha_validez', claveI18nEtiqueta: 'flujos.variables.presupuesto.fecha_validez', tipoValor: 'fecha' },
  { ruta: 'entidad.creado_en', claveI18nEtiqueta: 'flujos.variables.presupuesto.creado_en', tipoValor: 'fecha' },
]

const CAMPOS_CUOTA: VariableDisponible[] = [
  { ruta: 'entidad.numero', claveI18nEtiqueta: 'flujos.variables.cuota.numero', tipoValor: 'number' },
  { ruta: 'entidad.monto', claveI18nEtiqueta: 'flujos.variables.cuota.monto', tipoValor: 'number' },
  { ruta: 'entidad.fecha_vencimiento', claveI18nEtiqueta: 'flujos.variables.cuota.fecha_vencimiento', tipoValor: 'fecha' },
  { ruta: 'entidad.estado_clave', claveI18nEtiqueta: 'flujos.variables.cuota.estado_clave', tipoValor: 'string' },
]

const CAMPOS_ORDEN: VariableDisponible[] = [
  { ruta: 'entidad.numero', claveI18nEtiqueta: 'flujos.variables.orden.numero', tipoValor: 'string' },
  { ruta: 'entidad.titulo', claveI18nEtiqueta: 'flujos.variables.orden.titulo', tipoValor: 'string' },
  { ruta: 'entidad.estado_clave', claveI18nEtiqueta: 'flujos.variables.orden.estado_clave', tipoValor: 'string' },
  { ruta: 'entidad.fecha_programada', claveI18nEtiqueta: 'flujos.variables.orden.fecha_programada', tipoValor: 'fecha' },
]

const CAMPOS_VISITA: VariableDisponible[] = [
  { ruta: 'entidad.titulo', claveI18nEtiqueta: 'flujos.variables.visita.titulo', tipoValor: 'string' },
  { ruta: 'entidad.estado_clave', claveI18nEtiqueta: 'flujos.variables.visita.estado_clave', tipoValor: 'string' },
  { ruta: 'entidad.fecha_programada', claveI18nEtiqueta: 'flujos.variables.visita.fecha_programada', tipoValor: 'fecha' },
  { ruta: 'entidad.direccion', claveI18nEtiqueta: 'flujos.variables.visita.direccion', tipoValor: 'string' },
]

const CAMPOS_ACTIVIDAD: VariableDisponible[] = [
  { ruta: 'entidad.titulo', claveI18nEtiqueta: 'flujos.variables.actividad.titulo', tipoValor: 'string' },
  { ruta: 'entidad.descripcion', claveI18nEtiqueta: 'flujos.variables.actividad.descripcion', tipoValor: 'string' },
  { ruta: 'entidad.estado_clave', claveI18nEtiqueta: 'flujos.variables.actividad.estado_clave', tipoValor: 'string' },
  { ruta: 'entidad.fecha_vencimiento', claveI18nEtiqueta: 'flujos.variables.actividad.fecha_vencimiento', tipoValor: 'fecha' },
]

const CAMPOS_CONVERSACION: VariableDisponible[] = [
  { ruta: 'entidad.canal', claveI18nEtiqueta: 'flujos.variables.conversacion.canal', tipoValor: 'string' },
  { ruta: 'entidad.estado_clave', claveI18nEtiqueta: 'flujos.variables.conversacion.estado_clave', tipoValor: 'string' },
  { ruta: 'entidad.ultima_actividad_en', claveI18nEtiqueta: 'flujos.variables.conversacion.ultima_actividad_en', tipoValor: 'fecha' },
]

const CAMPOS_GENERICOS_ENTIDAD: VariableDisponible[] = [
  { ruta: 'entidad.id', claveI18nEtiqueta: 'flujos.variables.generico.id', tipoValor: 'string' },
  { ruta: 'entidad.estado_clave', claveI18nEtiqueta: 'flujos.variables.generico.estado_clave', tipoValor: 'string' },
]

/**
 * Devuelve los campos de la entidad principal según `entidad_tipo`. Si
 * la entidad no tiene catálogo específico, devolvemos los campos
 * genéricos (id, estado_clave) — mejor poco que nada.
 */
function camposEntidad(tipoEntidad: EntidadConEstado): VariableDisponible[] {
  switch (tipoEntidad) {
    case 'presupuesto': return CAMPOS_PRESUPUESTO
    case 'cuota': return CAMPOS_CUOTA
    case 'orden': return CAMPOS_ORDEN
    case 'visita': return CAMPOS_VISITA
    case 'actividad': return CAMPOS_ACTIVIDAD
    case 'conversacion': return CAMPOS_CONVERSACION
    default: return CAMPOS_GENERICOS_ENTIDAD
  }
}

/**
 * Entidades cuya tabla principal tiene `contacto_id` directo (mismas
 * que en `contexto.ts → ENTIDADES_CON_CONTACTO_DIRECTO`). Si la entidad
 * del disparador NO está acá, la fuente "Contacto" se omite.
 */
const ENTIDADES_CON_CONTACTO: ReadonlySet<EntidadConEstado> = new Set([
  'presupuesto',
  'conversacion',
  'orden',
  'visita',
])

// =============================================================
// Fuentes "fijas" (Empresa, Sistema, Contacto)
// =============================================================

const VARIABLES_CONTACTO: VariableDisponible[] = [
  { ruta: 'contacto.nombre', claveI18nEtiqueta: 'flujos.variables.contacto.nombre', tipoValor: 'string' },
  { ruta: 'contacto.email', claveI18nEtiqueta: 'flujos.variables.contacto.email', tipoValor: 'string' },
  { ruta: 'contacto.telefono', claveI18nEtiqueta: 'flujos.variables.contacto.telefono', tipoValor: 'string' },
  { ruta: 'contacto.empresa', claveI18nEtiqueta: 'flujos.variables.contacto.empresa', tipoValor: 'string' },
]

const VARIABLES_EMPRESA: VariableDisponible[] = [
  { ruta: 'empresa.nombre', claveI18nEtiqueta: 'flujos.variables.empresa.nombre', tipoValor: 'string' },
  { ruta: 'empresa.telefono', claveI18nEtiqueta: 'flujos.variables.empresa.telefono', tipoValor: 'string' },
  { ruta: 'empresa.correo', claveI18nEtiqueta: 'flujos.variables.empresa.correo', tipoValor: 'string' },
  { ruta: 'empresa.pagina_web', claveI18nEtiqueta: 'flujos.variables.empresa.pagina_web', tipoValor: 'string' },
]

const VARIABLES_SISTEMA: VariableDisponible[] = [
  { ruta: 'ahora', claveI18nEtiqueta: 'flujos.variables.sistema.ahora', tipoValor: 'fecha' },
]

const VARIABLES_ACTOR: VariableDisponible[] = [
  { ruta: 'actor.nombre', claveI18nEtiqueta: 'flujos.variables.actor.nombre', tipoValor: 'string' },
  { ruta: 'actor.email', claveI18nEtiqueta: 'flujos.variables.actor.email', tipoValor: 'string' },
  { ruta: 'actor.nombre_completo', claveI18nEtiqueta: 'flujos.variables.actor.nombre_completo', tipoValor: 'string' },
]

const VARIABLES_CAMBIO: VariableDisponible[] = [
  { ruta: 'cambio.desde', claveI18nEtiqueta: 'flujos.variables.cambio.desde', tipoValor: 'string' },
  { ruta: 'cambio.hasta', claveI18nEtiqueta: 'flujos.variables.cambio.hasta', tipoValor: 'string' },
]

// =============================================================
// API pública
// =============================================================

/**
 * Devuelve el árbol de fuentes disponibles para el picker, según el
 * disparador del flujo. Siempre devuelve al menos Empresa + Sistema —
 * los demás se incluyen condicionalmente según el `tipo`.
 */
export function variablesDisponibles(
  disparador: { tipo?: TipoDisparador; configuracion?: Record<string, unknown> } | null,
): { fuentes: FuenteVariables[] } {
  const fuentes: FuenteVariables[] = []
  const tipo = disparador?.tipo

  // ─── Entidad y contacto ──────────────────────────────────────────
  const tipoEntidad = leerEntidadDelDisparador(disparador)
  if (tipoEntidad) {
    fuentes.push({
      clave: 'entidad',
      claveI18nEtiqueta: 'flujos.picker.fuente.entidad',
      variables: camposEntidad(tipoEntidad),
    })
    if (ENTIDADES_CON_CONTACTO.has(tipoEntidad)) {
      fuentes.push({
        clave: 'contacto',
        claveI18nEtiqueta: 'flujos.picker.fuente.contacto',
        variables: VARIABLES_CONTACTO,
      })
    }
  }

  // ─── Actor (solo eventos disparados por usuarios) ────────────────
  if (
    tipo === 'entidad.estado_cambio' ||
    tipo === 'entidad.campo_cambia' ||
    tipo === 'actividad.completada'
  ) {
    fuentes.push({
      clave: 'actor',
      claveI18nEtiqueta: 'flujos.picker.fuente.actor',
      variables: VARIABLES_ACTOR,
    })
  }

  // ─── Empresa siempre ─────────────────────────────────────────────
  fuentes.push({
    clave: 'empresa',
    claveI18nEtiqueta: 'flujos.picker.fuente.empresa',
    variables: VARIABLES_EMPRESA,
  })

  // ─── Sistema siempre (ahora, etc.) ───────────────────────────────
  fuentes.push({
    clave: 'sistema',
    claveI18nEtiqueta: 'flujos.picker.fuente.sistema',
    variables: VARIABLES_SISTEMA,
  })

  // ─── Cambio: solo eventos que tienen `cambios_estado` asociado.
  if (
    tipo === 'entidad.estado_cambio' ||
    tipo === 'entidad.campo_cambia' ||
    tipo === 'inbox.mensaje_recibido' ||
    tipo === 'inbox.conversacion_sin_respuesta'
  ) {
    fuentes.push({
      clave: 'cambio',
      claveI18nEtiqueta: 'flujos.picker.fuente.cambio',
      variables: VARIABLES_CAMBIO,
    })
  }

  return { fuentes }
}

/**
 * Lee `entidad_tipo` de la configuración del disparador, si aplica.
 * Devuelve null para disparadores que no son entidad-bound.
 */
function leerEntidadDelDisparador(
  disparador: { tipo?: TipoDisparador; configuracion?: Record<string, unknown> } | null,
): EntidadConEstado | null {
  if (!disparador?.tipo) return null
  const config = (disparador.configuracion ?? {}) as Record<string, unknown>
  switch (disparador.tipo) {
    case 'entidad.estado_cambio':
    case 'entidad.creada':
    case 'entidad.campo_cambia':
    case 'tiempo.relativo_a_campo':
      return typeof config.entidad_tipo === 'string'
        ? (config.entidad_tipo as EntidadConEstado)
        : null
    case 'actividad.completada':
      return 'actividad'
    case 'tiempo.cron':
    case 'webhook.entrante':
    case 'inbox.mensaje_recibido':
    case 'inbox.conversacion_sin_respuesta':
      return null
  }
}
