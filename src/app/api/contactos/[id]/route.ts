import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/contactos/[id] — Obtener detalle completo de un contacto.
 * Incluye tipo, direcciones, responsables, seguidores, vinculaciones con datos del vinculado.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Contacto base + tipo
    const { data: contacto, error } = await admin
      .from('contactos')
      .select(`
        *,
        tipo_contacto:tipos_contacto!tipo_contacto_id(id, clave, etiqueta, icono, color, puede_tener_hijos)
      `)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (error || !contacto) {
      console.error('Error al obtener contacto:', error)
      return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })
    }

    // Direcciones, responsables y seguidores en queries separadas (más confiable)
    const [dirsRes, respRes, segRes] = await Promise.all([
      admin.from('contacto_direcciones').select('*').eq('contacto_id', id),
      admin.from('contacto_responsables').select('*').eq('contacto_id', id),
      admin.from('contacto_seguidores').select('*').eq('contacto_id', id),
    ])

    contacto.direcciones = dirsRes.data || []
    contacto.responsables = respRes.data || []
    contacto.seguidores = segRes.data || []

    // Vinculaciones con datos del contacto vinculado
    const { data: vinculaciones } = await admin
      .from('contacto_vinculaciones')
      .select(`
        id,
        vinculado_id,
        tipo_relacion_id,
        puesto,
        recibe_documentos,
        creado_en,
        tipo_relacion:tipos_relacion!tipo_relacion_id(id, clave, etiqueta, etiqueta_inversa),
        vinculado:contactos!vinculado_id(
          id, nombre, apellido, correo, telefono, codigo,
          tipo_contacto:tipos_contacto!tipo_contacto_id(clave, etiqueta, icono, color)
        )
      `)
      .eq('contacto_id', id)
      .eq('empresa_id', empresaId)

    // Vinculaciones inversas (contactos que lo vincularon a él)
    const { data: vinculacionesInversas } = await admin
      .from('contacto_vinculaciones')
      .select(`
        id,
        contacto_id,
        tipo_relacion_id,
        puesto,
        recibe_documentos,
        creado_en,
        tipo_relacion:tipos_relacion!tipo_relacion_id(id, clave, etiqueta, etiqueta_inversa),
        contacto:contactos!contacto_id(
          id, nombre, apellido, correo, telefono, codigo,
          tipo_contacto:tipos_contacto!tipo_contacto_id(clave, etiqueta, icono, color)
        )
      `)
      .eq('vinculado_id', id)
      .eq('empresa_id', empresaId)

    // Filtrar inversas: solo las que NO tienen contraparte en directas
    // (si yo vinculé A→B, el reverso B→A no es "externo", es parte de la misma vinculación)
    const idsDirectos = new Set((vinculaciones || []).map((v: { vinculado_id: string }) => v.vinculado_id))
    const inversasFiltradas = (vinculacionesInversas || []).filter(
      (v: { contacto_id: string }) => !idsDirectos.has(v.contacto_id)
    )

    return NextResponse.json({
      ...contacto,
      vinculaciones: vinculaciones || [],
      vinculaciones_inversas: inversasFiltradas,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/contactos/[id] — Editar campos de un contacto.
 * Autoguardado: recibe campos parciales.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'contactos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para editar contactos' }, { status: 403 })

    const campos = await request.json()

    // Si se envía a papelera, verificar permiso de eliminar además de editar
    if (campos.en_papelera === true) {
      const { permitido: puedeEliminar } = await obtenerYVerificarPermiso(user.id, empresaId, 'contactos', 'eliminar')
      if (!puedeEliminar) return NextResponse.json({ error: 'Sin permiso para eliminar contactos' }, { status: 403 })
    }
    const admin = crearClienteAdmin()

    // Campos editables
    const permitidos = [
      'nombre', 'apellido', 'titulo',
      'correo', 'telefono', 'whatsapp', 'web',
      'cargo', 'rubro',
      'moneda', 'idioma', 'zona_horaria', 'limite_credito',
      'plazo_pago_cliente', 'plazo_pago_proveedor',
      'rank_cliente', 'rank_proveedor',
      'pais_fiscal', 'tipo_identificacion', 'numero_identificacion', 'datos_fiscales',
      'etiquetas', 'notas',
      'activo', 'en_papelera', 'es_provisorio',
      'tipo_contacto_id',
    ]

    const actualizar: Record<string, unknown> = {}
    for (const campo of permitidos) {
      if (campo in campos) actualizar[campo] = campos[campo]
    }

    if (Object.keys(actualizar).length === 0) {
      return NextResponse.json({ error: 'Sin campos para actualizar' }, { status: 400 })
    }

    // Limpiar datos
    if (actualizar.correo) actualizar.correo = (actualizar.correo as string).toLowerCase().trim()
    if (actualizar.nombre) actualizar.nombre = (actualizar.nombre as string).trim()

    // Marcar timestamp de edición
    actualizar.editado_por = user.id
    actualizar.actualizado_en = new Date().toISOString()

    // Si se mueve a papelera
    if (actualizar.en_papelera === true) {
      actualizar.papelera_en = new Date().toISOString()
    }
    if (actualizar.en_papelera === false) {
      actualizar.papelera_en = null
    }

    // Si se aprueba provisorio → generar código secuencial real
    if (actualizar.es_provisorio === false && 'es_provisorio' in campos) {
      // Verificar si el contacto actual no tiene código
      const { data: actual } = await admin
        .from('contactos')
        .select('codigo')
        .eq('id', id)
        .single()

      if (!actual?.codigo) {
        const { data: codigoData } = await admin
          .rpc('siguiente_codigo', { p_empresa_id: empresaId, p_entidad: 'contacto' })

        if (codigoData) {
          actualizar.codigo = codigoData as string
        }
      }
    }

    const { data, error } = await admin
      .from('contactos')
      .update(actualizar)
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select(`
        *,
        tipo_contacto:tipos_contacto!tipo_contacto_id(id, clave, etiqueta, icono, color)
      `)
      .single()

    if (error) {
      console.error('Error al actualizar contacto:', error)
      return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
    }

    if (!data) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })

    // Propagar cambio de nombre a vínculos de actividades y notificaciones (fire-and-forget)
    if ('nombre' in campos || 'apellido' in campos) {
      const nombreCompleto = `${data.nombre || ''} ${data.apellido || ''}`.trim()
      propagarCambioNombreContacto(admin, empresaId, id, nombreCompleto).catch((err) =>
        console.error('Error al propagar nombre de contacto:', err)
      )
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/contactos/[id] — Eliminar definitivamente un contacto.
 * Solo desde papelera (soft delete primero con PATCH en_papelera=true).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'contactos', 'eliminar')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para eliminar contactos' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Verificar que está en papelera antes de borrar definitivamente
    const { data: contacto } = await admin
      .from('contactos')
      .select('id, en_papelera')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!contacto) return NextResponse.json({ error: 'Contacto no encontrado' }, { status: 404 })

    if (!contacto.en_papelera) {
      return NextResponse.json({
        error: 'El contacto debe estar en la papelera antes de eliminarse definitivamente',
      }, { status: 400 })
    }

    // Eliminar vinculaciones bidireccionales primero
    await admin
      .from('contacto_vinculaciones')
      .delete()
      .or(`contacto_id.eq.${id},vinculado_id.eq.${id}`)

    // Eliminar contacto (cascade borra direcciones, responsables, seguidores)
    const { error } = await admin
      .from('contactos')
      .delete()
      .eq('id', id)
      .eq('empresa_id', empresaId)

    if (error) {
      console.error('Error al eliminar contacto:', error)
      return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno del DELETE' }, { status: 500 })
  }
}

