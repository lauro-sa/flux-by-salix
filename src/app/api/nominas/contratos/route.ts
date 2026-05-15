/**
 * /api/nominas/contratos
 *
 * GET  ?miembro_id=... → lista todos los contratos de un miembro
 *                       (vigente primero, después históricos por fecha
 *                       de inicio descendente).
 * POST                 → crea un contrato nuevo y, si ya existía uno
 *                       vigente para el miembro, lo cierra con
 *                       `fecha_fin = nuevo.fecha_inicio - 1 día` y
 *                       `vigente = false`. También sincroniza los
 *                       campos legacy `miembros.compensacion_*` para
 *                       no romper consumidores que aún los lean
 *                       (doble escritura — se cerrará en un PR futuro).
 *
 * Auth: requiere permiso `nomina:editar` para POST y `nomina:ver_propio`
 * o `nomina:ver_todos` para GET.
 *
 * Ver PLAN_MODULO_NOMINAS.md (PR 5) para el contexto.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { verificarVisibilidad, requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import type {
  ContratoLaboral,
  CondicionContrato,
  ModalidadCalculo,
  FrecuenciaPago,
  RegimenContrato,
  MotivoFinContrato,
} from '@/tipos/nominas'

// ════════════════════════════════════════════════════════════════
// GET
// ════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const { user } = await obtenerUsuarioRuta()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const empresaId = user.app_metadata?.empresa_activa_id
  if (!empresaId) return NextResponse.json({ error: 'Sin empresa activa' }, { status: 403 })

  const vis = await verificarVisibilidad(user.id, empresaId, 'nomina')
  if (!vis) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 })

  const miembroId = request.nextUrl.searchParams.get('miembro_id')
  if (!miembroId) {
    return NextResponse.json({ error: 'Parámetro miembro_id requerido' }, { status: 400 })
  }

  // Si el usuario solo tiene ver_propio, restringir al miembro vinculado
  // a su usuario en esta empresa. ver_todos accede a cualquier miembro.
  const admin = crearClienteAdmin()
  if (vis.soloPropio) {
    const { data: miembroPropio } = await admin
      .from('miembros')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)
      .maybeSingle()
    if (!miembroPropio || miembroPropio.id !== miembroId) {
      return NextResponse.json({ error: 'Sin permiso para este miembro' }, { status: 403 })
    }
  }

  const { data, error } = await admin
    .from('contratos_laborales')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('miembro_id', miembroId)
    .order('vigente', { ascending: false })
    .order('fecha_inicio', { ascending: false })

  if (error) {
    console.error('[contratos] GET error:', error)
    return NextResponse.json({ error: 'Error al listar contratos' }, { status: 500 })
  }

  return NextResponse.json({ contratos: (data || []) as ContratoLaboral[] })
}

// ════════════════════════════════════════════════════════════════
// POST
// ════════════════════════════════════════════════════════════════

interface PayloadCrearContrato {
  miembro_id: string
  fecha_inicio: string
  condicion: CondicionContrato
  modalidad_calculo: ModalidadCalculo
  monto_base: number
  frecuencia_pago: FrecuenciaPago
  sector_id?: string | null
  turno_id?: string | null
  regimen?: RegimenContrato
  pdf_url?: string | null
  motivo_cambio?: string | null
  notas?: string | null
  /**
   * Asignación inicial de conceptos. Si se omite y existe contrato
   * vigente anterior, se heredan automáticamente los conceptos activos
   * de ese contrato (caso típico "subo el sueldo y mantengo todo lo demás").
   * Si viene `[]` explícito, se crea sin conceptos.
   */
  conceptos?: { concepto_id: string; valor_override?: number | null }[]
  /**
   * Motivo con el que se cierra el contrato vigente anterior (si existe).
   * Permite distinguir entre un cambio de condiciones, una renovación,
   * un fin de plazo, etc. Sin este dato el cierre queda sin motivo,
   * comportamiento histórico previo a esta extensión.
   */
  motivo_fin?: MotivoFinContrato | null
  /** Nota libre sobre el cierre del contrato anterior. */
  nota_fin?: string | null
}

const MOTIVOS_FIN: MotivoFinContrato[] = [
  'renuncia',
  'despido_con_causa',
  'despido_sin_causa',
  'fin_plazo',
  'mutuo_acuerdo',
  'abandono',
  'jubilacion',
  'fallecimiento',
  'cambio_condiciones',
  'renovacion',
  'otro',
]

