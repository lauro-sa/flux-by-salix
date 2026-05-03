// =============================================================
// Edge Function: dispatcher-workflows (PR 14)
// =============================================================
// Recibe webhooks de Database Webhooks de Supabase configurados
// para INSERT en public.cambios_estado, y crea filas en
// ejecuciones_flujo para cada flujo activo de la empresa cuyo
// disparador matchea el evento.
//
// Idempotencia: cada ejecución se inserta con clave_idempotencia
// determinística `flujo:<id>:evento:<cambios_estado_id>`. Si el
// webhook se reintenta o se invoca dos veces para el mismo evento,
// el UNIQUE parcial en (flujo_id, clave_idempotencia) hace rebotar
// la 2da inserción con código 23505 (unique_violation), que esta
// function captura y reporta como "ya existía" — sin error.
//
// =============================================================
// AUTH — Bearer con WEBHOOK_SECRET custom
// =============================================================
// La function valida `Authorization: Bearer <WEBHOOK_SECRET>`
// donde WEBHOOK_SECRET es un secret propio configurado en
// Edge Functions Settings → Secrets. El admin pega el mismo
// valor en el header del Database Webhook.
//
// POR QUÉ NO USAMOS SUPABASE_SERVICE_ROLE_KEY:
// Tentación obvia: "Supabase ya inyecta SERVICE_ROLE_KEY en cada
// function, ahorramos crear un secret". Probado y descartado en
// PR 14 (commit del diagnóstico). Razón:
//
// Supabase está migrando las API keys del formato legacy JWT
// (~219 chars, prefix `eyJh...`) al formato moderno
// (~41 chars, prefix `sb_secret_...`). Durante la transición
// AMBAS son válidas para autenticar requests, pero NO son
// strings iguales. El runtime de Edge Functions inyecta UNA de
// las dos en `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`, y el
// admin que copia "service role key" del dashboard puede
// terminar con la otra (porque el dashboard expone ambas).
// La comparación literal `auth === \`Bearer ${env}\`` falla
// silenciosamente y todos los webhooks rebotan con 401 sin
// pista del problema.
//
// Peor: cuando Supabase eventualmente deprecia el formato
// legacy, los webhooks que usaban esa key ROMPEN sin preaviso.
//
// El secret custom es independiente de la rotación y formato
// de las keys de plataforma. 5 minutos de configuración inicial
// que evitan un bug silencioso en producción. La regla de Flux
// "soluciones definitivas, no parches" aplica acá.
//
// =============================================================
// MANEJO DE RESPUESTAS (importante para reintentos automáticos)
// =============================================================
//   2xx — evento procesado (incluso sin matches, incluso si la
//         ejecución ya existía por idempotencia).
//   400 — payload roto (NO reintentar — el evento está roto y
//         reintentar no ayuda).
//   401 — secret faltante o incorrecto (NO reintentar — el admin
//         tiene que arreglar la config).
//   500 — error de BD u otro fallo transitorio (Supabase
//         reintenta con backoff).
//
// LOGGING: cada invocación deja un JSON estructurado con
// cambios_estado_id, entidad_tipo, estado_nuevo, flujos
// matcheados y resultado de inserción. NO loggeamos metadatos
// ni contexto jsonb (datos potencialmente sensibles).
//
// IMPORTANTE — la lógica de match está duplicada acá desde
// src/lib/workflows/dispatcher.ts y los type guards desde
// src/tipos/workflow.ts. Esto es deliberado: Deno no resuelve
// los alias `@/...` del proyecto Next y el repo no se publica
// como package. La verdad está en TS, este archivo es un
// mirror. Cualquier cambio de comportamiento debe hacerse en
// AMBOS lados y reflejarse en
// src/lib/__tests__/dispatcher-workflows.test.ts.
// =============================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

// ─── Tipos (subset necesario, mirror de src/tipos/) ───────────

interface CambioEstado {
  id: string
  empresa_id: string
  entidad_tipo: string
  entidad_id: string
  estado_anterior: string | null
  estado_nuevo: string
  grupo_anterior: string | null
  grupo_nuevo: string | null
  origen: string
  usuario_id: string | null
  usuario_nombre: string | null
  motivo: string | null
  metadatos: Record<string, unknown>
  contexto: Record<string, unknown>
  creado_en: string
}

