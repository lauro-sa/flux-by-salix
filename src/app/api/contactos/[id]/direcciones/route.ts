import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * PUT /api/contactos/[id]/direcciones — Reemplaza TODAS las direcciones de un contacto.
 * Recibe el array completo, borra las anteriores e inserta las nuevas.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const guard = await requerirPermisoAPI('contactos', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const admin = crearClienteAdmin()

    // Verificar que el contacto pertenece a la empresa
    const { data: contacto } = await admin
      .from('contactos')
      .select('id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!contacto) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })

    const { direcciones } = await request.json()

    // Borrar todas las direcciones actuales
    await admin.from('contacto_direcciones').delete().eq('contacto_id', id)

    // Insertar las nuevas (si hay)
    if (direcciones?.length) {
      const filas = direcciones.map((d: Record<string, unknown>, i: number) => ({
        contacto_id: id,
        tipo: d.tipo || 'principal',
        calle: d.calle || null,
        barrio: d.barrio || null,
        ciudad: d.ciudad || null,
        provincia: d.provincia || null,
        codigo_postal: d.codigo_postal || null,
        pais: d.pais || null,
        piso: d.piso || null,
        departamento: d.departamento || null,
        lat: d.lat || null,
        lng: d.lng || null,
        texto: d.texto || null,
        es_principal: i === 0,
      }))
      await admin.from('contacto_direcciones').insert(filas)
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
