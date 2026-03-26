'use client'

import { useMemo } from 'react'
import { useAuth } from './useAuth'
import type { Modulo, Accion, Rol, PermisosMapa } from '@/tipos'

/**
 * Hook para verificar permisos del usuario actual.
 * Lee el rol y permisos_custom del JWT y expone helpers para chequear acceso.
 * Se usa en: guards de paginas, botones condicionales, filtros de datos.
 *
 * Logica de resolucion:
 * 1. Propietario -> acceso total siempre (hardcodeado)
 * 2. Si tiene permisos_custom en el miembro -> usa esos (override completo)
 * 3. Si no -> usa defaults del rol
 * 4. Administrador tiene restricciones especificas en admin/config
 */

// Permisos por defecto segun rol
const PERMISOS_POR_ROL: Record<Rol, PermisosMapa> = {
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

/** Decodifica el payload de un JWT sin verificar firma */
function decodificarJwt(token: string): Record<string, unknown> {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload))
  } catch {
    return {}
  }
}

/** Modulos que el administrador NO tiene acceso completo */
const RESTRICCIONES_ADMIN: Partial<Record<Modulo, Accion[]>> = {
  usuarios: ['invitar', 'eliminar'],
  empresa: ['editar'],
  configuracion: ['editar'],
}

function useRol() {
  const { sesion } = useAuth()

  // El rol viene de los claims del JWT (inyectado por custom_access_token_hook)
  const claims = sesion?.access_token ? decodificarJwt(sesion.access_token) : {}
  const rol = (claims.rol as Rol) || null
  const esPropietario = rol === 'propietario'
  const esAdmin = rol === 'administrador'
  // permisos_custom viene como claim del JWT o se carga del miembro
  const permisosCustom = (claims.permisos_custom as PermisosMapa | undefined) || null

  const tienePermiso = useMemo(() => {
    return (modulo: Modulo, accion: Accion): boolean => {
      // Propietario tiene acceso total siempre
      if (esPropietario) return true

      if (!rol) return false

      // Administrador: acceso amplio pero con restricciones especificas
      if (esAdmin) {
        const restricciones = RESTRICCIONES_ADMIN[modulo]
        if (restricciones?.includes(accion)) return false
        // Si el modulo tiene permisos definidos para admin, verificar
        const permisosAdmin = PERMISOS_POR_ROL.administrador[modulo]
        if (permisosAdmin) return permisosAdmin.includes(accion)
        // Modulos no listados en admin = sin acceso
        return false
      }

      // Si tiene permisos custom, esos son el override completo
      if (permisosCustom) {
        const accionesModulo = permisosCustom[modulo]
        if (!accionesModulo) return false
        return accionesModulo.includes(accion)
      }

      // Usar defaults del rol
      const permisosRol = PERMISOS_POR_ROL[rol]
      const accionesModulo = permisosRol?.[modulo]
      if (!accionesModulo) return false
      return accionesModulo.includes(accion)
    }
  }, [rol, esPropietario, esAdmin, permisosCustom])

  /** Verificar permiso en modulos de configuracion (config_*) */
  const tienePermisoConfig = useMemo(() => {
    return (moduloBase: string, accion: 'ver' | 'editar'): boolean => {
      const moduloConfig = `config_${moduloBase}` as Modulo
      return tienePermiso(moduloConfig, accion)
    }
  }, [tienePermiso])

  return {
    rol,
    esPropietario,
    esAdmin,
    esGestor: rol === 'gestor',
    esSupervisor: rol === 'supervisor',
    esColaborador: !!rol && !esPropietario && !esAdmin,
    tienePermiso,
    tienePermisoConfig,
  }
}

export { useRol, PERMISOS_POR_ROL, RESTRICCIONES_ADMIN }
