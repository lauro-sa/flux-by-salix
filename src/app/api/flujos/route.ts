/**
 * API REST de Flujos — listar + crear (PR 18.1).
 *
 *   GET  /api/flujos           — lista paginada con filtros.
 *   POST /api/flujos           — crea un flujo nuevo (siempre nace en
 *                                estado 'borrador', disparador y
 *                                acciones vacíos para que el usuario
 *                                los configure desde la UI).
 *
 * Auth y multi-tenant: patrón estándar de Flux — requerirPermisoAPI
 * resuelve sesión + permiso, después se filtra en el clienteAdmin
 * con .eq('empresa_id', empresaId). Las RLS sobre `flujos`
 * (sql/054) son la red de seguridad si algún día se accede sin
 * filtro manual, pero el filtro explícito hace el query plan más
 * simple y bloquea en `null` empresa_id rápidamente.
 *
 * Patrón de visibilidad: si el usuario tiene `ver_todos` ve todo
 * el tenant; si solo tiene `ver_propio` ve los que él creó. La
 * separación queda en `verificarVisibilidad`.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import {
  obtenerYVerificarPermiso,
  requerirPermisoAPI,
  verificarVisibilidad,
} from '@/lib/permisos-servidor'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { esBodyCrearFlujo, esEstadoFlujo, type EstadoFlujo } from '@/tipos/workflow'
import { inicioRangoFechaISO } from '@/lib/presets-fecha'

const POR_PAGINA_DEFAULT = 50
const POR_PAGINA_MAX = 200

// =============================================================
// GET /api/flujos
// =============================================================
// Filtros:
//   q                 — búsqueda case-insensitive en nombre.
//   estado            — CSV de EstadoFlujo (borrador,activo,pausado).
//   tipo_disparador   — CSV de tipos de disparador
//                       (entidad.estado_cambio,tiempo.cron,…).
//   modulo            — eq sobre disparador.configuracion.entidad_tipo.
//                       Solo aplica a disparadores que tienen entidad
//                       (entidad.*, tiempo.relativo_a_campo). Para
//                       tiempo.cron / webhook / inbox simplemente no
//                       matchea, lo que es el comportamiento correcto.
//   creado_rango      — preset de fecha ('hoy', '7d', 'este_mes', …).
//                       Resuelto con inicioRangoFechaISO + zona horaria
//                       de empresa, mismo patrón que /api/contactos.
//                       Filtra por creado_en >= desde.
//   fecha_ultima_ejecucion — preset de fecha; filtra por
//                       ultima_ejecucion_en >= desde (PR 18.3).
//   pagina            — 1-based. Default 1.
//   por_pagina        — Default 50, máx 200.
//
// Fuente de datos: vista `flujos_con_estadisticas` (sql/059) en lugar
// de la tabla cruda. La vista agrega `ultima_ejecucion_en` y
// `total_ejecuciones_30d` mediante LATERAL JOINs sobre ejecuciones_flujo,
// con `security_invoker=true` para respetar las RLS de las tablas
// subyacentes según el caller. El filtro `fecha_ultima_ejecucion`
// requiere este shape para aplicar antes de paginar.
//
// Respuesta:
//   { flujos: Flujo[], total: number, pagina: number, por_pagina: number }
//
// Cada item incluye `creado_por_nombre` y `editado_por_nombre`
// denormalizados en BD (sql/056) — sin join adicional.

export async function GET(request: NextRequest) {
  const { user } = await obtenerUsuarioRuta()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) {
    return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })
  }

  const visibilidad = await verificarVisibilidad(user.id, empresaId, 'flujos')
  if (!visibilidad) {
    return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })
  }

  const params = request.nextUrl.searchParams
  const q = (params.get('q') ?? '').trim()
  const estadoCsv = params.get('estado') ?? ''
  const tipoDisparadorCsv = params.get('tipo_disparador') ?? ''
  const modulo = (params.get('modulo') ?? '').trim()
  const creadoRango = (params.get('creado_rango') ?? '').trim()
  const fechaUltimaEjecucion = (params.get('fecha_ultima_ejecucion') ?? '').trim()
  const pagina = Math.max(1, Number(params.get('pagina') ?? '1') || 1)
  const porPaginaRaw = Number(params.get('por_pagina') ?? POR_PAGINA_DEFAULT) || POR_PAGINA_DEFAULT
  const porPagina = Math.min(POR_PAGINA_MAX, Math.max(1, porPaginaRaw))

  // Parseo + validación de filtros multivaluados.
  const estados: EstadoFlujo[] = estadoCsv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s): s is EstadoFlujo => esEstadoFlujo(s))

  const tiposDisparador = tipoDisparadorCsv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  const admin = crearClienteAdmin()
  let query = admin
    .from('flujos_con_estadisticas')
    .select(
      'id, empresa_id, nombre, descripcion, estado, activo, disparador, ' +
      'condiciones, acciones, borrador_jsonb, ultima_ejecucion_tiempo, ' +
      'creado_por, creado_por_nombre, editado_por, editado_por_nombre, ' +
      'creado_en, actualizado_en, ultima_ejecucion_en, total_ejecuciones_30d',
      { count: 'exact' },
    )
    .eq('empresa_id', empresaId)

  if (q.length > 0) {
    // Patrón usado en otros listados de Flux: ilike en una sola
    // columna (nombre). Si después aparece la necesidad de buscar
    // también en descripción se cambia a .or(...).
    query = query.ilike('nombre', `%${q}%`)
  }
  if (estados.length === 1) {
    query = query.eq('estado', estados[0])
  } else if (estados.length > 1) {
    query = query.in('estado', estados)
  }
  if (tiposDisparador.length === 1) {
    query = query.eq('disparador->>tipo', tiposDisparador[0])
  } else if (tiposDisparador.length > 1) {
    // Postgrest no soporta `.in` sobre operador `->>`. Hacemos OR
    // explícito con la sintaxis de PostgREST.
    const expr = tiposDisparador.map((t) => `disparador->>tipo.eq.${t}`).join(',')
    query = query.or(expr)
  }
  if (modulo.length > 0) {
    // disparador.configuracion.entidad_tipo es el módulo del flujo
    // para todos los disparadores que operan sobre una entidad. Para
    // tiempo.cron y webhook.entrante este path es null, así que el
    // filtro los descarta — comportamiento correcto: si el usuario
    // pidió "flujos del módulo presupuestos", no quiere ver crons
    // genéricos.
    query = query.eq('disparador->configuracion->>entidad_tipo', modulo)
  }
  // Filtros que dependen de zona horaria de empresa: cargamos la zona
  // una sola vez si alguno está presente, no por cada filtro.
  if (creadoRango.length > 0 || fechaUltimaEjecucion.length > 0) {
    const { data: emp } = await admin
      .from('empresas')
      .select('zona_horaria')
      .eq('id', empresaId)
      .maybeSingle()
    const zona = (emp?.zona_horaria as string) || undefined

    if (creadoRango.length > 0) {
      const desdeISO = inicioRangoFechaISO(creadoRango, new Date(), zona)
      if (desdeISO) query = query.gte('creado_en', desdeISO)
    }
    if (fechaUltimaEjecucion.length > 0) {
      // Filtro sobre la columna agregada de la vista. Fila sin
      // ejecuciones (`ultima_ejecucion_en IS NULL`) cae afuera del
      // resultado, lo que es el comportamiento correcto: el usuario
      // pidió "flujos con corrida en X período".
      const desdeISO = inicioRangoFechaISO(fechaUltimaEjecucion, new Date(), zona)
      if (desdeISO) query = query.gte('ultima_ejecucion_en', desdeISO)
    }
  }
  if (visibilidad.soloPropio) {
    query = query.eq('creado_por', user.id)
  }

  query = query
    .order('actualizado_en', { ascending: false })
    .range((pagina - 1) * porPagina, pagina * porPagina - 1)

  const { data, error, count } = await query
  if (error) {
    console.error(JSON.stringify({
      nivel: 'error',
      mensaje: 'error_listar_flujos',
      detalle: error.message,
    }))
    return NextResponse.json({ error: 'Error al listar flujos' }, { status: 500 })
  }

  return NextResponse.json({
    flujos: data ?? [],
    total: count ?? 0,
    pagina,
    por_pagina: porPagina,
  })
}

// =============================================================
// POST /api/flujos
// =============================================================
// Crea un flujo nuevo en estado 'borrador'. Disparador / condiciones
// / acciones arrancan vacíos y el usuario los va completando con
// PUT /api/flujos/[id] (autoguardado). Cuando estén listos clickea
// activar (PR 18.2) y ahí recién corre validarPublicable.
//
// Resolvemos el nombre del creador desde perfiles para denormalizar
// en `creado_por_nombre`. Patrón ya usado en /api/correo/plantillas.

export async function POST(request: NextRequest) {
  const guard = await requerirPermisoAPI('flujos', 'crear')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  if (!esBodyCrearFlujo(body)) {
    return NextResponse.json(
      { error: 'Body inválido: nombre obligatorio (1-200 chars), descripcion opcional ≤2000 chars' },
      { status: 400 },
    )
  }

  const admin = crearClienteAdmin()

  // Nombre del creador para denormalizar (sin join en futuros listados).
  const { data: perfil } = await admin
    .from('perfiles')
    .select('nombre, apellido')
    .eq('id', user.id)
    .maybeSingle()
  const creadoPorNombre = perfil
    ? `${perfil.nombre ?? ''} ${perfil.apellido ?? ''}`.trim() || null
    : null

  const { data: flujo, error } = await admin
    .from('flujos')
    .insert({
      empresa_id: empresaId,
      nombre: body.nombre.trim(),
      descripcion: body.descripcion?.trim() || null,
      estado: 'borrador',
      // disparador / condiciones / acciones / nodos_json / borrador_jsonb
      // se quedan con el default de SQL ({}, [], [], {}, NULL).
      creado_por: user.id,
      creado_por_nombre: creadoPorNombre,
    })
    .select()
    .single()

  if (error) {
    console.error(JSON.stringify({
      nivel: 'error',
      mensaje: 'error_crear_flujo',
      detalle: error.message,
    }))
    return NextResponse.json({ error: 'Error al crear flujo' }, { status: 500 })
  }

  // Auditoría: creación. Siguiendo el patrón de plantillas_correo,
  // dejamos un row con campo_modificado='creacion' para que aparezca
  // en el historial del IndicadorEditado.
  await admin.from('auditoria_flujos').insert({
    empresa_id: empresaId,
    flujo_id: flujo.id,
    editado_por: user.id,
    campo_modificado: 'creacion',
    valor_anterior: null,
    valor_nuevo: body.nombre.trim(),
  })

  // El flag `puede_editar` se calcula con un permiso de cortesía para
  // que la UI sepa si renderizar el editor inmediatamente sin
  // requerir un GET adicional. El que crea probablemente puede editar
  // (los defaults lo dan), pero verificamos formalmente.
  const { permitido: puedeEditar } = await obtenerYVerificarPermiso(
    user.id, empresaId, 'flujos', 'editar',
  )

  return NextResponse.json({
    flujo: { ...flujo, permisos: { editar: puedeEditar } },
  })
}
