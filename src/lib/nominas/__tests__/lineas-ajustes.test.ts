/**
 * Tests del helper compartido `construirLineasAjustes`.
 *
 * Cubre los escenarios que motivaron el refactor (PR 4):
 *   - Solo adelantos / solo descuentos / solo bonos / mezcla
 *   - Saldo a favor del período anterior
 *   - Cuotas múltiples vs cuota única
 *   - Items fuera del período / cancelados / sin cuotas
 *   - Orden cronológico estable
 *
 * Single source of truth → si esto pasa, frontend preview, backend
 * correo, backend WhatsApp y editor de plantillas Meta están alineados.
 */

import { describe, it, expect } from 'vitest'
import { construirLineasAjustes, type ItemAdelantoBruto } from '../lineas-ajustes'

const PERIODO_DESDE = '2026-04-16'
const PERIODO_HASTA = '2026-04-30'

function adelanto(p: Partial<ItemAdelantoBruto> = {}): ItemAdelantoBruto {
  return {
    id: 'a1',
    tipo: 'adelanto',
    notas: 'Adelanto compra ML',
    // El helper imprime la `fecha_solicitud` (cuándo se pidió),
    // no la `fecha_programada` de la cuota. Las mantenemos iguales
    // por simplicidad — los tests de cuotas múltiples las separan.
    fecha_solicitud: '2026-04-29',
    estado: 'activo',
    cuotas_totales: 1,
    cuotas: [{ numero_cuota: 1, fecha_programada: '2026-04-29', monto_cuota: '30229' }],
    ...p,
  }
}

describe('construirLineasAjustes', () => {
  it('devuelve vacío si no hay adelantos ni saldo', () => {
    const { descuentos, bonos } = construirLineasAjustes([], PERIODO_DESDE, PERIODO_HASTA)
    expect(descuentos).toEqual([])
    expect(bonos).toEqual([])
  })

  it('un adelanto de cuota única no incluye sufijo "cuota X/Y"', () => {
    const { descuentos } = construirLineasAjustes([adelanto()], PERIODO_DESDE, PERIODO_HASTA)
    expect(descuentos).toEqual(['• *−$30.229* · Adelanto compra ML · 29-abr'])
  })

  it('un adelanto en cuotas múltiples incluye "cuota X/Y"', () => {
    const items = [adelanto({
      notas: 'Inyectores',
      cuotas_totales: 2,
      fecha_solicitud: '2026-04-17',
      cuotas: [{ numero_cuota: 2, fecha_programada: '2026-04-17', monto_cuota: '58000' }],
    })]
    const { descuentos } = construirLineasAjustes(items, PERIODO_DESDE, PERIODO_HASTA)
    expect(descuentos).toEqual(['• *−$58.000* · Inyectores · cuota 2/2 · 17-abr'])
  })

  it('agrega saldo a favor del período anterior al inicio de descuentos', () => {
    const { descuentos } = construirLineasAjustes([adelanto()], PERIODO_DESDE, PERIODO_HASTA, {
      saldoAnterior: 18000,
    })
    expect(descuentos[0]).toBe('• *−$18.000* · A favor del período anterior')
    expect(descuentos).toHaveLength(2)
  })

  it('ignora saldo negativo (= deuda del empleado, se maneja afuera)', () => {
    const { descuentos } = construirLineasAjustes([], PERIODO_DESDE, PERIODO_HASTA, {
      saldoAnterior: -5000,
    })
    expect(descuentos).toEqual([])
  })

  it('separa bonos en su propia lista con signo +', () => {
    const items = [
      adelanto({ tipo: 'bono', notas: 'Bono producción', fecha_solicitud: '2026-04-30',
        cuotas: [{ numero_cuota: 1, fecha_programada: '2026-04-30', monto_cuota: '25000' }] }),
      adelanto(),
    ]
    const { descuentos, bonos } = construirLineasAjustes(items, PERIODO_DESDE, PERIODO_HASTA)
    expect(bonos).toEqual(['• *+$25.000* · Bono producción · 30-abr'])
    expect(descuentos).toEqual(['• *−$30.229* · Adelanto compra ML · 29-abr'])
  })

  it('respeta el alias adelantos_cuotas (shape de Supabase join)', () => {
    const items = [{
      tipo: 'adelanto',
      notas: 'Test join',
      fecha_solicitud: '2026-04-20',
      estado: 'activo',
      cuotas_totales: 1,
      adelantos_cuotas: [{ numero_cuota: 1, fecha_programada: '2026-04-20', monto_cuota: '10000' }],
    }] as ItemAdelantoBruto[]
    const { descuentos } = construirLineasAjustes(items, PERIODO_DESDE, PERIODO_HASTA)
    expect(descuentos).toEqual(['• *−$10.000* · Test join · 20-abr'])
  })

  it('omite adelantos cancelados', () => {
    const items = [adelanto({ estado: 'cancelado' }), adelanto({ id: 'a2' })]
    const { descuentos } = construirLineasAjustes(items, PERIODO_DESDE, PERIODO_HASTA)
    expect(descuentos).toHaveLength(1)
  })

  it('omite adelantos cuya cuota cae fuera del período', () => {
    const items = [adelanto({
      cuotas: [{ numero_cuota: 1, fecha_programada: '2026-05-15', monto_cuota: '10000' }],
    })]
    const { descuentos } = construirLineasAjustes(items, PERIODO_DESDE, PERIODO_HASTA)
    expect(descuentos).toEqual([])
  })

  it('ordena por fecha_solicitud ascendente (más viejo primero)', () => {
    const items = [
      adelanto({ id: 'b', fecha_solicitud: '2026-04-29', notas: 'Tercero',
        cuotas: [{ numero_cuota: 1, fecha_programada: '2026-04-29', monto_cuota: '1000' }] }),
      adelanto({ id: 'a', fecha_solicitud: '2026-04-17', notas: 'Primero',
        cuotas: [{ numero_cuota: 1, fecha_programada: '2026-04-17', monto_cuota: '2000' }] }),
      adelanto({ id: 'c', fecha_solicitud: '2026-04-26', notas: 'Segundo',
        cuotas: [{ numero_cuota: 1, fecha_programada: '2026-04-26', monto_cuota: '3000' }] }),
    ]
    const { descuentos } = construirLineasAjustes(items, PERIODO_DESDE, PERIODO_HASTA)
    // Con el formato monto-adelante-bold (`• *−$X* · Descripción · …`),
    // el nombre queda en el segundo segmento del split por ' · '.
    expect(descuentos.map(l => l.split(' · ')[1])).toEqual(['Primero', 'Segundo', 'Tercero'])
  })

  it('respeta tipos descuento vs adelanto en el fallback del nombre', () => {
    const items = [
      adelanto({ tipo: 'descuento', notas: null,
        cuotas: [{ numero_cuota: 1, fecha_programada: '2026-04-20', monto_cuota: '500' }] }),
      adelanto({ id: 'a2', tipo: 'adelanto', notas: null,
        cuotas: [{ numero_cuota: 1, fecha_programada: '2026-04-21', monto_cuota: '500' }] }),
    ]
    const { descuentos } = construirLineasAjustes(items, PERIODO_DESDE, PERIODO_HASTA)
    expect(descuentos[0]).toContain('Descuento')
    expect(descuentos[1]).toContain('Adelanto')
  })
})
