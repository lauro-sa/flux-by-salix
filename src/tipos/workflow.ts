/**
 * Tipos del motor de workflows / automatizaciones de Flux.
 *
 * Modela las definiciones de flujos, ejecuciones y acciones diferidas
 * sobre las que opera el dispatcher (PR 14) y el worker (PR 15+). El
 * catálogo de tipos de disparador y de tipos de acción se mantiene
 * acá como única fuente de verdad — el SQL no los materializa con
 * CHECK constraints (decisión del PR 13).
 *
 * Tablas relacionadas:
 *   - flujos               → definiciones por empresa.
 *   - ejecuciones_flujo    → log por ejecución concreta.
 *   - acciones_pendientes  → cola de acciones diferidas.
 *
 * Migración fuente: sql/054_workflows_schema.sql
 */

import type {
  CambioEstado,
  EntidadConEstado,
} from '@/tipos/estados'
import { ENTIDADES_CON_ESTADO } from '@/tipos/estados'

// =============================================================
// Catálogo de tipos de disparador
// =============================================================
// Cada flujo se dispara por exactamente un trigger de la lista. La
// configuración específica varía por tipo y se modela como
// discriminated union sobre el campo `tipo`.

/**
 * Metadata UI compartida por todos los disparadores.
 *
 * `etiqueta?: string` es el nombre user-friendly que muestra el editor
 * (header del panel + chip del canvas). Si está ausente, la UI usa
 * `etiquetaDisparador` como fallback. El motor (PR 14, 17) lo ignora —
 * es metadata exclusiva de UI, persistida dentro del jsonb del flujo.
 *
 * Lo modelamos como type intersection para que cada `DisparadorXxx`
 * lo herede sin tener que agregarlo a 9 interfaces.
 */
export interface MetadataUiDisparador {
  etiqueta?: string
}

export type TipoDisparador =
  | 'entidad.estado_cambio'
  | 'entidad.creada'
  | 'entidad.campo_cambia'
  | 'actividad.completada'
  | 'tiempo.cron'
  | 'tiempo.relativo_a_campo'
  | 'webhook.entrante'
  | 'inbox.mensaje_recibido'
  | 'inbox.conversacion_sin_respuesta'

export const TIPOS_DISPARADOR: readonly TipoDisparador[] = [
  'entidad.estado_cambio',
  'entidad.creada',
  'entidad.campo_cambia',
  'actividad.completada',
  'tiempo.cron',
  'tiempo.relativo_a_campo',
  'webhook.entrante',
  'inbox.mensaje_recibido',
  'inbox.conversacion_sin_respuesta',
] as const

// El único trigger que el PR 14 procesa. Los demás se implementan en
// sus PRs respectivos (cron en PR 17, webhook entrante en PR 18+, etc.).
export interface DisparadorEntidadEstadoCambio {
  tipo: 'entidad.estado_cambio'
  configuracion: {
    /** Tipo de entidad cuyo cambio dispara el flujo. */
    entidad_tipo: EntidadConEstado
    /** Estado destino que dispara. */
    hasta_clave: string
    /**
     * Estado de origen requerido. Si es null/undefined, dispara desde
     * cualquier estado anterior.
     */
    desde_clave?: string | null
    /**
     * Sub-PR 20.5: si true, el flujo dispara solo cuando el evento es
     * una creación (estado_anterior IS NULL en cambios_estado). Si
     * false/undefined, dispara en cualquier transición que llegue a
     * hasta_clave (comportamiento legacy del PR 14).
     *
     * Permite distinguir "matchea solo creaciones" vs "matchea cualquier
     * transición a hasta_clave" sin romper backcompat con flujos que
     * usan desde_clave=null con la semántica "cualquier estado anterior".
     */
    solo_creacion?: boolean
  }
}

export interface DisparadorEntidadCreada {
  tipo: 'entidad.creada'
  configuracion: {
    entidad_tipo: EntidadConEstado
  }
}

export interface DisparadorEntidadCampoCambia {
  tipo: 'entidad.campo_cambia'
  configuracion: {
    entidad_tipo: EntidadConEstado
    campo: string
    valor?: string | number | boolean | null
  }
}

export interface DisparadorActividadCompletada {
  tipo: 'actividad.completada'
  configuracion: {
    /** Si está presente, solo dispara para actividades de ese tipo. */
    tipo_clave?: string
  }
}

export interface DisparadorTiempoCron {
  tipo: 'tiempo.cron'
  configuracion: {
    /**
     * Expresión cron estándar de 5 campos: minuto hora día_mes mes día_semana.
     * Operadores soportados: `*`, `*\/N`, `N-M`, `N,M,O`. Ej: `0 9 * * 1-5`
     * (9am de lunes a viernes), `*\/15 * * * *` (cada 15 minutos).
     */
    expresion: string
  }
}

/**
 * Disparador time-driven que escanea entidades cuyo `campo_fecha`
 * + `delta_dias` cae en el día actual (zona horaria de empresa).
 *
 * Casos típicos del plan §2:
 *   - cuotas que vencen en 3 días        (entidad_tipo: cuota,
 *                                          campo: fecha_vencimiento, delta: -3)
 *   - presupuestos enviados hace 7 días  (entidad_tipo: presupuesto,
 *                                          campo: actualizado_en,  delta: +7)
 *   - revisión post-instalación          (entidad_tipo: visita,
 *                                          campo: fecha_completada, delta: +7)
 *
 * El cron itera por cada entidad matching y crea una ejecución por
 * cada una. La idempotencia es por (flujo_id, entidad_id, día) para
 * que si el cron tick 60 veces el mismo día solo dispare una vez.
 */
export interface DisparadorTiempoRelativoACampo {
  tipo: 'tiempo.relativo_a_campo'
  configuracion: {
    entidad_tipo: EntidadConEstado
    /** Columna timestamptz/date de la tabla principal de la entidad. */
    campo_fecha: string
    /** Días relativos al campo. Negativo = antes, positivo = después. */
    delta_dias: number
    /** Hora del día (formato HH:MM) en zona horaria de empresa. Default '09:00'. */
    hora_local?: string
    /**
     * Tolerancia hacia atrás (en días) para no perder ventanas si el cron
     * estuvo caído. 0 = estricto (solo el día exacto). Default 0.
     */
    tolerancia_dias?: number
    /** Si presente, solo dispara si el estado_clave de la entidad está en la lista. */
    filtro_estado_clave?: string[]
  }
}

export interface DisparadorWebhookEntrante {
  tipo: 'webhook.entrante'
  configuracion: {
    /** Slug que identifica al webhook en la URL pública. */
    slug: string
  }
}

