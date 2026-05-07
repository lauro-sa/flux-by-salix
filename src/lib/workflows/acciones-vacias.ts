/**
 * Factories de objetos vacíos para los pasos del editor visual de
 * flujos (sub-PR 19.2).
 *
 * Cuando el usuario elige un tipo de paso desde el modal `CatalogoPasos`,
 * el editor inserta una acción nueva al array `acciones` del flujo. Esa
 * acción tiene que cumplir el shape de la discriminated union
 * `AccionWorkflow` para que el backend (sub-PR 18.1) acepte el PUT y
 * el motor (sub-PRs 14-17) la pueda interpretar más tarde.
 *
 * Política:
 *   • Devolvemos shape mínimo válido — string vacío para campos
 *     requeridos string, array vacío para listas, false / 0 para
 *     primitivos, `null` para opcionales que admiten null.
 *   • La validación de "campos requeridos completos" la hace el
 *     sub-PR 19.4 (banner rojo al activar/publicar). En 19.2 el shape
 *     es válido para el guard del PUT pero "incompleto" para el motor.
 *   • El campo `id` lo agrega el editor al insertar (no este factory)
 *     porque dnd-kit necesita un ID estable a nivel del array y los
 *     factories no deben generar UUIDs (testabilidad).
 *
 * Reusable a futuro (19.3 panel lateral): el panel mismo puede pedirle
 * al factory un shape limpio cuando el usuario "duplica con valores
 * default" o "limpia este paso".
 */

import type {
  AccionWorkflow,
  CondicionWorkflow,
  DisparadorWorkflow,
  TipoAccion,
  TipoDisparador,
} from '@/tipos/workflow'

// =============================================================
// Disparadores
// =============================================================

/**
 * Crea un disparador con la configuración mínima válida estructural
 * para el tipo dado. La UI marca campos sin completar como warnings;
 * la validación dura es 19.4.
 */
export function crearDisparadorVacio(tipo: TipoDisparador): DisparadorWorkflow {
  switch (tipo) {
    case 'entidad.estado_cambio':
      // entidad_tipo y hasta_clave son strings requeridos. Los dejamos
      // vacíos para que el panel lateral los complete.
      return {
        tipo: 'entidad.estado_cambio',
        configuracion: { entidad_tipo: 'presupuesto', hasta_clave: '' },
      }
    case 'entidad.creada':
      return {
        tipo: 'entidad.creada',
        configuracion: { entidad_tipo: 'presupuesto' },
      }
    case 'entidad.campo_cambia':
      return {
        tipo: 'entidad.campo_cambia',
        configuracion: { entidad_tipo: 'presupuesto', campo: '' },
      }
    case 'actividad.completada':
      return {
        tipo: 'actividad.completada',
        configuracion: {},
      }
    case 'tiempo.cron':
      return {
        tipo: 'tiempo.cron',
        configuracion: { expresion: '0 9 * * *' },
      }
    case 'tiempo.relativo_a_campo':
      return {
        tipo: 'tiempo.relativo_a_campo',
        configuracion: {
          entidad_tipo: 'presupuesto',
          campo_fecha: '',
          delta_dias: 0,
          hora_local: '09:00',
        },
      }
    case 'webhook.entrante':
      return {
        tipo: 'webhook.entrante',
        configuracion: { slug: '' },
      }
    case 'inbox.mensaje_recibido':
      return {
        tipo: 'inbox.mensaje_recibido',
        configuracion: {},
      }
    case 'inbox.conversacion_sin_respuesta':
      return {
        tipo: 'inbox.conversacion_sin_respuesta',
        configuracion: { minutos_sin_respuesta: 60 },
      }
  }
}

// =============================================================
// Acciones
// =============================================================

/**
 * Condición vacía neutra para usar como punto de partida en
 * `condicion_branch`. El panel lateral 19.3 va a reemplazarla con un
 * builder visual.
 */
function condicionVacia(): CondicionWorkflow {
  return { campo: '', operador: 'igual', valor: '' }
}

export function crearAccionVacia(tipo: TipoAccion): AccionWorkflow {
  switch (tipo) {
    // ─── Acciones con shape específico (sub-PR 15.1 + 15.2) ─────
    case 'enviar_whatsapp_plantilla':
      return {
        tipo: 'enviar_whatsapp_plantilla',
        canal_id: '',
        telefono: '',
        plantilla_nombre: '',
        idioma: 'es',
      }
    case 'crear_actividad':
      return {
        tipo: 'crear_actividad',
        tipo_actividad_id: '',
        titulo: '',
      }
    case 'cambiar_estado_entidad':
      return {
        tipo: 'cambiar_estado_entidad',
        entidad_tipo: 'presupuesto',
        entidad_id: '',
        hasta_clave: '',
      }
    case 'notificar_usuario':
      return {
        tipo: 'notificar_usuario',
        usuario_id: '',
        titulo: '',
      }
    case 'esperar':
      return {
        tipo: 'esperar',
        duracion_ms: 60_000, // 1 minuto — punto de partida razonable.
      }
    case 'condicion_branch':
      return {
        tipo: 'condicion_branch',
        condicion: condicionVacia(),
        acciones_si: [],
        acciones_no: [],
      }
    case 'terminar_flujo':
      return {
        tipo: 'terminar_flujo',
      }

    // ─── Acciones genéricas (shape `parametros`) ────────────────
    // Son las del catálogo todavía sin shape específico (sub-PR 15.3+).
    // Las exhaustimos individualmente en lugar de usar `default` para
    // que TS pinte un error si se agrega un `TipoAccion` nuevo y se
    // olvidan de mapearlo acá.
    case 'enviar_whatsapp_texto':
    case 'enviar_correo_plantilla':
    case 'enviar_correo_texto':
    case 'asignar_usuario':
    case 'agregar_etiqueta':
    case 'quitar_etiqueta':
    case 'notificar_grupo':
    case 'crear_orden_trabajo':
    case 'crear_visita':
    case 'webhook_saliente':
    case 'esperar_evento':
      return { tipo, parametros: {} }
  }
}
