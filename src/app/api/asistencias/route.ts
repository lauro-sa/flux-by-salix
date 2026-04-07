import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/asistencias — Listar asistencias con filtros.
 * Query params: desde, hasta, miembro_id, estado, pagina, limite
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const desde = params.get('desde')
    const hasta = params.get('hasta')
    const miembroId = params.get('miembro_id')
    const estado = params.get('estado')
    const pagina = parseInt(params.get('pagina') || '1')
    const limite = parseInt(params.get('limite') || '50')

    const admin = crearClienteAdmin()

    // Obtener miembros con nombres para mapear después
    const { data: miembrosData } = await admin
      .from('miembros')
      .select('id, usuario_id')
      .eq('empresa_id', empresaId)

    const { data: perfilesData } = await admin
      .from('perfiles')
      .select('id, nombre, apellido')

    // Mapeo miembro_id → nombre completo
    const perfilMap = new Map((perfilesData || []).map((p: Record<string, unknown>) => [p.id, p]))
    const miembroNombres = new Map((miembrosData || []).map((m: Record<string, unknown>) => {
      const perfil = perfilMap.get(m.usuario_id) as Record<string, unknown> | undefined
      return [m.id, perfil ? `${perfil.nombre} ${perfil.apellido}` : 'Sin nombre']
    }))

    let query = admin
      .from('asistencias')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresaId)
      .order('fecha', { ascending: false })
      .order('hora_entrada', { ascending: false })
      .range((pagina - 1) * limite, pagina * limite - 1)

    if (desde) query = query.gte('fecha', desde)
    if (hasta) query = query.lte('fecha', hasta)
    if (miembroId) query = query.eq('miembro_id', miembroId)
    if (estado) query = query.eq('estado', estado)

    const { data, count, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const registros = (data || []).map((r: Record<string, unknown>) => ({
      ...r,
      miembro_nombre: miembroNombres.get(r.miembro_id) || 'Sin nombre',
    }))

    return NextResponse.json({ registros, total: count || 0 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/asistencias — Crear fichaje manual (admin).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    // Obtener miembro_id del usuario actual para creado_por
    const { data: miembro } = await admin
      .from('miembros')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    const { data, error } = await admin
      .from('asistencias')
      .insert({
        empresa_id: empresaId,
        miembro_id: body.miembro_id,
        fecha: body.fecha,
        hora_entrada: body.hora_entrada || null,
        hora_salida: body.hora_salida || null,
        estado: body.estado || 'cerrado',
        tipo: body.tipo || 'normal',
        metodo_registro: 'manual',
        notas: body.notas || null,
        creado_por: miembro?.id || null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PATCH /api/asistencias — Editar fichaje (admin).
 * Body: { id: string, ...campos }
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const { id, ...campos } = body
    if (!id) return NextResponse.json({ error: 'Falta id' }, { status: 400 })

    const admin = crearClienteAdmin()

    // Obtener miembro_id del admin para auditoría
    const { data: miembro } = await admin
      .from('miembros')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('empresa_id', empresaId)
      .single()

    // Obtener registro original para auditoría
    const { data: original } = await admin
      .from('asistencias')
      .select('*')
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .single()

    if (!original) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })

    // Registrar cambios en auditoría
    const cambios = Object.entries(campos).filter(([campo, valor]) => {
      return original[campo as keyof typeof original] !== valor
    })

    if (cambios.length > 0 && miembro?.id) {
      const auditorias = cambios.map(([campo, valor]) => ({
        empresa_id: empresaId,
        asistencia_id: id,
        editado_por: miembro.id,
        campo_modificado: campo,
        valor_anterior: String(original[campo as keyof typeof original] ?? ''),
        valor_nuevo: String(valor ?? ''),
      }))

      await admin.from('auditoria_asistencias').insert(auditorias)
    }

    const { data, error } = await admin
      .from('asistencias')
      .update({ ...campos, editado_por: miembro?.id, actualizado_en: new Date().toISOString() })
      .eq('id', id)
      .eq('empresa_id', empresaId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * DELETE /api/asistencias — Eliminar fichaje (admin).
 * Body: { id: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const body = await request.json()
    const admin = crearClienteAdmin()

    const { error } = await admin
      .from('asistencias')
      .delete()
      .eq('id', body.id)
      .eq('empresa_id', empresaId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
