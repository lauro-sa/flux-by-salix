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
  // Motivos "no salida" — el empleado sigue activo, solo cambia el
  // contrato que rige sus condiciones. Se usan al abrir un contrato
  // nuevo que sucede al actual.
  | 'cambio_condiciones'
  | 'renovacion'
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

/**
 * Cada cuánto se aplica el concepto a la liquidación.
 *
 * - `mensual`: el concepto pertenece al mes completo. Aplica solo en la
 *   ÚLTIMA liquidación que cubre el mes (segunda quincena o última
 *   semana). El monto se calcula sobre el básico MENSUAL, no del período.
 *   Default para Presentismo, Premio puntualidad, Antigüedad.
 *
 * - `por_periodo`: aplica en cada período de pago. Default para
 *   descuentos recurrentes (uniforme cuota X/N).
 *
 * - `unico`: aplica una sola vez en la vida del contrato (reservado).
 */
export type PeriodicidadConcepto = 'mensual' | 'por_periodo' | 'unico'

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

  /**
   * Campo derivado del API (no existe en BD): true si este contrato
   * tiene al menos un pago en `pagos_nomina`. La UI lo usa para decidir
   * si los campos económicos son editables (sin pagos) o si hay que
   * crear un contrato nuevo vía "Cambiar condiciones" (con pagos).
   */
  tiene_pagos?: boolean
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

  /**
   * Cada cuánto se aplica este concepto a la liquidación. Default
   * 'mensual' para premios estándar, 'por_periodo' para descuentos
   * de cuota a cuota (uniforme).
   */
  periodicidad: PeriodicidadConcepto

  /**
   * true para conceptos del catálogo base que el sistema seedea
   * automáticamente al instalar el módulo Nóminas. No se pueden
   * eliminar (sí editar y desactivar). Los duplicados que cree la
   * empresa quedan en false.
   */
  es_predefinido: boolean

  creado_en: string
  creado_por: string | null
  actualizado_en: string
  actualizado_por: string | null
}

/**
 * N:M entre contratos y conceptos con vigencia temporal.
 *
 * Una asignación está vigente en un período si:
 *   `fecha_alta <= periodo_fin AND (fecha_baja IS NULL OR fecha_baja >= periodo_inicio)`
 *
 * El campo `activo` se mantiene por compatibilidad y lo sincroniza un
 * trigger de la BD: `activo = (fecha_baja IS NULL)`. Para lógica
 * nueva, usar siempre `fecha_baja IS NULL` (= vigente hoy).
 */
