import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase con service role — acceso privilegiado.
 * SOLO usar en Route Handlers del servidor, nunca en el cliente.
 * Se usa en: crear perfiles, actualizar miembros, gestionar invitaciones,
 * actualizar app_metadata del JWT.
 *
 * NOTA: Hay tipos generados en `@/db/database.types` (`Database`). No se
 * aplican por defecto al cliente porque la strictness adicional rompe muchas
 * queries existentes que usan joins con notación de Supabase. Para auditar
 * drift entre BD y código (ej. detectar columnas dropeadas que el código
 * sigue pidiendo), aplicar temporalmente `createClient<Database>(...)` y
 * correr `npx tsc --noEmit`.
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
