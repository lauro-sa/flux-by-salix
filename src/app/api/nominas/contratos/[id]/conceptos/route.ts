/**
 * /api/nominas/contratos/[id]/conceptos
 *
 * GET  → lista los conceptos asignados al contrato con detalle del catálogo.
 *        Devuelve también los conceptos del catálogo NO asignados (para
 *        que la UI pueda mostrar los toggles sin un segundo fetch).
 *
 *        Incluye TODAS las asignaciones (vigentes + cerradas) para que
 *        la UI pueda mostrar historial. Las vigentes son las que tienen
 *        `fecha_baja IS NULL`.
 *
 * PUT  → batch replace declarativo. Recibe
 *          { conceptos: [{ concepto_id, valor_override? }] }
 *        y deja exactamente esos como vigentes. Operaciones:
 *          - Concepto NUEVO en payload     → crea fila con fecha_alta=hoy.
 *          - Concepto YA vigente en payload → si override cambió, update.
 *          - Concepto vigente NO en payload → cierra con fecha_baja=hoy.
 *        Cada cambio queda registrado en `auditoria_conceptos_contrato`
 *        con quién y cuándo (alta / baja / override).
 *
 * Auth:
 *   GET → `nomina:ver_propio` (si el contrato pertenece a su miembro) o
 *         `nomina:ver_todos`.
 *   PUT → `nomina:editar`.
 *
 * Ver PLAN_MODULO_NOMINAS.md (PR 6b) y sql/091_vigencia_conceptos_contrato.sql.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { verificarVisibilidad, requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import type { ConceptoContratoConDetalle, ConceptoNomina } from '@/tipos/nominas'

interface Params { params: Promise<{ id: string }> }

// ════════════════════════════════════════════════════════════════
// GET
// ════════════════════════════════════════════════════════════════

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  const { user } = await obtenerUsuarioRuta()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

  const vis = await verificarVisibilidad(user.id, empresaId, 'nomina')
  if (!vis) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const admin = crearClienteAdmin()

  // Confirmar que el contrato existe y pertenece a la empresa. Si el
  // usuario es soloPropio, también que sea su contrato.
  const { data: contrato } = await admin
    .from('contratos_laborales')
    .select('id, miembro_id')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })

  if (vis.soloPropio) {
    const { data: miembroPropio } = await admin
      .from('miembros')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)
      .maybeSingle()
    if (!miembroPropio || miembroPropio.id !== contrato.miembro_id) {
      return NextResponse.json({ error: 'Sin permiso para este contrato' }, { status: 403 })
    }
  }

  // Conceptos asignados al contrato. Devolvemos TODAS las filas
  // (vigentes + cerradas) para que la UI pueda mostrar historial.
  // Las vigentes son las que tienen `fecha_baja IS NULL`. Ordenamos
  // por fecha_alta desc para que las altas más recientes aparezcan
  // primero en la timeline.
  const { data: asignaciones, error: errAsig } = await admin
    .from('conceptos_contrato')
    .select(`
      *,
      concepto:conceptos_nomina (
        nombre, descripcion, icono, color, tipo, categoria,
        modo_calculo, valor, automatico, recurrente
      )
    `)
    .eq('empresa_id', empresaId)
    .eq('contrato_id', id)
    .order('fecha_alta', { ascending: false })

  if (errAsig) {
    console.error('[contratos/conceptos] GET asignaciones error:', errAsig)
    return NextResponse.json({ error: 'Error al listar conceptos' }, { status: 500 })
  }

  // Catálogo completo (activos) — para que la UI pueda mostrar los
  // toggles disponibles sin hacer otro fetch.
  const { data: catalogo } = await admin
    .from('conceptos_nomina')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('activo', true)
    .order('tipo', { ascending: true })
    .order('orden', { ascending: true })

  return NextResponse.json({
    asignaciones: (asignaciones || []) as ConceptoContratoConDetalle[],
    catalogo: (catalogo || []) as ConceptoNomina[],
  })
}

// ════════════════════════════════════════════════════════════════
// PUT (batch replace)
// ════════════════════════════════════════════════════════════════

interface ItemPayload {
  concepto_id: string
  valor_override?: number | null
}

interface PayloadPut {
  conceptos: ItemPayload[]
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let body: PayloadPut
  try { body = await request.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  if (!Array.isArray(body.conceptos)) {
    return NextResponse.json({ error: 'conceptos debe ser un array' }, { status: 400 })
  }

  const admin = crearClienteAdmin()

  // Confirmar contrato.
  const { data: contrato } = await admin
    .from('contratos_laborales')
    .select('id')
    .eq('id', id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (!contrato) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })

  // Normalizar payload + deduplicar por concepto_id (último gana).
  const mapa = new Map<string, number | null>()
  for (const item of body.conceptos) {
    if (!item.concepto_id || typeof item.concepto_id !== 'string') continue
    const override = item.valor_override
    if (override !== undefined && override !== null && !Number.isFinite(override)) {
      return NextResponse.json({ error: 'valor_override inválido' }, { status: 400 })
    }
    mapa.set(item.concepto_id, override ?? null)
  }
  const idsNuevos = Array.from(mapa.keys())

  // Validar que todos los conceptos existan en la empresa.
  if (idsNuevos.length > 0) {
    const { data: existentes } = await admin
      .from('conceptos_nomina')
      .select('id')
      .eq('empresa_id', empresaId)
      .in('id', idsNuevos)
    const setExist = new Set((existentes || []).map(c => c.id))
    const faltantes = idsNuevos.filter(x => !setExist.has(x))
    if (faltantes.length > 0) {
      return NextResponse.json({ error: `Conceptos no encontrados: ${faltantes.join(', ')}` }, { status: 400 })
    }
  }

  // Estado actual: solo asignaciones VIGENTES (fecha_baja IS NULL). Las
  // cerradas quedan como historia y no se tocan — si el operador
  // reactiva un concepto, se crea una fila NUEVA con fecha_alta=hoy.
  const { data: actuales } = await admin
    .from('conceptos_contrato')
    .select('id, concepto_id, valor_override, fecha_alta, fecha_baja')
    .eq('empresa_id', empresaId)
    .eq('contrato_id', id)
    .is('fecha_baja', null)
  const porConcepto = new Map((actuales || []).map(a => [a.concepto_id, a]))

  // Fecha de hoy en formato YYYY-MM-DD (la columna es `date` en BD).
  const hoy = new Date().toISOString().slice(0, 10)

  // Calcular operaciones declarativas.
  //   - aCerrar:    filas vigentes que el payload NO incluye → fecha_baja=hoy.
  //   - aOverride:  filas vigentes en el payload con override distinto → update.
  //   - aInsertar:  conceptos del payload sin fila vigente → crear con fecha_alta=hoy.
  const aCerrar: { id: string; concepto_id: string; valor_anterior: number | null }[] = []
  const aOverride: { id: string; concepto_id: string; valor_anterior: number | null; valor_nuevo: number | null }[] = []
  const aInsertar: { concepto_id: string; valor_override: number | null }[] = []

  for (const [conceptoId, override] of mapa) {
    const existente = porConcepto.get(conceptoId)
    if (existente) {
      // numeric(14,4) viene como string desde supabase-js: normalizamos
      // a number para que la comparación detecte cambios reales.
      const overrideExistente = existente.valor_override === null || existente.valor_override === undefined
        ? null
        : Number(existente.valor_override)
      if (overrideExistente !== override) {
        aOverride.push({
          id: existente.id,
          concepto_id: conceptoId,
          valor_anterior: overrideExistente,
          valor_nuevo: override,
        })
      }
    } else {
      aInsertar.push({ concepto_id: conceptoId, valor_override: override })
    }
  }
  for (const [conceptoIdActual, fila] of porConcepto) {
    if (!mapa.has(conceptoIdActual)) {
      const overrideExistente = fila.valor_override === null || fila.valor_override === undefined
        ? null
        : Number(fila.valor_override)
      aCerrar.push({ id: fila.id, concepto_id: conceptoIdActual, valor_anterior: overrideExistente })
    }
  }

  // ─── Ejecutar cambios + auditoría ───
  // Sin transacción explícita (Supabase no la expone por REST). Si una
  // operación falla, devolvemos error; el endpoint es idempotente y
  // la UI puede reintentar. La auditoría se inserta DESPUÉS del cambio
  // para no dejar registros de operaciones que no ocurrieron.
  const auditoria: {
    accion: 'alta' | 'baja' | 'override'
    concepto_id: string
    valor_anterior: string | null
    valor_nuevo: string | null
  }[] = []

  // Cierres: setear fecha_baja=hoy (el trigger sincroniza activo=false).
  if (aCerrar.length > 0) {
    const { error } = await admin
      .from('conceptos_contrato')
      .update({ fecha_baja: hoy })
      .in('id', aCerrar.map(x => x.id))
    if (error) {
      console.error('[contratos/conceptos] PUT cerrar error:', error)
      return NextResponse.json({ error: 'Error al cerrar conceptos' }, { status: 500 })
    }
    for (const c of aCerrar) {
      auditoria.push({
        accion: 'baja',
        concepto_id: c.concepto_id,
        valor_anterior: c.valor_anterior !== null ? String(c.valor_anterior) : null,
        valor_nuevo: null,
      })
    }
  }

  // Cambios de override en filas vigentes.
  for (const upd of aOverride) {
    const { error } = await admin
      .from('conceptos_contrato')
      .update({ valor_override: upd.valor_nuevo })
      .eq('id', upd.id)
    if (error) {
      console.error('[contratos/conceptos] PUT override error:', error)
      return NextResponse.json({ error: 'Error al actualizar override' }, { status: 500 })
    }
    auditoria.push({
      accion: 'override',
      concepto_id: upd.concepto_id,
      valor_anterior: upd.valor_anterior !== null ? String(upd.valor_anterior) : null,
      valor_nuevo: upd.valor_nuevo !== null ? String(upd.valor_nuevo) : null,
    })
  }

  // Altas nuevas con fecha_alta=hoy y fecha_baja=NULL.
  if (aInsertar.length > 0) {
    const { error } = await admin
      .from('conceptos_contrato')
      .insert(aInsertar.map(i => ({
        empresa_id: empresaId,
        contrato_id: id,
        concepto_id: i.concepto_id,
        valor_override: i.valor_override,
        fecha_alta: hoy,
        fecha_baja: null,
        creado_por: user.id,
      })))
    if (error) {
      console.error('[contratos/conceptos] PUT insertar error:', error)
      return NextResponse.json({ error: 'Error al insertar conceptos' }, { status: 500 })
    }
    for (const i of aInsertar) {
      auditoria.push({
        accion: 'alta',
        concepto_id: i.concepto_id,
        valor_anterior: null,
        valor_nuevo: i.valor_override !== null ? String(i.valor_override) : null,
      })
    }
  }

  // Insertar registros de auditoría en bloque. Si falla, logueamos
  // pero no abortamos: el cambio ya está aplicado y la auditoría es
  // best-effort.
  if (auditoria.length > 0) {
    const { error: errAud } = await admin
      .from('auditoria_conceptos_contrato')
      .insert(auditoria.map(a => ({
        empresa_id: empresaId,
        contrato_id: id,
        concepto_id: a.concepto_id,
        editado_por: user.id,
        accion: a.accion,
        valor_anterior: a.valor_anterior,
        valor_nuevo: a.valor_nuevo,
      })))
    if (errAud) {
      console.error('[contratos/conceptos] PUT auditoría error:', errAud)
    }
  }

  return NextResponse.json({ ok: true })
}
