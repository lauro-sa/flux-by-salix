/**
 * Tipos del módulo Nóminas — alineados con sql/074..078.
 * Se usan en: API /api/nominas/*, ficha laboral, motor de cálculo,
 * editor de conceptos, recibos, auditoría.
 *
 * Convención: matchear nombres y valores de los CHECK constraints
 * de las tablas. Si cambia un enum acá, cambia también el SQL.
 */

// ════════════════════════════════════════════════════════════════
// Enums (espejo de los CHECK constraints en SQL)
// ════════════════════════════════════════════════════════════════

/** Tipo legal del contrato. */
export type CondicionContrato =
  | 'tiempo_indeterminado'
  | 'plazo_fijo'
  | 'temporal'
  | 'pasantia'
  | 'otro'

/** Cómo se calcula el haber base (independiente de cuándo se paga). */
export type ModalidadCalculo =
  | 'por_hora'
  | 'por_dia'
  | 'fijo_semanal'
  | 'fijo_quincenal'
  | 'fijo_mensual'

/** Cada cuánto se paga (independiente de cómo se calcula). */
export type FrecuenciaPago = 'diaria' | 'semanal' | 'quincenal' | 'mensual'

/** Régimen fiscal/legal del contrato (Fase 3 usa los otros valores). */
export type RegimenContrato = 'informal' | 'monotributo' | 'relacion_dependencia'

/**
 * Motivo por el cual un contrato fue cerrado. Solo aplica cuando
 * `vigente=false` y `fecha_fin IS NOT NULL`. Lista cerrada para reportes
 * agrupados ("rotación por renuncia", "despidos sin causa", etc).
 */
export type MotivoFinContrato =
  | 'renuncia'
  | 'despido_con_causa'
  | 'despido_sin_causa'
  | 'fin_plazo'
  | 'mutuo_acuerdo'
  | 'abandono'
  | 'jubilacion'
  | 'fallecimiento'
  | 'otro'

/**
 * Tipos de licencia / pausa de un contrato. Determinan cómo se rotula
 * la pausa en la UI y permiten reportes; el efecto en el cálculo lo
 * decide `goce_sueldo` (no el tipo).
 */
export type TipoLicencia =
  | 'medica'
  | 'maternidad'
  | 'paternidad'
  | 'estudio'
  | 'examen'
  | 'duelo'
  | 'matrimonio'
  | 'mudanza'
  | 'vacaciones'
  | 'suspension_disciplinaria'
  | 'suspension_economica'
  | 'otro'

/** Suma o resta sobre el haber base. */
export type TipoConcepto = 'haber' | 'descuento'

/** Etiqueta visual y de reporte para agrupar conceptos. */
export type CategoriaConcepto =
  | 'presentismo'
  | 'premio'
  | 'bono'
  | 'antiguedad'
  | 'adicional'
  | 'descuento_uniforme'
  | 'descuento_otro'
  | 'otro'

/** Cómo se interpreta el campo `valor` del concepto. */
export type ModoCalculoConcepto =
  | 'monto_fijo'
  | 'porcentaje_basico'
  | 'por_dia'
  | 'por_evento'
  | 'manual'

// ════════════════════════════════════════════════════════════════
// Entidades base
// ════════════════════════════════════════════════════════════════

/**
 * Contrato laboral. Cada empleado tiene 1 vigente + N históricos.
 * Al cambiar condiciones económicas (modalidad/monto/frecuencia) se
 * crea uno nuevo en vez de editar el actual.
 */
export interface ContratoLaboral {
  id: string
  empresa_id: string
  miembro_id: string

  // Vigencia
  fecha_inicio: string         // ISO date (yyyy-mm-dd)
  fecha_fin: string | null
  vigente: boolean

  // Condiciones
  condicion: CondicionContrato
  modalidad_calculo: ModalidadCalculo
  monto_base: number
  frecuencia_pago: FrecuenciaPago

  // Asignación organizacional
  sector_id: string | null
  turno_id: string | null

  // Régimen y docs
  regimen: RegimenContrato
  pdf_url: string | null
  motivo_cambio: string | null
  notas: string | null

  /**
   * Motivo del cierre del contrato. Solo se setea cuando el operador
   * "termina" el contrato (renuncia, despido, fin de plazo, etc).
   * Null mientras el contrato está vigente o si quedó cerrado de forma
   * implícita al crear uno nuevo (motivo_cambio cubre ese caso).
   */
  motivo_fin: MotivoFinContrato | null
  /** Detalle libre del cierre (número de telegrama, etc). */
  nota_fin: string | null

  // Auditoría
  creado_en: string
  creado_por: string | null
  actualizado_en: string
  actualizado_por: string | null
}

/**
 * Licencia / pausa de un contrato. Período donde el empleado no
 * trabaja pero el vínculo sigue. La UI muestra estas licencias en la
 * ficha laboral; el motor las usa para descontar días según
 * `goce_sueldo`.
 */
export interface LicenciaContrato {
  id: string
  empresa_id: string
  miembro_id: string
  contrato_id: string