const CONDICIONES: CondicionContrato[] = ['tiempo_indeterminado', 'plazo_fijo', 'temporal', 'pasantia', 'otro']
const MODALIDADES: ModalidadCalculo[] = ['por_hora', 'por_dia', 'fijo_semanal', 'fijo_quincenal', 'fijo_mensual']
const FRECUENCIAS: FrecuenciaPago[] = ['diaria', 'semanal', 'quincenal', 'mensual']
const REGIMENES: RegimenContrato[] = ['informal', 'monotributo', 'relacion_dependencia']

export async function POST(request: NextRequest) {
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let body: PayloadCrearContrato
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  // ─── Validaciones de payload ───
  if (!body.miembro_id) return NextResponse.json({ error: 'miembro_id requerido' }, { status: 400 })
  if (!body.fecha_inicio || !/^\d{4}-\d{2}-\d{2}$/.test(body.fecha_inicio)) {
    return NextResponse.json({ error: 'fecha_inicio inválida (YYYY-MM-DD)' }, { status: 400 })
  }
  if (!CONDICIONES.includes(body.condicion)) {
    return NextResponse.json({ error: 'condicion inválida' }, { status: 400 })
  }
  if (!MODALIDADES.includes(body.modalidad_calculo)) {
    return NextResponse.json({ error: 'modalidad_calculo inválida' }, { status: 400 })
  }
  if (!FRECUENCIAS.includes(body.frecuencia_pago)) {
    return NextResponse.json({ error: 'frecuencia_pago inválida' }, { status: 400 })
  }
  if (typeof body.monto_base !== 'number' || body.monto_base < 0) {
    return NextResponse.json({ error: 'monto_base debe ser un número ≥ 0' }, { status: 400 })
  }
  const regimen: RegimenContrato = body.regimen && REGIMENES.includes(body.regimen) ? body.regimen : 'informal'

  // Validar motivo_fin si vino en el payload. Si llega vacío/null
  // queda como antes (se cierra sin motivo). "otro" exige nota_fin.
  let motivoFin: MotivoFinContrato | null = null
  if (body.motivo_fin) {
    if (!MOTIVOS_FIN.includes(body.motivo_fin)) {
      return NextResponse.json({ error: 'motivo_fin inválido' }, { status: 400 })
    }
    if (body.motivo_fin === 'otro' && !body.nota_fin?.trim()) {
      return NextResponse.json({ error: 'Motivo "otro" requiere una nota.' }, { status: 400 })
    }
    motivoFin = body.motivo_fin
  }
  const notaFin = body.nota_fin?.trim() || null

  const admin = crearClienteAdmin()

  // Confirmar que el miembro pertenece a la empresa (RLS + safety).
  const { data: miembro, error: errMiembro } = await admin
    .from('miembros')
    .select('id, empresa_id')
    .eq('id', body.miembro_id)
    .eq('empresa_id', empresaId)
    .maybeSingle()
  if (errMiembro || !miembro) {
    return NextResponse.json({ error: 'Miembro no encontrado en esta empresa' }, { status: 404 })
  }

  // ─── Cerrar contrato vigente anterior (si existe) ───
  // Lo cerramos con fecha_fin = nuevo.fecha_inicio - 1 día. Si el cierre
  // resulta en fecha_fin < fecha_inicio del contrato anterior, devolvemos
  // error: el contrato nuevo no puede empezar antes que el anterior.
  const { data: vigentePrev } = await admin
    .from('contratos_laborales')
    .select('id, fecha_inicio')
    .eq('empresa_id', empresaId)
    .eq('miembro_id', body.miembro_id)
    .eq('vigente', true)
    .maybeSingle()

  const fechaFinAnterior = restarUnDia(body.fecha_inicio)

  if (vigentePrev && vigentePrev.fecha_inicio > fechaFinAnterior) {
    return NextResponse.json({
      error: `El nuevo contrato no puede empezar antes del ${vigentePrev.fecha_inicio} (inicio del contrato actual)`,
    }, { status: 400 })
  }

  if (vigentePrev) {
    const { error: errCierre } = await admin
      .from('contratos_laborales')
      .update({
        vigente: false,
        fecha_fin: fechaFinAnterior,
        motivo_fin: motivoFin,
        nota_fin: notaFin,
        actualizado_por: user.id,
      })
      .eq('id', vigentePrev.id)
    if (errCierre) {
      console.error('[contratos] error al cerrar vigente anterior:', errCierre)
      return NextResponse.json({ error: 'No se pudo cerrar el contrato vigente anterior' }, { status: 500 })
    }
  }

  // ─── Crear contrato nuevo ───
  const { data: nuevo, error: errCreate } = await admin
    .from('contratos_laborales')
    .insert({
      empresa_id: empresaId,
      miembro_id: body.miembro_id,
      fecha_inicio: body.fecha_inicio,
      vigente: true,
      condicion: body.condicion,
      modalidad_calculo: body.modalidad_calculo,
      monto_base: body.monto_base,
      frecuencia_pago: body.frecuencia_pago,
      sector_id: body.sector_id ?? null,
      turno_id: body.turno_id ?? null,
      regimen,
      pdf_url: body.pdf_url ?? null,
      motivo_cambio: body.motivo_cambio ?? null,
      notas: body.notas ?? null,
      creado_por: user.id,
      actualizado_por: user.id,
    })
    .select()
    .single()

  if (errCreate || !nuevo) {
    console.error('[contratos] error al crear nuevo:', errCreate)
    return NextResponse.json({ error: 'No se pudo crear el contrato' }, { status: 500 })
  }

  // ─── Asignación inicial de conceptos ───
  // Prioridad: payload explícito > herencia del vigente anterior > vacío.
  // El array vacío explícito (body.conceptos === []) crea sin conceptos.
  let conceptosIniciales: { concepto_id: string; valor_override: number | null }[] = []
  if (Array.isArray(body.conceptos)) {
    conceptosIniciales = body.conceptos
      .filter(c => c.concepto_id)
      .map(c => ({ concepto_id: c.concepto_id, valor_override: c.valor_override ?? null }))
  } else if (vigentePrev) {
    const { data: heredables } = await admin
      .from('conceptos_contrato')
      .select('concepto_id, valor_override')
      .eq('empresa_id', empresaId)
      .eq('contrato_id', vigentePrev.id)
      .eq('activo', true)
    conceptosIniciales = (heredables || []).map(h => ({
      concepto_id: h.concepto_id,
      valor_override: h.valor_override,
    }))
  }

  if (conceptosIniciales.length > 0) {
    const { error: errConceptos } = await admin
      .from('conceptos_contrato')
      .insert(conceptosIniciales.map(c => ({
        empresa_id: empresaId,
        contrato_id: nuevo.id,
        concepto_id: c.concepto_id,
        valor_override: c.valor_override,
        activo: true,
        creado_por: user.id,
      })))
    if (errConceptos) {
      // No fallamos el endpoint — el contrato ya está creado. Logueamos
      // y dejamos que el usuario reasigne desde la ficha si hace falta.
      console.error('[contratos] error al asignar conceptos iniciales:', errConceptos)
    }
  }

  // ─── Doble escritura legacy en miembros.compensacion_* ───
  // El refactor a eliminar estos campos vive en un PR futuro; mientras
  // tanto los mantenemos sincronizados para no romper consumidores
  // (dashboard, salix-ia, vistas viejas) que aún los lean.
  const compensacionTipo = compensacionTipoDesdeModalidad(body.modalidad_calculo)
  const compensacionFrecuencia = body.frecuencia_pago // mismo enum por suerte (sin 'diaria' en legacy → mapeamos a 'mensual' para no romper CHECK)
  const compensacionFrecuenciaLegacy = compensacionFrecuencia === 'diaria' ? 'mensual' : compensacionFrecuencia
  await admin
    .from('miembros')
    .update({
      compensacion_tipo: compensacionTipo,
      compensacion_monto: body.monto_base,
      compensacion_frecuencia: compensacionFrecuenciaLegacy,
    })
    .eq('id', body.miembro_id)
    .eq('empresa_id', empresaId)

  return NextResponse.json({ contrato: nuevo as ContratoLaboral }, { status: 201 })
}

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

/** Resta 1 día a una fecha YYYY-MM-DD en horario neutral (UTC midday). */
function restarUnDia(fechaIso: string): string {
  const [y, m, d] = fechaIso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  dt.setUTCDate(dt.getUTCDate() - 1)
  return dt.toISOString().slice(0, 10)
}

/**
 * Mapea modalidad_calculo (nuevo) → compensacion_tipo (legacy en miembros).
 * Los enums no son 1:1: el legacy tenía 3 valores, el nuevo 5.
 */
function compensacionTipoDesdeModalidad(m: ModalidadCalculo): 'fijo' | 'por_dia' | 'por_hora' {
  if (m === 'por_hora') return 'por_hora'
  if (m === 'por_dia') return 'por_dia'
  return 'fijo'
}
