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

  // Auditoría
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
