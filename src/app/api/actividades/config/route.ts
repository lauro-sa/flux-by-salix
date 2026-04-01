import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerYVerificarPermiso } from '@/lib/permisos-servidor'

/**
 * GET /api/actividades/config — Obtener configuración completa de actividades.
 * Devuelve tipos, estados y config general de la empresa.
 */
export async function GET() {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de lectura en config de actividades
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_actividades', 'ver')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos para ver configuración de actividades' }, { status: 403 })

    const admin = crearClienteAdmin()

    const [tiposRes, estadosRes, configRes] = await Promise.all([
      admin.from('tipos_actividad').select('*').eq('empresa_id', empresaId).order('orden'),
      admin.from('estados_actividad').select('*').eq('empresa_id', empresaId).order('orden'),
      admin.from('config_actividades').select('*').eq('empresa_id', empresaId).single(),
    ])

    return NextResponse.json({
      tipos: tiposRes.data || [],
      estados: estadosRes.data || [],
      config: configRes.data || null,
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * PUT /api/actividades/config — Actualizar configuración de actividades.
 * Acepta operaciones sobre tipos, estados o config general.
 * Body: { accion, datos }
 */
export async function PUT(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permiso de edición en config de actividades
    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'config_actividades', 'editar')
    if (!permitido) return NextResponse.json({ error: 'Sin permisos para editar configuración de actividades' }, { status: 403 })

    const admin = crearClienteAdmin()

    const body = await request.json()
    const { accion, datos } = body

    switch (accion) {
      // ── Tipos de actividad ──
      case 'crear_tipo': {
        if (!datos.clave?.trim() || !datos.etiqueta?.trim()) {
          return NextResponse.json({ error: 'clave y etiqueta son obligatorios' }, { status: 400 })
        }
        // Obtener max orden
        const { data: maxOrden } = await admin
          .from('tipos_actividad')
          .select('orden')
          .eq('empresa_id', empresaId)
          .order('orden', { ascending: false })
          .limit(1)
          .single()

        const { data, error } = await admin
          .from('tipos_actividad')
          .insert({
            empresa_id: empresaId,
            clave: datos.clave.toLowerCase().trim().replace(/\s+/g, '_'),
            etiqueta: datos.etiqueta.trim(),
            icono: datos.icono || 'Activity',
            color: datos.color || '#5b5bd6',
            modulos_disponibles: datos.modulos_disponibles || ['contactos'],
            dias_vencimiento: datos.dias_vencimiento ?? 1,
            campo_fecha: datos.campo_fecha ?? true,
            campo_descripcion: datos.campo_descripcion ?? true,
            campo_responsable: datos.campo_responsable ?? true,
            campo_prioridad: datos.campo_prioridad ?? false,
            campo_checklist: datos.campo_checklist ?? false,
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
        if (datos.modulos_disponibles !== undefined) campos.modulos_disponibles = datos.modulos_disponibles
        if (datos.dias_vencimiento !== undefined) campos.dias_vencimiento = datos.dias_vencimiento
        if (datos.campo_fecha !== undefined) campos.campo_fecha = datos.campo_fecha
        if (datos.campo_descripcion !== undefined) campos.campo_descripcion = datos.campo_descripcion
        if (datos.campo_responsable !== undefined) campos.campo_responsable = datos.campo_responsable
        if (datos.campo_prioridad !== undefined) campos.campo_prioridad = datos.campo_prioridad
        if (datos.campo_checklist !== undefined) campos.campo_checklist = datos.campo_checklist
        if (datos.activo !== undefined) campos.activo = datos.activo

        const { data, error } = await admin
          .from('tipos_actividad')
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
          .from('tipos_actividad')
          .delete()
          .eq('id', datos.id)
          .eq('empresa_id', empresaId)
          .eq('es_predefinido', false) // No se pueden eliminar predefinidos

        if (error) return NextResponse.json({ error: 'Error al eliminar tipo' }, { status: 500 })
        return NextResponse.json({ ok: true })
      }

      case 'reordenar_tipos': {
        if (!Array.isArray(datos.orden)) return NextResponse.json({ error: 'orden debe ser un array' }, { status: 400 })
        const promesas = datos.orden.map((id: string, i: number) =>
          admin.from('tipos_actividad').update({ orden: i }).eq('id', id).eq('empresa_id', empresaId)
        )
        await Promise.all(promesas)
        return NextResponse.json({ ok: true })
      }

      // ── Estados de actividad ──
      case 'crear_estado': {
        if (!datos.clave?.trim() || !datos.etiqueta?.trim()) {
          return NextResponse.json({ error: 'clave y etiqueta son obligatorios' }, { status: 400 })
        }
        const { data: maxOrdenE } = await admin
          .from('estados_actividad')
          .select('orden')
          .eq('empresa_id', empresaId)
          .order('orden', { ascending: false })
          .limit(1)
          .single()

        const { data, error } = await admin
          .from('estados_actividad')
          .insert({
            empresa_id: empresaId,
            clave: datos.clave.toLowerCase().trim().replace(/\s+/g, '_'),
            etiqueta: datos.etiqueta.trim(),
            icono: datos.icono || 'Circle',
            color: datos.color || '#6b7280',
            grupo: datos.grupo || 'activo',
            orden: (maxOrdenE?.orden ?? -1) + 1,
            es_predefinido: false,
          })
          .select()
          .single()

        if (error) {
          if (error.code === '23505') return NextResponse.json({ error: 'Ya existe un estado con esa clave' }, { status: 409 })
          return NextResponse.json({ error: 'Error al crear estado' }, { status: 500 })
        }
        return NextResponse.json(data, { status: 201 })
      }

      case 'editar_estado': {
        if (!datos.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
        const camposE: Record<string, unknown> = {}
        if (datos.etiqueta !== undefined) camposE.etiqueta = datos.etiqueta.trim()
        if (datos.icono !== undefined) camposE.icono = datos.icono
        if (datos.color !== undefined) camposE.color = datos.color
        if (datos.grupo !== undefined) camposE.grupo = datos.grupo
        if (datos.activo !== undefined) camposE.activo = datos.activo

        const { data, error } = await admin
          .from('estados_actividad')
          .update(camposE)
          .eq('id', datos.id)
          .eq('empresa_id', empresaId)
          .select()
          .single()

        if (error) return NextResponse.json({ error: 'Error al editar estado' }, { status: 500 })
        return NextResponse.json(data)
      }

      case 'eliminar_estado': {
        if (!datos.id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })
        const { error } = await admin
          .from('estados_actividad')
          .delete()
          .eq('id', datos.id)
          .eq('empresa_id', empresaId)
          .eq('es_predefinido', false)

        if (error) return NextResponse.json({ error: 'Error al eliminar estado' }, { status: 500 })
        return NextResponse.json({ ok: true })
      }

      case 'reordenar_estados': {
        if (!Array.isArray(datos.orden)) return NextResponse.json({ error: 'orden debe ser un array' }, { status: 400 })
        const promesas = datos.orden.map((id: string, i: number) =>
          admin.from('estados_actividad').update({ orden: i }).eq('id', id).eq('empresa_id', empresaId)
        )
        await Promise.all(promesas)
        return NextResponse.json({ ok: true })
      }

      // ── Configuración general (posposición, horario laboral) ──
      case 'actualizar_config': {
        const campos: Record<string, unknown> = { actualizado_en: new Date().toISOString() }
        if (datos.presets_posposicion !== undefined) campos.presets_posposicion = datos.presets_posposicion
        if (datos.respetar_dias_laborales !== undefined) campos.respetar_dias_laborales = datos.respetar_dias_laborales

        const { data, error } = await admin
          .from('config_actividades')
          .update(campos)
          .eq('empresa_id', empresaId)
          .select()
          .single()

        if (error) return NextResponse.json({ error: 'Error al actualizar config' }, { status: 500 })
        return NextResponse.json(data)
      }

      // ── Restablecer a valores de fábrica ──
      case 'restablecer': {
        // Eliminar todos los tipos y estados no predefinidos
        await Promise.all([
          admin.from('tipos_actividad').delete().eq('empresa_id', empresaId).eq('es_predefinido', false),
          admin.from('estados_actividad').delete().eq('empresa_id', empresaId).eq('es_predefinido', false),
        ])
        // Restaurar predefinidos a valores default
        await Promise.all([
          admin.from('tipos_actividad').update({ activo: true }).eq('empresa_id', empresaId).eq('es_predefinido', true),
          admin.from('estados_actividad').update({ activo: true }).eq('empresa_id', empresaId).eq('es_predefinido', true),
        ])

        // Devolver config actualizada
        const [t, e] = await Promise.all([
          admin.from('tipos_actividad').select('*').eq('empresa_id', empresaId).order('orden'),
          admin.from('estados_actividad').select('*').eq('empresa_id', empresaId).order('orden'),
        ])

        return NextResponse.json({ tipos: t.data || [], estados: e.data || [] })
      }

      default:
        return NextResponse.json({ error: `Acción desconocida: ${accion}` }, { status: 400 })
    }
  } catch (err) {
    console.error('Error en config actividades:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
