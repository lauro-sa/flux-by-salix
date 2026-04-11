import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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