interface Flujo {
  id: string
  empresa_id: string
  nombre: string
  activo: boolean
  disparador: unknown
}

interface DisparadorEntidadEstadoCambio {
  tipo: 'entidad.estado_cambio'
  configuracion: {
    entidad_tipo: string
    hasta_clave: string
    desde_clave?: string | null
  }
}

interface WebhookPayloadCambiosEstado {
  type: 'INSERT'
  table: 'cambios_estado'
  schema: 'public'
  record: CambioEstado
  old_record: null
}

// ─── Type guards (mirror de src/tipos/workflow.ts) ────────────

function esWebhookPayloadCambiosEstado(p: unknown): p is WebhookPayloadCambiosEstado {
  if (typeof p !== 'object' || p === null) return false
  const r = p as Record<string, unknown>
  if (r.type !== 'INSERT') return false
  if (r.table !== 'cambios_estado') return false
  if (r.schema !== 'public') return false
  if (typeof r.record !== 'object' || r.record === null) return false
  const rec = r.record as Record<string, unknown>
  if (typeof rec.id !== 'string' || rec.id.length === 0) return false
  if (typeof rec.empresa_id !== 'string' || rec.empresa_id.length === 0) return false
  if (typeof rec.entidad_tipo !== 'string' || rec.entidad_tipo.length === 0) return false
  if (typeof rec.entidad_id !== 'string' || rec.entidad_id.length === 0) return false
  if (typeof rec.estado_nuevo !== 'string' || rec.estado_nuevo.length === 0) return false
  if (rec.estado_anterior !== null && typeof rec.estado_anterior !== 'string') return false
  return true
}

function esDisparadorEntidadEstadoCambio(d: unknown): d is DisparadorEntidadEstadoCambio {
  if (typeof d !== 'object' || d === null) return false
  const r = d as Record<string, unknown>
  if (r.tipo !== 'entidad.estado_cambio') return false
  if (typeof r.configuracion !== 'object' || r.configuracion === null) return false
  const c = r.configuracion as Record<string, unknown>
  if (typeof c.entidad_tipo !== 'string') return false
  if (typeof c.hasta_clave !== 'string') return false
  if (
    c.desde_clave !== undefined &&
    c.desde_clave !== null &&
    typeof c.desde_clave !== 'string'
  ) return false
  return true
}

// ─── Helpers ──────────────────────────────────────────────────

function armarClaveIdempotencia(flujoId: string, cambiosEstadoId: string): string {
  return `flujo:${flujoId}:evento:${cambiosEstadoId}`
}

// Mirror de matchearFlujos en src/lib/workflows/dispatcher.ts.
// Reglas: activo + misma empresa + tipo entidad.estado_cambio +
// entidad_tipo y hasta_clave coinciden + (desde_clave coincide si
// está seteado).
function matchearFlujos(evento: CambioEstado, flujosActivos: Flujo[]): Flujo[] {
  return flujosActivos.filter((flujo) => {
    if (!flujo.activo) return false
    if (flujo.empresa_id !== evento.empresa_id) return false
    if (!esDisparadorEntidadEstadoCambio(flujo.disparador)) return false
    const cfg = flujo.disparador.configuracion
    if (cfg.entidad_tipo !== evento.entidad_tipo) return false
    if (cfg.hasta_clave !== evento.estado_nuevo) return false
    if (cfg.desde_clave !== undefined && cfg.desde_clave !== null) {
      if (cfg.desde_clave !== evento.estado_anterior) return false
    }
    return true
  })
}

// ─── Respuestas ──────────────────────────────────────────────

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

