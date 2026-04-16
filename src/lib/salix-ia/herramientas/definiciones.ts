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
      description: 'Crea un nuevo contacto en el sistema. Puede ser persona, empresa, edificio, proveedor o lead. Si se indica dirección, la valida con Google Places y la guarda con coordenadas.',
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
          tipo_clave: {
            type: 'string',
            enum: ['persona', 'empresa', 'edificio', 'proveedor', 'lead'],
            description: 'Tipo de contacto. Default: persona. Elegí según contexto: "es un proveedor" → proveedor, "empresa Herreelec" → empresa, "edificio Torres del Sol" → edificio.',
          },
          direccion: {
            type: 'string',
            description: 'Dirección del contacto (se valida con Google Places). Ej: "Av. Corrientes 1234, Buenos Aires"',
          },
          notas: { type: 'string', description: 'Notas adicionales' },
        },
        required: ['nombre'],
      },
    },
    modulo: 'contactos',
    accion_requerida: 'crear',
    soporta_visibilidad: false,
  },

  // ─── MODIFICAR CONTACTO ───
  {
    nombre: 'modificar_contacto',
    definicion: {
      name: 'modificar_contacto',
      description: 'Modifica datos de un contacto existente: nombre, apellido, teléfono, correo, cargo, empresa, tipo, notas o dirección. Para direcciones, valida automáticamente con Google Places. Siempre muestra el antes y después de cada cambio.',
      input_schema: {
        type: 'object',
        properties: {
          contacto_id: { type: 'string', description: 'ID del contacto a modificar. Buscalo primero con buscar_contactos.' },
          nombre: { type: 'string', description: 'Nuevo nombre' },
          apellido: { type: 'string', description: 'Nuevo apellido' },
          telefono: { type: 'string', description: 'Nuevo teléfono (también actualiza WhatsApp)' },
          correo: { type: 'string', description: 'Nuevo correo electrónico' },
          cargo: { type: 'string', description: 'Nuevo cargo/puesto' },
          empresa: { type: 'string', description: 'Nueva empresa/rubro' },
          tipo_clave: {
            type: 'string',
            enum: ['persona', 'empresa', 'edificio', 'proveedor', 'lead'],
            description: 'Cambiar tipo de contacto',
          },
          direccion: { type: 'string', description: 'Nueva dirección (se valida con Google Places). Ej: "Av. Corrientes 1234, Buenos Aires"' },
          notas: { type: 'string', description: 'Nuevas notas' },
        },
        required: ['contacto_id'],
      },
    },
    modulo: 'contactos',
    accion_requerida: 'editar',
    soporta_visibilidad: false,
  },

  // ─── BUSCAR DIRECCIÓN ───
  {
    nombre: 'buscar_direccion',
    definicion: {
      name: 'buscar_direccion',
      description: 'Busca y valida una dirección usando Google Places. Devuelve la dirección formateada con calle, barrio, ciudad, provincia y coordenadas. Usá esta herramienta ANTES de guardar una dirección en un contacto para validarla, o cuando el usuario pregunte por una dirección.',
      input_schema: {
        type: 'object',
        properties: {
          texto: {
            type: 'string',
            description: 'Dirección a buscar (ej: "Av Corrientes 1234 Buenos Aires", "directorio 1835 flores")',
          },
        },
        required: ['texto'],
      },
    },
    modulo: 'contactos',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: false,
  },

  // ─── ACTIVIDADES ───
  {
    nombre: 'crear_actividad',
    definicion: {
      name: 'crear_actividad',
      description: 'Crea una nueva actividad (tarea, llamada, reunión, seguimiento, etc.) usando los tipos existentes en el sistema. Puede vincularla a un contacto. IMPORTANTE: Para visitas usá crear_visita, NO esta herramienta.',
      input_schema: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título de la actividad' },
          descripcion: { type: 'string', description: 'Descripción o detalle' },
          tipo_clave: {
            type: 'string',
            description: 'Clave del tipo de actividad (ej: "llamada", "reunion", "tarea", "seguimiento"). Para visitas usá crear_visita. Debe ser un tipo que ya exista en la empresa.',
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
      description: 'Crea un recordatorio personal con notificación. Soporta recurrencia (diario, semanal, mensual, anual). El usuario recibirá notificación in-app, push y por WhatsApp cuando llegue la hora. También aparece en el calendario.',
      input_schema: {
        type: 'object',
        properties: {
          titulo: { type: 'string', description: 'Título del recordatorio (ej: "Llamar a Pérez", "Revisar presupuesto")' },
          descripcion: { type: 'string', description: 'Descripción o detalle adicional' },
          fecha: {
            type: 'string',
            description: 'Fecha y hora del recordatorio en formato ISO 8601 (ej: "2026-04-16T10:00:00")',
          },
          repetir: {
            type: 'string',
            enum: ['ninguno', 'diario', 'semanal', 'mensual', 'anual'],
            description: 'Frecuencia de repetición (default: ninguno). Ejemplos: "recordame todos los lunes" → semanal, "todos los días a las 9" → diario, "cada mes" → mensual.',
          },
          notificar_whatsapp: {
            type: 'boolean',
            description: 'Enviar recordatorio también por WhatsApp (default: true)',
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

  // ─── EQUIPO ───
  {
    nombre: 'consultar_equipo',
    definicion: {
      name: 'consultar_equipo',
      description: 'Consulta los miembros del equipo: nombres, roles, puestos, sector, contacto, horarios. Útil para saber quiénes trabajan en la empresa, buscar un empleado por nombre, ver su rol o datos de contacto.',
      input_schema: {
        type: 'object',
        properties: {
          busqueda: {
            type: 'string',
            description: 'Buscar miembro por nombre, rol, puesto o sector (opcional — sin búsqueda devuelve todos)',
          },
        },
      },
    },
    modulo: 'asistencias',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: true,
  },

  // ─── PRODUCTOS ───
  {
    nombre: 'consultar_productos',
    definicion: {
      name: 'consultar_productos',
      description: 'Consulta el catálogo de productos y servicios: buscar por nombre/código, ver precios, categorías, unidades. Útil para responder "qué productos tenemos", "cuánto cuesta X", "productos de categoría Y".',
      input_schema: {
        type: 'object',
        properties: {
          busqueda: {
            type: 'string',
            description: 'Buscar por nombre, código o descripción del producto (opcional — sin búsqueda devuelve todos)',
          },
          tipo: {
            type: 'string',
            enum: ['producto', 'servicio'],
            description: 'Filtrar por tipo: producto o servicio',
          },
          categoria: {
            type: 'string',
            description: 'Filtrar por categoría',
          },
          solo_favoritos: {
            type: 'boolean',
            description: 'Solo mostrar productos favoritos',
          },
          limite: {
            type: 'number',
            description: 'Cantidad máxima de resultados (default: 20)',
          },
        },
      },
    },
    modulo: 'presupuestos',
    accion_requerida: 'ver_propio',
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
      description: 'Consulta las visitas programadas, completadas o canceladas. Puede buscar por nombre de contacto, dirección o motivo.',
      input_schema: {
        type: 'object',
        properties: {
          busqueda: {
            type: 'string',
            description: 'Buscar visitas por nombre del contacto, dirección o motivo (ej: "Pérez", "zona norte")',
          },
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
    nombre: 'obtener_presupuesto',
    definicion: {
      name: 'obtener_presupuesto',
      description: 'Obtiene los datos COMPLETOS de un presupuesto: encabezado, líneas con productos/servicios y cantidades, totales, impuestos, descuentos, plan de pago con cuotas, fechas. Usá esta herramienta cuando el usuario pida ver el detalle de un presupuesto específico. Podés pasar el ID o el número.',
      input_schema: {
        type: 'object',
        properties: {
          presupuesto_id: {
            type: 'string',
            description: 'ID (UUID) del presupuesto',
          },
          numero: {
            type: 'string',
            description: 'Número del presupuesto (ej: "P-0042", "25-109"). Se usa si no tenés el ID.',
          },
        },
      },
    },
    modulo: 'presupuestos',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: true,
  },
  {
    nombre: 'buscar_presupuestos',
    definicion: {
      name: 'buscar_presupuestos',
      description: 'Busca y lista presupuestos. Puede buscar por número, nombre del contacto, dirección o referencia. También puede listar todos los presupuestos de un estado sin búsqueda (ej: "todos los pendientes", "presupuestos enviados", "cuántos presupuestos hay").',
      input_schema: {
        type: 'object',
        properties: {
          busqueda: {
            type: 'string',
            description: 'Texto a buscar: número de presupuesto, nombre del contacto, dirección o referencia (opcional — sin búsqueda lista todos)',
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
      description: 'Modifica una actividad: cambiar estado (completar, cancelar, etc.), prioridad, fecha de vencimiento o reasignar. Podés pasar el ID o buscar por título.',
      input_schema: {
        type: 'object',
        properties: {
          actividad_id: { type: 'string', description: 'ID de la actividad a modificar (opcional si usás busqueda)' },
          busqueda: { type: 'string', description: 'Buscar la actividad por título (ej: "Nora", "llamada Pérez"). Se usa si no tenés el ID.' },
          estado_clave: {
            type: 'string',
            description: 'Nuevo estado (ej: "completada", "cancelada", "pendiente"). Si no sabés los disponibles, la herramienta te los muestra.',
          },
          prioridad: { type: 'string', enum: ['baja', 'normal', 'alta', 'urgente'] },
          fecha_vencimiento: { type: 'string', description: 'Nueva fecha en formato ISO 8601' },
          asignado_a_id: { type: 'string', description: 'ID del nuevo asignado' },
          eliminar: { type: 'boolean', description: 'true para eliminar la actividad (moverla a papelera)' },
        },
        required: [],
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

  // ─── NOTAS RÁPIDAS ───
  {
    nombre: 'anotar_nota',
    definicion: {
      name: 'anotar_nota',
      description: 'Crea o agrega contenido a una nota rápida. IMPORTANTE: Si el usuario pide compartir con alguien y ya existe una nota compartida con esa persona, primero usá consultar_notas para encontrarla y pasá el nota_id para AGREGAR contenido a la existente (no crear otra nueva). Solo creá nueva si no existe una compartida con esa persona. Si el usuario dice "anotame", "apuntá", "guardame", "haceme una nota" o similar, usá SIEMPRE esta herramienta (nunca crear_actividad).',
      input_schema: {
        type: 'object',
        properties: {
          contenido: {
            type: 'string',
            description: 'Contenido de la nota. Formateá el texto con saltos de línea para que sea legible.',
          },
          titulo: {
            type: 'string',
            description: 'Título breve de la nota (opcional, se genera uno si no se da)',
          },
          compartir_con: {
            type: 'string',
            description: 'Nombre del miembro del equipo con quien compartir (ej: "Olivia", "Juan Pérez"). Si no se indica, la nota es personal.',
          },
          nota_id: {
            type: 'string',
            description: 'ID de nota existente para AGREGAR contenido sin borrar lo anterior. Usalo cuando ya existe una nota compartida con esa persona (buscala primero con consultar_notas). Si no se indica, crea una nueva.',
          },
        },
        required: ['contenido'],
      },
    },
    modulo: 'contactos',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: false,
  },
  {
    nombre: 'consultar_notas',
    definicion: {
      name: 'consultar_notas',
      description: 'Consulta las notas rápidas del usuario (propias y/o compartidas). Puede buscar por texto dentro de las notas.',
      input_schema: {
        type: 'object',
        properties: {
          tipo: {
            type: 'string',
            enum: ['todas', 'propias', 'compartidas'],
            description: 'Tipo de notas a consultar (default: todas)',
          },
          busqueda: {
            type: 'string',
            description: 'Texto a buscar dentro del título o contenido de las notas',
          },
        },
      },
    },
    modulo: 'contactos',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: false,
  },
  {
    nombre: 'modificar_nota',
    definicion: {
      name: 'modificar_nota',
      description: 'Modifica o elimina una nota rápida: cambiar título, contenido, fijar/desfijar o eliminar. Puede buscar la nota por título si no se tiene el ID.',
      input_schema: {
        type: 'object',
        properties: {
          nota_id: {
            type: 'string',
            description: 'ID de la nota a modificar (opcional si usás busqueda)',
          },
          busqueda: {
            type: 'string',
            description: 'Buscar la nota por título (ej: "lista de compras", "reunión"). Se usa si no tenés el ID.',
          },
          titulo: {
            type: 'string',
            description: 'Nuevo título de la nota',
          },
          contenido: {
            type: 'string',
            description: 'Nuevo contenido completo de la nota (reemplaza el anterior)',
          },
          fijada: {
            type: 'boolean',
            description: 'true para fijar la nota, false para desfijar',
          },
          eliminar: {
            type: 'boolean',
            description: 'true para eliminar (archivar) la nota',
          },
        },
        required: [],
      },
    },
    modulo: 'contactos',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: false,
  },
]
