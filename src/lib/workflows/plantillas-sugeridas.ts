/**
 * Catálogo curado de plantillas sugeridas para flujos.
 *
 * Cada plantilla incluye disparador + acciones + ícono + color en estructura
 * lista para pre-rellenar el editor (lo va a consumir 19.2). En el sub-PR 19.1
 * el catálogo se usa para:
 *
 *   1. Estado vacío educativo (`/flujos` sin flujos): mini-cards filtradas
 *      por módulos instalados de la empresa.
 *   2. Pestaña "Desde una plantilla" del modal "+ Nuevo flujo".
 *
 * IMPORTANTE — sub-PR 19.1 (decisión D5=C del coordinador):
 * El POST de creación NO usa esta estructura todavía: solo manda `{ nombre,
 * descripcion }` y el flujo nace en estado borrador con disparador/acciones
 * vacíos. El pre-relleno real (mapear `disparador` y `acciones` a la BD) lo
 * hace el editor de 19.2 cuando aterrice. El catálogo ya queda armado
 * completo para evitar tocarlo después.
 *
 * Las etiquetas legibles (título, descripción, acciones humanas) NO están
 * en este archivo — se resuelven con i18n usando `claves_i18n.titulo` y
 * `claves_i18n.descripcion`. Strings reales viven en `lib/i18n/{es,en,pt}.ts`
 * (regla "cero hardcodeo i18n desde el inicio").
 *
 * Filtrado por módulos instalados:
 * - Módulos base (`contactos`, `actividades`) están siempre instalados.
 * - Módulos opcionales (`presupuestos`, `cuotas`, `inbox_whatsapp`, etc.)
 *   se chequean con `useModulos.tieneModulo(slug)` antes de mostrar.
 */

import type {
  AccionWorkflow,
  DisparadorWorkflow,
  TipoDisparador,
} from '@/tipos/workflow'
import type { EntidadConEstado } from '@/tipos/estados'

// =============================================================
// Tipo de cada plantilla del catálogo
// =============================================================

export interface PlantillaSugerida {
  /** ID estable (slug). Se usa como clave de React y en analítica futura. */
  id: string
  /** Módulo principal sobre el que opera. Sirve para filtrar y badge. */
  modulo: EntidadConEstado | 'inbox_whatsapp' | 'presupuestos'
  /**
   * Slug del módulo en el catálogo (`useModulos.tieneModulo`). Si no es
   * de un módulo opcional (ej: `contactos`, `actividades`), poner `null`
   * y se considera siempre disponible.
   */
  modulo_catalogo: string | null
  /** Ícono lucide-react (string del nombre, se mapea en el componente). */
  icono: string
  /** Color de Insignia para el badge / fondo del ícono. */
  color: 'exito' | 'peligro' | 'advertencia' | 'info' | 'primario' | 'rosa' | 'cyan' | 'violeta' | 'naranja'
  /** Tipo de disparador para mostrar el chip "Se dispara: …". */
  tipo_disparador: TipoDisparador
  /**
   * Disparador completo pre-armado. Lo consume 19.2 al abrir el editor con
   * `?plantilla=<id>`. En 19.1 no se manda al backend — solo se usa para
   * mostrar info en la card.
   */
  disparador: DisparadorWorkflow
  /** Acciones pre-armadas. En 19.1 también se ignoran del POST. */
  acciones: AccionWorkflow[]
  /**
   * Claves i18n. Las strings reales viven en `flujos.plantillas.<id>.*`
   * (que se completan en 19.2 cuando se conecten realmente al editor).
   * Para el sub-PR 19.1 los renderers caen en un fallback hardcodeado en
   * el archivo de traducciones (sección `flujos.estado_vacio.*`).
   */
  claves_i18n: {
    /** Ej: 'flujos.plantillas.recordatorio_cuota_3dias.titulo' */
    titulo: string
    descripcion: string
  }
  /**
   * Fallback en español por si la clave i18n aún no se materializó. El
   * editor de 19.2 va a poblar las claves; mientras tanto la UI de 19.1
   * usa estos textos directamente. Cuando 19.2 cierre, se puede borrar
   * este campo y forzar i18n estricto.
   */
  fallback_es: {
    titulo: string
    descripcion: string
  }
}

// =============================================================
// Catálogo
// =============================================================
// Mantener este array como fuente única de verdad. Cada plantilla nueva
// suma a este array — no hay reglas dinámicas.

