import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { sanitizarBusqueda } from '@/lib/validaciones'

/**
 * GET /api/productos/buscar?q=texto — Búsqueda rápida de productos para autocompletado.
 * Devuelve máximo 8 resultados con campos mínimos para selección en líneas de presupuesto.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const q = sanitizarBusqueda(request.nextUrl.searchParams.get('q') || '')
    const admin = crearClienteAdmin()

    let query = admin
      .from('productos')
      .select('id, codigo, nombre, tipo, precio_unitario, costo, moneda, unidad, impuesto_id, descripcion_venta, categoria')
      .eq('empresa_id', empresaId)
      .eq('activo', true)
      .eq('en_papelera', false)
      .eq('puede_venderse', true)
      .eq('es_provisorio', false)
      .limit(8)

    if (q.trim()) {
      if (q.length <= 2) {
        query = query.or(`codigo.ilike.%${q}%,nombre.ilike.%${q}%,referencia_interna.ilike.%${q}%`)
      } else {
        const terminos = q.trim().split(/\s+/).map(t => `${t}:*`).join(' & ')
        query = query.textSearch('busqueda', terminos, { config: 'spanish' })
      }
    }

    query = query.order('nombre', { ascending: true })

    const { data, error } = await query

    if (error) {
      console.error('Error búsqueda productos:', error)
      return NextResponse.json({ error: 'Error en búsqueda' }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
