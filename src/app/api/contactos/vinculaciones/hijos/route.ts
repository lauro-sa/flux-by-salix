import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/contactos/vinculaciones/hijos?ids=uuid1,uuid2,...
 * Devuelve los contactos vinculados (hijos) de cada contacto contenedor.
 * Se usa en el buscador jerárquico: al buscar "TechCorp", muestra sus vinculados indentados.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const idsParam = request.nextUrl.searchParams.get('ids')
    if (!idsParam) return NextResponse.json({ hijos: {} })

    const ids = idsParam.split(',').filter(Boolean).slice(0, 20) // máximo 20 contenedores
    if (ids.length === 0) return NextResponse.json({ hijos: {} })

    const admin = crearClienteAdmin()

    // Buscar vinculaciones donde contacto_id sea uno de los contenedores
    const { data: vinculaciones, error } = await admin
      .from('contacto_vinculaciones')
      .select(`
        contacto_id,
        vinculado_id,
        puesto,
        vinculado:contactos!contacto_vinculaciones_vinculado_id_fkey(
          id, nombre, apellido, correo, telefono, codigo,
          tipo_contacto:tipos_contacto!tipo_contacto_id(clave, etiqueta, icono, color)
        )
      `)
      .eq('empresa_id', empresaId)
      .in('contacto_id', ids)

    if (error) {
      console.error('Error al buscar hijos:', error)
      return NextResponse.json({ error: 'Error al buscar hijos' }, { status: 500 })
    }

    // Agrupar por contacto_id (el contenedor)
    const hijos: Record<string, unknown[]> = {}
    for (const v of vinculaciones || []) {
      if (!hijos[v.contacto_id]) hijos[v.contacto_id] = []
      hijos[v.contacto_id].push({
        ...v.vinculado,
        puesto_en_contenedor: v.puesto,
      })
    }

    return NextResponse.json({ hijos })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
