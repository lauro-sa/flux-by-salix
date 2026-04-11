import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/productos/config — Obtener configuración de productos de la empresa.
 */
export async function GET() {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de lectura en config de productos
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_productos', 'ver')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos para ver configuración de productos' }, { status: 403 })

    const admin = crearClienteAdmin()
    let { data } = await admin
      .from('config_productos')
      .select('*')
      .eq('empresa_id', empresaId)
      .single()

    if (!data) {
      // Crear config por defecto
      const { data: nueva } = await admin
        .from('config_productos')
        .insert({ empresa_id: empresaId })
        .select()
        .single()
      data = nueva
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/productos/config — Actualizar configuración de productos.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de edición en config de productos
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_productos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos para editar configuración de productos' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    // Upsert: si no existe, insertar; si existe, actualizar
    const { data: existente } = await admin
      .from('config_productos')
      .select('empresa_id')
      .eq('empresa_id', empresaId)
      .single()

    if (!existente) {
      const { data, error } = await admin
        .from('config_productos')
        .insert({ empresa_id: empresaId, ...body, actualizado_en: new Date().toISOString() })
        .select()
        .single()
      if (error) {
        console.error('Error al crear config:', error)
        return NextResponse.json({ error: 'Error al crear configuración' }, { status: 500 })
      }
      return NextResponse.json(data)
    }

    const { data, error } = await admin
      .from('config_productos')
      .update({ ...body, actualizado_en: new Date().toISOString() })
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) {
      console.error('Error al actualizar config:', error)
      return NextResponse.json({ error: 'Error al actualizar configuración' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
