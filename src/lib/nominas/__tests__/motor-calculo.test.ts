/**
 * Tests del motor de cálculo (PR 7 del plan).
 *
 * Probamos el core puro `calcularReciboPuro` con datos sintéticos.
 * Los 7 escenarios obligatorios del plan + algunos extra para cubrir
 * branches importantes.
 */

import { describe, it, expect } from 'vitest'
import {
  calcularReciboPuro,
  calcularMontoBase,
  calcularMetricasAsistencia,
  evaluarCondicion,
  parsearCondicion,
  type DatosCalculoRecibo,
  type AsistenciaInput,
  type ConceptoContratoInput,
  type AjusteConceptoPeriodoInput,
} from '../motor-calculo'
import type {
  ContratoLaboral,
  ConceptoNomina,
  MetricasAsistencia,
} from '@/tipos/nominas'

// ════════════════════════════════════════════════════════════════
// Fixtures
// ════════════════════════════════════════════════════════════════

function contrato(p: Partial<ContratoLaboral> = {}): ContratoLaboral {
  return {
    id: 'contrato-1',
    empresa_id: 'emp-1',
    miembro_id: 'miem-1',
    fecha_inicio: '2026-01-01',
    fecha_fin: null,
    vigente: true,
    condicion: 'tiempo_indeterminado',
    modalidad_calculo: 'fijo_mensual',
    monto_base: 400000,
    frecuencia_pago: 'mensual',
    sector_id: null,
    turno_id: null,
    regimen: 'informal',
    pdf_url: null,
    motivo_cambio: null,
    notas: null,
    motivo_fin: null,
    nota_fin: null,
    creado_en: '2026-01-01T00:00:00Z',
    creado_por: null,
    actualizado_en: '2026-01-01T00:00:00Z',
    actualizado_por: null,
    ...p,
  }
}

function concepto(p: Partial<ConceptoNomina> = {}): ConceptoNomina {
  return {
    id: 'concepto-1',
    empresa_id: 'emp-1',
    nombre: 'Presentismo',
    descripcion: null,
    icono: 'star',
    color: '#10b981',
    tipo: 'haber',
    categoria: 'presentismo',
    modo_calculo: 'porcentaje_basico',
    valor: 10,
    automatico: true,
    condicion_jsonb: { tipo: 'sin_ausencias' },
    recurrente: true,
    activo: true,
    orden: 0,
    periodicidad: 'mensual',
    es_predefinido: false,
    creado_en: '2026-01-01T00:00:00Z',
    creado_por: null,
    actualizado_en: '2026-01-01T00:00:00Z',
    actualizado_por: null,
    ...p,
  }
}

/**
 * Helper para armar un `ConceptoContratoInput` con vigencia por
 * defecto bien amplia (alta en 2020, sin baja). Los tests que quieran
 * probar vigencia por fecha pueden sobrescribir `fecha_alta` y/o
 * `fecha_baja` puntualmente.
 */
function asignacion(p: Partial<ConceptoContratoInput> = {}): ConceptoContratoInput {
  return {
    concepto_id: 'concepto-1',
    valor_override: null,
    fecha_alta: '2020-01-01',
    fecha_baja: null,
    concepto: concepto(),
    ...p,
  }
}

function asistenciaTrabajada(fecha: string, opts: Partial<AsistenciaInput> = {}): AsistenciaInput {
  return {
    fecha,
    estado: 'completo',
    tipo: null,
    hora_entrada: '08:00',
    hora_salida: '17:00',
    inicio_almuerzo: '12:00',
    fin_almuerzo: '13:00',
    salida_particular: null,
    vuelta_particular: null,
    ...opts,
  }
}

function datosBase(p: Partial<DatosCalculoRecibo> = {}): DatosCalculoRecibo {
  return {
    miembro_id: 'miem-1',
    empresa_id: 'emp-1',
    periodo_inicio: '2026-04-01',
    periodo_fin: '2026-04-30',
    contrato: contrato(),
    asistencias: [],
    conceptos_contrato: [],
    cuotas_adelanto: [],
    licencias: [],
    sector: null,
    turno: null,
    ...p,
  }
}

// ════════════════════════════════════════════════════════════════
// Helpers utilitarios
// ════════════════════════════════════════════════════════════════