export const PLANTILLAS_SUGERIDAS: readonly PlantillaSugerida[] = [
  // ─── Cuotas ──────────────────────────────────────────────────
  {
    id: 'recordatorio_cuota_3dias',
    modulo: 'cuota',
    modulo_catalogo: 'cuotas',
    icono: 'BellRing',
    color: 'advertencia',
    tipo_disparador: 'tiempo.relativo_a_campo',
    disparador: {
      tipo: 'tiempo.relativo_a_campo',
      configuracion: {
        entidad_tipo: 'cuota',
        campo_fecha: 'fecha_vencimiento',
        delta_dias: -3,
        hora_local: '09:00',
        filtro_estado_clave: ['pendiente'],
      },
    },
    acciones: [],
    claves_i18n: {
      titulo: 'flujos.plantillas.recordatorio_cuota_3dias.titulo',
      descripcion: 'flujos.plantillas.recordatorio_cuota_3dias.descripcion',
    },
    fallback_es: {
      titulo: 'Recordatorio 3 días antes del vencimiento',
      descripcion: 'Avisa por WhatsApp al cliente cuando falten 3 días para que venza una cuota pendiente.',
    },
  },
  {
    id: 'notificar_pago_cuota',
    modulo: 'cuota',
    modulo_catalogo: 'cuotas',
    icono: 'CheckCircle2',
    color: 'exito',
    tipo_disparador: 'entidad.estado_cambio',
    disparador: {
      tipo: 'entidad.estado_cambio',
      configuracion: { entidad_tipo: 'cuota', hasta_clave: 'pagada' },
    },
    acciones: [],
    claves_i18n: {
      titulo: 'flujos.plantillas.notificar_pago_cuota.titulo',
      descripcion: 'flujos.plantillas.notificar_pago_cuota.descripcion',
    },
    fallback_es: {
      titulo: 'Notificar al cliente cuando paga una cuota',
      descripcion: 'Mandá un mensaje de agradecimiento por WhatsApp cuando una cuota pasa a "pagada".',
    },
  },

  // ─── Presupuestos ────────────────────────────────────────────
  {
    id: 'presupuesto_aceptado_avisar_vendedor',
    modulo: 'presupuesto',
    modulo_catalogo: 'presupuestos',
    icono: 'CheckCircle2',
    color: 'exito',
    tipo_disparador: 'entidad.estado_cambio',
    disparador: {
      tipo: 'entidad.estado_cambio',
      configuracion: { entidad_tipo: 'presupuesto', hasta_clave: 'aceptado' },
    },
    acciones: [],
    claves_i18n: {
      titulo: 'flujos.plantillas.presupuesto_aceptado_avisar_vendedor.titulo',
      descripcion: 'flujos.plantillas.presupuesto_aceptado_avisar_vendedor.descripcion',
    },
    fallback_es: {
      titulo: 'Notificar al vendedor cuando aceptan un presupuesto',
      descripcion: 'Crea una notificación interna al vendedor responsable apenas un cliente acepta su presupuesto.',
    },
  },
  {
    id: 'recordatorio_presupuesto_pendiente',
    modulo: 'presupuesto',
    modulo_catalogo: 'presupuestos',
    icono: 'Clock',
    color: 'advertencia',
    tipo_disparador: 'tiempo.relativo_a_campo',
    disparador: {
      tipo: 'tiempo.relativo_a_campo',
      configuracion: {
        entidad_tipo: 'presupuesto',
        campo_fecha: 'actualizado_en',
        delta_dias: 7,
        hora_local: '10:00',
        filtro_estado_clave: ['enviado'],
      },
    },
    acciones: [],
    claves_i18n: {
      titulo: 'flujos.plantillas.recordatorio_presupuesto_pendiente.titulo',
      descripcion: 'flujos.plantillas.recordatorio_presupuesto_pendiente.descripcion',
    },
    fallback_es: {
      titulo: 'Recordar presupuestos enviados sin respuesta',
      descripcion: 'A los 7 días sin movimiento, mandá un seguimiento al cliente para destrabar la decisión.',
    },
  },

  // ─── Visitas ─────────────────────────────────────────────────
  {
    id: 'confirmar_visita_dia_anterior',
    modulo: 'visita',
    modulo_catalogo: 'visitas',
    icono: 'CalendarCheck',
    color: 'info',
    tipo_disparador: 'tiempo.relativo_a_campo',
    disparador: {
      tipo: 'tiempo.relativo_a_campo',
      configuracion: {
        entidad_tipo: 'visita',
        campo_fecha: 'fecha_programada',
        delta_dias: -1,
        hora_local: '17:00',
        filtro_estado_clave: ['programada'],
      },
    },
    acciones: [],
    claves_i18n: {
      titulo: 'flujos.plantillas.confirmar_visita_dia_anterior.titulo',
      descripcion: 'flujos.plantillas.confirmar_visita_dia_anterior.descripcion',
    },
    fallback_es: {
      titulo: 'Confirmar visita un día antes',
      descripcion: 'El día anterior a la visita, mandá WhatsApp al contacto para confirmar horario y reducir cancelaciones.',
    },
  },
  {
    id: 'seguimiento_visita_completada',
    modulo: 'visita',
    modulo_catalogo: 'visitas',
    icono: 'ArrowRightCircle',
    color: 'primario',
    tipo_disparador: 'entidad.estado_cambio',
    disparador: {
      tipo: 'entidad.estado_cambio',
      configuracion: { entidad_tipo: 'visita', hasta_clave: 'completada' },
    },
    acciones: [],
    claves_i18n: {
      titulo: 'flujos.plantillas.seguimiento_visita_completada.titulo',
      descripcion: 'flujos.plantillas.seguimiento_visita_completada.descripcion',
    },
    fallback_es: {
      titulo: 'Crear actividad de seguimiento al completar visita',
      descripcion: 'Apenas se completa una visita, generá una actividad "seguimiento" asignada al visitador.',
    },
  },

  // ─── Inbox WhatsApp ──────────────────────────────────────────
  {
    id: 'conversacion_sin_respuesta',
    modulo: 'inbox_whatsapp',
    modulo_catalogo: 'inbox_whatsapp',
    icono: 'AlarmClock',
    color: 'peligro',
    tipo_disparador: 'inbox.conversacion_sin_respuesta',
    disparador: {
      tipo: 'inbox.conversacion_sin_respuesta',
      configuracion: { minutos_sin_respuesta: 120 },
    },
    acciones: [],
    claves_i18n: {
      titulo: 'flujos.plantillas.conversacion_sin_respuesta.titulo',
      descripcion: 'flujos.plantillas.conversacion_sin_respuesta.descripcion',
    },
    fallback_es: {
      titulo: 'Asignar a supervisor si una conversación lleva 2 hs sin respuesta',
      descripcion: 'Cuando una conversación de WhatsApp pasa 2 horas sin respuesta, escalá automáticamente al supervisor.',
    },
  },

  // ─── Actividades ─────────────────────────────────────────────
  {
    id: 'actividad_completada_marcar_contacto',
    modulo: 'actividad',
    modulo_catalogo: null, // actividades es módulo base
    icono: 'Sparkles',
    color: 'cyan',
    tipo_disparador: 'actividad.completada',
    disparador: {
      tipo: 'actividad.completada',
      configuracion: {},
    },
    acciones: [],
    claves_i18n: {
      titulo: 'flujos.plantillas.actividad_completada_marcar_contacto.titulo',
      descripcion: 'flujos.plantillas.actividad_completada_marcar_contacto.descripcion',
    },
    fallback_es: {
      titulo: 'Etiquetar contacto al completar una actividad clave',
      descripcion: 'Cada vez que se completa una actividad importante, agregá una etiqueta al contacto vinculado.',
    },
  },
] as const

