/**
 * Motor de cálculo del recibo de nómina (PR 7 del plan).
 *
 * Arquitectura en dos capas:
 *
 *   1. `calcularReciboPuro(datos)` — función pura, no toca BD. Recibe
 *      contrato, asistencias, conceptos y cuotas de adelanto ya
 *      cargados y devuelve el DetalleReciboCalculado. Es fácil de
 *      testear (ver src/lib/nominas/__tests__/motor-calculo.test.ts).
 *
 *   2. `calcularReciboDesdeBD(admin, params)` — wrapper que carga
 *      todo lo necesario desde Supabase y delega al core puro.
 *      Lo usan los endpoints `/api/nominas/calcular` y
 *      `/api/nominas/pagos`.
 *
 * El motor NO persiste el recibo: solo calcula. La persistencia
 * (insertar `pagos_nomina`, snapshot, conceptos aplicados, marcar
 * cuotas) la hace `/api/nominas/pagos` después de invocar al motor.
 *
 * Modalidad → cómo se calcula el monto base:
 *   - por_hora      → horas_netas × monto_base
 *   - por_dia       → dias_trabajados × monto_base
 *   - fijo_semanal  → monto_base prorrateado por (días_período / 7)
 *   - fijo_quincenal→ monto_base prorrateado por (días_período / 15)
 *   - fijo_mensual  → monto_base prorrateado por (días_período / 30)
 *
 * El prorrateo asume "días naturales", no días laborales. Ej: un
 * sueldo fijo mensual de $400.000 pedido para una quincena (15 días)
 * devuelve $200.000. Si el período exacto coincide con la frecuencia
 * natural, devuelve exactamente monto_base.
 *
 * Condiciones soportadas (campo condicion_jsonb): ver `CondicionConcepto`
 * en tipos/nominas.ts. Si la condición no encaja con ninguna variante
 * conocida, el motor falla-cerrado (no aplica el concepto) y lo deja
 * como sugerencia.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  ContratoLaboral,
  ContratoSnapshot,
  ConceptoNomina,
  ConceptoContratoConDetalle,
  CondicionConcepto,
  MetricasAsistencia,
  DetalleReciboCalculado,
  ConceptoAplicadoCalculado,
  CuotaAdelantoAplicada,
  TipoConcepto,
  ModoCalculoConcepto,
  ModalidadCalculo,
} from '@/tipos/nominas'

// ════════════════════════════════════════════════════════════════
// Entrada del core puro
// ════════════════════════════════════════════════════════════════

/** Fila mínima de asistencia que el motor consume. */
export interface AsistenciaInput {
  fecha: string
  estado: string | null
  tipo: string | null
  hora_entrada: string | null
  hora_salida: string | null
  inicio_almuerzo: string | null
  fin_almuerzo: string | null
  salida_particular: string | null
  vuelta_particular: string | null
}

/** Fila mínima de cuota de adelanto que el motor consume. */
export interface CuotaInput {
  id: string
  adelanto_id: string
  numero_cuota: number
  monto_cuota: number | string
  fecha_programada: string
  estado: string
}

/** Concepto asignado al contrato + detalle del catálogo. */
export interface ConceptoContratoInput {
  concepto_id: string
  valor_override: number | string | null
  concepto: ConceptoNomina
}

/**
 * Toda la data que el motor necesita para calcular un recibo,
 * pre-cargada por el caller. Tener esto desacoplado del cliente
 * Supabase es lo que permite testear el motor sin BD.
 */
export interface DatosCalculoRecibo {
  miembro_id: string
  empresa_id: string
  periodo_inicio: string
  periodo_fin: string
  contrato: ContratoLaboral | null
  asistencias: AsistenciaInput[]
  conceptos_contrato: ConceptoContratoInput[]
  cuotas_adelanto: CuotaInput[]
  /** Info de sector/turno para armar el snapshot. */
  sector: { id: string; nombre: string } | null
  turno: { id: string; nombre: string } | null
}

// ════════════════════════════════════════════════════════════════
// Core puro
// ════════════════════════════════════════════════════════════════

/**
 * Calcula el detalle completo de un recibo sin tocar BD.
 *
 * El resultado es determinístico: dados los mismos `datos`, siempre
 * devuelve el mismo `DetalleReciboCalculado`. Esto es clave para los
 * tests y para reproducir cálculos pasados.
 */