  tipo: TipoLicencia

  /** Inicio de la licencia (ISO date). */
  fecha_inicio: string
  /** Fin de la licencia. Null = licencia abierta (sin fecha de fin todavía). */
  fecha_fin: string | null

  /**
   * Si `true`, los días de licencia siguen pagos (cuentan para el
   * prorrateo). Si `false`, el motor los descuenta del cálculo.
   */
  goce_sueldo: boolean

  notas: string | null

  creado_en: string
  creado_por: string | null
  actualizado_en: string
  actualizado_por: string | null
}

/** Forma mínima de Sector que necesita la UI de nóminas. */
export interface SectorMin {
  id: string
  nombre: string
  color: string
  icono: string
}

/** Forma mínima de Turno laboral que necesita la UI de nóminas. */
export interface TurnoMin {
  id: string
  nombre: string
}

/** Contrato con sus relaciones expandidas (para la UI de la ficha laboral). */
export interface ContratoLaboralConRelaciones extends ContratoLaboral {
  sector: SectorMin | null
  turno: TurnoMin | null
  conceptos: ConceptoContratoConDetalle[]
}

/** Catálogo: una regla de pago/descuento configurable por empresa. */
export interface ConceptoNomina {
  id: string
  empresa_id: string

  nombre: string
  descripcion: string | null
  icono: string
  color: string

  tipo: TipoConcepto
  categoria: CategoriaConcepto | null

  modo_calculo: ModoCalculoConcepto
  /** Interpretado según `modo_calculo`. NULL solo si modo='manual'. */
  valor: number | null

  /** true = el motor del recibo lo aplica si cumple la condición. */
  automatico: boolean
  /**
   * Estructura abierta para la condición a evaluar. Ejemplos:
   *   { tipo: 'sin_ausencias' }
   *   { tipo: 'sin_tardanzas' }
   *   { tipo: 'antiguedad_minima', meses: 12 }
   *   { tipo: 'siempre' }
   * Se extiende en PRs 6/7.
   */
  condicion_jsonb: Record<string, unknown> | null

  recurrente: boolean
  activo: boolean
  orden: number

  creado_en: string
  creado_por: string | null
  actualizado_en: string
  actualizado_por: string | null
}

/** N:M entre contratos y conceptos. */
export interface ConceptoContrato {
  id: string
  empresa_id: string
  contrato_id: string
  concepto_id: string
  /** Si presente, anula `ConceptoNomina.valor` para este contrato. */
  valor_override: number | null
  activo: boolean
  creado_en: string
  creado_por: string | null
}

/** Vista enriquecida para la UI: concepto + override + datos del catálogo. */
export interface ConceptoContratoConDetalle extends ConceptoContrato {
  concepto: Pick<
    ConceptoNomina,
    'nombre' | 'descripcion' | 'icono' | 'color' | 'tipo' | 'categoria' |
    'modo_calculo' | 'valor' | 'automatico' | 'recurrente'
  >
}

/**
 * Snapshot inmutable: el detalle del recibo que efectivamente entró
 * en un pago concreto. Si el concepto del catálogo se borra o cambia,
 * este registro mantiene los valores históricos exactos.
 */
export interface ConceptoAplicadoPago {
  id: string
  empresa_id: string
  pago_nomina_id: string
  /** FK opcional al catálogo; puede ser null si el concepto fue eliminado. */
  concepto_id: string | null

  /** Snapshot del nombre y tipo al momento del recibo. */
  nombre_snapshot: string
  tipo: TipoConcepto
  monto: number

  /** true si lo aplicó el motor automático; false si lo agregó un humano. */
  automatico: boolean
  detalle: string | null
  creado_en: string
}

// ════════════════════════════════════════════════════════════════
// Snapshot del contrato dentro de pagos_nomina.contrato_snapshot
// ════════════════════════════════════════════════════════════════

/**
 * Forma del JSONB `pagos_nomina.contrato_snapshot`. Se congela al
 * generar el recibo (PR 7) para que el comprobante PDF nunca cambie
 * aunque después se edite o borre el contrato.
 */
export interface ContratoSnapshot {
  contrato_id: string
  fecha_inicio: string
  fecha_fin: string | null
  condicion: CondicionContrato
  modalidad_calculo: ModalidadCalculo
  monto_base: number
  frecuencia_pago: FrecuenciaPago
  regimen: RegimenContrato
  sector: Pick<SectorMin, 'id' | 'nombre'> | null
  turno: TurnoMin | null
}

// ════════════════════════════════════════════════════════════════
// Motor de cálculo del recibo (PR 7)
// ════════════════════════════════════════════════════════════════

/**
 * Métricas de asistencia agregadas para un miembro en un período.
 * Las calcula el motor a partir de la tabla `asistencias`.
 */