describe('parsearCondicion', () => {
  it('reconoce las variantes válidas', () => {
    expect(parsearCondicion({ tipo: 'siempre' })).toEqual({ tipo: 'siempre' })
    expect(parsearCondicion({ tipo: 'sin_ausencias' })).toEqual({ tipo: 'sin_ausencias' })
    expect(parsearCondicion({ tipo: 'sin_tardanzas' })).toEqual({ tipo: 'sin_tardanzas' })
    expect(parsearCondicion({ tipo: 'minimo_dias', dias: 20 })).toEqual({ tipo: 'minimo_dias', dias: 20 })
    expect(parsearCondicion({ tipo: 'antiguedad_minima', meses: 6 })).toEqual({ tipo: 'antiguedad_minima', meses: 6 })
  })

  it('devuelve null para variantes desconocidas o malformadas', () => {
    expect(parsearCondicion(null)).toBeNull()
    expect(parsearCondicion({ tipo: 'inventado' })).toBeNull()
    expect(parsearCondicion({ tipo: 'minimo_dias' })).toBeNull() // falta `dias`
    expect(parsearCondicion({ tipo: 'antiguedad_minima', meses: 'seis' })).toBeNull()
  })
})

describe('evaluarCondicion', () => {
  const metricas: MetricasAsistencia = {
    dias_periodo: 30,
    dias_trabajados: 22,
    dias_ausentes: 0,
    tardanzas: 0,
    horas_netas: 176,
  }

  it('"siempre" siempre cumple', () => {
    expect(evaluarCondicion({ tipo: 'siempre' }, metricas, contrato(), '2026-04-30').cumple).toBe(true)
  })

  it('"sin_ausencias" cumple si ausentes=0', () => {
    expect(evaluarCondicion({ tipo: 'sin_ausencias' }, metricas, contrato(), '2026-04-30').cumple).toBe(true)
    const con1 = { ...metricas, dias_ausentes: 1 }
    expect(evaluarCondicion({ tipo: 'sin_ausencias' }, con1, contrato(), '2026-04-30').cumple).toBe(false)
  })

  it('"antiguedad_minima" usa fecha_inicio del contrato', () => {
    const c = contrato({ fecha_inicio: '2024-01-01' })
    // Más de 12 meses desde 2024-01-01 hasta 2026-04-30 → cumple.
    expect(evaluarCondicion({ tipo: 'antiguedad_minima', meses: 12 }, metricas, c, '2026-04-30').cumple).toBe(true)
    // 24 meses → también cumple.
    expect(evaluarCondicion({ tipo: 'antiguedad_minima', meses: 24 }, metricas, c, '2026-04-30').cumple).toBe(true)
    // 36 meses (3 años) → no cumple, solo lleva ~2 años y 4 meses.
    expect(evaluarCondicion({ tipo: 'antiguedad_minima', meses: 36 }, metricas, c, '2026-04-30').cumple).toBe(false)
  })

  it('"minimo_dias" compara dias_trabajados', () => {
    expect(evaluarCondicion({ tipo: 'minimo_dias', dias: 20 }, metricas, contrato(), '2026-04-30').cumple).toBe(true)
    expect(evaluarCondicion({ tipo: 'minimo_dias', dias: 25 }, metricas, contrato(), '2026-04-30').cumple).toBe(false)
  })
})

describe('calcularMetricasAsistencia', () => {
  it('cuenta días trabajados, ausencias, tardanzas y horas netas', () => {
    const asistencias: AsistenciaInput[] = [
      asistenciaTrabajada('2026-04-01'), // 8h netas (9h - 1h almuerzo)
      asistenciaTrabajada('2026-04-02'),
      asistenciaTrabajada('2026-04-03', { tipo: 'tardanza' }),
      { fecha: '2026-04-04', estado: 'ausente', tipo: null, hora_entrada: null, hora_salida: null, inicio_almuerzo: null, fin_almuerzo: null, salida_particular: null, vuelta_particular: null },
    ]
    const m = calcularMetricasAsistencia(asistencias, '2026-04-01', '2026-04-30')
    expect(m.dias_periodo).toBe(30)
    expect(m.dias_trabajados).toBe(3)
    expect(m.dias_ausentes).toBe(1)
    expect(m.tardanzas).toBe(1)
    expect(m.horas_netas).toBe(24) // 3 días × 8h
  })

  it('ignora asistencias fuera del período', () => {
    const asistencias: AsistenciaInput[] = [
      asistenciaTrabajada('2026-03-31'), // fuera
      asistenciaTrabajada('2026-04-01'), // dentro
      asistenciaTrabajada('2026-05-01'), // fuera
    ]
    const m = calcularMetricasAsistencia(asistencias, '2026-04-01', '2026-04-30')
    expect(m.dias_trabajados).toBe(1)
  })
})

