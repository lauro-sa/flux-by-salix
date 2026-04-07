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
  verificarCorreo: (correo: string) => Promise<{ existe: boolean }>
  iniciarSesion: (correo: string, contrasena: string) => Promise<{ error?: string; redirigir?: string }>
  registrarse: (datos: { correo: string; contrasena: string; nombre: string; apellido: string }) => Promise<{ error?: string; redirigir?: string }>
  cerrarSesion: () => Promise<void>
  recuperarContrasena: (correo: string) => Promise<{ error?: string }>
  restablecerContrasena: (contrasena: string) => Promise<{ error?: string }>
}

const ContextoAuthInterno = createContext<ContextoAuth | null>(null)

// Singleton — crearClienteNavegador() ya cachea internamente via @supabase/ssr,
// pero al extraerlo aquí queda explícito que la referencia es estable
const supabase = crearClienteNavegador()

function ProveedorAuth({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<User | null>(null)
  const [sesion, setSesion] = useState<Session | null>(null)
  const [cargando, setCargando] = useState(true)

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const verificarCorreo = useCallback(async (correo: string) => {
    const respuesta = await fetch('/api/auth/verificar-correo-existe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ correo }),
    })
    const datos = await respuesta.json()
    return { existe: datos.existe ?? false }
  }, [])

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

    // Refrescar la sesión para obtener el JWT con los claims actualizados
    // (empresa_activa_id se setea server-side en el login).
    // Si el middleware lee el JWT viejo (sin empresa_activa_id), redirige a /onboarding → loop.
    // Reintentamos el refresh hasta que el claim se propague o se agoten los intentos.
    for (let i = 0; i < 3; i++) {
      const { data: sesionRefrescada } = await supabase.auth.refreshSession()
      if (sesionRefrescada?.user?.app_metadata?.empresa_activa_id || datos.empresas_activas !== 1) break
      await new Promise(r => setTimeout(r, 200))
    }

    return { redirigir: datos.redirigir }
  }, [])

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

    return { redirigir: resultado.redirigir }
  }, [])

  const cerrarSesion = useCallback(async () => {
    await fetch('/api/auth/cerrar-sesion', { method: 'POST' })
    await supabase.auth.signOut()
    setUsuario(null)
    setSesion(null)
  }, [])

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
      verificarCorreo, iniciarSesion, registrarse, cerrarSesion,
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
