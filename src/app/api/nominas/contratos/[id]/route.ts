/**
 * /api/nominas/contratos/[id]
 *
 * GET   → detalle de un contrato.
 * PATCH → tres modos según el body:
 *         - `{ accion: 'terminar', fecha_fin, motivo_fin, nota_fin? }`:
 *           cierra el contrato (vigente=false + fecha_fin + motivo).
 *           El empleado deja de aparecer en Liquidaciones siguientes.
 *         - `{ accion: 'editar', ...campos }`: corrige un contrato
 *           cargado por error. Campos administrativos (sector, turno,
 *           condicion, regimen, fecha_inicio, motivo_cambio, notas,
 *           pdf_url) son libres. Campos económicos (modalidad_calculo,
 *           monto_base, frecuencia_pago) requieren que NO existan
 *           pagos_nomina con este contrato_id — sino se devuelve 409
 *           pidiendo usar "Cambiar condiciones" en su lugar.
 *         - `{ motivo_cambio?, notas?, pdf_url? }`: edición de campos
 *           administrativos sin discriminador (legacy, sigue funcionando).
 *
 * Auth: GET con `nomina:ver_propio` o `nomina:ver_todos`; PATCH con
 * `nomina:editar`.
 */

import { NextResponse, type NextRequest } from 'next/server'
import { obtenerUsuarioRuta } from '@/lib/supabase/servidor'
import { verificarVisibilidad, requerirPermisoAPI } from '@/lib/permisos-servidor'
import { crearClienteAdmin } from '@/lib/supabase/admin'
import type {
  ContratoLaboral,
  MotivoFinContrato,
  CondicionContrato,
  ModalidadCalculo,
  FrecuenciaPago,
  RegimenContrato,
} from '@/tipos/nominas'

const MOTIVOS_VALIDOS: MotivoFinContrato[] = [
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

interface Params {
  params: Promise<{ id: string }>
}

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
  const { data, error } = await admin
    .from('contratos_laborales')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[contratos:id] GET error:', error)
    return NextResponse.json({ error: 'Error al cargar contrato' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })

  // ver_propio: validar que el contrato es del miembro vinculado al usuario.
  if (vis.soloPropio) {
    const { data: miembroPropio } = await admin
      .from('miembros')
      .select('id')
      .eq('empresa_id', empresaId)
      .eq('usuario_id', user.id)
      .maybeSingle()
    if (!miembroPropio || miembroPropio.id !== data.miembro_id) {
      return NextResponse.json({ error: 'Sin permiso para este contrato' }, { status: 403 })
    }
  }

  return NextResponse.json({ contrato: data as ContratoLaboral })
}

// ════════════════════════════════════════════════════════════════
// PATCH — dos modos: terminar o editar campos administrativos
// ════════════════════════════════════════════════════════════════

interface PayloadEditar {
  motivo_cambio?: string | null
  notas?: string | null
  pdf_url?: string | null
}

interface PayloadTerminar {
  accion: 'terminar'
  fecha_fin: string
  motivo_fin: MotivoFinContrato
  nota_fin?: string | null
}

/**
 * Edición completa del contrato. Campos económicos requieren que no
 * existan pagos_nomina asociados (sino se rechaza con 409 y el operador
 * tiene que ir por "Cambiar condiciones" → contrato nuevo).
 */
interface PayloadEditarCompleto {
  accion: 'editar'
  // Administrativos (libres)
  sector_id?: string | null
  turno_id?: string | null
  condicion?: CondicionContrato
  regimen?: RegimenContrato
  fecha_inicio?: string
  motivo_cambio?: string | null
  notas?: string | null
  pdf_url?: string | null
  // Económicos (bloqueados si hay pagos)
  modalidad_calculo?: ModalidadCalculo
  monto_base?: number
  frecuencia_pago?: FrecuenciaPago
}

type PayloadPatch = PayloadEditar | PayloadTerminar | PayloadEditarCompleto

