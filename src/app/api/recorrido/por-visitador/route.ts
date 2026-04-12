import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'

/**
 * GET /api/recorrido/por-visitador — Obtener o crear el recorrido de un visitador para una fecha.
 * Acepta ?usuario_id=UUID&fecha=YYYY-MM-DD
 * Usado por coordinadores desde PanelPlanificacion > ModalRecorrido.
 * Requiere permiso visitas.asignar (coordinador).
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

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
      .single()

    if (recorrido) {
      const { data: paradas } = await admin
        .from('recorrido_paradas')
        .select('*, visita:visitas(*)')
        .eq('recorrido_id', recorrido.id)
        .order('orden', { ascending: true })

      return NextResponse.json({ recorrido, paradas: paradas || [] })
    }

    // No existe — buscar visitas del día para ese visitador y crearlo
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

    // Obtener nombre del visitador
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', usuarioId)
      .single()

    const nombreCompleto = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : ''

    // Crear recorrido como borrador — el visitador no lo ve hasta que el coordinador lo publique
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
        creado_por: user.id,
      })
      .select()
      .single()

    if (errorRecorrido || !nuevoRecorrido) {
      return NextResponse.json({ error: 'Error al crear recorrido', detalle: errorRecorrido?.message }, { status: 500 })
    }

    // Crear paradas
    const paradasInsert = visitasDelDia.map((visita, indice) => ({
      recorrido_id: nuevoRecorrido.id,
      visita_id: visita.id,
      orden: indice + 1,
    }))

    const { error: errorParadas } = await admin
      .from('recorrido_paradas')
      .insert(paradasInsert)

    if (errorParadas) {
      return NextResponse.json({ error: 'Error al crear paradas', detalle: errorParadas.message }, { status: 500 })
    }

    // Retornar con datos de visita
    const { data: paradasConVisita } = await admin
      .from('recorrido_paradas')
      .select('*, visita:visitas(*)')
      .eq('recorrido_id', nuevoRecorrido.id)
      .order('orden', { ascending: true })

    return NextResponse.json({ recorrido: nuevoRecorrido, paradas: paradasConVisita || [] })
  } catch (err) {
    console.error('Error en GET /api/recorrido/por-visitador:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
