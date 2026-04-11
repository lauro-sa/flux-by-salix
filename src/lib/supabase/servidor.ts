import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { User } from '@supabase/supabase-js'

/**
 * Cliente Supabase para el servidor (Server Components, Route Handlers).
 * Lee y escribe cookies para mantener la sesión.
 * Se usa en: API routes, Server Components, acciones del servidor.
 */
export async function crearClienteServidor() {
  const almacenCookies = await cookies()

  // En desarrollo con iframe cross-origin (Jetski/IDX preview): SameSite=None + Secure.
  // En localhost directo (sin iframe): no forzar Secure — iOS Safari rechaza
  // cookies Secure sobre HTTP, lo que impide que se establezca la sesión.
  const esDesarrollo = process.env.NODE_ENV === 'development'
  const esIframe = Boolean(process.env.CODESPACE_NAME || process.env.IDX_CHANNEL)

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return almacenCookies.getAll()
        },
        setAll(cookiesParaSetear) {
          try {
            cookiesParaSetear.forEach(({ name, value, options }) =>
              almacenCookies.set(name, value, {
                ...options,
                ...(esDesarrollo && esIframe && { sameSite: 'none' as const, secure: true }),
              })
            )
          } catch {
            // Se ignora en Server Components (solo lectura).
            // Las cookies se setean correctamente en Route Handlers y Server Actions.
          }
        },
      },
    }
  )
}

/** Respuesta estándar 401 para API routes */
const RESPUESTA_NO_AUTENTICADO = () =>
  NextResponse.json({ error: 'No autenticado' }, { status: 401 })

/**
 * obtenerUsuarioRuta — Helper para API routes que necesitan el usuario autenticado.
 *
 * Usa getSession() en vez de getUser() para evitar llamadas de red a Supabase Auth.
 * getSession() lee el JWT de las cookies localmente (+ refresca si expiró).
 * La seguridad la garantiza RLS: el JWT se valida en PostgreSQL al ejecutar queries.
 *
 * Esto elimina ~10-15 llamadas de red por carga de página, evitando rate limiting.
 *
 * Se usa en: todas las API routes que necesitan autenticación.
 */
export async function obtenerUsuarioRuta(): Promise<{
  user: User | null
  session: import('@supabase/supabase-js').Session | null
  respuesta401: () => NextResponse
}> {
  const supabase = await crearClienteServidor()
  const { data: { session } } = await supabase.auth.getSession()
  return {
    user: session?.user ?? null,
    session,
    respuesta401: RESPUESTA_NO_AUTENTICADO,
  }
}