describe('calcularMontoBase', () => {
  const baseAsist: MetricasAsistencia = {
    dias_periodo: 30,
    dias_trabajados: 22,
    dias_ausentes: 0,
    tardanzas: 0,
    horas_netas: 176,
  }

  it('por_dia multiplica monto_base × dias_trabajados', () => {
    expect(calcularMontoBase('por_dia', 30000, baseAsist, '2026-04-01', '2026-04-30')).toBe(660000)
  })

  it('por_hora multiplica monto_base × horas_netas', () => {
    expect(calcularMontoBase('por_hora', 3000, baseAsist, '2026-04-01', '2026-04-30')).toBe(528000)
  })

  it('fijo_mensual entrega monto completo cuando el período es 30 días', () => {
    expect(calcularMontoBase('fijo_mensual', 400000, baseAsist, '2026-04-01', '2026-04-30')).toBe(400000)
  })

  it('fijo_mensual prorratea a la mitad para una quincena (15 días)', () => {
    const quincena = { ...baseAsist, dias_periodo: 15 }
    expect(calcularMontoBase('fijo_mensual', 400000, quincena, '2026-04-01', '2026-04-15')).toBe(200000)
  })

  it('fijo_quincenal entrega monto completo para una quincena', () => {
    const quincena = { ...baseAsist, dias_periodo: 15 }
    expect(calcularMontoBase('fijo_quincenal', 50000, quincena, '2026-04-01', '2026-04-15')).toBe(50000)
  })
})

// ════════════════════════════════════════════════════════════════
// Casos de fin a fin del plan
// ════════════════════════════════════════════════════════════════

