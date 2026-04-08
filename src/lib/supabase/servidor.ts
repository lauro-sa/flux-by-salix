import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cliente Supabase para el servidor (Server Components, Route Handlers).
 * Lee y escribe cookies para mantener la sesión.
 * Se usa en: API routes, Server Components, acciones del servidor.
 */
export async function crearClienteServidor() {
  const almacenCookies = await cookies()

  // En desarrollo, Jetski/IDX preview usa un iframe cross-origin
  // que bloquea cookies SameSite=Lax. Forzar SameSite=None + Secure.
  const esDesarrollo = process.env.NODE_ENV === 'development'

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
                ...(esDesarrollo && { sameSite: 'none' as const, secure: true }),
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
