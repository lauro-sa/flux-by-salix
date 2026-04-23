'use client'

/**
 * usePermisosActuales — Fuente de verdad única y reactiva de los permisos
 * del usuario autenticado.
 *
 * Arquitectura:
 * 1. Al montar, fetch /api/permisos/yo para tener permisos frescos de DB.
 * 2. Suscripción a Supabase Realtime en la tabla `miembros` filtrando por la
 *    fila del propio miembro. Cuando un admin cambia `permisos_custom` o `rol`
 *    o desactiva al miembro, llega un UPDATE y re-fetcheamos los permisos.
 * 3. El contexto notifica el cambio a todos los componentes que usan `useRol`
 *    o `usePermisosActuales`, que se re-renderizan automáticamente: el
 *    sidebar oculta/muestra secciones, los botones se habilitan/deshabilitan,
 *    y el hook `useGuardPermiso` redirige si el usuario pierde acceso a la
 *    página en la que está.
 *
 * NO depende del JWT: el JWT solo lleva `rol` y `empresa_activa_id` (claims
 * que cambian pocas veces), y su renovación es lenta. Los permisos custom
 * viven en DB y se leen en tiempo real.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import { useAuth } from './useAuth'
import type { Rol, MetodoFichaje } from '@/tipos/miembro'
import type { PermisosMapa } from '@/tipos/permisos'

export interface EstadoPermisosActuales {
  cargando: boolean
  miembroId: string | null
  rol: Rol | null
  permisosCustom: PermisosMapa | null
  activo: boolean
  esPropietario: boolean
  esSuperadmin: boolean
  /** Método de fichaje del miembro. Fuente de verdad para mostrar widget de
   * jornada y habilitar heartbeat de fichaje automático. Si es 'kiosco' o null,
   * el usuario no ficha desde el software. */
  metodoFichaje: MetodoFichaje | null
  /** Fuerza una recarga manual (p. ej. después de un guardar optimista). */
  recargar: () => Promise<void>
}

const ContextoPermisos = createContext<EstadoPermisosActuales | null>(null)

const supabase = crearClienteNavegador()

export function ProveedorPermisos({ children }: { children: ReactNode }) {
  const { usuario, cargando: cargandoAuth } = useAuth()
  const [estado, setEstado] = useState<Omit<EstadoPermisosActuales, 'recargar'>>({
    cargando: true,
    miembroId: null,
    rol: null,
    permisosCustom: null,
    activo: false,
    esPropietario: false,
    esSuperadmin: false,
    metodoFichaje: null,
  })
  // Guardamos el miembro_id para el filtro de realtime y para evitar loops
  // cuando cambia la sesión pero no el miembro.
  const miembroIdRef = useRef<string | null>(null)

  const fetchPermisos = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/permisos/yo', { cache: 'no-store' })
      if (!res.ok) {
        setEstado(s => ({ ...s, cargando: false }))
        return null
      }
      const datos = await res.json() as {
        miembro_id: string | null
        rol: Rol | null
        permisos_custom: PermisosMapa | null
        activo: boolean
        es_propietario: boolean
        es_superadmin: boolean
        metodo_fichaje: MetodoFichaje | null
      }
      setEstado({
        cargando: false,
        miembroId: datos.miembro_id,
        rol: datos.rol,
        permisosCustom: datos.permisos_custom,
        activo: datos.activo,
        esPropietario: datos.es_propietario,
        esSuperadmin: datos.es_superadmin,
        metodoFichaje: datos.metodo_fichaje,
      })
      return datos.miembro_id
    } catch {
      setEstado(s => ({ ...s, cargando: false }))
      return null
    }
  }, [])

  // Primera carga + recarga cuando cambia el usuario (login/logout/cambio de
  // cuenta). IMPORTANTE: dep `usuario?.id` y NO `usuario`. Supabase Auth emite
  // un objeto `user` nuevo en cada `TOKEN_REFRESHED` (que dispara al volver de
  // otra pestaña del navegador). Si dependiéramos del objeto, este effect se
  // re-ejecutaría con cada refresh de token, pondría `cargando: true` y
  // desmontaría todo lo envuelto en <GuardPagina> — visto como un "spinner y
  // vuelve a cargar" al cambiar de pestaña.
  const usuarioId = usuario?.id ?? null
  useEffect(() => {
    if (cargandoAuth) return
    if (!usuarioId) {
      miembroIdRef.current = null
      setEstado({
        cargando: false,
        miembroId: null,
        rol: null,
        permisosCustom: null,
        activo: false,
        esPropietario: false,
        esSuperadmin: false,
        metodoFichaje: null,
      })
      return
    }
    // Solo marcar `cargando: true` si todavía no tenemos datos. Si ya había
    // permisos cargados (refetch por cambio de id del usuario o disparo manual
    // vía `recargar()`), mantenemos los datos previos hasta que llegue el
    // fetch nuevo para evitar el flash de pantalla vacía en los guards.
    setEstado(s => s.miembroId ? s : { ...s, cargando: true })
    fetchPermisos().then(id => { miembroIdRef.current = id })
  }, [usuarioId, cargandoAuth, fetchPermisos])

  // Suscripción realtime: escuchamos UPDATE sobre la fila del miembro.
  // El filtro server-side asegura que solo recibimos los eventos que nos
  // corresponden (sin esto Supabase manda todos los UPDATE de la tabla).
  useEffect(() => {
    if (!estado.miembroId) return
    const miembroId = estado.miembroId

    const canal = supabase
      .channel(`permisos-miembro-${miembroId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'miembros',
          filter: `id=eq.${miembroId}`,
        },
        () => {
          // Volvemos a leer via el endpoint para que sea el server quien
          // resuelva y normalice (incluye cálculo de es_propietario/es_superadmin).
          fetchPermisos()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [estado.miembroId, fetchPermisos])

  const valor = useMemo<EstadoPermisosActuales>(() => ({
    ...estado,
    recargar: async () => { await fetchPermisos() },
  }), [estado, fetchPermisos])

  return (
    <ContextoPermisos.Provider value={valor}>
      {children}
    </ContextoPermisos.Provider>
  )
}

export function usePermisosActuales(): EstadoPermisosActuales {
  const ctx = useContext(ContextoPermisos)
  if (!ctx) {
    // Fallback silencioso si se usa fuera del provider (SSR, tests). El hook
    // useRol cae a defaults "sin permisos" en ese caso.
    return {
      cargando: true,
      miembroId: null,
      rol: null,
      permisosCustom: null,
      activo: false,
      esPropietario: false,
      esSuperadmin: false,
      metodoFichaje: null,
      recargar: async () => {},
    }
  }
  return ctx
}