export interface ConceptoContrato {
  id: string
  empresa_id: string
  contrato_id: string
  concepto_id: string
  /** Si presente, anula `ConceptoNomina.valor` para este contrato. */
  valor_override: number | null
  /** Desde cuándo se aplica este concepto. */
  fecha_alta: string
  /** Desde cuándo deja de aplicarse. NULL = vigente. */
  fecha_baja: string | null
  /** Derivado: `fecha_baja IS NULL`. Mantenido por trigger. */
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
  /**
   * Días con fichaje que cayeron en un feriado. Lo usa la condición
   * `trabajo_feriado` para premios por trabajar feriados. Opcional —
   * los callers que no lo provean (motor puro, fixtures viejas) lo
   * tratan como 0.
   */
  dias_feriados_trabajados?: number
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
  /** Sin ausencias Y sin tardanzas en el período evaluado. */
  | { tipo: 'asistencia_perfecta' }
  | { tipo: 'minimo_dias'; dias: number }
  /** Cumple si trabajó al menos `feriados` días feriados. Default 1. */
  | { tipo: 'trabajo_feriado'; feriados?: number }
  /** Cumple si horas_netas >= horas (período evaluado). */
  | { tipo: 'horas_minimas'; horas: number }
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

/**
 * Movimiento one-off del período (vive en `adelantos_nomina`).
 *
 * Aunque el nombre histórico es "CuotaAdelanto", representa los tres
 * tipos que comparten la misma tabla:
 *   - 'adelanto'  → préstamo a descontar en cuotas (resta al neto).
 *   - 'descuento' → multa o daño puntual (resta al neto).
 *   - 'bono'      → pago extra del patrón en este período (suma al neto).
 *
 * Si `tipo` está ausente (datos pre-migración), se asume 'adelanto'
 * por compatibilidad. La UI los presenta agrupados bajo "Ajustes
 * del período".
 */
export interface CuotaAdelantoAplicada {
  cuota_id: string
  adelanto_id: string
  numero_cuota: number
  monto: number
  fecha_programada: string
  tipo?: 'adelanto' | 'descuento' | 'bono'
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

// ════════════════════════════════════════════════════════════════
// Pagos de nómina y datos bancarios del empleado
// ════════════════════════════════════════════════════════════════

/**
 * Cómo se realizó el pago. Distinguimos transferencia bancaria de
 * cuenta digital (Mercado Pago, Brubank, etc.) porque el operador
 * los maneja distinto: la cuenta destino y el formato de comprobante
 * cambian. Mantenemos `otro` como fallback para casos puntuales.
 */
export type MetodoPagoNomina =
  | 'efectivo'
  | 'transferencia'
  | 'cuenta_digital'
  | 'cheque'
  | 'otro'

/**
 * Cuenta bancaria o digital del empleado, donde se le pueden hacer
 * pagos de nómina. Un mismo miembro puede tener N cuentas (banco
 * + digital + caja de ahorro vieja, etc.). La UI usa `activa` para
 * filtrar las que se ofrecen en el selector de destino.
 */
export interface InfoBancaria {
  id: string
  empresa_id: string
  miembro_id: string
  /** Banco tradicional o billetera virtual. Cambia el default de UI. */
  tipo_pago: 'banco' | 'digital'
  /** Para banco: ahorro/corriente/sueldo. Para digital: libre. */
  tipo_cuenta: string | null
  /** FK al catálogo `entidades_financieras`. Cuando viene, la UI
      muestra el `nombre` de la entidad y el texto libre `banco` queda
      como fallback histórico para cuentas no migradas. */
  entidad_id: string | null
  /** Banco o billetera ("Galicia", "Mercado Pago", "Brubank", etc.). */
  banco: string | null
  /** CBU (22 dígitos en banco), CVU (digital) o número interno. */
  numero_cuenta: string | null
  /** Alias CBU/CVU. Más fácil de copiar al pagar. */
  alias: string | null
  /** Etiqueta libre que el operador le pone ("Cuenta sueldo"). */
  etiqueta: string | null
  /** Nombre del titular si no es el empleado. */
  titular_nombre: string | null
  /** Documento del titular (DNI/CUIT). */
  titular_documento: string | null
  /** Si aparece en el selector de destino al registrar un pago. */
  activa: boolean
  /** Cuenta sugerida al registrar un pago. Solo UNA por miembro a la vez. */
  predeterminada: boolean
  /** Soft-delete: oculta la cuenta sin perder referencias históricas. */
  eliminada: boolean
  creado_por: string | null
  creado_en: string
  actualizado_por: string | null
  actualizado_en: string
  /** Aplanado del join con `entidades_financieras` (sql/108). Cuando
      `entidad_id` resuelve a una entidad vigente, este campo trae el
      nombre canónico del catálogo. Para cuentas legacy sin enlace,
      cae al texto libre del campo `banco`. */
  entidad_nombre?: string | null
  /** Código BCRA de la entidad enlazada (autodetectable por CBU). */
  entidad_codigo_banco?: string | null
}

/**
 * Pago de nómina ya registrado. Snapshot del recibo + datos del cobro
 * real (método, fecha, cuenta destino, comprobante).
 */
export interface PagoNomina {
  id: string
  empresa_id: string
  miembro_id: string
  contrato_id: string | null
  fecha_inicio_periodo: string
  fecha_fin_periodo: string
  concepto: string
  monto_sugerido: number | null
  monto_abonado: number
  dias_habiles: number | null
  dias_trabajados: number | null
  dias_ausentes: number | null
  tardanzas: number | null
  /** Método con el que efectivamente se pagó. */
  metodo_pago: MetodoPagoNomina
  /** Fecha real del pago (puede diferir de creado_en). */
  fecha_pago: string
  /** Nro de operación / cheque / referencia externa. */
  referencia: string | null
  /** Cuenta destino del pago (NULL si fue efectivo o cheque al portador). */
  info_bancaria_id: string | null
  comprobante_url: string | null
  notas: string | null
  estado: string
  estado_clave: string
  creado_por: string
  creado_por_nombre: string
  creado_en: string
  eliminado: boolean
}
