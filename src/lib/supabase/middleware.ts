import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Crea un cliente Supabase para el middleware de Next.js.
 * Refresca tokens automáticamente y propaga cookies en la respuesta.
 * Se usa en: src/middleware.ts
 */
export async function crearClienteMiddleware(request: NextRequest) {
  const supabaseResponse = NextResponse.next({ request })

  // En desarrollo, Jetski/IDX preview usa un iframe cross-origin
  // que bloquea cookies SameSite=Lax. Forzar SameSite=None + Secure.
  const esDesarrollo = process.env.NODE_ENV === 'development'

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesParaSetear) {
          // Setear en el request (para que Server Components las lean)
          cookiesParaSetear.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          // Setear en la respuesta existente (no recrear para no perder headers)
          cookiesParaSetear.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, {
              ...options,
              ...(esDesarrollo && { sameSite: 'none' as const, secure: true }),
            })
          })
        },
      },
    }
  )

  return { supabase, response: supabaseResponse }
}