/**
 * Dispara cuando llega un mensaje entrante a una cuenta del inbox.
 *
 * Hoy el motor lo ejecuta solo para correo (`tipo_canal: 'correo'`).
 * El campo se mantiene en el shape para que cuando se sume WhatsApp en
 * un PR posterior, los flujos existentes no necesiten migración.
 *
 * `canal_ids` es multi-select de cuentas (`canales_correo.id`). Vacío
 * o ausente = todas las cuentas de ese tipo en la empresa.
 *
 * El enganche real ocurre via trigger SQL `AFTER INSERT ON mensajes
 * WHERE es_entrante` (sql/113) que escribe a `cambios_estado` con
 * `entidad_tipo='mensaje'`, `estado_anterior=NULL`, `estado_nuevo='recibido'`,
 * y el dispatcher matchea por el shape de este disparador.
 */
export interface DisparadorInboxMensajeRecibido {
  tipo: 'inbox.mensaje_recibido'
  configuracion: {
    /**
     * Tipo de canal que dispara. Hoy solo 'correo'. Cuando se sume
     * 'whatsapp' al motor, se extiende este union sin tocar flujos
     * existentes (los actuales seguirán filtrando por correo).
     */
    tipo_canal: 'correo'
    /**
     * IDs de canales (`canales_correo.id`) que disparan el flujo.
     * Vacío/ausente = todos los canales del `tipo_canal` en la empresa.
     */
    canal_ids?: string[]
  }
}

export interface DisparadorInboxConversacionSinRespuesta {
  tipo: 'inbox.conversacion_sin_respuesta'
  configuracion: {
    /** Tiempo en minutos sin respuesta. */
    minutos_sin_respuesta: number
    canal_id?: string
  }
}

// Intersection con `MetadataUiDisparador` propaga `etiqueta?: string` a
// cada miembro de la union sin tocar las 9 interfaces. El narrowing
// sobre `tipo` sigue funcionando intacto (TS preserva el discriminante
// porque la metadata no agrega un campo conflictivo).
export type DisparadorWorkflow = (
  | DisparadorEntidadEstadoCambio
  | DisparadorEntidadCreada
  | DisparadorEntidadCampoCambia
  | DisparadorActividadCompletada
  | DisparadorTiempoCron
  | DisparadorTiempoRelativoACampo
  | DisparadorWebhookEntrante
  | DisparadorInboxMensajeRecibido
  | DisparadorInboxConversacionSinRespuesta
) & MetadataUiDisparador

// =============================================================
// Catálogo de tipos de acción
// =============================================================
// Las acciones las consume el worker (PR 15+). El dispatcher (PR 14)
// no las procesa — solo crea la ejecución y deja al worker que
// resuelva la lista.
//
// Sub-PR 15.1: las 4 acciones implementadas tienen su shape
// específico modelado como discriminated union sobre `tipo`. Las
// demás del catálogo siguen siendo conocidas pero su shape específico
// se completa cuando se implementan (sub-PR 15.2 y siguientes).

export type TipoAccion =
  | 'enviar_whatsapp_plantilla'
  | 'enviar_whatsapp_texto'
  | 'enviar_correo_plantilla'
  | 'enviar_correo_texto'
  | 'enviar_respuesta_rapida_correo'
  | 'crear_actividad'
  | 'completar_actividad'
  | 'cambiar_estado_entidad'
  | 'asignar_usuario'
  | 'agregar_etiqueta'
  | 'quitar_etiqueta'
  | 'notificar_usuario'
  | 'notificar_grupo'
  | 'crear_orden_trabajo'
  | 'crear_visita'
  | 'webhook_saliente'
  | 'esperar'
  | 'esperar_evento'
  | 'condicion_branch'
  | 'terminar_flujo'

export const TIPOS_ACCION: readonly TipoAccion[] = [
  'enviar_whatsapp_plantilla',
  'enviar_whatsapp_texto',
  'enviar_correo_plantilla',
  'enviar_correo_texto',
  'enviar_respuesta_rapida_correo',
  'crear_actividad',
  'completar_actividad',
  'cambiar_estado_entidad',
  'asignar_usuario',
  'agregar_etiqueta',
  'quitar_etiqueta',
  'notificar_usuario',
  'notificar_grupo',
  'crear_orden_trabajo',
  'crear_visita',
  'webhook_saliente',
  'esperar',
  'esperar_evento',
  'condicion_branch',
  'terminar_flujo',
] as const

// Flag común opcional: si la acción falla irrecuperablemente, ¿el
// flujo se detiene (default) o continúa con la siguiente acción?
// Útil para acciones complementarias que no deben romper la cadena
// (ej: un correo opcional cuyo fallo no impide la actividad principal).
interface AccionBase {
  /** Si está en true y la acción falla, el flujo continúa con la siguiente. Default false. */
  continuar_si_falla?: boolean
  /**
   * Nombre user-friendly del paso (ej: "Mandar recordatorio cuota
   * 3 días"). Mostrado en cards del canvas y header del panel lateral
   * del editor. Si está ausente o vacío, la UI usa la etiqueta legible
   * del tipo (`etiquetaAccion`) como fallback. El motor lo ignora —
   * es metadata exclusiva de UI. Cota generosa: ≤200 chars (validación
   * fuerte llega cuando el editor agregue restricciones, sub-PR 19.4).
   */
  etiqueta?: string
}

// ─── Acciones del sub-PR 15.1 (shape específico) ──────────────

export interface AccionEnviarWhatsappPlantilla extends AccionBase {
  tipo: 'enviar_whatsapp_plantilla'
  /** ID del canal de WhatsApp a usar (de canales_whatsapp). */
  canal_id: string
  /** Teléfono destino en formato E.164 sin '+' (ej: '5491134567890'). */
  telefono: string
  /** Nombre de la plantilla aprobada en Meta. */
  plantilla_nombre: string
  /** Código de idioma (ej: 'es_AR', 'es', 'en'). */
  idioma: string
  /**
   * Componentes de la plantilla con variables resueltas (header/body/buttons).
   * Estructura compatible con Meta Cloud API. Si la plantilla no tiene
   * variables, dejar vacío o undefined.
   */
  componentes?: Record<string, unknown>[]
}

export interface AccionCrearActividad extends AccionBase {
  tipo: 'crear_actividad'
  tipo_actividad_id: string
  titulo: string
  descripcion?: string
  /** Array de uuids de usuarios asignados. */
  asignados_ids?: string[]
  /** Vínculo opcional con un contacto (se agrega al array `vinculos`). */
  contacto_id?: string
  fecha_vencimiento?: string
  prioridad?: 'baja' | 'normal' | 'alta'
}

