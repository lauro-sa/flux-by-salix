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
      description: 'Busca contactos por nombre, teléfono, email o empresa. Soporta filtrar por tipo de contacto (persona, empresa, edificio, proveedor, lead) y enriquecer con actividad reciente (total/última visita, total/último presupuesto).',
      input_schema: {
        type: 'object',
        properties: {
          busqueda: {
            type: 'string',
            description: 'Texto a buscar: nombre, apellido, teléfono, email o empresa del contacto',
          },
          tipo_clave: {
            type: 'string',
            enum: ['persona', 'empresa', 'edificio', 'proveedor', 'lead'],
            description: 'Filtrar por tipo de contacto. Útil para "los últimos 5 edificios" → tipo_clave="edificio".',
          },
          incluir_actividad: {
            type: 'boolean',
            description: 'Si true, agrega a cada contacto: total_visitas, ultima_visita_fecha, ultima_visita_estado, total_presupuestos, ultimo_presupuesto_fecha. Usalo cuando la pregunta involucra "el Carlos que agendé hace poco" o "edificios con visitas recientes".',
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
      description: 'Crea un nuevo contacto en el sistema. Puede ser persona, empresa, edificio, proveedor o lead. Si se indica dirección, la valida con Google Places y la guarda con coordenadas. Soporta vincularlo en el mismo paso a un contacto contenedor (ej: crear "Juan" y vincularlo al edificio "Torres del Sol").',
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
          vincular_a_contacto_id: {
            type: 'string',
            description: 'ID del contacto contenedor al que vincular este nuevo contacto como hijo. Usalo para "agregale al edificio X el contacto Juan con tel 1155...". Buscá primero el contenedor con buscar_contactos.',
          },
          tipo_relacion_clave: {
            type: 'string',
            description: 'Clave del tipo de relación (configurada por la empresa, ej: "empleado_de", "administrador"). Solo aplica si pasás vincular_a_contacto_id.',
          },
          puesto_en_contenedor: {
            type: 'string',
            description: 'Rol o puesto contextual del nuevo contacto dentro del contenedor (ej: "encargado", "administrador"). Solo aplica si pasás vincular_a_contacto_id.',
          },
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

  // ─── VINCULACIONES ENTRE CONTACTOS ───
  {
    nombre: 'consultar_vinculaciones_contacto',
    definicion: {
      name: 'consultar_vinculaciones_contacto',
      description: 'Devuelve los contactos vinculados a un contacto dado. Por defecto trae las dos direcciones: hijos (contactos que este contacto agrupa, ej: empleados de una empresa, personas asignadas a un edificio) y padres (contenedores donde este contacto figura como hijo). Cada vinculado incluye su tipo de contacto, tipo de relación, puesto contextual y datos de contacto.',
      input_schema: {
        type: 'object',
        properties: {
          contacto_id: {
            type: 'string',
            description: 'ID del contacto cuyas vinculaciones querés consultar. Buscalo primero con buscar_contactos.',
          },
          direccion: {
            type: 'string',
            enum: ['hijos', 'padres', 'ambas'],
            description: 'hijos = contactos que este agrupa (ej: empleados, personas del edificio). padres = contenedores donde este figura. Default: ambas.',
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
    nombre: 'vincular_contactos',
    definicion: {
      name: 'vincular_contactos',
      description: 'Vincula dos contactos existentes (o desvincula si pasás desvincular=true). La vinculación es unidireccional: contacto_id es el dueño/contenedor (típicamente edificio o empresa) y vinculado_id es el hijo (la persona). Para crear un contacto nuevo Y vincularlo en un solo paso, usá crear_contacto con vincular_a_contacto_id.',
      input_schema: {
        type: 'object',
        properties: {
          contacto_id: {
            type: 'string',
            description: 'ID del contacto contenedor (edificio, empresa, etc.). Buscalo con buscar_contactos.',
          },
          vinculado_id: {
            type: 'string',
            description: 'ID del contacto a vincular como hijo. Buscalo con buscar_contactos.',
          },
          tipo_relacion_clave: {
            type: 'string',
            description: 'Clave del tipo de relación (configurada por la empresa, ej: "empleado_de", "administrador"). Si no la conocés, omitilo o consultá las disponibles probando con una y leyendo el error.',
          },
          puesto: {
            type: 'string',
            description: 'Rol o puesto contextual del vinculado dentro del contenedor (ej: "encargado del edificio", "administradora").',
          },
          recibe_documentos: {
            type: 'boolean',
            description: 'Si true, este vinculado puede recibir documentos en nombre del contenedor (ej: presupuestos, facturas). Default: false.',
          },
          desvincular: {
            type: 'boolean',
            description: 'Si true, elimina la vinculación entre contacto_id y vinculado_id en vez de crearla.',
          },
        },
        required: ['contacto_id', 'vinculado_id'],
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
      description: 'Consulta actividades pendientes, vencidas o completadas. Devuelve título, descripción, tipo, estado, prioridad, fecha de vencimiento, asignado y vínculos (contacto/presupuesto). Soporta filtrar por estado, tipo, rango de fechas, asignado y por vencimiento (vencidas / no vencidas / sin fecha).',
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
          filtro_vencimiento: {
            type: 'string',
            enum: ['todas', 'vencidas', 'no_vencidas', 'sin_fecha'],
            description: 'Filtro adicional por vencimiento. Es ortogonal al estado: "pendientes que no estén vencidas" → estado="pendiente" + filtro_vencimiento="no_vencidas". "Pendientes vencidas" → estado="pendiente" + filtro_vencimiento="vencidas". Default: todas.',
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
      description: 'Consulta las visitas programadas, completadas o canceladas. Puede buscar por nombre de contacto, dirección, motivo, o filtrar por tipo de contacto (ej: visitas solo a edificios).',
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
          tipo_contacto_clave: {
            type: 'string',
            enum: ['persona', 'empresa', 'edificio', 'proveedor', 'lead'],
            description: 'Filtrar visitas cuyo contacto sea de cierto tipo. Útil para "los últimos 5 edificios" → tipo_contacto_clave="edificio" + orden="desc".',
          },
          orden: {
            type: 'string',
            enum: ['asc', 'desc'],
            description: 'Orden por fecha. asc = próximas primero, desc = más recientes primero. Default: asc para programadas, desc para completadas/canceladas.',
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

  // ═══════════════════════════════════════════════════════════════
  // TOOLS PERSONALES — datos del propio empleado
  // ═══════════════════════════════════════════════════════════════
  // Disponibles para nivel_salix='personal' o 'completo'. Todas tienen scope
  // hardcodeado a ctx.miembro.id: ningún parámetro permite consultar a otro
  // empleado. Ventana histórica máxima: 3 periodos. Más atrás devuelven una
  // sugerencia de "consultá con tu administrador".

  {
    nombre: 'mi_recibo_periodo',
    definicion: {
      name: 'mi_recibo_periodo',
      description: 'Devuelve el recibo de nómina del propio empleado para el periodo solicitado: monto, días trabajados, ausencias, tardanzas, descuentos y feriados. Si no se especifica periodo, usa el "periodo relevante" (último cerrado pendiente de pago, o el actual si ya se cobró). Solo soporta el periodo en curso o los 2 anteriores; más atrás devuelve un aviso para consultar al administrador.',
      input_schema: {
        type: 'object',
        properties: {
          periodo: {
            type: 'string',
            enum: ['actual', 'anterior', 'antepasado'],
            description: 'Periodo a consultar relativo a hoy. Default: deja que la tool resuelva el periodo relevante (recomendado).',
          },
        },
        required: [],
      },
    },
    modulo: 'nomina',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: false,
    categoria: 'personal',
  },

  {
    nombre: 'mi_proximo_pago',
    definicion: {
      name: 'mi_proximo_pago',
      description: 'Devuelve cuándo va a cobrar el empleado: rango de días hábiles posibles según la regla de la empresa (por defecto, los primeros 3 días hábiles después del cierre del periodo). Considera fines de semana y feriados. Resuelve automáticamente si la pregunta apunta al periodo recién cerrado (pendiente de pago) o al próximo cierre.',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    modulo: 'nomina',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: false,
    categoria: 'personal',
  },

  {
    nombre: 'mi_periodo_actual',
    definicion: {
      name: 'mi_periodo_actual',
      description: 'Devuelve el resumen del periodo en curso del propio empleado: días trabajados, días laborables hasta hoy, ausencias, tardanzas y horas. Útil para preguntas como "¿cómo voy este mes?" o "¿cuántos días llevo trabajados?".',
      input_schema: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
    modulo: 'nomina',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: false,
    categoria: 'personal',
  },

  {
    nombre: 'mis_tardanzas_e_inasistencias',
    definicion: {
      name: 'mis_tardanzas_e_inasistencias',
      description: 'Lista tardanzas e inasistencias del propio empleado para el periodo indicado. Solo soporta el periodo actual o los 2 anteriores. Devuelve fechas, minutos de tardanza y motivo si está cargado.',
      input_schema: {
        type: 'object',
        properties: {
          periodo: {
            type: 'string',
            enum: ['actual', 'anterior', 'antepasado'],
            description: 'Periodo a consultar. Default: actual.',
          },
        },
        required: [],
      },
    },
    modulo: 'nomina',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: false,
    categoria: 'personal',
  },

  {
    nombre: 'mi_historial_pagos',
    definicion: {
      name: 'mi_historial_pagos',
      description: 'Devuelve los últimos pagos de nómina cobrados por el empleado (máximo 3). Cada entrada incluye periodo, fecha de pago y monto abonado. Útil para preguntas como "¿cuándo cobré la última vez?" o "¿cuánto cobré el mes pasado?".',
      input_schema: {
        type: 'object',
        properties: {
          limite: {
            type: 'number',
            description: 'Cantidad de pagos a devolver (máximo 3). Default: 3.',
          },
        },
        required: [],
      },
    },
    modulo: 'nomina',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: false,
    categoria: 'personal',
  },

  // ─── MOVIMIENTOS DE NÓMINA (adelantos y descuentos) ───
  // Tools de gestión: requieren ver_todos / editar / eliminar según operación.
  // El campo `tipo` distingue dinero entregado al empleado (adelanto) de
  // penalidades o multas que se aplican al recibo (descuento).
  {
    nombre: 'consultar_movimientos_nomina',
    definicion: {
      name: 'consultar_movimientos_nomina',
      description: 'Lista adelantos y/o descuentos de nómina. Devuelve por cada uno: tipo, monto, cuotas totales/descontadas/pendientes, saldo, frecuencia, fechas, descripción, estado, y especialmente `es_editable` (bool) + `motivo_no_editable` (texto humano) que indican si se puede modificar o eliminar — la nómina ya pagada bloquea cambios. Soporta filtrar por miembro, tipo (adelanto/descuento), estado (activo/pagado/cancelado/todos) y rango de fechas. Si pedís incluir_cuotas=true, devuelve el detalle de cada cuota.',
      input_schema: {
        type: 'object',
        properties: {
          miembro_id: {
            type: 'string',
            description: 'ID del miembro a consultar. Si no lo conocés, usá busqueda_miembro.',
          },
          busqueda_miembro: {
            type: 'string',
            description: 'Nombre o nombre+apellido del empleado. Resuelve a un miembro_id, falla si hay ambigüedad.',
          },
          tipo: {
            type: 'string',
            enum: ['adelanto', 'descuento', 'ambos'],
            description: 'Filtrar por tipo. Default: ambos.',
          },
          estado: {
            type: 'string',
            enum: ['activo', 'pagado', 'cancelado', 'todos'],
            description: 'Estado del movimiento. Default: activo.',
          },
          fecha_desde: {
            type: 'string',
            description: 'Fecha de solicitud desde (YYYY-MM-DD).',
          },
          fecha_hasta: {
            type: 'string',
            description: 'Fecha de solicitud hasta (YYYY-MM-DD).',
          },
          incluir_cuotas: {
            type: 'boolean',
            description: 'Si true, devuelve el detalle de cada cuota (número, monto, fecha programada, estado).',
          },
          limite: {
            type: 'number',
            description: 'Máximo de movimientos a devolver (default 30, máx 100).',
          },
        },
      },
    },
    modulo: 'nomina',
    accion_requerida: 'ver_propio',
    soporta_visibilidad: true,
  },

  {
    nombre: 'crear_movimiento_nomina',
    definicion: {
      name: 'crear_movimiento_nomina',
      description: 'Crea un adelanto (dinero entregado al empleado que se descuenta en cuotas del recibo) o un descuento puntual (penalidad/multa que se aplica al próximo recibo). Los descuentos siempre son de 1 cuota. Los adelantos pueden ser de 1 o N cuotas con frecuencia semanal/quincenal/mensual.',
      input_schema: {
        type: 'object',
        properties: {
          miembro_id: { type: 'string', description: 'ID del empleado. Si no lo tenés, usá busqueda_miembro.' },
          busqueda_miembro: { type: 'string', description: 'Nombre o nombre+apellido del empleado.' },
          tipo: {
            type: 'string',
            enum: ['adelanto', 'descuento'],
            description: 'Tipo de movimiento. Default: adelanto.',
          },
          monto: { type: 'number', description: 'Monto total en pesos.' },
          cuotas: {
            type: 'number',
            description: 'Cantidad de cuotas para descontar. Solo aplica a adelantos. Default: 1.',
          },
          frecuencia: {
            type: 'string',
            enum: ['semanal', 'quincenal', 'mensual'],
            description: 'Cadencia con la que se descuentan las cuotas. Default: mensual.',
          },
          fecha_solicitud: {
            type: 'string',
            description: 'Fecha en que se otorga el adelanto/descuento (YYYY-MM-DD). Default: hoy.',
          },
          fecha_inicio_descuento: {
            type: 'string',
            description: 'Fecha en que arranca el primer descuento (YYYY-MM-DD). Default: fecha_solicitud.',
          },
          descripcion: {
            type: 'string',
            description: 'Motivo o nota del movimiento (ej: "retiro de cajero", "multa por rotura de herramienta"). Se guarda en notas.',
          },
        },
        required: ['monto'],
      },
    },
    modulo: 'nomina',
    accion_requerida: 'editar',
    soporta_visibilidad: false,
  },

  {
    nombre: 'modificar_movimiento_nomina',
    definicion: {
      name: 'modificar_movimiento_nomina',
      description: 'Modifica monto, cuotas o descripción de un adelanto/descuento. Aplica reglas inteligentes: NO se puede modificar si está pagado o cancelado, NO se puede reducir a menos cuotas de las ya descontadas. Si hay cuotas descontadas + pendientes, solo se regeneran las pendientes preservando el histórico. Buscá el movimiento primero con consultar_movimientos_nomina para obtener el id y verificar es_editable.',
      input_schema: {
        type: 'object',
        properties: {
          movimiento_id: { type: 'string', description: 'ID del adelanto/descuento a modificar.' },
          monto_total: { type: 'number', description: 'Nuevo monto total. Debe ser mayor a 0.' },
          cuotas_totales: {
            type: 'number',
            description: 'Nueva cantidad de cuotas totales. Debe ser >= cuotas ya descontadas.',
          },
          descripcion: { type: 'string', description: 'Nueva descripción (notas).' },
        },
        required: ['movimiento_id'],
      },
    },
    modulo: 'nomina',
    accion_requerida: 'editar',
    soporta_visibilidad: false,
  },

  {
    nombre: 'eliminar_movimiento_nomina',
    definicion: {
      name: 'eliminar_movimiento_nomina',
      description: 'Cancela un adelanto o descuento (soft delete). NO se puede eliminar si ya está pagado — habría que hacer un ajuste contable manual desde Nómina. Si tiene cuotas ya descontadas, solo cancela las pendientes y deja constancia del histórico.',
      input_schema: {
        type: 'object',
        properties: {
          movimiento_id: { type: 'string', description: 'ID del adelanto/descuento a cancelar.' },
        },
        required: ['movimiento_id'],
      },
    },
    modulo: 'nomina',
    accion_requerida: 'eliminar',
    soporta_visibilidad: false,
  },
]