export interface MetricasAsistencia {
  /** Días naturales del período (fin - inicio + 1). */
  dias_periodo: number
  /** Días con fichaje completo (hora_entrada presente). */
  dias_trabajados: number
  /** Registros con estado='ausente'. */
  dias_ausentes: number
  /** Registros marcados como tardanza (tipo='tardanza' o flag específico). */
  tardanzas: number
  /**
   * Horas netas trabajadas: suma de (salida - entrada) − almuerzo −
   * salidas particulares por todos los días con fichaje. Usado para
   * modalidad `por_hora`.
   */
  horas_netas: number
}

/**
 * Forma de la columna `condiciones_jsonb` de los conceptos. Las
 * variantes soportadas por el motor V1.
 *
 * - `siempre`            → aplica en todos los recibos del contrato.
 * - `sin_ausencias`      → cumple si dias_ausentes === 0.
 * - `sin_tardanzas`      → cumple si tardanzas === 0.
 * - `minimo_dias`        → cumple si dias_trabajados >= dias.
 * - `antiguedad_minima`  → cumple si meses desde contrato.fecha_inicio >= meses.
 *
 * Si no encaja con ninguna variante o falla la evaluación, el motor
 * trata el concepto como NO cumplido (fail-closed) y lo deja como
 * sugerencia para que el operador lo decida manualmente.
 */
export type CondicionConcepto =
  | { tipo: 'siempre' }
  | { tipo: 'sin_ausencias' }
  | { tipo: 'sin_tardanzas' }
  | { tipo: 'minimo_dias'; dias: number }
  | { tipo: 'antiguedad_minima'; meses: number }

/** Detalle de un concepto efectivamente aplicado por el motor. */
export interface ConceptoAplicadoCalculado {
  concepto_id: string
  nombre: string
  tipo: TipoConcepto
  modo_calculo: ModoCalculoConcepto
  /** Valor usado (override del contrato si existía, sino del catálogo). */
  valor: number | null
  /** Monto efectivo aplicado al recibo. */
  monto: number
  automatico: boolean
  /** Una línea humana explicando por qué se aplicó. */
  detalle: string | null
}

/** Cuota de adelanto vencida en el período → descontada en el recibo. */
export interface CuotaAdelantoAplicada {
  cuota_id: string
  adelanto_id: string
  numero_cuota: number
  monto: number
  fecha_programada: string
}

/**
 * Licencia que solapa con el período y el motor consideró al calcular.
 * - Con `goce_sueldo=true`: informativa, no descuenta nada.
 * - Con `goce_sueldo=false`: el motor descuenta `dias_descontados` del
 *   prorrateo (modalidades fijas) o de `dias_trabajados` (por_dia).
 */
export interface LicenciaAplicada {
  licencia_id: string
  tipo: TipoLicencia
  goce_sueldo: boolean
  fecha_inicio: string
  fecha_fin: string | null
  /** Días del período cubiertos por esta licencia. */
  dias_en_periodo: number
  /**
   * Monto descontado del recibo por esta licencia.
   * 0 si goce_sueldo=true. > 0 si goce_sueldo=false.
   */
  monto_descontado: number
}

/**
 * Resultado completo del motor para un recibo. Cubre todo lo que
 * necesita la UI para mostrar el desglose y el endpoint de creación
 * para persistir el pago + snapshot.
 */
export interface DetalleReciboCalculado {
  miembro_id: string
  empresa_id: string
  periodo_inicio: string
  periodo_fin: string

  /** Métricas agregadas usadas para calcular monto base y aplicar conceptos. */
  asistencia: MetricasAsistencia

  /** Contrato vigente en el período (o el más reciente si todos cerraron). */
  contrato: {
    id: string | null
    snapshot: ContratoSnapshot | null
  }

  /**
   * Monto base calculado según la modalidad del contrato y los datos
   * de asistencia. Es la base sobre la que se aplican porcentajes y
   * el primer renglón del recibo.
   */
  monto_base_calculado: number

  /** Conceptos automáticos que cumplieron condición y se aplicaron. */
  conceptos_aplicados: ConceptoAplicadoCalculado[]

  /**
   * Conceptos del contrato que NO se aplicaron (no eran automáticos,
   * o no cumplieron condición). La UI los muestra como "sugerencias"
   * para que el operador decida si agregarlos manualmente.
   */
  conceptos_sugeridos: ConceptoAplicadoCalculado[]

  /** Cuotas de adelantos del miembro vencidas en este período. */
  adelantos_aplicados: CuotaAdelantoAplicada[]

  /**
   * Licencias que solapan con el período. El motor ya aplicó su efecto
   * sobre `monto_base_calculado`/`subtotal_descuentos`; este array es
   * para que la UI las muestre con su detalle (tipo, días, goce).
   */
  licencias_aplicadas: LicenciaAplicada[]

  /** Suma de monto_base_calculado + conceptos tipo='haber'. */
  subtotal_haberes: number

  /** Suma de conceptos tipo='descuento' + adelantos. */
  subtotal_descuentos: number

  /** subtotal_haberes − subtotal_descuentos. */
  neto: number

  /**
   * Advertencias no fatales (ej. "Sin contrato vigente, se usó monto
   * legacy de miembros"). La UI las muestra como banner amarillo.
   */
  advertencias: string[]
}