/**
 * Cierra una o más actividades pendientes que matcheen el criterio
 * (sub-PR 20.1). Reemplazo del helper legacy `auto-completar-actividad.ts`
 * y del campo `tipos_actividad.evento_auto_completar`, que sub-PR 20.3
 * elimina sembrando flujos del sistema equivalentes.
 *
 * Cómo se resuelve el match:
 *   - Filtro positivo obligatorio: `tipo_actividad_id` o `relacionada_a`
 *     (la validación pre-publicar lo exige; sin filtro se podrían cerrar
 *     todas las actividades pendientes de la empresa).
 *   - Filtros adicionales: `contacto_id` (vínculos), `asignado_id`
 *     (asignados_ids), `estado_clave` (default 'pendiente').
 *   - `relacionada_a` busca por `actividades_relaciones (entidad_tipo,
 *     entidad_id)` (sql/066, sub-PR 20.2). El ejecutor pre-resuelve los
 *     `actividad_id` vinculados a esa entidad y combina con los demás
 *     filtros del criterio. Multi-tenant: la query se filtra
 *     explícitamente por empresa_id (defensa adicional al RLS, porque
 *     el motor corre con service_role).
 *
 * Resolución del set:
 *   - `si_multiple = 'mas_antigua'` (default sugerido): cierra la primera
 *     ordenada por `creado_en` ASC. FIFO.
 *   - `si_multiple = 'mas_reciente'`: cierra la primera por `creado_en`
 *     DESC.
 *   - `si_multiple = 'todas'`: cierra todas las que matcheen.
 *   - `si_multiple = 'fallar'`: si hay >1 match, falla con error
 *     semántico (no cierra ninguna).
 *
 * Si el set es vacío:
 *   - `si_no_encuentra = 'continuar'` (default): devuelve cantidad=0 sin
 *     fallar, el flujo sigue.
 *   - `si_no_encuentra = 'fallar'`: error semántico, corta la cadena.
 *
 * `motivo` se incluye en el chatter de cada actividad cerrada (formato
 * "Completada por flujo «X». Motivo: «Y»").
 *
 * Variables `{{...}}` dentro de los strings del criterio se resuelven
 * automáticamente por `resolverEnObjeto` antes de invocar al executor
 * (es la misma capa que ya resuelve `{{contacto.email}}` en
 * `enviar_correo_plantilla`).
 */
export interface AccionCompletarActividad extends AccionBase {
  tipo: 'completar_actividad'
  criterio: {
    tipo_actividad_id?: string
    contacto_id?: string
    asignado_id?: string
    /** Default 'pendiente'. */
    estado_clave?: string
    /**
     * Lookup vía `actividades_relaciones` (sql/066). El ejecutor
     * pre-resuelve el set de actividades vinculadas a esa entidad y
     * lo combina con los demás filtros del criterio.
     */
    relacionada_a?: {
      entidad_tipo: string
      entidad_id: string
    }
    si_multiple: 'mas_antigua' | 'mas_reciente' | 'todas' | 'fallar'
    /** Default 'continuar'. */
    si_no_encuentra?: 'fallar' | 'continuar'
  }
  /** Texto opcional que se incluye en el chatter de la actividad cerrada. */
  motivo?: string
}

export interface AccionCambiarEstadoEntidad extends AccionBase {
  tipo: 'cambiar_estado_entidad'
  entidad_tipo: EntidadConEstado
  entidad_id: string
  hasta_clave: string
  motivo?: string
}

export interface AccionNotificarUsuario extends AccionBase {
  tipo: 'notificar_usuario'
  usuario_id: string
  titulo: string
  cuerpo?: string
  /** URL relativa para deep-linking desde la notificación. */
  url?: string
  /** Categoría de notificación (matchea `notificaciones.tipo` en BD). */
  notificacion_tipo?: string
}

/**
 * Envía un correo usando una plantilla de `plantillas_correo` resuelta
 * en backend con `resolverVariablesPlantilla`.
 *
 * Cuando el flujo se dispara como respuesta a un mensaje entrante
 * (disparador `inbox.mensaje_recibido`), el destinatario y la cuenta
 * origen se derivan automáticamente del mensaje original — sin
 * configuración manual:
 *   - destinatario = `correo_de` del mensaje entrante
 *   - cuenta origen = canal de la conversación del mensaje
 *   - threading = se inyecta `In-Reply-To` + `References` para que
 *     quede como respuesta del hilo
 *
 * Para flujos no disparados por mensaje, el destinatario tiene que
 * venir explícito en `destinatario_override` (string con `{{vars}}`
 * permitido) o el handler falla con `DestinatarioFaltante`.
 */
export interface AccionEnviarCorreoPlantilla extends AccionBase {
  tipo: 'enviar_correo_plantilla'
  /** UUID de la plantilla en `plantillas_correo`. */
  plantilla_id: string
  /**
   * Destinatario manual. Si está vacío y el flujo viene de un mensaje
   * entrante, se usa el remitente del mensaje original. Soporta
   * `{{vars}}` (ej: `{{contacto.email}}`).
   */
  destinatario_override?: string
}

/**
 * Envía una respuesta rápida de `respuestas_rapidas_correo` —
 * espejo de `enviar_correo_plantilla` con otra tabla origen. Se
 * mantiene como acción separada porque plantillas y respuestas
 * rápidas son entidades distintas en BD y en la UX del inbox
 * (las respuestas rápidas son atajos manuales del operador, las
 * plantillas son documentos formales).
 */
export interface AccionEnviarRespuestaRapidaCorreo extends AccionBase {
  tipo: 'enviar_respuesta_rapida_correo'
  /** UUID de la respuesta rápida en `respuestas_rapidas_correo`. */
  respuesta_rapida_id: string
  /**
   * Destinatario manual. Mismo criterio que en `enviar_correo_plantilla`.
   */
  destinatario_override?: string
}

// ─── Acciones de control de flujo (sub-PR 15.2) ───────────────

export interface AccionEsperar extends AccionBase {
  tipo: 'esperar'
  /**
   * Duración del delay en milisegundos. Mutuamente exclusivo con
   * `hasta_fecha`. Mínimo 1000 (1s), máximo 30 días.
   */
  duracion_ms?: number
  /**
   * Fecha absoluta (ISO 8601) hasta cuándo esperar. Mutuamente
   * exclusivo con `duracion_ms`. Útil para "esperar hasta el
   * próximo lunes a las 9".
   */
  hasta_fecha?: string
}

export interface AccionCondicionBranch extends AccionBase {
  tipo: 'condicion_branch'
  condicion: CondicionWorkflow
  /** Acciones a ejecutar si la condición evalúa true. */
  acciones_si: AccionWorkflow[]
  /** Acciones a ejecutar si la condición evalúa false. */
  acciones_no: AccionWorkflow[]
}

