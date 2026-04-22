import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { requerirPermisoAPI, verificarVisibilidad } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { sanitizarBusqueda, normalizarAcentos } from '@/lib/validaciones'
import { resolverRangoFecha } from '@/lib/presets-fecha'
import { resolverNombresMiembros } from '@/lib/miembros/nombres'

/**
 * GET /api/asistencias — Listar asistencias con filtros.
 * Query params:
 *  - busqueda (accent-insensitive en nombre del miembro + notas)
 *  - desde, hasta (rango de fecha — mantiene compat)
 *  - preset_fecha (hoy, ayer, 7d, esta_semana, semana_pasada, este_mes, mes_pasado, este_anio)
 *  - miembro_id / miembros (CSV)
 *  - estado / estados (CSV)
 *  - tipos (CSV)
 *  - metodos (CSV)
 *  - turnos (CSV)
 *  - sectores (CSV) — filtra vía miembros.sector
 *  - con_tardanza (bool) — tipo='tardanza' o puntualidad_min > 0
 *  - sin_cerrar (bool) — estado IN activo/almuerzo/particular
 *  - creado_por (UUID — miembro.id del admin que cargó el fichaje manual)
 *  - pagina, limite / por_pagina
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await obtenerUsuarioRuta()
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const empresaId = user.app_metadata?.empresa_activa_id
    if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

    // Visibilidad granular: ver_todos da todo el equipo; ver_propio restringe
    // al miembro autenticado. Si no tiene ninguno → sin permiso.
    const vis = await verificarVisibilidad(user.id, empresaId, 'asistencias')
    if (!vis) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const busqueda = sanitizarBusqueda(params.get('busqueda') || '')
    const desde = params.get('desde')
    const hasta = params.get('hasta')
    const preset_fecha = params.get('preset_fecha')
    // Los filtros aceptan dos formatos por compatibilidad hacia atrás:
    //  - `miembro_id` / `estado`  (single, string) — consumidores viejos
    //  - `miembros`    / `estados` (CSV, multi)    — nuevos filtros avanzados
    // Ambos se unen después en la query final.
    const miembroIdSingle = params.get('miembro_id')
    const miembrosCsv = params.get('miembros')
    const estadoSingle = params.get('estado')
    const estadosCsv = params.get('estados')
    const tiposCsv = params.get('tipos')
    const metodosCsv = params.get('metodos')
    const turnosCsv = params.get('turnos')
    const sectoresCsv = params.get('sectores')
    const con_tardanza = params.get('con_tardanza') === 'true'
    const sin_cerrar = params.get('sin_cerrar') === 'true'
    const creado_por = params.get('creado_por')
    const pagina = parseInt(params.get('pagina') || '1')
    const limite = parseInt(params.get('limite') || params.get('por_pagina') || '50')

    const admin = crearClienteAdmin()

    // Precargar nombres de miembros (perfil con fallback a contacto equipo)
    const miembroNombres = await resolverNombresMiembros(admin, empresaId)

    // Resolver IDs de miembros a partir de búsqueda o filtros de sector
    const idsPorBusqueda = new Set<string>()
    if (busqueda.trim()) {
      const busquedaNorm = normalizarAcentos(busqueda).toLowerCase()
      for (const [id, nombre] of miembroNombres.entries()) {
        if (normalizarAcentos(nombre).toLowerCase().includes(busquedaNorm)) {
          idsPorBusqueda.add(id)
        }
      }
    }
    // Filtrar por sectores vía tabla `miembros_sectores` (relación N:M)
    let idsPorSector: Set<string> | null = null
    if (sectoresCsv) {
      const sectorIds = sectoresCsv.split(',').filter(Boolean)
      const { data: asignaciones } = await admin
        .from('miembros_sectores')
        .select('miembro_id')
        .in('sector_id', sectorIds)
      idsPorSector = new Set<string>((asignaciones || []).map((a: { miembro_id: string }) => a.miembro_id))
      if (idsPorSector.size === 0) {
        return NextResponse.json({ registros: [], total: 0 })
      }
    }

    let query = admin
      .from('asistencias')
      .select('*', { count: 'exact' })
      .eq('empresa_id', empresaId)
      .order('fecha', { ascending: false })
      .order('hora_entrada', { ascending: false })
      .range((pagina - 1) * limite, pagina * limite - 1)

    // Si solo tiene ver_propio, limitar al miembro autenticado.
    if (vis.soloPropio) {
      const { data: miembroPropio } = await admin
        .from('miembros')
        .select('id')
        .eq('usuario_id', user.id)
        .eq('empresa_id', empresaId)
        .single()
      if (!miembroPropio?.id) return NextResponse.json({ registros: [], total: 0 })
      query = query.eq('miembro_id', miembroPropio.id)
    }

    // Rango de fechas (preset o custom). Asistencias usa la columna `fecha` (date,
    // no timestamp) → formateamos a YYYY-MM-DD antes de comparar.
    // Cargamos la zona de la empresa para que "hoy/este mes" coincida con el día local.
    const { data: empAs } = await admin.from('empresas').select('zona_horaria').eq('id', empresaId).maybeSingle()
    const zonaAs = (empAs?.zona_horaria as string) || 'America/Argentina/Buenos_Aires'
    const fmtDia = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: zonaAs })
    if (preset_fecha) {
      const { desde: d1, hasta: d2 } = resolverRangoFecha(preset_fecha, new Date(), zonaAs)
      if (d1 && d2) {
        // Si es un solo día, usar eq. Si son varios, usar rango gte/lte.
        const mismoDia = fmtDia(d1) === fmtDia(d2)
        if (mismoDia) {
          query = query.eq('fecha', fmtDia(d1))
        } else {
          query = query.gte('fecha', fmtDia(d1)).lte('fecha', fmtDia(d2))
        }
      }
    } else {
      if (desde) query = query.gte('fecha', desde)
      if (hasta) query = query.lte('fecha', hasta)
    }

    // Filtros de miembro (multi CSV + single compat + intersección con búsqueda/sector)
    const idsExplicitos = new Set<string>()
    if (miembrosCsv) miembrosCsv.split(',').filter(Boolean).forEach(id => idsExplicitos.add(id))
    if (miembroIdSingle) idsExplicitos.add(miembroIdSingle)
    const combinar = (...sets: (Set<string> | null)[]): string[] | null => {
      const activos = sets.filter((s): s is Set<string> => s !== null && s.size > 0)
      if (activos.length === 0) return null
      const [primero, ...resto] = activos
      const resultado = [...primero].filter(id => resto.every(s => s.has(id)))
      return resultado
    }
    const idsFinales = combinar(
      idsExplicitos.size > 0 ? idsExplicitos : null,
      idsPorSector,
      idsPorBusqueda.size > 0 ? idsPorBusqueda : null,
    )
    if (idsFinales) {
      if (idsFinales.length === 0) return NextResponse.json({ registros: [], total: 0 })
      query = query.in('miembro_id', idsFinales)
    }

    // Estados (CSV + single compat)
    if (estadosCsv) {
      const estados = estadosCsv.split(',').filter(Boolean)
      query = estados.length === 1 ? query.eq('estado', estados[0]) : query.in('estado', estados)
    } else if (estadoSingle) {
      query = query.eq('estado', estadoSingle)
    }

    // Sin cerrar → estados activos
    if (sin_cerrar) {
      query = query.in('estado', ['activo', 'almuerzo', 'particular'])
    }

    // Tipos
    if (tiposCsv) {
      const tipos = tiposCsv.split(',').filter(Boolean)
      query = tipos.length === 1 ? query.eq('tipo', tipos[0]) : query.in('tipo', tipos)
    }

    // Con tardanza (además del filtro "tipos")
    if (con_tardanza) {
      query = query.or('tipo.eq.tardanza,puntualidad_min.gt.0')
    }

    // Métodos
    if (metodosCsv) {
      const metodos = metodosCsv.split(',').filter(Boolean)
      query = metodos.length === 1 ? query.eq('metodo_registro', metodos[0]) : query.in('metodo_registro', metodos)
    }

    // Turnos
    if (turnosCsv) {
      const turnos = turnosCsv.split(',').filter(Boolean)
      query = turnos.length === 1 ? query.eq('turno_id', turnos[0]) : query.in('turno_id', turnos)
    }

    // Creado por (admin que cargó el fichaje)
    if (creado_por) {
      query = query.eq('creado_por', creado_por)
    }

    // Si hay búsqueda pero no matcheó ningún miembro, buscar también por notas
    if (busqueda.trim() && idsPorBusqueda.size === 0) {
      const busquedaNorm = normalizarAcentos(busqueda)
      query = query.ilike('notas', `%${busquedaNorm}%`)
    }

    const { data, count, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const registros = (data || []).map((r: Record<string, unknown>) => ({
      ...r,
      miembro_nombre: miembroNombres.get(String(r.miembro_id)) || 'Sin nombre',
      creador_nombre: r.creado_por ? (miembroNombres.get(String(r.creado_por)) || null) : null,
      editor_nombre: r.editado_por ? (miembroNombres.get(String(r.editado_por)) || null) : null,
    }))

    return NextResponse.json({ registros, total: count || 0 })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

/**
 * POST /api/asistencias — Crear fichaje manual (admin).
 * Requiere `asistencias:marcar` (el permiso habilita cargar fichajes de OTROS
 * desde /asistencias). Para fichar el propio turno existe el endpoint
 * /api/asistencias/fichar con `requerirFichajePropioAPI`.
 */
export async function POST(request: NextRequest) {
  try {
    const guard = await requerirPermisoAPI('asistencias', 'marcar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

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
    const guard = await requerirPermisoAPI('asistencias', 'editar')
    if ('respuesta' in guard) return guard.respuesta
    const { user, empresaId } = guard

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
    const guard = await requerirPermisoAPI('asistencias', 'eliminar')
    if ('respuesta' in guard) return guard.respuesta
    const { empresaId } = guard

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
