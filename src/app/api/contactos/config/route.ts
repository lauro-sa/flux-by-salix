import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/contactos/config — Obtener etiquetas, rubros y puestos configurados.
 */
export async function GET() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de lectura en config de contactos
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_contactos', 'ver')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos para ver configuración de contactos' }, { status: 403 })

    const admin = crearClienteAdmin()

    const [etiquetasRes, rubrosRes, puestosRes, relacionesRes] = await Promise.all([
      admin.from('etiquetas_contacto').select('*').eq('empresa_id', empresaId).order('orden'),
      admin.from('rubros_contacto').select('*').eq('empresa_id', empresaId).order('orden'),
      admin.from('puestos_contacto').select('*').eq('empresa_id', empresaId).order('orden'),
      admin.from('tipos_relacion').select('*').eq('empresa_id', empresaId).order('etiqueta'),
    ])

    return NextResponse.json({
      etiquetas: etiquetasRes.data || [],
      rubros: rubrosRes.data || [],
      puestos: puestosRes.data || [],
      relaciones: (relacionesRes.data || []).map((r: Record<string, unknown>) => ({
        id: r.id, nombre: r.etiqueta, activo: r.activo, orden: 0,
        etiqueta_inversa: r.etiqueta_inversa, es_predefinido: r.es_predefinido,
      })),
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/contactos/config — Crear etiqueta, rubro o puesto.
 * Body: { tipo: 'etiqueta' | 'rubro' | 'puesto', nombre: string, color?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de edición en config de contactos
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_contactos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos para editar configuración de contactos' }, { status: 403 })

    const body = await request.json()
    const { tipo, nombre, color, activo } = body

    if (!nombre?.trim()) return NextResponse.json({ error: 'Nombre obligatorio' }, { status: 400 })

    const admin = crearClienteAdmin()

    // Tipos de relación tienen estructura diferente
    if (tipo === 'relacion') {
      const clave = nombre.trim().toLowerCase().replace(/\s+/g, '_')
      const { data, error } = await admin.from('tipos_relacion').insert({
        empresa_id: empresaId,
        clave,
        etiqueta: nombre.trim(),
        etiqueta_inversa: body.etiqueta_inversa?.trim() || nombre.trim(),
        es_predefinido: false,
      }).select().single()

      if (error) {
        if (error.code === '23505') return NextResponse.json({ error: 'Ya existe' }, { status: 409 })
        return NextResponse.json({ error: 'Error al crear' }, { status: 500 })
      }
      return NextResponse.json(data, { status: 201 })
    }

    const tabla = tipo === 'etiqueta' ? 'etiquetas_contacto' : tipo === 'rubro' ? 'rubros_contacto' : tipo === 'puesto' ? 'puestos_contacto' : null

    if (!tabla) return NextResponse.json({ error: 'Tipo no válido' }, { status: 400 })

    const registro: Record<string, unknown> = {
      empresa_id: empresaId,
      nombre: nombre.trim(),
    }
    if (tipo === 'etiqueta' && color) registro.color = color
    if (activo !== undefined) registro.activo = activo

    const { data, error } = await admin.from(tabla).insert(registro).select().single()

    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Ya existe' }, { status: 409 })
      return NextResponse.json({ error: 'Error al crear' }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/contactos/config — Actualizar etiqueta, rubro o puesto.
 * Body: { tipo, id, nombre?, color?, activo?, orden? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de edición en config de contactos
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_contactos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos para editar configuración de contactos' }, { status: 403 })

    const body = await request.json()
    const { tipo, id } = body

    const admin = crearClienteAdmin()
    const tabla = tipo === 'etiqueta' ? 'etiquetas_contacto' : tipo === 'rubro' ? 'rubros_contacto' : tipo === 'puesto' ? 'puestos_contacto' : tipo === 'relacion' ? 'tipos_relacion' : null

    if (!tabla || !id) return NextResponse.json({ error: 'Tipo e ID obligatorios' }, { status: 400 })

    const actualizar: Record<string, unknown> = {}
    if (tipo === 'relacion') {
      if ('nombre' in body) actualizar.etiqueta = body.nombre?.trim()
      if ('etiqueta_inversa' in body) actualizar.etiqueta_inversa = body.etiqueta_inversa?.trim()
    } else {
      if ('nombre' in body) actualizar.nombre = body.nombre?.trim()
    }
    if ('color' in body) actualizar.color = body.color
    if ('activo' in body) actualizar.activo = body.activo
    if ('orden' in body) actualizar.orden = body.orden

    const { data, error } = await admin.from(tabla).update(actualizar).eq('id', id).eq('empresa_id', empresaId).select().single()

    if (error) return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/contactos/config — Eliminar etiqueta, rubro o puesto.
 * Body: { tipo, id }
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de edición en config de contactos
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_contactos', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos para editar configuración de contactos' }, { status: 403 })

    const body = await request.json()
    const { tipo, id } = body

    const admin = crearClienteAdmin()
    const tabla = tipo === 'etiqueta' ? 'etiquetas_contacto' : tipo === 'rubro' ? 'rubros_contacto' : tipo === 'puesto' ? 'puestos_contacto' : tipo === 'relacion' ? 'tipos_relacion' : null

    if (!tabla || !id) return NextResponse.json({ error: 'Tipo e ID obligatorios' }, { status: 400 })

    await admin.from(tabla).delete().eq('id', id).eq('empresa_id', empresaId)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