// ─── Handler ──────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Solo aceptamos POST. Cualquier otra cosa es 405.
  if (req.method !== 'POST') {
    return jsonResponse(405, { ok: false, error: 'method_not_allowed' })
  }

  // 1) Auth — Bearer con WEBHOOK_SECRET custom (ver doc en header
  //    de este archivo). 401 sin reintento si no matchea.
  const expected = Deno.env.get('WEBHOOK_SECRET')
  if (!expected) {
    console.error(JSON.stringify({
      nivel: 'critical',
      mensaje: 'WEBHOOK_SECRET no configurado en la function',
    }))
    return jsonResponse(401, { ok: false, error: 'secret_not_configured' })
  }
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${expected}`) {
    return jsonResponse(401, { ok: false, error: 'unauthorized' })
  }

  // 2) Validar env vars que el runtime de Supabase debería inyectar
  //    automáticamente para que la function pueda hablar con la BD.
  //    Si faltan, es un fallo de plataforma → 500.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) {
    console.error(JSON.stringify({
      nivel: 'critical',
      mensaje: 'SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY faltantes',
    }))
    return jsonResponse(500, { ok: false, error: 'env_missing' })
  }

  // 3) Parse + validación de payload.
  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid_json' })
  }
  if (!esWebhookPayloadCambiosEstado(payload)) {
    return jsonResponse(400, { ok: false, error: 'invalid_payload_shape' })
  }

  const evento = payload.record

  // 4) Cliente Supabase con SERVICE_ROLE (bypassa RLS). Esto es el
  //    USO CORRECTO de SUPABASE_SERVICE_ROLE_KEY: como credencial
  //    interna para que la function escriba en BD. Lo que NO hacemos
  //    es usarla como secret de auth del request entrante — para eso
  //    está WEBHOOK_SECRET (ver doc del header).
  const sb = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  // 5) Cargar flujos activos de la empresa del evento.
  const { data: flujos, error: errFlujos } = await sb
    .from('flujos')
    .select('id, empresa_id, nombre, activo, disparador')
    .eq('empresa_id', evento.empresa_id)
    .eq('activo', true)

  if (errFlujos) {
    console.error(JSON.stringify({
      nivel: 'error',
      mensaje: 'error_load_flujos',
      detalle: errFlujos.message,
    }))
    return jsonResponse(500, { ok: false, error: 'load_flujos_failed' })
  }

  // 6) Match.
  const matched = matchearFlujos(evento, (flujos ?? []) as Flujo[])

  // 7) Insertar una ejecucion por flujo matcheado, capturando
  //    unique_violation para idempotencia.
  let creadas = 0
  let yaExistian = 0
  for (const flujo of matched) {
    const clave = armarClaveIdempotencia(flujo.id, evento.id)

    // Contexto inicial mínimo. PR 16 lo enriquece con datos de la
    // entidad disparadora, actor, empresa, etc.
    const contextoInicial = {
      trigger: {
        tipo: 'entidad.estado_cambio',
        cambios_estado_id: evento.id,
        fecha: evento.creado_en,
      },
      entidad: {
        tipo: evento.entidad_tipo,
        id: evento.entidad_id,
      },
      cambio: {
        estado_anterior: evento.estado_anterior,
        estado_nuevo: evento.estado_nuevo,
      },
    }

    const { error: errIns } = await sb.from('ejecuciones_flujo').insert({
      empresa_id: evento.empresa_id,
      flujo_id: flujo.id,
      estado: 'pendiente',
      disparado_por: `cambios_estado:${evento.id}`,
      contexto_inicial: contextoInicial,
      clave_idempotencia: clave,
    })

    if (errIns) {
      // Postgres unique_violation = SQLSTATE 23505
      if (errIns.code === '23505') {
        yaExistian += 1
      } else {
        console.error(JSON.stringify({
          nivel: 'error',
          mensaje: 'error_insert_ejecucion',
          flujo_id: flujo.id,
          codigo: errIns.code,
          detalle: errIns.message,
        }))
        return jsonResponse(500, { ok: false, error: 'insert_ejecucion_failed' })
      }
    } else {
      creadas += 1
    }
  }

  // 8) Log estructurado mínimo (sin datos sensibles).
  console.log(JSON.stringify({
    nivel: 'info',
    cambios_estado_id: evento.id,
    entidad_tipo: evento.entidad_tipo,
    estado_nuevo: evento.estado_nuevo,
    flujos_matcheados: matched.length,
    ejecuciones_creadas: creadas,
    ejecuciones_existentes: yaExistian,
  }))

  return jsonResponse(200, {
    ok: true,
    flujos_matcheados: matched.length,
    ejecuciones_creadas: creadas,
    ejecuciones_existentes: yaExistian,
  })
})
