import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con service role — acceso privilegiado.
 * SOLO usar en Route Handlers del servidor, nunca en el cliente.
 * Se usa en: crear perfiles, actualizar miembros, gestionar invitaciones,
 * actualizar app_metadata del JWT.
 */
export function crearClienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
