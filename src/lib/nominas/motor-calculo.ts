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
  LicenciaAplicada,
  TipoConcepto,
  TipoLicencia,
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

/**
 * Fila mínima de cuota de adelanto que el motor consume.
 *
 * `tipo` viene del adelanto padre (`adelantos_nomina.tipo`) y decide
 * el signo en el cálculo del neto:
 *   - 'adelanto'  → resta (préstamo en cuotas)
 *   - 'descuento' → resta (multa puntual)
 *   - 'bono'      → SUMA (pago extra one-off)
 *
 * Si llega `undefined` (rows pre-migración o callers viejos), se asume
 * 'adelanto' por compatibilidad — el comportamiento histórico era restar.
 */
export interface CuotaInput {
  id: string
  adelanto_id: string
  numero_cuota: number
  monto_cuota: number | string
  fecha_programada: string
  estado: string
  tipo?: 'adelanto' | 'descuento' | 'bono'
}

/**
 * Concepto asignado al contrato + detalle del catálogo.
 *
 * `fecha_alta` y `fecha_baja` permiten que el motor filtre conceptos
 * por vigencia dentro del período: una asignación se aplica si
 *   `fecha_alta <= periodo_fin AND (fecha_baja IS NULL OR fecha_baja >= periodo_inicio)`.
 *
 * El caller (cargador desde BD) ya filtra por vigencia, pero el core
 * vuelve a chequear como red de seguridad — así los tests pueden
 * pasar arrays con cualquier vigencia sin ensuciar fixtures.
 */
export interface ConceptoContratoInput {
  concepto_id: string
  valor_override: number | string | null
  fecha_alta: string
  fecha_baja: string | null
  concepto: ConceptoNomina
}

/**
 * Ajuste puntual de un concepto para este período. Tres tipos:
 *   • `override` → reemplaza el monto calculado por el motor con
 *     `monto_override`. El concepto sigue apareciendo como aplicado,
 *     pero con el monto manual y nota explicativa.
 *   • `excluir`  → el concepto NO se aplica en este período aunque
 *     esté vigente en el contrato. Se mueve a `conceptos_sugeridos`
 *     con la razón.
 *   • `agregar`  → aplica un concepto del catálogo que NO está
 *     asignado al contrato, solo para este período.
 *
 * Coherencia: para override/excluir el concepto debe estar en
 * `conceptos_contrato`. Para `agregar` NO. El endpoint que crea
 * ajustes valida esto; el motor asume datos consistentes.
 */
export interface AjusteConceptoPeriodoInput {
  concepto_id: string
  tipo_ajuste: 'override' | 'excluir' | 'agregar'
  monto_override: number | string | null
  motivo: string | null
  /** Solo necesario para `tipo_ajuste='agregar'` (sino se toma del contrato). */
  concepto?: ConceptoNomina
}

/**
 * Licencia mínima que el motor consume. Solo trae lo necesario para
 * calcular el efecto en el recibo (tipo, fechas, goce). El caller debe
 * pasar SOLO las licencias del contrato que solapan con el período;
 * el motor las filtra de nuevo por las dudas pero no las vuelve a buscar.
 */
export interface LicenciaInput {
  id: string
  tipo: TipoLicencia
  fecha_inicio: string
  fecha_fin: string | null
  goce_sueldo: boolean
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
  /**
   * Ajustes puntuales del período (override/excluir/agregar). Opcional;
   * si el caller no los pasa el motor liquida con la plantilla normal.
   * Ver `AjusteConceptoPeriodoInput`.
   */
  ajustes_periodo?: AjusteConceptoPeriodoInput[]
  cuotas_adelanto: CuotaInput[]
  /**
   * Días laborales del mes completo (no del período). Se usa para
   * calcular el básico mensual de modalidades `por_dia` y `por_hora`,
   * que es la base de los conceptos `periodicidad='mensual'` (ej.
   * Presentismo 10% del básico mensual). Si no se pasa, se asume 22
   * (≈ días hábiles típicos lunes-viernes).
   */
  dias_laborales_mes?: number
  /** Licencias del contrato que solapan con el período. */
  licencias: LicenciaInput[]
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

  // ─── 2. Estado del contrato vs el período ───
  // Si el contrato terminó ANTES del inicio del período, el empleado
  // ya no estaba bajo ese contrato — no se genera recibo.
  // Si terminó DENTRO del período, igual se calcula proporcional pero
  // dejamos una advertencia para que el operador lo vea.
  const contratoTerminadoAntes =
    !!datos.contrato &&
    !datos.contrato.vigente &&
    !!datos.contrato.fecha_fin &&
    datos.contrato.fecha_fin < datos.periodo_inicio

