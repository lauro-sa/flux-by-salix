import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * POST /api/contactos/vinculaciones — Crear vinculación UNIDIRECCIONAL.
 * Solo se crea UNA fila: contacto_id → vinculado_id.
 * El contacto_id es el "dueño" de la vinculación.
 * El vinculado_id lo ve en "Vinculado en" (read-only).
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('contactos', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const body = await request.json()
    const { contacto_id, vinculado_id, tipo_relacion_id, puesto, recibe_documentos } = body

    if (!contacto_id || !vinculado_id) {
      return NextResponse.json({ error: 'contacto_id y vinculado_id son obligatorios' }, { status: 400 })
    }
    if (contacto_id === vinculado_id) {
      return NextResponse.json({ error: 'Un contacto no puede vincularse a sí mismo' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar que ambos contactos pertenecen a la empresa
    const { data: contactos } = await admin
      .from('contactos')
      .select('id')
      .eq('empresa_id', empresaId)
      .in('id', [contacto_id, vinculado_id])

    if (!contactos || contactos.length !== 2) {
      return NextResponse.json({ error: 'Contactos no encontrados' }, { status: 404 })
    }

    // Insertar UNA sola fila (unidireccional)
    const { error } = await admin
      .from('contacto_vinculaciones')
      .insert({
        empresa_id: empresaId,
        contacto_id,
        vinculado_id,
        tipo_relacion_id: tipo_relacion_id || null,
        puesto: puesto || null,
        recibe_documentos: recibe_documentos || false,
      })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Esta vinculación ya existe' }, { status: 409 })
      }
      console.error('Error al vincular:', error)
      return NextResponse.json({ error: 'Error al crear vinculación' }, { status: 500 })
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/contactos/vinculaciones — Eliminar vinculación.
 * Solo el dueño (contacto_id) puede desvincular.
 * Se elimina la fila completa.
 */
export async function DELETE(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('contactos', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const body = await request.json()
    const { contacto_id, vinculado_id } = body

    if (!contacto_id || !vinculado_id) {
      return NextResponse.json({ error: 'contacto_id y vinculado_id son obligatorios' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    await admin
      .from('contacto_vinculaciones')
      .delete()
      .eq('empresa_id', empresaId)
      .eq('contacto_id', contacto_id)
      .eq('vinculado_id', vinculado_id)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/contactos/vinculaciones — Actualizar puesto o recibe_documentos.
 */
export async function PATCH(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('contactos', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

    const body = await request.json()
    const { contacto_id, vinculado_id } = body

    if (!contacto_id || !vinculado_id) {
      return NextResponse.json({ error: 'contacto_id y vinculado_id son obligatorios' }, { status: 400 })
    }

    const admin = crearClienteAdmin()
    const actualizar: Record<string, unknown> = {}

    if ('puesto' in body) actualizar.puesto = body.puesto
    if ('recibe_documentos' in body) actualizar.recibe_documentos = body.recibe_documentos
    if ('tipo_relacion_id' in body) actualizar.tipo_relacion_id = body.tipo_relacion_id

    const { error } = await admin
      .from('contacto_vinculaciones')
      .update(actualizar)
      .eq('empresa_id', empresaId)
      .eq('contacto_id', contacto_id)
      .eq('vinculado_id', vinculado_id)

    if (error) {
      console.error('Error al actualizar vinculación:', error)
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
