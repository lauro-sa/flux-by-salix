/**
 * Tipos de permisos granulares por modulo.
 * Se usa en: useRol, middleware, guards de paginas, API routes.
 */

// Modulos operacionales
export type ModuloOperacional =
  | 'contactos'
  | 'actividades'
  | 'visitas'
  | 'calendario'
  | 'recorrido'
  | 'asistencias'
  | 'productos'

// Modulos de documentos
export type ModuloDocumento =
  | 'presupuestos'
  | 'facturas'
  | 'informes'
  | 'ordenes_trabajo'

// Modulos de comunicacion
export type ModuloComunicacion =
  | 'inbox_whatsapp'
  | 'inbox_correo'
  | 'inbox_interno'

// Modulos de administracion
export type ModuloAdmin =
  | 'usuarios'
  | 'empresa'
  | 'configuracion'
  | 'auditoria'

// Modulos de configuracion granular por modulo
export type ModuloConfig =
  | 'config_empresa'
  | 'config_contactos'
  | 'config_visitas'
  | 'config_actividades'
  | 'config_calendario'
  | 'config_presupuestos'
  | 'config_facturas'
  | 'config_informes'
  | 'config_ordenes_trabajo'
  | 'config_usuarios'
  | 'config_asistencias'
  | 'config_productos'
  | 'config_inbox'
  | 'config_recorrido'

// Union de todos los modulos
export type Modulo =
  | ModuloOperacional
  | ModuloDocumento
  | ModuloComunicacion
  | ModuloAdmin
  | ModuloConfig

export type Accion =
  | 'ver_propio'
  | 'ver_todos'
  | 'ver'
  | 'crear'
  | 'editar'
  | 'eliminar'
  | 'completar'
  | 'enviar'
  | 'invitar'
  | 'aprobar'
  | 'marcar'
  | 'autoasignar'
  | 'coordinar'
  | 'completar_etapa'
  | 'registrar'
  | 'asignar'
  | 'reordenar'

/** Mapa de permisos: modulo -> lista de acciones permitidas */
export type PermisosMapa = Partial<Record<Modulo, Accion[]>>

/** Categorias de modulos para agrupar en la UI */
export const CATEGORIAS_MODULOS: Record<string, { nombre: string; modulos: Modulo[] }> = {
  operacional: {
    nombre: 'Operacional',
    modulos: ['contactos', 'actividades', 'visitas', 'calendario', 'recorrido', 'asistencias', 'productos'],
  },
  documentos: {
    nombre: 'Documentos',
    modulos: ['presupuestos', 'facturas', 'informes', 'ordenes_trabajo'],
  },
  comunicacion: {
    nombre: 'Comunicacion',
    modulos: ['inbox_whatsapp', 'inbox_correo', 'inbox_interno'],
  },
  admin: {
    nombre: 'Administracion',
    modulos: ['usuarios', 'empresa', 'configuracion', 'auditoria'],
  },
  config: {
    nombre: 'Configuracion por modulo',
    modulos: [
      'config_empresa', 'config_contactos', 'config_visitas', 'config_actividades',
      'config_calendario', 'config_presupuestos', 'config_facturas', 'config_informes',
      'config_ordenes_trabajo', 'config_usuarios', 'config_asistencias', 'config_productos',
      'config_inbox', 'config_recorrido',
    ],
  },
}

/** Acciones posibles por modulo — define que acciones existen para cada modulo */
export const ACCIONES_POR_MODULO: Record<Modulo, Accion[]> = {
  // Operacionales
  contactos: ['ver_propio', 'ver_todos', 'crear', 'editar', 'eliminar'],
  actividades: ['ver_propio', 'ver_todos', 'crear', 'editar', 'eliminar', 'completar'],
  visitas: ['ver_propio', 'ver_todos', 'crear', 'editar', 'eliminar', 'completar', 'asignar'],
  calendario: ['ver_propio', 'ver_todos', 'crear', 'editar', 'eliminar'],
  recorrido: ['ver_propio', 'ver_todos', 'registrar', 'reordenar'],
  asistencias: ['ver_propio', 'ver_todos', 'marcar', 'editar', 'eliminar'],
  productos: ['ver', 'crear', 'editar', 'eliminar'],
  // Documentos
  presupuestos: ['ver_propio', 'ver_todos', 'crear', 'editar', 'eliminar', 'enviar'],
  facturas: ['ver_propio', 'ver_todos', 'crear', 'editar', 'eliminar', 'enviar'],
  informes: ['ver_propio', 'ver_todos', 'crear', 'editar', 'eliminar', 'enviar'],
  ordenes_trabajo: ['ver_propio', 'ver_todos', 'crear', 'editar', 'eliminar', 'completar', 'completar_etapa'],
  // Comunicacion
  inbox_whatsapp: ['ver_propio', 'ver_todos', 'enviar'],
  inbox_correo: ['ver_propio', 'ver_todos', 'enviar'],
  inbox_interno: ['ver_propio', 'ver_todos', 'enviar'],
  // Administracion
  usuarios: ['ver', 'invitar', 'aprobar', 'editar', 'eliminar'],
  empresa: ['ver', 'editar'],
  configuracion: ['ver', 'editar'],
  auditoria: ['ver'],
  // Configuracion granular
  config_empresa: ['ver', 'editar'],
  config_contactos: ['ver', 'editar'],
  config_visitas: ['ver', 'editar'],
  config_actividades: ['ver', 'editar'],
  config_calendario: ['ver', 'editar'],
  config_presupuestos: ['ver', 'editar'],
  config_facturas: ['ver', 'editar'],
  config_informes: ['ver', 'editar'],
  config_ordenes_trabajo: ['ver', 'editar'],
  config_usuarios: ['ver', 'editar'],
  config_asistencias: ['ver', 'editar'],
  config_productos: ['ver', 'editar'],
  config_inbox: ['ver', 'editar'],
  config_recorrido: ['ver', 'editar'],
}