  const contratoTerminadoDentro =
    !!datos.contrato &&
    !datos.contrato.vigente &&
    !!datos.contrato.fecha_fin &&
    datos.contrato.fecha_fin >= datos.periodo_inicio &&
    datos.contrato.fecha_fin <= datos.periodo_fin

  // ─── 3. Monto base según modalidad del contrato ───
  let monto_base_calculado = 0
  if (datos.contrato && !contratoTerminadoAntes) {
    monto_base_calculado = calcularMontoBase(
      datos.contrato.modalidad_calculo,
      Number(datos.contrato.monto_base),
      asistencia,
      datos.periodo_inicio,
      datos.periodo_fin,
    )
  } else if (contratoTerminadoAntes && datos.contrato) {
    advertencias.push(`El contrato terminó el ${datos.contrato.fecha_fin} (antes del inicio del período). No corresponde liquidar este período.`)
  } else {
    advertencias.push('Sin contrato laboral cargado: el monto base es 0. Cargá un contrato para que el recibo refleje el sueldo del empleado.')
  }

  if (contratoTerminadoDentro && datos.contrato) {
    advertencias.push(`El contrato terminó el ${datos.contrato.fecha_fin}, dentro del período. Verificá que el monto refleje sólo los días trabajados antes de la baja.`)
  }

  // ─── 3. Aplicar conceptos automáticos del contrato ───
  // Los conceptos `mensual` (Presentismo, Antigüedad, etc.) solo se
  // aplican en la ÚLTIMA liquidación del mes, sin importar la
  // frecuencia del contrato. Si el empleado cobra quincenal, recibe
  // el bono solo en la segunda quincena. Esto evita el doble pago
  // que ocurría antes de este filtro.
  //
  // Cuando son mensuales Y aplican, el monto se calcula sobre el
  // básico MENSUAL (no el del período): un "10% del básico" para un
  // jornalero quincenal debe ser 10% de su sueldo mensual completo,
  // no del que cobra esa quincena. `dias_laborales_mes` lo necesita
  // `calcularBasicoMensual` para modalidades por_dia/por_hora;
  // default 22 (≈ días hábiles típicos) si el caller no lo pasa.
  const conceptos_aplicados: ConceptoAplicadoCalculado[] = []
  const conceptos_sugeridos: ConceptoAplicadoCalculado[] = []
  const periodoEsUltimaDelMes = esUltimaLiquidacionDelMes(datos.periodo_inicio, datos.periodo_fin)
  const diasLaboralesMes = datos.dias_laborales_mes ?? 22
  const basicoMensual = datos.contrato
    ? calcularBasicoMensual(datos.contrato.modalidad_calculo, Number(datos.contrato.monto_base), diasLaboralesMes)
    : 0

  // Indice O(1) de ajustes puntuales del período (override/excluir/
  // agregar) por concepto_id. Vamos a consultarlo en cada concepto
  // del contrato y al final para los `agregar` que no son del contrato.
  const ajustesPorConcepto = new Map<string, AjusteConceptoPeriodoInput>()
  for (const a of datos.ajustes_periodo ?? []) {
    ajustesPorConcepto.set(a.concepto_id, a)
  }