describe('calcularReciboPuro — casos del plan', () => {
  it('CASO 1: jornalero por_dia con frecuencia quincenal', () => {
    const c = contrato({ modalidad_calculo: 'por_dia', monto_base: 30000, frecuencia_pago: 'quincenal' })
    const asistencias = Array.from({ length: 10 }, (_, i) =>
      asistenciaTrabajada(`2026-04-${String(i + 1).padStart(2, '0')}`),
    )
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      asistencias,
      periodo_inicio: '2026-04-01',
      periodo_fin: '2026-04-15',
    }))
    expect(r.asistencia.dias_trabajados).toBe(10)
    expect(r.monto_base_calculado).toBe(300000)
    expect(r.subtotal_haberes).toBe(300000)
    expect(r.neto).toBe(300000)
  })

  it('CASO 2: sueldo fijo_mensual + frecuencia mensual', () => {
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000, frecuencia_pago: 'mensual' })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      asistencias: Array.from({ length: 22 }, (_, i) =>
        asistenciaTrabajada(`2026-04-${String(i + 1).padStart(2, '0')}`),
      ),
      periodo_inicio: '2026-04-01',
      periodo_fin: '2026-04-30',
    }))
    expect(r.monto_base_calculado).toBe(400000)
    expect(r.neto).toBe(400000)
  })

  it('CASO 3: sueldo fijo_mensual pedido para una quincena (prorrateo)', () => {
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      asistencias: Array.from({ length: 10 }, (_, i) =>
        asistenciaTrabajada(`2026-04-${String(i + 1).padStart(2, '0')}`),
      ),
      periodo_inicio: '2026-04-01',
      periodo_fin: '2026-04-15', // 15 días
    }))
    expect(r.monto_base_calculado).toBe(200000)
    expect(r.neto).toBe(200000)
  })

  it('CASO 4: presentismo se aplica cuando no hay ausencias', () => {
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const presentismo = asignacion({
      concepto_id: concepto().id,
      concepto: concepto({ nombre: 'Presentismo', condicion_jsonb: { tipo: 'sin_ausencias' } }),
    })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      conceptos_contrato: [presentismo],
      asistencias: Array.from({ length: 22 }, (_, i) =>
        asistenciaTrabajada(`2026-04-${String(i + 1).padStart(2, '0')}`),
      ),
    }))
    expect(r.conceptos_aplicados).toHaveLength(1)
    expect(r.conceptos_aplicados[0].nombre).toBe('Presentismo')
    expect(r.conceptos_aplicados[0].monto).toBe(40000) // 10% de 400.000
    expect(r.subtotal_haberes).toBe(440000)
    expect(r.neto).toBe(440000)
  })

  it('CASO 5: presentismo NO se aplica si hubo ausencia', () => {
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const presentismo = asignacion({
      concepto_id: concepto().id,
      concepto: concepto({ nombre: 'Presentismo', condicion_jsonb: { tipo: 'sin_ausencias' } }),
    })
    const asistencias: AsistenciaInput[] = [
      ...Array.from({ length: 21 }, (_, i) => asistenciaTrabajada(`2026-04-${String(i + 1).padStart(2, '0')}`)),
      { fecha: '2026-04-22', estado: 'ausente', tipo: null, hora_entrada: null, hora_salida: null, inicio_almuerzo: null, fin_almuerzo: null, salida_particular: null, vuelta_particular: null },
    ]
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      conceptos_contrato: [presentismo],
      asistencias,
    }))
    expect(r.conceptos_aplicados).toHaveLength(0)
    expect(r.conceptos_sugeridos).toHaveLength(1) // queda como sugerencia
    expect(r.conceptos_sugeridos[0].detalle).toContain('ausencia')
    expect(r.subtotal_haberes).toBe(400000)
  })

  it('CASO 6: cuota de adelanto vencida se descuenta del neto', () => {
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      cuotas_adelanto: [{
        id: 'cuota-1',
        adelanto_id: 'ad-1',
        numero_cuota: 1,
        monto_cuota: 50000,
        fecha_programada: '2026-04-15',
        estado: 'pendiente',
      }],
    }))
    expect(r.adelantos_aplicados).toHaveLength(1)
    expect(r.adelantos_aplicados[0].monto).toBe(50000)
    expect(r.subtotal_descuentos).toBe(50000)
    expect(r.neto).toBe(350000)
  })

  it('CASO 6b: cuotas atrasadas de períodos anteriores también se acumulan', () => {
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      cuotas_adelanto: [
        // Atrasada del período anterior (marzo) — todavía pendiente.
        { id: 'cuota-m', adelanto_id: 'ad-1', numero_cuota: 1, monto_cuota: 30000, fecha_programada: '2026-03-15', estado: 'pendiente' },
        // Del período actual (abril).
        { id: 'cuota-a', adelanto_id: 'ad-1', numero_cuota: 2, monto_cuota: 30000, fecha_programada: '2026-04-15', estado: 'pendiente' },
      ],
    }))
    expect(r.adelantos_aplicados).toHaveLength(2)
    expect(r.subtotal_descuentos).toBe(60000)
    expect(r.neto).toBe(340000)
  })

  it('CASO 6c: cuota futura (post-periodo) NO se descuenta', () => {
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      cuotas_adelanto: [
        { id: 'cuota-may', adelanto_id: 'ad-1', numero_cuota: 1, monto_cuota: 50000, fecha_programada: '2026-05-15', estado: 'pendiente' },
      ],
    }))
    expect(r.adelantos_aplicados).toHaveLength(0)
    expect(r.neto).toBe(400000)
  })

  it('CASO 6d: bono del período SUMA al neto (no resta como adelanto)', () => {
    // Bono one-off de $80.000 sobre un básico de $400.000 → neto $480.000.
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      cuotas_adelanto: [{
        id: 'bono-1',
        adelanto_id: 'aj-bono',
        numero_cuota: 1,
        monto_cuota: 80000,
        fecha_programada: '2026-04-15',
        estado: 'pendiente',
        tipo: 'bono',
      }],
    }))
    expect(r.adelantos_aplicados).toHaveLength(1)
    expect(r.adelantos_aplicados[0].tipo).toBe('bono')
    expect(r.subtotal_descuentos).toBe(0)
    expect(r.subtotal_haberes).toBe(480000)
    expect(r.neto).toBe(480000)
  })

  it('CASO 6e: bono + adelanto en el mismo período (suma uno, resta el otro)', () => {
    // Básico $400.000, bono $80.000 (suma), adelanto $50.000 (resta).
    // Neto esperado: 400.000 + 80.000 − 50.000 = 430.000.
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      cuotas_adelanto: [
        { id: 'bono-1', adelanto_id: 'aj-b', numero_cuota: 1, monto_cuota: 80000, fecha_programada: '2026-04-15', estado: 'pendiente', tipo: 'bono' },
        { id: 'cuota-1', adelanto_id: 'aj-a', numero_cuota: 1, monto_cuota: 50000, fecha_programada: '2026-04-15', estado: 'pendiente', tipo: 'adelanto' },
      ],
    }))
    expect(r.subtotal_haberes).toBe(480000)
    expect(r.subtotal_descuentos).toBe(50000)
    expect(r.neto).toBe(430000)
  })

  it('CASO 7: cambio de contrato a mitad de período (toma el más reciente que cubre fin)', () => {
    // El motor solo recibe UN contrato — la responsabilidad de elegirlo
    // es del loader. Acá probamos que con un contrato que arrancó dentro
    // del período el motor calcula bien usando ese.
    const contratoNuevo = contrato({
      fecha_inicio: '2026-04-15',
      monto_base: 500000,  // subió de 400k a 500k
    })
    const r = calcularReciboPuro(datosBase({
      contrato: contratoNuevo,
      asistencias: Array.from({ length: 22 }, (_, i) =>
        asistenciaTrabajada(`2026-04-${String(i + 1).padStart(2, '0')}`),
      ),
    }))
    expect(r.contrato.snapshot?.monto_base).toBe(500000)
    expect(r.monto_base_calculado).toBe(500000)
  })

  it('CASO extra: sin contrato → emite advertencia + monto 0', () => {
    const r = calcularReciboPuro(datosBase({ contrato: null }))
    expect(r.monto_base_calculado).toBe(0)
    expect(r.contrato.snapshot).toBeNull()
    expect(r.advertencias).toHaveLength(1)
    expect(r.advertencias[0]).toContain('Sin contrato')
  })

  it('CASO extra: concepto con valor_override usa el override, no el del catálogo', () => {
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const cc = asignacion({
      valor_override: 25, // 25% en vez del 10% default
      concepto: concepto({ valor: 10, condicion_jsonb: { tipo: 'siempre' } }),
    })
    const r = calcularReciboPuro(datosBase({ contrato: c, conceptos_contrato: [cc] }))
    expect(r.conceptos_aplicados[0].valor).toBe(25)
    expect(r.conceptos_aplicados[0].monto).toBe(100000) // 25% de 400k
  })

  it('CASO extra: concepto no automático va a sugerencias', () => {
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const cc = asignacion({
      concepto: concepto({ automatico: false }),
    })
    const r = calcularReciboPuro(datosBase({ contrato: c, conceptos_contrato: [cc] }))
    expect(r.conceptos_aplicados).toHaveLength(0)
    expect(r.conceptos_sugeridos).toHaveLength(1)
  })
})

