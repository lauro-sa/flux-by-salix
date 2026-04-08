import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/auth/login — Iniciar sesión.
 * Autentica con email/password, consulta membresías del usuario,
 * y setea la empresa activa si solo tiene una.
 */
export async function POST(request: NextRequest) {
  try {
    const { correo, contrasena } = await request.json()

    if (!correo || !contrasena) {
      return NextResponse.json(
        { error: 'Correo y contraseña son obligatorios' },
        { status: 400 }
      )
    }

    const supabase = await crearClienteServidor()

    // Autenticar
    const { data, error } = await supabase.auth.signInWithPassword({
      email: correo,
      password: contrasena,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (!data.user) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    const admin = crearClienteAdmin()

    // Limitar a máximo 4 sesiones simultáneas: cerrar las más antiguas
    const MAX_SESIONES = 4
    try {
      const { data: sesiones } = await admin.rpc('obtener_sesiones_usuario', {
        p_user_id: data.user.id,
      })

      if (sesiones && sesiones.length >= MAX_SESIONES) {
        // Filtrar solo sesiones de navegador real
        const sesionesReales = sesiones.filter((s: { user_agent?: string }) => {
          const ua = (s.user_agent || '').toLowerCase()
          return ua.includes('mozilla') || ua.includes('chrome') || ua.includes('safari') || ua.includes('firefox')
        })

        if (sesionesReales.length >= MAX_SESIONES) {
          // Ordenar por updated_at ascendente (más antigua primero)
          const ordenadas = sesionesReales.sort(
            (a: { updated_at: string }, b: { updated_at: string }) =>
              new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
          )

          // Cerrar las sesiones más antiguas para quedarnos con MAX_SESIONES - 1 + la nueva
          const aCerrar = ordenadas.slice(0, ordenadas.length - MAX_SESIONES + 1)
          for (const sesion of aCerrar) {
            await admin.rpc('cerrar_sesion_usuario', {
              p_session_id: sesion.id,
              p_user_id: data.user.id,
            })
          }
        }
      }
    } catch (err) {
      // No bloquear el login si falla el cleanup de sesiones
      console.error('[login] Error limpiando sesiones antiguas:', err)
    }

    // Consultar membresías del usuario
    const { data: membresias } = await admin
      .from('miembros')
      .select('id, empresa_id, rol, activo, empresas(id, nombre, slug, logo_url)')
      .eq('usuario_id', data.user.id)

    const empresasActivas = membresias?.filter(m => m.activo) || []
    const todasMembresias = membresias || []

    // Si tiene exactamente una empresa activa, setearla automáticamente
    if (empresasActivas.length === 1) {
      await admin.auth.admin.updateUserById(data.user.id, {
        app_metadata: { empresa_activa_id: empresasActivas[0].empresa_id },
      })
    }

    return NextResponse.json({
      usuario: { id: data.user.id, correo: data.user.email },
      membresias: todasMembresias,
      empresas_activas: empresasActivas.length,
      redirigir: empresasActivas.length === 1
        ? '/dashboard'
        : empresasActivas.length > 1
          ? '/selector-empresa'
          : todasMembresias.length > 0
            ? '/esperando-activacion'
            : '/onboarding',
    })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