const CAMPOS_EDITABLES: (keyof PayloadEditar)[] = ['motivo_cambio', 'notas', 'pdf_url']
const CONDICIONES: CondicionContrato[] = ['tiempo_indeterminado', 'plazo_fijo', 'temporal', 'pasantia', 'otro']
const MODALIDADES: ModalidadCalculo[] = ['por_hora', 'por_dia', 'fijo_semanal', 'fijo_quincenal', 'fijo_mensual']
const FRECUENCIAS: FrecuenciaPago[] = ['diaria', 'semanal', 'quincenal', 'mensual']
const REGIMENES: RegimenContrato[] = ['informal', 'monotributo', 'relacion_dependencia']
const CAMPOS_ECONOMICOS: (keyof PayloadEditarCompleto)[] = ['modalidad_calculo', 'monto_base', 'frecuencia_pago']

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const guard = await requerirPermisoAPI('nomina', 'editar')
  if ('respuesta' in guard) return guard.respuesta
  const { user, empresaId } = guard

  let body: PayloadPatch
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const admin = crearClienteAdmin()

  // ─── Modo terminar: cierra el contrato vigente ───
  if ('accion' in body && body.accion === 'terminar') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.fecha_fin ?? '')) {
      return NextResponse.json({ error: 'fecha_fin inválida (YYYY-MM-DD)' }, { status: 400 })
    }
    if (!MOTIVOS_VALIDOS.includes(body.motivo_fin)) {
      return NextResponse.json({ error: 'motivo_fin inválido' }, { status: 400 })
    }
    if (body.motivo_fin === 'otro' && !body.nota_fin?.trim()) {
      return NextResponse.json({ error: 'Motivo "otro" requiere una nota.' }, { status: 400 })
    }

    // Cargar contrato para validar coherencia (no terminar uno ya cerrado,
    // fecha_fin no anterior al inicio).
    const { data: actual } = await admin
      .from('contratos_laborales')
      .select('id, fecha_inicio, fecha_fin, vigente')
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .maybeSingle()

    if (!actual) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })
    if (!actual.vigente) {
      return NextResponse.json({ error: 'El contrato ya está cerrado.' }, { status: 409 })
    }
    if (body.fecha_fin < actual.fecha_inicio) {
      return NextResponse.json({
        error: `La fecha de baja no puede ser anterior al inicio del contrato (${actual.fecha_inicio}).`,
      }, { status: 400 })
    }

    const { data, error } = await admin
      .from('contratos_laborales')
      .update({
        vigente: false,
        fecha_fin: body.fecha_fin,
        motivo_fin: body.motivo_fin,
        nota_fin: body.nota_fin ?? null,
        actualizado_por: user.id,
      })
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('[contratos:id] PATCH terminar error:', error)
      return NextResponse.json({ error: 'No se pudo cerrar el contrato' }, { status: 500 })
    }

    return NextResponse.json({ contrato: data as ContratoLaboral })
  }

  // ─── Modo edición completa ('accion': 'editar') ───
  // Permite corregir un contrato cargado por error sin tener que crear
  // uno nuevo. Distingue dos clases de campos:
  //   - Administrativos: libres (no afectan recibos).
  //   - Económicos: solo si no hay pagos_nomina asociados; sino 409.
  if ('accion' in body && body.accion === 'editar') {
    const pe = body as PayloadEditarCompleto

    // Validaciones de tipo cuando vienen campos
    if (pe.condicion !== undefined && !CONDICIONES.includes(pe.condicion)) {
      return NextResponse.json({ error: 'condicion inválida' }, { status: 400 })
    }
    if (pe.regimen !== undefined && !REGIMENES.includes(pe.regimen)) {
      return NextResponse.json({ error: 'regimen inválido' }, { status: 400 })
    }
    if (pe.modalidad_calculo !== undefined && !MODALIDADES.includes(pe.modalidad_calculo)) {
      return NextResponse.json({ error: 'modalidad_calculo inválida' }, { status: 400 })
    }
    if (pe.frecuencia_pago !== undefined && !FRECUENCIAS.includes(pe.frecuencia_pago)) {
      return NextResponse.json({ error: 'frecuencia_pago inválida' }, { status: 400 })
    }
    if (pe.monto_base !== undefined && (typeof pe.monto_base !== 'number' || pe.monto_base < 0)) {
      return NextResponse.json({ error: 'monto_base debe ser un número ≥ 0' }, { status: 400 })
    }
    if (pe.fecha_inicio !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(pe.fecha_inicio)) {
      return NextResponse.json({ error: 'fecha_inicio inválida (YYYY-MM-DD)' }, { status: 400 })
    }

    // Si vienen campos económicos, verificar que no haya pagos asociados.
    // El snapshot del recibo histórico es inmutable, pero permitir editar
    // retroactivamente el contrato cuando ya hay pagos generaría
    // inconsistencia (siguientes liquidaciones cambian de monto sin
    // motivo registrado). La regla: si hay recibos pagados, va por el
    // flujo "Cambiar condiciones" que crea un contrato nuevo.
    const traeEconomicos = CAMPOS_ECONOMICOS.some(c => c in pe)
    if (traeEconomicos) {
      const { count, error: errCount } = await admin
        .from('pagos_nomina')
        .select('id', { count: 'exact', head: true })
        .eq('empresa_id', empresaId)
        .eq('contrato_id', id)
      if (errCount) {
        console.error('[contratos:id] error verificando pagos:', errCount)
        return NextResponse.json({ error: 'No se pudo verificar el historial de pagos' }, { status: 500 })
      }
      if ((count ?? 0) > 0) {
        return NextResponse.json({
          error: 'Este contrato ya tiene recibos generados. Para cambiar el monto, modalidad o frecuencia usá "Cambiar condiciones" (crea un contrato nuevo desde la fecha que elijas).',
          codigo: 'PAGOS_EXISTENTES',
        }, { status: 409 })
      }
    }

    // Armar UPDATE solo con campos que vinieron en el payload.
    const update: Record<string, unknown> = { actualizado_por: user.id }
    if ('sector_id' in pe) update.sector_id = pe.sector_id
    if ('turno_id' in pe) update.turno_id = pe.turno_id
    if ('condicion' in pe) update.condicion = pe.condicion
    if ('regimen' in pe) update.regimen = pe.regimen
    if ('fecha_inicio' in pe) update.fecha_inicio = pe.fecha_inicio
    if ('motivo_cambio' in pe) update.motivo_cambio = pe.motivo_cambio
    if ('notas' in pe) update.notas = pe.notas
    if ('pdf_url' in pe) update.pdf_url = pe.pdf_url
    if ('modalidad_calculo' in pe) update.modalidad_calculo = pe.modalidad_calculo
    if ('monto_base' in pe) update.monto_base = pe.monto_base
    if ('frecuencia_pago' in pe) update.frecuencia_pago = pe.frecuencia_pago

    if (Object.keys(update).length === 1) {
      return NextResponse.json({ error: 'No se envió ningún campo a editar' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('contratos_laborales')
      .update(update)
      .eq('empresa_id', empresaId)
      .eq('id', id)
      .select()
      .maybeSingle()

    if (error) {
      console.error('[contratos:id] PATCH editar error:', error)
      return NextResponse.json({ error: 'Error al editar contrato' }, { status: 500 })
    }
    if (!data) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })

    // Doble escritura legacy de miembros.compensacion_* si se editaron
    // económicos. Coherente con POST /contratos.
    if (traeEconomicos && data) {
      const tipoLegacy = data.modalidad_calculo === 'por_hora' ? 'por_hora'
        : data.modalidad_calculo === 'por_dia' ? 'por_dia'
        : 'fijo'
      const frecLegacy = data.frecuencia_pago === 'diaria' ? 'mensual' : data.frecuencia_pago
      await admin
        .from('miembros')
        .update({
          compensacion_tipo: tipoLegacy,
          compensacion_monto: data.monto_base,
          compensacion_frecuencia: frecLegacy,
        })
        .eq('id', data.miembro_id)
        .eq('empresa_id', empresaId)
    }

    return NextResponse.json({ contrato: data as ContratoLaboral })
  }

  // ─── Modo edición administrativa ───
  // Whitelist: descartamos cualquier otro campo. Si alguien manda
  // `monto_base`, lo ignoramos silenciosamente — la regla de negocio
  // (cambios económicos = contrato nuevo) se enforza acá.
  const editar = body as PayloadEditar
  const update: Record<string, unknown> = { actualizado_por: user.id }
  for (const campo of CAMPOS_EDITABLES) {
    if (campo in editar) update[campo] = editar[campo]
  }

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'No se envió ningún campo editable' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('contratos_laborales')
    .update(update)
    .eq('empresa_id', empresaId)
    .eq('id', id)
    .select()
    .maybeSingle()

  if (error) {
    console.error('[contratos:id] PATCH error:', error)
    return NextResponse.json({ error: 'Error al actualizar contrato' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Contrato no encontrado' }, { status: 404 })

  return NextResponse.json({ contrato: data as ContratoLaboral })
}
