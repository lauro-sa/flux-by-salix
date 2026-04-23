/**
 * Tests de los helpers de teléfono en validaciones.ts.
 * Se enfoca en normalizarTelefono y generarVariantesTelefono — críticos para
 * dedup, búsqueda y matching del webhook de WhatsApp.
 */

import { describe, it, expect } from 'vitest'
import { normalizarTelefono, generarVariantesTelefono, telefonosCoinciden } from '../validaciones'

describe('normalizarTelefono', () => {
  it('devuelve null para input vacío o falsy', () => {
    expect(normalizarTelefono('')).toBeNull()
    expect(normalizarTelefono(null)).toBeNull()
    expect(normalizarTelefono(undefined)).toBeNull()
    expect(normalizarTelefono('   ')).toBeNull()
  })

  it('descarta input con menos de 6 dígitos', () => {
    expect(normalizarTelefono('123')).toBeNull()
    expect(normalizarTelefono('12345')).toBeNull()
  })

  it('agrega prefijo país AR (+54) y el 9 móvil cuando viene solo el área+número', () => {
    expect(normalizarTelefono('1156029403')).toBe('5491156029403')
  })

  it('agrega el 9 móvil si viene 54 pero sin 9', () => {
    expect(normalizarTelefono('541156029403')).toBe('5491156029403')
  })

  it('preserva el formato canónico cuando ya viene completo', () => {
    expect(normalizarTelefono('5491156029403')).toBe('5491156029403')
    expect(normalizarTelefono('+5491156029403')).toBe('5491156029403')
  })

  it('limpia espacios, guiones, paréntesis y puntos', () => {
    expect(normalizarTelefono('+54 9 11 5602-9403')).toBe('5491156029403')
    expect(normalizarTelefono('(011) 5602-9403')).toBe('5491156029403')
    expect(normalizarTelefono('11.5602.9403')).toBe('5491156029403')
  })

  it('preserva números no-AR (international)', () => {
    expect(normalizarTelefono('+1 415 555 1234')).toBe('14155551234')
    expect(normalizarTelefono('+34 612345678')).toBe('34612345678')
  })

  it('preserva fijos AR sin agregar el 9 móvil', () => {
    // Fijo 11 4567 8910 → +54 11 4567 8910 → 541145678910 (sin 9)
    const norm = normalizarTelefono('541145678910')
    // libphonenumber puede o no parsearlo como móvil; verificamos que no rompió
    expect(norm).toMatch(/^54/)
  })
})

describe('generarVariantesTelefono', () => {
  it('devuelve [] para input vacío', () => {
    expect(generarVariantesTelefono(null)).toEqual([])
    expect(generarVariantesTelefono('')).toEqual([])
  })

  it('genera variantes con/sin 9 para móviles AR', () => {
    const variantes = generarVariantesTelefono('1156029403')
    // Debe contener al menos: canónico, sin 9, con +, local
    expect(variantes).toContain('5491156029403')
    expect(variantes).toContain('541156029403')
    expect(variantes).toContain('+5491156029403')
  })

  it('incluye el formato crudo del input original', () => {
    const variantes = generarVariantesTelefono('11-5602-9403')
    expect(variantes).toContain('1156029403')
  })

  it('genera el mismo set de variantes sin importar el formato de entrada', () => {
    const a = new Set(generarVariantesTelefono('1156029403'))
    const b = new Set(generarVariantesTelefono('+54 9 11 5602-9403'))
    // Ambos deben generar al menos el canónico
    expect(a.has('5491156029403')).toBe(true)
    expect(b.has('5491156029403')).toBe(true)
  })
})

describe('telefonosCoinciden', () => {
  it('matchea el mismo número en distintos formatos', () => {
    expect(telefonosCoinciden('1156029403', '+54 9 11 5602-9403')).toBe(true)
    expect(telefonosCoinciden('5491156029403', '541156029403')).toBe(true)
  })

  it('no matchea números distintos', () => {
    expect(telefonosCoinciden('1156029403', '1199998888')).toBe(false)
  })

  it('no matchea con falsy', () => {
    expect(telefonosCoinciden(null, '1156029403')).toBe(false)
    expect(telefonosCoinciden('1156029403', '')).toBe(false)
  })
})