// =============================================================
// Helpers
// =============================================================

/**
 * Filtra plantillas según los módulos instalados de la empresa. Plantillas
 * con `modulo_catalogo: null` (módulos base) pasan siempre.
 *
 * @param tieneModulo callback de `useModulos.tieneModulo(slug)`.
 */
export function plantillasDisponibles(
  tieneModulo: (slug: string) => boolean,
): PlantillaSugerida[] {
  return PLANTILLAS_SUGERIDAS.filter((p) => {
    if (!p.modulo_catalogo) return true
    return tieneModulo(p.modulo_catalogo)
  })
}

/**
 * Devuelve `n` plantillas disponibles, priorizando diversidad de módulos
 * (no repetir el mismo módulo dos veces si hay otras opciones). Pensado
 * para el estado vacío educativo: mostrar 3 mini-cards balanceadas.
 */
export function plantillasDestacadas(
  tieneModulo: (slug: string) => boolean,
  n: number = 3,
): PlantillaSugerida[] {
  const disponibles = plantillasDisponibles(tieneModulo)
  const vistas = new Set<string>()
  const destacadas: PlantillaSugerida[] = []
  // Primera pasada: una por módulo distinto.
  for (const p of disponibles) {
    if (destacadas.length >= n) break
    if (vistas.has(p.modulo)) continue
    destacadas.push(p)
    vistas.add(p.modulo)
  }
  // Segunda pasada: rellenar con repetidos si faltan.
  for (const p of disponibles) {
    if (destacadas.length >= n) break
    if (destacadas.includes(p)) continue
    destacadas.push(p)
  }
  return destacadas
}

/**
 * Lookup por id (útil para 19.2 cuando el editor reciba `?plantilla=<id>`).
 */
export function plantillaPorId(id: string): PlantillaSugerida | null {
  return PLANTILLAS_SUGERIDAS.find((p) => p.id === id) ?? null
}
