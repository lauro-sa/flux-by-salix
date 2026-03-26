import { redirect } from 'next/navigation'
import { crearClienteServidor } from '@/lib/supabase/servidor'

/**
 * Página raíz — redirige según estado de autenticación.
 * Autenticado con empresa → dashboard
 * Autenticado sin empresa → onboarding
 * No autenticado → login
 */
export default async function PaginaInicio() {
  const supabase = await crearClienteServidor()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const empresaActivaId = user.app_metadata?.empresa_activa_id

  if (empresaActivaId) {
    redirect('/dashboard')
  }

  redirect('/onboarding')
}