export interface AccionTerminarFlujo extends AccionBase {
  tipo: 'terminar_flujo'
  /** Motivo opcional para auditar por qué el flujo se cortó. */
  motivo?: string
}

// ─── Acciones del catálogo todavía no implementadas ───────────
// Forma genérica: { tipo, parametros }. Cada una tendrá su shape
// específico cuando se implemente (sub-PR 15.3+).
export interface AccionGenerica extends AccionBase {
  tipo: Exclude<
    TipoAccion,
    | 'enviar_whatsapp_plantilla'
    | 'enviar_correo_plantilla'
    | 'enviar_respuesta_rapida_correo'
    | 'crear_actividad'
    | 'completar_actividad'
    | 'cambiar_estado_entidad'
    | 'notificar_usuario'
    | 'esperar'
    | 'condicion_branch'
    | 'terminar_flujo'
  >
  parametros: Record<string, unknown>
}

export type AccionWorkflow =
  | AccionEnviarWhatsappPlantilla
  | AccionEnviarCorreoPlantilla
  | AccionEnviarRespuestaRapidaCorreo
  | AccionCrearActividad
  | AccionCompletarActividad
  | AccionCambiarEstadoEntidad
  | AccionNotificarUsuario
  | AccionEsperar
  | AccionCondicionBranch
  | AccionTerminarFlujo
  | AccionGenerica

// Condiciones (filtros adicionales después del trigger O dentro de
// una acción condicion_branch). El evaluador en
// src/lib/workflows/evaluar-condicion.ts las resuelve contra el
// contexto de la ejecución.
//
// Discriminated union sobre la presencia de `condiciones` (compuesta)
// vs `campo` (hoja). Soporta anidamiento Y/O ilimitado en estructura,
// con guarda de profundidad runtime para evitar recursión maliciosa.

export type OperadorComparacion =
  | 'igual' | 'distinto'
  | 'mayor' | 'menor' | 'mayor_o_igual' | 'menor_o_igual'
  | 'contiene' | 'no_contiene'
  | 'existe' | 'no_existe'
  | 'en_lista' | 'no_en_lista'
  | 'entre'
  | 'dias_desde' | 'dias_hasta'

export interface CondicionHoja {
  /** Path al campo en el contexto. Soporta dot notation: `entidad.estado_nuevo`. */
  campo: string
  operador: OperadorComparacion
  /**
   * Valor a comparar. El tipo depende del operador:
   *   - igual/distinto/contiene/no_contiene: string | number | boolean
   *   - mayor/menor/...: number | Date-string
   *   - existe/no_existe: ignorado
   *   - en_lista/no_en_lista: array
   *   - entre: [min, max]
   *   - dias_desde/dias_hasta: number (cantidad de días)
   */
  valor?: unknown
}

export interface CondicionCompuesta {
  /** 'y' = AND lógico (todas verdaderas). 'o' = OR lógico (al menos una). */
  operador: 'y' | 'o'
  condiciones: CondicionWorkflow[]
}

export type DiaSemana = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom'

export const DIAS_SEMANA: readonly DiaSemana[] = [
  'lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom',
] as const

/**
 * Condición temporal evaluada contra "ahora" en una zona horaria.
 *
 * Se discrimina de `CondicionHoja` y `CondicionCompuesta` por el
 * campo `tipo: 'horario'`. Útil para flujos tipo "responder solo
 * fuera de horario laboral" sin necesidad de variables del contexto.
 *
 * El evaluador (src/lib/workflows/evaluar-condicion.ts) calcula:
 *   - El día de la semana de "ahora" en la `zona_horaria` indicada.
 *   - La hora actual (HH:MM) en esa misma zona horaria.
 *   - Si día ∈ `dias` AND hora ∈ [`hora_desde`, `hora_hasta`) →
 *     "dentro del rango". Sino → "fuera".
 *   - Si `modo === 'dentro'` devuelve "dentro del rango"; si
 *     `modo === 'fuera'` devuelve la negación.
 *
 * El rango cruzando medianoche (ej: 22:00 → 06:00) está soportado:
 * si `hora_desde > hora_hasta`, se interpreta como "desde hora_desde
 * hasta medianoche, ó desde 00:00 hasta hora_hasta".
 */
export interface CondicionHorario {
  tipo: 'horario'
  /** 'dentro' = true si ahora está en el rango. 'fuera' = inverso. */
  modo: 'dentro' | 'fuera'
  /** Zona horaria IANA (ej: 'America/Argentina/Buenos_Aires'). */
  zona_horaria: string
  /** Días de la semana que cuentan. Vacío = falla cerrada (siempre fuera). */
  dias: DiaSemana[]
  /** Hora desde en formato HH:MM (24h). */
  hora_desde: string
  /** Hora hasta en formato HH:MM (24h). Exclusivo del límite superior. */
  hora_hasta: string
}

export type CondicionWorkflow = CondicionHoja | CondicionCompuesta | CondicionHorario

// =============================================================
// Estados de la máquina interna del motor
// =============================================================

export type EstadoEjecucion =
  | 'pendiente'
  | 'corriendo'
  | 'esperando'
  | 'completado'
  | 'fallado'
  | 'cancelado'

export const ESTADOS_EJECUCION: readonly EstadoEjecucion[] = [
  'pendiente', 'corriendo', 'esperando', 'completado', 'fallado', 'cancelado',
] as const

export type EstadoAccion =
  | 'pendiente'
  | 'ejecutando'
  | 'ok'
  | 'fallo'
  | 'cancelada'

export const ESTADOS_ACCION: readonly EstadoAccion[] = [
  'pendiente', 'ejecutando', 'ok', 'fallo', 'cancelada',
] as const

// =============================================================
// Filas de las tablas
// =============================================================
// jsonb columns se tipan como `unknown` deliberadamente: los
// consumidores deben validar la forma con type guards antes de
// usar los campos. Es la línea de defensa contra datos rotos por
// versiones viejas o ediciones manuales en BD.

/**
 * Estado operacional del flujo (PR 18, sql/056).
 *
 *   borrador — se edita in-place sobre disparador/condiciones/acciones
 *              y NO dispara nunca.
 *   activo   — el motor lo ejecuta cuando matchea evento o tiempo.
 *              Si el usuario lo edita, los cambios van a borrador_jsonb
 *              hasta que clickee Publicar (modelo "borrador interno",
 *              decisión §5.3 de docs/PLAN_UI_FLUJOS.md).
 *   pausado  — definición conservada pero el motor lo ignora.
 *              Se sale con activar; se entra con pausar.
 */