// ════════════════════════════════════════════════════════════════
// Vigencia temporal de conceptos (sql/091)
// ════════════════════════════════════════════════════════════════

describe('calcularReciboPuro — vigencia de conceptos', () => {
  it('concepto con fecha_alta posterior al período NO se aplica', () => {
    // Período abril 2026, concepto dado de alta el 2026-05-01.
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const cc = asignacion({
      fecha_alta: '2026-05-01',
      concepto: concepto({ condicion_jsonb: { tipo: 'siempre' } }),
    })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      conceptos_contrato: [cc],
      asistencias: Array.from({ length: 22 }, (_, i) =>
        asistenciaTrabajada(`2026-04-${String(i + 1).padStart(2, '0')}`),
      ),
    }))
    expect(r.conceptos_aplicados).toHaveLength(0)
  })

  it('concepto con fecha_baja anterior al período NO se aplica', () => {
    // Período abril 2026, concepto cerrado el 2026-03-15.
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const cc = asignacion({
      fecha_alta: '2025-01-01',
      fecha_baja: '2026-03-15',
      concepto: concepto({ condicion_jsonb: { tipo: 'siempre' } }),
    })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      conceptos_contrato: [cc],
      asistencias: Array.from({ length: 22 }, (_, i) =>
        asistenciaTrabajada(`2026-04-${String(i + 1).padStart(2, '0')}`),
      ),
    }))
    expect(r.conceptos_aplicados).toHaveLength(0)
  })

  it('concepto vigente que solapa parcialmente con el período SÍ se aplica', () => {
    // Período abril 2026, concepto dado de alta el 2026-04-15 (mitad del período).
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const cc = asignacion({
      fecha_alta: '2026-04-15',
      fecha_baja: null,
      concepto: concepto({ condicion_jsonb: { tipo: 'siempre' } }),
    })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      conceptos_contrato: [cc],
      asistencias: Array.from({ length: 22 }, (_, i) =>
        asistenciaTrabajada(`2026-04-${String(i + 1).padStart(2, '0')}`),
      ),
    }))
    // El motor no proratea por días dentro del período — si está
    // vigente en algún momento del período, se aplica completo. Esto
    // es intencional: el motor ya proratea el básico por días reales,
    // los conceptos como Presentismo o Antigüedad son montos
    // mensuales fijos que no se reparten.
    expect(r.conceptos_aplicados).toHaveLength(1)
    expect(r.conceptos_aplicados[0].monto).toBe(40000) // 10% de 400k
  })

  it('concepto cerrado dentro del período SÍ se aplica (snapshot histórico)', () => {
    // Período abril 2026, concepto cerrado el 2026-04-20 — solapa.
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const cc = asignacion({
      fecha_alta: '2025-01-01',
      fecha_baja: '2026-04-20',
      concepto: concepto({ condicion_jsonb: { tipo: 'siempre' } }),
    })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      conceptos_contrato: [cc],
      asistencias: Array.from({ length: 22 }, (_, i) =>
        asistenciaTrabajada(`2026-04-${String(i + 1).padStart(2, '0')}`),
      ),
    }))
    expect(r.conceptos_aplicados).toHaveLength(1)
  })
})

// ════════════════════════════════════════════════════════════════
// Periodicidad de conceptos (mensual / por_periodo / unico)
// ════════════════════════════════════════════════════════════════

