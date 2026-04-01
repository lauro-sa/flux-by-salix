import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { normalizarAcentos } from '@/lib/validaciones'

/**
 * GET /api/contactos/buscar?q=texto — Búsqueda rápida de contactos por nombre o email.
 * Se usa en: autocomplete del compositor de correo.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()

    if (!q || q.length < 2) {
      return NextResponse.json({ contactos: [] })
    }

    const qNorm = normalizarAcentos(q)
    const { data: contactos } = await supabase
      .from('contactos')
      .select('id, nombre, apellido, correo')
      .eq('empresa_id', empresaId)
      .or(`nombre.ilike.%${qNorm}%,apellido.ilike.%${qNorm}%,correo.ilike.%${qNorm}%`)
      .not('correo', 'is', null)
      .limit(10)

    return NextResponse.json({
      contactos: (contactos || []).map(c => ({
        id: c.id,
        nombre: `${c.nombre} ${c.apellido || ''}`.trim(),
        correo: c.correo,
      })),
    })
  } catch (err) {
    console.error('Error buscando contactos:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
