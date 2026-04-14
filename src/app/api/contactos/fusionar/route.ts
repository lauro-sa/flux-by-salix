import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * POST /api/contactos/fusionar — Fusiona un contacto provisorio con uno existente.
 * Mueve todas las relaciones (conversaciones, mensajes, actividades, visitas, etc.)
 * del provisorio al destino, y luego elimina el provisorio.
 *
 * Body: { provisorio_id: string, destino_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'contactos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const body = await request.json()
    const { provisorio_id, destino_id } = body

    if (!provisorio_id || !destino_id) {
      return NextResponse.json({ error: 'provisorio_id y destino_id requeridos' }, { status: 400 })
    }

    if (provisorio_id === destino_id) {
      return NextResponse.json({ error: 'No se puede fusionar un contacto consigo mismo' }, { status: 400 })
    }

    const admin = crearClienteAdmin()

    // Verificar que ambos contactos existen y pertenecen a la empresa
    const [provRes, destRes] = await Promise.all([
      admin.from('contactos').select('id, nombre, apellido, es_provisorio, correo, telefono, whatsapp, cargo, web')
        .eq('id', provisorio_id).eq('empresa_id', empresaId).single(),
      admin.from('contactos').select('id, nombre, apellido, codigo, correo, telefono, whatsapp, cargo, web')
        .eq('id', destino_id).eq('empresa_id', empresaId).single(),
    ])

    if (!provRes.data) {
      return NextResponse.json({ error: 'Contacto provisorio no encontrado' }, { status: 404 })
    }
    if (!destRes.data) {
      return NextResponse.json({ error: 'Contacto destino no encontrado' }, { status: 404 })
    }

    const provisorio = provRes.data
    const destino = destRes.data

    // Actualizar campos vacíos del destino con datos del provisorio
    const camposActualizar: Record<string, unknown> = {}
    if (!destino.correo && provisorio.correo) camposActualizar.correo = provisorio.correo
    if (!destino.telefono && provisorio.telefono) camposActualizar.telefono = provisorio.telefono
    if (!destino.whatsapp && provisorio.whatsapp) camposActualizar.whatsapp = provisorio.whatsapp
    if (!destino.cargo && provisorio.cargo) camposActualizar.cargo = provisorio.cargo
    if (!destino.web && provisorio.web) camposActualizar.web = provisorio.web

    // Migrar todas las relaciones del provisorio al destino en paralelo
    const migraciones = [
      // Conversaciones de WhatsApp/inbox
      admin.from('conversaciones')
        .update({ contacto_id: destino_id })
        .eq('contacto_id', provisorio_id)
        .eq('empresa_id', empresaId),

      // Actividades vinculadas
      admin.from('actividad_contactos')
        .update({ contacto_id: destino_id })
        .eq('contacto_id', provisorio_id),

      // Visitas
      admin.from('visitas')
        .update({ contacto_id: destino_id })
        .eq('contacto_id', provisorio_id)
        .eq('empresa_id', empresaId),

      // Presupuestos
      admin.from('presupuestos')
        .update({ contacto_id: destino_id })
        .eq('contacto_id', provisorio_id)
        .eq('empresa_id', empresaId),

      // Presupuestos (atención)
      admin.from('presupuestos')
        .update({ atencion_contacto_id: destino_id })
        .eq('atencion_contacto_id', provisorio_id)
        .eq('empresa_id', empresaId),

      // Vinculaciones (como contacto principal)
      admin.from('contacto_vinculaciones')
        .update({ contacto_id: destino_id })
        .eq('contacto_id', provisorio_id),

      // Vinculaciones (como vinculado)
      admin.from('contacto_vinculaciones')
        .update({ vinculado_id: destino_id })
        .eq('vinculado_id', provisorio_id),

      // Direcciones — mover las que no dupliquen
      admin.from('contacto_direcciones')
        .update({ contacto_id: destino_id })
        .eq('contacto_id', provisorio_id),

      // Recorrido contacto recepción
      admin.from('recorridos')
        .update({ recibe_contacto_id: destino_id })
        .eq('recibe_contacto_id', provisorio_id),
    ]

    // Si hay campos para actualizar en el destino, agregar esa operación
    if (Object.keys(camposActualizar).length > 0) {
      camposActualizar.actualizado_en = new Date().toISOString()
      camposActualizar.editado_por = user.id
      migraciones.push(
        admin.from('contactos')
          .update(camposActualizar)
          .eq('id', destino_id)
          .eq('empresa_id', empresaId)
      )
    }

    await Promise.all(migraciones)

    // Eliminar el contacto provisorio (hard delete — ya migró todo)
    await admin
      .from('contactos')
      .delete()
      .eq('id', provisorio_id)
      .eq('empresa_id', empresaId)

    return NextResponse.json({
      ok: true,
      destino_id: destino_id,
      destino_codigo: destino.codigo,
      destino_nombre: `${destino.nombre || ''} ${destino.apellido || ''}`.trim(),
      campos_actualizados: Object.keys(camposActualizar).filter(k => k !== 'actualizado_en' && k !== 'editado_por'),
    })
  } catch (err) {
    console.error('Error fusionando contactos:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