export type EstadoFlujo = 'borrador' | 'activo' | 'pausado'

export const ESTADOS_FLUJO: readonly EstadoFlujo[] = [
  'borrador', 'activo', 'pausado',
] as const

export function esEstadoFlujo(v: unknown): v is EstadoFlujo {
  return typeof v === 'string' && (ESTADOS_FLUJO as readonly string[]).includes(v)
}

export interface Flujo {
  id: string
  empresa_id: string
  nombre: string
  descripcion: string | null
  /**
   * Estado operacional. Fuente de verdad. La columna `activo` se
   * deriva (generated column). Para cambiar de estado se usan los
   * endpoints específicos: /activar, /pausar, /publicar (estos tres
   * son los únicos que tocan este campo desde la API).
   */
  estado: EstadoFlujo
  /**
   * DERIVADO de estado === 'activo'. Generated column STORED en BD.
   * Se mantiene en la interface porque los consumidores que se
   * armaron antes del PR 18 (dispatcher, cron, correr-ejecucion) lo
   * leen tal cual.
   */
  activo: boolean
  disparador: unknown
  condiciones: unknown
  acciones: unknown
  nodos_json: unknown
  /**
   * Versión en edición de un flujo activo o pausado.
   * Shape: { disparador, condiciones, acciones }. NULL = sin
   * borrador en curso (común para flujos en estado 'borrador',
   * que editan in-place sobre las columnas publicadas).
   */
  borrador_jsonb: unknown | null
  ultima_ejecucion_tiempo: string | null
  /**
   * Personalización visual del flujo (sql/060). NULL = sin
   * personalizar — la UI usa ícono/color default según tipo de
   * disparador.
   */
  icono: string | null
  color: string | null
  creado_por: string | null
  creado_por_nombre: string | null
  editado_por: string | null
  editado_por_nombre: string | null
  creado_en: string
  actualizado_en: string
  /**
   * Estadísticas agregadas de ejecuciones — solo presentes cuando la
   * fila viene de la vista `flujos_con_estadisticas` (PR 18.3,
   * sql/059). El GET /api/flujos las trae siempre; el GET por id
   * lee directo de la tabla y las omite. Son opcionales para que
   * los call sites de un endpoint o del otro tipen igual.
   */
  ultima_ejecucion_en?: string | null
  total_ejecuciones_30d?: number
}

// =============================================================
// Bodies de los endpoints CRUD (PR 18.1)
// =============================================================
// Type guards puros (sin Zod) consistentes con el resto del archivo.
// Validan la forma exacta que aceptan los endpoints; en caso de
// rechazo el endpoint devuelve 400 con mensaje específico.

/**
 * Body de POST /api/flujos. nombre obligatorio (1-200 chars), el
 * resto opcional (todo arranca con default sano: estado 'borrador',
 * disparador/condiciones/acciones vacíos para editar después).
 *
 * `basado_en_flujo_id` (PR 18.4): si está presente, el endpoint
 * arma el flujo nuevo copiando disparador/condiciones/acciones/
 * nodos_json/icono/color del origen (versión publicada). El nuevo
 * arranca SIEMPRE en 'borrador' con borrador_jsonb=NULL, sin
 * importar el estado del origen. `descripcion` del body sobrescribe
 * la del origen si viene; si no viene, se hereda del origen.
 */
export interface BodyCrearFlujo {
  nombre: string
  descripcion?: string | null
  basado_en_flujo_id?: string
  /** Icono Lucide opcional (ej: "Mail"). Si viene, el flujo lo persiste
   *  en `flujos.icono` ya desde la creación, evitando el segundo PATCH
   *  desde el editor. Si `basado_en_flujo_id` también está, el icono
   *  explícito gana sobre el heredado. */
  icono?: string | null
  /** Color de la paleta Insignia (ej: "violeta", "exito"). Mismo
   *  criterio que `icono`: si viene, persiste de entrada. */
  color?: string | null
}

export function esBodyCrearFlujo(b: unknown): b is BodyCrearFlujo {
  if (typeof b !== 'object' || b === null) return false
  const r = b as Record<string, unknown>
  if (typeof r.nombre !== 'string') return false
  const trimmed = r.nombre.trim()
  if (trimmed.length === 0 || trimmed.length > 200) return false
  if (r.descripcion !== undefined && r.descripcion !== null && typeof r.descripcion !== 'string') return false
  if (typeof r.descripcion === 'string' && r.descripcion.length > 2000) return false
  if (r.basado_en_flujo_id !== undefined) {
    if (typeof r.basado_en_flujo_id !== 'string') return false
    const id = r.basado_en_flujo_id.trim()
    // Sin validar formato UUID acá: la query a BD devuelve 404 si no
    // existe (mismo criterio que el resto de Flux). Solo evitamos
    // strings vacíos o absurdamente largos.
    if (id.length === 0 || id.length > 100) return false
  }
  if (r.icono !== undefined && r.icono !== null) {
    if (typeof r.icono !== 'string') return false
    if (r.icono.length === 0 || r.icono.length > 64) return false
  }
  if (r.color !== undefined && r.color !== null) {
    if (typeof r.color !== 'string') return false
    if (r.color.length === 0 || r.color.length > 32) return false
  }
  return true
}

/**
 * Body de PUT /api/flujos/[id]. Todos opcionales — la UI patchea
 * campo por campo con autoguardado (memoria feedback_autoguardado.md).
 *
 * El endpoint rechaza con 400 si:
 *   - viene `estado` (debe ir por /activar | /pausar)
 *   - viene `borrador_jsonb` directo (es interno, lo arma el endpoint)
 *   - viene `activo` (es derivado)
 *
 * El comportamiento es:
 *   - flujo en 'borrador' → escribe in-place sobre disparador / etc.
 *   - flujo en 'activo' o 'pausado' → escribe a borrador_jsonb.
 */
export interface BodyActualizarFlujo {
  nombre?: string
  descripcion?: string | null
  disparador?: unknown
  condiciones?: unknown
  acciones?: unknown
  nodos_json?: unknown
  /**
   * Personalización visual del flujo (sql/060). Acepta string (set),
   * null (limpiar) o `undefined` (no tocar). El editor visual del
   * sub-PR 19.2 lo usa para que el `MiniSelectorIcono` del header
   * persista el cambio sin endpoints adicionales.
   */
  icono?: string | null
  /**
   * Color semántico del flujo (token corto: 'exito', 'advertencia',
   * 'primario', etc.). Misma semántica de tri-state que `icono`.
   */
  color?: string | null
}