/**
 * Propaga el cambio de nombre de un contacto a todas las tablas que lo desnormalizan:
 * 1. Vínculos JSONB de actividades
 * 2. Conversaciones (contacto_nombre)
 * 3. Presupuestos (contacto_nombre, contacto_apellido)
 * Se ejecuta fire-and-forget para no bloquear la respuesta del PATCH.
 */
async function propagarCambioNombreContacto(
  admin: ReturnType<typeof crearClienteAdmin>,
  empresaId: string,
  contactoId: string,
  nombreNuevo: string
) {
  // Separar nombre y apellido del nombre completo para tablas que los guardan por separado
  const partes = nombreNuevo.split(' ')
  const nombre = partes[0] || ''
  const apellido = partes.slice(1).join(' ') || ''

  // 1. Actualizar vínculos JSONB en actividades
  const { data: actividades } = await admin
    .from('actividades')
    .select('id, vinculos')
    .eq('empresa_id', empresaId)
    .contains('vinculo_ids', [contactoId])

  if (actividades && actividades.length > 0) {
    for (const act of actividades) {
      const vinculos = (act.vinculos || []) as { tipo: string; id: string; nombre: string }[]
      let cambio = false
      for (const v of vinculos) {
        if (v.id === contactoId && v.nombre !== nombreNuevo) {
          v.nombre = nombreNuevo
          cambio = true
        }
      }
      if (cambio) {
        await admin
          .from('actividades')
          .update({ vinculos })
          .eq('id', act.id)
      }
    }
  }

  // 2. Actualizar conversaciones que referencian este contacto
  admin
    .from('conversaciones')
    .update({ contacto_nombre: nombreNuevo })
    .eq('empresa_id', empresaId)
    .eq('contacto_id', contactoId)
    .then(() => {})

  // 3. Actualizar presupuestos que referencian este contacto
  admin
    .from('presupuestos')
    .update({ contacto_nombre: nombre, contacto_apellido: apellido })
    .eq('empresa_id', empresaId)
    .eq('contacto_id', contactoId)
    .then(() => {})
}
