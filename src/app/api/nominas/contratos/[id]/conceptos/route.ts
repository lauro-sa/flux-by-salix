/**
 * /api/nominas/contratos/[id]/conceptos
 *
 * GET  → lista los conceptos asignados al contrato con detalle del catálogo.
 *        Devuelve también los conceptos del catálogo NO asignados (para
 *        que la UI pueda mostrar los toggles sin un segundo fetch).
 *
 * PUT  → batch replace. Recibe { conceptos: [{concepto_id, valor_override?}] }
 *        y deja exactamente esos en `conceptos_contrato` (los que sobran
 *        se desactivan con `activo=false`, los nuevos se insertan).
 *        Usar PUT (no PATCH) porque la operación es declarativa: "estos
 *        son los conceptos que tiene este contrato". Es idempotente.
 *
 * Auth:
 *   GET → `nomina:ver_propio` (si el contrato pertenece a su miembro) o
 *         `nomina:ver_todos`.
 *   PUT → `nomina:editar`.
 *
 * Ver PLAN_MODULO_NOMINAS.md (PR 6b).
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

  // Conceptos asignados al contrato (incluye inactivos para historial,
  // la UI filtra `activo=true` para los toggles).
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

  // Estado actual: todas las asignaciones (incluso inactivas) — vamos a
  // reactivar las que vuelvan y desactivar las que sobren.
  const { data: actuales } = await admin
    .from('conceptos_contrato')
    .select('id, concepto_id, activo, valor_override')
    .eq('empresa_id', empresaId)
    .eq('contrato_id', id)
  const porConcepto = new Map((actuales || []).map(a => [a.concepto_id, a]))

  // Calcular operaciones.
  const aDesactivar: string[] = []   // ids de filas existentes que sobran
  const aActualizar: { id: string; activo: boolean; valor_override: number | null }[] = []
  const aInsertar: { concepto_id: string; valor_override: number | null }[] = []

  for (const [conceptoId, override] of mapa) {
    const existente = porConcepto.get(conceptoId)
    if (existente) {
      // numeric(14,4) viene como string desde supabase-js: normalizamos
      // a number para que la comparación detecte cambios reales.
      const overrideExistente = existente.valor_override === null || existente.valor_override === undefined
        ? null
        : Number(existente.valor_override)
      if (!existente.activo || overrideExistente !== override) {
        aActualizar.push({ id: existente.id, activo: true, valor_override: override })
      }
    } else {
      aInsertar.push({ concepto_id: conceptoId, valor_override: override })
    }
  }
  for (const [conceptoIdActual, fila] of porConcepto) {
    if (!mapa.has(conceptoIdActual) && fila.activo) aDesactivar.push(fila.id)
  }

  // Ejecutar — en serie, sin transacción explícita (Supabase no la expone
  // por REST). Si una falla, devolvemos error y dejamos que la UI vuelva
  // a llamar; el endpoint es idempotente.
  if (aDesactivar.length > 0) {
    const { error } = await admin
      .from('conceptos_contrato')
      .update({ activo: false })
      .in('id', aDesactivar)
    if (error) {
      console.error('[contratos/conceptos] PUT desactivar error:', error)
      return NextResponse.json({ error: 'Error al desactivar conceptos' }, { status: 500 })
    }
  }
  for (const upd of aActualizar) {
    const { error } = await admin
      .from('conceptos_contrato')
      .update({ activo: upd.activo, valor_override: upd.valor_override })
      .eq('id', upd.id)
    if (error) {
      console.error('[contratos/conceptos] PUT actualizar error:', error)
      return NextResponse.json({ error: 'Error al actualizar conceptos' }, { status: 500 })
    }
  }
  if (aInsertar.length > 0) {
    const { error } = await admin
      .from('conceptos_contrato')
      .insert(aInsertar.map(i => ({
        empresa_id: empresaId,
        contrato_id: id,
        concepto_id: i.concepto_id,
        valor_override: i.valor_override,
        activo: true,
        creado_por: user.id,
      })))
    if (error) {
      console.error('[contratos/conceptos] PUT insertar error:', error)
      return NextResponse.json({ error: 'Error al insertar conceptos' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