export function esBodyActualizarFlujo(b: unknown): b is BodyActualizarFlujo {
  if (typeof b !== 'object' || b === null) return false
  const r = b as Record<string, unknown>
  if ('estado' in r) return false
  if ('borrador_jsonb' in r) return false
  if ('activo' in r) return false
  if (r.nombre !== undefined) {
    if (typeof r.nombre !== 'string') return false
    const trimmed = r.nombre.trim()
    if (trimmed.length === 0 || trimmed.length > 200) return false
  }
  if (r.descripcion !== undefined && r.descripcion !== null && typeof r.descripcion !== 'string') return false
  if (typeof r.descripcion === 'string' && r.descripcion.length > 2000) return false
  // icono / color: tri-state como descripcion (string | null | undefined).
  // String vacío se rechaza para forzar `null` explícito al limpiar y
  // evitar que el handler tenga que decidir entre "" y null. Cota
  // generosa: nombres de Lucide y tokens semánticos de Flux son cortos.
  if (r.icono !== undefined && r.icono !== null) {
    if (typeof r.icono !== 'string') return false
    if (r.icono.trim().length === 0 || r.icono.length > 64) return false
  }
  if (r.color !== undefined && r.color !== null) {
    if (typeof r.color !== 'string') return false
    if (r.color.trim().length === 0 || r.color.length > 32) return false
  }
  // disparador / condiciones / acciones / nodos_json son jsonb opaco
  // hasta que el endpoint /activar valide su shape con
  // validarPublicable(). En PUT solo se exige que sean objeto/array
  // serializables — el JSON parser ya garantiza esto.
  return true
}

export interface EjecucionFlujo {
  id: string
  empresa_id: string
  flujo_id: string
  estado: EstadoEjecucion
  disparado_por: string | null
  contexto_inicial: unknown
  log: unknown
  inicio_en: string | null
  fin_en: string | null
  proximo_paso_en: string | null
  intentos: number
  clave_idempotencia: string | null
  creado_en: string
}

export interface AccionPendiente {
  id: string
  empresa_id: string
  ejecucion_id: string
  tipo_accion: TipoAccion
  parametros: unknown
  ejecutar_en: string
  estado: EstadoAccion
  resultado: unknown
  intentos: number
  creado_en: string
  actualizado_en: string
}

// =============================================================
// Origen del disparo (formato discriminado de `disparado_por`)
// =============================================================
// La columna ejecuciones_flujo.disparado_por es un text con prefijo:
//   cambios_estado:<uuid> | cron:<expr> | manual:<user-id> | webhook:<url>
// Estos helpers serializan/parsean ese formato sin riesgo de errores
// de string concat dispersos por el código.

export type OrigenDisparador =
  | { tipo: 'cambios_estado'; cambios_estado_id: string }
  | { tipo: 'cron'; expresion: string }
  | { tipo: 'manual'; usuario_id: string }
  | { tipo: 'webhook'; url: string }

export function serializarDisparadoPor(o: OrigenDisparador): string {
  switch (o.tipo) {
    case 'cambios_estado': return `cambios_estado:${o.cambios_estado_id}`
    case 'cron': return `cron:${o.expresion}`
    case 'manual': return `manual:${o.usuario_id}`
    case 'webhook': return `webhook:${o.url}`
  }
}

export function parsearDisparadoPor(s: string | null): OrigenDisparador | null {
  if (!s) return null
  const idx = s.indexOf(':')
  if (idx === -1) return null
  const prefijo = s.slice(0, idx)
  const valor = s.slice(idx + 1)
  switch (prefijo) {
    case 'cambios_estado': return { tipo: 'cambios_estado', cambios_estado_id: valor }
    case 'cron': return { tipo: 'cron', expresion: valor }
    case 'manual': return { tipo: 'manual', usuario_id: valor }
    case 'webhook': return { tipo: 'webhook', url: valor }
    default: return null
  }
}

// =============================================================
// Clave de idempotencia
// =============================================================
// El UNIQUE parcial sobre (flujo_id, clave_idempotencia) en
// ejecuciones_flujo garantiza que dos disparos por el mismo evento
// no creen dos ejecuciones. Convención del PR 13: el dispatcher
// arma la clave determinísticamente desde flujo_id + cambios_estado_id.

export function armarClaveIdempotencia(
  flujoId: string,
  cambiosEstadoId: string,
): string {
  return `flujo:${flujoId}:evento:${cambiosEstadoId}`
}

// =============================================================
// Webhook payload de Database Webhooks de Supabase
// =============================================================
// Supabase Database Webhooks postean un body con esta forma exacta
// cuando se configura un trigger ON INSERT sobre una tabla. El
// dispatcher (PR 14) recibe esto en su Edge Function.
//
// Documentación oficial:
//   https://supabase.com/docs/guides/database/webhooks

export interface WebhookPayloadCambiosEstado {
  type: 'INSERT'
  table: 'cambios_estado'
  schema: 'public'
  record: CambioEstado
  old_record: null
}

// =============================================================
// Type guards
// =============================================================

export function esTipoDisparador(v: unknown): v is TipoDisparador {
  return typeof v === 'string' && (TIPOS_DISPARADOR as readonly string[]).includes(v)
}

export function esTipoAccion(v: unknown): v is TipoAccion {
  return typeof v === 'string' && (TIPOS_ACCION as readonly string[]).includes(v)
}

export function esEstadoEjecucion(v: unknown): v is EstadoEjecucion {
  return typeof v === 'string' && (ESTADOS_EJECUCION as readonly string[]).includes(v)
}

/**
 * Valida que un objeto tenga la forma de DisparadorEntidadEstadoCambio.
 * Se usa en el dispatcher para narrowing seguro del jsonb crudo de la
 * tabla `flujos`. Si vuelve true, los campos son seguros de leer.
 */
export function esDisparadorEntidadEstadoCambio(
  d: unknown,
): d is DisparadorEntidadEstadoCambio {
  if (typeof d !== 'object' || d === null) return false
  const r = d as Record<string, unknown>
  if (r.tipo !== 'entidad.estado_cambio') return false
  if (typeof r.configuracion !== 'object' || r.configuracion === null) return false
  const c = r.configuracion as Record<string, unknown>
  if (typeof c.entidad_tipo !== 'string') return false
  if (typeof c.hasta_clave !== 'string') return false
  if (
    c.desde_clave !== undefined &&
    c.desde_clave !== null &&
    typeof c.desde_clave !== 'string'
  ) {
    return false
  }
  if (
    c.solo_creacion !== undefined &&
    typeof c.solo_creacion !== 'boolean'
  ) {
    return false
  }
  return true
}

// ─── Type guards de disparadores tiempo (PR 17) ───────────────

