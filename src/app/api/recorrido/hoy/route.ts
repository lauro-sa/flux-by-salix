import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { obtenerInicioFinDiaEnZona, obtenerComponentesFecha } from '@/lib/formato-fecha'

/**
 * GET /api/recorrido/hoy — Obtener o crear el recorrido de un día del usuario.
 * Acepta ?fecha=YYYY-MM-DD para ver/organizar otros días (ej: mañana).
 * Si no se pasa fecha, usa hoy.
 * Si no existe recorrido, lo crea automáticamente con las visitas programadas.
 * Se usa en: PaginaRecorrido (mobile).
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    const admin = crearClienteAdmin()

    // Cargar zona horaria de la empresa — para que "hoy" coincida con el día local del usuario.
    // Sin esto, después de las 21hs AR devolvíamos el recorrido de mañana.
    const { data: empresaTz } = await admin.from('empresas').select('zona_horaria').eq('id', empresaId).maybeSingle()
    const zonaEmpresa = (empresaTz?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'

    // Fecha: ?fecha=YYYY-MM-DD o hoy por defecto (en la zona de la empresa)
    const { searchParams } = new URL(request.url)
    const fechaParam = searchParams.get('fecha')
    const hoyComp = obtenerComponentesFecha(new Date(), zonaEmpresa)
    const hoyLocal = `${hoyComp.anio}-${String(hoyComp.mes).padStart(2, '0')}-${String(hoyComp.dia).padStart(2, '0')}`
    const hoy = fechaParam && /^\d{4}-\d{2}-\d{2}$/.test(fechaParam) ? fechaParam : hoyLocal

    // Buscar recorrido existente (excluir borradores — solo el coordinador los ve)
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
      // Recorrido existe — traer paradas con datos de visita
      const { data: paradas } = await admin
        .from('recorrido_paradas')
        .select('*, visita:visitas(*)')
        .eq('recorrido_id', recorrido.id)
        .order('orden', { ascending: true })

      // ── Sincronización bidireccional ──
      // 1. Eliminar paradas cuya visita fue enviada a papelera o reasignada a otro usuario
      // Las canceladas se mantienen como parte del historial del recorrido
      const paradasAEliminar = (paradas || []).filter(p =>
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

      // 2. Buscar visitas activas del día que no tienen parada en este recorrido
      // Usar rango en la zona de la empresa para que "23hs AR" caiga en el día correcto.
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

      const paradasActivas = (paradas || []).filter(p => !paradasAEliminar.some(pe => pe.id === p.id))
      const idsEnParadas = new Set(paradasActivas.map(p => p.visita_id))
      const visitasFaltantes = (visitasDelDia || []).filter(v => !idsEnParadas.has(v.id))

      if (visitasFaltantes.length > 0) {
        const ordenMax = paradasActivas.reduce((max, p) => Math.max(max, p.orden || 0), 0)
        const nuevasParadas = visitasFaltantes.map((v, i) => ({
          recorrido_id: recorrido.id,
          visita_id: v.id,
          orden: ordenMax + i + 1,
        }))
        await admin.from('recorrido_paradas').insert(nuevasParadas)
      }

      // Si hubo cambios, re-obtener paradas y actualizar total
      if (paradasAEliminar.length > 0 || visitasFaltantes.length > 0) {
        const { data: paradasActualizadas } = await admin
          .from('recorrido_paradas')
          .select('*, visita:visitas(*)')
          .eq('recorrido_id', recorrido.id)
          .order('orden', { ascending: true })

        const nuevoTotal = paradasActualizadas?.length || 0
        await admin
          .from('recorridos')
          .update({ total_visitas: nuevoTotal })
          .eq('id', recorrido.id)

        return NextResponse.json({
          recorrido: { ...recorrido, total_visitas: nuevoTotal },
          paradas: paradasActualizadas || [],
        })
      }

      return NextResponse.json({ recorrido, paradas: paradas || [] })
    }

    // Verificar si existe un borrador (el coordinador aún no publicó)
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
      // Existe borrador — el coordinador aún está organizando, no mostrar al visitador
      return NextResponse.json({ recorrido: null, paradas: [] })
    }

    // No existe recorrido — buscar visitas del día para crearlo (rango en zona de empresa)
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

    // Obtener nombre del usuario para el recorrido
    const { data: perfil } = await admin
      .from('perfiles')
      .select('nombre, apellido')
      .eq('id', user.id)
      .single()

    const nombreCompleto = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : (user.email || '')

    // Crear recorrido
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

    // Crear paradas (una por visita, orden secuencial)
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

    // Retornar recorrido + paradas con datos de visita
    const { data: paradasConVisita } = await admin
      .from('recorrido_paradas')
      .select('*, visita:visitas(*)')
      .eq('recorrido_id', nuevoRecorrido.id)
      .order('orden', { ascending: true })

    return NextResponse.json({ recorrido: nuevoRecorrido, paradas: paradasConVisita || [] })
  } catch (err) {
    console.error('Error en GET /api/recorrido/hoy:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