export function calcularReciboPuro(datos: DatosCalculoRecibo): DetalleReciboCalculado {
  const advertencias: string[] = []

  // ─── 1. Métricas de asistencia ───
  const asistencia = calcularMetricasAsistencia(
    datos.asistencias,
    datos.periodo_inicio,
    datos.periodo_fin,
  )

  // ─── 2. Monto base según modalidad del contrato ───
  let monto_base_calculado = 0
  if (datos.contrato) {
    monto_base_calculado = calcularMontoBase(
      datos.contrato.modalidad_calculo,
      Number(datos.contrato.monto_base),
      asistencia,
      datos.periodo_inicio,
      datos.periodo_fin,
    )
  } else {
    advertencias.push('Sin contrato laboral cargado: el monto base es 0. Cargá un contrato para que el recibo refleje el sueldo del empleado.')
  }

  // ─── 3. Aplicar conceptos automáticos del contrato ───
  const conceptos_aplicados: ConceptoAplicadoCalculado[] = []
  const conceptos_sugeridos: ConceptoAplicadoCalculado[] = []

  for (const cc of datos.conceptos_contrato) {
    const c = cc.concepto
    if (!c.activo) continue

    const valor = cc.valor_override !== null && cc.valor_override !== undefined
      ? Number(cc.valor_override)
      : (c.valor !== null && c.valor !== undefined ? Number(c.valor) : null)

    // No automático → siempre sugerencia (el operador decide).
    if (!c.automatico) {
      conceptos_sugeridos.push(armarConcepto(c, valor, 0, 'Concepto manual: el operador decide si lo agrega.'))
      continue
    }

    // Evaluar condición.
    const condicion = parsearCondicion(c.condicion_jsonb)
    const evaluacion = evaluarCondicion(condicion, asistencia, datos.contrato, datos.periodo_fin)

    if (!evaluacion.cumple) {
      // Condición no cumplida → no se aplica, queda como sugerencia.
      conceptos_sugeridos.push(armarConcepto(c, valor, 0, evaluacion.detalle))
      continue
    }

    // Calcular monto según modo_calculo.
    const monto = calcularMontoConcepto(c.modo_calculo, valor, monto_base_calculado, asistencia)
    conceptos_aplicados.push(armarConcepto(c, valor, monto, evaluacion.detalle))
  }

  // ─── 4. Cuotas de adelanto vencidas en el período ───
  // Solo aplicamos las pendientes. Las que ya están descontadas (en un
  // pago previo del mismo período) NO se vuelven a descontar.
  const adelantos_aplicados: CuotaAdelantoAplicada[] = datos.cuotas_adelanto
    .filter(q => q.estado === 'pendiente')
    .filter(q => q.fecha_programada >= datos.periodo_inicio && q.fecha_programada <= datos.periodo_fin)
    .map(q => ({
      cuota_id: q.id,
      adelanto_id: q.adelanto_id,
      numero_cuota: q.numero_cuota,
      monto: Number(q.monto_cuota),
      fecha_programada: q.fecha_programada,
    }))

  // ─── 5. Totales ───
  const haberesConceptos = conceptos_aplicados
    .filter(c => c.tipo === 'haber')
    .reduce((sum, c) => sum + c.monto, 0)
  const descuentosConceptos = conceptos_aplicados
    .filter(c => c.tipo === 'descuento')
    .reduce((sum, c) => sum + c.monto, 0)
  const totalAdelantos = adelantos_aplicados.reduce((sum, a) => sum + a.monto, 0)

  const subtotal_haberes = redondear(monto_base_calculado + haberesConceptos)
  const subtotal_descuentos = redondear(descuentosConceptos + totalAdelantos)
  const neto = redondear(subtotal_haberes - subtotal_descuentos)

  // ─── 6. Snapshot del contrato ───
  const snapshot: ContratoSnapshot | null = datos.contrato
    ? {
        contrato_id: datos.contrato.id,
        fecha_inicio: datos.contrato.fecha_inicio,
        fecha_fin: datos.contrato.fecha_fin,
        condicion: datos.contrato.condicion,
        modalidad_calculo: datos.contrato.modalidad_calculo,
        monto_base: Number(datos.contrato.monto_base),
        frecuencia_pago: datos.contrato.frecuencia_pago,
        regimen: datos.contrato.regimen,
        sector: datos.sector ? { id: datos.sector.id, nombre: datos.sector.nombre } : null,
        turno: datos.turno ? { id: datos.turno.id, nombre: datos.turno.nombre } : null,
      }
    : null

  return {
    miembro_id: datos.miembro_id,
    empresa_id: datos.empresa_id,
    periodo_inicio: datos.periodo_inicio,
    periodo_fin: datos.periodo_fin,
    asistencia,
    contrato: {
      id: datos.contrato?.id ?? null,
      snapshot,
    },
    monto_base_calculado: redondear(monto_base_calculado),
    conceptos_aplicados,
    conceptos_sugeridos,
    adelantos_aplicados,
    subtotal_haberes,
    subtotal_descuentos,
    neto,
    advertencias,
  }
}