export function esDisparadorTiempoCron(d: unknown): d is DisparadorTiempoCron {
  if (typeof d !== 'object' || d === null) return false
  const r = d as Record<string, unknown>
  if (r.tipo !== 'tiempo.cron') return false
  if (typeof r.configuracion !== 'object' || r.configuracion === null) return false
  const c = r.configuracion as Record<string, unknown>
  if (typeof c.expresion !== 'string' || c.expresion.length === 0) return false
  return true
}

export function esDisparadorTiempoRelativoACampo(
  d: unknown,
): d is DisparadorTiempoRelativoACampo {
  if (typeof d !== 'object' || d === null) return false
  const r = d as Record<string, unknown>
  if (r.tipo !== 'tiempo.relativo_a_campo') return false
  if (typeof r.configuracion !== 'object' || r.configuracion === null) return false
  const c = r.configuracion as Record<string, unknown>
  if (typeof c.entidad_tipo !== 'string') return false
  if (!(ENTIDADES_CON_ESTADO as readonly string[]).includes(c.entidad_tipo)) return false
  if (typeof c.campo_fecha !== 'string' || c.campo_fecha.length === 0) return false
  if (typeof c.delta_dias !== 'number' || !Number.isInteger(c.delta_dias)) return false
  if (
    c.hora_local !== undefined &&
    (typeof c.hora_local !== 'string' || !/^\d{2}:\d{2}$/.test(c.hora_local))
  ) return false
  if (
    c.tolerancia_dias !== undefined &&
    (typeof c.tolerancia_dias !== 'number' || !Number.isInteger(c.tolerancia_dias) || c.tolerancia_dias < 0)
  ) return false
  if (
    c.filtro_estado_clave !== undefined &&
    (!Array.isArray(c.filtro_estado_clave) || !c.filtro_estado_clave.every((s) => typeof s === 'string'))
  ) return false
  return true
}

// ─── Type guard del disparador inbox.mensaje_recibido ────────

const TIPOS_CANAL_INBOX = new Set<string>(['correo'])

export function esDisparadorInboxMensajeRecibido(
  d: unknown,
): d is DisparadorInboxMensajeRecibido {
  if (typeof d !== 'object' || d === null) return false
  const r = d as Record<string, unknown>
  if (r.tipo !== 'inbox.mensaje_recibido') return false
  if (typeof r.configuracion !== 'object' || r.configuracion === null) return false
  const c = r.configuracion as Record<string, unknown>
  if (typeof c.tipo_canal !== 'string' || !TIPOS_CANAL_INBOX.has(c.tipo_canal)) return false
  if (c.canal_ids !== undefined) {
    if (!Array.isArray(c.canal_ids)) return false
    if (!c.canal_ids.every((id) => typeof id === 'string' && id.length > 0)) return false
  }
  return true
}

// ─── Type guards de acciones (sub-PR 15.1) ────────────────────
// El executor del worker usa estos guards para narrowing seguro al
// leer `flujo.acciones[]` (que viene como jsonb crudo de la BD).

