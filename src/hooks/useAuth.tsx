'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { crearClienteNavegador } from '@/lib/supabase/cliente'
import type { User, Session } from '@supabase/supabase-js'

/**
 * Hook y proveedor de autenticación.
 * Envuelve el estado de Supabase Auth y expone métodos en español.
 * Se usa en: layouts, páginas de auth, header, sidebar, guards.
 */

interface ContextoAuth {
  usuario: User | null
  sesion: Session | null
  cargando: boolean
  iniciarSesion: (correo: string, contrasena: string) => Promise<{ error?: string; redirigir?: string }>
  registrarse: (datos: { correo: string; contrasena: string; nombre: string; apellido: string }) => Promise<{ error?: string }>
  cerrarSesion: () => Promise<void>
  recuperarContrasena: (correo: string) => Promise<{ error?: string }>
  restablecerContrasena: (contrasena: string) => Promise<{ error?: string }>
}

const ContextoAuthInterno = createContext<ContextoAuth | null>(null)

function ProveedorAuth({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null)
  const [sesion, setSesion] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)

  const supabase = crearClienteNavegador()

  // Inicializar sesión y escuchar cambios
  useEffect(() => {
    const obtenerSesion = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSesion(session)
      setUsuario(session?.user ?? null)
      setCargando(false)
    }

    obtenerSesion()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evento, session) => {
      setSesion(session)
      setUsuario(session?.user ?? null)
      setCargando(false)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const iniciarSesion = useCallback(async (correo: string, contrasena: string) => {
    const respuesta = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo, contrasena }),
    })

    const datos = await respuesta.json()

    if (!respuesta.ok) {
      return { error: datos.error }
    }

    // Refrescar la sesión del cliente después del login server-side
    await supabase.auth.refreshSession()

    return { redirigir: datos.redirigir }
  }, [supabase])

  const registrarse = useCallback(async (datos: {
    correo: string
    contrasena: string
    nombre: string
    apellido: string
  }) => {
    const respuesta = await fetch('/api/auth/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    })

    const resultado = await respuesta.json()

    if (!respuesta.ok) {
      return { error: resultado.error }
    }

    return {}
  }, [])

  const cerrarSesion = useCallback(async () => {
    await fetch('/api/auth/cerrar-sesion', { method: 'POST' })
    await supabase.auth.signOut()
    setUsuario(null)
    setSesion(null)
  }, [supabase])

  const recuperarContrasena = useCallback(async (correo: string) => {
    const respuesta = await fetch('/api/auth/recuperar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo }),
    })

    const datos = await respuesta.json()
    if (!respuesta.ok) return { error: datos.error }
    return {}
  }, [])

  const restablecerContrasena = useCallback(async (contrasena: string) => {
    const respuesta = await fetch('/api/auth/restablecer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contrasena }),
    })

    const datos = await respuesta.json()
    if (!respuesta.ok) return { error: datos.error }
    return {}
  }, [])

  return (
    <ContextoAuthInterno.Provider value={{
      usuario, sesion, cargando,
      iniciarSesion, registrarse, cerrarSesion,
      recuperarContrasena, restablecerContrasena,
    }}>
      {children}
    </ContextoAuthInterno.Provider>
  )
}

function useAuth() {
  const ctx = useContext(ContextoAuthInterno)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <ProveedorAuth>')
  return ctx
}

export { ProveedorAuth, useAuth }