  for (const cc of datos.conceptos_contrato) {
    const c = cc.concepto
    if (!c.activo) continue

    // Red de seguridad: aunque el caller debería filtrar por vigencia
    // antes de pasarnos los conceptos, re-chequeamos contra el período
    // para que los tests puedan pasar arrays sin pre-filtrar y para
    // proteger contra cambios futuros del cargador.
    const vigenteEnPeriodo =
      cc.fecha_alta <= datos.periodo_fin &&
      (cc.fecha_baja === null || cc.fecha_baja >= datos.periodo_inicio)
    if (!vigenteEnPeriodo) continue

    const valor = cc.valor_override !== null && cc.valor_override !== undefined
      ? Number(cc.valor_override)
      : (c.valor !== null && c.valor !== undefined ? Number(c.valor) : null)

    // ─── Ajuste puntual del período ───
    // Antes de evaluar reglas del motor, miramos si el operador
    // configuró un ajuste manual para este concepto en este período.
    // 'excluir' lo saca aunque cumpliera la condición.
    // 'override' usa directamente el monto manual (saltea el cálculo).
    const ajuste = ajustesPorConcepto.get(cc.concepto_id)
    if (ajuste?.tipo_ajuste === 'excluir') {
      const detalle = ajuste.motivo?.trim()
        ? `Excluido del período: ${ajuste.motivo.trim()}`
        : 'Excluido del período por ajuste manual.'
      conceptos_sugeridos.push(armarConcepto(c, valor, 0, detalle))
      continue
    }
    if (ajuste?.tipo_ajuste === 'override' && ajuste.monto_override !== null) {
      const montoManual = Number(ajuste.monto_override)
      const detalle = ajuste.motivo?.trim()
        ? `Monto ajustado manualmente: ${ajuste.motivo.trim()}`
        : 'Monto ajustado manualmente para este período.'
      conceptos_aplicados.push(armarConcepto(c, valor, montoManual, detalle))
      continue
    }

    // No automático → siempre sugerencia (el operador decide).
    if (!c.automatico) {
      conceptos_sugeridos.push(armarConcepto(c, valor, 0, 'Concepto manual: el operador decide si lo agrega.'))
      continue
    }

    // Conceptos `unico` no se aplican automáticamente: el operador
    // decide en qué período se incluye.
    if (c.periodicidad === 'unico') {
      conceptos_sugeridos.push(armarConcepto(c, valor, 0, 'Concepto único — el operador decide en qué período aplicarlo.'))
      continue
    }

    // Conceptos `mensual` solo se aplican en la última liquidación
    // del mes. En las anteriores quedan como sugerencia para que el
    // operador vea por qué no se sumaron.
    if (c.periodicidad === 'mensual' && !periodoEsUltimaDelMes) {
      conceptos_sugeridos.push(armarConcepto(c, valor, 0, 'Concepto mensual: se aplica en la última liquidación del mes (no esta).'))
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

    // Calcular monto según modo_calculo. Para conceptos mensuales el
    // base es el sueldo MENSUAL completo (los porcentaje_basico se
    // calculan sobre eso, no sobre el básico del período). Pasamos
    // también la condición para que `por_evento` pueda multiplicar
    // por la cantidad real de ocurrencias (ej: feriados trabajados).
    const baseDelConcepto = c.periodicidad === 'mensual' ? basicoMensual : monto_base_calculado
    const monto = calcularMontoConcepto(c.modo_calculo, valor, baseDelConcepto, asistencia, condicion)
    conceptos_aplicados.push(armarConcepto(c, valor, monto, evaluacion.detalle))
  }

  // ─── Ajustes 'agregar' del período ───
  // Conceptos del catálogo que NO están en el contrato pero el
  // operador quiso aplicarlos puntualmente este período. El monto
  // viene en `monto_override` (es el monto final, sin recalcular).
  const conceptosContratoIds = new Set(datos.conceptos_contrato.map(cc => cc.concepto_id))
  for (const ajuste of datos.ajustes_periodo ?? []) {
    if (ajuste.tipo_ajuste !== 'agregar') continue
    // Si el concepto está en el contrato, ya se procesó arriba — un
    // 'agregar' sobre concepto del contrato es inválido (debería ser
    // 'override'), pero por las dudas lo ignoramos aquí.
    if (conceptosContratoIds.has(ajuste.concepto_id)) continue
    if (!ajuste.concepto) continue // sin detalle del catálogo no podemos snapshotear
    if (ajuste.monto_override === null) continue

    const monto = Number(ajuste.monto_override)
    const detalle = ajuste.motivo?.trim()
      ? `Concepto agregado al período: ${ajuste.motivo.trim()}`
      : 'Concepto agregado al período por ajuste manual.'
    conceptos_aplicados.push(armarConcepto(ajuste.concepto, monto, monto, detalle))
  }

  // ─── 4. Cuotas de adelanto vencidas en el período ───
  // Aplicamos toda cuota pendiente con fecha programada <= periodo_fin.
  // Esto cubre dos casos:
  //   1) Cuotas cuya fecha cae dentro del período actual.
  //   2) Cuotas pendientes que ya vencieron en períodos anteriores y no
  //      se descontaron (típico: empleado tenía un adelanto pero no se
  //      le pagó nada el período pasado, ahora se acumulan).
  // Las cuotas ya descontadas en pagos previos no se vuelven a aplicar
  // (el filtro de estado='pendiente' las excluye).
  const adelantos_aplicados: CuotaAdelantoAplicada[] = datos.cuotas_adelanto
    .filter(q => q.estado === 'pendiente')
    .filter(q => q.fecha_programada <= datos.periodo_fin)
    .map(q => ({
      cuota_id: q.id,
      adelanto_id: q.adelanto_id,
      numero_cuota: q.numero_cuota,
      monto: Number(q.monto_cuota),
      fecha_programada: q.fecha_programada,
      // Sin tipo explícito asumimos 'adelanto' por compatibilidad
      // con datos previos a la migración 092.
      tipo: q.tipo ?? 'adelanto',
    }))

  // ─── 5. Licencias del contrato que solapan con el período ───
  //
  // Por cada licencia:
  //   - Calculamos los días dentro del período (intersección de rangos).
  //   - Si goce_sueldo=true: solo informativa, no afecta totales.
  //   - Si goce_sueldo=false: el monto del prorrateo de esos días se
  //     descuenta del subtotal de descuentos. Para `por_dia`, además se
  //     emite advertencia: las asistencias ya excluyen los días no
  //     trabajados, así que el motor no descuenta dos veces — la
  //     licencia sin goce es informativa también, salvo que figure
  //     fichaje (caso raro).
  //
  // Limitación V1: no detectamos solapamiento entre licencias (lo
  // enforza la BD con EXCLUDE constraint).
  const licencias_aplicadas: LicenciaAplicada[] = []
  let descuentoPorLicencias = 0
  if (datos.contrato) {
    const modalidad = datos.contrato.modalidad_calculo
    const montoBaseContrato = Number(datos.contrato.monto_base)
    const diasNaturalesPorModalidad: Record<ModalidadCalculo, number> = {
      por_hora: 1,
      por_dia: 1,
      fijo_semanal: 7,
      fijo_quincenal: 15,
      fijo_mensual: 30,
    }
    for (const lic of datos.licencias) {
      const inicio = lic.fecha_inicio > datos.periodo_inicio ? lic.fecha_inicio : datos.periodo_inicio
      const finLic = lic.fecha_fin ?? datos.periodo_fin
      const fin = finLic < datos.periodo_fin ? finLic : datos.periodo_fin
      if (fin < inicio) continue  // no se solapan
      const dias_en_periodo = diferenciaEnDias(inicio, fin) + 1
      let monto_descontado = 0
      if (!lic.goce_sueldo) {
        // Sin goce → descontamos los días de licencia del prorrateo.
        // En modalidades fijas: monto_base × dias / días_naturales.
        // En `por_dia`: los días suelen estar afuera por asistencia ya,
        // pero si por error figura fichaje, descontamos el valor del día.
        // En `por_hora`: el motor no puede saber cuántas horas hubiese
        // trabajado; advertimos y dejamos en 0 (operador ajusta a mano).
        if (modalidad === 'por_hora') {
          advertencias.push(`Licencia sin goce (${lic.tipo}) entre ${inicio} y ${fin}: en modalidad por hora el motor no descuenta automáticamente, ajustá el monto a mano.`)
        } else if (modalidad === 'por_dia') {
          monto_descontado = redondear(montoBaseContrato * dias_en_periodo)
        } else {
          const dn = diasNaturalesPorModalidad[modalidad]
          monto_descontado = redondear((montoBaseContrato / dn) * dias_en_periodo)
        }
        descuentoPorLicencias += monto_descontado
      }
      licencias_aplicadas.push({
        licencia_id: lic.id,
        tipo: lic.tipo,
        goce_sueldo: lic.goce_sueldo,
        fecha_inicio: lic.fecha_inicio,
        fecha_fin: lic.fecha_fin,
        dias_en_periodo,
        monto_descontado,
      })
    }
  }

  // ─── 6. Totales ───
  const haberesConceptos = conceptos_aplicados
    .filter(c => c.tipo === 'haber')
    .reduce((sum, c) => sum + c.monto, 0)
  const descuentosConceptos = conceptos_aplicados
    .filter(c => c.tipo === 'descuento')
    .reduce((sum, c) => sum + c.monto, 0)
  // Discriminamos por tipo: bonos SUMAN (van como haberes), adelantos
  // y descuentos RESTAN (van como descuentos). Esto refleja la
  // semántica del modelo nuevo (sql/092) sin romper recibos viejos:
  // si un movimiento llega sin `tipo` se asume 'adelanto' (comportamiento histórico).
  const totalBonos = adelantos_aplicados
    .filter(a => a.tipo === 'bono')
    .reduce((sum, a) => sum + a.monto, 0)
  const totalAdelantosResta = adelantos_aplicados
    .filter(a => a.tipo !== 'bono')
    .reduce((sum, a) => sum + a.monto, 0)

  const subtotal_haberes = redondear(monto_base_calculado + haberesConceptos + totalBonos)
  const subtotal_descuentos = redondear(descuentosConceptos + totalAdelantosResta + descuentoPorLicencias)
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
    licencias_aplicadas,
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
 *   - `por_evento`         → valor × cantidad_de_ocurrencias. La cantidad
 *                            depende de la condición: si la condición es
 *                            `trabajo_feriado`, multiplica por la cantidad
 *                            real de feriados trabajados (típico pago doble
 *                            de feriado: valor = jornal, ocurrencias = N
 *                            feriados). Para otras condiciones se aplica
 *                            una sola vez.
 *   - `manual`             → 0 (siempre sugerencia, el operador escribe el monto)
 */
export function calcularMontoConcepto(
  modo: ModoCalculoConcepto,
  valor: number | null,
  montoBase: number,
  asistencia: MetricasAsistencia,
  condicion?: CondicionConcepto | null,
): number {
  if (valor === null) return 0
  if (modo === 'monto_fijo') return valor
  if (modo === 'porcentaje_basico') return montoBase * (valor / 100)
  if (modo === 'por_dia') return valor * asistencia.dias_trabajados
  if (modo === 'por_evento') {
    // Si la condición cuenta feriados trabajados, escalamos por esa cantidad.
    // Esto soporta naturalmente el caso "pago doble por feriado": el valor
    // del concepto es el jornal y se multiplica por cuántos feriados se
    // trabajaron en el período.
    if (condicion?.tipo === 'trabajo_feriado') {
      const cantidad = asistencia.dias_feriados_trabajados ?? 0
      return valor * cantidad
    }
    return valor
  }
  return 0
}

/**
 * Determina si el período `[inicio, fin]` es la ÚLTIMA liquidación que
 * cubre el mes calendario al que pertenece.
 *
 * Reglas:
 *   - El período se considera "última del mes" si el último día del
 *     mes de `fin` está dentro de `[inicio, fin]`. Eso cubre:
 *       - Mes entero (1-30/31): siempre incluye el último día.
 *       - Segunda quincena (16-30/31): incluye el último día.
 *       - Última semana cuyo rango toca el día 30/31.
 *   - Primera quincena (1-15) o semanas anteriores: el último día del
 *     mes queda fuera del rango → no es la última.
 *
 * Si el período cruza dos meses (ej. una semana 27/abr-3/may), se toma
 * el mes de `fin`. Se considera "última de ese mes" si incluye el
 * último día de abril (en el ejemplo, sí lo incluye → aplica para abril).
 * El recibo de la primera semana de mayo NO la aplica para mayo (esa
 * vendrá en la última semana de mayo).
 */
export function esUltimaLiquidacionDelMes(periodoInicio: string, periodoFin: string): boolean {
  const [yi, mi, di] = periodoInicio.split('-').map(Number)
  const [yf, mf, df] = periodoFin.split('-').map(Number)
  // Tomamos el mes del fin para decidir "última del mes".
  const ultimoDiaMesFin = new Date(yf, mf, 0).getDate() // mes (1-12) → último día
  const ultimoIso = `${yf}-${String(mf).padStart(2, '0')}-${String(ultimoDiaMesFin).padStart(2, '0')}`
  // Útil: si el inicio está en un mes posterior al fin, algo está mal.
  void yi; void mi; void di
  return periodoInicio <= ultimoIso && periodoFin >= ultimoIso
}

/**
 * Calcula el básico MENSUAL del contrato, independientemente del
 * período de pago. Lo usan los conceptos `periodicidad='mensual'` para
 * calcular sobre la base correcta cuando el empleado cobra quincenal o
 * semanal.
 *
 * Aproximaciones:
 *   - `fijo_mensual`:    monto_base.
 *   - `fijo_quincenal`:  monto_base × 2.
 *   - `fijo_semanal`:    monto_base × 30 / 7  (≈4.286).
 *   - `por_dia`:         monto_base × diasLaboralesDelMes.
 *   - `por_hora`:        monto_base × horasLaboralesDelMes (≈8h × días).
 *
 * `diasLaboralesDelMes` se pasa desde afuera porque depende del turno
 * del miembro (que ya calcula el caller, ej. /api/nominas).
 */
export function calcularBasicoMensual(
  modalidad: ModalidadCalculo,
  montoBase: number,
  diasLaboralesDelMes: number,
  horasPorDiaPromedio: number = 8,
): number {
  if (modalidad === 'fijo_mensual') return montoBase
  if (modalidad === 'fijo_quincenal') return montoBase * 2
  if (modalidad === 'fijo_semanal') return montoBase * (30 / 7)
  if (modalidad === 'por_dia') return montoBase * diasLaboralesDelMes
  if (modalidad === 'por_hora') return montoBase * horasPorDiaPromedio * diasLaboralesDelMes
  return montoBase
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

    case 'asistencia_perfecta': {
      // Combinación: ni ausencias ni tardanzas. Útil para premios
      // "asistencia perfecta del mes".
      const cumpleAusencias = asistencia.dias_ausentes === 0
      const cumpleTardanzas = asistencia.tardanzas === 0
      if (cumpleAusencias && cumpleTardanzas) {
        return { cumple: true, detalle: 'Cumplió: asistencia perfecta (sin ausencias ni tardanzas).' }
      }
      const motivos: string[] = []
      if (!cumpleAusencias) motivos.push(`${asistencia.dias_ausentes} ausencia(s)`)
      if (!cumpleTardanzas) motivos.push(`${asistencia.tardanzas} tardanza(s)`)
      return { cumple: false, detalle: `No cumplió asistencia perfecta: ${motivos.join(' y ')}.` }
    }

    case 'minimo_dias':
      return asistencia.dias_trabajados >= condicion.dias
        ? { cumple: true, detalle: `Cumplió: ${asistencia.dias_trabajados}/${condicion.dias} días.` }
        : { cumple: false, detalle: `No cumplió: ${asistencia.dias_trabajados}/${condicion.dias} días.` }

    case 'trabajo_feriado': {
      const feriadosTrabajados = asistencia.dias_feriados_trabajados ?? 0
      const requeridos = condicion.feriados ?? 1
      return feriadosTrabajados >= requeridos
        ? { cumple: true, detalle: `Cumplió: trabajó ${feriadosTrabajados} feriado(s).` }
        : { cumple: false, detalle: `No cumplió: ${feriadosTrabajados}/${requeridos} feriado(s) trabajados.` }
    }

    case 'horas_minimas':
      return asistencia.horas_netas >= condicion.horas
        ? { cumple: true, detalle: `Cumplió: ${asistencia.horas_netas}/${condicion.horas} horas trabajadas.` }
        : { cumple: false, detalle: `No cumplió: ${asistencia.horas_netas}/${condicion.horas} horas trabajadas.` }

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
  if (tipo === 'asistencia_perfecta') return { tipo: 'asistencia_perfecta' }
  if (tipo === 'minimo_dias' && typeof json.dias === 'number') {
    return { tipo: 'minimo_dias', dias: json.dias }
  }
  if (tipo === 'trabajo_feriado') {
    return { tipo: 'trabajo_feriado', feriados: typeof json.feriados === 'number' ? json.feriados : 1 }
  }
  if (tipo === 'horas_minimas' && typeof json.horas === 'number') {
    return { tipo: 'horas_minimas', horas: json.horas }
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
  // Filtramos por vigencia EN EL PERÍODO (no por `activo`): una
  // asignación se aplica si su rango [fecha_alta, fecha_baja] solapa
  // con [periodoInicio, periodoFin]. Esto permite que un concepto
  // que se dio de alta a mitad de período aparezca en este recibo, y
  // que uno dado de baja siga apareciendo en recibos del período en
  // que estuvo vigente (snapshot histórico).
  let conceptos_contrato: ConceptoContratoInput[] = []
  if (contrato) {
    const { data: cc } = await admin
      .from('conceptos_contrato')
      .select('concepto_id, valor_override, fecha_alta, fecha_baja, concepto:conceptos_nomina(*)')
      .eq('empresa_id', empresaId)
      .eq('contrato_id', contrato.id)
      .lte('fecha_alta', periodoFin)
      .or(`fecha_baja.is.null,fecha_baja.gte.${periodoInicio}`)
    // El select anidado con Supabase devuelve `concepto` como objeto cuando
    // existe la relación, pero TS lo infiere como array. Normalizamos.
    conceptos_contrato = ((cc ?? []) as unknown as ConceptoContratoConDetalle[]).map(c => ({
      concepto_id: c.concepto_id,
      valor_override: c.valor_override,
      fecha_alta: c.fecha_alta,
      fecha_baja: c.fecha_baja,
      concepto: c.concepto as unknown as ConceptoNomina,
    }))
  }

  // ─── Cuotas de adelanto / descuento / bono vencidas ───
  // Traemos cuotas pendientes con fecha <= periodoFin. Incluye atrasadas
  // de períodos anteriores, que se acumulan en este recibo. El core puro
  // hace el filtro final por estado y fecha. Joineamos con
  // `adelantos_nomina` para arrastrar el `tipo` (adelanto/descuento/bono),
  // que decide el SIGNO en el cálculo del neto.
  const { data: cuotas } = await admin
    .from('adelantos_cuotas')
    .select('id, adelanto_id, numero_cuota, monto_cuota, fecha_programada, estado, adelanto:adelantos_nomina!inner(tipo)')
    .eq('empresa_id', empresaId)
    .eq('miembro_id', miembroId)
    .lte('fecha_programada', periodoFin)
    .eq('estado', 'pendiente')

  // ─── Licencias del contrato que solapan con el período ───
  // Solo tiene sentido si hay contrato. Una licencia solapa si:
  //   fecha_inicio <= periodoFin Y (fecha_fin >= periodoInicio O fecha_fin IS NULL)
  let licencias: LicenciaInput[] = []
  if (contrato) {
    const { data: licsRaw } = await admin
      .from('licencias_contrato')
      .select('id, tipo, fecha_inicio, fecha_fin, goce_sueldo')
      .eq('empresa_id', empresaId)
      .eq('contrato_id', contrato.id)
      .lte('fecha_inicio', periodoFin)
      .or(`fecha_fin.is.null,fecha_fin.gte.${periodoInicio}`)
    licencias = (licsRaw ?? []) as LicenciaInput[]
  }

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

  // ─── Ajustes puntuales del período ───
  // Filtramos por período EXACTO (mismo desde y hasta): los ajustes
  // están atados a una liquidación específica, si el operador cambia
  // de período no se aplican. Traemos el catálogo del concepto para
  // que el motor pueda armar el snapshot completo de los 'agregar'.
  const { data: ajustesRaw } = await admin
    .from('ajustes_concepto_periodo')
    .select('concepto_id, tipo_ajuste, monto_override, motivo, concepto:conceptos_nomina(*)')
    .eq('empresa_id', empresaId)
    .eq('miembro_id', miembroId)
    .eq('periodo_inicio', periodoInicio)
    .eq('periodo_fin', periodoFin)
  const ajustes_periodo: AjusteConceptoPeriodoInput[] = ((ajustesRaw ?? []) as unknown as Array<{
    concepto_id: string
    tipo_ajuste: 'override' | 'excluir' | 'agregar'
    monto_override: number | string | null
    motivo: string | null
    concepto: ConceptoNomina
  }>).map(a => ({
    concepto_id: a.concepto_id,
    tipo_ajuste: a.tipo_ajuste,
    monto_override: a.monto_override,
    motivo: a.motivo,
    concepto: a.concepto,
  }))

  return calcularReciboPuro({
    miembro_id: miembroId,
    empresa_id: empresaId,
    periodo_inicio: periodoInicio,
    periodo_fin: periodoFin,
    contrato,
    asistencias: (asistencias ?? []) as AsistenciaInput[],
    conceptos_contrato,
    ajustes_periodo,
    // El select anidado de Supabase devuelve `adelanto` como objeto
    // (con la FK NOT NULL del !inner garantiza que existe) pero TS lo
    // infiere como array. Normalizamos antes de leer `.tipo`.
    cuotas_adelanto: (cuotas ?? []).map(c => {
      const adelantoRaw = c.adelanto as unknown as { tipo: 'adelanto' | 'descuento' | 'bono' } | null
      return {
        id: c.id,
        adelanto_id: c.adelanto_id,
        numero_cuota: c.numero_cuota,
        monto_cuota: c.monto_cuota,
        fecha_programada: c.fecha_programada,
        estado: c.estado,
        tipo: adelantoRaw?.tipo ?? 'adelanto',
      }
    }),
    licencias,
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