function esStringNoVacio(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

export function esAccionEnviarWhatsappPlantilla(
  a: unknown,
): a is AccionEnviarWhatsappPlantilla {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  if (r.tipo !== 'enviar_whatsapp_plantilla') return false
  if (!esStringNoVacio(r.canal_id)) return false
  if (!esStringNoVacio(r.telefono)) return false
  if (!esStringNoVacio(r.plantilla_nombre)) return false
  if (!esStringNoVacio(r.idioma)) return false
  if (r.componentes !== undefined && !Array.isArray(r.componentes)) return false
  return true
}

export function esAccionEnviarCorreoPlantilla(
  a: unknown,
): a is AccionEnviarCorreoPlantilla {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  if (r.tipo !== 'enviar_correo_plantilla') return false
  if (!esStringNoVacio(r.plantilla_id)) return false
  if (r.destinatario_override !== undefined && typeof r.destinatario_override !== 'string') return false
  return true
}

export function esAccionEnviarRespuestaRapidaCorreo(
  a: unknown,
): a is AccionEnviarRespuestaRapidaCorreo {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  if (r.tipo !== 'enviar_respuesta_rapida_correo') return false
  if (!esStringNoVacio(r.respuesta_rapida_id)) return false
  if (r.destinatario_override !== undefined && typeof r.destinatario_override !== 'string') return false
  return true
}

export function esAccionCrearActividad(a: unknown): a is AccionCrearActividad {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  if (r.tipo !== 'crear_actividad') return false
  if (!esStringNoVacio(r.tipo_actividad_id)) return false
  if (!esStringNoVacio(r.titulo)) return false
  if (r.descripcion !== undefined && typeof r.descripcion !== 'string') return false
  if (r.asignados_ids !== undefined && !Array.isArray(r.asignados_ids)) return false
  if (r.contacto_id !== undefined && typeof r.contacto_id !== 'string') return false
  return true
}

const SI_MULTIPLE_VALIDOS = new Set<string>(['mas_antigua', 'mas_reciente', 'todas', 'fallar'])
const SI_NO_ENCUENTRA_VALIDOS = new Set<string>(['fallar', 'continuar'])

export function esAccionCompletarActividad(
  a: unknown,
): a is AccionCompletarActividad {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  if (r.tipo !== 'completar_actividad') return false
  if (typeof r.criterio !== 'object' || r.criterio === null) return false
  const c = r.criterio as Record<string, unknown>

  // si_multiple obligatorio + valor del enum cerrado.
  if (typeof c.si_multiple !== 'string' || !SI_MULTIPLE_VALIDOS.has(c.si_multiple)) {
    return false
  }
  // si_no_encuentra opcional pero, si viene, valor del enum cerrado.
  if (
    c.si_no_encuentra !== undefined &&
    (typeof c.si_no_encuentra !== 'string' || !SI_NO_ENCUENTRA_VALIDOS.has(c.si_no_encuentra))
  ) {
    return false
  }

  // Filtros: si vienen, deben ser strings no vacíos. Pueden venir como
  // `{{var}}` literal sin resolver — el resolver corre antes del executor,
  // pero el type guard acepta el placeholder textual igual (es un string).
  for (const k of ['tipo_actividad_id', 'contacto_id', 'asignado_id', 'estado_clave'] as const) {
    if (c[k] !== undefined) {
      if (typeof c[k] !== 'string' || (c[k] as string).length === 0) return false
    }
  }

  if (c.relacionada_a !== undefined) {
    if (typeof c.relacionada_a !== 'object' || c.relacionada_a === null) return false
    const ra = c.relacionada_a as Record<string, unknown>
    if (typeof ra.entidad_tipo !== 'string' || ra.entidad_tipo.length === 0) return false
    if (typeof ra.entidad_id !== 'string' || ra.entidad_id.length === 0) return false
  }

  if (r.motivo !== undefined && typeof r.motivo !== 'string') return false
  return true
}

export function esAccionCambiarEstadoEntidad(
  a: unknown,
): a is AccionCambiarEstadoEntidad {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  if (r.tipo !== 'cambiar_estado_entidad') return false
  if (typeof r.entidad_tipo !== 'string') return false
  if (!(ENTIDADES_CON_ESTADO as readonly string[]).includes(r.entidad_tipo)) return false
  if (!esStringNoVacio(r.entidad_id)) return false
  if (!esStringNoVacio(r.hasta_clave)) return false
  return true
}

export function esAccionNotificarUsuario(
  a: unknown,
): a is AccionNotificarUsuario {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  if (r.tipo !== 'notificar_usuario') return false
  if (!esStringNoVacio(r.usuario_id)) return false
  if (!esStringNoVacio(r.titulo)) return false
  if (r.cuerpo !== undefined && typeof r.cuerpo !== 'string') return false
  return true
}

export function esAccionEsperar(a: unknown): a is AccionEsperar {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  if (r.tipo !== 'esperar') return false
  // Exactamente uno de duracion_ms o hasta_fecha debe estar presente.
  const tieneDuracion = typeof r.duracion_ms === 'number' && r.duracion_ms > 0
  const tieneFecha = typeof r.hasta_fecha === 'string' && r.hasta_fecha.length > 0
  if (tieneDuracion === tieneFecha) return false // ambos true o ambos false → inválido
  if (tieneDuracion && (r.duracion_ms as number) < 1000) return false // mínimo 1s
  if (tieneDuracion && (r.duracion_ms as number) > 30 * 24 * 3600 * 1000) return false // máx 30d
  return true
}

export function esAccionCondicionBranch(
  a: unknown,
): a is AccionCondicionBranch {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  if (r.tipo !== 'condicion_branch') return false
  if (!esCondicionWorkflow(r.condicion)) return false
  if (!Array.isArray(r.acciones_si)) return false
  if (!Array.isArray(r.acciones_no)) return false
  return true
}

export function esAccionTerminarFlujo(a: unknown): a is AccionTerminarFlujo {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  if (r.tipo !== 'terminar_flujo') return false
  if (r.motivo !== undefined && typeof r.motivo !== 'string') return false
  return true
}

const OPERADORES_COMPARACION = new Set<string>([
  'igual', 'distinto',
  'mayor', 'menor', 'mayor_o_igual', 'menor_o_igual',
  'contiene', 'no_contiene',
  'existe', 'no_existe',
  'en_lista', 'no_en_lista',
  'entre',
  'dias_desde', 'dias_hasta',
])

const HORA_HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/
const DIAS_SEMANA_SET = new Set<string>(DIAS_SEMANA)

export function esCondicionHorario(c: unknown): c is CondicionHorario {
  if (typeof c !== 'object' || c === null) return false
  const r = c as Record<string, unknown>
  if (r.tipo !== 'horario') return false
  if (r.modo !== 'dentro' && r.modo !== 'fuera') return false
  if (typeof r.zona_horaria !== 'string' || r.zona_horaria.length === 0) return false
  if (!Array.isArray(r.dias) || r.dias.length === 0) return false
  if (!r.dias.every((d) => typeof d === 'string' && DIAS_SEMANA_SET.has(d))) return false
  if (typeof r.hora_desde !== 'string' || !HORA_HH_MM_REGEX.test(r.hora_desde)) return false
  if (typeof r.hora_hasta !== 'string' || !HORA_HH_MM_REGEX.test(r.hora_hasta)) return false
  return true
}

/**
 * Valida una condición (hoja, compuesta u horaria). Recursivo para
 * compuestas, con tope de profundidad razonable. La profundidad
 * efectiva de ejecución se valida en `evaluar-condicion.ts`.
 */
export function esCondicionWorkflow(c: unknown, profundidad = 0): c is CondicionWorkflow {
  if (typeof c !== 'object' || c === null) return false
  if (profundidad > 10) return false // tope estructural duro
  const r = c as Record<string, unknown>
  // Horaria: discriminador explícito.
  if (r.tipo === 'horario') {
    return esCondicionHorario(c)
  }
  // Compuesta: tiene `condiciones` array.
  if (Array.isArray(r.condiciones)) {
    if (r.operador !== 'y' && r.operador !== 'o') return false
    return r.condiciones.every((sub) => esCondicionWorkflow(sub, profundidad + 1))
  }
  // Hoja: tiene `campo` + `operador`.
  if (typeof r.campo !== 'string' || r.campo.length === 0) return false
  if (typeof r.operador !== 'string') return false
  if (!OPERADORES_COMPARACION.has(r.operador)) return false
  return true
}

/**
 * Valida la forma mínima de cualquier acción del catálogo: que sea
 * objeto, tenga `tipo` string conocido. NO valida el shape específico
 * de cada tipo — para eso están los guards individuales arriba.
 */
export function esAccionConocida(a: unknown): a is AccionWorkflow {
  if (typeof a !== 'object' || a === null) return false
  const r = a as Record<string, unknown>
  return esTipoAccion(r.tipo)
}

/**
 * Valida que un body desconocido sea un webhook payload de Supabase
 * para INSERT en public.cambios_estado. Es el primer chequeo que hace
 * la Edge Function antes de procesar — si falla, devuelve 400.
 *
 * Verifica solo los campos que el dispatcher necesita para hacer match
 * (id, empresa_id, entidad_tipo, entidad_id, estado_nuevo). Los demás
 * pasan por validación implícita al usarlos.
 */
export function esWebhookPayloadCambiosEstado(
  p: unknown,
): p is WebhookPayloadCambiosEstado {
  if (typeof p !== 'object' || p === null) return false
  const r = p as Record<string, unknown>
  if (r.type !== 'INSERT') return false
  if (r.table !== 'cambios_estado') return false
  if (r.schema !== 'public') return false
  if (typeof r.record !== 'object' || r.record === null) return false
  const rec = r.record as Record<string, unknown>
  if (typeof rec.id !== 'string' || rec.id.length === 0) return false
  if (typeof rec.empresa_id !== 'string' || rec.empresa_id.length === 0) return false
  if (typeof rec.entidad_tipo !== 'string' || rec.entidad_tipo.length === 0) return false
  if (typeof rec.entidad_id !== 'string' || rec.entidad_id.length === 0) return false
  if (typeof rec.estado_nuevo !== 'string' || rec.estado_nuevo.length === 0) return false
  // estado_anterior puede ser null (creación) o string.
  if (rec.estado_anterior !== null && typeof rec.estado_anterior !== 'string') return false
  return true
}