// ════════════════════════════════════════════════════════════════
// Helpers de cálculo (exportados para tests granulares)
// ════════════════════════════════════════════════════════════════

/**
 * Calcula métricas agregadas (días trabajados, ausencias, tardanzas,
 * horas netas) a partir de las asistencias del período.
 *
 * Definiciones:
 *   - `dias_trabajados`: registros con `hora_entrada` no nula.
 *   - `dias_ausentes`: registros con `estado === 'ausente'`.
 *   - `tardanzas`: registros con `tipo === 'tardanza'`.
 *   - `horas_netas`: suma de (salida − entrada − almuerzo − particular)
 *     en horas decimales, por día con fichaje completo.
 */
export function calcularMetricasAsistencia(
  asistencias: AsistenciaInput[],
  periodoInicio: string,
  periodoFin: string,
): MetricasAsistencia {
  const dias_periodo = diferenciaEnDias(periodoInicio, periodoFin) + 1

  let dias_trabajados = 0
  let dias_ausentes = 0
  let tardanzas = 0
  let horas_netas = 0

  for (const a of asistencias) {
    if (a.fecha < periodoInicio || a.fecha > periodoFin) continue
    if (a.estado === 'ausente') dias_ausentes++
    if (a.tipo === 'tardanza') tardanzas++
    if (a.hora_entrada) {
      dias_trabajados++
      horas_netas += calcularHorasNetasDia(a)
    }
  }

  return {
    dias_periodo,
    dias_trabajados,
    dias_ausentes,
    tardanzas,
    horas_netas: redondear(horas_netas),
  }
}

/**
 * Horas netas de un día: (salida − entrada) − duración almuerzo −
 * duración salida particular. Si falta `hora_salida`, asume 0
 * (registro abierto, todavía no cerró su jornada). Las horas se
 * devuelven en decimal: 8.5 = 8h30m.
 */
export function calcularHorasNetasDia(a: AsistenciaInput): number {
  if (!a.hora_entrada || !a.hora_salida) return 0
  const entrada = horaAMinutos(a.hora_entrada)
  const salida = horaAMinutos(a.hora_salida)
  if (salida <= entrada) return 0
  let minutos = salida - entrada
  if (a.inicio_almuerzo && a.fin_almuerzo) {
    minutos -= Math.max(0, horaAMinutos(a.fin_almuerzo) - horaAMinutos(a.inicio_almuerzo))
  }
  if (a.salida_particular && a.vuelta_particular) {
    minutos -= Math.max(0, horaAMinutos(a.vuelta_particular) - horaAMinutos(a.salida_particular))
  }
  return Math.max(0, minutos / 60)
}

/**
 * Calcula el monto base según la modalidad del contrato y la
 * asistencia. Para modalidades fijas (semanal/quincenal/mensual)
 * hace prorrateo por días naturales del período.
 */
export function calcularMontoBase(
  modalidad: ModalidadCalculo,
  montoBase: number,
  asistencia: MetricasAsistencia,
  _periodoInicio: string,
  _periodoFin: string,
): number {
  if (modalidad === 'por_hora') return montoBase * asistencia.horas_netas
  if (modalidad === 'por_dia') return montoBase * asistencia.dias_trabajados

  const diasNaturales: Record<ModalidadCalculo, number> = {
    por_hora: 1,
    por_dia: 1,
    fijo_semanal: 7,
    fijo_quincenal: 15,
    fijo_mensual: 30,
  }
  const dias = diasNaturales[modalidad]
  const factor = asistencia.dias_periodo / dias
  return montoBase * factor
}

/**
 * Calcula el monto efectivo de un concepto según `modo_calculo`.
 *
 *   - `monto_fijo`         → valor
 *   - `porcentaje_basico`  → monto_base × (valor / 100)
 *   - `por_dia`            → valor × dias_trabajados
 *   - `por_evento`         → valor (lo aplica el operador manualmente, el motor solo lo sugiere)
 *   - `manual`             → 0 (siempre sugerencia, el operador escribe el monto)
 */
export function calcularMontoConcepto(
  modo: ModoCalculoConcepto,
  valor: number | null,
  montoBase: number,
  asistencia: MetricasAsistencia,
): number {
  if (valor === null) return 0
  if (modo === 'monto_fijo') return valor
  if (modo === 'porcentaje_basico') return montoBase * (valor / 100)
  if (modo === 'por_dia') return valor * asistencia.dias_trabajados
  if (modo === 'por_evento') return valor
  return 0
}

