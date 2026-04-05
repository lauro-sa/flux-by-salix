import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/inbox/correo/tipo-contacto — Reglas de correo por tipo de contacto.
 * Devuelve qué bandeja usar para cada tipo de contacto de la empresa.
 */
export async function GET() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Obtener reglas con JOINs a tipos_contacto y canales_inbox
    const { data, error } = await admin
      .from('correo_por_tipo_contacto')
      .select(`
        id,
        empresa_id,
        tipo_contacto_id,
        canal_id,
        creado_en,
        tipos_contacto!inner(etiqueta, icono),
        canales_inbox!inner(nombre, config_conexion)
      `)
      .eq('empresa_id', empresaId)

    if (error) {
      // Tabla no existe aún
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return NextResponse.json({ reglas: [] })
      }
      throw error
    }

    // Aplanar JOINs para facilitar uso en frontend
    const reglas = (data || []).map((r: Record<string, unknown>) => {
      const tipoContacto = r.tipos_contacto as Record<string, unknown> | null
      const canal = r.canales_inbox as Record<string, unknown> | null
      const configConexion = canal?.config_conexion as Record<string, unknown> | null
      return {
        id: r.id,
        empresa_id: r.empresa_id,
        tipo_contacto_id: r.tipo_contacto_id,
        canal_id: r.canal_id,
        creado_en: r.creado_en,
        tipo_contacto_etiqueta: tipoContacto?.etiqueta || '',
        tipo_contacto_icono: tipoContacto?.icono || 'user',
        canal_nombre: canal?.nombre || '',
        canal_email: (configConexion?.email || configConexion?.usuario || '') as string,
      }
    })

    return NextResponse.json({ reglas })
  } catch (err) {
    console.error('Error al obtener reglas correo por tipo:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PUT /api/inbox/correo/tipo-contacto — Guardar reglas de correo por tipo de contacto.
 * Recibe: { reglas: [{ tipo_contacto_id, canal_id }] }
 * Hace upsert de las reglas y elimina las que ya no están.
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_inbox', 'editar')
    if (!permitido) {
      return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
    }

    const body = await request.json()
    const reglas = body.reglas as { tipo_contacto_id: string; canal_id: string }[]

    if (!Array.isArray(reglas)) {
      return NextResponse.json({ error: 'reglas debe ser un array' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Eliminar todas las reglas existentes de la empresa
    await admin
      .from('correo_por_tipo_contacto')
      .delete()
      .eq('empresa_id', empresaId)

    // Insertar las nuevas (solo las que tienen canal_id, las vacías = usar principal)
    const reglasConCanal = reglas.filter(r => r.canal_id && r.tipo_contacto_id)
    if (reglasConCanal.length > 0) {
      const { error } = await admin
        .from('correo_por_tipo_contacto')
        .insert(
          reglasConCanal.map(r => ({
            empresa_id: empresaId,
            tipo_contacto_id: r.tipo_contacto_id,
            canal_id: r.canal_id,
          }))
        )
      if (error) throw error
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error al guardar reglas correo por tipo:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
