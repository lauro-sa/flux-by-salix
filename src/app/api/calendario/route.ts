import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteServidor } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { crearNotificacion } from '@/lib/notificaciones'
import { obtenerYVerificarPermiso, verificarVisibilidad } from '@/lib/permisos-servidor'
import { COLOR_ETIQUETA_DEFECTO, COLOR_MARCA_DEFECTO } from '@/lib/colores_entidad'

/**
 * GET /api/calendario — Listar eventos del calendario en un rango de fechas.
 * Params: desde, hasta (obligatorios), usuario_id, tipo, vista (todos|mios|equipo)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Verificar permisos de visibilidad (1 sola query)
    const visibilidad = await verificarVisibilidad(user.id, empresaId, 'calendario')
    if (!visibilidad) return NextResponse.json({ error: 'Sin permiso para ver calendario' }, { status: 403 })
    const soloPropio = visibilidad.soloPropio

    const params = request.nextUrl.searchParams
    const desde = params.get('desde')
    const hasta = params.get('hasta')

    if (!desde || !hasta) {
      return NextResponse.json({ error: 'Parámetros desde y hasta son obligatorios' }, { status: 400 })
    }

    const usuarioId = params.get('usuario_id')
    const tipo = params.get('tipo')
    const vista = params.get('vista') || 'todos'

    const admin = crearClienteAdmin()

    // Eventos que se solapan con el rango: fecha_inicio < hasta AND fecha_fin > desde
    let query = admin
      .from('eventos_calendario')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('en_papelera', false)
      .lt('fecha_inicio', hasta)
      .gt('fecha_fin', desde)

    // Permisos: si solo propio, filtrar por creador o asignado
    if (soloPropio) {
      query = query.or(`creado_por.eq.${user.id},asignado_ids.cs.{${user.id}}`)
    }

    // Vista
    if (vista === 'mios') {
      query = query.or(`creado_por.eq.${user.id},asignado_ids.cs.{${user.id}}`)
    }

    // Filtro por usuario específico
    if (usuarioId) {
      query = query.or(`creado_por.eq.${usuarioId},asignado_ids.cs.{${usuarioId}}`)
    }

    // Filtro por tipo
    if (tipo) {
      const tipos = tipo.split(',')
      query = tipos.length === 1 ? query.eq('tipo_clave', tipos[0]) : query.in('tipo_clave', tipos)
    }

    query = query.order('fecha_inicio', { ascending: true })

    const { data, error } = await query

    if (error) {
      console.error('Error al listar eventos:', error)
      return NextResponse.json({ error: 'Error al listar eventos' }, { status: 500 })
    }

    // Aplicar visibilidad: ocultar detalles de eventos privados/ocupado de otros
    const eventos = (data || []).map(evento => {
      const esPropio = evento.creado_por === user.id ||
        (evento.asignado_ids as string[])?.includes(user.id)

      if (esPropio) return evento

      if (evento.visibilidad === 'privada') return null

      if (evento.visibilidad === 'ocupado') {
        return {
          id: evento.id,
          empresa_id: evento.empresa_id,
          titulo: 'Ocupado',
          descripcion: null,
          ubicacion: null,
          tipo_id: null,
          tipo_clave: 'bloqueo',
          color: COLOR_ETIQUETA_DEFECTO,
          fecha_inicio: evento.fecha_inicio,
          fecha_fin: evento.fecha_fin,
          todo_el_dia: evento.todo_el_dia,
          visibilidad: evento.visibilidad,
          asignados: evento.asignados,
          asignado_ids: evento.asignado_ids,
          creado_por: evento.creado_por,
          creado_por_nombre: evento.creado_por_nombre,
          estado: evento.estado,
          vinculos: [],
          vinculo_ids: [],
          _es_ocupado: true,
        }
      }

      return evento
    }).filter(Boolean)

    return NextResponse.json({ eventos })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/calendario — Crear un evento de calendario.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await crearClienteServidor()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const { permitido } = await obtenerYVerificarPermiso(user.id, empresaId, 'calendario', 'crear')
    if (!permitido) return NextResponse.json({ error: 'Sin permiso para crear eventos' }, { status: 403 })

    const admin = crearClienteAdmin()
    const body = await request.json()

    if (!body.titulo?.trim()) {
      return NextResponse.json({ error: 'El título es obligatorio' }, { status: 400 })
    }
    if (!body.fecha_inicio || !body.fecha_fin) {
      return NextResponse.json({ error: 'Las fechas de inicio y fin son obligatorias' }, { status: 400 })
    }

    // Obtener tipo si se proporcionó
    let tipoClave: string | null = null
    if (body.tipo_id) {
      const { data: tipo } = await admin
        .from('tipos_evento_calendario')
        .select('clave, etiqueta, color')
        .eq('id', body.tipo_id)
        .single()

      if (tipo) {
        tipoClave = tipo.clave
        if (!body.color) body.color = tipo.color
      }
    }

    // Obtener nombre del creador
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()

    const nombreCreador = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : 'Usuario'

    // Asignados
    const asignados = Array.isArray(body.asignados) ? body.asignados : []
    const asignadoIds = asignados.map((a: { id: string }) => a.id)

    // Vínculos
    const vinculos = Array.isArray(body.vinculos) ? body.vinculos : []
    const vinculoIds = vinculos.map((v: { id: string }) => v.id)

    const { data, error } = await admin
      .from('eventos_calendario')
      .insert({
        empresa_id: empresaId,
        titulo: body.titulo.trim(),
        descripcion: body.descripcion || null,
        ubicacion: body.ubicacion || null,
        tipo_id: body.tipo_id || null,
        tipo_clave: tipoClave,
        color: body.color || null,
        fecha_inicio: body.fecha_inicio,
        fecha_fin: body.fecha_fin,
        todo_el_dia: body.todo_el_dia ?? false,
        recurrencia: body.recurrencia || null,
        visibilidad: body.visibilidad || 'publica',
        asignados,
        asignado_ids: asignadoIds,
        vinculos,
        vinculo_ids: vinculoIds,
        actividad_id: body.actividad_id || null,
        estado: body.estado || 'confirmado',
        notas: body.notas || null,
        recordatorio_minutos: body.recordatorio_minutos ?? 0,
        creado_por: user.id,
        creado_por_nombre: nombreCreador,
      })
      .select()
      .single()

    if (error) {
      console.error('Error al crear evento:', error)
      return NextResponse.json({ error: 'Error al crear evento' }, { status: 500 })
    }

    // Notificar a los asignados (excepto al creador)
    for (const asignado of asignados) {
      if (asignado.id !== user.id) {
        crearNotificacion({
          empresaId,
          usuarioId: asignado.id,
          tipo: 'evento_asignado',
          titulo: `📅 ${nombreCreador} te agendó`,
          cuerpo: `${body.titulo.trim()}`,
          icono: 'Calendar',
          color: body.color || COLOR_MARCA_DEFECTO,
          url: '/calendario',
          referenciaTipo: 'evento_calendario',
          referenciaId: data.id,
        })
      }
    }

    // Crear recordatorios programados si tiene recordatorio_minutos > 0
    const recordatorioMin = body.recordatorio_minutos ?? 0
    if (recordatorioMin > 0) {
      const fechaEvento = new Date(body.fecha_inicio)
      const programadoPara = new Date(fechaEvento.getTime() - recordatorioMin * 60000)

      // Crear recordatorio para el creador y para cada asignado
      const usuarios = [
        { id: user.id, nombre: nombreCreador },
        ...asignados.filter((a: { id: string }) => a.id !== user.id),
      ]

      const recordatorios = usuarios.map((u: { id: string; nombre: string }) => ({
        empresa_id: empresaId,
        evento_id: data.id,
        usuario_id: u.id,
        usuario_nombre: u.nombre,
        programado_para: programadoPara.toISOString(),
      }))

      if (recordatorios.length > 0) {
        await admin.from('recordatorios_calendario').insert(recordatorios)
      }
    }

    return NextResponse.json(data, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