/** Etiquetas legibles para cada modulo */
export const ETIQUETAS_MODULO: Record<Modulo, string> = {
  contactos: 'Contactos',
  actividades: 'Actividades',
  visitas: 'Visitas',
  calendario: 'Calendario',
  recorrido: 'Recorrido',
  asistencias: 'Asistencias',
  productos: 'Productos',
  presupuestos: 'Presupuestos',
  facturas: 'Facturas',
  informes: 'Informes',
  ordenes_trabajo: 'Ordenes de trabajo',
  inbox_whatsapp: 'WhatsApp',
  inbox_correo: 'Correo',
  inbox_interno: 'Interno',
  usuarios: 'Usuarios',
  empresa: 'Empresa',
  configuracion: 'Configuracion',
  auditoria: 'Auditoria',
  config_empresa: 'Config empresa',
  config_contactos: 'Config contactos',
  config_visitas: 'Config visitas',
  config_actividades: 'Config actividades',
  config_calendario: 'Config calendario',
  config_presupuestos: 'Config presupuestos',
  config_facturas: 'Config facturas',
  config_informes: 'Config informes',
  config_ordenes_trabajo: 'Config ordenes',
  config_usuarios: 'Config usuarios',
  config_asistencias: 'Config asistencias',
  config_productos: 'Config productos',
  config_inbox: 'Config inbox',
  config_recorrido: 'Config recorrido',
}

/** Descripciones de ayuda por módulo — se muestran como tooltip en la matriz de permisos */
export const DESCRIPCIONES_MODULO: Partial<Record<Modulo, string>> = {
  contactos: 'Gestión de contactos, empresas y vinculaciones.',
  actividades: 'Tareas, llamadas, reuniones y seguimiento comercial.',
  visitas: 'Planificación de visitas: crear, asignar a visitadores, organizar recorridos. El que tiene "Asignar" puede gestionar visitas de todo el equipo.',
  calendario: 'Eventos y bloques de calendario.',
  recorrido: 'Acceso al recorrido mobile del visitador. "Ver propio" + "Registrar" = es visitador (aparece en "Asignado a" y ve "Mi Recorrido"). Solo "Ver todos" = supervisor, ve recorridos ajenos pero no es visitador.',
  asistencias: 'Control de asistencia y fichaje.',
  productos: 'Catálogo de productos y servicios.',
  presupuestos: 'Creación y envío de cotizaciones.',
  facturas: 'Facturación y documentos fiscales.',
  informes: 'Informes técnicos y reportes.',
  ordenes_trabajo: 'Órdenes con etapas, asignación y seguimiento.',
  inbox_whatsapp: 'Canal de WhatsApp.',
  inbox_correo: 'Canal de correo electrónico.',
  inbox_interno: 'Mensajes internos entre miembros.',
  usuarios: 'Gestión de miembros del equipo.',
  empresa: 'Datos generales de la empresa.',
  auditoria: 'Registro de cambios y acciones.',
}

/** Descripciones de ayuda por acción — se muestran como tooltip en los headers de columna */
export const DESCRIPCIONES_ACCION: Partial<Record<Accion, string>> = {
  ver_propio: 'Ve solo los registros que creó o que le asignaron.',
  ver_todos: 'Ve todos los registros de la empresa.',
  ver: 'Acceso de lectura al módulo.',
  crear: 'Puede crear nuevos registros.',
  editar: 'Puede modificar registros existentes.',
  eliminar: 'Puede enviar registros a la papelera.',
  completar: 'Puede marcar como completado.',
  enviar: 'Puede enviar documentos por correo/WhatsApp.',
  asignar: 'Puede asignar registros a otros miembros.',
  registrar: 'Puede registrar llegada, tomar fotos y completar visitas en campo.',
  reordenar: 'Puede cambiar el orden de las paradas en su recorrido.',
  marcar: 'Puede registrar fichaje de entrada/salida.',
  invitar: 'Puede invitar nuevos miembros.',
  aprobar: 'Puede aprobar solicitudes pendientes.',
  completar_etapa: 'Puede completar etapas individuales.',
}

/** Etiquetas legibles para cada accion */
export const ETIQUETAS_ACCION: Record<Accion, string> = {
  ver_propio: 'Ver propio',
  ver_todos: 'Ver todos',
  ver: 'Ver',
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
  completar: 'Completar',
  enviar: 'Enviar',
  invitar: 'Invitar',
  aprobar: 'Aprobar',
  marcar: 'Marcar',
  autoasignar: 'Autoasignar',
  coordinar: 'Coordinar',
  completar_etapa: 'Completar etapa',
  registrar: 'Registrar',
  asignar: 'Asignar',
  reordenar: 'Reordenar',
}
