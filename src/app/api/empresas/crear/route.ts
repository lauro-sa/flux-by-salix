import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { vincularOCrearContactoEquipo } from '@/lib/contactos/contacto-equipo'

/**
 * POST /api/empresas/crear — Crear empresa nueva (onboarding).
 * Crea la empresa, el miembro propietario (activo=true),
 * crea contacto tipo "equipo", y setea empresa_activa_id en el JWT.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { nombre, slug, pais } = await request.json()

    if (!nombre || !slug) {
      return NextResponse.json(
        { error: 'Nombre y slug son obligatorios' },
        { status: 400 }
      )
    }

    // Validar formato del slug: solo minúsculas, números y guiones
    const slugLimpio = slug.toLowerCase().trim()
    if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slugLimpio)) {
      return NextResponse.json(
        { error: 'El subdominio solo puede contener letras minúsculas, números y guiones' },
        { status: 400 }
      )
    }

    const admin = crearClienteAdmin()

    // Verificar que el slug no esté ocupado
    const { data: existente } = await admin
      .from('empresas')
      .select('id')
      .eq('slug', slugLimpio)
      .single()

    if (existente) {
      return NextResponse.json(
        { error: 'Este subdominio ya está en uso' },
        { status: 409 }
      )
    }

    // Crear empresa
    const { data: empresa, error: errorEmpresa } = await admin
      .from('empresas')
      .insert({ nombre, slug: slugLimpio, pais: pais || null })
      .select()
      .single()

    if (errorEmpresa || !empresa) {
      return NextResponse.json({ error: 'Error al crear la empresa' }, { status: 500 })
    }

    // Crear miembro propietario (activo = true, el propietario siempre está activo)
    const { data: miembro, error: errorMiembro } = await admin
      .from('miembros')
      .insert({
        usuario_id: user.id,
        empresa_id: empresa.id,
        rol: 'propietario',
        activo: true,
      })
      .select('id')
      .single()

    if (errorMiembro || !miembro) {
      return NextResponse.json({ error: 'Error al crear membresía' }, { status: 500 })
    }

    // Crear contacto tipo "equipo" para el propietario
    await vincularOCrearContactoEquipo(admin, {
      miembroId: miembro.id,
      empresaId: empresa.id,
      correo: user.email || '',
      nombre: user.user_metadata?.nombre_completo || user.email?.split('@')[0] || '',
      usuarioId: user.id,
    })

    // Setear empresa activa en app_metadata para que el JWT hook la use
    await admin.auth.admin.updateUserById(user.id, {
      app_metadata: { empresa_activa_id: empresa.id },
    })

    return NextResponse.json({ empresa })
  } catch {
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