describe('calcularReciboPuro — periodicidad de conceptos', () => {
  it('concepto MENSUAL en primera quincena (1-15) → NO se aplica, va a sugerencias', () => {
    // Empleado quincenal con Presentismo mensual del 10%. Período 1-15
    // (NO incluye el último día del mes) → el motor no lo aplica acá,
    // lo deja como sugerencia con explicación.
    const c = contrato({ modalidad_calculo: 'fijo_quincenal', monto_base: 200000 })
    const presentismo = asignacion({
      concepto: concepto({
        nombre: 'Presentismo',
        periodicidad: 'mensual',
        condicion_jsonb: { tipo: 'sin_ausencias' },
      }),
    })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      conceptos_contrato: [presentismo],
      periodo_inicio: '2026-04-01',
      periodo_fin: '2026-04-15',
      asistencias: Array.from({ length: 11 }, (_, i) =>
        asistenciaTrabajada(`2026-04-${String(i + 1).padStart(2, '0')}`),
      ),
    }))
    expect(r.conceptos_aplicados).toHaveLength(0)
    expect(r.conceptos_sugeridos).toHaveLength(1)
    expect(r.conceptos_sugeridos[0].detalle).toMatch(/última liquidación del mes/)
  })

  it('concepto MENSUAL en segunda quincena (16-30) → SÍ se aplica sobre el básico mensual completo', () => {
    // Mismo empleado, segunda quincena. Como es la última del mes,
    // el Presentismo del 10% se aplica. Importante: el monto se
    // calcula sobre el básico MENSUAL (200k × 2 = 400k → 10% = 40k),
    // no sobre el básico de la quincena (200k → 10% = 20k).
    const c = contrato({ modalidad_calculo: 'fijo_quincenal', monto_base: 200000 })
    const presentismo = asignacion({
      concepto: concepto({
        nombre: 'Presentismo',
        periodicidad: 'mensual',
        condicion_jsonb: { tipo: 'sin_ausencias' },
      }),
    })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      conceptos_contrato: [presentismo],
      periodo_inicio: '2026-04-16',
      periodo_fin: '2026-04-30',
      asistencias: Array.from({ length: 11 }, (_, i) =>
        asistenciaTrabajada(`2026-04-${String(i + 16).padStart(2, '0')}`),
      ),
    }))
    expect(r.conceptos_aplicados).toHaveLength(1)
    expect(r.conceptos_aplicados[0].monto).toBe(40000) // 10% de 400.000 (mensual)
  })

  it('concepto POR_PERIODO (no mensual) se aplica en CADA quincena', () => {
    // Concepto recurrente por período (ej. descuento de uniforme en
    // cuotas) tiene que aplicarse en TODAS las liquidaciones, no solo
    // la última del mes. Acá un haber por_periodo en primera quincena
    // que sí debe aparecer.
    const c = contrato({ modalidad_calculo: 'fijo_quincenal', monto_base: 200000 })
    const recurrente = asignacion({
      concepto: concepto({
        nombre: 'Bono recurrente',
        periodicidad: 'por_periodo',
        modo_calculo: 'monto_fijo',
        valor: 5000,
        condicion_jsonb: { tipo: 'siempre' },
      }),
    })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      conceptos_contrato: [recurrente],
      periodo_inicio: '2026-04-01',
      periodo_fin: '2026-04-15',
    }))
    expect(r.conceptos_aplicados).toHaveLength(1)
    expect(r.conceptos_aplicados[0].monto).toBe(5000)
  })

  it('concepto UNICO nunca se aplica automáticamente, siempre va a sugerencias', () => {
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const unico = asignacion({
      concepto: concepto({
        nombre: 'Aguinaldo',
        periodicidad: 'unico',
        modo_calculo: 'monto_fijo',
        valor: 100000,
        condicion_jsonb: { tipo: 'siempre' },
      }),
    })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      conceptos_contrato: [unico],
    }))
    expect(r.conceptos_aplicados).toHaveLength(0)
    expect(r.conceptos_sugeridos).toHaveLength(1)
    expect(r.conceptos_sugeridos[0].detalle).toMatch(/único/i)
  })
})

// ════════════════════════════════════════════════════════════════
// Contratos terminados y licencias (PR contratos-terminar-y-licencias)
// ════════════════════════════════════════════════════════════════

