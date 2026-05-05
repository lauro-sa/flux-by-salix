/**
 * GET /api/ejecuciones — listar ejecuciones de flujos (PR 18.3).
 *
 * Auth y multi-tenant: visibilidad heredada del módulo `flujos`
 * (`ver_todos` o `ver_propio`). Si solo `ver_propio`, filtramos por
 * el join al flujo con `flujos.creado_por = user.id`.
 *
 * Filtros (referencia: §1.9.4 del plan UX):
 *   flujo_id              uuid simple
 *   estado                CSV de EstadoEjecucion
 *   desde / hasta         ISO date sobre creado_en
 *   creado_rango          preset ('hoy', '7d', etc.) — alternativa a desde/hasta
 *   disparado_por_tipo    CSV: cambios_estado | cron | manual | webhook
 *                         (usa LIKE 'tipo:%' sobre disparado_por)
 *   entidad_tipo          contexto_inicial->entidad->>tipo (eq)
 *   entidad_id            contexto_inicial->entidad->>id  (eq)
 *   error_raw_class       CSV. Filtra log usando contains:
 *                         log @> [{"error":{"raw_class":"X"}}]
 *                         (usa OR para múltiples valores)
 *   pagina, por_pagina    paginación (max 200)
 *
 * Response:
 *   { ejecuciones: Array<EjecucionFlujo & {flujo_nombre}>,
 *     total, pagina, por_pagina }
 *
 * Cada item incluye `flujo_nombre` denormalizado vía JOIN postgrest.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { verificarVisibilidad } from '@/lib/permisos-servidor'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { parsearFiltrosEjecuciones } from '@/lib/workflows/filtros-ejecuciones'
import { inicioRangoFechaISO } from '@/lib/presets-fecha'

export async function GET(request: NextRequest) {
  const { user } = await obtenerUsuarioRuta()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) {
    return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })
  }

  // Permiso heredado de `flujos` (no hay módulo separado de ejecuciones).
  const visibilidad = await verificarVisibilidad(user.id, empresaId, 'flujos')
  if (!visibilidad) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const filtros = parsearFiltrosEjecuciones(request.nextUrl.searchParams)
  const admin = crearClienteAdmin()

  // JOIN inner sobre flujos: la fila solo aparece si el flujo existe
  // y matchea las condiciones extra (visibilidad propia). Trae el
  // nombre denormalizado para mostrar en el listado.
  let query = admin
    .from('ejecuciones_flujo')
    .select(
      'id, empresa_id, flujo_id, estado, disparado_por, contexto_inicial, ' +
      'log, inicio_en, fin_en, proximo_paso_en, intentos, clave_idempotencia, ' +
      'creado_en, flujos!inner(nombre, estado)',
      { count: 'exact' },
    )
    .eq('empresa_id', empresaId)

  // Visibilidad propia: solo ejecuciones de flujos que el user creó.
  // PostgREST permite filtrar por el JOIN con `<tabla>.<campo>`.
  if (visibilidad.soloPropio) {
    query = query.eq('flujos.creado_por', user.id)
  }

  if (filtros.flujo_id) {
    query = query.eq('flujo_id', filtros.flujo_id)
  }
  if (filtros.estados.length === 1) {
    query = query.eq('estado', filtros.estados[0])
  } else if (filtros.estados.length > 1) {
    query = query.in('estado', filtros.estados)
  }
  if (filtros.desde) query = query.gte('creado_en', filtros.desde)
  if (filtros.hasta) query = query.lte('creado_en', filtros.hasta)

  if (filtros.creado_rango) {
    const { data: emp } = await admin
      .from('empresas')
      .select('zona_horaria')
      .eq('id', empresaId)
      .maybeSingle()
    const zona = (emp?.zona_horaria as string) || undefined
    const desdeISO = inicioRangoFechaISO(filtros.creado_rango, new Date(), zona)
    if (desdeISO) query = query.gte('creado_en', desdeISO)
  }

  if (filtros.disparado_por_tipos.length === 1) {
    query = query.like('disparado_por', `${filtros.disparado_por_tipos[0]}:%`)
  } else if (filtros.disparado_por_tipos.length > 1) {
    const expr = filtros.disparado_por_tipos
      .map((t) => `disparado_por.like.${t}:*`)
      .join(',')
    query = query.or(expr)
  }

  if (filtros.entidad_tipo) {
    query = query.eq('contexto_inicial->entidad->>tipo', filtros.entidad_tipo)
  }
  if (filtros.entidad_id) {
    query = query.eq('contexto_inicial->entidad->>id', filtros.entidad_id)
  }

  // error_raw_class: filtra log con contains. El log es array de
  // pasos; cada paso fallido tiene shape:
  //   { paso, tipo, estado:'fallo', error:{ raw_class:'X', ... } }
  // El operador `cs` (contains) evalúa `log @> [{...}]` — verdadero si
  // ALGÚN elemento del array contiene la sub-estructura. Ojo: usar
  // listas (no objetos sueltos) en cs para que postgres entienda
  // "contiene este shape en el array".
  if (filtros.error_raw_class.length === 1) {
    query = query.contains('log', [
      { error: { raw_class: filtros.error_raw_class[0] } },
    ])
  } else if (filtros.error_raw_class.length > 1) {
    const expr = filtros.error_raw_class
      .map(
        (c) =>
          `log.cs.[{"error":{"raw_class":"${c.replace(/"/g, '\\"')}"}}]`,
      )
      .join(',')
    query = query.or(expr)
  }

  query = query
    .order('creado_en', { ascending: false })
    .range(
      (filtros.pagina - 1) * filtros.por_pagina,
      filtros.pagina * filtros.por_pagina - 1,
    )

  const { data, error, count } = await query
  if (error) {
    console.error(JSON.stringify({
      nivel: 'error',
      mensaje: 'error_listar_ejecuciones',
      detalle: error.message,
    }))
    return NextResponse.json({ error: 'Error al listar ejecuciones' }, { status: 500 })
  }

  // Aplanar `flujos: { nombre }` → `flujo_nombre` para que la UI no
  // tenga que leer el sub-objeto. PostgREST puede devolver el sub-
  // recurso como objeto o como array según infiera la relación.
  const ejecuciones = (data ?? []).map((row) => {
    const r = row as unknown as Record<string, unknown>
    const flujosCrudo = r.flujos
    const flujo = (
      Array.isArray(flujosCrudo) ? flujosCrudo[0] : flujosCrudo
    ) as { nombre?: string; estado?: string } | null | undefined
    return {
      ...r,
      flujo_nombre: flujo?.nombre ?? null,
      flujo_estado: flujo?.estado ?? null,
    }
  })

  return NextResponse.json({
    ejecuciones,
    total: count ?? 0,
    pagina: filtros.pagina,
    por_pagina: filtros.por_pagina,
  })
}
