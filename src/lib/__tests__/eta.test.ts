import { describe, expect, it } from 'vitest'
import { redondearETA, formatearETATexto } from '../eta'

describe('redondearETA', () => {
  it('redondea hacia arriba a múltiplos de 5 hasta 30 min', () => {
    expect(redondearETA(1)).toBe(5)
    expect(redondearETA(5)).toBe(5)
    expect(redondearETA(6)).toBe(10)
    expect(redondearETA(15)).toBe(15)
    expect(redondearETA(22)).toBe(25)
    expect(redondearETA(30)).toBe(30)
  })

  it('redondea hacia arriba a múltiplos de 10 entre 31 y 60 min', () => {
    expect(redondearETA(31)).toBe(40)
    expect(redondearETA(40)).toBe(40)
    expect(redondearETA(45)).toBe(50)
    expect(redondearETA(55)).toBe(60)
    expect(redondearETA(60)).toBe(60)
  })

  it('redondea hacia arriba a múltiplos de 15 cuando supera la hora', () => {
    expect(redondearETA(61)).toBe(75)
    expect(redondearETA(75)).toBe(75)
    expect(redondearETA(80)).toBe(90)
    expect(redondearETA(100)).toBe(105)
  })

  it('nunca devuelve 0 para valores positivos o nulos', () => {
    expect(redondearETA(0)).toBe(5)
    expect(redondearETA(-3)).toBe(5)
  })
})

describe('formatearETATexto', () => {
  it('usa frase "próximos X minutos" bajo los 60 min', () => {
    expect(formatearETATexto(22)).toBe('dentro de los próximos 25 minutos aproximadamente')
    expect(formatearETATexto(30)).toBe('dentro de los próximos 30 minutos aproximadamente')
    expect(formatearETATexto(45)).toBe('dentro de los próximos 50 minutos aproximadamente')
  })

  it('cambia a formato de horas a partir de los 60 min', () => {
    expect(formatearETATexto(60)).toBe('dentro de aproximadamente 1 hora')
    expect(formatearETATexto(120)).toBe('dentro de aproximadamente 2 horas')
  })

  it('combina horas y minutos cuando hay resto', () => {
    expect(formatearETATexto(75)).toBe('dentro de aproximadamente 1 hora y 15 minutos')
    expect(formatearETATexto(80)).toBe('dentro de aproximadamente 1 hora y 30 minutos')
    expect(formatearETATexto(100)).toBe('dentro de aproximadamente 1 hora y 45 minutos')
  })
})
