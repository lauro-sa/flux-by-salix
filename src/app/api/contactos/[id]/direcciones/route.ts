import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * PUT /api/contactos/[id]/direcciones — Reemplaza las direcciones MANUALES de un contacto.
 *
 * IMPORTANTE: solo afecta filas con origen='manual'. Las direcciones con origen='sync_perfil'
 * (sincronizadas del perfil del miembro vinculado) NO se tocan — se administran desde
 * la sección Usuarios. Si el cliente manda items que coinciden por calle+ciudad con la
 * dirección sincronizada, se ignoran para evitar duplicados.
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

    const { data: contacto } = await admin
      .from('contactos')
      .select('id')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!contacto) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })

    const { direcciones } = await request.json()

    // Detectar si hay una dirección sincronizada del perfil para no duplicar
    const { data: filasSync } = await admin
      .from('contacto_direcciones')
      .select('calle, ciudad')
      .eq('contacto_id', id)
      .eq('origen', 'sync_perfil')
    const claveSync = new Set((filasSync || []).map(d => `${(d.calle || '').toLowerCase()}|${(d.ciudad || '').toLowerCase()}`))

    // Borrar solo las manuales
    await admin
      .from('contacto_direcciones')
      .delete()
      .eq('contacto_id', id)
      .eq('origen', 'manual')

    if (direcciones?.length) {
      const filas = (direcciones as Record<string, unknown>[])
        // Filtrar items que coincidan por calle+ciudad con una dirección sincronizada
        .filter(d => {
          const clave = `${String(d.calle || '').toLowerCase()}|${String(d.ciudad || '').toLowerCase()}`
          return !claveSync.has(clave)
        })
        .map((d, i) => ({
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
          // La primera dirección manual se marca como principal solo si NO hay sync.
          es_principal: i === 0 && (filasSync || []).length === 0,
          origen: 'manual',
        }))

      if (filas.length > 0) {
        await admin.from('contacto_direcciones').insert(filas)
      }
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
