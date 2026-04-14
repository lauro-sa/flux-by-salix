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

    const nombreDestino = `${destino.nombre || ''} ${destino.apellido || ''}`.trim()

    // ── Paso 1: Eliminar vinculaciones que generarían duplicados o auto-vinculaciones ──
    // Vinculaciones donde provisorio→destino o destino→provisorio (se eliminan, no tiene sentido)
    await admin.from('contacto_vinculaciones')
      .delete()
      .or(`and(contacto_id.eq.${provisorio_id},vinculado_id.eq.${destino_id}),and(contacto_id.eq.${destino_id},vinculado_id.eq.${provisorio_id})`)

    // Buscar vinculaciones del destino para evitar duplicar unique constraints
    const [vincDirectasDest, vincInversasDest] = await Promise.all([
      admin.from('contacto_vinculaciones').select('vinculado_id').eq('contacto_id', destino_id),
      admin.from('contacto_vinculaciones').select('contacto_id').eq('vinculado_id', destino_id),
    ])
    const idsYaVinculadosDesde = new Set((vincDirectasDest.data || []).map(v => v.vinculado_id))
    const idsYaVinculadosHacia = new Set((vincInversasDest.data || []).map(v => v.contacto_id))

    // Eliminar vinculaciones del provisorio que ya existen en el destino (evitar conflictos unique)
    const [vincDirectasProv, vincInversasProv] = await Promise.all([
      admin.from('contacto_vinculaciones').select('id, vinculado_id').eq('contacto_id', provisorio_id),
      admin.from('contacto_vinculaciones').select('id, contacto_id').eq('vinculado_id', provisorio_id),
    ])

    const idsEliminar: string[] = []
    for (const v of vincDirectasProv.data || []) {
      if (idsYaVinculadosDesde.has(v.vinculado_id) || v.vinculado_id === destino_id) {
        idsEliminar.push(v.id)
      }
    }
    for (const v of vincInversasProv.data || []) {
      if (idsYaVinculadosHacia.has(v.contacto_id) || v.contacto_id === destino_id) {
        idsEliminar.push(v.id)
      }
    }
    if (idsEliminar.length > 0) {
      await admin.from('contacto_vinculaciones').delete().in('id', idsEliminar)
    }

    // ── Paso 2: Migrar todas las relaciones del provisorio al destino ──
    const migraciones = [
      // Conversaciones de WhatsApp/inbox — actualizar contacto_id Y el nombre cacheado
      admin.from('conversaciones')
        .update({ contacto_id: destino_id, contacto_nombre: nombreDestino })
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

      // Vinculaciones restantes (sin duplicados, ya limpiamos arriba)
      admin.from('contacto_vinculaciones')
        .update({ contacto_id: destino_id })
        .eq('contacto_id', provisorio_id),

      admin.from('contacto_vinculaciones')
        .update({ vinculado_id: destino_id })
        .eq('vinculado_id', provisorio_id),

      // Direcciones
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

    // ── Paso 3: Eliminar el contacto provisorio (hard delete — ya migró todo) ──
    await admin
      .from('contactos')
      .delete()
      .eq('id', provisorio_id)
      .eq('empresa_id', empresaId)

    return NextResponse.json({
      ok: true,
      destino_id: destino_id,
      destino_codigo: destino.codigo,
      destino_nombre: nombreDestino,
      campos_actualizados: Object.keys(camposActualizar).filter(k => k !== 'actualizado_en' && k !== 'editado_por'),
    })
  } catch (err) {
    console.error('Error fusionando contactos:', err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
