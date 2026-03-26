import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cliente Supabase para el servidor (Server Components, Route Handlers).
 * Lee y escribe cookies para mantener la sesión.
 * Se usa en: API routes, Server Components, acciones del servidor.
 */
export async function crearClienteServidor() {
  const almacenCookies = await cookies()

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
              almacenCookies.set(name, value, options)
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
