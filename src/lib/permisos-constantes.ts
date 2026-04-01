import type { Modulo, Accion, PermisosMapa } from '@/tipos/permisos'
import type { Rol } from '@/tipos/miembro'

/**
 * Constantes de permisos por rol — compartidas entre cliente y servidor.
 * Archivo sin 'use client' para que funcione en API routes sin problemas.
 * Se usa en: useRol (cliente), permisos-servidor (API routes).
 */

// Permisos por defecto según rol
export const PERMISOS_POR_ROL: Record<Rol, PermisosMapa> = {
  propietario: {}, // Acceso total — se maneja con esPropietario

  administrador: {
    // Operacionales — acceso total
    contactos: ['ver_todos', 'crear', 'editar', 'eliminar'],
    actividades: ['ver_todos', 'crear', 'editar', 'eliminar', 'completar'],
    visitas: ['ver_todos', 'crear', 'editar', 'eliminar', 'completar'],
    calendario: ['ver_todos', 'crear', 'editar', 'eliminar'],
    recorrido: ['ver_todos', 'autoasignar', 'coordinar'],
    asistencias: ['ver_todos', 'marcar', 'editar', 'eliminar'],
    productos: ['ver', 'crear', 'editar', 'eliminar'],
    // Documentos — acceso total
    presupuestos: ['ver_todos', 'crear', 'editar', 'eliminar', 'enviar'],
    facturas: ['ver_todos', 'crear', 'editar', 'eliminar', 'enviar'],
    informes: ['ver_todos', 'crear', 'editar', 'eliminar', 'enviar'],
    ordenes_trabajo: ['ver_todos', 'crear', 'editar', 'eliminar', 'completar', 'completar_etapa'],
    // Comunicacion — acceso total
    inbox_whatsapp: ['ver_todos', 'enviar'],
    inbox_correo: ['ver_todos', 'enviar'],
    inbox_interno: ['ver_todos', 'enviar'],
    // Administracion — restringido
    usuarios: ['ver', 'aprobar', 'editar'], // SIN invitar ni eliminar
    empresa: ['ver'], // SIN editar
    configuracion: ['ver'], // SIN editar
    auditoria: ['ver'],
    // Config — solo ver
    config_empresa: ['ver'],
    config_contactos: ['ver'],
    config_visitas: ['ver'],
    config_actividades: ['ver'],
    config_calendario: ['ver'],
    config_presupuestos: ['ver'],
    config_facturas: ['ver'],
    config_informes: ['ver'],
    config_ordenes_trabajo: ['ver'],
    config_usuarios: ['ver'],
    config_asistencias: ['ver'],
    config_productos: ['ver'],
    config_inbox: ['ver'],
  },

  gestor: {
    contactos: ['ver_todos', 'crear', 'editar', 'eliminar'],
    actividades: ['ver_todos', 'crear', 'editar', 'eliminar', 'completar'],
    visitas: ['ver_todos', 'crear', 'editar', 'eliminar', 'completar'],
    calendario: ['ver_todos', 'crear', 'editar', 'eliminar'],
    presupuestos: ['ver_todos', 'crear', 'editar', 'eliminar', 'enviar'],
    facturas: ['ver_todos', 'crear', 'editar', 'eliminar', 'enviar'],
    informes: ['ver_todos', 'crear', 'editar'],
    inbox_whatsapp: ['ver_todos', 'enviar'],
    inbox_correo: ['ver_todos', 'enviar'],
    inbox_interno: ['ver_todos', 'enviar'],
    productos: ['ver', 'crear', 'editar'],
    ordenes_trabajo: ['ver_todos', 'crear', 'editar', 'completar', 'completar_etapa'],
    asistencias: ['ver_todos', 'marcar'],
    recorrido: ['ver_todos', 'autoasignar', 'coordinar'],
  },

  vendedor: {
    contactos: ['ver_propio', 'crear', 'editar'],
    actividades: ['ver_propio', 'crear', 'editar', 'completar'],
    visitas: ['ver_propio', 'crear', 'editar', 'completar'],
    calendario: ['ver_propio', 'crear', 'editar'],
    presupuestos: ['ver_propio', 'crear', 'editar', 'enviar'],
    inbox_whatsapp: ['ver_propio', 'enviar'],
    inbox_correo: ['ver_propio', 'enviar'],
    inbox_interno: ['ver_propio', 'enviar'],
    productos: ['ver'],
    asistencias: ['ver_propio', 'marcar'],
    recorrido: ['ver_propio', 'autoasignar'],
  },

  supervisor: {
    contactos: ['ver_todos', 'crear', 'editar'],
    actividades: ['ver_todos', 'crear', 'editar', 'completar'],
    visitas: ['ver_todos', 'crear', 'editar'],
    calendario: ['ver_todos'],
    asistencias: ['ver_todos'],
    informes: ['ver_todos'],
    recorrido: ['ver_todos', 'coordinar'],
  },

  empleado: {
    asistencias: ['ver_propio', 'marcar'],
    calendario: ['ver_propio'],
    inbox_interno: ['ver_propio', 'enviar'],
  },

  invitado: {
    // Sin permisos por defecto — se asignan custom
  },
}

// Módulos que el administrador NO tiene acceso completo
export const RESTRICCIONES_ADMIN: Partial<Record<Modulo, Accion[]>> = {
  usuarios: ['invitar', 'eliminar'],
  empresa: ['editar'],
  configuracion: ['editar'],
}
