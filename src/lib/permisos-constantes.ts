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
    visitas: ['ver_todos', 'crear', 'editar', 'eliminar', 'completar', 'asignar'],
    calendario: ['ver_todos', 'crear', 'editar', 'eliminar'],
    recorrido: ['ver_todos'],
    asistencias: ['ver_todos', 'marcar', 'editar', 'eliminar'],
    nomina: ['ver_todos', 'editar', 'enviar'],
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
    // Administracion — acceso total (solo eliminar empresa queda para propietario)
    usuarios: ['ver', 'aprobar', 'editar', 'invitar', 'eliminar'],
    auditoria: ['ver'],
    // Config — acceso total
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
    config_correo: ['ver', 'editar'],
    config_whatsapp: ['ver', 'editar'],
    config_interno: ['ver', 'editar'],
    config_recorrido: ['ver', 'editar'],
  },

  gestor: {
    contactos: ['ver_todos', 'crear', 'editar', 'eliminar'],
    actividades: ['ver_todos', 'crear', 'editar', 'eliminar', 'completar'],
    visitas: ['ver_todos', 'crear', 'editar', 'eliminar', 'completar', 'asignar'],
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
    // Gestor ve nómina del equipo pero no la edita ni envía por default —
    // esas quedan reservadas a admins/RRHH salvo que se otorguen custom.
    nomina: ['ver_todos'],
    recorrido: ['ver_todos'],
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
    nomina: ['ver_propio'],
    recorrido: ['ver_propio', 'registrar', 'reordenar'],
  },

  supervisor: {
    contactos: ['ver_todos', 'crear', 'editar'],
    actividades: ['ver_todos', 'crear', 'editar', 'completar'],
    visitas: ['ver_todos', 'crear', 'editar', 'asignar'],
    calendario: ['ver_todos'],
    asistencias: ['ver_todos'],
    informes: ['ver_todos'],
    recorrido: ['ver_todos'],
  },

  empleado: {
    asistencias: ['ver_propio', 'marcar'],
    nomina: ['ver_propio'],
    calendario: ['ver_propio'],
    inbox_interno: ['ver_propio', 'enviar'],
  },

  invitado: {
    // Sin permisos por defecto — se asignan custom
  },
}

// Restricciones del admin — acciones que nunca puede hacer, aunque tenga el permiso
// marcado en permisos_custom. Solo propietario las supera.
export const RESTRICCIONES_ADMIN: Partial<Record<Modulo, Accion[]>> = {
  // Solo el propietario puede eliminar la empresa (operación destructiva irreversible).
  config_empresa: ['eliminar'],
}
