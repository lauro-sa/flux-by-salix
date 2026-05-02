import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { TABLA_ESTADOS_POR_ENTIDAD } from '@/lib/estados/mapeo'
import { esEntidadConEstado } from '@/tipos/estados'

/**
 * GET /api/estados?entidad_tipo=<tipo>
 *
 * Devuelve los estados configurables disponibles para una entidad.
 * Combina los estados del sistema (empresa_id NULL) con los propios de
 * la empresa, ordenados por el campo `orden`.
 *
 * Lo consume `useEstados()` para alimentar selectores y badges.
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const entidadTipo = params.get('entidad_tipo')

    if (!entidadTipo || !esEntidadConEstado(entidadTipo)) {
      return NextResponse.json(
        { error: `entidad_tipo inválida: "${entidadTipo}"` },
        { status: 400 },
      )
    }

    const tabla = TABLA_ESTADOS_POR_ENTIDAD[entidadTipo]
    if (!tabla) {
      // Entidad no migrada todavía — devolver lista vacía es lo correcto
      // para que la UI no crashee y caiga a estados hardcodeados como fallback.
      return NextResponse.json({ estados: [] })
    }

    const admin = crearClienteAdmin()
    const { data, error } = await admin
      .from(tabla)
      .select('*')
      .or(`empresa_id.eq.${empresaId},empresa_id.is.null`)
      .eq('activo', true)
      // Si la empresa tiene un override (mismo `clave`), preferir el propio
      // por orden_id NOT NULL primero. La unicidad ya está garantizada por
      // el constraint, así que no hay duplicados con la misma clave.
      .order('orden', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ estados: data ?? [] })
  } catch (err) {
    console.error('Error GET /api/estados:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
