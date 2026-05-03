/**
 * Tests de la ventana histórica usada por las tools personales: garantizan
 * que un empleado no pueda consultar más allá de los últimos N periodos.
 */

import { describe, it, expect } from 'vitest'
import { rangoVentanaHistorica, periodoEnVentana } from '../ventana-historica'

describe('rangoVentanaHistorica', () => {
  it('mensual, n=3, 2 mayo → mayo, abril, marzo', () => {
    const fechaRef = new Date('2026-05-02T12:00:00Z')
    const ventana = rangoVentanaHistorica('mensual', 3, fechaRef)
    expect(ventana).toHaveLength(3)
    expect(ventana[0].desde).toBe('2026-05-01') // actual
    expect(ventana[0].hasta).toBe('2026-05-31')
    expect(ventana[1].desde).toBe('2026-04-01') // anterior
    expect(ventana[1].hasta).toBe('2026-04-30')
    expect(ventana[2].desde).toBe('2026-03-01') // antepasado
    expect(ventana[2].hasta).toBe('2026-03-31')
  })

  it('quincenal, n=3, 20 mayo → 16-31 may, 1-15 may, 16-30 abr', () => {
    const fechaRef = new Date('2026-05-20T12:00:00Z')
    const ventana = rangoVentanaHistorica('quincenal', 3, fechaRef)
    expect(ventana[0]).toMatchObject({ desde: '2026-05-16', hasta: '2026-05-31' })
    expect(ventana[1]).toMatchObject({ desde: '2026-05-01', hasta: '2026-05-15' })
    expect(ventana[2]).toMatchObject({ desde: '2026-04-16', hasta: '2026-04-30' })
  })

  it('n=0 → array vacío', () => {
    expect(rangoVentanaHistorica('mensual', 0)).toEqual([])
  })
})

describe('periodoEnVentana', () => {
  it('periodo dentro de los últimos 3 → true', () => {
    const fechaRef = new Date('2026-05-02T12:00:00Z')
    expect(periodoEnVentana('2026-04-01', '2026-04-30', 'mensual', 3, fechaRef)).toBe(true)
    expect(periodoEnVentana('2026-03-01', '2026-03-31', 'mensual', 3, fechaRef)).toBe(true)
  })

  it('periodo más antiguo que la ventana → false', () => {
    const fechaRef = new Date('2026-05-02T12:00:00Z')
    expect(periodoEnVentana('2026-01-01', '2026-01-31', 'mensual', 3, fechaRef)).toBe(false)
  })

  it('periodo desalineado con la frecuencia → false', () => {
    const fechaRef = new Date('2026-05-02T12:00:00Z')
    // No es un periodo válido (no coincide con ningún rango de la ventana).
    expect(periodoEnVentana('2026-04-15', '2026-05-15', 'mensual', 3, fechaRef)).toBe(false)
  })
})