/**
 * Evalúa si una condición JSONB se cumple con los datos del período.
 * Retorna también un detalle humano para mostrar en el recibo.
 */
export function evaluarCondicion(
  condicion: CondicionConcepto | null,
  asistencia: MetricasAsistencia,
  contrato: ContratoLaboral | null,
  fechaCorte: string,
): { cumple: boolean; detalle: string } {
  if (!condicion) {
    return { cumple: false, detalle: 'Sin condición válida — queda como sugerencia.' }
  }

  switch (condicion.tipo) {
    case 'siempre':
      return { cumple: true, detalle: 'Aplica siempre.' }

    case 'sin_ausencias':
      return asistencia.dias_ausentes === 0
        ? { cumple: true, detalle: 'Cumplió: sin ausencias en el período.' }
        : { cumple: false, detalle: `No cumplió: ${asistencia.dias_ausentes} ausencia(s) en el período.` }

    case 'sin_tardanzas':
      return asistencia.tardanzas === 0
        ? { cumple: true, detalle: 'Cumplió: sin tardanzas en el período.' }
        : { cumple: false, detalle: `No cumplió: ${asistencia.tardanzas} tardanza(s) en el período.` }

    case 'minimo_dias':
      return asistencia.dias_trabajados >= condicion.dias
        ? { cumple: true, detalle: `Cumplió: ${asistencia.dias_trabajados}/${condicion.dias} días.` }
        : { cumple: false, detalle: `No cumplió: ${asistencia.dias_trabajados}/${condicion.dias} días.` }

    case 'antiguedad_minima': {
      if (!contrato) return { cumple: false, detalle: 'Sin contrato: no se puede calcular antigüedad.' }
      const meses = mesesEntre(contrato.fecha_inicio, fechaCorte)
      return meses >= condicion.meses
        ? { cumple: true, detalle: `Cumplió: ${meses} mes(es) de antigüedad ≥ ${condicion.meses}.` }
        : { cumple: false, detalle: `No cumplió: ${meses}/${condicion.meses} mes(es) de antigüedad.` }
    }
  }
}

/**
 * Convierte el JSONB libre a una condición tipada. Retorna null si no
 * matchea ninguna variante conocida (el motor falla-cerrado).
 */
export function parsearCondicion(json: Record<string, unknown> | null): CondicionConcepto | null {
  if (!json || typeof json !== 'object') return null
  const tipo = json.tipo
  if (tipo === 'siempre') return { tipo: 'siempre' }
  if (tipo === 'sin_ausencias') return { tipo: 'sin_ausencias' }
  if (tipo === 'sin_tardanzas') return { tipo: 'sin_tardanzas' }
  if (tipo === 'minimo_dias' && typeof json.dias === 'number') {
    return { tipo: 'minimo_dias', dias: json.dias }
  }
  if (tipo === 'antiguedad_minima' && typeof json.meses === 'number') {
    return { tipo: 'antiguedad_minima', meses: json.meses }
  }
  return null
}

// ════════════════════════════════════════════════════════════════
// Loader de BD + composición
// ════════════════════════════════════════════════════════════════

interface ParamsCalcularRecibo {
  miembroId: string
  empresaId: string
  periodoInicio: string
  periodoFin: string
}

/**
 * Carga todo lo necesario desde Supabase y delega al core puro. Usado
 * por los endpoints `/api/nominas/calcular` y `/api/nominas/pagos`.
 */
