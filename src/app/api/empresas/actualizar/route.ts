import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * PATCH /api/empresas/actualizar — Actualizar datos de la empresa activa.
 * Solo propietario o administrador.
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Verificar rol
    const { data: miembro } = await admin
      .from('miembros')
      .select('rol')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    if (!miembro || !['propietario', 'administrador'].includes(miembro.rol)) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const campos = await request.json()

    // Campos permitidos
    const permitidos = ['nombre', 'slug', 'logo_url', 'pais', 'paises', 'color_marca', 'color_secundario', 'color_terciario', 'ubicacion', 'direccion', 'pagina_web', 'correo', 'telefono', 'moneda', 'formato_fecha', 'formato_hora', 'dia_inicio_semana', 'zona_horaria']
    const actualizar: Record<string, unknown> = {}
    for (const campo of permitidos) {
      if (campo in campos) actualizar[campo] = campos[campo]
    }

    if (Object.keys(actualizar).length === 0) {
      return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 })
    }

    // Validar slug si se está cambiando
    if (actualizar.slug) {
      const slugLimpio = (actualizar.slug as string).toLowerCase().trim()
      if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(slugLimpio)) {
        return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })
      }
      const { data: existente } = await admin.from('empresas').select('id').eq('slug', slugLimpio).neq('id', empresaId).single()
      if (existente) return NextResponse.json({ error: 'Subdominio en uso' }, { status: 409 })
      actualizar.slug = slugLimpio
    }

    const { data, error } = await admin
      .from('empresas')
      .update(actualizar)
      .eq('id', empresaId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
