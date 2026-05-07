/**
 * POST /api/flujos/[id]/probar (sub-PR 19.5)
 *
 * Endpoint de la sandbox del editor visual: corre el flujo en modo
 * dry-run synchronously, sin escribir en BD, sin invocar APIs externas
 * (Meta WhatsApp, transición de estado), sin insertar en
 * `notificaciones`/`actividades`/`acciones_pendientes`.
 *
 * Contrato:
 *   Body: { dry_run: true } — el flag es obligatorio en este sub-PR.
 *                              `dry_run !== true` devuelve 400 (la
 *                              "ejecución real" no se expone hasta que
 *                              un sub-PR posterior la habilite).
 *   200:  { log, contexto_usado, flujo_evaluado, evento_simulado,
 *           duracion_total_ms, resumen }
 *   400:  body inválido o `dry_run !== true`.
 *   401:  no autenticado.
 *   403:  sin permiso `flujos.editar` o sin empresa activa.
 *   404:  flujo inexistente / cross-tenant.
 *   422:  validación previa falló (mismos `validarFlujoConPasos` que el
 *         banner rojo del editor); incluye `errores` legibles.
 *
 * Permiso: `flujos.editar` — probar un flujo es parte del flujo de
 * edición (no de solo-lectura). Mantiene paridad con `/preview-contexto`
 * que requiere `ver` (lectura del árbol de variables).
 *
 * Versión que se prueba: la EDITABLE (`obtenerVersionEditable`). Si el
 * flujo está activo con borrador interno, se simula el borrador (que
 * es lo que el usuario está viendo y editando en el canvas). El motor
 * de producción NUNCA es afectado.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import { requerirPermisoAPI } from '@/lib/permisos-servidor'
import { obtenerVersionEditable } from '@/lib/workflows/version-editable'
import { validarFlujoConPasos } from '@/lib/workflows/validacion-flujo'
import { armarContextoPreview } from '@/lib/workflows/preview-contexto'
import { correrEjecucionDryRun } from '@/lib/workflows/correr-ejecucion-dryrun'
import type { Flujo } from '@/tipos/workflow'

type ParamsPromise = Promise<{ id: string }>

export async function POST(request: NextRequest, { params }: { params: ParamsPromise }) {
  const { id } = await params

  const guard = await requerirPermisoAPI('flujos', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { empresaId } = guard

  // 1) Body validation. dry_run obligatoriamente true en 19.5; el
  //    branch de "ejecución real" queda preparado en el orquestador
  //    pero NO expuesto vía endpoint hasta que un sub-PR posterior lo
  //    habilite explícitamente.
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Body debe ser un objeto' }, { status: 400 })
  }
  const dryRun = (body as { dry_run?: unknown }).dry_run
  if (dryRun !== true) {
    return NextResponse.json(
      { error: 'En esta versión solo está disponible el modo prueba (dry_run debe ser true).' },
      { status: 400 },
    )
  }

  const admin = crearClienteAdmin()

  // 2) Cargar flujo (mismo patrón que GET /api/flujos/[id]: 404 si no
  //    existe en empresa_id, sin leakear existencia cross-tenant).
  const { data: flujoRaw } = await admin
    .from('flujos')
    .select('id, empresa_id, estado, disparador, condiciones, acciones, nodos_json, borrador_jsonb')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()

  if (!flujoRaw) {
    return NextResponse.json({ error: 'Flujo no encontrado' }, { status: 404 })
  }

  // 3) Decidir versión a probar (publicada vs borrador interno) — la
  //    misma fuente de verdad que pinta el editor. El motor real
  //    NUNCA se ve afectado: el dry-run no toca el flujo en BD.
  const version = obtenerVersionEditable(
    flujoRaw as Pick<Flujo, 'estado' | 'disparador' | 'condiciones' | 'acciones' | 'nodos_json' | 'borrador_jsonb'>,
  )

  // 4) Validación previa: si el shape del flujo no es publicable, NO
  //    arrancamos el dry-run. El banner rojo del editor ya bloquea
  //    el botón Probar client-side; este check es defensa en
  //    profundidad (race conditions, otra sesión, etc.).
  //    Acciones del array NO necesariamente traen `id` cliente-side
  //    cuando vienen del backend — `validarFlujoConPasos` tolera la
  //    ausencia atribuyendo errores al disparador (defensivo).
  const acciones = Array.isArray(version.acciones) ? version.acciones : []
  const validacion = validarFlujoConPasos(version.disparador, acciones)
  if (!validacion.ok) {
    return NextResponse.json(
      {
        error: 'El flujo tiene errores que impiden probarlo.',
        errores: validacion.errores.map((e) => e.mensaje),
      },
      { status: 422 },
    )
  }

  // 5) Armar contexto sintético reutilizando el mismo helper del
  //    PickerVariables (sub-PR 19.3b): última entidad del estado
  //    objetivo del disparador, o solo empresa+ahora si es cron/webhook.
  //    Esto resuelve el caveat D6: cron sin entidad → contexto sin
  //    entidad/contacto, y los pasos que referencien `{{contacto.nombre}}`
  //    fallarán con `VariableFaltante` de manera predecible.
  const contexto = await armarContextoPreview(
    {
      empresa_id: flujoRaw.empresa_id as string,
      disparador: version.disparador,
      borrador_jsonb: flujoRaw.borrador_jsonb,
    },
    admin,
  )

  // 6) Resumen del evento simulado (chip "Evento de prueba" del UI).
  //    Si no hay entidad cargada (cron / webhook), devolvemos null y
  //    la UI muestra "Sin evento (disparador no requiere entidad)".
  const entidadCargada =
    contexto.entidad && typeof contexto.entidad === 'object'
      ? (contexto.entidad as { tipo?: string; id?: string; titulo?: string; nombre?: string })
      : null
  const eventoSimulado = entidadCargada?.id
    ? {
        tipo_entidad: entidadCargada.tipo ?? null,
        id: entidadCargada.id,
        resumen:
          (typeof entidadCargada.titulo === 'string' && entidadCargada.titulo) ||
          (typeof entidadCargada.nombre === 'string' && entidadCargada.nombre) ||
          entidadCargada.id,
      }
    : null

  // 7) Correr el dry-run.
  const resultado = await correrEjecucionDryRun(
    {
      empresaId: flujoRaw.empresa_id as string,
      acciones,
      contextoVars: contexto,
    },
    admin,
  )

  return NextResponse.json({
    log: resultado.log,
    contexto_usado: contexto,
    flujo_evaluado: {
      disparador: version.disparador,
      acciones,
      es_borrador_interno: version.esBorradorInterno,
    },
    evento_simulado: eventoSimulado,
    duracion_total_ms: resultado.duracion_total_ms,
    estado_final: resultado.estado_final,
    resumen: resultado.resumen,
  })
}