export async function calcularReciboDesdeBD(
  admin: SupabaseClient,
  params: ParamsCalcularRecibo,
): Promise<DetalleReciboCalculado> {
  const { miembroId, empresaId, periodoInicio, periodoFin } = params

  // ─── Contrato vigente al periodoFin ───
  // Estrategia: contrato cuya vigencia cubra el fin del período.
  // Si todos cerraron antes, tomar el más reciente (último fecha_fin).
  const { data: contratos } = await admin
    .from('contratos_laborales')
    .select('*')
    .eq('empresa_id', empresaId)
    .eq('miembro_id', miembroId)
    .lte('fecha_inicio', periodoFin)
    .order('fecha_inicio', { ascending: false })
    .limit(5)

  let contrato: ContratoLaboral | null = null
  if (contratos && contratos.length > 0) {
    // Preferir el vigente o el que cubra el periodoFin.
    contrato =
      contratos.find(c => c.vigente) ??
      contratos.find(c => !c.fecha_fin || c.fecha_fin >= periodoFin) ??
      contratos[0]
  }

  // ─── Asistencias del período ───
  const { data: asistencias } = await admin
    .from('asistencias')
    .select('fecha, estado, tipo, hora_entrada, hora_salida, inicio_almuerzo, fin_almuerzo, salida_particular, vuelta_particular')
    .eq('empresa_id', empresaId)
    .eq('miembro_id', miembroId)
    .gte('fecha', periodoInicio)
    .lte('fecha', periodoFin)

  // ─── Conceptos del contrato + catálogo ───
  let conceptos_contrato: ConceptoContratoInput[] = []
  if (contrato) {
    const { data: cc } = await admin
      .from('conceptos_contrato')
      .select('concepto_id, valor_override, activo, concepto:conceptos_nomina(*)')
      .eq('empresa_id', empresaId)
      .eq('contrato_id', contrato.id)
      .eq('activo', true)
    // El select anidado con Supabase devuelve `concepto` como objeto cuando
    // existe la relación, pero TS lo infiere como array. Normalizamos.
    conceptos_contrato = ((cc ?? []) as unknown as ConceptoContratoConDetalle[]).map(c => ({
      concepto_id: c.concepto_id,
      valor_override: c.valor_override,
      concepto: c.concepto as unknown as ConceptoNomina,
    }))
  }

  // ─── Cuotas de adelanto vencidas ───
  const { data: cuotas } = await admin
    .from('adelantos_cuotas')
    .select('id, adelanto_id, numero_cuota, monto_cuota, fecha_programada, estado')
    .eq('empresa_id', empresaId)
    .eq('miembro_id', miembroId)
    .gte('fecha_programada', periodoInicio)
    .lte('fecha_programada', periodoFin)
    .eq('estado', 'pendiente')

  // ─── Sector / turno para snapshot ───
  let sector: { id: string; nombre: string } | null = null
  let turno: { id: string; nombre: string } | null = null
  if (contrato?.sector_id) {
    const { data: s } = await admin
      .from('sectores')
      .select('id, nombre')
      .eq('id', contrato.sector_id)
      .maybeSingle()
    sector = s ?? null
  }
  if (contrato?.turno_id) {
    const { data: t } = await admin
      .from('turnos_laborales')
      .select('id, nombre')
      .eq('id', contrato.turno_id)
      .maybeSingle()
    turno = t ?? null
  }

  return calcularReciboPuro({
    miembro_id: miembroId,
    empresa_id: empresaId,
    periodo_inicio: periodoInicio,
    periodo_fin: periodoFin,
    contrato,
    asistencias: (asistencias ?? []) as AsistenciaInput[],
    conceptos_contrato,
    cuotas_adelanto: (cuotas ?? []).map(c => ({
      id: c.id,
      adelanto_id: c.adelanto_id,
      numero_cuota: c.numero_cuota,
      monto_cuota: c.monto_cuota,
      fecha_programada: c.fecha_programada,
      estado: c.estado,
    })),
    sector,
    turno,
  })
}

// ════════════════════════════════════════════════════════════════
// Helpers utilitarios
// ════════════════════════════════════════════════════════════════

function armarConcepto(
  c: ConceptoNomina,
  valor: number | null,
  monto: number,
  detalle: string,
): ConceptoAplicadoCalculado {
  return {
    concepto_id: c.id,
    nombre: c.nombre,
    tipo: c.tipo as TipoConcepto,
    modo_calculo: c.modo_calculo,
    valor,
    monto: redondear(monto),
    automatico: c.automatico,
    detalle,
  }
}

/** Diferencia en días entre dos fechas ISO (YYYY-MM-DD), ambas inclusive. */
function diferenciaEnDias(inicio: string, fin: string): number {
  const [yi, mi, di] = inicio.split('-').map(Number)
  const [yf, mf, df] = fin.split('-').map(Number)
  const dt1 = Date.UTC(yi, mi - 1, di)
  const dt2 = Date.UTC(yf, mf - 1, df)
  return Math.floor((dt2 - dt1) / (1000 * 60 * 60 * 24))
}

/** Meses completos entre dos fechas ISO. */
function mesesEntre(desde: string, hasta: string): number {
  const [yd, md, dd] = desde.split('-').map(Number)
  const [yh, mh, dh] = hasta.split('-').map(Number)
  let meses = (yh - yd) * 12 + (mh - md)
  if (dh < dd) meses--
  return Math.max(0, meses)
}

/** Convierte 'HH:MM[:SS]' a minutos desde medianoche. */
function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Redondea a 2 decimales para evitar drift por punto flotante. */
function redondear(n: number): number {
  return Math.round(n * 100) / 100
}