describe('calcularReciboPuro — contrato terminado', () => {
  it('contrato terminado ANTES del período → monto base 0 + advertencia', () => {
    const c = contrato({
      fecha_fin: '2026-03-15',
      vigente: false,
      motivo_fin: 'renuncia',
    })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      periodo_inicio: '2026-04-01',
      periodo_fin: '2026-04-30',
    }))
    expect(r.monto_base_calculado).toBe(0)
    expect(r.advertencias.some(a => a.includes('contrato terminó el 2026-03-15'))).toBe(true)
    expect(r.neto).toBe(0)
  })

  it('contrato terminado DENTRO del período → calcula normal + advertencia para revisar manualmente', () => {
    const c = contrato({
      fecha_fin: '2026-04-15',
      vigente: false,
      motivo_fin: 'despido_sin_causa',
    })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      periodo_inicio: '2026-04-01',
      periodo_fin: '2026-04-30',
    }))
    // Modalidad fijo_mensual con 30 días naturales → 400.000 * (30/30) = 400.000
    expect(r.monto_base_calculado).toBe(400000)
    expect(r.advertencias.some(a => a.includes('dentro del período'))).toBe(true)
  })

  it('contrato vigente sin fecha_fin → sin advertencia de terminado', () => {
    const r = calcularReciboPuro(datosBase())
    expect(r.advertencias.some(a => a.includes('terminó'))).toBe(false)
  })
})

