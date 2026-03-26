'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Cliente Supabase para el navegador (componentes cliente).
 * Maneja cookies automáticamente via @supabase/ssr.
 * Se usa en: hooks de auth, formularios, acciones del usuario.
 */
export function crearClienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
