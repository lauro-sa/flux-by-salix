import { NextResponse, type NextRequest } from 'next/server'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerInicioFinDiaEnZona, obtenerComponentesFecha } from '@/lib/formato-fecha'
import { recalcularContadoresRecorrido } from '@/lib/recorrido-contadores'

/**
 * GET /api/recorrido/hoy — Obtener o crear el recorrido de un día del usuario.
 * Acepta ?fecha=YYYY-MM-DD para ver/organizar otros días (ej: mañana).
 * Si no se pasa fecha, usa hoy.
 * Si no existe recorrido, lo crea automáticamente con las visitas programadas.
 * Se usa en: PaginaRecorrido (mobile).
 *
 * Sincronización bidireccional SOLO sobre paradas tipo 'visita':
 *   - Las paradas genéricas (tipo='parada') agregadas por el visitador o el coordinador
 *     no se tocan en la sincronización automática con la tabla `visitas`.
 */
export async function GET(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('recorrido', 'ver_propio')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

    const admin = crearClienteAdmin()

    // Cargar zona horaria de la empresa — para que "hoy" coincida con el día local del usuario.
    const { data: empresaTz } = await admin.from('empresas').select('zona_horaria').eq('id', empresaId).maybeSingle()
    const zonaEmpresa = (empresaTz?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'

    const { searchParams } = new URL(request.url)
    const fechaParam = searchParams.get('fecha')
    const hoyComp = obtenerComponentesFecha(new Date(), zonaEmpresa)
    const hoyLocal = `${hoyComp.anio}-${String(hoyComp.mes).padStart(2, '0')}-${String(hoyComp.dia).padStart(2, '0')}`
    const hoy = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam) ? fechaParam : hoyLocal

    // Buscar recorrido existente (excluir borradores)
    const { data: recorrido } = await admin
      .from('recorridos')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('asignado_a', user.id)
      .eq('fecha', hoy)
      .neq('estado', 'borrador')
      .eq('en_papelera', false)
      .single()

    if (recorrido) {
      const { data: paradas } = await admin
        .from('recorrido_paradas')
        .select('*, visita:visitas(*)')
        .eq('recorrido_id', recorrido.id)
        .order('orden', { ascending: true })

      // ── Sincronización bidireccional SOLO sobre paradas tipo 'visita' ──
      const paradasTipoVisita = (paradas || []).filter(p => p.tipo === 'visita')

      const paradasAEliminar = paradasTipoVisita.filter(p =>
        !p.visita ||
        p.visita.en_papelera === true ||
        p.visita.asignado_a !== user.id
      )

      if (paradasAEliminar.length > 0) {
        await admin
          .from('recorrido_paradas')
          .delete()
          .in('id', paradasAEliminar.map(p => p.id))
      }

      const rangoSync = obtenerInicioFinDiaEnZona(zonaEmpresa, new Date(`${hoy}T12:00:00Z`))
      const inicioSync = rangoSync.inicio
      const finSync = rangoSync.fin

      const { data: visitasDelDia } = await admin
        .from('visitas')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('asignado_a', user.id)
        .gte('fecha_programada', inicioSync)
        .lte('fecha_programada', finSync)
        .eq('en_papelera', false)
        .neq('estado', 'cancelada')

      const paradasActivasVisita = paradasTipoVisita.filter(p => !paradasAEliminar.some(pe => pe.id === p.id))
      const idsEnParadas = new Set(paradasActivasVisita.map(p => p.visita_id))
      const visitasFaltantes = (visitasDelDia || []).filter(v => !idsEnParadas.has(v.id))

      if (visitasFaltantes.length > 0) {
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

    // Si existe borrador, ocultarlo (el coordinador aún está organizando)
    const { data: borrador } = await admin
      .from('recorridos')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('asignado_a', user.id)
      .eq('fecha', hoy)
      .eq('estado', 'borrador')
      .eq('en_papelera', false)
      .single()

    if (borrador) {
      return NextResponse.json({ recorrido: null, paradas: [] })
    }

    // Sin recorrido — crearlo a partir de las visitas del día
    const rangoDia = obtenerInicioFinDiaEnZona(zonaEmpresa, new Date(`${hoy}T12:00:00Z`))
    const inicioDelDia = rangoDia.inicio
    const finDelDia = rangoDia.fin

    const { data: visitasDelDia } = await admin
      .from('visitas')
      .select('*')
      .eq('empresa_id', empresaId)
      .eq('asignado_a', user.id)
      .gte('fecha_programada', inicioDelDia)
      .lte('fecha_programada', finDelDia)
      .eq('en_papelera', false)
      .neq('estado', 'cancelada')
      .order('fecha_programada', { ascending: true })

    if (!visitasDelDia || visitasDelDia.length === 0) {
      return NextResponse.json({ recorrido: null, paradas: [] })
    }

    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido, correo')
      .eq('id', user.id)
      .single()

    const nombreCompleto = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : ''

    const { data: nuevoRecorrido, error: errorRecorrido } = await admin
      .from('recorridos')
      .insert({
        empresa_id: empresaId,
        asignado_a: user.id,
        asignado_nombre: nombreCompleto,
        fecha: hoy,
        estado: 'pendiente',
        total_visitas: visitasDelDia.length,
        visitas_completadas: 0,
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
    console.error('Error en GET /api/recorrido/hoy:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
