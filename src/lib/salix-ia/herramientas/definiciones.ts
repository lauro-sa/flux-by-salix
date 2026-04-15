/**
 * Definiciones de herramientas para Salix IA.
 * Cada herramienta tiene su schema Anthropic (tool_use) y metadata de permisos.
 */

import type { DefinicionHerramienta } from '@/tipos/salix-ia'

export const HERRAMIENTAS_SALIX_IA: DefinicionHerramienta[] = [
  // ─── CONTACTOS ───
  {
    nombre: 'buscar_contactos',
    definicion: {
      name: 'buscar_contactos',
      description: 'Busca contactos por nombre, teléfono, email o empresa. Devuelve una lista de coincidencias.',
      input_schema: {
        type: 'object',
        properties: {
          busqueda: {
            type: 'string',
            description: 'Texto a buscar: nombre, apellido, teléfono, email o empresa del contacto',
          },
          limite: {
            type: 'number',
            description: 'Cantidad máxima de resultados (default: 10)',
          },
        },
        required: ['busqueda'],
      },
    },
    modulo: 'contactos',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: true,
  },
  {
    nombre: 'obtener_contacto',
    definicion: {
      name: 'obtener_contacto',
      description: 'Obtiene los datos completos de un contacto específico por su ID.',
      input_schema: {
        type: 'object',
        properties: {
          contacto_id: {
            type: 'string',
            description: 'ID (UUID) del contacto',
          },
        },
        required: ['contacto_id'],
      },
    },
    modulo: 'contactos',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: true,
  },
  {
    nombre: 'crear_contacto',
    definicion: {
      name: 'crear_contacto',
      description: 'Crea un nuevo contacto en el sistema. Requiere al menos nombre.',
      input_schema: {
        type: 'object',
        properties: {
          nombre: { type: 'string', description: 'Nombre del contacto' },
          apellido: { type: 'string', description: 'Apellido del contacto' },
          telefono: { type: 'string', description: 'Número de teléfono' },
          whatsapp: { type: 'string', description: 'Número de WhatsApp (si es diferente al teléfono)' },
          correo: { type: 'string', description: 'Correo electrónico' },
          empresa: { type: 'string', description: 'Nombre de la empresa del contacto' },
          cargo: { type: 'string', description: 'Cargo o puesto' },
          notas: { type: 'string', description: 'Notas adicionales' },
        },
        required: ['nombre'],
      },
    },
    modulo: 'contactos',
    accion_requerida: 'crear',
    soporta_visibilidad: false,
  },

  // ─── ACTIVIDADES ───
  {
    nombre: 'crear_actividad',
    definicion: {
      name: 'crear_actividad',
      description: 'Crea una nueva actividad (tarea, llamada, reunión, etc.) usando los tipos existentes en el sistema. Puede vincularla a un contacto.',
      input_schema: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título de la actividad' },
          descripcion: { type: 'string', description: 'Descripción o detalle' },
          tipo_clave: {
            type: 'string',
            description: 'Clave del tipo de actividad (ej: "llamada", "reunion", "tarea", "visita", "seguimiento"). Debe ser un tipo que ya exista en la empresa.',
          },
          prioridad: {
            type: 'string',
            enum: ['baja', 'normal', 'alta', 'urgente'],
            description: 'Prioridad de la actividad (default: normal)',
          },
          fecha_vencimiento: {
            type: 'string',
            description: 'Fecha de vencimiento en formato ISO 8601 (ej: "2026-04-15T10:00:00")',
          },
          contacto_id: {
            type: 'string',
            description: 'ID del contacto a vincular (opcional)',
          },
          asignado_a_id: {
            type: 'string',
            description: 'ID del usuario al que asignar. Si no se indica, se asigna al usuario actual.',
          },
          presupuesto_id: {
            type: 'string',
            description: 'ID del presupuesto a vincular (opcional). Buscalo primero con buscar_presupuestos.',
          },
        },
        required: ['titulo'],
      },
    },
    modulo: 'actividades',
    accion_requerida: 'crear',
    soporta_visibilidad: false,
  },

  // ─── CALENDARIO / RECORDATORIOS ───
  {
    nombre: 'crear_recordatorio',
    definicion: {
      name: 'crear_recordatorio',
      description: 'Crea un recordatorio en el calendario. Se crea como evento con una alerta.',
      input_schema: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título del recordatorio' },
          descripcion: { type: 'string', description: 'Descripción o detalle' },
          fecha: {
            type: 'string',
            description: 'Fecha y hora del recordatorio en formato ISO 8601 (ej: "2026-04-15T10:00:00")',
          },
          minutos_antes: {
            type: 'number',
            description: 'Minutos antes para la alerta (default: 15). Usa 0 para alerta en el momento exacto.',
          },
        },
        required: ['titulo', 'fecha'],
      },
    },
    modulo: 'calendario',
    accion_requerida: 'crear',
    soporta_visibilidad: false,
  },

  // ─── VISITAS ───
  {
    nombre: 'crear_visita',
    definicion: {
      name: 'crear_visita',
      description: 'Agenda una visita a un contacto en una fecha determinada.',
      input_schema: {
        type: 'object',
        properties: {
          contacto_id: { type: 'string', description: 'ID del contacto a visitar' },
          fecha_programada: {
            type: 'string',
            description: 'Fecha y hora programada en formato ISO 8601',
          },
          motivo: { type: 'string', description: 'Motivo de la visita' },
          notas: { type: 'string', description: 'Notas adicionales' },
          prioridad: {
            type: 'string',
            enum: ['baja', 'normal', 'alta'],
            description: 'Prioridad (default: normal)',
          },
          duracion_estimada_min: {
            type: 'number',
            description: 'Duración estimada en minutos (default: 60)',
          },
        },
        required: ['contacto_id', 'fecha_programada'],
      },
    },
    modulo: 'visitas',
    accion_requerida: 'crear',
    soporta_visibilidad: false,
  },

  // ─── CONSULTAS ───
  {
    nombre: 'consultar_asistencias',
    definicion: {
      name: 'consultar_asistencias',
      description: 'Consulta la asistencia de empleados: quiénes vinieron, quién falta, quién llegó tarde. Puede consultar un día específico o el día actual.',
      input_schema: {
        type: 'object',
        properties: {
          fecha: {
            type: 'string',
            description: 'Fecha a consultar en formato YYYY-MM-DD (default: hoy)',
          },
          miembro_id: {
            type: 'string',
            description: 'ID del miembro específico a consultar (opcional, para ver uno solo)',
          },
        },
      },
    },
    modulo: 'asistencias',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: true,
  },
  {
    nombre: 'consultar_calendario',
    definicion: {
      name: 'consultar_calendario',
      description: 'Consulta los eventos del calendario para una fecha o rango de fechas.',
      input_schema: {
        type: 'object',
        properties: {
          fecha_inicio: {
            type: 'string',
            description: 'Fecha de inicio en formato YYYY-MM-DD (default: hoy)',
          },
          fecha_fin: {
            type: 'string',
            description: 'Fecha de fin en formato YYYY-MM-DD (default: mismo día que fecha_inicio)',
          },
          usuario_id: {
            type: 'string',
            description: 'ID del usuario cuyos eventos consultar (default: usuario actual)',
          },
        },
      },
    },
    modulo: 'calendario',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: true,
  },
  {
    nombre: 'consultar_actividades',
    definicion: {
      name: 'consultar_actividades',
      description: 'Consulta actividades pendientes, vencidas o completadas. Puede buscar por nombre/título, filtrar por tipo, estado, fecha y asignado.',
      input_schema: {
        type: 'object',
        properties: {
          busqueda: {
            type: 'string',
            description: 'Buscar actividades por título o nombre del contacto vinculado (ej: "Nora", "llamada Pérez")',
          },
          estado: {
            type: 'string',
            enum: ['pendiente', 'completada', 'cancelada', 'todas'],
            description: 'Estado a filtrar (default: pendiente)',
          },
          tipo_clave: {
            type: 'string',
            description: 'Filtrar por tipo de actividad (ej: "llamada", "tarea")',
          },
          fecha_desde: {
            type: 'string',
            description: 'Fecha de vencimiento desde (formato YYYY-MM-DD)',
          },
          fecha_hasta: {
            type: 'string',
            description: 'Fecha de vencimiento hasta (formato YYYY-MM-DD)',
          },
          asignado_a_id: {
            type: 'string',
            description: 'ID del usuario asignado (default: usuario actual)',
          },
          limite: {
            type: 'number',
            description: 'Cantidad máxima de resultados (default: 20)',
          },
        },
      },
    },
    modulo: 'actividades',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: true,
  },
  {
    nombre: 'consultar_visitas',
    definicion: {
      name: 'consultar_visitas',
      description: 'Consulta las visitas programadas, completadas o canceladas.',
      input_schema: {
        type: 'object',
        properties: {
          estado: {
            type: 'string',
            enum: ['programada', 'en_camino', 'en_sitio', 'completada', 'cancelada', 'todas'],
            description: 'Estado a filtrar (default: programada)',
          },
          fecha_desde: {
            type: 'string',
            description: 'Fecha desde (formato YYYY-MM-DD)',
          },
          fecha_hasta: {
            type: 'string',
            description: 'Fecha hasta (formato YYYY-MM-DD)',
          },
          asignado_a_id: {
            type: 'string',
            description: 'ID del visitador asignado (default: usuario actual)',
          },
          limite: {
            type: 'number',
            description: 'Cantidad máxima de resultados (default: 20)',
          },
        },
      },
    },
    modulo: 'visitas',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: true,
  },

  // ─── PRESUPUESTOS ───
  {
    nombre: 'buscar_presupuestos',
    definicion: {
      name: 'buscar_presupuestos',
      description: 'Busca presupuestos por número (ej: "25-109"), nombre del contacto, dirección/calle o referencia.',
      input_schema: {
        type: 'object',
        properties: {
          busqueda: {
            type: 'string',
            description: 'Texto a buscar: número de presupuesto, nombre del contacto, dirección o referencia',
          },
          estado: {
            type: 'string',
            enum: ['borrador', 'enviado', 'aceptado', 'rechazado', 'vencido', 'cancelado', 'todos'],
            description: 'Filtrar por estado (default: todos)',
          },
          limite: {
            type: 'number',
            description: 'Cantidad máxima de resultados (default: 10)',
          },
        },
        required: ['busqueda'],
      },
    },
    modulo: 'presupuestos',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: true,
  },

  // ─── MODIFICACIONES ───
  {
    nombre: 'modificar_actividad',
    definicion: {
      name: 'modificar_actividad',
      description: 'Modifica una actividad: cambiar estado (completar, cancelar, etc.), prioridad, fecha de vencimiento o reasignar. Primero consultá la actividad para obtener su ID.',
      input_schema: {
        type: 'object',
        properties: {
          actividad_id: { type: 'string', description: 'ID de la actividad a modificar' },
          estado_clave: {
            type: 'string',
            description: 'Nuevo estado (ej: "completada", "cancelada", "pendiente"). Si no sabés los disponibles, la herramienta te los muestra.',
          },
          prioridad: { type: 'string', enum: ['baja', 'normal', 'alta', 'urgente'] },
          fecha_vencimiento: { type: 'string', description: 'Nueva fecha en formato ISO 8601' },
          asignado_a_id: { type: 'string', description: 'ID del nuevo asignado' },
        },
        required: ['actividad_id'],
      },
    },
    modulo: 'actividades',
    accion_requerida: 'editar',
    soporta_visibilidad: false,
  },
  {
    nombre: 'modificar_visita',
    definicion: {
      name: 'modificar_visita',
      description: 'Modifica una visita: cambiar estado (cancelar, completar, reprogramar), fecha, notas o resultado.',
      input_schema: {
        type: 'object',
        properties: {
          visita_id: { type: 'string', description: 'ID de la visita a modificar' },
          estado: {
            type: 'string',
            enum: ['programada', 'en_camino', 'en_sitio', 'completada', 'cancelada', 'reprogramada'],
            description: 'Nuevo estado',
          },
          fecha_programada: { type: 'string', description: 'Nueva fecha en formato ISO 8601 (para reprogramar)' },
          notas: { type: 'string', description: 'Notas de la visita' },
          resultado: { type: 'string', description: 'Resultado de la visita' },
        },
        required: ['visita_id'],
      },
    },
    modulo: 'visitas',
    accion_requerida: 'editar',
    soporta_visibilidad: false,
  },
  {
    nombre: 'modificar_presupuesto',
    definicion: {
      name: 'modificar_presupuesto',
      description: 'Cambia el estado de un presupuesto: enviar, aceptar, rechazar, cancelar, etc. Respeta las transiciones válidas (ej: borrador→enviado, enviado→aceptado).',
      input_schema: {
        type: 'object',
        properties: {
          presupuesto_id: { type: 'string', description: 'ID del presupuesto a modificar' },
          estado: {
            type: 'string',
            enum: ['borrador', 'enviado', 'aceptado', 'rechazado', 'cancelado'],
            description: 'Nuevo estado',
          },
        },
        required: ['presupuesto_id'],
      },
    },
    modulo: 'presupuestos',
    accion_requerida: 'editar',
    soporta_visibilidad: false,
  },
  {
    nombre: 'modificar_evento',
    definicion: {
      name: 'modificar_evento',
      description: 'Modifica o cancela un evento del calendario: cambiar fecha, título, estado o cancelarlo.',
      input_schema: {
        type: 'object',
        properties: {
          evento_id: { type: 'string', description: 'ID del evento a modificar' },
          estado: { type: 'string', enum: ['confirmado', 'tentativo', 'cancelado'], description: 'Nuevo estado' },
          titulo: { type: 'string', description: 'Nuevo título' },
          fecha_inicio: { type: 'string', description: 'Nueva fecha de inicio en formato ISO 8601' },
          fecha_fin: { type: 'string', description: 'Nueva fecha de fin en formato ISO 8601' },
          eliminar: { type: 'boolean', description: 'true para cancelar/eliminar el evento' },
        },
        required: ['evento_id'],
      },
    },
    modulo: 'calendario',
    accion_requerida: 'editar',
    soporta_visibilidad: false,
  },
]
