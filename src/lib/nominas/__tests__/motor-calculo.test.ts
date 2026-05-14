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
    creado_en: '2026-01-01T00:00:00Z',
    creado_por: null,
    actualizado_en: '2026-01-01T00:00:00Z',
    actualizado_por: null,
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
    const presentismo: ConceptoContratoInput = {
      concepto_id: concepto().id,
      valor_override: null,
      concepto: concepto({ nombre: 'Presentismo', condicion_jsonb: { tipo: 'sin_ausencias' } }),
    }
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
    const presentismo: ConceptoContratoInput = {
      concepto_id: concepto().id,
      valor_override: null,
      concepto: concepto({ nombre: 'Presentismo', condicion_jsonb: { tipo: 'sin_ausencias' } }),
    }
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
    const cc: ConceptoContratoInput = {
      concepto_id: 'concepto-1',
      valor_override: 25, // 25% en vez del 10% default
      concepto: concepto({ valor: 10, condicion_jsonb: { tipo: 'siempre' } }),
    }
    const r = calcularReciboPuro(datosBase({ contrato: c, conceptos_contrato: [cc] }))
    expect(r.conceptos_aplicados[0].valor).toBe(25)
    expect(r.conceptos_aplicados[0].monto).toBe(100000) // 25% de 400k
  })

  it('CASO extra: concepto no automático va a sugerencias', () => {
    const c = contrato({ modalidad_calculo: 'fijo_mensual', monto_base: 400000 })
    const cc: ConceptoContratoInput = {
      concepto_id: 'concepto-1',
      valor_override: null,
      concepto: concepto({ automatico: false }),
    }
    const r = calcularReciboPuro(datosBase({ contrato: c, conceptos_contrato: [cc] }))
    expect(r.conceptos_aplicados).toHaveLength(0)
    expect(r.conceptos_sugeridos).toHaveLength(1)
  })
})