describe('calcularReciboPuro — licencias', () => {
  it('licencia con goce_sueldo=true: informativa, no descuenta nada', () => {
    const r = calcularReciboPuro(datosBase({
      licencias: [{
        id: 'lic-1',
        tipo: 'maternidad',
        fecha_inicio: '2026-04-05',
        fecha_fin: '2026-04-15',
        goce_sueldo: true,
      }],
    }))
    expect(r.licencias_aplicadas).toHaveLength(1)
    expect(r.licencias_aplicadas[0].dias_en_periodo).toBe(11)
    expect(r.licencias_aplicadas[0].monto_descontado).toBe(0)
    expect(r.neto).toBe(400000) // sin cambios
  })

  it('licencia SIN goce en modalidad fijo_mensual: descuenta proporcional', () => {
    const r = calcularReciboPuro(datosBase({
      licencias: [{
        id: 'lic-1',
        tipo: 'suspension_economica',
        fecha_inicio: '2026-04-10',
        fecha_fin: '2026-04-19',
        goce_sueldo: false,
      }],
    }))
    // 10 días sobre 30 naturales: 400.000 / 30 * 10 = 133.333,33
    expect(r.licencias_aplicadas[0].dias_en_periodo).toBe(10)
    expect(r.licencias_aplicadas[0].monto_descontado).toBeCloseTo(133333.33, 2)
    expect(r.subtotal_descuentos).toBeCloseTo(133333.33, 2)
    expect(r.neto).toBeCloseTo(266666.67, 2)
  })

  it('licencia abierta (sin fecha_fin) cuenta hasta el fin del período', () => {
    const r = calcularReciboPuro(datosBase({
      licencias: [{
        id: 'lic-1',
        tipo: 'medica',
        fecha_inicio: '2026-04-20',
        fecha_fin: null,
        goce_sueldo: false,
      }],
    }))
    // De 20 al 30 = 11 días → 400.000 / 30 * 11 = 146.666,67
    expect(r.licencias_aplicadas[0].dias_en_periodo).toBe(11)
    expect(r.licencias_aplicadas[0].monto_descontado).toBeCloseTo(146666.67, 2)
  })

  it('licencia anterior al período no se incluye (queda fuera del rango)', () => {
    const r = calcularReciboPuro(datosBase({
      licencias: [{
        id: 'lic-1',
        tipo: 'medica',
        fecha_inicio: '2026-03-01',
        fecha_fin: '2026-03-15',
        goce_sueldo: false,
      }],
    }))
    // El motor recibe la licencia pero la intersección con el período abril es vacía.
    expect(r.licencias_aplicadas).toHaveLength(0)
  })

  it('licencia SIN goce en modalidad por_hora: emite advertencia, no descuenta', () => {
    const c = contrato({ modalidad_calculo: 'por_hora', monto_base: 5000 })
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      licencias: [{
        id: 'lic-1',
        tipo: 'suspension_disciplinaria',
        fecha_inicio: '2026-04-10',
        fecha_fin: '2026-04-12',
        goce_sueldo: false,
      }],
    }))
    expect(r.licencias_aplicadas[0].monto_descontado).toBe(0)
    expect(r.advertencias.some(a => a.includes('por hora'))).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════
// Ajustes puntuales del período (sql/095)
// ════════════════════════════════════════════════════════════════

describe('calcularReciboPuro — ajustes puntuales del período', () => {
  it("ajuste 'excluir' saca un concepto del contrato aunque cumpla la condición", () => {
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const presentismo = asignacion({
      concepto: concepto({ nombre: 'Presentismo', condicion_jsonb: { tipo: 'sin_ausencias' } }),
    })
    const ajuste: AjusteConceptoPeriodoInput = {
      concepto_id: presentismo.concepto_id,
      tipo_ajuste: 'excluir',
      monto_override: null,
      motivo: 'Llegó tarde 3 veces',
    }
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      conceptos_contrato: [presentismo],
      ajustes_periodo: [ajuste],
      asistencias: Array.from({ length: 22 }, (_, i) =>
        asistenciaTrabajada(`2026-04-${String(i + 1).padStart(2, '0')}`),
      ),
    }))
    expect(r.conceptos_aplicados).toHaveLength(0)
    expect(r.conceptos_sugeridos).toHaveLength(1)
    expect(r.conceptos_sugeridos[0].detalle).toContain('Excluido del período')
    expect(r.conceptos_sugeridos[0].detalle).toContain('Llegó tarde 3 veces')
  })

  it("ajuste 'override' usa el monto manual en lugar del calculado", () => {
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const presentismo = asignacion({
      concepto: concepto({ nombre: 'Presentismo', valor: 10, condicion_jsonb: { tipo: 'sin_ausencias' } }),
    })
    // El motor normalmente calcula 10% de 400k = 40k. Lo overrideamos a 25k.
    const ajuste: AjusteConceptoPeriodoInput = {
      concepto_id: presentismo.concepto_id,
      tipo_ajuste: 'override',
      monto_override: 25000,
      motivo: 'Pago proporcional por baja a mitad de mes',
    }
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      conceptos_contrato: [presentismo],
      ajustes_periodo: [ajuste],
      asistencias: Array.from({ length: 22 }, (_, i) =>
        asistenciaTrabajada(`2026-04-${String(i + 1).padStart(2, '0')}`),
      ),
    }))
    expect(r.conceptos_aplicados).toHaveLength(1)
    expect(r.conceptos_aplicados[0].monto).toBe(25000)
    expect(r.conceptos_aplicados[0].detalle).toContain('Monto ajustado manualmente')
    expect(r.conceptos_aplicados[0].detalle).toContain('proporcional')
  })

  it("ajuste 'agregar' aplica concepto del catálogo no asignado al contrato", () => {
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const bonoNavideno = concepto({
      id: 'concepto-bono-navideno',
      nombre: 'Bono navideño',
      valor: null,
      condicion_jsonb: { tipo: 'siempre' },
    })
    const ajuste: AjusteConceptoPeriodoInput = {
      concepto_id: bonoNavideno.id,
      tipo_ajuste: 'agregar',
      monto_override: 150000,
      motivo: 'Aguinaldo de fin de año',
      concepto: bonoNavideno,
    }
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      // El contrato NO tiene este concepto asignado.
      conceptos_contrato: [],
      ajustes_periodo: [ajuste],
    }))
    expect(r.conceptos_aplicados).toHaveLength(1)
    expect(r.conceptos_aplicados[0].nombre).toBe('Bono navideño')
    expect(r.conceptos_aplicados[0].monto).toBe(150000)
    expect(r.subtotal_haberes).toBe(400000 + 150000)
  })

  it("ajuste 'agregar' sobre concepto que YA está en el contrato se ignora (debería ser override)", () => {
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const presentismo = asignacion({
      concepto: concepto({ nombre: 'Presentismo', condicion_jsonb: { tipo: 'siempre' } }),
    })
    const ajusteInvalido: AjusteConceptoPeriodoInput = {
      concepto_id: presentismo.concepto_id,
      tipo_ajuste: 'agregar',
      monto_override: 99999,
      motivo: 'Esto debería haber sido override',
      concepto: presentismo.concepto,
    }
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      conceptos_contrato: [presentismo],
      ajustes_periodo: [ajusteInvalido],
    }))
    // Solo aparece UNA vez (la del contrato, calculada normal).
    expect(r.conceptos_aplicados).toHaveLength(1)
    expect(r.conceptos_aplicados[0].monto).toBe(40000) // 10% de 400k, no 99999
  })

  it("'excluir' funciona aunque el concepto fuera mensual y no fuera la última liquidación", () => {
    // Quincena 1-15: un concepto mensual normalmente NO se aplicaría
    // (queda como sugerencia). Pero el 'excluir' debe ganar igual.
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const presentismo = asignacion({
      concepto: concepto({
        nombre: 'Presentismo',
        periodicidad: 'mensual',
        condicion_jsonb: { tipo: 'siempre' },
      }),
    })
    const ajuste: AjusteConceptoPeriodoInput = {
      concepto_id: presentismo.concepto_id,
      tipo_ajuste: 'excluir',
      monto_override: null,
      motivo: null,
    }
    const r = calcularReciboPuro(datosBase({
      contrato: c,
      conceptos_contrato: [presentismo],
      ajustes_periodo: [ajuste],
      periodo_inicio: '2026-04-01',
      periodo_fin: '2026-04-15',
    }))
    expect(r.conceptos_aplicados).toHaveLength(0)
    expect(r.conceptos_sugeridos[0].detalle).toContain('Excluido del período')
  })
})
