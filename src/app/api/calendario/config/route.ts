import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'
import { COLOR_MARCA_DEFECTO } from '@/lib/colores_entidad'

/**
 * GET /api/calendario/config — Obtener configuración del calendario.
 * Devuelve tipos de evento y config general de la empresa.
 */
export async function GET() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_calendario', 'ver')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos para ver configuración del calendario' }, { status: 403 })

    const admin = crearClienteAdmin()

    const [tiposRes, configRes] = await Promise.all([
      admin.from('tipos_evento_calendario').select('*').eq('empresa_id', empresaId).order('orden'),
      admin.from('config_calendario').select('*').eq('empresa_id', empresaId).single(),
    ])

    return NextResponse.json({
      tipos: tiposRes.data || [],
      config: configRes.data || null,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PUT /api/calendario/config — Actualizar configuración del calendario.
 * Body: { accion, datos }
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_calendario', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos para editar configuración del calendario' }, { status: 403 })

    const admin = crearClienteAdmin()
    const body = await request.json()
    const { accion, datos } = body

    switch (accion) {
      // ── Tipos de evento ──
      case 'crear_tipo': {
        if (!datos.clave?.trim() || !datos.etiqueta?.trim()) {
          return NextResponse.json({ error: 'clave y etiqueta son obligatorios' }, { status: 400 })
        }
        const { data: maxOrden } = await admin
          .from('tipos_evento_calendario')
          .select('orden')
          .eq('empresa_id', empresaId)
          .order('orden', { ascending: false })
          .limit(1)
          .single()

        const { data, error } = await admin
          .from('tipos_evento_calendario')
          .insert({
            empresa_id: empresaId,
            clave: datos.clave.toLowerCase().trim().replace(/\s+/g, '_'),
            etiqueta: datos.etiqueta.trim(),
            icono: datos.icono || 'Calendar',
            color: datos.color || COLOR_MARCA_DEFECTO,
            duracion_default: datos.duracion_default ?? 60,
            todo_el_dia_default: datos.todo_el_dia_default ?? false,
            orden: (maxOrden?.orden ?? -1) + 1,
            es_predefinido: false,
          })
          .select()
          .single()

        if (error) {
          if (error.code === '23505') return NextResponse.json({ error: 'Ya existe un tipo con esa clave' }, { status: 409 })
          return NextResponse.json({ error: 'Error al crear tipo' }, { status: 500 })
        }
        return NextResponse.json(data, { status: 201 })
      }

      case 'editar_tipo': {
        if (!datos.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
        const campos: Record<string, unknown> = {}
        if (datos.etiqueta !== undefined) campos.etiqueta = datos.etiqueta.trim()
        if (datos.icono !== undefined) campos.icono = datos.icono
        if (datos.color !== undefined) campos.color = datos.color
        if (datos.duracion_default !== undefined) campos.duracion_default = datos.duracion_default
        if (datos.todo_el_dia_default !== undefined) campos.todo_el_dia_default = datos.todo_el_dia_default
        if (datos.activo !== undefined) campos.activo = datos.activo

        const { data, error } = await admin
          .from('tipos_evento_calendario')
          .update(campos)
          .eq('id', datos.id)
          .eq('empresa_id', empresaId)
          .select()
          .single()

        if (error) return NextResponse.json({ error: 'Error al editar tipo' }, { status: 500 })
        return NextResponse.json(data)
      }

      case 'eliminar_tipo': {
        if (!datos.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
        const { error } = await admin
          .from('tipos_evento_calendario')
          .delete()
          .eq('id', datos.id)
          .eq('empresa_id', empresaId)
          .eq('es_predefinido', false)

        if (error) return NextResponse.json({ error: 'Error al eliminar tipo' }, { status: 500 })
        return NextResponse.json({ ok: true })
      }

      case 'reordenar_tipos': {
        if (!Array.isArray(datos.orden)) return NextResponse.json({ error: 'orden debe ser un array' }, { status: 400 })
        const promesas = datos.orden.map((id: string, i: number) =>
          admin.from('tipos_evento_calendario').update({ orden: i }).eq('id', id).eq('empresa_id', empresaId)
        )
        await Promise.all(promesas)
        return NextResponse.json({ ok: true })
      }

      // ── Configuración general ──
      case 'actualizar_config': {
        const campos: Record<string, unknown> = { actualizado_en: new Date().toISOString() }
        if (datos.hora_inicio_laboral !== undefined) campos.hora_inicio_laboral = datos.hora_inicio_laboral
        if (datos.hora_fin_laboral !== undefined) campos.hora_fin_laboral = datos.hora_fin_laboral
        if (datos.dias_laborales !== undefined) campos.dias_laborales = datos.dias_laborales
        if (datos.intervalo_slot !== undefined) campos.intervalo_slot = datos.intervalo_slot
        if (datos.vista_default !== undefined) campos.vista_default = datos.vista_default
        if (datos.mostrar_fines_semana !== undefined) campos.mostrar_fines_semana = datos.mostrar_fines_semana

        const { data, error } = await admin
          .from('config_calendario')
          .upsert({ empresa_id: empresaId, ...campos })
          .select()
          .single()

        if (error) return NextResponse.json({ error: 'Error al actualizar config' }, { status: 500 })
        return NextResponse.json(data)
      }

      // ── Restablecer ──
      case 'restablecer': {
        await Promise.all([
          admin.from('tipos_evento_calendario').delete().eq('empresa_id', empresaId).eq('es_predefinido', false),
          admin.from('tipos_evento_calendario').update({ activo: true }).eq('empresa_id', empresaId).eq('es_predefinido', true),
        ])

        const t = await admin.from('tipos_evento_calendario').select('*').eq('empresa_id', empresaId).order('orden')
        return NextResponse.json({ tipos: t.data || [] })
      }

      default:
        return NextResponse.json({ error: `Acción desconocida: ${accion}` }, { status: 400 })
    }
  } catch (err) {
    console.error('Error en config calendario:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
