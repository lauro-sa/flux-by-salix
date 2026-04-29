import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { recalcularContadoresRecorrido } from '@/lib/recorrido-contadores'

/**
 * GET /api/recorrido/por-visitador — Obtener o crear el recorrido de un visitador para una fecha.
 * Acepta ?usuario_id=UUID&fecha=YYYY-MM-DD
 * Usado por coordinadores desde PanelPlanificacion > ModalRecorrido.
 * Requiere permiso recorrido.ver_todos (coordinador).
 *
 * Sincronización bidireccional SOLO sobre paradas tipo 'visita':
 *   - Las paradas genéricas (tipo='parada') agregadas manualmente por el visitador o el
 *     coordinador no se tocan en la sincronización automática.
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('recorrido', 'ver_todos')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()
    const { searchParams } = new URL(request.url)
    const usuarioId = searchParams.get('usuario_id')
    const fechaParam = searchParams.get('fecha')

    if (!usuarioId || !fechaParam || !/^\d{4}-\d{2}-\d{2}$/.test(fechaParam)) {
      return NextResponse.json({ error: 'Parámetros requeridos: usuario_id y fecha (YYYY-MM-DD)' }, { status: 400 })
    }

    // Buscar recorrido existente para ese visitador y fecha
    const { data: recorrido } = await admin
      .from('recorridos')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('asignado_a', usuarioId)
      .eq('fecha', fechaParam)
      .eq('en_papelera', false)
      .single()

    if (recorrido) {
      // Obtener paradas existentes
      const { data: paradas } = await admin
        .from('recorrido_paradas')
        .select('*, visita:visitas(*)')
        .eq('recorrido_id', recorrido.id)
        .order('orden', { ascending: true })

      // ── Sincronización bidireccional (solo paradas tipo 'visita') ──
      // Las paradas genéricas no se tocan: son entradas que el humano agregó explícitamente.
      const paradasTipoVisita = (paradas || []).filter(p => p.tipo === 'visita')

      // 1. Eliminar paradas cuya visita fue enviada a papelera o reasignada a otro
      //    Las visitas canceladas se mantienen como parte del historial.
      const paradasAEliminar = paradasTipoVisita.filter(p =>
        !p.visita ||
        p.visita.en_papelera === true ||
        p.visita.asignado_a !== usuarioId
      )

      if (paradasAEliminar.length > 0) {
        await admin
          .from('recorrido_paradas')
          .delete()
          .in('id', paradasAEliminar.map(p => p.id))
      }

      // 2. Buscar visitas activas del día sin parada correspondiente
      const inicioDelDia = `${fechaParam}T00:00:00.000Z`
      const finDelDia = `${fechaParam}T23:59:59.999Z`

      const { data: visitasDelDia } = await admin
        .from('visitas')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('asignado_a', usuarioId)
        .gte('fecha_programada', inicioDelDia)
        .lte('fecha_programada', finDelDia)
        .eq('en_papelera', false)
        .neq('estado', 'cancelada')

      const paradasActivasVisita = paradasTipoVisita.filter(p => !paradasAEliminar.some(pe => pe.id === p.id))
      const idsEnParadas = new Set(paradasActivasVisita.map(p => p.visita_id))
      const visitasFaltantes = (visitasDelDia || []).filter(v => !idsEnParadas.has(v.id))

      if (visitasFaltantes.length > 0) {
        // Orden máximo global (incluye paradas genéricas) para que las nuevas se agreguen al final
        const ordenMax = (paradas || []).reduce((max, p) => Math.max(max, p.orden || 0), 0)
        const nuevasParadas = visitasFaltantes.map((v, i) => ({
          recorrido_id: recorrido.id,
          tipo: 'visita',
          visita_id: v.id,
          orden: ordenMax + i + 1,
          creado_por: user.id,
        }))
        await admin.from('recorrido_paradas').insert(nuevasParadas)
      }

      // Si hubo cambios, recalcular contadores y re-obtener
      if (paradasAEliminar.length > 0 || visitasFaltantes.length > 0) {
        await recalcularContadoresRecorrido(admin, recorrido.id)

        const [{ data: paradasActualizadas }, { data: recorridoActualizado }] = await Promise.all([
          admin
            .from('recorrido_paradas')
            .select('*, visita:visitas(*)')
            .eq('recorrido_id', recorrido.id)
            .order('orden', { ascending: true }),
          admin
            .from('recorridos')
            .select('*')
            .eq('id', recorrido.id)
            .single(),
        ])

        return NextResponse.json({
          recorrido: recorridoActualizado || recorrido,
          paradas: paradasActualizadas || [],
        })
      }

      return NextResponse.json({ recorrido, paradas: paradas || [] })
    }

    // No existe — buscar visitas del día para ese visitador y crear el recorrido
    const inicioDelDia = `${fechaParam}T00:00:00.000Z`
    const finDelDia = `${fechaParam}T23:59:59.999Z`

    const { data: visitasDelDia } = await admin
      .from('visitas')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('asignado_a', usuarioId)
      .gte('fecha_programada', inicioDelDia)
      .lte('fecha_programada', finDelDia)
      .eq('en_papelera', false)
      .neq('estado', 'cancelada')
      .order('fecha_programada', { ascending: true })

    if (!visitasDelDia || visitasDelDia.length === 0) {
      return NextResponse.json({ recorrido: null, paradas: [] })
    }

    // Obtener nombre del visitador y sus permisos default del recorrido
    const [{ data: perfil }, { data: miembro }] = await Promise.all([
      admin.from('perfiles').select('nombre, apellido').eq('id', usuarioId).single(),
      admin.from('miembros')
        .select('permisos_recorrido_default')
        .eq('empresa_id', empresaId)
        .eq('usuario_id', usuarioId)
        .maybeSingle(),
    ])

    const nombreCompleto = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : ''
    // Heredar los permisos default del visitador como config inicial del recorrido.
    // Si el miembro no tiene defaults seteados, queda {} y el frontend usa los del sistema.
    const configInicial = miembro?.permisos_recorrido_default || {}

    const { data: nuevoRecorrido, error: errorRecorrido } = await admin
      .from('recorridos')
      .insert({
        empresa_id: empresaId,
        asignado_a: usuarioId,
        asignado_nombre: nombreCompleto,
        fecha: fechaParam,
        estado: 'borrador',
        total_visitas: visitasDelDia.length,
        visitas_completadas: 0,
        config: configInicial,
        creado_por: user.id,
      })
      .select()
      .single()

    if (errorRecorrido || !nuevoRecorrido) {
      return NextResponse.json({ error: 'Error al crear recorrido', detalle: errorRecorrido?.message }, { status: 500 })
    }

    const paradasInsert = visitasDelDia.map((visita, indice) => ({
      recorrido_id: nuevoRecorrido.id,
      tipo: 'visita',
      visita_id: visita.id,
      orden: indice + 1,
      creado_por: user.id,
    }))

    const { error: errorParadas } = await admin
      .from('recorrido_paradas')
      .insert(paradasInsert)

    if (errorParadas) {
      return NextResponse.json({ error: 'Error al crear paradas', detalle: errorParadas.message }, { status: 500 })
    }

    await recalcularContadoresRecorrido(admin, nuevoRecorrido.id)

    const [{ data: paradasConVisita }, { data: recorridoActualizado }] = await Promise.all([
      admin
        .from('recorrido_paradas')
        .select('*, visita:visitas(*)')
        .eq('recorrido_id', nuevoRecorrido.id)
        .order('orden', { ascending: true }),
      admin
        .from('recorridos')
        .select('*')
        .eq('id', nuevoRecorrido.id)
        .single(),
    ])

    return NextResponse.json({
      recorrido: recorridoActualizado || nuevoRecorrido,
      paradas: paradasConVisita || [],
    })
  } catch (err) {
    console.error('Error en GET /api/recorrido/por-visitador:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
